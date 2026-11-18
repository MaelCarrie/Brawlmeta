// Calculs de statistiques à partir des parties collectées.
// Toutes les fenêtres temporelles sont ancrées sur la partie la plus récente
// de la base, pour que des données un peu anciennes restent exploitables.

import { getDb, getMeta } from "./db.ts";
import { DAY_OPTIONS, queueType, type Filter, type Queue } from "./format.ts";

export { DAY_OPTIONS };
export type { Filter, Queue };

// node:sqlite renvoie des objets sans prototype, que React ne peut pas
// transmettre aux composants client : on les recopie en objets simples.
const plain = <T,>(rows: unknown[]): T[] => rows.map((r) => ({ ...(r as object) }) as T);

const DAY = 86_400_000;

// Les données ne changent qu'à chaque collecte : on garde les résultats en
// mémoire tant que `data_version` (mis à jour par la collecte) est le même.
const cache = new Map<string, unknown>();
let cacheVersion: string | null = null;
function memo<T>(key: string, compute: () => T): T {
  const version = getMeta("data_version") ?? "";
  if (version !== cacheVersion) {
    cache.clear();
    cacheVersion = version;
  }
  if (!cache.has(key)) cache.set(key, compute());
  return cache.get(key) as T;
}

export const DEFAULT_DAYS = Number(process.env.BS_DEFAULT_DAYS ?? 14);

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseDays(value: string | string[] | undefined): number {
  const n = Number(first(value));
  return (DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_DAYS;
}

export function parseQueue(value: string | string[] | undefined): Queue {
  return first(value) === "trophees" ? "trophees" : "classe";
}

/** Lit ?days=, ?file= (classe | trophees) et ?mode= dans l'URL. */
export function parseFilter(sp: SearchParams): Filter {
  const mode = first(sp.mode);
  return {
    days: parseDays(sp.days),
    queue: parseQueue(sp.file),
    mode: mode && /^[a-zA-Z]{2,30}$/.test(mode) ? mode : null,
  };
}

const key = (f: Filter) => `${f.days}:${f.queue}:${f.mode ?? ""}`;

/** Moyenne bayésienne : tire le taux de victoire vers `prior` quand il y a peu de parties. */
export function shrink(wins: number, games: number, prior: number, k: number): number {
  return (wins + prior * k) / (games + k);
}

function windowStart(days: number): number {
  return memo(`windowStart:${days}`, () => {
    const row = getDb().prepare("SELECT MAX(time) AS t FROM battles").get() as { t: number | null };
    return row.t ? row.t - days * DAY : 0;
  });
}

/** Conditions SQL communes (période, file, mode) sur une table qui a time/type/mode. */
function where(alias: string, f: Filter, extra: { mapId?: number; withShowdown?: boolean } = {}) {
  const parts = [`${alias}.time >= ?`, `${alias}.type = ?`];
  const args: (string | number)[] = [windowStart(f.days), queueType(f.queue)];
  if (extra.mapId) {
    parts.push(`${alias}.map_id = ?`);
    args.push(extra.mapId);
  } else if (f.mode) {
    parts.push(`${alias}.mode = ?`);
    args.push(f.mode);
  } else if (!extra.withShowdown) {
    // « Tous les modes » = les modes en équipes. Survivant (classement au lieu
    // de victoire/défaite) ne se consulte qu'avec le filtre de mode.
    parts.push(`${alias}.mode NOT LIKE '%howdown'`);
  }
  return { sql: parts.join(" AND "), args };
}

export type Overview = {
  battles: number;
  firstTime: number | null;
  lastTime: number | null;
  demo: boolean;
  lastCollect: number | null;
};

export function overview(f: Filter): Overview {
  const w = where("b", f);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n, MIN(time) AS first, MAX(time) AS last FROM battles b WHERE ${w.sql}`)
    .get(...w.args) as { n: number; first: number | null; last: number | null };
  const lastCollect = getMeta("last_collect");
  return {
    battles: row.n,
    firstTime: row.first,
    lastTime: row.last,
    demo: getMeta("demo") === "1",
    lastCollect: lastCollect ? Number(lastCollect) : null,
  };
}

export type Tier = "S" | "A" | "B" | "C" | "D";

export type BrawlerStat = {
  id: number;
  name: string;
  games: number;
  wins: number;
  winRate: number;
  /** Taux de victoire ajusté (moyenne bayésienne), utilisé pour les classements. */
  adj: number;
  /** Part des parties où le brawler est présent (dans une des deux équipes). */
  pickRate: number;
  tier: Tier | null;
};

const TIER_CUTS: [Tier, number][] = [
  ["S", 0.1],
  ["A", 0.3],
  ["B", 0.6],
  ["C", 0.85],
  ["D", 1],
];

function assignTiers(stats: BrawlerStat[], minGames: number): void {
  const eligible = stats.filter((s) => s.games >= minGames).sort((a, b) => b.adj - a.adj);
  eligible.forEach((s, i) => {
    const q = (i + 1) / eligible.length;
    s.tier = TIER_CUTS.find(([, cut]) => q <= cut)![0];
  });
}

function battleCount(f: Filter, mapId?: number): number {
  const w = where("b", f, { mapId });
  return (
    getDb().prepare(`SELECT COUNT(*) AS n FROM battles b WHERE ${w.sql} AND b.winner IS NOT NULL`).get(...w.args) as {
      n: number;
    }
  ).n;
}

/**
 * Stats par brawler, globales, par mode ou sur une map. Sur un mode ou une map,
 * le taux ajusté est tiré vers le taux global du brawler (et pas vers 50 %),
 * ce qui stabilise les petits échantillons.
 */
export function brawlerStats(f: Filter, mapId?: number): BrawlerStat[] {
  return memo(`brawlerStats:${key(f)}:${mapId ?? ""}`, () => {
    const total = battleCount(f, mapId);
    const w = where("bp", f, { mapId });
    const rows = getDb()
      .prepare(
        `SELECT bp.brawler_id AS id, COALESCE(br.name, 'BRAWLER ' || bp.brawler_id) AS name,
                COUNT(*) AS games, SUM(bp.won) AS wins
           FROM battle_players bp
           LEFT JOIN brawlers br ON br.id = bp.brawler_id
          WHERE ${w.sql} AND bp.decided = 1
          GROUP BY bp.brawler_id`,
      )
      .all(...w.args) as { id: number; name: string; games: number; wins: number }[];

    const narrowed = Boolean(mapId || f.mode);
    const global = narrowed ? new Map(brawlerStats({ ...f, mode: null }).map((s) => [s.id, s.adj])) : null;

    const stats: BrawlerStat[] = rows.map((r) => ({
      ...r,
      winRate: r.wins / r.games,
      adj: global ? shrink(r.wins, r.games, global.get(r.id) ?? 0.5, 20) : shrink(r.wins, r.games, 0.5, 50),
      pickRate: total ? r.games / total : 0,
      tier: null,
    }));
    assignTiers(stats, mapId ? Math.max(5, Math.round(total * 0.02)) : Math.max(20, Math.round(total * 0.005)));
    return stats.sort((a, b) => b.adj - a.adj);
  });
}

export type MapRow = { id: number; name: string; mode: string; games: number };

/** Maps jouées sur la période (= pool de maps actuel), triées par mode. */
export function mapPool(f: Filter, minGames = 10): MapRow[] {
  return memo(`mapPool:${key(f)}:${minGames}`, () => {
    const w = where("b", f, { withShowdown: true });
    const rows = getDb()
      .prepare(
        `SELECT m.id, m.name, m.mode, COUNT(*) AS games
           FROM battles b JOIN maps m ON m.id = b.map_id
          WHERE ${w.sql}
          GROUP BY m.id HAVING games >= ?
          ORDER BY m.mode, games DESC`,
      )
      .all(...w.args, minGames);
    return plain<MapRow>(rows);
  });
}

export function mapInfo(id: number): { id: number; name: string; mode: string } | null {
  const row = getDb().prepare("SELECT id, name, mode FROM maps WHERE id = ?").get(id);
  return row ? { ...(row as { id: number; name: string; mode: string }) } : null;
}

export function brawlerInfo(id: number): { id: number; name: string } | null {
  const row = getDb().prepare("SELECT id, name FROM brawlers WHERE id = ?").get(id);
  return row ? { ...(row as { id: number; name: string }) } : null;
}

export function allBrawlers(): { id: number; name: string }[] {
  return plain<{ id: number; name: string }>(getDb().prepare("SELECT id, name FROM brawlers ORDER BY name").all());
}

export type CompStat = {
  ids: number[];
  games: number;
  wins: number;
  winRate: number;
  adj: number;
};

/** Compos de 3 brawlers sur une map, avec filtres optionnels (inclure / exclure). */
export function compStats(
  f: Filter,
  mapId: number,
  opts: { minGames?: number; limit?: number; include?: number[]; exclude?: number[] } = {},
): CompStat[] {
  const minGames = opts.minGames ?? 3;
  const all = memo(`comps:${key(f)}:${mapId}:${minGames}`, () => {
    const w = where("b", f, { mapId });
    const rows = getDb()
      .prepare(
        `SELECT bt.comp, COUNT(*) AS games, SUM(bt.won) AS wins
           FROM battle_teams bt JOIN battles b ON b.id = bt.battle_id
          WHERE ${w.sql} AND b.winner IS NOT NULL
          GROUP BY bt.comp HAVING games >= ?`,
      )
      .all(...w.args, minGames) as { comp: string; games: number; wins: number }[];
    return rows
      .map((r) => ({
        ids: r.comp.split("-").map(Number),
        games: r.games,
        wins: r.wins,
        winRate: r.wins / r.games,
        adj: shrink(r.wins, r.games, 0.5, 10),
      }))
      .sort((a, b) => b.adj - a.adj);
  });

  const include = opts.include ?? [];
  const exclude = new Set(opts.exclude ?? []);
  return all
    .filter((c) => include.every((id) => c.ids.includes(id)) && !c.ids.some((id) => exclude.has(id)))
    .slice(0, opts.limit ?? 10);
}

export type PairRow = { id: number; games: number; wins: number };

/**
 * Parties de `id` avec (sameTeam) ou contre (!sameTeam) chaque autre brawler.
 * `wins` est toujours compté du point de vue de `id`.
 */
export function pairStats(id: number, f: Filter, sameTeam: boolean, mapId?: number): PairRow[] {
  // Une seule requête pour les coéquipiers et les adversaires, gardée en cache.
  const both = memo(`pairs:${id}:${key(f)}:${mapId ?? ""}`, () => {
    const w = where("p1", f, { mapId });
    const rows = getDb()
      .prepare(
        `SELECT p2.brawler_id AS id, p2.team = p1.team AS same, COUNT(*) AS games, SUM(p1.won) AS wins
           FROM battle_players p1
           JOIN battle_players p2 ON p2.battle_id = p1.battle_id AND p2.brawler_id <> p1.brawler_id
          WHERE p1.brawler_id = ? AND p1.decided = 1 AND ${w.sql}
          GROUP BY p2.brawler_id, same`,
      )
      .all(id, ...w.args) as (PairRow & { same: number })[];
    const pick = (same: number) =>
      rows.filter((r) => r.same === same).map((r) => ({ id: r.id, games: r.games, wins: r.wins }));
    return { same: pick(1), opp: pick(0) };
  });
  return sameTeam ? both.same : both.opp;
}

export type BrawlerMapRow = MapRow & { wins: number; adj: number; pickRate: number };

/** Performances d'un brawler sur chaque map du pool. */
export function brawlerMaps(id: number, f: Filter): BrawlerMapRow[] {
  const globalAdj = brawlerStats({ ...f, mode: null }).find((s) => s.id === id)?.adj ?? 0.5;
  const totals = new Map(mapPool(f, 1).map((m) => [m.id, m.games]));
  const w = where("bp", f);
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.name, m.mode, COUNT(*) AS games, SUM(bp.won) AS wins
         FROM battle_players bp
         JOIN maps m ON m.id = bp.map_id
        WHERE bp.brawler_id = ? AND bp.decided = 1 AND ${w.sql}
        GROUP BY m.id`,
    )
    .all(id, ...w.args) as (MapRow & { wins: number })[];
  return rows
    .map((r) => ({
      ...r,
      adj: shrink(r.wins, r.games, globalAdj, 20),
      pickRate: r.games / (totals.get(r.id) ?? r.games),
    }))
    .sort((a, b) => b.adj - a.adj);
}

/** Modes joués dans la file choisie sur la période, du plus joué au moins joué. */
export function availableModes(f: Filter): string[] {
  return memo(`modes:${f.days}:${f.queue}`, () => {
    const w = where("b", { ...f, mode: null }, { withShowdown: true });
    return (
      getDb()
        .prepare(`SELECT b.mode, COUNT(*) AS n FROM battles b WHERE ${w.sql} GROUP BY b.mode HAVING n >= 50 ORDER BY n DESC`)
        .all(...w.args) as { mode: string }[]
    )
      .map((r) => r.mode)
      // Les modes Survivant en dernier, après les modes en équipes.
      .sort((a, b) => Number(/howdown/i.test(a)) - Number(/howdown/i.test(b)));
  });
}
