/**
 * lib/localCache.js
 *
 * SQLite-backed fast local cache for per-session transient data.
 * Uses better-sqlite3 (synchronous) so it never blocks the event loop
 * while doing bulk cache reads/writes.
 *
 * Each bot process gets its own in-memory database — zero disk I/O,
 * zero cross-user contamination, zero Heroku ephemeral-disk issues.
 *
 * Tables:
 *   message_cache  — antidelete message metadata
 *   media_cache    — antidelete media file paths
 *   rate_limits    — per-user command rate limiting
 *   viewonce_log   — view-once detection history
 */

import Database from 'better-sqlite3';

let db = null;

function getDB() {
    if (db) return db;

    db = new Database(':memory:');

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS message_cache (
            msg_id      TEXT PRIMARY KEY,
            chat_id     TEXT NOT NULL,
            sender      TEXT,
            push_name   TEXT,
            msg_type    TEXT,
            content     TEXT,
            has_media   INTEGER DEFAULT 0,
            timestamp   INTEGER NOT NULL,
            cached_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON message_cache(timestamp);
        CREATE INDEX IF NOT EXISTS idx_msg_chat ON message_cache(chat_id);

        CREATE TABLE IF NOT EXISTS media_cache (
            msg_id      TEXT PRIMARY KEY,
            file_path   TEXT,
            media_type  TEXT,
            mimetype    TEXT,
            file_size   INTEGER DEFAULT 0,
            saved_at    INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
            user_jid    TEXT NOT NULL,
            command     TEXT NOT NULL,
            hit_count   INTEGER DEFAULT 1,
            window_start INTEGER NOT NULL,
            PRIMARY KEY (user_jid, command)
        );

        CREATE TABLE IF NOT EXISTS viewonce_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sender      TEXT,
            media_type  TEXT,
            caption     TEXT,
            file_path   TEXT,
            detected_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_vo_detected ON viewonce_log(detected_at);
    `);

    return db;
}

// ─── Message Cache ────────────────────────────────────────────────────────────

export function cacheMessage(msgId, data) {
    const d = getDB();
    d.prepare(`
        INSERT OR REPLACE INTO message_cache
            (msg_id, chat_id, sender, push_name, msg_type, content, has_media, timestamp, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        msgId,
        data.chatId || '',
        data.sender || '',
        data.pushName || '',
        data.msgType || 'text',
        data.content || '',
        data.hasMedia ? 1 : 0,
        data.timestamp || Date.now(),
        Date.now()
    );
}

export function getMessage(msgId) {
    return getDB().prepare('SELECT * FROM message_cache WHERE msg_id = ?').get(msgId) || null;
}

export function deleteMessage(msgId) {
    getDB().prepare('DELETE FROM message_cache WHERE msg_id = ?').run(msgId);
    getDB().prepare('DELETE FROM media_cache WHERE msg_id = ?').run(msgId);
}

export function getCacheSize() {
    return getDB().prepare('SELECT COUNT(*) as n FROM message_cache').get().n;
}

export function cleanOldMessages(maxAgeMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    const result = getDB().prepare('DELETE FROM message_cache WHERE timestamp < ?').run(cutoff);
    getDB().prepare(`
        DELETE FROM media_cache WHERE msg_id NOT IN (SELECT msg_id FROM message_cache)
    `).run();
    return result.changes;
}

// ─── Media Cache ──────────────────────────────────────────────────────────────

export function cacheMedia(msgId, data) {
    getDB().prepare(`
        INSERT OR REPLACE INTO media_cache
            (msg_id, file_path, media_type, mimetype, file_size, saved_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        msgId,
        data.filePath || '',
        data.type || '',
        data.mimetype || '',
        data.size || 0,
        Date.now()
    );
}

export function getMedia(msgId) {
    return getDB().prepare('SELECT * FROM media_cache WHERE msg_id = ?').get(msgId) || null;
}

export function getMediaCacheSize() {
    return getDB().prepare('SELECT COUNT(*) as n FROM media_cache').get().n;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/**
 * Check if a user is rate-limited for a command.
 * Returns true if they should be blocked, false if allowed.
 */
export function checkRateLimit(userJid, command, maxHits = 5, windowMs = 60000) {
    const d = getDB();
    const now = Date.now();
    const windowStart = now - windowMs;

    const row = d.prepare(
        'SELECT * FROM rate_limits WHERE user_jid = ? AND command = ?'
    ).get(userJid, command);

    if (!row || row.window_start < windowStart) {
        // First hit or window expired — reset
        d.prepare(`
            INSERT OR REPLACE INTO rate_limits (user_jid, command, hit_count, window_start)
            VALUES (?, ?, 1, ?)
        `).run(userJid, command, now);
        return false; // not rate limited
    }

    if (row.hit_count >= maxHits) {
        return true; // rate limited
    }

    d.prepare(`
        UPDATE rate_limits SET hit_count = hit_count + 1 WHERE user_jid = ? AND command = ?
    `).run(userJid, command);
    return false;
}

export function getRateLimitCount(userJid, command) {
    const row = getDB().prepare(
        'SELECT hit_count FROM rate_limits WHERE user_jid = ? AND command = ?'
    ).get(userJid, command);
    return row ? row.hit_count : 0;
}

// ─── View-Once Log ────────────────────────────────────────────────────────────

export function logViewOnce(data) {
    getDB().prepare(`
        INSERT INTO viewonce_log (sender, media_type, caption, file_path, detected_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        data.sender || '',
        data.mediaType || '',
        data.caption || '',
        data.filePath || '',
        Date.now()
    );
}

export function getViewOnceHistory(limit = 50) {
    return getDB().prepare(
        'SELECT * FROM viewonce_log ORDER BY detected_at DESC LIMIT ?'
    ).all(limit);
}

export function cleanViewOnceLog(maxAgeMs = 48 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    return getDB().prepare('DELETE FROM viewonce_log WHERE detected_at < ?').run(cutoff).changes;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getCacheStats() {
    const d = getDB();
    return {
        messages: d.prepare('SELECT COUNT(*) as n FROM message_cache').get().n,
        media:    d.prepare('SELECT COUNT(*) as n FROM media_cache').get().n,
        rateLimits: d.prepare('SELECT COUNT(*) as n FROM rate_limits').get().n,
        viewonce: d.prepare('SELECT COUNT(*) as n FROM viewonce_log').get().n
    };
}
