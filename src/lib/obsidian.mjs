// Obsidian の書き方を、そのまま Web ページにするための部品。
//
// Obsidian には、ふつうの Markdown に無い書き方が2つある。
//     [[ノート名]]  [[ノート名|表示する文字]]      ← ノートへのリンク
//     ![[画像.png]] ![[画像.png|説明]] ![[画像.png|300]]  ← 画像の埋め込み
// これを直さずに Astro に渡すと、記号がそのまま画面に出る。
// 「Obsidian ではちゃんと見えているのに、サイトでは壊れている」になるので、ここで吸収する。
//
// 足している部品は Astro 自身が使っているもの（Sätteri）だけ。依存が1つ減るたびに、
// 「ある日 npm install したら動かなくなった」が1つ減るため。

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin } from 'satteri';

export const CONTENT_DIR = join(process.cwd(), 'content');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

// ---------- ノートの索引 ----------
// [[ノート名]] を URL に直すには、「その名前のノートがどの URL になるか」を知っている必要がある。
// Obsidian は既定でフォルダを付けずに名前だけで書く（[[会社概要]]）ので、名前から引けるようにする。

export function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;          // .obsidian など
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 先頭の --- で囲まれた部分から、「キー: 値」の1行ものだけを読む。
// ここで要るのは slug と title と publish くらいなので、YAML の全機能は要らない。
export function frontmatter(text) {
  const src = text.replace(/^\uFEFF/, '');       // Windows のメモ帳が付ける BOM を外す
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  if (!m) return { data, body: src };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return { data, body: src.slice(m[0].length) };
}

// > [!todo] のメモを取りのぞいた本文を返す。
// メモは「Obsidian では見えるが、サイトには出さない」自分用の書き込み。
// 本文を Markdown として処理する所では Sätteri の側で消しているが、
// site.md や menu.md のようにプログラムから直接読む所では、ここで消す。
export function stripTodo(body) {
  const out = []; let skipping = false;
  for (const line of String(body).split(/\r?\n/)) {
    if (/^\s*>\s*\[!todo\]/i.test(line)) { skipping = true; continue; }
    if (skipping && /^\s*>/.test(line)) continue;
    skipping = false; out.push(line);
  }
  return out.join('\n');
}

// ファイル名（拡張子なし）→ URL の対応表をつくる。
export function noteIndex() {
  const index = new Map();
  const add = (key, url) => { if (!index.has(key)) index.set(key, url); };

  for (const file of walk(join(CONTENT_DIR, 'pages'))) {
    if (extname(file) !== '.md') continue;
    const name = basename(file, '.md');
    const { data } = frontmatter(readFileSync(file, 'utf8'));
    const slug = String(data.slug || name);
    const url = slug === 'index' ? '/' : `/${slug}/`;
    add(name, url); add(slug, url);
    if (data.title) add(String(data.title), url);
  }
  for (const file of walk(join(CONTENT_DIR, 'blog'))) {
    if (extname(file) !== '.md') continue;
    const name = basename(file, '.md');
    const { data } = frontmatter(readFileSync(file, 'utf8'));
    const slug = String(data.slug || name);
    const url = `/blog/${slug}/`;
    add(name, url); add(slug, url);
    if (data.title) add(String(data.title), url);
  }
  add('blog', '/blog/'); add('ブログ', '/blog/');
  return index;
}

// 画像のファイル名 → URL。画像は content/images/ の下に置く決まり。
export function imageIndex() {
  const index = new Map();
  const root = join(CONTENT_DIR, 'images');
  for (const file of walk(root)) {
    if (!IMAGE_EXT.has(extname(file).toLowerCase())) continue;
    const rel = relative(root, file).split(sep).map(encodeURIComponent).join('/');
    index.set(basename(file), `/images/${rel}`);
  }
  return index;
}

// ---------- 本文の変換 ----------
//
// Astro 7 からは、Markdown を処理する部品が Sätteri に変わった（それまでは remark）。
// Sätteri には Obsidian の [[ ]] を読む機能が最初から入っているので、読むところは任せて、
// こちらは「読めた名前を、サイト上の正しい場所に直す」ことだけをする。
//
//     [[会社概要]]          → Sätteri が url="会社概要" のリンクにする → ここで "/about/" に直す
//     ![[写真.png|説明]]    → Sätteri が url="写真.png" の画像にする   → ここで "/images/写真.png" に直す
//
// ⚠ AI に直させるときの注意: 古い知識で書くと astro.config に remarkPlugins を足そうとする。
//    Astro 7 では動かない（@astrojs/markdown-remark が別途要る）。このファイルの形を保つこと。

const isOutside = (url) => /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);   // https: mailto: tel: /絶対パス #ページ内

export function obsidianLinks() {
  // 1ファイルごとに作り直すと遅くなるので、少しのあいだ使い回す。
  // 開発中に Obsidian でノートを足したときも、1秒たてば新しい一覧になる。
  let cache = null, at = 0;
  const indexes = () => {
    if (!cache || Date.now() - at > 1000) { cache = { notes: noteIndex(), images: imageIndex() }; at = Date.now(); }
    return cache;
  };
  const where = (ctx) => { try { return relative(process.cwd(), fileURLToPath(ctx.fileURL)); } catch { return ''; } };

  // > [!todo] のメモはサイトに出さないので、その中のリンクや画像は直さなくてよい。
  // （メモの中では [[menu]] のように、Obsidian の中だけで通じるリンクを使っている）
  const isTodo = (n) => {
    const head = n?.type === 'blockquote' && n.children?.[0]?.type === 'paragraph' ? n.children[0].children?.[0] : null;
    return head?.type === 'text' && /^\[!todo\]/i.test(head.value);
  };
  const inTodo = (node, ctx) => {
    for (let p = ctx.parent(node), i = 0; p && i < 12; p = ctx.parent(p), i++) if (isTodo(p)) return true;
    return false;
  };

  return defineMdastPlugin({
    name: 'obsidian-links',

    link(node, ctx) {
      if (!node.url || isOutside(node.url) || inTodo(node, ctx)) return;
      let raw = node.url;
      try { raw = decodeURIComponent(raw); } catch { /* そのまま使う */ }
      const [name, heading] = raw.replace(/\.md$/, '').split('#');
      const url = indexes().notes.get(basename(name.trim()));
      if (!url) {
        console.warn(`  ⚠ ${where(ctx)}: リンク先のノート「${name.trim()}」が見つかりません`);
        return;
      }
      const hash = heading ? '#' + encodeURIComponent(heading.trim().toLowerCase().replace(/\s+/g, '-')) : '';
      ctx.replaceNode(node, { ...node, url: url + hash });
    },

    // Obsidian のコールアウト（> [!note] 見出し）。
    //   > [!todo] … は「自分用のメモ」。Obsidian では見えるが、サイトには出さない。
    //              ひな形のノートに「ここに何を書くか」を残しておくために使っている。
    //   それ以外   … 色のついた囲みにする。
    blockquote(node, ctx) {
      const first = node.children?.[0];
      const head = first?.type === 'paragraph' ? first.children?.[0] : null;
      if (!head || head.type !== 'text') return;
      const m = head.value.match(/^\[!([A-Za-z]+)\][+-]?[ \t]*([^\n]*)\n?/);
      if (!m) return;
      const kind = m[1].toLowerCase();
      if (kind === 'todo') { ctx.removeNode(node); return; }

      const rest = head.value.slice(m[0].length);
      const firstKids = [...(rest ? [{ type: 'text', value: rest }] : []), ...first.children.slice(1)];
      const children = [
        ...(m[2].trim() ? [{ type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: m[2].trim() }] }] }] : []),
        ...(firstKids.length ? [{ type: 'paragraph', children: firstKids }] : []),
        ...node.children.slice(1),
      ];
      ctx.replaceNode(node, { type: 'blockquote', children, data: { hProperties: { class: `callout callout-${kind}` } } });
    },

    image(node, ctx) {
      if (!node.url || isOutside(node.url) || inTodo(node, ctx)) return;
      let raw = node.url;
      try { raw = decodeURIComponent(raw); } catch { /* そのまま使う */ }
      const url = indexes().images.get(basename(raw));
      if (!url) {
        console.warn(`  ⚠ ${where(ctx)}: 画像「${basename(raw)}」が content/images/ に見つかりません`);
        return;
      }
      // ![[写真.png|300]] は幅の指定、![[写真.png|説明]] は代替テキスト
      const label = String(node.alt || '');
      const width = /^\d+$/.test(label) ? Number(label) : null;
      ctx.replaceNode(node, {
        type: 'image', url, title: node.title ?? null, alt: width ? '' : label,
        data: { hProperties: { loading: 'lazy', decoding: 'async', ...(width ? { width } : {}) } },
      });
    },
  });
}
