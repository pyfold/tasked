const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workerSource = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');

function createWorker({ failUrl, existingCaches = [], networkFetch = async () => ({ ok: true }) } = {}) {
  const listeners = new Map();
  const cached = [];
  const deletedCaches = [];
  const matched = [];
  const state = { skippedWaiting: false };
  const cache = {
    addAll: async (urls) => {
      if (urls.includes(failUrl)) throw new Error(`Failed to cache ${failUrl}`);
      cached.push(...urls);
    },
    add: async (url) => {
      if (url === failUrl) throw new Error(`Failed to cache ${url}`);
      cached.push(url);
    },
  };
  const context = {
    URL,
    Promise,
    caches: {
      open: async () => cache,
      keys: async () => existingCaches,
      delete: async (name) => { deletedCaches.push(name); return true; },
      match: async (url) => {
        matched.push(url);
        return url === '/offline.html' ? 'offline-shell' : undefined;
      },
    },
    fetch: networkFetch,
    self: {
      location: { origin: 'https://pix-study.example' },
      addEventListener: (name, callback) => listeners.set(name, callback),
      skipWaiting: async () => { state.skippedWaiting = true; },
      clients: { claim: async () => {} },
    },
  };
  vm.runInNewContext(workerSource, context);
  return {
    cached,
    deletedCaches,
    matched,
    state,
    install: async () => {
      let pending;
      listeners.get('install')({ waitUntil: (promise) => { pending = promise; } });
      await pending;
    },
    activate: async () => {
      let pending;
      listeners.get('activate')({ waitUntil: (promise) => { pending = promise; } });
      await pending;
    },
    fetch: async (request) => {
      let response;
      listeners.get('fetch')({ request, respondWith: (promise) => { response = promise; } });
      return response;
    },
  };
}

test('installs the offline shell even if an optional core asset fails', async () => {
  const worker = createWorker({ failUrl: '/fonts/Tiny5-Regular.ttf' });
  await worker.install();

  assert.ok(worker.cached.includes('/offline.html'));
  assert.ok(worker.cached.includes('/'));
  assert.ok(worker.cached.includes('/js/i18n.js'));
  assert.ok(worker.cached.includes('/css/pixel.css?v=20261001-1'));
  assert.equal(worker.state.skippedWaiting, true);
});

test('does not install when the required offline fallback itself cannot be cached', async () => {
  const worker = createWorker({ failUrl: '/offline.html' });
  await assert.rejects(worker.install());
  assert.equal(worker.state.skippedWaiting, false);
});

test('offline navigation serves the cached fallback page when the network is unavailable', async () => {
  const worker = createWorker({ networkFetch: async () => { throw new Error('offline'); } });
  const response = await worker.fetch({
    method: 'GET',
    mode: 'navigate',
    url: 'https://pix-study.example/lesson/42',
  });

  assert.equal(response, 'offline-shell');
  assert.deepEqual(worker.matched, ['/offline.html']);
});

test('activation removes old Tasked caches but preserves other apps’ caches', async () => {
  const worker = createWorker({ existingCaches: [
    'tasked-v17', 'tasked-v18', 'tasked-v19', 'tasked-v20', 'tasked-v21', 'pix-hub-v1', 'pix-ui-v1',
  ] });
  await worker.activate();

  assert.deepEqual(worker.deletedCaches, ['tasked-v17', 'tasked-v18', 'tasked-v19', 'tasked-v20', 'tasked-v21']);
});

