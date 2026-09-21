#!/usr/bin/env node
// サイトを公開する。
//
//   npm run deploy
//
// やること: 点検 → 書き出し → Cloudflare Pages へ送る → 本当に出たか確かめる
//
// GitHub を経由しない（Cloudflare へ直接送る）。利用者に GitHub のアカウントが要らなくなるのと、
// 連携まわりの失敗（権限・ビルド環境のずれ）を丸ごと避けられるため。

import { spawnSync } from 'node:child_process';
import { site } from '../src/lib/site.mjs';

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });
const say = (m) => console.log(m);
const stop = (m) => { console.error('\n' + m + '\n'); process.exit(1); };

// ---------- 1. 点検 ----------
say('① 点検しています…');
const check = run('node', ['scripts/check.mjs'], { stdio: 'inherit' });
if (check.status !== 0) stop('点検で「だめ」が出ました。上の内容を直してから、もう一度実行してください。');

const s = site();
if (!s.project) stop('content/site.md に project: を書いてください（公開するときの名前。例: project: jag-curry-shop）');
const project = String(s.project);

// ---------- 2. Cloudflare にログインしているか ----------
say('② Cloudflare の状態を確かめています…');
const who = run('npx', ['wrangler', 'whoami']);
if (who.status !== 0 || /not authenticated|You are not/i.test(who.stdout + who.stderr)) {
  stop([
    'Cloudflare にログインしていません。ここだけは、ご自身の手で行ってください。',
    '',
    '  1. まだの方は https://dash.cloudflare.com/sign-up でアカウントを作る（無料）',
    '  2. 次のコマンドを実行する → ブラウザが開くので「Allow」を押す',
    '',
    '       npx wrangler login',
    '',
    '終わったら、もう一度 npm run deploy を実行してください。',
  ].join('\n'));
}

// ---------- 3. 置き場所（プロジェクト）が無ければ作る ----------
// 無いまま送ると "Project not found" で止まる。初回だけ要る手順なので、こちらで面倒を見る。
const list = run('npx', ['wrangler', 'pages', 'project', 'list']);
if (!new RegExp(`\\b${project}\\b`).test(list.stdout)) {
  say(`③ はじめての公開なので、置き場所「${project}」を作ります…`);
  const made = run('npx', ['wrangler', 'pages', 'project', 'create', project, '--production-branch', 'main']);
  if (made.status !== 0) {
    if (/already exists|taken/i.test(made.stdout + made.stderr)) {
      stop(`「${project}」という名前は、すでにほかの人に使われています。content/site.md の project: を別の名前にしてください。`);
    }
    stop('置き場所を作れませんでした:\n' + (made.stderr || made.stdout));
  }
} else say(`③ 置き場所「${project}」はすでにあります`);

// ---------- 4. 書き出し ----------
say('④ サイトを書き出しています…');
const build = run('npx', ['astro', 'build'], { stdio: 'inherit' });
if (build.status !== 0) stop('書き出しに失敗しました。上のエラーを確かめてください。');

// ---------- 5. 送る ----------
say('⑤ Cloudflare へ送っています…');
// --commit-message は英数字だけにする。日本語を渡すと "Invalid commit message" で止まる。
// --commit-dirty=true は、git に未保存の変更があっても止めないための指定。
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const sent = run('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name', project, '--branch', 'main',
  '--commit-message', `deploy ${stamp}`, '--commit-dirty=true'], { stdio: 'inherit' });
if (sent.status !== 0) stop('送信に失敗しました。上のエラーを確かめてください。');

// ---------- 6. 本当に出たか確かめる ----------
// 状態コード（200）では判断しない。ページが消えていても、トップページが 200 で返ってくる
// ことがあるため。「サイト名が本文に入っているか」で確かめる。
// 送った直後は古い版と新しい版が混ざって返ってくるので、少し待ちながら何度か見る。
const url = `https://${project}.pages.dev/`;
say(`⑥ ${url} に出たか確かめています…`);
let ok = false;
for (let i = 0; i < 12 && !ok; i++) {
  try {
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    ok = r.ok && (await r.text()).includes(s.name);
  } catch { /* つながるまで待つ */ }
  if (!ok) await new Promise((r) => setTimeout(r, 5000));
}
if (!ok) stop(`送信は終わりましたが、${url} にサイト名「${s.name}」が見当たりません。\n1〜2分おいて開いてみてください。それでも出なければ、もう一度 npm run deploy を。`);

say(`\n公開しました: ${url}`);
if (!s.published) {
  say('\n※ いまは「準備中」の設定です（検索には載りません）。');
  say('  本番にするときは content/site.md の published: を true に変えて、もう一度 npm run deploy してください。');
}
