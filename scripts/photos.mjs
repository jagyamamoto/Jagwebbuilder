#!/usr/bin/env node
// 素材/ に入れた写真を、サイトで使える形にして content/images/ に入れる。
//
//   npm run photos
//
// やること:
//   - 長いほうの辺を 1600px までに小さくする（スマホの写真はそのままだと大きすぎて、表示が遅くなる）
//   - 写真は JPEG に、ロゴは PNG のままにする（ロゴは背景が透けていることが多いため）
//   - 写真に埋め込まれた情報（位置情報・撮影した機種など）を消す
//   - iPhone の HEIC は、ブラウザで表示できないので JPEG に直す
//
// 元のファイルは消さない。同じ名前のものが content/images/ にあって、元より新しければ何もしない。

import { readdirSync, existsSync, statSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = join(ROOT, 'content', 'images');
const MAX = 1600;
const SOURCES = [
  { dir: join(ROOT, '素材', '写真'), keepPng: false },
  { dir: join(ROOT, '素材', 'ロゴ'), keepPng: true },
];
const READABLE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.avif', '.heic', '.heif']);

mkdirSync(OUT, { recursive: true });
const done = [], skipped = [], failed = [];

for (const { dir, keepPng } of SOURCES) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const src = join(dir, name);
    if (!statSync(src).isFile()) continue;
    const ext = extname(name).toLowerCase();

    // SVG は拡大しても荒れない絵なので、そのまま写す
    if (ext === '.svg') { await copyIfNewer(src, join(OUT, name)); continue; }
    if (!READABLE.has(ext)) { skipped.push(`${name}（写真として読めない種類です）`); continue; }

    const asPng = keepPng && ext === '.png';
    const dest = join(OUT, basename(name, extname(name)) + (asPng ? '.png' : '.jpg'));
    if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) { skipped.push(`${name}（すでに入っています）`); continue; }

    try {
      await convert(src, dest, asPng);
      done.push({ name, dest, before: statSync(src).size, after: statSync(dest).size });
    } catch (e) {
      // iPhone の HEIC は、読む部品が入っていない環境がある。Mac なら OS の機能で JPEG に直してから読む
      if ((ext === '.heic' || ext === '.heif') && process.platform === 'darwin') {
        const tmp = mkdtempSync(join(tmpdir(), 'jwb-'));
        const jpg = join(tmp, 'a.jpg');
        const r = spawnSync('sips', ['-s', 'format', 'jpeg', src, '--out', jpg], { encoding: 'utf8' });
        try {
          if (r.status !== 0) throw new Error(r.stderr || 'sips で変換できませんでした');
          await convert(jpg, dest, false);
          done.push({ name, dest, before: statSync(src).size, after: statSync(dest).size });
        } catch (e2) { failed.push(`${name}: ${String(e2.message || e2).slice(0, 120)}`); }
        rmSync(tmp, { recursive: true, force: true });
      } else if (ext === '.heic' || ext === '.heif') {
        failed.push(`${name}: iPhone の形式（HEIC）を、このパソコンでは読めませんでした。` +
          `iPhone の「設定 → カメラ → フォーマット → 互換性優先」にして撮り直すか、写真をメールやLINEで送り直すと JPEG になります`);
      } else failed.push(`${name}: ${String(e.message || e).slice(0, 120)}`);
    }
  }
}

async function convert(src, dest, asPng) {
  // rotate() は、スマホを縦にして撮った写真の向きを正しく直す。
  // 書き出すときに withMetadata() を付けていないので、位置情報などの埋め込み情報は残らない。
  const img = sharp(src, { failOn: 'none' }).rotate().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true });
  if (asPng) await img.png({ compressionLevel: 9 }).toFile(dest);
  else await img.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
}

async function copyIfNewer(src, dest) {
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) { skipped.push(`${basename(src)}（すでに入っています）`); return; }
  const { copyFileSync } = await import('node:fs');
  copyFileSync(src, dest);
  done.push({ name: basename(src), dest, before: statSync(src).size, after: statSync(dest).size });
}

const mb = (n) => (n / 1e6).toFixed(1) + 'MB';
console.log('');
for (const d of done) console.log(`  入れました  ${d.name}  →  content/images/${basename(d.dest)}（${mb(d.before)} → ${mb(d.after)}）`);
for (const s of skipped) console.log(`  そのまま    ${s}`);
for (const f of failed) console.log(`  できません  ${f}`);
if (!done.length && !skipped.length && !failed.length) console.log('  素材/写真/ と 素材/ロゴ/ に、まだ何も入っていません。');
if (done.length) {
  console.log(`\n${done.length} 枚を content/images/ に入れました。位置情報などの埋め込み情報は消してあります。`);
  console.log('本文に入れるときは、Obsidian で  ![[ファイル名.jpg|何の写真か]]  と書きます。');
}
console.log('');
process.exit(failed.length ? 1 : 0);
