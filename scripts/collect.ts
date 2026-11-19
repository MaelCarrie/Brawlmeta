// Collecte les parties classées des meilleurs joueurs via l'API officielle Brawl Stars.
// Usage : npm run collect
// Nécessite BS_API_KEY dans .env (clé créée sur https://developer.brawlstars.com
// pour l'adresse IP de la machine qui lance ce script).

import { createHash } from "node:crypto";
import { bumpDataVersion, clearBattles, getDb, getMeta, setMeta } from "../src/lib/db.ts";
import { apiFetch, hasApiKey } from "../src/lib/api-key.ts";
import { storePersonalBattles, trackedPlayers } from "../src/lib/personal.ts";
import { updateNames } from "./update-names.ts";

const API = "https://api.brawlstars.com/v1";

const BATTLE_TYPES = (process.env.BS_BATTLE_TYPES ?? "soloRanked,ranked").split(",").map((s) => s.trim());
const COUNTRIES = (process.env.BS_COUNTRIES ?? "global,fr,us,br,es,de,it,mx,kr,jp,ru,tr,pl,gb,ca")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_PLAYERS = Number(process.env.BS_MAX_PLAYERS ?? 2000);
const CONCURRENCY = Number(process.env.BS_CONCURRENCY ?? 8);
const RETENTION_DAYS = Number(process.env.BS_RETENTION_DAYS ?? 60);

if (!hasApiKey) {
  console.error("BS_API_KEY manquant. Copie .env.example en .env et ajoute ta clé API.");
  process.exit(1);
}

type ApiPlayer = { tag: string; name: string; brawler: { id: number; name: string } };
type ApiBattleItem = {
  battleTime: string;
  event: { id: number; mode?: string; map?: string | null };
  battle: {
    mode?: string;
    type?: string;
    result?: string;
    teams?: ApiPlayer[][];
    /** Survivant solo : liste des joueurs, rangée dans l'ordre du classement final. */
    players?: ApiPlayer[];
    /** Survivant : place du joueur consulté. */
    rank?: number;
  };
};

async function api<T>(path: string, attempt = 0): Promise<T | null> {
  const res = await apiFetch(API + path);
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) return null;
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return api<T>(path, attempt + 1);
  }
  const body = await res.text();
  if (res.status === 403) {
    console.error(`403 sur ${path} : ${body}`);
    console.error("La clé est invalide ou n'autorise pas l'IP de cette machine.");
    process.exit(1);
  }
  console.warn(`HTTP ${res.status} sur ${path} : ${body.slice(0, 200)}`);
  return null;
}

/** Le nom peut être une chaîne ou un objet de traduction (JsonLocalizedName). */
function textOf(name: unknown, fallback: string): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const o = name as Record<string, unknown>;
    const v = o.en ?? o.EN ?? o.fr ?? o.FR ?? Object.values(o).find((x) => typeof x === "string");
    if (typeof v === "string") return v;
  }
  return fallback;
}

const enc = (tag: string) => encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);

/** "20261117T091500.000Z" -> timestamp en ms */
function parseBattleTime(s: string): number {
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 11)}:${s.slice(11, 13)}:${s.slice(13)}`;
  return Date.parse(iso);
}

async function main() {
  const db = getDb();

  if (getMeta("demo") === "1") {
    console.log("Suppression des données de démo…");
    clearBattles();
    db.exec("DELETE FROM maps; DELETE FROM brawlers;");
    setMeta("demo", "0");
  }

  // 0. Noms officiels en français et classes des brawlers (pas bloquant si indisponible).
  try {
    await updateNames();
  } catch (e) {
    console.warn("Noms français non mis à jour :", e instanceof Error ? e.message : e);
  }

  // 1. Liste des brawlers
  const brawlers = await api<{ items: { id: number; name: unknown }[] }>("/brawlers");
  const upsertBrawler = db.prepare(
    "INSERT INTO brawlers(id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
  );
  for (const b of brawlers?.items ?? []) upsertBrawler.run(b.id, textOf(b.name, `BRAWLER ${b.id}`).toUpperCase());
  console.log(`${brawlers?.items.length ?? 0} brawlers`);
  if (brawlers?.items[0]) console.log("  exemple :", JSON.stringify(brawlers.items[0]).slice(0, 200));

  // Comptes liés sur le site : on garde leurs parties pour les stats perso.
  const tracked = trackedPlayers();
  let personalAdded = 0;
  for (const tag of tracked) {
    const log = await api<{ items: ApiBattleItem[] }>(`/players/${enc(tag)}/battlelog`);
    personalAdded += storePersonalBattles(tag, log?.items ?? []);
  }
  if (tracked.length) console.log(`${tracked.length} compte(s) lié(s) : ${personalAdded} nouvelles parties perso`);

  // 2. Joueurs de départ : classements globaux + par pays
  const addPlayer = db.prepare("INSERT OR IGNORE INTO players(tag, source) VALUES (?, ?)");
  for (const country of COUNTRIES) {
    const r = await api<{ items: { tag: string }[] }>(`/rankings/${country}/players?limit=200`);
    for (const p of r?.items ?? []) addPlayer.run(p.tag, `ranking:${country}`);
  }

  // Les joueurs jamais récupérés d'abord, puis les plus anciens.
  const tags = (
    db
      .prepare("SELECT tag FROM players ORDER BY last_fetched IS NOT NULL, last_fetched LIMIT ?")
      .all(MAX_PLAYERS) as { tag: string }[]
  ).map((r) => r.tag);
  console.log(
    `${tags.length} joueurs connus à analyser, jusqu'à ${MAX_PLAYERS} avec ceux découverts en route (types : ${BATTLE_TYPES.join(", ")})`,
  );

  // File d'attente dynamique : les joueurs croisés dans les parties classées
  // y sont ajoutés tant qu'on n'a pas atteint MAX_PLAYERS.
  const queue = [...tags];
  const scheduled = new Set(tags);
  function schedule(tag: string) {
    if (scheduled.size >= MAX_PLAYERS || scheduled.has(tag)) return;
    scheduled.add(tag);
    queue.push(tag);
  }

  const insertBattle = db.prepare(
    "INSERT OR IGNORE INTO battles(id, time, type, mode, map_id, winner) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertPlayer = db.prepare(
    "INSERT OR IGNORE INTO battle_players(battle_id, team, brawler_id, won, time, map_id, decided, type, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTeam = db.prepare("INSERT OR IGNORE INTO battle_teams(battle_id, team, comp, won) VALUES (?, ?, ?, ?)");
  const upsertMap = db.prepare(
    "INSERT INTO maps(id, name, mode) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, mode = excluded.mode",
  );
  const markFetched = db.prepare("UPDATE players SET last_fetched = ? WHERE tag = ?");

  const typesSeen = new Map<string, number>();
  let added = 0;
  let done = 0;

  function store(ownerTag: string, item: ApiBattleItem) {
    const { battle, event } = item;
    const type = battle.type ?? "unknown";
    typesSeen.set(type, (typesSeen.get(type) ?? 0) + 1);
    if (!BATTLE_TYPES.includes(type)) return;
    const mode = event.mode && event.mode !== "unknown" ? event.mode : battle.mode;
    if (!mode || !event.id || !event.map) return;
    if (/showdown/i.test(mode)) return storeShowdown(item, type, mode);
    const teams = battle.teams;
    if (!teams || teams.length !== 2 || teams.some((t) => t.length !== 3)) return;

    const time = parseBattleTime(item.battleTime);
    const allTags = teams.flat().map((p) => p.tag).sort();
    const id = createHash("sha1").update(`${item.battleTime}|${allTags.join(",")}`).digest("hex");

    const ownerTeam = teams.findIndex((t) => t.some((p) => p.tag === ownerTag));
    const winner =
      battle.result === "victory" ? ownerTeam : battle.result === "defeat" ? 1 - ownerTeam : null;
    if (ownerTeam < 0) return;

    upsertMap.run(event.id, event.map, mode);
    const res = insertBattle.run(id, time, type, mode, event.id, winner);
    if (res.changes === 0) return; // déjà en base
    added++;
    teams.forEach((team, t) => {
      const won = winner === t ? 1 : 0;
      for (const p of team) {
        insertPlayer.run(id, t, p.brawler.id, won, time, event.id, winner === null ? 0 : 1, type, mode);
        addPlayer.run(p.tag, "crawl");
        schedule(p.tag);
      }
      const comp = team.map((p) => p.brawler.id).sort((a, b) => a - b).join("-");
      insertTeam.run(id, t, comp, won);
    });
  }

  let active = 0;
  /**
   * Survivant : les joueurs (solo) ou les équipes (duo, trio) sont rangés dans
   * l'ordre du classement final. Victoire = première moitié du classement ;
   * la place du milieu (nombre d'équipes impair) compte comme un match nul.
   */
  function storeShowdown(item: ApiBattleItem, type: string, mode: string) {
    const { battle, event } = item;
    const units = battle.players ? battle.players.map((p) => [p]) : battle.teams;
    if (!units || units.length < 2 || units.some((u) => u.length === 0)) return;

    const time = parseBattleTime(item.battleTime);
    const allTags = units.flat().map((p) => p.tag).sort();
    const id = createHash("sha1").update(`${item.battleTime}|${allTags.join(",")}`).digest("hex");

    upsertMap.run(event.id, event.map!, mode);
    const res = insertBattle.run(id, time, type, mode, event.id, 0);
    if (res.changes === 0) return;
    added++;

    const n = units.length;
    const middle = n % 2 === 1 ? (n + 1) / 2 : null;
    units.forEach((unit, t) => {
      const rank = t + 1;
      const won = rank <= Math.floor(n / 2) ? 1 : 0;
      const decided = rank === middle ? 0 : 1;
      for (const p of unit) {
        insertPlayer.run(id, t, p.brawler.id, won, time, event.id, decided, type, mode);
        addPlayer.run(p.tag, "crawl");
        schedule(p.tag);
      }
      if (unit.length > 1 && decided) {
        const comp = unit.map((p) => p.brawler.id).sort((a, b) => a - b).join("-");
        insertTeam.run(id, t, comp, won);
      }
    });
  }

  async function worker() {
    while (queue.length || active > 0) {
      if (!queue.length) {
        // D'autres workers peuvent encore découvrir des joueurs.
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      const tag = queue.shift()!;
      active++;
      const log = await api<{ items: ApiBattleItem[] }>(`/players/${enc(tag)}/battlelog`);
      db.exec("BEGIN");
      try {
        for (const item of log?.items ?? []) store(tag, item);
        markFetched.run(Date.now(), tag);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        active--;
      }
      done++;
      if (done % 250 === 0) {
        const s = ((Date.now() - start) / 1000).toFixed(0);
        console.log(`  ${done}/${scheduled.size} joueurs, ${added} nouvelles parties (${s} s)`);
      }
    }
  }

  const start = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 3. Nettoyage des vieilles parties
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  db.prepare("DELETE FROM battles WHERE time < ?").run(cutoff);

  setMeta("last_collect", String(Date.now()));
  db.exec("ANALYZE");
  bumpDataVersion();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM battles").get() as { n: number }).n;
  console.log(`\nTerminé : ${added} nouvelles parties, ${total} au total.`);
  console.log("Types de parties rencontrés :", Object.fromEntries(typesSeen));
  // Import tardif : les noms ont pu être mis à jour au début de la collecte.
  const { hasFrenchName } = await import("../src/lib/format.ts");
  const missing = (
    db.prepare("SELECT DISTINCT m.name FROM maps m JOIN battles b ON b.map_id = m.id ORDER BY m.name").all() as {
      name: string;
    }[]
  )
    .map((r) => r.name)
    .filter((n) => !hasFrenchName(n));
  if (missing.length) {
    console.log(
      `\nMaps sans nom français officiel pour l'instant (tu peux les ajouter dans content/noms-fr-manuels.json) :\n  ${missing.join("\n  ")}`,
    );
  }
  if (added === 0) {
    console.log(
      `Aucune partie de type ${BATTLE_TYPES.join("/")} trouvée. Vérifie les types ci-dessus et ajuste BS_BATTLE_TYPES dans .env.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
