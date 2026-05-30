/**
 * Patches @astrojs/cloudflare's cloudflare-module-loader.js to skip client-side
 * chunks that don't exist inside _worker.js/.
 *
 * Bug: the generateBundle Rollup hook runs for both client and server builds.
 * Client chunks (e.g. _astro/index.xxx.js) get added to the WASM replacement
 * list, but afterBuildCompleted looks for them at _worker.js/{fileName} where
 * they don't exist, causing ENOENT. The fix is to skip missing files.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const BAD = `const filepath = path.join(baseDir, "_worker.js", fileName);
        const contents = await fs.readFile(filepath, "utf-8");`;

const GOOD = `const filepath = path.join(baseDir, "_worker.js", fileName);
        try { await fs.access(filepath); } catch { continue; }
        const contents = await fs.readFile(filepath, "utf-8");`;

let patched = 0;

// Find all installed copies (both pnpm virtual store and top-level symlink)
const candidates = [
  join(root, 'node_modules/@astrojs/cloudflare/dist/utils/cloudflare-module-loader.js'),
];

// Also scan pnpm store
const pnpmStore = join(root, 'node_modules/.pnpm');
if (existsSync(pnpmStore)) {
  const { readdirSync } = await import('node:fs');
  for (const dir of readdirSync(pnpmStore)) {
    if (dir.startsWith('@astrojs+cloudflare@12')) {
      const candidate = join(pnpmStore, dir, 'node_modules/@astrojs/cloudflare/dist/utils/cloudflare-module-loader.js');
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }
}

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const original = readFileSync(file, 'utf-8');
  if (original.includes(GOOD)) {
    // already patched
    continue;
  }
  if (!original.includes(BAD)) {
    // different version — skip
    continue;
  }
  writeFileSync(file, original.replace(BAD, GOOD), 'utf-8');
  patched++;
  console.log(`patched: ${file.replace(root, '').slice(1)}`);
}

if (patched === 0) {
  console.log('patch-cloudflare-module-loader: nothing to patch (already applied or version mismatch)');
}
