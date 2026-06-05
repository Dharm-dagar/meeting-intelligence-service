process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_testing_only';

// ── In-memory SQLite bootstrap ─────────────────────────────────────────────
// We patch the database module BEFORE any app code loads, so every service
// that does `const { query, run, get } = require('../utils/database')` at
// module-load time receives the real sql.js–backed helpers pointing at an
// in-memory DB.
const initSqlJs = require('sql.js');

// Module-level DB reference (set during beforeAll)
let _db = null;

// Patch helpers BEFORE requiring app
const dbModule = require('../src/utils/database');

function prepare(sql) { return _db.prepare(sql); }

// Override exported helpers
dbModule.query = (sql, params = []) => {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
};
dbModule.run = (sql, params = []) => { _db.run(sql, params); };
dbModule.get = (sql, params = []) => {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows[0] || null;
};
dbModule.getDb = async () => _db;
dbModule.saveDb = () => {};

beforeAll(async () => {
  const SQL = await initSqlJs();
  _db = new SQL.Database();

  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      participants TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      transcript TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meeting_analyses (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      decisions TEXT NOT NULL,
      follow_up_suggestions TEXT NOT NULL,
      analyzed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      meeting_id TEXT,
      user_id TEXT NOT NULL,
      task TEXT NOT NULL,
      assignee TEXT NOT NULL,
      assignee_email TEXT,
      extra_emails TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      citations TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminder_history (
      id TEXT PRIMARY KEY,
      action_item_id TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT,
      status TEXT NOT NULL,
      error_message TEXT
    );
  `);
});

// ── Tests ──────────────────────────────────────────────────────────────────
const request = require('supertest');
const app = require('../src/app');

describe('Health & Evaluation', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/evaluation returns candidate info', async () => {
    const res = await request(app).get('/api/evaluation');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.features)).toBe(true);
  });
});

describe('Authentication', () => {
  const user = { email: 'auth_test@example.com', password: 'password123', name: 'Test User' };
  let token;

  test('POST /api/auth/register - creates user and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.traceId).toBeDefined();
  });

  test('POST /api/auth/register - duplicate email returns 409', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('POST /api/auth/register - invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, email: 'not-an-email', password: 'pw123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/auth/register - short password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: '123', name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/auth/login - returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  test('POST /api/auth/login - wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('Protected route without token returns 401', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Meetings', () => {
  let token;
  let meetingId;

  const meetingPayload = {
    title: 'Sprint Planning',
    participants: ['alice@example.com', 'bob@example.com'],
    meetingDate: '2026-05-20T10:00:00Z',
    transcript: [
      { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
      { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' },
    ],
  };

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'meetings_user@example.com',
      password: 'pass12345',
      name: 'Meeting User',
    });
    token = res.body.data?.token;
    if (!token) {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'meetings_user@example.com', password: 'pass12345' });
      token = login.body.data?.token;
    }
  });

  test('POST /api/meetings - creates meeting', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send(meetingPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Sprint Planning');
    expect(res.body.data.participants).toEqual(meetingPayload.participants);
    meetingId = res.body.data.id;
  });

  test('POST /api/meetings - missing title returns 400', async () => {
    const { title, ...noTitle } = meetingPayload;
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send(noTitle);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/meetings - invalid participant email returns 400', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...meetingPayload, participants: ['not-an-email'] });
    expect(res.status).toBe(400);
  });

  test('POST /api/meetings - empty transcript returns 400', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...meetingPayload, transcript: [] });
    expect(res.status).toBe(400);
  });

  test('GET /api/meetings - lists meetings with pagination metadata', async () => {
    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.meetings)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBeGreaterThan(0);
  });

  test('GET /api/meetings/:id - returns meeting by id', async () => {
    const res = await request(app)
      .get(`/api/meetings/${meetingId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(meetingId);
    expect(res.body.data.transcript).toBeDefined();
  });

  test('GET /api/meetings/nonexistent-id - returns 404', async () => {
    const res = await request(app)
      .get('/api/meetings/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Action Items', () => {
  let token;
  let itemId;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'actions_user@example.com',
      password: 'pass12345',
      name: 'Actions User',
    });
    token = res.body.data?.token;
    if (!token) {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'actions_user@example.com', password: 'pass12345' });
      token = login.body.data?.token;
    }
  });

  test('POST /api/action-items - creates action item with PENDING status', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        task: 'Prepare release notes',
        assignee: 'Alice',
        assigneeEmail: 'alice@example.com',
        dueDate: '2026-06-10T17:00:00Z',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.task).toBe('Prepare release notes');
    expect(res.body.data.status).toBe('PENDING');
    itemId = res.body.data.id;
  });

  test('POST /api/action-items - missing task returns 400', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ assignee: 'Bob' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/action-items - invalid assigneeEmail returns 400', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ task: 'Do something', assignee: 'Bob', assigneeEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/action-items/:id/status - updates to IN_PROGRESS', async () => {
    const res = await request(app)
      .patch(`/api/action-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  test('PATCH /api/action-items/:id/status - updates to COMPLETED', async () => {
    const res = await request(app)
      .patch(`/api/action-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('PATCH /api/action-items/:id/status - invalid status returns 400', async () => {
    const res = await request(app)
      .patch(`/api/action-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INVALID_STATUS' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/action-items - lists action items', async () => {
    const res = await request(app)
      .get('/api/action-items')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.actionItems)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  test('GET /api/action-items?status=COMPLETED - filters by status', async () => {
    const res = await request(app)
      .get('/api/action-items?status=COMPLETED')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.actionItems.every((i) => i.status === 'COMPLETED')).toBe(true);
  });

  test('GET /api/action-items/overdue - returns overdue items list', async () => {
    // Create a past-due item
    await request(app)
      .post('/api/action-items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        task: 'Old overdue task',
        assignee: 'Bob',
        dueDate: '2020-01-01T00:00:00Z',
      });

    const res = await request(app)
      .get('/api/action-items/overdue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.actionItems)).toBe(true);
    expect(res.body.data.actionItems.length).toBeGreaterThan(0);
    // All should have status != COMPLETED
    expect(res.body.data.actionItems.every((i) => i.status !== 'COMPLETED')).toBe(true);
  });
});

describe('Response Format', () => {
  test('API responses include traceId field', async () => {
    const res = await request(app).get('/api/evaluation');
    expect(res.body).toHaveProperty('traceId');
    expect(typeof res.body.traceId).toBe('string');
  });

  test('Successful responses have success: true', async () => {
    const res = await request(app).get('/api/evaluation');
    expect(res.body.success).toBe(true);
  });

  test('Error responses have success: false and error object', async () => {
    const res = await request(app).get('/api/meetings/no-such-id')
      .set('Authorization', `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ4eHgiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJuYW1lIjoiVGVzdCIsImlhdCI6OTk5OTk5OTk5OSwiZXhwIjo5OTk5OTk5OTk5fQ.invalid`);
    // Should be 401 (invalid token) not 500
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  test('404 on unknown route returns proper error format', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.traceId).toBeDefined();
  });
});
