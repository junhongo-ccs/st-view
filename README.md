# ST View

Google Maps の経路を Street View 画像でつなぎ、まるでその道を歩いているかのように再生する Web アプリです。出発地と目的地を入力すると、経路上の Street View 画像列を生成し、マウスホイールや矢印キーの操作に連動してクロスフェードで切り替わります。

## 主な機能

- 出発地・目的地の入力(Google Places Autocomplete、10km圏フィルタ付き)
- 出発地/目的地の入れ替えボタン
- WALKING 経路をベースに、DRIVING 経路を道路回廊として参照し、一方通行の迂回や私有地・地下通路への迂回を抑制(詳細は [`docs/route-selection-logic.md`](docs/route-selection-logic.md))
- 曲がり角(左へ/右へ/やや〜/大きく〜/Uターン)の進行方向ラベル表示
- スクロール・矢印キー・PageUp/PageDown・Home/End での再生位置操作
- 初回タップ時のフルスクリーン化(Escキーで解除可能、PC幅では操作ヒントを表示)
- 共有URL(経路のエンコード済みPolylineを含む)のクリップボードコピー
- URLパラメータからのルート復元

## 技術スタック

- React 18 + TypeScript + Vite
- Tailwind CSS
- Google Maps JavaScript API(Directions API, Places API, Geocoding API, Geometry Library)
- Street View Static API

## セットアップ

### 前提

- Node.js(Viteが動作するバージョン)
- Google Maps Platform の APIキー(以下のAPIを有効化)
  - Maps JavaScript API
  - Directions API
  - Places API
  - Geocoding API
  - Street View Static API
  - Geometry Library は Maps JavaScript API 経由(`libraries=geometry`)で読み込まれます

### インストールと起動

```bash
npm install
# 下記の環境変数を参考に .env を作成
npm run dev
```

`npm run dev` で Vite の開発サーバーが起動します(既定は `http://localhost:5173/`)。

### ビルド

```bash
npm run build   # tsc --noEmit && vite build
npm run preview # ビルド成果物をローカルでプレビュー
```

## 環境変数

`.env` に設定します(`VITE_` プレフィックスが必須)。

| 変数名 | 必須 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | ✓ | - | Google Maps Platform APIキー |
| `VITE_DEFAULT_START` | - | (空) | URLにルート情報が無い場合の既定出発地。空なら検索画面から開始 |
| `VITE_DEFAULT_END` | - | (空) | 既定目的地 |
| `VITE_STREET_VIEW_SIZE` | - | `640x640` | Street View Static API の画像サイズ |
| `VITE_STREET_VIEW_FOV` | - | `90` | 画角(Field of View) |
| `VITE_STREET_VIEW_PITCH` | - | `0` | 上下の傾き |
| `VITE_STREET_VIEW_RADIUS_METERS` | - | `10` | 地点からStreet View画像を探す半径(m) |
| `VITE_ROUTE_SAMPLE_INTERVAL_METERS` | - | `5` | 経路をサンプリングする間隔(m) |
| `VITE_MAX_PREFETCH_FRAMES` | - | `200` | 1回のルートで事前読み込みする最大フレーム数 |
| `VITE_ROAD_CORRIDOR_METERS` | - | `20` | WALKING経路をDRIVING経路(道路回廊)にスナップする許容距離(m) |

### デプロイ時の注意

APIキーには HTTPリファラー制限をかけている場合、デプロイ先のドメイン(例: `https://<project>.vercel.app/*`)を許可リストに追加する必要があります。未追加だと `RefererNotAllowedMapError` により地図・検索候補などが動作しません。また `.env` は Git管理外のため、Vercel等のホスティング先には環境変数を別途設定してください。

## ディレクトリ構成

```
src/
  App.tsx                       # ルート取得のオーケストレーション、状態遷移
  components/
    RouteSearch.tsx             # 出発地・目的地の検索UI(モバイル/PC)
    PlaceAutocompleteInput.tsx  # Places Autocomplete入力欄
    StreetViewPlayer.tsx        # Street View再生・スクロール/キー操作
    PlaceholderScene.tsx        # 初期表示・プレースホルダー画面
    TapToStartOverlay.tsx       # 「Tap to Start」オーバーレイ
    LoadingOverlay.tsx          # ルート生成・画像プリフェッチ中の表示
    ShareButton.tsx             # 共有URLコピー
    Toast.tsx                   # トースト通知
  lib/
    googleMaps.ts               # Maps JS APIの読み込み、geocodeヘルパー
    routeSampling.ts            # 座標サンプリング・道路回廊スナップ・曲がり角判定
    streetViewStatic.ts         # Street View URL生成・屋外判定・プリフェッチ
    routeParams.ts / shareUrl.ts # URLパラメータの読み書き
    env.ts                      # 環境変数の集約
  types.ts                      # 共有型定義
```

## ドキュメント

- [`docs/route-selection-logic.md`](docs/route-selection-logic.md) — ルート選定ロジック(WALKING/DRIVING併用、道路回廊スナップ、曲がり角ラベル判定など)の詳細資料
- [`requirements.md`](requirements.md) — 要件整理
- [`design.md`](design.md) — デザインルール(カラー・タイポグラフィ・余白など)
