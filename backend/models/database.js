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

let saveTimeout = null;
let saveCounter = 0;

/**
 * 防抖保存：500ms 内多次写操作合并为一次全量写入
 * 错误不抛出，防止 libuv O_HANDLE_CLOSING 崩溃进程
 */
function saveDb() {
  if (!db) return;
  saveCounter++;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      // Windows 下并发文件句柄操作可能触发 libuv 断言，吞掉避免崩溃
      console.error(`[DB] saveDb error (${saveCounter} calls merged):`, err.message);
    }
    saveTimeout = null;
  }, 500);
}

/** 立即同步保存（启动初始化时用） */
function saveDbSync() {
  if (!db) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[DB] saveDbSync error:', err.message);
  }
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT 'general',
      keyword_type TEXT DEFAULT 'topic',
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

  saveDbSync();
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
  // 仅检查24小时内的URL，避免永久去重导致无法发现新讨论
  const row = queryOne(
    "SELECT id FROM hotspots WHERE url = ? AND discovered_at > datetime('now', '-1 day')",
    [url]
  );
  return !!row;
}

/**
 * 按标题模糊去重：24小时内相似标题视为重复
 * 支持中英文，忽略标点空格差异，子串匹配
 */
function titleAlreadyExists(title) {
  if (!title || title.length < 5) return false;
  const clean = t => t.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase().trim();
  const cleaned = clean(title);
  if (!cleaned) return false;

  const rows = queryAll(
    "SELECT title FROM hotspots WHERE discovered_at > datetime('now', '-1 day')"
  );
  for (const row of rows) {
    const existing = clean(row.title);
    if (!existing) continue;
    // 互相包含 → 重复
    if (cleaned.includes(existing) || existing.includes(cleaned)) return true;
    // 短文本（<20字）用最长公共子串大于60%判断
    if (cleaned.length < 20 || existing.length < 20) {
      let common = 0;
      for (let i = 0; i < Math.min(cleaned.length, existing.length); i++) {
        if (cleaned[i] === existing[i]) common++;
      }
      if (common / Math.max(cleaned.length, existing.length) > 0.6) return true;
    }
  }
  return false;
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

function clearAllHotspots() {
  const count = queryOne('SELECT COUNT(*) as cnt FROM hotspots');
  runSql('DELETE FROM hotspots');
  runSql('DELETE FROM notifications');
  return count?.cnt || 0;
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
  titleAlreadyExists,
  addNotification,
  getRecentNotifications,
  getSetting,
  setSetting,
  getAllSettings,
  clearAllHotspots,
};
