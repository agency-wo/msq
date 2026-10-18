import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/**
 * Emits sw.js with the full list of built files to precache, so the game
 * plays offline after the first visit. The version is a hash of every file
 * name and public file, so each deploy installs a fresh cache.
 */
export function serviceWorker(): Plugin {
  let root = process.cwd();
  let publicDir = '';
  return {
    name: 'msq-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files = new Set<string>(['index.html']);
      for (const name of Object.keys(bundle).sort()) {
        files.add(name);
        hash.update(name);
        const out = bundle[name];
        if (out.type === 'asset' && name === 'index.html') hash.update(String(out.source));
      }
      if (publicDir) {
        for (const file of listFiles(publicDir).sort()) {
          const rel = relative(publicDir, file).split(sep).join('/');
          files.add(rel);
          hash.update(rel);
          hash.update(readFileSync(file));
        }
      }
      const precache = ['./', ...[...files].sort().map((f) => `./${f}`)];
      const template = readFileSync(join(root, 'build', 'sw-template.js'), 'utf8');
      const source = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
