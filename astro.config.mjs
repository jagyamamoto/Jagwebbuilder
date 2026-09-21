import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { obsidianLinks } from './src/lib/obsidian.mjs';
import obsidianContent from './src/lib/integration.mjs';
import { site } from './src/lib/site.mjs';

// サイトの中身はすべて content/（Obsidian で開くフォルダ）にある。
// このファイルを直す必要は、ふつうは無い。
export default defineConfig({
  site: site().url || undefined,
  output: 'static',            // 動的な処理が要らないかぎり static で足りる。SSR にすると公開まわりが一気に難しくなる
  trailingSlash: 'always',     // /about と /about/ が混ざると、片方が 404 や転送になって分かりにくい
  integrations: [obsidianContent()],
  markdown: {
    // wikilinks: true で Obsidian の [[ノート名]] と ![[画像]] を読めるようにし、
    // obsidianLinks() で、その行き先をサイト上の場所に直す。
    processor: satteri({ features: { wikilinks: true }, mdastPlugins: [obsidianLinks()] }),
  },
  devToolbar: { enabled: false },
});
