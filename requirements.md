# Street View Route Player 要件整理

## 1. 概要

Google Maps の経路情報から Street View Static API の画像列を生成し、ユーザーの縦スクロールに連動して風景が進む Web アプリを作る。

React と Tailwind CSS を前提に、モバイルでは没入感のあるフルスクリーン体験、PC では景観を邪魔しない最小限の検索 UI を提供する。

## 2. 主要体験

1. ユーザーが URL にアクセスする。
2. URL パラメータに経路情報があれば、そのままルート生成処理へ進む。
3. 経路情報がなければ、出発地と目的地を入力する検索 UI を表示する。
4. ルート生成後、初回は `Tap to Start` を表示する。
5. ユーザーのタップをきっかけにフルスクリーン化し、スクロール連動再生を開始する。
6. スクロール量に応じて Street View 画像がクロスフェードで切り替わる。
7. 共有ボタンから現在のルート URL をクリップボードへコピーできる。

## 3. URL と初期化

### 対応する URL パラメータ

初期実装では次のいずれかを扱う。

- `?path=enc:<encodedPolyline>`
- `?start=<lat,lng>&end=<lat,lng>`
- 将来的に `?route_id=<id>` も検討する

### 初期化フロー

1. 起動時に URL パラメータを読み取る。
2. `path=enc:` がある場合は、Google Maps API の `geometry.encoding.decodePath()` で LatLng 配列へ変換する。
3. `start` と `end` がある場合は Directions API で経路を取得する。
4. 有効な経路情報がない場合は検索 UI を表示する。
5. 経路生成後は画像プリフェッチを開始し、再生待機状態へ遷移する。

## 4. 初期表示と状態別 UI

初期表示は、景色を主役にしつつ、ユーザーが次に何をすればよいかだけが分かる状態にする。大きな説明カードや常設フォームは避け、最小限の検索導線と短いステータス表示に留める。

### ルート情報なし

URL に有効なルート情報がない場合は、検索開始画面を表示する。

- 背景は暗めのプレースホルダー、または Street View 風の静かなビジュアルにする。
- 画面中央に大きなカードは置かない。
- 補助テキストを出す場合は、短く `どこから、どこまで歩きますか？` 程度にする。
- モバイルでは、検索アイコンまたはハンバーガーアイコンから検索ドロワーを開く。
- PC では、上部中央にフローティングのピル型検索バーを表示する。
- 共有ボタンは非表示、または disabled にする。

### ルート読み込み中

Directions API、Polyline デコード、座標サンプリング、Street View 画像 URL 生成、プリフェッチの実行中は、読み込み状態を表示する。

- 背景は暗いまま、または取得済みの最初の画像を薄く表示する。
- 表示テキストは `Preparing route...` のように短くする。
- 進捗が出せる場合は、ディープブルー `#004386` の細いプログレスバーを表示する。
- 検索 UI は操作を邪魔しないよう閉じる。
- エラーが発生した場合は、検索 UI に戻れる導線を出す。

### ルート準備完了

画像の表示準備ができたら、再生開始前の待機状態にする。

- 背景に最初の Street View 画像を全面表示する。
- 画面中央に `Tap to Start` を表示する。
- スクロールはまだ有効化しない。
- タップ時に Fullscreen API を呼び出し、成功またはフォールバック後に再生状態へ遷移する。
- モバイルでは特に、ブラウザ UI を感じさせない没入モードへの入口として扱う。

### 再生中

再生中は Street View 画像を全面表示し、UI は最小限にする。

- スクロール量に応じて画像をクロスフェードで切り替える。
- 右下に共有アイコンを表示する。
- 検索をやり直すためのトリガーは、景観を邪魔しない小さなアイコンまたはピルとして表示する。
- ヘッダー、フッター、常設説明文は表示しない。

### 状態別サマリー

```txt
empty:
  ルートなし。検索開始 UI を表示する。

loadingRoute / prefetchingImages:
  ルート準備中。短いテキストと細い進捗表示を出す。

ready:
  最初の画像と Tap to Start を表示する。

playing:
  スクロール連動再生を行い、共有アイコンだけを控えめに表示する。

error:
  短いエラー表示と検索へ戻る導線を表示する。
```

## 5. ルート生成ロジック

### Directions API

出発地と目的地から Google Maps Directions API を呼び出し、経路の Polyline を取得する。

### Route Optimization API の扱い

Google Maps Platform には Route Optimization API もあるが、初期実装では必須にしない。

Route Optimization API は、単純な A 地点から B 地点への経路取得というより、複数の訪問先、複数車両、時間枠、積載量、配送順序などを考慮して最適なルート計画を作るための API として扱う。

今回のアプリの初期要件では、ユーザーが指定した出発地と目的地の間を Street View で再生することが主目的のため、まずは Directions API または Routes API 相当の経路取得で十分とする。

将来的に次のような機能を入れる場合は、Route Optimization API の導入を検討する。

- 複数の立ち寄り地点を自動で並び替える
- 観光地、カフェ、ホテルなどをまとめて巡る最適順を作る
- 所要時間や営業時間を考慮した散歩ルートを作る
- 複数人または複数車両の移動計画を最適化する
- 配送、営業訪問、現地調査のような業務用途に拡張する

注意点:

- Route Optimization API は REST / gRPC などの Web Service として使う。
- 認証は OAuth を使う前提のため、フロントエンドだけで直接扱う設計にはしない。
- 導入する場合は、サーバー側 API を用意し、フロントエンドからは自前のバックエンド経由で呼び出す。
- そのため、フロントエンド用の `.env` に置く `VITE_GOOGLE_MAPS_API_KEY` とは別系統のサーバー側設定が必要になる。

### Polyline デコード

取得した encoded polyline を `google.maps.geometry.encoding.decodePath()` で LatLng 配列に変換する。

### 座標の間引き

Street View 画像の取得枚数とスクロールの滑らかさを両立するため、経路上の座標を一定距離ごとにサンプリングする。

- 初期値: 5m 間隔
- 距離計算: Google Maps Geometry Library または独自の haversine 計算
- 出力: `RoutePoint[]`

```ts
type RoutePoint = {
  lat: number;
  lng: number;
  heading: number;
};
```

### Heading

各地点から次の地点への方角を算出し、Street View Static API の `heading` に指定する。

## 6. Street View 画像取得

### URL 生成

各 `RoutePoint` から Street View Static API の画像 URL を生成する。

必要なパラメータ例:

- `location=<lat,lng>`
- `heading=<heading>`
- `size=<width>x<height>`
- `fov`
- `pitch`
- `radius`
- `source=outdoor`
- `key`

屋内ビューや店舗内パノラマには吸着させない。Street View Static API は `source=outdoor` と `return_error_code=true` を指定し、メタデータ確認でも屋外ビューが存在する地点のみを採用する。近くの店舗・施設内ビューにスナップしてしまう地点はフレームから除外する。店舗提供や第三者提供のパノラマを拾いやすい地点は避け、原則として Google 公式の道路系パノラマを使う。

徒歩ルートは駅構内、商業施設内、地下通路などを通る場合があるため、Street View 再生用の経路は道路ベースで取得する。高速道路は避け、一般道を通る最短寄りのルートを優先する。

### プリフェッチ

スクロール時の遅延を抑えるため、画像 URL のリストを事前読み込みする。

初期実装では全件プリフェッチを基本とし、経路が長い場合は現在位置周辺を優先する段階的プリフェッチを検討する。

### エラー時

画像取得に失敗した場合は、該当フレームをスキップするか、直前の画像を維持する。

## 7. スクロール連動再生

### 基本仕様

1. 縦スクロール量 `scrollTop` を監視する。
2. スクロール位置を画像配列のインデックスに変換する。
3. 対応する画像を `<img>` の `src` に反映する。
4. 画像切り替えはクロスフェードで滑らかに見せる。

### 実装方針

- スクロール用の透明な高さを持つコンテナを用意する。
- 表示画像は `position: fixed` で画面全体に固定する。
- 2 枚の画像レイヤーを交互に切り替え、opacity でクロスフェードする。
- スクロール監視は `requestAnimationFrame` で間引く。

## 8. モバイル要件

対象は iPhone 12 以降、最新世代の Google Pixel などのモダンなスマートフォン。

### Dynamic Viewport

- 高さ指定には `100vh` ではなく `100dvh` を使う。
- Tailwind では `h-dvh` や `min-h-dvh` を使う。

### Tap to Start

初回アクセス時はスクロールを無効にし、画面中央に `Tap to Start` を表示する。

ユーザーが画面をタップしたら:

1. `requestFullscreen()` を呼び出す。
2. `Tap to Start` をフェードアウトする。
3. スクロール連動処理を有効にする。

Fullscreen API が使えない環境では、通常のフルスクリーン風レイアウトとして継続する。

### PWA / Standalone

`public/manifest.json` を用意し、HTML の `<head>` に次の設定を入れる。

- `manifest.json`
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-status-bar-style`
- `theme-color`
- viewport 設定

### オーバースクロール防止

`body` に次の CSS を適用する。

```css
body {
  overscroll-behavior: none;
}
```

Pull-to-refresh や端のバウンス感を抑え、ネイティブアプリに近い操作感にする。

## 9. 検索 UI

### モバイル

画面上には検索入力を常設しない。景観を優先し、検索トリガーのみを表示する。

仕様:

- ハンバーガーアイコンまたは検索アイコンを配置する。
- 位置は右下または左上を候補とする。
- タップすると検索専用のドロワーを表示する。
- ドロワーは下からスライドインする Bottom Sheet、または全画面モーダルとする。
- ドロワー内で出発地と目的地を入力する。
- `ルート生成` 実行後、ドロワーを閉じて `Tap to Start` 状態へ遷移する。

### PC

画面上部中央にフローティングのピル型検索トリガーを表示する。

仕様:

- Idle 状態では、現在のルート概要と検索アイコンのみを表示する。
- クリックすると下方向へエキスパンドする。
- 展開後に出発地、目的地、ルート生成ボタンを表示する。
- ルート生成時、または外側クリック時に折り畳む。
- Airbnb の検索バーのような滑らかなアコーディオン挙動を目指す。

### Places Autocomplete

入力欄には Google Maps Places Autocomplete API を組み込む。

目的:

- 表記揺れへの対応
- ひらがな、漢字、ローマ字、略称の候補表示
- 正式名称と住所の選択
- 入力ストレスの軽減

例:

- `じゆうがおか`
- `自由ケ丘`
- `Jiyugaoka`
- `スタバ`

目的地入力では、出発地が候補選択などで位置情報を持っている場合、その出発地に近い候補を優先して表示する。距離が取得できる場合は候補に距離を表示し、近い順で並べる。

出発地が決まっている場合、目的地候補は徒歩2時間圏内を目安に絞る。初期実装では徒歩速度をおよそ時速5kmとみなし、直線距離で約10km以内の候補だけを表示する。圏外の候補、たとえば世田谷から京都のような現実的に歩かない候補は表示しない。

## 10. 海外利用・日本語ユーザー対応

海外に滞在中の日本人ユーザーでも自然に使えるよう、検索対象はグローバルにしつつ、UI と候補表示は日本語を優先する。

### 基本方針

- サービス対象地域を日本国内に限定しない。
- 海外の都市、駅、店舗、観光地、住所でもルート生成できるようにする。
- UI 文言は初期状態では日本語を基本にする。
- Google Maps API の結果表示は、可能な範囲で日本語を優先する。
- 現地語の地名や英語表記もそのまま検索できるようにする。

### Google Maps API の言語設定

Maps JavaScript API、Directions API、Places API では、必要に応じて `language=ja` を指定する。

目的:

- 検索候補や住所表示を日本語寄りにする。
- 海外の地名でも、日本語名がある場合は日本語表示を優先する。
- 日本語名がない場合は、現地語または英語の自然な表記を利用する。

`region` は検索結果の偏りに影響するため、海外利用を重視する場合は固定しすぎない。日本語 UI を優先したい場合でも、`region=JP` の常時指定は避け、必要になった場合だけ検討する。

### Places Autocomplete

Places Autocomplete は海外の地点も検索対象に含める。

- `componentRestrictions` で国を日本に固定しない。
- 日本語、英語、ローマ字、現地語で入力できるようにする。
- 候補には施設名と住所を表示し、国や都市が分かるようにする。
- 同名の場所が複数国にある場合は、国名・都市名を併記して誤選択を防ぐ。

### 現在地とタイムゾーン

現在地を使う機能を追加する場合は、ブラウザの Geolocation API を任意許可で使う。

- 現在地取得は必須にしない。
- 拒否されても出発地・目的地の手入力で使えるようにする。
- 距離表示はメートル / キロメートルを基本にする。
- 時刻や営業時間を表示する場合は、地点の現地タイムゾーンを尊重する。

### 共有 URL

海外の地点を含むルートでも共有 URL が壊れないようにする。

- 共有 URL には表示名だけでなく、座標または encoded polyline を含める。
- 日本語、現地語、絵文字などを含む地点名は URL エンコードする。
- 共有された側の環境や国に依存せず、同じルートを復元できるようにする。

## 11. 共有 UI

### 表示

画面右下に細いアウトラインのリンクアイコンをフローティング表示する。

### 挙動

クリック時に現在のルート情報を含む URL を生成し、`navigator.clipboard.writeText()` でコピーする。

コピー成功時:

- `Copied to clipboard` を表示する。
- 表示位置は画面中央またはアイコン付近。
- 約 2 秒後にフェードアウトする。

失敗時:

- 短いエラートーストを表示する。

## 12. ビジュアルデザイン

### 基本方針

- 極限までミニマルにする。
- ヘッダーとフッターは置かない。
- Street View 画像を画面全体に表示する。
- 画像は `object-fit: cover` で全面配置する。
- UI は景観を邪魔しない透過感と小さな面積に抑える。
- Street View 特有のデフォルト UI は表示しない。

### Tailwind 方針

既存の `design.md` に合わせ、Tailwind のユーティリティを中心に構成する。

アクセントカラー:

- `brand`: `#004386`
- 用途: トースト、プログレス、フォーカスリング、主要ボタン

主要な Tailwind 例:

- 画面: `fixed inset-0 h-dvh w-screen overflow-hidden`
- 画像: `absolute inset-0 h-full w-full object-cover`
- フローティングボタン: `fixed z-30 rounded-full border border-white/40 bg-black/20 backdrop-blur-md`
- トースト: `fixed z-50 rounded-full bg-brand px-4 py-2 text-sm text-white`

## 13. React コンポーネント案

```txt
src/
  App.tsx
  components/
    StreetViewPlayer.tsx
    TapToStartOverlay.tsx
    ShareButton.tsx
    Toast.tsx
    RouteSearchMobile.tsx
    RouteSearchDesktop.tsx
    PlaceAutocompleteInput.tsx
  hooks/
    useRouteParams.ts
    useRouteBuilder.ts
    useStreetViewImages.ts
    useScrollFrameIndex.ts
    useFullscreenStart.ts
    useToast.ts
  lib/
    googleMaps.ts
    polyline.ts
    routeSampling.ts
    streetViewStatic.ts
    shareUrl.ts
```

## 14. 状態設計

```ts
type AppPhase =
  | 'empty'
  | 'searching'
  | 'loadingRoute'
  | 'prefetchingImages'
  | 'ready'
  | 'playing'
  | 'error';
```

主要状態:

- `routePoints`
- `imageUrls`
- `currentFrameIndex`
- `isSearchOpen`
- `isFullscreenStarted`
- `toast`
- `error`

## 15. API キーと環境変数

Google Maps 関連 API のキーは環境変数で管理する。

例:

```env
VITE_GOOGLE_MAPS_API_KEY=...
```

sample 用の `.env.example` は置かない。開発時は各自のローカル `.env` に直接設定し、実際の API キーはリポジトリに含めない。

使用 API:

- Maps JavaScript API
- Geometry Library
- Directions API
- Places API
- Street View Static API

将来検討する API:

- Routes API
- Route Optimization API

Route Optimization API を使う場合は、フロントエンド用の `VITE_` 環境変数ではなく、サーバー側の認証情報として管理する。

主な環境変数:

- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_DEFAULT_START`
- `VITE_DEFAULT_END`
- `VITE_STREET_VIEW_SIZE`
- `VITE_STREET_VIEW_FOV`
- `VITE_STREET_VIEW_PITCH`
- `VITE_ROUTE_SAMPLE_INTERVAL_METERS`
- `VITE_MAX_PREFETCH_FRAMES`

## 16. エラーハンドリング

想定するエラー:

- URL パラメータが不正
- ルートが取得できない
- Places Autocomplete が候補を返さない
- Street View 画像が存在しない
- API キー未設定
- API 制限または課金設定の問題
- Clipboard API が利用できない
- Fullscreen API が拒否される

UI 方針:

- エラー文言は短く表示する。
- 背景体験を壊さないよう、小さなトーストまたは検索パネル内のメッセージに留める。

## 17. 実装フェーズ

### Phase 1: 基盤

- React + Tailwind CSS のセットアップ
- `100dvh` と overscroll 防止
- PWA 用メタタグと manifest
- 画面全面画像レイヤーの実装

### Phase 2: ルート生成

- URL パラメータ読み取り
- Directions API 連携
- Polyline デコード
- 5m 間隔の座標サンプリング
- heading 算出

### Phase 3: 画像取得

- Street View Static API URL 生成
- 画像プリフェッチ
- ローディング状態
- 取得失敗時のフォールバック

### Phase 4: スクロール再生

- `scrollTop` 監視
- スクロール位置とフレームインデックスのマッピング
- クロスフェード
- `Tap to Start` と Fullscreen API

### Phase 5: 検索 UI

- モバイル用検索ドロワー
- PC 用フローティング検索バー
- Places Autocomplete
- ルート生成後の状態遷移

### Phase 6: 共有と仕上げ

- 共有 URL 生成
- Clipboard API
- トースト通知
- レスポンシブ調整
- 実機スマホでのフルスクリーン確認

## 18. 未決事項

- URL 共有形式を `path=enc:` に寄せるか、`start/end` に寄せるか。
- 長距離ルートでの画像枚数制限と課金対策。
- Street View が存在しない地点のスキップ方法。
- 初期リリースで PWA インストール導線を表示するか。
- 検索トリガーのモバイル配置を右下にするか左上にするか。
- フルスクリーン開始前に画像プリフェッチを完了させるか、進捗途中でも開始可能にするか。
