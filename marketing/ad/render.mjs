/* global process, console */
// Renders the DryRun ad with Remotion.
//   node marketing/ad/render.mjs                 → both cuts, full video
//   node marketing/ad/render.mjs vertical        → one cut (vertical | wide)
//   node marketing/ad/render.mjs stills 45,150   → PNG stills of both cuts at those frames
// Everything stays inside the project: the bundle goes to .scratch/ad-bundle,
// webpack's cache to .cache/webpack (rootDir), temp files to TMPDIR, which the
// npm script points at .scratch/ad-tmp. No licence key is passed, so the
// renderer sends no usage event anywhere (it only prints a warning).

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const adDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(adDir, '../..');
const outDir = path.join(adDir, 'out');
mkdirSync(outDir, { recursive: true });

const tmp = process.env.TMPDIR ?? '';
if (!path.resolve(tmp).startsWith(root)) {
  console.error('Set TMPDIR inside the project (use `npm run ad`), so no temp files land outside it.');
  process.exit(1);
}

const music = existsSync(path.join(adDir, 'public', 'music.mp3'));
const [mode = 'video', arg = ''] = process.argv.slice(2);
const cuts = mode === 'vertical' ? ['DryRunAdVertical'] : mode === 'wide' ? ['DryRunAdWide'] : ['DryRunAdVertical', 'DryRunAdWide'];

console.log(`Bundling… (music: ${music ? 'marketing/ad/public/music.mp3' : 'none — silent render'})`);
const serveUrl = await bundle({
  entryPoint: path.join(adDir, 'src', 'index.ts'),
  outDir: path.join(root, '.scratch', 'ad-bundle'),
  rootDir: root,
  publicDir: path.join(adDir, 'public'),
  webpackOverride: (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), '@': path.join(root, 'src') } },
  }),
});

const inputProps = { music };
const logLevel = process.env.AD_LOG ?? 'info';
// Software GL: the headless shell's GPU helper crashes on this Mac (it cannot
// find icudtl.dat inside its helper bundle); the ad needs no GPU.
const chromiumOptions = { gl: process.env.AD_GL ?? 'swangle' };
// Remotion's own headless shell download crashes in its GPU helper on this Mac;
// the Playwright headless shell already in the project cache runs fine, so use it.
const pwShell = path.join(root, '.cache', 'ms-playwright');
const shellDir = existsSync(pwShell) ? readdirSync(pwShell).find((d) => d.startsWith('chromium_headless_shell-')) : undefined;
const browserExecutable = shellDir ? path.join(pwShell, shellDir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell') : null;
for (const id of cuts) {
  const composition = await selectComposition({ serveUrl, id, inputProps, logLevel, chromiumOptions, browserExecutable });
  const name = id === 'DryRunAdVertical' ? 'vertical-1080x1920' : 'wide-1920x1080';
  if (mode === 'stills') {
    const frames = (arg || '45,150').split(',').map(Number);
    for (const frame of frames) {
      const output = path.join(outDir, `still-${name}-f${frame}.png`);
      await renderStill({ composition, serveUrl, output, frame, inputProps, logLevel, chromiumOptions, browserExecutable });
      console.log('still', output);
    }
    continue;
  }
  const output = path.join(outDir, `dryrun-ad-${name}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps,
    concurrency: 2,
    logLevel,
    chromiumOptions,
    browserExecutable,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) process.stdout.write(`\r${name}: ${pct}%   `);
    },
  });
  console.log(`\n${output}`);
}
