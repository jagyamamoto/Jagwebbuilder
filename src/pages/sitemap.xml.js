// 検索エンジン向けのページ一覧。
// 公開前（published: false）は空にする。検索避けをかけたページを一覧に載せると、
// Search Console が「noindex のURLが送信されています」とエラーを出すため。
import { getCollection } from 'astro:content';
import { publishedPosts } from '../lib/posts.mjs';
import { site } from '../lib/site.mjs';

export async function GET() {
  const s = site();
  const urls = [];
  if (s.published && s.url) {
    for (const p of await getCollection('pages')) {
      if (p.data.publish !== false) urls.push(p.id === 'index' ? '/' : `/${p.id}/`);
    }
    urls.push('/blog/');
    for (const p of await publishedPosts()) urls.push(`/blog/${p.entry.id}/`);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${s.url}${encodeURI(u)}</loc></url>`).join('\n') + `\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
