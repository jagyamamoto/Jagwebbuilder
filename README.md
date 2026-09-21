# obsidian-web-kit

**Obsidian で書いたノートが、そのままホームページになります。**

メニューも、各ページの文章も、ブログも、Obsidian のノートです。
直したくなったら Obsidian で書き換えるだけ。管理画面はありません。

```
content/            ← このフォルダを Obsidian で開く
├── site.md           サイト名・連絡先・色
├── menu.md           メニューの並び（リンクを箇条書きにするだけ）
├── pages/            1ノート = 1ページ
│   ├── index.md
│   ├── サービス.md
│   └── 会社概要.md
├── blog/             ブログ
└── images/           画像（Obsidian に貼れば、ここに入ります）
```

Astro で書き出し、Cloudflare Pages で公開します。**月額の費用はかかりません**（独自ドメイン代を除く）。

## AIに作ってもらう

Claude Code か Codex をお使いなら、こう頼むだけです。

> このリポジトリを使って、うちのホームページを作ってください。
> https://github.com/＜公開後のURL＞

AIが [`AGENTS.md`](AGENTS.md) を読み、屋号や載せたい内容を聞きながら、公開まで進めます。

**ご自身の手が要るのは2か所だけ**です。

1. Cloudflare のアカウントを作る（無料）
2. `npx wrangler login` を実行して、開いたブラウザで「Allow」を押す

## 自分で動かす

```bash
npm install
npm run dev       # 手元で見る → http://localhost:4321
npm run check     # 公開前の点検
npm run deploy    # 公開する
```

必要なもの: [Node.js](https://nodejs.org) 20 以上、[Obsidian](https://obsidian.md)（無料）。

## Obsidian の書き方が、そのまま通ります

| Obsidian での書き方 | サイトでは |
|---|---|
| `[[会社概要]]` | そのページへのリンク |
| `[[サービス\|くわしくはこちら]]` | 表示する文字を変えたリンク |
| `![[写真.jpg\|お店の外観]]` | 画像（`\|` のあとは画像の説明） |
| `![[写真.jpg\|300]]` | 幅 300 の画像 |

ファイル名は日本語で構いません。ノートの先頭に `slug: about` と書けば、URL は `/about/` になります。

## 書きかけは公開されません

ブログは、先頭に **`publish: true` と書いた記事だけ**がサイトに出ます。
書きかけのノートが、知らないうちに公開されることはありません。
`npm run check` を実行すると、**どれが下書きのままか**を一覧で確かめられます。

## 準備中は検索に載りません

`content/site.md` の `published:` が `false` のあいだは、検索エンジンに載らない設定で公開されます。
知り合いに見てもらって、直してから、`true` に変えてください。

## できないこと

- お問い合わせフォーム（いまはメールアドレスと電話番号の掲載のみ）
- ネットショップ・会員ページ
- Obsidian の Dataview やプラグイン独自の書き方

## くわしい説明

- [`docs/ja/つまずきと対処.md`](docs/ja/つまずきと対処.md) — 実際に詰まったところと、その直し方
- [`AGENTS.md`](AGENTS.md) — AI に読ませる手引き

## ライセンス

[MIT](LICENSE)
