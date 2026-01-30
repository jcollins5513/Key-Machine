import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

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

export type UserRecord = {
  id: string;
  first_name: string;
  last_name: string;
  first_initial: string;
  department: string | null;
  position: string | null;
  allowed_checkout: number;
  is_admin: number;
  created_at: string;
  updated_at: string;
};

type UserAuthRecord = UserRecord & {
  pin_salt: string;
  pin_hash: string;
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
      SELECT keys.*, users.first_name || ' ' || users.last_name AS last_holder_name
      FROM keys
      LEFT JOIN users ON users.id = keys.last_holder_id
      ORDER BY keys.name ASC
    `);
    return stmt.all() as KeyRecord[];
  }

  listUsers(): UserRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, first_name, last_name, first_initial, department, position, allowed_checkout, is_admin, created_at, updated_at
      FROM users
      ORDER BY last_name ASC, first_name ASC
    `);
    return stmt.all() as UserRecord[];
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

  createUser(input: {
    first_name: string;
    last_name: string;
    department?: string | null;
    position?: string | null;
    pin: string;
    allowed_checkout: number;
    is_admin: boolean;
  }): UserRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const firstInitial = input.first_name.trim().charAt(0).toLowerCase();
    const { salt, hash } = hashPin(input.pin);
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, first_name, last_name, first_initial, department, position,
        pin_salt, pin_hash, allowed_checkout, is_admin, created_at, updated_at
      )
      VALUES (
        @id, @first_name, @last_name, @first_initial, @department, @position,
        @pin_salt, @pin_hash, @allowed_checkout, @is_admin, @created_at, @updated_at
      )
    `);
    stmt.run({
      id,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      first_initial: firstInitial,
      department: input.department ?? null,
      position: input.position ?? null,
      pin_salt: salt,
      pin_hash: hash,
      allowed_checkout: input.allowed_checkout,
      is_admin: input.is_admin ? 1 : 0,
      created_at: now,
      updated_at: now,
    });
    return this.getUserById(id)!;
  }

  updateUser(
    id: string,
    updates: Partial<{
      first_name: string;
      last_name: string;
      department: string | null;
      position: string | null;
      allowed_checkout: number;
      is_admin: boolean;
    }>
  ) {
    const now = new Date().toISOString();
    const existing = this.getUserById(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const nextFirstName = updates.first_name?.trim() ?? existing.first_name;
    const nextLastName = updates.last_name?.trim() ?? existing.last_name;
    const nextInitial = nextFirstName.charAt(0).toLowerCase();
    const stmt = this.db.prepare(`
      UPDATE users
      SET first_name = @first_name,
          last_name = @last_name,
          first_initial = @first_initial,
          department = @department,
          position = @position,
          allowed_checkout = @allowed_checkout,
          is_admin = @is_admin,
          updated_at = @updated_at
      WHERE id = @id
    `);
    stmt.run({
      id,
      first_name: nextFirstName,
      last_name: nextLastName,
      first_initial: nextInitial,
      department: updates.department ?? existing.department,
      position: updates.position ?? existing.position,
      allowed_checkout: updates.allowed_checkout ?? existing.allowed_checkout,
      is_admin: typeof updates.is_admin === 'boolean' ? (updates.is_admin ? 1 : 0) : existing.is_admin,
      updated_at: now,
    });
    return this.getUserById(id)!;
  }

  checkOut(keyId: string, userId: string) {
    const now = new Date().toISOString();
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const checkedOutCount = this.countCheckedOut(userId);
    if (checkedOutCount >= user.allowed_checkout) {
      throw new Error(`Checkout limit reached (${user.allowed_checkout}).`);
    }

    const update = this.db.prepare(`
      UPDATE keys
      SET status = 'checked_out',
          last_holder_id = @holder_id,
          updated_at = @updated_at
      WHERE id = @key_id
    `);
    update.run({ key_id: keyId, holder_id: userId, updated_at: now });
    this.insertEvent(keyId, userId, 'check_out', now);
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

  login(initial: string, lastName: string, pin: string): UserRecord {
    const user = this.getUserByLogin(initial, lastName);
    if (!user) {
      throw new Error('User not found');
    }
    if (!verifyPin(pin, user.pin_salt, user.pin_hash)) {
      throw new Error('Invalid PIN');
    }
    return stripAuth(user);
  }

  updatePin(userId: string, currentPin: string, newPin: string) {
    const user = this.getUserByLoginId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (!verifyPin(currentPin, user.pin_salt, user.pin_hash)) {
      throw new Error('Current PIN is incorrect');
    }
    const { salt, hash } = hashPin(newPin);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE users
      SET pin_salt = @pin_salt,
          pin_hash = @pin_hash,
          updated_at = @updated_at
      WHERE id = @id
    `);
    stmt.run({ id: userId, pin_salt: salt, pin_hash: hash, updated_at: now });
    return this.getUserById(userId)!;
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

  private getUserById(id: string) {
    const stmt = this.db.prepare(`
      SELECT id, first_name, last_name, first_initial, department, position, allowed_checkout, is_admin, created_at, updated_at
      FROM users
      WHERE id = @id
    `);
    return stmt.get({ id }) as UserRecord | undefined;
  }

  private getUserByLogin(initial: string, lastName: string) {
    const stmt = this.db.prepare(`
      SELECT *
      FROM users
      WHERE lower(first_initial) = @initial
        AND lower(last_name) = @last_name
      LIMIT 1
    `);
    return stmt.get({
      initial: initial.trim().toLowerCase(),
      last_name: lastName.trim().toLowerCase(),
    }) as UserAuthRecord | undefined;
  }

  private getUserByLoginId(id: string) {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = @id`);
    return stmt.get({ id }) as UserAuthRecord | undefined;
  }

  private countCheckedOut(userId: string) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM keys
      WHERE status = 'checked_out' AND last_holder_id = @user_id
    `);
    return (stmt.get({ user_id: userId }) as { count: number }).count;
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS holders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_initial TEXT NOT NULL,
  department TEXT,
  position TEXT,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  allowed_checkout INTEGER NOT NULL,
  is_admin INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  last_holder_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_holder_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  holder_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (key_id) REFERENCES keys(id),
  FOREIGN KEY (holder_id) REFERENCES users(id)
);
`;

const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256').toString('hex');
  return { salt, hash };
};

const verifyPin = (pin: string, salt: string, hash: string) => {
  const candidate = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  const actual = Buffer.from(hash, 'hex');
  if (candidate.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(candidate, actual);
};

const stripAuth = (user: UserAuthRecord): UserRecord => ({
  id: user.id,
  first_name: user.first_name,
  last_name: user.last_name,
  first_initial: user.first_initial,
  department: user.department,
  position: user.position,
  allowed_checkout: user.allowed_checkout,
  is_admin: user.is_admin,
  created_at: user.created_at,
  updated_at: user.updated_at,
});
