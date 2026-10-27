import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const precache = () => {
  const match = read('sw.js').match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(match, 'PRECACHE list found in sw.js');
  return JSON.parse(match[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
};

test('every precached file exists', () => {
  for (const path of precache()) {
    if (path === './') continue;
    assert.ok(existsSync(join(root, path)), `${path} is missing`);
  }
});

test('every module and static asset needed offline is precached', () => {
  const cached = new Set(precache());
  const needed = walk(join(root, 'js')).map((f) => relative(root, f).split('\\').join('/'));
  needed.push('index.html', 'manifest.webmanifest', 'css/styles.css', 'vendor/pdfmake/pdfmake.min.js', 'vendor/pdfmake/vfs_fonts.js');
  const missing = needed.filter((p) => !cached.has(p));
  assert.deepEqual(missing, []);
});

test('the service worker version matches package.json', () => {
  const version = JSON.parse(read('package.json')).version;
  assert.match(read('sw.js'), new RegExp(`const VERSION = '${version.replace(/\./g, '\\.')}'`));
});

test('static imports between modules resolve to existing files', () => {
  for (const file of walk(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s+'(\.[^']+)'/g)) {
      assert.ok(existsSync(resolve(dirname(file), m[1])), `${relative(root, file)} imports missing ${m[1]}`);
    }
    for (const m of text.matchAll(/import\('(\.[^']+)'\)/g)) {
      assert.ok(existsSync(resolve(dirname(file), m[1])), `${relative(root, file)} dynamically imports missing ${m[1]}`);
    }
  }
});

test('the web manifest is installable and scoped relatively', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, icon.src)), icon.src);
});

test('the app uses relative URLs only and no external CDN', () => {
  const html = read('index.html');
  assert.ok(!/(src|href)="\/(?!\/)/.test(html), 'no root-absolute URLs in index.html');
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]*"/g, '')), 'no external hosts in index.html');
  assert.match(read('js/main.js'), /register\('\.\/sw\.js', \{ scope: '\.\/' \}\)/);
});

test('package.json has no runtime dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.scripts.test, 'node --test');
});

test('no Turkish-specific characters or identifiers remain in text sources', () => {
  // The Turkish-only letters (g-breve, s-cedilla, dotless i, dotted I, c-cedilla) never occur in English, German or Polish.
  const turkish = /[\u011f\u015f\u0131\u0130\u011e\u015e\u00e7\u00c7]/;
  const exts = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.md', '.json', '.webmanifest', '.svg']);
  const offenders = [];
  for (const file of walk(root)) {
    const ext = file.slice(file.lastIndexOf('.'));
    if (!exts.has(ext) || file.includes(`${join('vendor')}`)) continue;
    if (turkish.test(readFileSync(file, 'utf8'))) offenders.push(relative(root, file));
  }
  assert.deepEqual(offenders, []);
});
