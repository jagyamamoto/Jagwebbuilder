// content/ の中のノートを、Astro に「ページ」と「ブログ記事」として読ませる設定。
//
// 決まりごとは少なくしてある。Obsidian でふつうにノートを書けば通るように、
// ほとんどの項目は書かなくてよい（任意）にした。

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// URL に使う名前。ノートの先頭で slug: about のように決められる。無ければファイル名。
// 日本語のファイル名でも動くが、URL が長く読みにくくなるので、英数字の slug を付けるのがおすすめ。
const idFrom = ({ entry, data }) =>
  String(data.slug || entry.replace(/\.md$/, '').split('/').pop());

const tags = z.union([z.string(), z.array(z.string())]).optional()
  .transform((v) => (Array.isArray(v) ? v : String(v || '').split(/[,、]/)).map((t) => String(t).trim()).filter(Boolean));

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages', generateId: idFrom }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    slug: z.string().optional(),
    publish: z.boolean().optional().default(true),   // ページは、消したいときだけ publish: false
    // トップページ（index.md）向けの項目。書かなければ出ない
    hero: z.string().optional(),
    lead: z.string().optional(),
    cta_label: z.string().optional(),
    cta_link: z.string().optional(),
    show_blog: z.coerce.number().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/blog', generateId: idFrom }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    slug: z.string().optional(),
    date: z.coerce.date().optional(),
    // ブログは publish: true と書いたものだけが出る。
    // 書きかけのノートが、知らないうちに公開されるのを防ぐため。
    publish: z.boolean().optional().default(false),
    tags,
    image: z.string().optional(),
  }),
});

export const collections = { pages, blog };
