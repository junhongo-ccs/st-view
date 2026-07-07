デザインルールを策定しました。

Tailwind CSSのユーティリティクラスを最大限に活用し、設定ファイル（tailwind.config.js）で独自のブランドカラーを拡張する前提で構成しています。

1. カラーシステム（Color System）
コンテンツを邪魔せず、信頼感と洗練された印象を与えるパレットです。視覚的なノイズを減らすため、彩度を抑えたスレート（青みがかったグレー）を基調とします。

ブランドカラー（Primary）: 信頼感のあるディープブルー（例: #004386）を brand として定義。

Tailwind拡張: bg-brand, text-brand

テキストカラー: 真っ黒（#000000）はコントラストが強すぎるため避けます。

見出し・本文（高階層）: text-slate-900

副題・補足（低階層）: text-slate-500

背景色: 階層（Depth）を表現するために使い分けます。

最背面（アプリ背景）: bg-slate-50

前面（カード・コンテンツ）: bg-white

2. タイポグラフィ（Typography）
システムフォント（San Franciscoやヒラギノ）の美しさを活かし、ウェイト（太さ）と文字サイズで明確な情報階層を作ります。

フォントファミリー: font-sans（OS標準のサンセリフ体）

見出し（Headers）: トラッキング（字送り）を少し詰め、ソリッドな印象に。

H1クラス: text-3xl font-bold tracking-tight text-slate-900

H2クラス: text-xl font-semibold tracking-tight text-slate-900

本文（Body）: 可読性を重視し、十分な行間を確保します。

標準テキスト: text-base font-normal leading-relaxed text-slate-700

注釈・ラベル: text-sm font-medium text-slate-500

3. 余白・間隔（Spacing）
8ptグリッドシステムを採用し、要素間の関係性を視覚的に定義します。Appleデザインの特徴である「ゆったりとした呼吸感のある余白」を意識します。

コンポーネント内部の余白（Padding）:

標準的なくくり: p-4 (16px) または p-6 (24px)

要素間の余白（Margin / Gap）:

密接な要素（アイコンとテキスト等）: gap-2 (8px)

関連する要素（リストアイテム等）: gap-4 (16px)

独立したセクション間: mb-8 (32px) または mb-12 (48px)

4. 角丸（Border Radius）
Appleデバイスのハードウェアと調和する、滑らかなカーブ（連続的な角丸）をUIにも適用します。

小さなUI要素（チェックボックス・バッジ）: rounded-md (6px)

標準的なボタン・入力フォーム: rounded-lg (8px) または rounded-full (完全な丸形)

カード・モーダルウィンドウ: rounded-2xl (16px) または rounded-3xl (24px)

5. 影の効果（Shadows & Elevation）
Z軸（奥行き）を表現し、ユーザーが「今どのレイヤーを操作しているか」を直感的に理解できるように