import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type KeyRecord = {
  id: string;
  name: string;
  tag_payload: string;
  status: 'available' | 'checked_out';
  last_holder_id: string | null;
  created_at: string;
  updated_at: string;
  last_holder_name?: string | null;
};

export type HolderRecord = {
  id: string;
  name: string;
  created_at: string;
};

export class Repo {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  init() {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf-8') : SCHEMA_SQL;
    this.db.exec(schema);
  }

  listKeys(): KeyRecord[] {
    const stmt = this.db.prepare(`
      SELECT keys.*, holders.name AS last_holder_name
      FROM keys
      LEFT JOIN holders ON holders.id = keys.last_holder_id
      ORDER BY keys.name ASC
    `);
    return stmt.all() as KeyRecord[];
  }

  listHolders(): HolderRecord[] {
    const stmt = this.db.prepare(`SELECT * FROM holders ORDER BY name ASC`);
    return stmt.all() as HolderRecord[];
  }

  createKey(name: string): KeyRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO keys (id, name, tag_payload, status, last_holder_id, created_at, updated_at)
      VALUES (@id, @name, @tag_payload, @status, @last_holder_id, @created_at, @updated_at)
    `);
    stmt.run({
      id,
      name,
      tag_payload: id,
      status: 'available',
      last_holder_id: null,
      created_at: now,
      updated_at: now,
    });
    return this.getKeyById(id)!;
  }

  createHolder(name: string): HolderRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO holders (id, name, created_at)
      VALUES (@id, @name, @created_at)
    `);
    stmt.run({ id, name, created_at: now });
    return this.getHolderById(id)!;
  }

  checkOut(keyId: string, holderId: string) {
    const now = new Date().toISOString();
    const update = this.db.prepare(`
      UPDATE keys
      SET status = 'checked_out',
          last_holder_id = @holder_id,
          updated_at = @updated_at
      WHERE id = @key_id
    `);
    update.run({ key_id: keyId, holder_id: holderId, updated_at: now });
    this.insertEvent(keyId, holderId, 'check_out', now);
    return this.getKeyById(keyId);
  }

  checkIn(keyId: string) {
    const now = new Date().toISOString();
    const update = this.db.prepare(`
      UPDATE keys
      SET status = 'available',
          last_holder_id = NULL,
          updated_at = @updated_at
      WHERE id = @key_id
    `);
    update.run({ key_id: keyId, updated_at: now });
    this.insertEvent(keyId, null, 'check_in', now);
    return this.getKeyById(keyId);
  }

  findKeyByTag(tagPayload: string) {
    const stmt = this.db.prepare(`SELECT * FROM keys WHERE tag_payload = @tag_payload LIMIT 1`);
    return stmt.get({ tag_payload: tagPayload }) as KeyRecord | undefined;
  }

  private insertEvent(keyId: string, holderId: string | null, action: string, now: string) {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, key_id, holder_id, action, created_at)
      VALUES (@id, @key_id, @holder_id, @action, @created_at)
    `);
    stmt.run({
      id: randomUUID(),
      key_id: keyId,
      holder_id: holderId,
      action,
      created_at: now,
    });
  }

  private getKeyById(id: string) {
    const stmt = this.db.prepare(`SELECT * FROM keys WHERE id = @id`);
    return stmt.get({ id }) as KeyRecord | undefined;
  }

  private getHolderById(id: string) {
    const stmt = this.db.prepare(`SELECT * FROM holders WHERE id = @id`);
    return stmt.get({ id }) as HolderRecord | undefined;
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS holders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  last_holder_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_holder_id) REFERENCES holders(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  holder_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (key_id) REFERENCES keys(id),
  FOREIGN KEY (holder_id) REFERENCES holders(id)
);
`;
