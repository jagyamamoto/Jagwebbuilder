// ブログ記事の一覧を、公開してよいものだけ・新しい順で返す。
import { getCollection } from 'astro:content';

// 日付は date: で書く。無ければファイル名の先頭（2026-10-01-…）から読む。
export function postDate(entry) {
  if (entry.data.date) return entry.data.date;
  const m = String(entry.filePath || entry.id).split('/').pop().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`) : null;
}

export function postTitle(entry) {
  return entry.data.title || entry.id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

export async function publishedPosts() {
  const all = await getCollection('blog');
  return all
    .filter((p) => p.data.publish === true)
    .map((p) => ({ entry: p, date: postDate(p), title: postTitle(p) }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

export const fmtDate = (d) =>
  d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : '';
