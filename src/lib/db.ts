import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS brawlers (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS maps (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS battles (
  id     TEXT PRIMARY KEY,
  time   INTEGER NOT NULL,
  type   TEXT NOT NULL,
  mode   TEXT NOT NULL,
  map_id INTEGER NOT NULL,
  winner INTEGER
);
CREATE INDEX IF NOT EXISTS battles_time ON battles(time);
CREATE INDEX IF NOT EXISTS battles_type ON battles(type, time);
CREATE INDEX IF NOT EXISTS battles_map ON battles(map_id, time);

CREATE TABLE IF NOT EXISTS battle_players (
  battle_id  TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  team       INTEGER NOT NULL,
  brawler_id INTEGER NOT NULL,
  won        INTEGER NOT NULL,
  -- Copies de colonnes de battles, pour éviter une jointure coûteuse dans
  -- les calculs de stats (decided = la partie n'est pas un match nul).
  time       INTEGER,
  map_id     INTEGER,
  decided    INTEGER,
  type       TEXT,
  mode       TEXT,
  PRIMARY KEY (battle_id, team, brawler_id)
);
CREATE INDEX IF NOT EXISTS bp_brawler ON battle_players(brawler_id);

CREATE TABLE IF NOT EXISTS battle_teams (
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  team      INTEGER NOT NULL,
  comp      TEXT NOT NULL,
  won       INTEGER NOT NULL,
  PRIMARY KEY (battle_id, team)
);
CREATE INDEX IF NOT EXISTS bt_comp ON battle_teams(comp);

CREATE TABLE IF NOT EXISTS players (
  tag          TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  last_fetched INTEGER
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Comptes liés sur le site : leurs parties sont gardées pour les stats perso.
CREATE TABLE IF NOT EXISTS tracked_players (
  tag   TEXT PRIMARY KEY,
  added INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_battles (
  tag        TEXT NOT NULL,
  battle_key TEXT NOT NULL,
  time       INTEGER NOT NULL,
  type       TEXT NOT NULL,
  mode       TEXT NOT NULL,
  map_id     INTEGER,
  brawler_id INTEGER NOT NULL,
  won        INTEGER NOT NULL,
  PRIMARY KEY (tag, battle_key)
);
`;

export function dbPath(): string {
  return process.env.BS_DB_PATH ?? path.join(process.cwd(), "data", "brawl.db");
}

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (instance) return instance;
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  instance = db;
  return db;
}

function migrate(db: DatabaseSync): void {
  const cols = (db.prepare("PRAGMA table_info(battle_players)").all() as { name: string }[]).map((c) => c.name);
  const missing = [
    ["time", "INTEGER"],
    ["map_id", "INTEGER"],
    ["decided", "INTEGER"],
    ["type", "TEXT"],
    ["mode", "TEXT"],
  ].filter(([name]) => !cols.includes(name));
  if (missing.length) {
    for (const [name, sqlType] of missing) db.exec(`ALTER TABLE battle_players ADD COLUMN ${name} ${sqlType}`);
    db.exec(`
      UPDATE battle_players SET (time, map_id, decided, type, mode) =
        (SELECT b.time, b.map_id, b.winner IS NOT NULL, b.type, b.mode FROM battles b WHERE b.id = battle_players.battle_id);
    `);
  }
  // Index couvrants : les stats se calculent sans lire la table elle-même.
  db.exec(`
    DROP INDEX IF EXISTS bp_window;
    DROP INDEX IF EXISTS bp_brawler_time;
    DROP INDEX IF EXISTS bp_brawler_stats;
    DROP INDEX IF EXISTS bp_brawler_stats2;
    DROP INDEX IF EXISTS bp_map_stats;
    CREATE INDEX IF NOT EXISTS bp_by_brawler ON battle_players(brawler_id, type, decided, time, mode, won, map_id);
    CREATE INDEX IF NOT EXISTS bp_by_map ON battle_players(map_id, type, decided, time, brawler_id, won);
  `);
}

/** Change à chaque collecte : sert à invalider le cache des stats. */
export function bumpDataVersion(): void {
  setMeta("data_version", String(Date.now()));
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

/** Supprime toutes les parties (utilisé pour remplacer les données de démo). */
export function clearBattles(): void {
  const db = getDb();
  db.exec("DELETE FROM battle_teams; DELETE FROM battle_players; DELETE FROM battles;");
}
