const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '../../data.sqlite');

function open() {
  return new sqlite3.Database(DB_PATH);
}

async function init() {
  const db = open();

  const run = (sql, params=[]) => new Promise((res, rej) => {
    db.run(sql, params, function (err) { err ? rej(err) : res(this); });
  });

  // Tabelas básicas (iremos ajustar nos próximos passos)
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    firstName TEXT,
    lastName TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );`);

  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    userId TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );`);

  db.close();
}

function get(sql, params=[]) {
  const db = open();
  return new Promise((res, rej) => {
    db.get(sql, params, (err, row) => { db.close(); err ? rej(err) : res(row); });
  });
}

function all(sql, params=[]) {
  const db = open();
  return new Promise((res, rej) => {
    db.all(sql, params, (err, rows) => { db.close(); err ? rej(err) : res(rows); });
  });
}

function run(sql, params=[]) {
  const db = open();
  return new Promise((res, rej) => {
    db.run(sql, params, function (err) { db.close(); err ? rej(err) : res(this); });
  });
}

module.exports = { init, get, all, run, DB_PATH };
