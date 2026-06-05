const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, run, get } = require('../utils/database');

const JWT_SECRET = () => process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = '7d';

async function register({ email, password, name }) {
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    err.code = 'EMAIL_TAKEN';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  run(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, email, passwordHash, name, new Date().toISOString()]
  );

  const token = jwt.sign({ userId: id, email, name }, JWT_SECRET(), { expiresIn: JWT_EXPIRES_IN });
  return { token, user: { id, email, name } };
}

async function login({ email, password }) {
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET(),
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

module.exports = { register, login };
