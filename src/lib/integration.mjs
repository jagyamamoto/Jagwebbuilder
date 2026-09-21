// content/images/ の画像を、サイトの /images/ として出すための Astro 連携。
//
// 画像を public/ に置かせない理由: 原稿と画像が別の場所に分かれると、
// Obsidian で「貼り付けた画像が見える」状態と、サイトで「出る」状態がずれる。
// content/ の中で完結していれば、Obsidian で見えているものがそのままサイトに出る。

import { createReadStream, existsSync, statSync, cpSync, watch } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { CONTENT_DIR } from './obsidian.mjs';

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
};

export default function obsidianContent() {
  const imagesDir = join(CONTENT_DIR, 'images');
  return {
    name: 'obsidian-content',
    hooks: {
      // 開発中: /images/... へのアクセスを content/images/ から直接返す
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/images', (req, res, next) => {
          const rel = normalize(decodeURIComponent((req.url || '').split('?')[0])).replace(/^([/\\])+/, '');
          const file = join(imagesDir, rel);
          // content/images/ の外を読ませない
          if (!file.startsWith(imagesDir) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('content-type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
          createReadStream(file).pipe(res);
        });
        // site.md や menu.md はプログラムから直接読んでいるので、Astro は変更に気づかない。
        // Obsidian で保存したら画面が変わる、を保つために、こちらで見張って再読み込みさせる。
        try {
          watch(CONTENT_DIR, { recursive: true }, (_e, name) => {
            if (name && !String(name).startsWith('.obsidian')) server.ws.send({ type: 'full-reload' });
          });
        } catch { /* 見張れない環境でも、手で再読み込みすれば済む */ }
      },
      // 公開用の書き出し: dist/images/ にまるごと写す
      'astro:build:done': ({ dir }) => {
        if (!existsSync(imagesDir)) return;
        cpSync(imagesDir, join(dir.pathname, 'images'), { recursive: true });
      },
    },
  };
}
