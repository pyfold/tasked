'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isExpectedTaskCurrent, saveProgressIfUnchanged, persistProgressOrConflict } = require('../lib/lesson-turn');

test('accepts the task currently active in saved progress', () => {
  assert.equal(isExpectedTaskCurrent({ task: 'Current task' }, 'Current task'), true);
});

test('rejects an answer submitted from a stale task on another device', () => {
  assert.equal(isExpectedTaskCurrent({ task: 'New task from another device' }, 'Old task'), false);
});

test('rejects legacy submissions that omit the task snapshot', () => {
  assert.equal(isExpectedTaskCurrent({ task: 'Current task' }, undefined), false);
  assert.equal(isExpectedTaskCurrent({ task: 'Current task' }, null), false);
});

test('concurrent requests using the same progress snapshot allow only one mutation', async () => {
  const initialHistory = [{ role: 'teacher', text: '{"task":"Old task"}' }];
  const state = { history: structuredClone(initialHistory), score: 0, attempts: 0 };
  const pool = {
    async query(sql, values) {
      assert.match(sql, /completed=\$7[\s\S]*WHERE id=\$3 AND history=\$6::jsonb/);
      assert.match(sql, /RETURNING id/);
      const [, score, progressId, , attemptDelta, expectedHistory] = values;
      assert.equal(progressId, 7);
      assert.equal(values[6], false);
      if (JSON.stringify(state.history) !== expectedHistory) return { rowCount: 0, rows: [] };
      state.history = JSON.parse(values[0]);
      state.score = score;
      state.attempts += attemptDelta;
      return { rowCount: 1, rows: [{ id: 7 }] };
    },
  };
  const nextHistory = [...initialHistory, { role: 'student', text: 'answer' }];
  const results = await Promise.all([
    saveProgressIfUnchanged(pool, { progressId: 7, previousHistory: initialHistory, nextHistory, score: 1, studentId: 3, answered: true }),
    saveProgressIfUnchanged(pool, { progressId: 7, previousHistory: initialHistory, nextHistory, score: 1, studentId: 3, answered: true }),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.deepEqual(state.history, nextHistory);
  assert.equal(state.attempts, 1, 'a losing duplicate must not increment attempts');
});

test('a stale compare-and-set conflict makes no progress changes', async () => {
  const currentHistory = [{ role: 'teacher', text: '{"task":"New task"}' }];
  const state = { history: structuredClone(currentHistory), score: 4, attempts: 5 };
  const before = structuredClone(state);
  const pool = {
    async query(_sql, values) {
      assert.equal(values[5], JSON.stringify([{ role: 'teacher', text: '{"task":"Old task"}' }]));
      return { rowCount: 0, rows: [] };
    },
  };

  const saved = await saveProgressIfUnchanged(pool, {
    progressId: 7,
    previousHistory: [{ role: 'teacher', text: '{"task":"Old task"}' }],
    nextHistory: [...currentHistory, { role: 'student', text: 'late answer' }],
    score: 5,
    studentId: 3,
    answered: true,
  });

  assert.equal(saved, false);
  assert.deepEqual(state, before, 'conflict path must leave the current progress snapshot unchanged');
});

test('completion is committed atomically with the final progress snapshot', async () => {
  let committed;
  const pool = {
    async query(sql, values) {
      assert.match(sql, /SET[\s\S]*history=\$1::jsonb[\s\S]*completed=\$7[\s\S]*WHERE id=\$3 AND history=\$6::jsonb/);
      committed = { history: JSON.parse(values[0]), completed: values[6] };
      return { rowCount: 1, rows: [{ id: 9 }] };
    },
  };
  const saved = await saveProgressIfUnchanged(pool, {
    progressId: 9,
    previousHistory: [{ role: 'teacher', text: '{"task":"last task"}' }],
    nextHistory: [{ role: 'teacher', text: '{"task":"last task"}' }, { role: 'student', text: 'answer' }],
    score: 6,
    studentId: 3,
    answered: true,
    completed: true,
  });

  assert.equal(saved, true);
  assert.equal(committed.completed, true);
  assert.equal(committed.history.at(-1).text, 'answer');
});

test('a compare-and-set conflict responds 409 and skips post-save side effects', async () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let xpAwardCalls = 0;
  const committed = await persistProgressOrConflict(async () => {
    const updated = await saveProgressIfUnchanged({
      async query() { return { rowCount: 0, rows: [] }; },
    }, {
      progressId: 7,
      previousHistory: [{ role: 'teacher', text: 'stale snapshot' }],
      nextHistory: [{ role: 'student', text: 'late answer' }],
      score: 1,
      studentId: 3,
      answered: true,
    });
    if (updated) xpAwardCalls += 1;
    return updated;
  }, response);

  assert.equal(committed, false);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, { error: 'stale_task' });
  assert.equal(xpAwardCalls, 0, 'losing conflict must not award XP');
});

