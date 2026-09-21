#!/usr/bin/env node
// 公開する前の点検。「サイトでは壊れているのに気づかなかった」を無くすためのもの。
//
//   npm run check
//
// 「だめ」が1件でもあれば、公開（npm run deploy）は止まる。
// 「注意」は止めないが、目を通してほしいもの。

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';
import { CONTENT_DIR, walk, frontmatter, noteIndex, imageIndex, stripTodo } from '../src/lib/obsidian.mjs';
import { site, menu } from '../src/lib/site.mjs';

const bad = [], warn = [], info = [];
const rel = (f) => relative(process.cwd(), f);

// ---------- サイトの設定 ----------
if (!existsSync(join(CONTENT_DIR, 'site.md'))) bad.push('content/site.md がありません');
const s = site();
if (s.name === 'サイト名が未設定です') bad.push('content/site.md に name:（サイト名）を書いてください');
if (!s.url) warn.push('content/site.md に url: がありません（検索エンジン向けのページ一覧と、SNSで共有したときの表示が正しく出ません）');
else if (/example\.com/.test(s.url)) warn.push('content/site.md の url: が見本（example.com）のままです');
if (!s.project) warn.push('content/site.md に project: がありません（公開するときの名前。英小文字・数字・ハイフン）');
else if (!/^[a-z0-9][a-z0-9-]{0,56}[a-z0-9]$/.test(String(s.project))) bad.push(`project: 「${s.project}」は使えません（英小文字・数字・ハイフンのみ、58文字まで）`);

// ---------- ページ ----------
const pagesDir = join(CONTENT_DIR, 'pages');
const pageFiles = walk(pagesDir).filter((f) => extname(f) === '.md');
const hasIndex = pageFiles.some((f) => {
  const { data } = frontmatter(readFileSync(f, 'utf8'));
  return String(data.slug || basename(f, '.md')) === 'index';
});
if (!hasIndex) bad.push('トップページがありません（content/pages/ に index.md を置くか、どれか1枚に slug: index と書く）');

// 同じ URL になるノートが2つあると、片方が黙って消える
const seen = new Map();
for (const f of pageFiles) {
  const { data } = frontmatter(readFileSync(f, 'utf8'));
  const slug = String(data.slug || basename(f, '.md'));
  if (seen.has(slug)) bad.push(`URL が重なっています: ${rel(f)} と ${rel(seen.get(slug))}（どちらも /${slug}/）`);
  seen.set(slug, f);
  if (/[^\x00-\x7F]/.test(slug)) warn.push(`${rel(f)}: URL が日本語になります（/${slug}/）。先頭に slug: 英数字 を書くと短くできます`);
}

// ---------- メニュー ----------
const { main, footer } = menu();
if (!main.length) warn.push('content/menu.md の「上のメニュー」が空です（上の帯に何も出ません）');

// ---------- ブログ ----------
const posts = walk(join(CONTENT_DIR, 'blog')).filter((f) => extname(f) === '.md');
const live = [], draft = [];
for (const f of posts) {
  const { data } = frontmatter(readFileSync(f, 'utf8'));
  (data.publish === true ? live : draft).push(f);
  if (data.publish === true && !data.date && !/^\d{4}-\d{2}-\d{2}/.test(basename(f))) {
    warn.push(`${rel(f)}: 日付がありません（date: 2026-10-01 と書くか、ファイル名を 2026-10-01-… で始める）`);
  }
}
info.push(`ブログ: 公開 ${live.length} 件 ／ 下書き ${draft.length} 件`);
for (const f of draft) info.push(`  下書き（サイトには出ません）: ${rel(f)}`);

// ---------- リンクと画像 ----------
const notes = noteIndex(), images = imageIndex();
const allMd = walk(CONTENT_DIR).filter((f) => extname(f) === '.md');
for (const f of allMd) {
  const { body } = frontmatter(readFileSync(f, 'utf8'));
  const text = stripTodo(body).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');   // コードの中は見ない
  for (const m of text.matchAll(/(!?)\[\[([^\[\]\n]+?)\]\]/g)) {
    // 表の中では [[ノート名\|表示名]] と書くので、名前の末尾の \ を外す
    const [target, label] = m[2].split('|').map((x, i) => (i === 0 ? x.replace(/\\+$/, '') : x).trim());
    if (m[1] === '!') {
      if (!images.has(basename(target))) bad.push(`${rel(f)}: 画像「${basename(target)}」が content/images/ にありません`);
      else if (!label) warn.push(`${rel(f)}: 画像「${basename(target)}」に説明がありません（![[${basename(target)}|何の画像か]] と書くと、読み上げと検索に効きます）`);
    } else if (!notes.has(basename(target.split('#')[0].replace(/\.md$/, '')))) {
      bad.push(`${rel(f)}: リンク先のノート「${target}」が見つかりません`);
    }
  }
}
// 画像が images/ の外に落ちていないか（Obsidian の設定が変わると、貼った画像が別の場所に入る）
for (const f of walk(CONTENT_DIR)) {
  if (!/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(f)) continue;
  if (!f.startsWith(join(CONTENT_DIR, 'images'))) bad.push(`${rel(f)}: 画像は content/images/ の下に置いてください（ここにあるとサイトに出ません）`);
  else if (statSync(f).size > 1_500_000) warn.push(`${rel(f)}: ${(statSync(f).size / 1e6).toFixed(1)}MB あります。表示が遅くなるので、小さくするのをおすすめします`);
}

// ---------- 見本が残っていないか ----------
// ひな形には「Jagカレーショップ」という見本の店が入っている。自分の店の名前に変えたのに、
// 本文のどこかに見本の名前が残っていると、公開してから気づくことになる。
const SAMPLE = 'Jagカレーショップ';
if (s.name !== SAMPLE) {
  for (const f of allMd) {
    if (stripTodo(readFileSync(f, 'utf8')).includes(SAMPLE)) warn.push(`${rel(f)}: 見本の店名「${SAMPLE}」が残っています`);
  }
}
if (/000円|0,000円|○○|03-0000-0000|example\.com/.test(allMd.map((f) => stripTodo(readFileSync(f, 'utf8'))).join('\n')) && s.published) {
  bad.push('見本のままの値（000円・○○・03-0000-0000・example.com など）が残ったまま、本番（published: true）になっています');
}

// メニューに出ていないページ。間違いではないが、持ち主が気づいていないことが多い
const inMenu = new Set([...main, ...footer].flatMap((i) => [i.url, ...i.children.map((c) => c.url)]));
for (const f of pageFiles) {
  const { data } = frontmatter(readFileSync(f, 'utf8'));
  if (data.publish === false) continue;
  const slug = String(data.slug || basename(f, '.md'));
  const url = slug === 'index' ? '/' : `/${slug}/`;
  if (!inMenu.has(url)) info.push(`メニューに無いページ: ${rel(f)}（${url} を知っていれば開けます。出したくなければノートを消すか publish: false）`);
}

// ---------- 結果 ----------
const line = (mark, list) => list.forEach((m) => console.log(`  ${mark}  ${m}`));
console.log(`\n${s.name}（${s.published ? '公開中' : '準備中・検索には載りません'}）\n`);
line('だめ', bad); line('注意', warn); line('　　', info);
console.log(bad.length ? `\n直すところが ${bad.length} 件あります。\n` : `\n点検を通りました。\n`);
process.exit(bad.length ? 1 : 0);
