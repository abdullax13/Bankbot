const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "bank.sqlite");
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  last_salary INTEGER NOT NULL DEFAULT 0,
  last_tip INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
  user_id TEXT NOT NULL,
  item TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item)
);
`);

function ensureUser(userId) {
  db.prepare("INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)").run(userId);
  return db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
}

function addBalance(userId, delta) {
  ensureUser(userId);
  db.prepare("UPDATE users SET balance = balance + ? WHERE user_id = ?").run(delta, userId);
  return getBalance(userId);
}

function setBalance(userId, value) {
  ensureUser(userId);
  db.prepare("UPDATE users SET balance = ? WHERE user_id = ?").run(value, userId);
  return value;
}

function getBalance(userId) {
  ensureUser(userId);
  return db.prepare("SELECT balance FROM users WHERE user_id = ?").get(userId).balance;
}

function getUser(userId){ return ensureUser(userId); }

function setTimestamp(userId, field, ts) {
  ensureUser(userId);
  const allowed = new Set(["last_salary","last_tip"]);
  if (!allowed.has(field)) throw new Error("Invalid field");
  db.prepare(`UPDATE users SET ${field} = ? WHERE user_id = ?`).run(ts, userId);
}

function getInventory(userId) {
  ensureUser(userId);
  return db.prepare("SELECT item, qty FROM inventory WHERE user_id = ? AND qty > 0").all(userId);
}

function addItem(userId, item, qty) {
  ensureUser(userId);
  db.prepare(`
    INSERT INTO inventory (user_id, item, qty)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, item) DO UPDATE SET qty = qty + excluded.qty
  `).run(userId, item, qty);
  return db.prepare("SELECT qty FROM inventory WHERE user_id = ? AND item = ?").get(userId, item).qty;
}

function removeItem(userId, item, qty) {
  ensureUser(userId);
  const row = db.prepare("SELECT qty FROM inventory WHERE user_id = ? AND item = ?").get(userId, item);
  const have = row ? row.qty : 0;
  if (have < qty) return false;
  db.prepare("UPDATE inventory SET qty = qty - ? WHERE user_id = ? AND item = ?").run(qty, userId, item);
  return true;
}

module.exports = {
  db,
  ensureUser,
  addBalance,
  setBalance,
  getBalance,
  getUser,
  setTimestamp,
  getInventory,
  addItem,
  removeItem,
};
