# 業務アプリ向け UI デザインルール

対象：PC専用業務アプリ
基準画面：1920 × 1080
スマートフォン対応は考慮しない
実装前提：Tailwind CSS

## 0. 基本方針

このUIは、業務アプリケーションの管理画面・検索画面・一覧画面・入力画面・ダッシュボードを想定する。
LPやブランドサイトのような大きな余白・大きな文字・過剰な装飾は避ける。

重要なのは以下の3点。

1. 情報量を十分に入れる
2. 見出し・本文・補足・ラベルの階層を明確にする
3. LLMがUIを生成しても、余白・文字サイズ・色・角丸が暴走しないように制約する

## 1. 画面レイアウト

### 推奨構成

1920×1080のPC画面では、以下を基本構成とする。

* 上部ヘッダー：高さ 56px
* 左サイドバー：幅 240px〜280px
* メイン領域：残り幅を使用
* メイン領域の外側余白：24px
* パネル間の余白：16px
* パネル内の余白：16px

### Tailwind指定例

```html
<div class="min-h-screen bg-slate-50 text-slate-800">
  <header class="h-14 border-b border-slate-200 bg-white"></header>

  <div class="flex">
    <aside class="w-64 border-r border-slate-200 bg-white"></aside>

    <main class="flex-1 p-6">
      <div class="grid grid-cols-12 gap-4">
        <!-- contents -->
      </div>
    </main>
  </div>
</div>
```

### 禁止事項

* `p-10`、`p-12` 以上の大きな余白を多用しない
* `text-3xl` 以上の見出しを通常画面で使わない
* 中央寄せのLP風レイアウトにしない
* `max-w-4xl mx-auto` のように業務アプリ画面を狭くしない
* 1画面に情報が少なすぎるカードUIを乱立しない

## 2. カラーシステム

業務アプリでは、彩度を抑えたスレート系を基調にする。
ブランドカラーは強調や主要アクションに限定して使う。

### 基本カラー

| 用途    |       色 | Tailwind例             |
| ----- | ------: | --------------------- |
| アプリ背景 | #f8fafc | `bg-slate-50`         |
| パネル背景 | #ffffff | `bg-white`            |
| 境界線   | #e2e8f0 | `border-slate-200`    |
| 強い文字  | #0f172a | `text-slate-900`      |
| 通常文字  | #334155 | `text-slate-700`      |
| 補足文字  | #64748b | `text-slate-500`      |
| 無効文字  | #94a3b8 | `text-slate-400`      |
| ブランド色 | #004386 | `bg-brand text-brand` |

### 色の使用ルール

* 本文に真っ黒 `#000000` は使わない
* 背景に強い青やグラデーションを多用しない
* 主要ボタン以外にブランドカラーを使いすぎない
* 警告・エラー・成功色は必要箇所だけに限定する

### 状態色

| 状態  | 推奨クラス                                               |
| --- | --------------------------------------------------- |
| 成功  | `text-emerald-700 bg-emerald-50 border-emerald-200` |
| 警告  | `text-amber-700 bg-amber-50 border-amber-200`       |
| エラー | `text-red-700 bg-red-50 border-red-200`             |
| 情報  | `text-sky-700 bg-sky-50 border-sky-200`             |

## 3. タイポグラフィ

PC業務アプリでは、本文を大きくしすぎない。
基本本文は `14px`、表やラベルは `12px〜13px` を中心にする。

### 文字サイズルール

| 用途       |  サイズ |   行間 | Tailwind例                                                           |
| -------- | ---: | ---: | ------------------------------------------------------------------- |
| 画面タイトル   | 22px | 28px | `text-[22px] leading-7 font-semibold tracking-tight text-slate-900` |
| セクション見出し | 16px | 24px | `text-base leading-6 font-semibold text-slate-900`                  |
| パネル見出し   | 15px | 22px | `text-[15px] leading-[22px] font-semibold text-slate-900`           |
| 通常本文     | 14px | 20px | `text-sm leading-5 font-normal text-slate-700`                      |
| 説明文      | 13px | 18px | `text-[13px] leading-[18px] text-slate-500`                         |
| ラベル      | 12px | 16px | `text-xs leading-4 font-medium text-slate-500`                      |
| テーブル本文   | 13px | 18px | `text-[13px] leading-[18px] text-slate-700`                         |
| バッジ      | 12px | 16px | `text-xs leading-4 font-medium`                                     |

### 使用制限

* `text-3xl` は基本的に使わない
* `text-2xl` はダッシュボードの重要数値などに限定
* 通常本文に `text-base leading-relaxed` は使わない
* 業務アプリの本文で `leading-relaxed` は原則使わない
* 長文説明が必要な場合のみ `leading-6` を許可する

### 推奨する見出し例

```html
<h1 class="text-[22px] leading-7 font-semibold tracking-tight text-slate-900">
  案件一覧
</h1>

<h2 class="text-base leading-6 font-semibold text-slate-900">
  検索条件
</h2>

<p class="text-[13px] leading-[18px] text-slate-500">
  条件を指定して対象データを絞り込みます。
</p>
```

## 4. 余白・間隔

8pxグリッドを基本にする。
ただし、PC業務アプリでは余白を広げすぎない。

### 余白ルール

| 用途          |       推奨値 | Tailwind例           |
| ----------- | --------: | ------------------- |
| 画面全体の余白     |      24px | `p-6`               |
| パネル間の余白     |      16px | `gap-4`             |
| パネル内余白      |      16px | `p-4`               |
| 密度の高いパネル内余白 |      12px | `p-3`               |
| フォーム項目間     | 12px〜16px | `gap-3` / `gap-4`   |
| ラベルと入力欄     |   4px〜6px | `gap-1` / `gap-1.5` |
| ボタン間        |       8px | `gap-2`             |
| セクション間      |      24px | `mb-6`              |

### 使用制限

* `p-8` は大きなダッシュボードカード以外では使わない
* `mb-12` は業務アプリでは原則使わない
* `gap-8` 以上は多用しない
* 余白で高級感を出すより、罫線・見出し・グルーピングで整理する

## 5. パネル・カード

業務アプリでは、カードは装飾ではなく情報のまとまりとして使う。
過剰な角丸や強い影は使わない。

### 標準パネル

```html
<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-base leading-6 font-semibold text-slate-900">
      検索条件
    </h2>
  </div>
</section>
```

### パネルルール

| 用途      | 推奨クラス                                                        |
| ------- | ------------------------------------------------------------ |
| 標準パネル   | `rounded-xl border border-slate-200 bg-white p-4 shadow-sm`  |
| 密度高めパネル | `rounded-lg border border-slate-200 bg-white p-3`            |
| 重要パネル   | `rounded-xl border border-brand/20 bg-white p-4 shadow-sm`   |
| モーダル    | `rounded-2xl border border-slate-200 bg-white p-6 shadow-xl` |

### 使用制限

* `rounded-3xl` は原則使わない
* `shadow-xl` はモーダルなど最前面UIに限定
* 通常カードに濃い影を使わない
* カードの中にカードを何重にも入れない

## 6. フォーム

入力欄は業務アプリの中心要素なので、可読性と情報密度を両立する。

### 入力欄

```html
<input
  class="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
/>
```

### ラベル

```html
<label class="text-xs leading-4 font-medium text-slate-500">
  顧客名
</label>
```

### フォームサイズ

| 要素      |         高さ | Tailwind例               |
| ------- | ---------: | ----------------------- |
| 標準入力欄   |       36px | `h-9`                   |
| 小さめ入力欄  |       32px | `h-8`                   |
| 標準ボタン   |       36px | `h-9`                   |
| 小さめボタン  |       32px | `h-8`                   |
| テキストエリア | 80px〜120px | `min-h-20` / `min-h-24` |

### フォームレイアウト

* 検索条件は2列〜4列で配置する
* ラベルは入力欄の上に置く
* 横並びにしすぎて読みにくくしない
* 主要操作ボタンは右下または右上にまとめる

## 7. ボタン

ボタンは役割ごとに見た目を固定する。
LLMが毎回違う装飾を作らないよう、種類を限定する。

### Primary Button

```html
<button class="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/30">
  登録
</button>
```

### Secondary Button

```html
<button class="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
  キャンセル
</button>
```

### Ghost Button

```html
<button class="h-9 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
  詳細
</button>
```

### ボタンルール

* 主要ボタンは1画面に1〜2個まで
* 危険操作は赤系にする
* ボタンの高さは基本 `h-9`
* 大きな `py-4` ボタンは使わない
* ボタンに過剰な影をつけない

## 8. テーブル

業務アプリではテーブルの情報密度を重視する。
ただし詰め込みすぎて読めない状態にはしない。

### テーブル基本

```html
<table class="w-full text-left text-[13px] leading-[18px]">
  <thead class="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
    <tr>
      <th class="h-9 px-3">案件名</th>
      <th class="h-9 px-3">顧客名</th>
      <th class="h-9 px-3">ステータス</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-slate-200 bg-white text-slate-700">
    <tr class="hover:bg-slate-50">
      <td class="h-10 px-3">業務アプリ刷新</td>
      <td class="h-10 px-3">株式会社サンプル</td>
      <td class="h-10 px-3">進行中</td>
    </tr>
  </tbody>
</table>
```

### テーブルサイズ

| 要素     |   推奨 |
| ------ | ---: |
| ヘッダー行高 | 36px |
| 通常行高   | 40px |
| 高密度行高  | 36px |
| セル左右余白 | 12px |
| テーブル文字 | 13px |

### 使用制限

* テーブル本文に `text-base` は使わない
* 行高を48px以上にしない
* セル内に大きなボタンを入れない
* 罫線を濃くしすぎない

## 9. バッジ・ステータス

ステータスは小さく、読みやすく、色数を限定する。

```html
<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
  完了
</span>
```

### ステータス例

| 状態  | クラス例                                                |
| --- | --------------------------------------------------- |
| 完了  | `border-emerald-200 bg-emerald-50 text-emerald-700` |
| 進行中 | `border-sky-200 bg-sky-50 text-sky-700`             |
| 保留  | `border-amber-200 bg-amber-50 text-amber-700`       |
| エラー | `border-red-200 bg-red-50 text-red-700`             |
| 未対応 | `border-slate-200 bg-slate-100 text-slate-600`      |

## 10. アイコン

アイコンは補助情報として使う。
装飾目的で多用しない。

### ルール

* サイズは基本 `16px`
* メニューやボタン内は `w-4 h-4`
* 大きな空状態のみ `w-8 h-8` まで許可
* アイコン単体で意味を伝えず、必ずテキストを併用する
* 色は `text-slate-400` または `text-slate-500` を基本にする

## 11. 角丸

業務アプリでは角丸を控えめにする。

| 用途    | 推奨             |
| ----- | -------------- |
| 入力欄   | `rounded-md`   |
| ボタン   | `rounded-md`   |
| 小バッジ  | `rounded-full` |
| 標準パネル | `rounded-xl`   |
| モーダル  | `rounded-2xl`  |

### 使用制限

* `rounded-3xl` は使わない
* フォームやテーブルに大きすぎる角丸を使わない
* すべてを丸くしすぎない

## 12. 影・奥行き

業務アプリでは、影よりも境界線で構造を示す。

| 用途           | 推奨          |
| ------------ | ----------- |
| 標準パネル        | `shadow-sm` |
| ドロップダウン      | `shadow-lg` |
| モーダル         | `shadow-xl` |
| 通常のテーブル・フォーム | 影なし         |

### 使用制限

* 通常カードに `shadow-lg` 以上を使わない
* 複数の影を重ねない
* 浮遊感の強いUIにしない

## 13. LLM生成時の制約

LLMにUIを生成させる場合、以下を必ず守る。

### 使用してよい基本サイズ

```txt
画面タイトル: text-[22px] leading-7
セクション見出し: text-base leading-6
本文: text-sm leading-5
説明文: text-[13px] leading-[18px]
ラベル: text-xs leading-4
テーブル: text-[13px] leading-[18px]
```

### 使用してよい基本余白

```txt
画面余白: p-6
パネル余白: p-4
高密度パネル余白: p-3
パネル間: gap-4
フォーム項目間: gap-3 または gap-4
ボタン間: gap-2
```

### 使用してよい角丸

```txt
入力欄・ボタン: rounded-md
小カード: rounded-lg
標準パネル: rounded-xl
モーダル: rounded-2xl
```

### 原則禁止

```txt
text-3xl 以上
leading-relaxed
p-10 以上
gap-8 以上
rounded-3xl
shadow-xl の多用
中央寄せLP風レイアウト
巨大なカード
余白だけで高級感を出す画面
```

## 14. 推奨画面密度

1920×1080のPC画面では、1画面内に以下の情報量を収めることを目安とする。

* 検索条件：6〜12項目
* 一覧テーブル：15〜20行程度
* 主要KPIカード：4〜6個
* サイドバー項目：8〜15項目
* 右ペイン詳細情報：8〜12項目

業務アプリでは、スクロールしなくても主要情報が把握できる密度を優先する。
