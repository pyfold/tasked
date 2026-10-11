'use strict';

// Isolated integration coverage for Tasked's progress compare-and-set and
// unique progress-row creation. This starts and destroys a temporary cluster;
// it never reads DATABASE_URL or connects to an application database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { saveProgressIfUnchanged } = require('../lib/lesson-turn');

function executable(name) {
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    const candidate = path.join(directory, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(binary)} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

class PsqlPool {
  constructor(psql, port, socket) {
    this.psql = psql;
    this.port = port;
    this.socket = socket;
  }

  async query(template, values = []) {
    const sql = template.replace(/\$(\d+)/g, (_match, index) => sqlLiteral(values[Number(index) - 1]));
    const trimmed = sql.trim().replace(/;\s*$/, '');
    let executableSql = trimmed;
    if (/^SELECT\b/i.test(trimmed)) {
      executableSql = `SELECT row_to_json(_result)::text FROM (${trimmed}) AS _result`;
    } else if (/\bRETURNING\b/i.test(trimmed) && /^(INSERT|UPDATE)\b/i.test(trimmed)) {
      executableSql = `WITH _result AS (${trimmed}) SELECT row_to_json(_result)::text FROM _result`;
    }
    const { stdout } = await execFile(this.psql, [
      '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
      '-h', this.socket, '-p', String(this.port), '-U', 'postgres', '-d', 'postgres',
      '-c', executableSql,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const rows = stdout.trim() ? stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
    return { rows, rowCount: rows.length };
  }

  async end() {}
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function main() {
  const names = ['initdb', 'pg_ctl', 'psql', 'postgres'];
  const binaries = Object.fromEntries(names.map((name) => [name, executable(name)]));
  const missing = names.filter((name) => !binaries[name]);
  if (missing.length) {
    process.stdout.write(`SKIP PostgreSQL integration: missing ${missing.join(', ')}\n`);
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasked-pg-cas-'));
  const data = path.join(root, 'data');
  const socket = path.join(root, 'socket');
  const log = path.join(root, 'postgres.log');
  fs.mkdirSync(socket, { mode: 0o700 });
  let port;
  let pool;
  let started = false;
  try {
    port = await availablePort();
    run(binaries.initdb, ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale']);
    run(binaries.pg_ctl, [
      '-D', data,
      '-l', log,
      '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`,
      '-w', 'start',
    ]);
    started = true;
    pool = new PsqlPool(binaries.psql, port, socket);
    await pool.query(`
      CREATE TABLE progress (
        id SERIAL PRIMARY KEY,
        topic_id INT NOT NULL,
        student_key TEXT NOT NULL,
        history JSONB NOT NULL DEFAULT '[]'::jsonb,
        score INT NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        student_id INT,
        completed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (topic_id, student_key)
      )
    `);

    const initialHistory = [{ role: 'teacher', text: '{"task":"Current task"}' }];
    const inserted = await pool.query(
      'INSERT INTO progress (topic_id, student_key, history) VALUES ($1,$2,$3::jsonb) RETURNING id',
      [10, 'student:test-cas', JSON.stringify(initialHistory)],
    );
    const progressId = inserted.rows[0].id;
    const nextHistory = [...initialHistory, { role: 'student', text: 'answer' }];
    const writes = await Promise.all([
      saveProgressIfUnchanged(pool, {
        progressId, previousHistory: initialHistory, nextHistory,
        score: 1, studentId: 21, answered: true,
      }),
      saveProgressIfUnchanged(pool, {
        progressId, previousHistory: initialHistory, nextHistory,
        score: 1, studentId: 21, answered: true,
      }),
    ]);
    assert.deepEqual(writes.sort(), [false, true], 'exactly one writer should win the same history snapshot');
    const finalProgress = (await pool.query(
      'SELECT history, score, attempts, completed FROM progress WHERE id=$1', [progressId],
    )).rows[0];
    assert.deepEqual(finalProgress.history, nextHistory);
    assert.equal(finalProgress.score, 1);
    assert.equal(finalProgress.attempts, 1, 'the losing writer must not increment attempts');
    assert.equal(finalProgress.completed, false);

    const finalTask = [...nextHistory, { role: 'teacher', text: '{"task":"final"}' }];
    const finished = await saveProgressIfUnchanged(pool, {
      progressId,
      previousHistory: nextHistory,
      nextHistory: finalTask,
      score: 6,
      studentId: 21,
      answered: true,
      completed: true,
    });
    assert.equal(finished, true, 'the final answer snapshot should commit');
    const completedProgress = (await pool.query(
      'SELECT history, completed FROM progress WHERE id=$1', [progressId],
    )).rows[0];
    assert.deepEqual(completedProgress.history, finalTask);
    assert.equal(completedProgress.completed, true, 'completion and history must be committed together');

    const createProgress = async () => {
      const result = await pool.query(
        `INSERT INTO progress (topic_id, student_key, history)
         VALUES ($1,$2,'[]'::jsonb)
         ON CONFLICT (topic_id, student_key) DO NOTHING
         RETURNING id`,
        [11, 'student:test-create-race'],
      );
      const row = result.rows[0] || (await pool.query(
        'SELECT id FROM progress WHERE topic_id=$1 AND student_key=$2',
        [11, 'student:test-create-race'],
      )).rows[0];
      return { inserted: result.rowCount === 1, id: row.id };
    };
    const creates = await Promise.all([createProgress(), createProgress()]);
    assert.equal(creates.filter((entry) => entry.inserted).length, 1, 'only one concurrent insert should create the unique row');
    assert.equal(creates[0].id, creates[1].id, 'both callers should resolve to the same progress row');
    const count = await pool.query(
      'SELECT count(*)::int AS count FROM progress WHERE topic_id=$1 AND student_key=$2',
      [11, 'student:test-create-race'],
    );
    assert.equal(count.rows[0].count, 1);

    process.stdout.write('PASS PostgreSQL CAS: two concurrent writers; one attempt mutation\n');
    process.stdout.write('PASS PostgreSQL durability: final history and completion flag commit atomically\n');
    process.stdout.write('PASS PostgreSQL unique create: concurrent first turns resolve to one progress row\n');
  } finally {
    try {
      if (pool) await pool.end();
      if (started) {
        run(binaries.pg_ctl, ['-D', data, '-m', 'immediate', '-w', 'stop']);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

