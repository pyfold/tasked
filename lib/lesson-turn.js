'use strict';

// A lesson can be open on more than one device. Reject an answer when the
// client is answering a task that is no longer the active task in progress.
function isExpectedTaskCurrent(activeTask, expectedTask) {
  if (typeof expectedTask !== 'string' || expectedTask.length === 0) return false;
  return expectedTask === activeTask?.task;
}

// Protect against simultaneous submissions from two tabs/devices. The
// database update succeeds only if progress.history still equals the snapshot
// read before grading/generating the next turn. XP is awarded only afterward.
async function saveProgressIfUnchanged(pool, {
  progressId,
  previousHistory,
  nextHistory,
  score,
  studentId,
  answered,
  completed = false,
}) {
  const result = await pool.query(
    `UPDATE progress
       SET history=$1::jsonb, score=$2, attempts=attempts+$5,
           updated_at=now(), student_id=COALESCE(student_id,$4), completed=$7
     WHERE id=$3 AND history=$6::jsonb
     RETURNING id`,
    [JSON.stringify(nextHistory.slice(-80)), score, progressId, studentId,
      answered ? 1 : 0, JSON.stringify(previousHistory || []), Boolean(completed)],
  );
  return result.rowCount === 1;
}

async function persistProgressOrConflict(save, response) {
  if (await save()) return true;
  response.status(409).json({ error: 'stale_task' });
  return false;
}

module.exports = { isExpectedTaskCurrent, saveProgressIfUnchanged, persistProgressOrConflict };

