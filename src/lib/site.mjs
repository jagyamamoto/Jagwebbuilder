// サイト全体の設定（content/site.md）とメニュー（content/menu.md）を読む。
//
// どちらも Obsidian で開いて書き換えるだけで変えられるようにしてある。
// 値をこのファイルの中に持たせないこと。持たせた瞬間に
// 「Obsidian を直したのにサイトが変わらない」が起きる。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR, frontmatter, noteIndex } from './obsidian.mjs';

const DEFAULTS = {
  name: 'サイト名が未設定です',
  description: '',
  url: '',
  email: '',
  tel: '',
  address: '',
  color: '#1f5f8b',
  published: false,
  lang: 'ja',
};

export function site() {
  const file = join(CONTENT_DIR, 'site.md');
  if (!existsSync(file)) return { ...DEFAULTS, footer: '', accentInk: '#ffffff' };
  const { data, body } = frontmatter(readFileSync(file, 'utf8'));
  const s = { ...DEFAULTS, ...data };
  s.url = String(s.url || '').replace(/\/+$/, '');
  s.published = s.published === true;
  s.footer = body.trim();
  s.color = /^#[0-9a-fA-F]{6}$/.test(String(s.color)) ? String(s.color) : DEFAULTS.color;
  // 色は持ち主が自由に決めるので、その上に載せる文字を白にするか黒にするかはこちらで選ぶ。
  // 薄い黄色に白文字、のような読めない組み合わせを作らせないため。
  s.accentInk = luminance(s.color) > 0.45 ? '#111111' : '#ffffff';
  return s;
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// menu.md は、リンクを箇条書きで並べただけのノート。
//     - [[index|ホーム]]
//     - [[会社概要]]
//     - [[blog|ブログ]]
//     - [お問い合わせ](https://example.com/form)
// 並び順＝メニューの並び順。上から書いた順に出る。
export function menu() {
  const file = join(CONTENT_DIR, 'menu.md');
  if (!existsSync(file)) return [];
  const notes = noteIndex();
  const { body } = frontmatter(readFileSync(file, 'utf8'));
  const items = [];
  for (const line of body.split(/\r?\n/)) {
    const li = line.match(/^\s*[-*+]\s+(.*)$/);
    if (!li) continue;
    const wiki = li[1].match(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/);
    const md = li[1].match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (wiki) {
      const name = wiki[1].trim();
      const url = notes.get(name);
      if (!url) { console.warn(`  ⚠ menu.md: 「${name}」というノートが見つかりません（メニューから外しました）`); continue; }
      items.push({ label: (wiki[2] || name).trim(), url, external: false });
    } else if (md) {
      const external = /^https?:\/\//.test(md[2]);
      items.push({ label: md[1].trim(), url: md[2].trim(), external });
    }
  }
  return items;
}
