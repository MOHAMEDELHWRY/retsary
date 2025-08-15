// Minimal font fetcher for Arabic-capable PDF rendering
// Downloads Amiri and Noto Naskh Arabic regular TTFs into public/fonts
// Uses only built-in Node APIs (no extra deps)

import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import https from 'node:https';

const streamPipeline = promisify(pipeline);

const targets = [
  {
    filename: 'Amiri-Regular.ttf',
    url: 'https://raw.githubusercontent.com/aliftype/amiri/master/ttf/Amiri-Regular.ttf',
  },
  {
    filename: 'NotoNaskhArabic-Regular.ttf',
    url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf',
  },
];

const outDir = resolve(process.cwd(), 'public', 'fonts');

function fetchToFile(url, destPath) {
  return new Promise((resolvePromise, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        if (statusCode && statusCode >= 300 && statusCode < 400 && res.headers.location) {
          // Follow redirects
          fetchToFile(res.headers.location, destPath).then(resolvePromise).catch(reject);
          return;
        }
        if (statusCode !== 200) {
          reject(new Error(`Request failed: ${statusCode} for ${url}`));
          res.resume();
          return;
        }
        const fileStream = createWriteStream(destPath);
        streamPipeline(res, fileStream).then(resolvePromise).catch(reject);
      })
      .on('error', reject);
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  for (const t of targets) {
    const dest = resolve(outDir, t.filename);
    if (existsSync(dest)) {
      console.log(`✔ ${t.filename} already exists`);
      continue;
    }
    try {
      console.log(`↓ Fetching ${t.filename} from ${t.url}`);
      await fetchToFile(t.url, dest);
      console.log(`✔ Saved ${t.filename} to public/fonts`);
    } catch (err) {
      console.error(`⚠ Could not download ${t.filename}. ${err.message}`);
      console.error('Please place it manually in public/fonts.');
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
