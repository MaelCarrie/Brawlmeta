// Génère des parties FICTIVES pour tester le site sans clé API.
// Usage : npm run demo
// Les données sont marquées « démo » et supprimées automatiquement à la première
// vraie collecte (npm run collect).

import { createHash } from "node:crypto";
import { bumpDataVersion, clearBattles, getDb, getMeta, setMeta } from "../src/lib/db.ts";

const BRAWLERS: [number, string][] = [
  [16000000, "SHELLY"], [16000001, "COLT"], [16000002, "BULL"], [16000003, "BROCK"],
  [16000004, "RICO"], [16000005, "SPIKE"], [16000006, "BARLEY"], [16000007, "JESSIE"],
  [16000008, "NITA"], [16000009, "DYNAMIKE"], [16000010, "EL PRIMO"], [16000011, "MORTIS"],
  [16000012, "CROW"], [16000013, "POCO"], [16000014, "BO"], [16000015, "PIPER"],
  [16000016, "PAM"], [16000017, "TARA"], [16000018, "DARRYL"], [16000019, "PENNY"],
  [16000020, "FRANK"], [16000021, "GENE"], [16000022, "TICK"], [16000023, "LEON"],
  [16000024, "ROSA"], [16000025, "CARL"], [16000026, "BIBI"], [16000027, "8-BIT"],
  [16000028, "SANDY"], [16000029, "BEA"], [16000030, "EMZ"], [16000031, "MR. P"],
  [16000032, "MAX"], [16000034, "JACKY"], [16000035, "GALE"], [16000036, "NANI"],
  [16000037, "SPROUT"], [16000038, "SURGE"], [16000039, "COLETTE"], [16000040, "AMBER"],
  [16000041, "LOU"], [16000042, "BYRON"], [16000043, "EDGAR"], [16000044, "RUFFS"],
  [16000045, "STU"], [16000046, "BELLE"], [16000047, "SQUEAK"], [16000048, "GROM"],
  [16000049, "BUZZ"], [16000050, "GRIFF"], [16000051, "ASH"], [16000052, "MEG"],
];

// Identifiants fictifs : les images de map ne s'affichent pas en mode démo.
const MAPS: [number, string, string][] = [
  [99000001, "Hard Rock Mine", "gemGrab"], [99000002, "Crystal Arcade", "gemGrab"],
  [99000003, "Double Swoosh", "gemGrab"], [99000004, "Center Stage", "brawlBall"],
  [99000005, "Pinball Dreams", "brawlBall"], [99000006, "Sneaky Fields", "brawlBall"],
  [99000007, "Safe Zone", "heist"], [99000008, "Hot Potato", "heist"],
  [99000009, "Shooting Star", "bounty"], [99000010, "Hideout", "bounty"],
  [99000011, "Layer Cake", "bounty"], [99000012, "Belle's Rock", "knockout"],
  [99000013, "Out in the Open", "knockout"], [99000014, "Goldarm Gulch", "knockout"],
  [99000015, "Dueling Beetles", "hotZone"], [99000016, "Open Business", "hotZone"],
  [99000017, "Ring of Fire", "hotZone"],
];

const BATTLES = Number(process.argv[2] ?? 15000);
const DAYS = 21;

// Générateur pseudo-aléatoire déterministe (mulberry32) pour des résultats reproductibles.
let seed = 42;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function normal() {
  return Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
}
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const db = getDb();
const hasReal =
  getMeta("demo") !== "1" && (db.prepare("SELECT COUNT(*) AS n FROM battles").get() as { n: number }).n > 0;
if (hasReal && !process.argv.includes("--force")) {
  console.error("La base contient déjà de vraies parties. Relance avec --force pour les écraser.");
  process.exit(1);
}

clearBattles();
db.exec("DELETE FROM maps; DELETE FROM brawlers;");
const insBrawler = db.prepare("INSERT INTO brawlers(id, name) VALUES (?, ?)");
for (const [id, name] of BRAWLERS) insBrawler.run(id, name);
const insMap = db.prepare("INSERT INTO maps(id, name, mode) VALUES (?, ?, ?)");
for (const m of MAPS) insMap.run(...m);

// Force cachée de chaque brawler, globale, par mode et par map.
const strength = new Map(BRAWLERS.map(([id]) => [id, normal() * 0.18]));
const modeBonus = new Map<string, number>();
const mapBonus = new Map<string, number>();
const s = (id: number, mapId: number, mode: string) => {
  const mk = `${id}:${mode}`;
  if (!modeBonus.has(mk)) modeBonus.set(mk, normal() * 0.3);
  const pk = `${id}:${mapId}`;
  if (!mapBonus.has(pk)) mapBonus.set(pk, normal() * 0.12);
  return strength.get(id)! + modeBonus.get(mk)! + mapBonus.get(pk)!;
};
// Quelques duos qui fonctionnent particulièrement bien ensemble.
const synergy = new Map<string, number>();
for (let i = 0; i < 40; i++) {
  const a = BRAWLERS[Math.floor(rand() * BRAWLERS.length)][0];
  const b = BRAWLERS[Math.floor(rand() * BRAWLERS.length)][0];
  if (a !== b) synergy.set([a, b].sort().join("-"), 0.15 + rand() * 0.25);
}

const insBattle = db.prepare("INSERT INTO battles(id, time, type, mode, map_id, winner) VALUES (?, ?, 'soloRanked', ?, ?, ?)");
const insPlayer = db.prepare("INSERT INTO battle_players(battle_id, team, brawler_id, won, time, map_id, decided, type, mode) VALUES (?, ?, ?, ?, ?, ?, ?, 'soloRanked', ?)");
const insTeam = db.prepare("INSERT INTO battle_teams(battle_id, team, comp, won) VALUES (?, ?, ?, ?)");

const now = Date.now();
db.exec("BEGIN");
for (let i = 0; i < BATTLES; i++) {
  const [mapId, , mode] = MAPS[Math.floor(rand() * MAPS.length)];
  // Les joueurs choisissent plus souvent les brawlers forts sur la map.
  const weights = BRAWLERS.map(([id]) => Math.exp(s(id, mapId, mode) * 4));
  const picked: number[] = [];
  while (picked.length < 6) {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (r > weights[k]) r -= weights[k++];
    const id = BRAWLERS[k][0];
    if (!picked.includes(id)) picked.push(id);
  }
  const teams = [picked.slice(0, 3), picked.slice(3)];
  const power = teams.map((t) => {
    let p = t.reduce((sum, id) => sum + s(id, mapId, mode), 0);
    for (let x = 0; x < 3; x++)
      for (let y = x + 1; y < 3; y++) p += synergy.get([t[x], t[y]].sort().join("-")) ?? 0;
    return p;
  });
  const winner = rand() < 0.02 ? null : rand() < sigmoid((power[0] - power[1]) * 1.2) ? 0 : 1;
  const id = createHash("sha1").update(`demo-${i}`).digest("hex");
  const time = now - Math.floor(rand() * DAYS * 86_400_000);
  insBattle.run(id, time, mode, mapId, winner);
  teams.forEach((team, t) => {
    const won = winner === t ? 1 : 0;
    for (const b of team) insPlayer.run(id, t, b, won, time, mapId, winner === null ? 0 : 1, mode);
    insTeam.run(id, t, [...team].sort((a, b) => a - b).join("-"), won);
  });
}
db.exec("COMMIT");
setMeta("demo", "1");
bumpDataVersion();
console.log(`${BATTLES} parties de démo générées sur ${MAPS.length} maps.`);
