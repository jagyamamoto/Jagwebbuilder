import { publishedPosts } from '../lib/posts.mjs';
import { site } from '../lib/site.mjs';
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export async function GET() {
  const s = site();
  const items = (await publishedPosts()).slice(0, 30).map((p) =>
    `  <item><title>${esc(p.title)}</title><link>${s.url}/blog/${encodeURI(p.entry.id)}/</link>` +
    `<guid>${s.url}/blog/${encodeURI(p.entry.id)}/</guid>` +
    (p.date ? `<pubDate>${p.date.toUTCString()}</pubDate>` : '') +
    (p.entry.data.description ? `<description>${esc(p.entry.data.description)}</description>` : '') + `</item>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n` +
    `  <title>${esc(s.name)}</title><link>${s.url}/</link><description>${esc(s.description)}</description>\n${items}\n</channel></rss>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
