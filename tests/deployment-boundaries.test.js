const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('lesson stays on the authenticated app route and macOS sidecars are excluded from publish', () => {
  const nginx = fs.readFileSync(path.join(root, 'deploy/nginx-tasked.conf'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  assert.match(server, /app\.get\('\/lesson\.html'[\s\S]*?role !== 'student'[\s\S]*?app\.use\(express\.static/);
  assert.match(nginx, /protected HTML \(including lesson\.html\)[\s\S]*?proxy_pass/);
  assert.doesNotMatch(nginx, /location[^\n]*lesson\.html[^\n]*\{\s*root/);
  assert.ok(nginx.includes('location ~* \\.(?:css|js|svg|ttf)$ {'));
  const staticCompression = nginx.match(/location ~\* [^\n]+\n([\s\S]*?)\n\s*\}/);
  assert.ok(staticCompression, 'static assets have a dedicated proxy location');
  assert.match(staticCompression[1], /gzip on;[\s\S]*gzip_proxied any;[\s\S]*gzip_vary on;/);
  assert.match(staticCompression[1], /gzip_comp_level 1;/);
  assert.match(staticCompression[1], /gzip_types text\/css application\/javascript image\/svg\+xml font\/ttf;/);
  assert.doesNotMatch(staticCompression[1], /application\/json|text\/html/);
  assert.match(staticCompression[1], /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  assert.match(dockerignore, /\*\*\/\._\*/);
  assert.match(dockerignore, /\*\*\/\.DS_Store/);
  assert.match(dockerfile, /Refusing to bundle macOS metadata sidecars/);
});

test('static staging omits AppleDouble and Finder metadata, preserving ordinary assets', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tasked-assets-'));
  const source = path.join(temp, 'public');
  const target = path.join(temp, 'stage');
  fs.mkdirSync(path.join(source, 'img'), { recursive: true });
  fs.writeFileSync(path.join(source, 'index.html'), 'ok');
  fs.writeFileSync(path.join(source, '._index.html'), 'metadata');
  fs.writeFileSync(path.join(source, '.DS_Store'), 'metadata');
  fs.writeFileSync(path.join(source, 'img', 'logo.svg'), '<svg/>');
  fs.writeFileSync(path.join(source, 'img', '._logo.svg'), 'metadata');
  const result = spawnSync('python3', [path.join(root, 'deploy/prepare-public-static.py'), source, target], { encoding: 'utf8' });
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(target, 'index.html'), 'utf8'), 'ok');
    assert.equal(fs.readFileSync(path.join(target, 'img/logo.svg'), 'utf8'), '<svg/>');
    assert.deepEqual(fs.readdirSync(target).sort(), ['img', 'index.html']);
    assert.deepEqual(fs.readdirSync(path.join(target, 'img')), ['logo.svg']);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

