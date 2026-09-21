import { site } from '../lib/site.mjs';
export function GET() {
  const s = site();
  const body = s.published
    ? `User-agent: *\nAllow: /\n${s.url ? `Sitemap: ${s.url}/sitemap.xml\n` : ''}`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
