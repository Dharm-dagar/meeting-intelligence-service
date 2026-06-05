const { v4: uuidv4 } = require('uuid');
const { query, run, get } = require('../utils/database');

function parseItem(row) {
  if (!row) return null;
  return {
    ...row,
    citations:    row.citations    ? JSON.parse(row.citations)    : [],
    extra_emails: row.extra_emails ? JSON.parse(row.extra_emails) : [],
  };
}

async function createActionItem(userId, { meetingId, task, assignee, assigneeEmail, extraEmails, dueDate, citations }) {
  if (meetingId) {
    const meeting = get('SELECT id FROM meetings WHERE id = ? AND user_id = ?', [meetingId, userId]);
    if (!meeting) {
      const err = new Error('Meeting not found or not owned by you');
      err.statusCode = 404; err.code = 'NOT_FOUND';
      throw err;
    }
  }

  const id  = uuidv4();
  const now = new Date().toISOString();
  run(
    `INSERT INTO action_items
       (id, meeting_id, user_id, task, assignee, assignee_email, extra_emails, due_date, status, citations, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    [
      id, meetingId || null, userId, task, assignee,
      assigneeEmail || null,
      JSON.stringify(extraEmails || []),
      dueDate || null,
      JSON.stringify(citations || []),
      now, now,
    ]
  );
  return getActionItemById(id);
}

async function getActionItemById(id) {
  return parseItem(get('SELECT * FROM action_items WHERE id = ?', [id]));
}

async function updateActionItemStatus(id, userId, status) {
  const item = get('SELECT * FROM action_items WHERE id = ? AND user_id = ?', [id, userId]);
  if (!item) {
    const err = new Error('Action item not found');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }
  const now = new Date().toISOString();
  run('UPDATE action_items SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  return getActionItemById(id);
}

async function listActionItems(userId, { page = 1, limit = 10, status, assignee, meetingId } = {}) {
  const offset = (page - 1) * limit;
  let sql    = 'SELECT * FROM action_items WHERE user_id = ?';
  const params = [userId];

  if (status)    { sql += ' AND status = ?';         params.push(status); }
  if (assignee)  { sql += ' AND assignee LIKE ?';    params.push(`%${assignee}%`); }
  if (meetingId) { sql += ' AND meeting_id = ?';     params.push(meetingId); }

  const countRow = get(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
  const total    = countRow ? countRow.total : 0;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return {
    actionItems: query(sql, params).map(parseItem),
    pagination:  { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getOverdueActionItems() {
  const now = new Date().toISOString();
  return query(
    `SELECT * FROM action_items
     WHERE status != 'COMPLETED' AND due_date IS NOT NULL AND due_date < ?
     ORDER BY due_date ASC`,
    [now]
  ).map(parseItem);
}

async function bulkCreateFromAnalysis(userId, meetingId, actionItems) {
  const created = [];
  for (const item of actionItems) {
    const id  = uuidv4();
    const now = new Date().toISOString();
    run(
      `INSERT INTO action_items
         (id, meeting_id, user_id, task, assignee, assignee_email, extra_emails, due_date, status, citations, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, '[]', NULL, 'PENDING', ?, ?, ?)`,
      [id, meetingId, userId, item.task, item.assignee, JSON.stringify(item.citations || []), now, now]
    );
    created.push(await getActionItemById(id));
  }
  return created;
}

module.exports = {
  createActionItem,
  getActionItemById,
  updateActionItemStatus,
  listActionItems,
  getOverdueActionItems,
  bulkCreateFromAnalysis,
};
