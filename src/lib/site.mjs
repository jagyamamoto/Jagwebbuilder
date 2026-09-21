// サイト全体の設定（content/site.md）とメニュー（content/menu.md）を読む。
//
// どちらも Obsidian で開いて書き換えるだけで変えられるようにしてある。
// 値をこのファイルの中に持たせないこと。持たせた瞬間に
// 「Obsidian を直したのにサイトが変わらない」が起きる。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR, frontmatter, noteIndex, stripTodo } from './obsidian.mjs';

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

// サイトのあちこちに出る短い言葉（content/labels.md）。
// ページの部品（src/）に言葉を直接書かないための置き場。
// ここの既定値は、labels.md を消してしまったときの保険。ふだんは labels.md のほうが使われる。
const DEFAULT_LABELS = {
  menu: 'メニュー',
  footer_menu: '下のメニュー',
  tel: '電話',
  draft_notice: '準備中のサイトです（検索には載りません）',
  blog_title: 'ブログ',
  blog_description: 'お知らせとブログの一覧です。',
  blog_home_title: 'お知らせ・ブログ',
  blog_more: 'すべて見る →',
  blog_back: '← ブログの一覧へ',
  blog_empty: 'まだ記事がありません。',
};

export function labels() {
  const file = join(CONTENT_DIR, 'labels.md');
  if (!existsSync(file)) return { ...DEFAULT_LABELS };
  const { data } = frontmatter(readFileSync(file, 'utf8'));
  const out = { ...DEFAULT_LABELS };
  for (const [k, v] of Object.entries(data)) if (k in out && String(v).trim()) out[k] = String(v);
  return out;
}

export function site() {
  const file = join(CONTENT_DIR, 'site.md');
  if (!existsSync(file)) return { ...DEFAULTS, footer: '', accentInk: '#ffffff' };
  const { data, body } = frontmatter(readFileSync(file, 'utf8'));
  const s = { ...DEFAULTS, ...data };
  s.url = String(s.url || '').replace(/\/+$/, '');
  s.published = s.published === true;
  s.footer = stripTodo(body).trim();
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
//
//     - [[ホーム]]
//     - [[サービス]]
//         - [[ホームページ制作]]        ← 字下げすると、サービスの下にぶら下がる
//         - [[更新サポート]]
//     - [[お問い合わせ]]
//
//     ## 下のメニュー                   ← この見出しより下は、ページのいちばん下に出る
//     - [[プライバシーポリシー]]
//
// 並び順＝メニューの並び順。行を消せばメニューから消え、足せば増える。
// ページの URL は slug で決まり、メニューのどこに置いても変わらない。
// （メニューを動かしただけでリンク切れになる、を起こさないため）
export function menu() {
  const file = join(CONTENT_DIR, 'menu.md');
  const out = { main: [], footer: [] };
  if (!existsSync(file)) return out;
  const notes = noteIndex();
  const { body } = frontmatter(readFileSync(file, 'utf8'));
  // [!todo] のメモの中に書いた見本の行を、メニューとして読まないようにする
  const lines = stripTodo(body).split(/\r?\n/);

  let target = out.main, parent = null, baseIndent = null;
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      if (/下|フッター|footer/i.test(h[1])) target = out.footer;
      else if (/上|ヘッダー|メイン|header|main/i.test(h[1])) target = out.main;
      parent = null; baseIndent = null;
      continue;
    }
    const li = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (!li) continue;
    const indent = li[1].replace(/\t/g, '    ').length;
    if (baseIndent === null) baseIndent = indent;

    const item = parseItem(li[2], notes);
    if (!item) continue;
    if (indent > baseIndent && parent) parent.children.push(item);
    else { target.push(item); parent = item; }
  }
  return out;
}

function parseItem(text, notes) {
  const wiki = text.match(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/);
  const md = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (wiki) {
    const name = wiki[1].trim();
    const url = notes.get(name);
    if (!url) { console.warn(`  ⚠ menu.md: 「${name}」というノートが見つかりません（メニューから外しました）`); return null; }
    return { label: (wiki[2] || name).trim(), url, external: false, children: [] };
  }
  if (md) return { label: md[1].trim(), url: md[2].trim(), external: /^https?:\/\//.test(md[2]), children: [] };
  // リンクの無い行は、子メニューをまとめるための見出しとして使える
  const label = text.trim();
  return label ? { label, url: null, external: false, children: [] } : null;
}
