# CLAUDE.md

このリポジトリの作業ルールは **[`AGENTS.md`](AGENTS.md)** にまとめてあります。先に必ず読んでください。

要点だけ再掲します。

- **言葉は `content/` にだけ書く。`src/` には一文字も書かない。**
- あなたが書いたブログ記事は **`publish: false`** で置く。出すかどうかは持ち主が決める。
- 人の手が要るのは、Cloudflare のアカウント作成と `npx wrangler login` の承認だけ。
- Astro 7 の Markdown 処理系は Sätteri。`remarkPlugins` は使わない。
- 終わりに `npm run check` と `npm run build` を通す。
