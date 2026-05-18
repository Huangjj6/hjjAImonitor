const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'hot_monitor.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  initTables();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT 'general',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS hotspots (
      id TEXT PRIMARY KEY,
      keyword_id TEXT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      summary TEXT,
      ai_score REAL DEFAULT 0,
      ai_reason TEXT,
      is_verified INTEGER DEFAULT 0,
      is_fake INTEGER DEFAULT 0,
      published_at TEXT,
      discovered_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (keyword_id) REFERENCES keywords(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      hotspot_id TEXT,
      type TEXT NOT NULL DEFAULT 'browser',
      recipient TEXT,
      status TEXT DEFAULT 'sent',
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (hotspot_id) REFERENCES hotspots(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run(['crawler_interval', '10']);
  insertSetting.run(['email_enabled', 'false']);
  insertSetting.run(['twitter_enabled', 'true']);
  insertSetting.run(['web_search_enabled', 'true']);
  insertSetting.free();

  saveDb();
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// --- Keywords CRUD ---

function getAllKeywords() {
  return queryAll('SELECT * FROM keywords ORDER BY created_at DESC');
}

function addKeyword(keyword, category = 'general') {
  const id = uuidv4();
  runSql('INSERT INTO keywords (id, keyword, category) VALUES (?, ?, ?)', [id, keyword, category]);
  return getKeywordById(id);
}

function getKeywordById(id) {
  return queryOne('SELECT * FROM keywords WHERE id = ?', [id]);
}

function updateKeyword(id, updates) {
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  fields.push("updated_at = datetime('now')");
  values.push(id);
  runSql(`UPDATE keywords SET ${fields.join(', ')} WHERE id = ?`, values);
  return getKeywordById(id);
}

function deleteKeyword(id) {
  runSql('DELETE FROM keywords WHERE id = ?', [id]);
}

// --- Hotspots CRUD ---

function addHotspot(data) {
  const id = uuidv4();
  runSql(
    `INSERT INTO hotspots (id, keyword_id, title, url, source, summary, ai_score, ai_reason, is_verified, is_fake, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.keyword_id || null,
      data.title,
      data.url,
      data.source,
      data.summary || '',
      data.ai_score || 0,
      data.ai_reason || '',
      data.is_verified || 0,
      data.is_fake || 0,
      data.published_at || null,
    ]
  );
  return getHotspotById(id);
}

function getHotspotById(id) {
  return queryOne('SELECT * FROM hotspots WHERE id = ?', [id]);
}

function getHotspots(limit = 50, offset = 0, verifiedOnly = false) {
  let sql = 'SELECT h.*, k.keyword as keyword_text FROM hotspots h LEFT JOIN keywords k ON h.keyword_id = k.id';
  if (verifiedOnly) sql += ' WHERE h.is_verified = 1 AND h.is_fake = 0';
  sql += ' ORDER BY h.discovered_at DESC LIMIT ? OFFSET ?';
  return queryAll(sql, [limit, offset]);
}

function getHotspotsByKeyword(keywordId, limit = 20) {
  return queryAll(
    'SELECT * FROM hotspots WHERE keyword_id = ? ORDER BY discovered_at DESC LIMIT ?',
    [keywordId, limit]
  );
}

function markHotspotVerified(id, score, reason) {
  runSql('UPDATE hotspots SET is_verified = 1, ai_score = ?, ai_reason = ? WHERE id = ?', [score, reason, id]);
}

function markHotspotFake(id, reason) {
  runSql('UPDATE hotspots SET is_fake = 1, ai_reason = ? WHERE id = ?', [reason, id]);
}

function urlAlreadyExists(url) {
  const row = queryOne('SELECT id FROM hotspots WHERE url = ?', [url]);
  return !!row;
}

// --- Notifications ---

function addNotification(hotspotId, type, recipient) {
  const id = uuidv4();
  runSql('INSERT INTO notifications (id, hotspot_id, type, recipient) VALUES (?, ?, ?, ?)', [
    id, hotspotId, type, recipient || null,
  ]);
}

function getRecentNotifications(limit = 20) {
  return queryAll(
    `SELECT n.*, h.title as hotspot_title, h.url as hotspot_url
     FROM notifications n
     LEFT JOIN hotspots h ON n.hotspot_id = h.id
     ORDER BY n.sent_at DESC LIMIT ?`,
    [limit]
  );
}

// --- Settings ---

function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  runSql("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", [key, String(value)]);
}

function getAllSettings() {
  const rows = queryAll('SELECT * FROM settings');
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  return result;
}

module.exports = {
  getDb,
  getAllKeywords,
  addKeyword,
  getKeywordById,
  updateKeyword,
  deleteKeyword,
  addHotspot,
  getHotspotById,
  getHotspots,
  getHotspotsByKeyword,
  markHotspotVerified,
  markHotspotFake,
  urlAlreadyExists,
  addNotification,
  getRecentNotifications,
  getSetting,
  setSetting,
  getAllSettings,
};
