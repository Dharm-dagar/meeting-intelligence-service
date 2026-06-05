const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  dbPath = process.env.DB_PATH || './data/meeting_intelligence.db';

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  await initSchema();
  return db;
}

function saveDb() {
  if (!db || !dbPath) return;
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

async function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      participants TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      transcript TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meeting_analyses (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      decisions TEXT NOT NULL,
      follow_up_suggestions TEXT NOT NULL,
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reminder_history (
      id TEXT PRIMARY KEY,
      action_item_id TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      channel TEXT NOT NULL,
      recipient TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY (action_item_id) REFERENCES action_items(id)
    );
  `);

  // Migrate existing DBs — add columns if missing
  try { db.run(`ALTER TABLE action_items ADD COLUMN extra_emails TEXT`); } catch {}
  try { db.run(`ALTER TABLE reminder_history ADD COLUMN recipient TEXT`); } catch {}

  saveDb();
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  return query(sql, params)[0] || null;
}

module.exports = { getDb, saveDb, query, run, get, initSchema };
