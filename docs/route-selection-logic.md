# ルート選定ロジック資料

このドキュメントは、現在のアプリで「どのルートを選び、どの地点を Street View で表示するか」を決めている実装を整理したものです。

## 全体像

ルートは大きく次の順で決まります。

1. Google Maps の Directions API で経路を取得する(WALKING と DRIVING の2種類)
2. WALKING の経路を、DRIVING の道路回廊内にスナップして「お散歩ルート」に整形する
3. 経路の座標列を一定間隔でサンプリングする
4. Street View の屋外画像が取れる地点だけ残す
5. 画像をプレフェッチして再生可能な状態にする

実装上は、`src/App.tsx` が全体のオーケストレーションを担当し、細かな判定は `src/lib/routeSampling.ts` と `src/lib/streetViewStatic.ts` に分かれています。

## ルート取得

ルートの起点は `buildRoute()` です。

`src/App.tsx` では Google Maps の `DirectionsService` を使って、出発地と目的地の間の経路を **WALKING と DRIVING の2種類** 取得しています。

### 現在のルート条件

`routeWithDirections()` で指定している条件は次の通りです。

- `travelMode`: `WALKING`(メイン)と `DRIVING`(道路回廊の参照用)
- `avoidHighways: true`
- `optimizeWaypoints: false`
- `provideRouteAlternatives: false`

WALKING は一方通行を無視する(歩行者は歩道を逆方向にも歩ける)ため、これをベースの経路として採用しています。ただし WALKING 単体では店舗の敷地内通路など「車道沿いの歩道」ではない歩行者データを拾ってしまうことがあるため、DRIVING の経路(高速道路を避けた車道)を道路回廊の参照として使い、WALKING の経路をその回廊内にスナップします。DRIVING の取得に失敗しても致命的エラーにはせず、WALKING の生の経路をそのまま使います。

### 道路回廊スナップ

`snapToRoadCorridor()`(`src/lib/routeSampling.ts`)が、WALKING の各点について DRIVING 経路上の最近傍点を求め、そこまでの距離が `VITE_ROAD_CORRIDOR_METERS`(デフォルト20m)を超える場合だけ DRIVING 側の点にスナップします。回廊内に収まっている点はそのまま残るため、一方通行を逆走するような区間の向きは保持されます。

地下通路は地上の道路の真下を通ることが多く、水平距離だけでは「回廊内」と判定されてスナップされません。そのため `getRoutePath()` は WALKING の各ステップの案内文(`step.instructions`)に「地下」を含むかどうかを判定し(`isUndergroundStep()`)、該当ステップの点は距離に関わらず強制的に DRIVING 側へスナップします(`snapToRoadCorridor()` の `forceSnap` 引数)。

## 経路の座標化

Google Maps から得た `DirectionsRoute` は、そのままだと再生用の細かい座標列として扱いづらいため、`getRoutePath()` で座標を抽出します。

`getRoutePath()` の挙動は次の通りです。

- 各 `leg` の `step.path` を順番に連結する
- 直前と同一の座標は重複追加しない
- 各点について、その点が属するステップが地下通路かどうか(`underground` 配列)も一緒に返す
- `path` が空の場合は `route.overview_path` を使う(この場合 `underground` はすべて `false`)

つまり、可能な限りステップ単位の詳細な経路を優先し、取れない場合だけ概要経路にフォールバックします。

## 進行方向ラベル

各地点には、表示用の進行方向キューが付きます。

### ラベルの生成

`getTurnCueAnchors()` で、各ステップの開始地点を基準に折れ曲がり候補を集めます。  
その後 `cueFromManeuver()` が Google の `maneuver` 文字列(`turn-slight-left` などの厳密な値)を `MANEUVER_CUE_LABELS` テーブルで引き、次のラベルに変換します。

現在の変換は次の通りです。

| maneuver | ラベル |
| --- | --- |
| `turn-left` / `fork-left` / `ramp-left` / `roundabout-left` | `左へ` |
| `turn-right` / `fork-right` / `ramp-right` / `roundabout-right` | `右へ` |
| `turn-slight-left` | `やや左へ` |
| `turn-slight-right` | `やや右へ` |
| `turn-sharp-left` | `大きく左へ` |
| `turn-sharp-right` | `大きく右へ` |
| `uturn-left` / `uturn-right` | `Uターン` |
| 上記以外(`straight` や `maneuver` 未設定など) | ラベルなし |

テーブルに無い未知の `maneuver` が来た場合のフォールバックとして、`"left"` を含めば `左へ`、`"right"` を含めば `右へ` として扱います。

### 実際の表示

`sampleRoute()` 内の `assignTurnCues()` が、サンプリング後の各地点にターンキューを割り当てます。

アンカーは `getTurnCueAnchors()` がルートの進行順にそのまま生成しているため、`assignTurnCues()` も**進行方向に1方向だけ進むポインタ**でアンカーを順番に辿ります(直線距離だけで「一番近いアンカー」を全アンカーから毎回探すのではない)。具体的には、各地点について「次のアンカーの方が近くなったらポインタを進める」を繰り返し、そのときのアンカーとの距離が `TURN_CUE_RADIUS_METERS`(18m)以内なら、そのアンカーのラベルを採用します。

この設計により、経路がジグザグしていたり地下迂回でDRIVING側にスナップされて経路が交差・近接するような区間でも、まだ到達していない先のアンカーや、通過済みのアンカーに誤って引き寄せられることがありません(ポインタは後戻りしないため)。18m以内にアンカーが無ければ `直進` を表示します。

## サンプリング

経路上の座標は、そのままだと細かすぎるため、`src/lib/routeSampling.ts` の `sampleRoute()` で間引きます。

### サンプリングの考え方

`sampleRoute()` は、ポイント間の距離を見ながら、指定間隔ごとに補間点を作ります。

処理の流れは次の通りです。

1. 元の座標列の先頭を必ず残す
2. 各区間の距離を `distanceMeters()` で計算する
3. `intervalMeters` ごとに補間点を追加する
4. 最後の点が十分近くなければ終点を追加する
5. **間引く前に**、この時点(間引き前)の全補間点に対して `assignTurnCues()` でターンキューを割り当てる
6. `maxFrames` に収まらない場合は `limitFrameIndices()` でさらに間引く
7. 各点に `heading` と `cue`(間引き後の点に対応する、手順5で計算済みのラベル)を付与する

### 間引きと曲がり角の関係

`limitFrameIndices()` は単純にインデックスを均等間隔で間引くのではなく、**各ターンアンカーに一番近い点(存在する場合)を必ず残す**ように間引きます。具体的には、先頭・末尾の点に加えて、各アンカーの最近傍点を「間引き対象外」として確保し、残りのフレーム予算をその間の区間に距離に応じて振り分けます。

以前は「間引き → ターンキュー割り当て」の順で処理していたため、長いルート(5m間隔のサンプル数が `maxFrames` を超える、おおよそ1km超)では均等間引きで曲がり角の点がたまたま消え、その曲がり角自体が再生から欠落することがありました。順序を入れ替えたことで、この欠落は起きなくなっています。

### 間引きの閾値

現在の設定値は `src/lib/env.ts` から読み込まれます。

- `VITE_ROUTE_SAMPLE_INTERVAL_METERS`
- `VITE_MAX_PREFETCH_FRAMES`

デフォルト値はそれぞれ `5` メートル、`200` フレームです。

## Street View の採用条件

サンプリング後の地点は、そのままでは使わず、`filterOutdoorStreetViewPoints()` で屋外画像が取れる地点だけ残します。

### 判定方法

`hasOutdoorStreetView()` では Street View metadata API を使って次を確認しています。

- `status === 'OK'`
- `location` が返っている
- metadata の位置がルート地点から `streetViewRadiusMeters` 以内
- `copyright` に `google` が含まれている

この条件を満たした地点だけが、最終的な再生候補になります。

### 関連する設定値

`src/lib/env.ts` から以下の値を使います。

- `VITE_STREET_VIEW_RADIUS_METERS`
- `VITE_STREET_VIEW_SIZE`
- `VITE_STREET_VIEW_FOV`
- `VITE_STREET_VIEW_PITCH`

## 画像の取得

採用された各地点は `buildStreetViewUrl()` で Street View 静止画 URL に変換されます。  
その後 `prefetchImages()` で事前読み込みし、再生開始時に表示が途切れにくいようにしています。

## URL からの再現

アプリは共有 URL からもルートを復元できます。

`getEncodedPathFromUrl()` で `encodedPath` を読み取り、存在する場合はその座標列を `prepareRoute()` に渡して再生します。  
このため、現在の表示ルートは「検索で作る」場合と「URL で復元する」場合の両方で同じ処理経路を通ります。

## 実装上の責務分担

- `src/App.tsx`
  - ルート取得の起点
  - API 呼び出しの制御
  - エラー処理
  - 全体の状態遷移
- `src/lib/routeSampling.ts`
  - WALKING 経路の道路回廊スナップ(`snapToRoadCorridor()`)
  - 座標の補間
  - 間引き
  - heading 計算
  - turn cue の付与
- `src/lib/streetViewStatic.ts`
  - Street View URL の生成
  - 屋外地点のフィルタリング
  - 画像のプレフェッチ
- `src/lib/env.ts`
  - 調整値の読み込み

## 調整しやすいポイント

ロジック変更で触ることが多いのは次の箇所です。

- 高速道路を避けるかどうか -> `routeWithDirections()`
- WALKING をどこまで道路回廊内に収めるか -> `VITE_ROAD_CORRIDOR_METERS`(`snapToRoadCorridor()`)
- 地下通路とみなす条件 -> `isDescendStep()` / `isAscendStep()` の `LEVEL_CHANGE_PATTERN` / `DOWN_PATTERN` / `UP_PATTERN`
- ルートの密度 -> `VITE_ROUTE_SAMPLE_INTERVAL_METERS`
- 1回で扱う最大フレーム数 -> `VITE_MAX_PREFETCH_FRAMES`
- Street View を採用する距離の厳しさ -> `VITE_STREET_VIEW_RADIUS_METERS`
- 進行方向ラベルの出し方 -> `cueFromManeuver()`(maneuver→ラベル変換)と `assignTurnCues()`(地点への割り当て)

## 注意点

- ルート選定は完全な独自ルーティングではなく、Google Maps の経路結果に依存しています
- `filterOutdoorStreetViewPoints()` の判定が厳しいため、条件によっては候補が0件になり、エラー表示になります
- `avoidHighways: true` により、最短距離よりも高速道路回避を優先します
- `VITE_ROAD_CORRIDOR_METERS` を小さくしすぎると、WALKING の合法な歩道の揺れまで DRIVING 側にスナップされ、不自然な直線になりやすくなります
- DRIVING の取得に失敗した場合は道路回廊チェック自体をスキップするため、その回だけ WALKING の生データ(店舗敷地内・地下通路などを含みうる)がそのまま採用されます
- `isDescendStep()` / `isAscendStep()` は案内文のテキストマッチに依存する簡易判定のため、日本語の言い回し次第で地下通路を見逃す(または関係ない地名を誤検知する)可能性があります
- **長距離ルート(数km以上)では `snapToRoadCorridor()` によるスナップが支配的になり、ターンキューの多くが失われることが分かっています。** WALKING と DRIVING は長距離になるほど選ぶ道が大きく異なるため、`VITE_ROAD_CORRIDOR_METERS`(既定20m)を超えて多くの点がDRIVING側へスナップされ、`getTurnCueAnchors()` が持つ元のWALKING座標から離れてしまいます。実測(渋谷駅→二子玉川駅、約8.4km)では約8割の点がスナップされ、22個のターンのうち最終的に再生へ残ったのは0個でした。フレーム間引き自体は正しく動作しており、原因はスナップによる座標のズレです。長距離ルートでのターンキュー精度を上げるには、道路回廊の設計そのものを見直す必要があります(未対応)。

## まとめ

現在のルート選定は、次の思想で構成されています。

- Google Maps に大枠の道順を決めてもらう(WALKING で一方通行を無視しつつ、DRIVING の道路回廊で私有地の抜け道を防ぐ)
- アプリ側で再生しやすい密度に整える
- 屋外 Street View が取れる地点だけを残す
- 画面再生向けに方向と到着キューを付ける

この構成のため、**「どの道を行くか」よりも「その道をどう見せるか」** に重心が置かれています。
