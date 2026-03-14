import * as SQLite from "expo-sqlite";

/**
 * Vault SQLite database — metadata for albums and encrypted files.
 *
 * Tables:
 * - albums: id, name, created_at
 * - files: id, album_id, name, mime, size, encrypted_key, file_path, created_at
 * - vault_logs: id, event, timestamp
 */

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("vault.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY NOT NULL,
      album_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      encrypted_key TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vault_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
  return db;
}

export async function dropAllTables(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`
    DROP TABLE IF EXISTS vault_logs;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS albums;
  `);
  db = null;
}

// ─── Albums ──────────────────────────────────────────────

export type Album = {
  id: string;
  name: string;
  created_at: number;
};

export type AlbumWithCount = Album & { file_count: number };

export async function getAlbums(): Promise<AlbumWithCount[]> {
  const database = await getDB();
  const results = await database.getAllAsync<AlbumWithCount>(
    `SELECT a.*, COUNT(f.id) as file_count
     FROM albums a
     LEFT JOIN files f ON f.album_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  );
  return results;
}

export async function getAlbumsByMimeType(
  mimePrefix: string,
): Promise<AlbumWithCount[]> {
  const database = await getDB();
  return await database.getAllAsync<AlbumWithCount>(
    `SELECT a.*, COUNT(f.id) as file_count
     FROM albums a
     LEFT JOIN files f ON f.album_id = a.id
     WHERE EXISTS (
       SELECT 1 FROM files f2
       WHERE f2.album_id = a.id
       AND f2.mime LIKE ?
     )
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [`${mimePrefix}%`],
  );
}

export async function getAlbumsWithDocs(): Promise<AlbumWithCount[]> {
  const database = await getDB();
  return await database.getAllAsync<AlbumWithCount>(
    `SELECT a.*, COUNT(f.id) as file_count
     FROM albums a
     LEFT JOIN files f ON f.album_id = a.id
     WHERE EXISTS (
       SELECT 1 FROM files f2
       WHERE f2.album_id = a.id
       AND f2.mime NOT LIKE 'image/%'
       AND f2.mime NOT LIKE 'video/%'
     )
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  );
}

export async function createAlbum(id: string, name: string): Promise<void> {
  const database = await getDB();
  await database.runAsync("INSERT INTO albums (id, name) VALUES (?, ?)", [
    id,
    name,
  ]);
}

export async function deleteAlbum(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM albums WHERE id = ?", [id]);
}

export async function getAlbumCount(): Promise<number> {
  const database = await getDB();
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM albums",
  );
  return result?.count ?? 0;
}

// ─── Files ──────────────────────────────────────────────

export type VaultFile = {
  id: string;
  album_id: string;
  name: string;
  mime: string;
  size: number;
  encrypted_key: string;
  file_path: string;
  created_at: number;
};

export async function getFilesByAlbum(albumId: string): Promise<VaultFile[]> {
  const database = await getDB();
  return await database.getAllAsync<VaultFile>(
    "SELECT * FROM files WHERE album_id = ? ORDER BY created_at DESC",
    [albumId],
  );
}

export async function createFile(
  file: Omit<VaultFile, "created_at">,
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    "INSERT INTO files (id, album_id, name, mime, size, encrypted_key, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      file.id,
      file.album_id,
      file.name,
      file.mime,
      file.size,
      file.encrypted_key,
      file.file_path,
    ],
  );
}

export async function deleteFile(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM files WHERE id = ?", [id]);
}

export async function renameFile(id: string, name: string): Promise<void> {
  const database = await getDB();
  await database.runAsync("UPDATE files SET name = ? WHERE id = ?", [name, id]);
}

export async function moveFileToAlbum(
  id: string,
  albumId: string,
): Promise<void> {
  const database = await getDB();
  await database.runAsync("UPDATE files SET album_id = ? WHERE id = ?", [
    albumId,
    id,
  ]);
}

export async function getFileCount(): Promise<number> {
  const database = await getDB();
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM files",
  );
  return result?.count ?? 0;
}

// ─── Logs ──────────────────────────────────────────────

export type VaultLog = {
  id: number;
  event: string;
  details: string | null;
  timestamp: number;
};

export async function addLog(event: string, details?: string): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    "INSERT INTO vault_logs (event, details) VALUES (?, ?)",
    [event, details ?? null],
  );
}

export async function getLogs(limit: number = 20): Promise<VaultLog[]> {
  const database = await getDB();
  return await database.getAllAsync<VaultLog>(
    "SELECT * FROM vault_logs ORDER BY timestamp DESC LIMIT ?",
    [limit],
  );
}

export async function clearLogs(): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM vault_logs");
}

// ─── Nuke ──────────────────────────────────────────────

export async function nukeDatabase(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`
    DELETE FROM files;
    DELETE FROM albums;
    DELETE FROM vault_logs;
  `);
}

export async function closeDB(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
