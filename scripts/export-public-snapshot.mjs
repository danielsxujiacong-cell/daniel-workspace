import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { validateStaticSnapshot, sanitizeStaticSnapshot } from '../src/static-snapshot.js';

// Release-time import only. Visitors never contact the publication Worker.
const root = new URL('../assets/public/', import.meta.url);
const input = process.argv[2];
const source = input ? JSON.parse((await readFile(input, 'utf8')).replace(/^\uFEFF/, ''))
  : await fetch('https://workspace.danielxu.cn/api/public/snapshot', { signal: AbortSignal.timeout(20000) }).then(r => { if (!r.ok) throw Error(`Publication HTTP ${r.status}`); return r.json(); });
if (!validateStaticSnapshot(source)) throw Error('Invalid publication; existing files unchanged.');
const next = sanitizeStaticSnapshot(source);
if (!validateStaticSnapshot(next) || next.projects.length !== source.projects.length) throw Error('Unsafe/incomplete projection; existing files unchanged.');
await mkdir(root, { recursive: true });
let current = null;
try { current = JSON.parse(await readFile(new URL('latest.json', root), 'utf8')); } catch {}
if (current && !validateStaticSnapshot(current)) throw Error('Existing latest is invalid; investigate before rotating.');
if (current && current.publishedAt > next.publishedAt) throw Error('Refusing publication rollback.');
if (current?.publishedAt === next.publishedAt) { console.log('Publication unchanged.'); process.exit(0); }
// First migration has one known successful version. Seed both slots with that
// baseline; subsequent releases retain the actual previous successful version.
await writeFile(new URL('previous.json', root), JSON.stringify(current || next) + '\n');
await writeFile(new URL('latest.next.json', root), JSON.stringify(next) + '\n');
await rename(new URL('latest.next.json', root), new URL('latest.json', root));
console.log(JSON.stringify({ projects: next.projects.length, publishedAt: next.publishedAt, previous: current?.publishedAt || 'initial baseline' }));
