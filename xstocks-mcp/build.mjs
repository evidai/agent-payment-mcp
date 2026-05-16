#!/usr/bin/env node
// esbuild bundle — inlines all deps into a single CJS file.
// This eliminates the uuid@10 ESM conflict from rpc-websockets at runtime.
import { build } from 'esbuild';
import { chmodSync, readFileSync, rmSync, mkdirSync } from 'fs';

// Clean dist before build
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: ['node18'],
  format: 'esm',
  outfile: 'dist/index.mjs',
  banner: {
    js: [
      '#!/usr/bin/env node',
      // Polyfill require() for CJS packages bundled into ESM
      'import { createRequire as __cr } from "module";',
      'import { fileURLToPath as __ftp } from "url";',
      'import { dirname as __dn } from "path";',
      'var require = __cr(import.meta.url);',
      'var __filename = __ftp(import.meta.url);',
      'var __dirname = __dn(__filename);',
    ].join('\n'),
  },
  // Silence noisy warnings from @solana internal deps
  logLevel: 'warning',
  // Prefer ESM entry points; fall back to main for CJS-only packages
  mainFields: ['module', 'main'],
  conditions: ['import', 'node', 'default'],
  define: {
    'process.env.NODE_ENV': '"production"',
    '__VERSION__': JSON.stringify(pkg.version),
  },
});

chmodSync('dist/index.mjs', 0o755);
console.log('✓ dist/index.mjs bundled (ESM, Node 18-compatible)');
