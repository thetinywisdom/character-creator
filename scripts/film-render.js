// Frame-accurate capture for the film rig.
// Chromium + SwiftShader, one deterministic frame per screenshot, then the
// assemble script turns the PNG sequence into the MP4.
//
//   node scripts/film-render.js --stills /tmp/last-bus-stills
//   node scripts/film-render.js --out /tmp/last-bus-frames
//   node scripts/film-render.js --frames 15,299 --out /tmp/last-bus-stills

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const stills = process.argv.includes('--stills');
const urlArg = arg('--url', null);
const filmArg = arg('--film', null);
const frameList = arg('--frames', null);

function filmFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get('film');
  } catch {
    const m = String(url).match(/[?&]film=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

const filmId = filmArg || filmFromUrl(urlArg) || 'last-bus';
if (!/^[a-z0-9-]+$/.test(filmId)) throw new Error(`bad film id "${filmId}"`);

const outDir = arg('--out', stills ? `/tmp/${filmId}-stills` : `/tmp/${filmId}-frames`);

const { BEATS, FPS, DURATION } = await import(`../film/${filmId}/timing.js`);

function framesToRender() {
  if (frameList) return frameList.split(',').map((n) => Number(n.trim()));
  if (stills) return BEATS.map((b) => b.frame);
  const n = FPS * DURATION;
  return Array.from({ length: n }, (_, i) => i);
}

function fileFor(frame) {
  if (stills || frameList) {
    const beat = BEATS.find((b) => b.frame === frame);
    const name = beat ? beat.name : `f${String(frame).padStart(4, '0')}`;
    return path.join(outDir, `${name}.png`);
  }
  return path.join(outDir, `${String(frame).padStart(4, '0')}.png`);
}

async function startVite() {
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const ready = new Promise((resolve, reject) => {
    const on = (buf) => {
      log += buf.toString();
      if (log.includes('Local:') || log.includes('ready in')) resolve();
    };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    child.on('exit', (code) => reject(new Error(`vite exited ${code}\n${log}`)));
  });
  await ready;
  return child;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  let vite = null;
  let url = urlArg;
  if (!url) {
    vite = await startVite();
    url = `http://127.0.0.1:5173/film/index.html?film=${filmId}`;
  } else if (!url.includes('film')) {
    url = url.replace(/\/?$/, '/') + `film/index.html?film=${filmId}`;
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--hide-scrollbars',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon')) errors.push(text);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 30000 });
  } catch (err) {
    console.error(errors.join('\n'));
    throw err;
  }
  if (errors.some((e) => e.includes('Error') || e.includes('TypeError'))) {
    console.error(errors.join('\n'));
    throw new Error('film page failed to boot');
  }

  const frames = framesToRender();
  console.log(`rendering ${frames.length} frame(s) -> ${outDir}`);
  const t0 = Date.now();
  for (let n = 0; n < frames.length; n++) {
    const frame = frames[n];
    const info = await page.evaluate((i) => window.__film.renderFrame(i), frame);
    const png = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    writeFileSync(fileFor(frame), png);
    if (n === 0 || frame === 15 || stills || frameList) {
      const sample = await page.evaluate(() => window.__film.sample());
      console.log(`frame ${frame}  t=${info.t.toFixed(3)}  ${info.shot}  sample=${sample}  fov=${info.fov?.toFixed?.(1) ?? ''}  pts=${JSON.stringify(info.pts ?? {})}`);
    } else if (n % 30 === 0) {
      const el = (Date.now() - t0) / 1000;
      const rate = (n + 1) / el;
      console.log(`frame ${frame}  ${rate.toFixed(2)} fps  eta ${((frames.length - n) / rate).toFixed(0)}s`);
    }
  }
  if (stills || frameList) {
    const bounds = await page.evaluate(() => window.__film.bounds());
    writeFileSync(path.join(outDir, 'bounds.json'), JSON.stringify(bounds, null, 2));
    console.log(JSON.stringify(bounds, null, 2));
  }
  await browser.close();
  if (vite) vite.kill('SIGTERM');
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
