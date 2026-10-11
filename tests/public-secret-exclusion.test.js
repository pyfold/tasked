const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicRoot = path.join(__dirname, '../public');

function findBackupProfiles(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findBackupProfiles(fullPath));
    else if (entry.isFile() && /backup.*profile/i.test(entry.name)) found.push(fullPath);
  }
  return found;
}

test('public assets do not contain VPN backup profiles', () => {
  assert.deepEqual(findBackupProfiles(publicRoot), []);
});

