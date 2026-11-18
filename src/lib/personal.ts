// Parties perso des comptes liés : l'API ne donne que les 25 dernières, on les
// accumule donc à chaque visite et à chaque collecte.

import { getDb } from "./db.ts";

type BattleItem = {
  battleTime: string;
  event: { id?: number; mode?: string };
  battle: {
    mode?: string;
    type?: string;
    result?: string;
    teams?: { tag: string; brawler: { id: number } }[][];
  };
};

/** Types de parties retenus pour les stats perso (classé et trophées). */
const TYPES = ["soloRanked", "ranked"];
const DAY = 86_400_000;

function parseBattleTime(s: string): number {
  return Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 11)}:${s.slice(11, 13)}:${s.slice(13)}`);
}

/** Enregistre les parties 3v3 gagnées/perdues du joueur. Renvoie le nombre de nouvelles. */
export function storePersonalBattles(tag: string, items: BattleItem[]): number {
  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO player_battles(tag, battle_key, time, type, mode, map_id, brawler_id, won) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  let added = 0;
  for (const { battleTime, event, battle } of items) {
    const mode = event.mode && event.mode !== "unknown" ? event.mode : battle.mode;
    if (!mode || /showdown/i.test(mode) || !TYPES.includes(battle.type ?? "")) continue;
    if (battle.result !== "victory" && battle.result !== "defeat") continue;
    const me = battle.teams?.flat().find((p) => p.tag === tag);
    if (!me) continue;
    const r = insert.run(
      tag,
      battleTime,
      parseBattleTime(battleTime),
      battle.type!,
      mode,
      event.id ?? null,
      me.brawler.id,
      battle.result === "victory" ? 1 : 0,
    );
    added += Number(r.changes);
  }
  return added;
}

export function trackPlayer(tag: string): void {
  getDb().prepare("INSERT OR IGNORE INTO tracked_players(tag, added) VALUES (?, ?)").run(tag, Date.now());
}

export function trackedPlayers(): string[] {
  return (getDb().prepare("SELECT tag FROM tracked_players").all() as { tag: string }[]).map((r) => r.tag);
}

export type PersonalStats = {
  games: number;
  wins: number;
  byBrawler: Map<number, { games: number; wins: number }>;
};

/** Bilan perso sur les `days` derniers jours, toutes files confondues. */
export function personalStats(tag: string, days = 90): PersonalStats {
  const rows = getDb()
    .prepare(
      "SELECT brawler_id AS id, COUNT(*) AS games, SUM(won) AS wins FROM player_battles WHERE tag = ? AND time >= ? GROUP BY brawler_id",
    )
    .all(tag, Date.now() - days * DAY) as { id: number; games: number; wins: number }[];
  const byBrawler = new Map(rows.map((r) => [r.id, { games: r.games, wins: r.wins }]));
  return {
    games: rows.reduce((s, r) => s + r.games, 0),
    wins: rows.reduce((s, r) => s + r.wins, 0),
    byBrawler,
  };
}
