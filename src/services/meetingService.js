const { v4: uuidv4 } = require('uuid');
const { query, run, get } = require('../utils/database');

function parseMeeting(row) {
  if (!row) return null;
  return {
    ...row,
    participants: JSON.parse(row.participants),
    transcript: JSON.parse(row.transcript),
  };
}

async function createMeeting(userId, { title, participants, meetingDate, transcript }) {
  const id = uuidv4();
  run(
    'INSERT INTO meetings (id, user_id, title, participants, meeting_date, transcript, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, title, JSON.stringify(participants), meetingDate, JSON.stringify(transcript), new Date().toISOString()]
  );
  return getMeetingById(id, userId);
}

async function getMeetingById(id, userId) {
  const row = get('SELECT * FROM meetings WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) {
    const err = new Error('Meeting not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  const meeting = parseMeeting(row);
  const analysis = get('SELECT * FROM meeting_analyses WHERE meeting_id = ?', [id]);
  if (analysis) {
    meeting.analysis = {
      summary: JSON.parse(analysis.summary),
      decisions: JSON.parse(analysis.decisions),
      followUpSuggestions: JSON.parse(analysis.follow_up_suggestions),
      analyzedAt: analysis.analyzed_at,
    };
  }
  return meeting;
}

async function listMeetings(userId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const rows = query(
    'SELECT * FROM meetings WHERE user_id = ? ORDER BY meeting_date DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  const countRow = get('SELECT COUNT(*) as total FROM meetings WHERE user_id = ?', [userId]);
  const total = countRow ? countRow.total : 0;

  return {
    meetings: rows.map(parseMeeting),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function saveMeetingAnalysis(meetingId, { summary, actionItems, decisions, followUpSuggestions }) {
  const existing = get('SELECT id FROM meeting_analyses WHERE meeting_id = ?', [meetingId]);
  const id = uuidv4();
  const now = new Date().toISOString();

  if (existing) {
    run(
      'UPDATE meeting_analyses SET summary = ?, decisions = ?, follow_up_suggestions = ?, analyzed_at = ? WHERE meeting_id = ?',
      [JSON.stringify(summary), JSON.stringify(decisions), JSON.stringify(followUpSuggestions), now, meetingId]
    );
  } else {
    run(
      'INSERT INTO meeting_analyses (id, meeting_id, summary, decisions, follow_up_suggestions, analyzed_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, meetingId, JSON.stringify(summary), JSON.stringify(decisions), JSON.stringify(followUpSuggestions), now]
    );
  }
  return { summary, actionItems, decisions, followUpSuggestions, analyzedAt: now };
}

module.exports = { createMeeting, getMeetingById, listMeetings, saveMeetingAnalysis };
