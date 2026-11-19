// Utilitaires d'affichage partagés (client + serveur).

import nomsFr from "../../content/noms-fr.json" with { type: "json" };
import nomsManuels from "../../content/noms-fr-manuels.json" with { type: "json" };

// Noms officiels du jeu en français (générés par `npm run noms`), complétés à la main.
type Manual = { brawlers: Record<string, { nom?: string; classe?: string }>; maps: Record<string, string> };
const MANUAL = nomsManuels as Manual;

/** "Belle's Rock" et "Belles Rock" donnent la même clé. */
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const FR_MAPS = new Map<string, string>();
for (const [en, fr] of [...Object.entries(nomsFr.maps), ...Object.entries(MANUAL.maps)]) FR_MAPS.set(nameKey(en), fr);

const FR_BRAWLERS = new Map<string, string>();
const CLASS_BY_ID = new Map<number, string>();
for (const [id, b] of Object.entries(nomsFr.brawlers)) {
  FR_BRAWLERS.set(nameKey(b.en), MANUAL.brawlers[id]?.nom ?? b.nom);
  const c = MANUAL.brawlers[id]?.classe ?? b.classe;
  if (c) CLASS_BY_ID.set(Number(id), c);
}
for (const [id, b] of Object.entries(MANUAL.brawlers)) if (b.classe) CLASS_BY_ID.set(Number(id), b.classe);
const FR_BRAWLERS_BY_ID = new Map(
  Object.entries(MANUAL.brawlers).flatMap(([id, b]) => (b.nom ? [[Number(id), b.nom] as const] : [])),
);

/** Nom français de la map (ou le nom anglais si pas encore traduit). */
export function mapName(name: string): string {
  return FR_MAPS.get(nameKey(name)) ?? name;
}

export function hasFrenchName(name: string): boolean {
  return FR_MAPS.has(nameKey(name));
}

/** Classes de brawlers (noms du jeu), dans l'ordre d'affichage. */
export const BRAWLER_CLASSES: { key: string; label: string }[] = [
  ...Object.entries(nomsFr.classes).map(([key, label]) => ({ key, label })),
  { key: "autre", label: "Autres" },
];

/** Classe du brawler (tank, support…), « autre » si inconnue. */
export function brawlerClass(id: number): string {
  return CLASS_BY_ID.get(id) ?? "autre";
}

/** Texte de recherche : nom français + nom anglais, sans accents ni majuscules. */
export function searchKey(...parts: string[]): string {
  return parts
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const MODES: Record<string, { label: string; color: string }> = {
  gemGrab: { label: "Razzia de gemmes", color: "#a855f7" },
  brawlBall: { label: "Brawlball", color: "#3b82f6" },
  heist: { label: "Braquage", color: "#ec4899" },
  bounty: { label: "Prime", color: "#22d3ee" },
  knockout: { label: "Hors-jeu", color: "#f97316" },
  hotZone: { label: "Zone réservée", color: "#ef4444" },
  wipeout: { label: "Élimination", color: "#84cc16" },
  basketBrawl: { label: "Basket Brawl", color: "#eab308" },
  airHockey: { label: "Hockey", color: "#38bdf8" },
  brawlArena: { label: "Brawl Arena", color: "#f43f5e" },
  killConfirmed: { label: "Élimination confirmée", color: "#f59e0b" },
  deathmatch: { label: "Match à mort", color: "#dc2626" },
  treasureHunt: { label: "Chasse au trésor", color: "#facc15" },
  bombHeist: { label: "Braquage explosif", color: "#fb7185" },
  soloShowdown: { label: "Survivant solo", color: "#84cc16" },
  duoShowdown: { label: "Survivant duo", color: "#65a30d" },
  trioShowdown: { label: "Survivant trio", color: "#4d7c0f" },
  megaShowdown: { label: "Méga Survivant", color: "#a3e635" },
  megaDuoShowdown: { label: "Méga Survivant duo", color: "#bef264" },
  loadedShowdown: { label: "Survivant chargé", color: "#d9f99d" },
};

export function modeInfo(mode: string) {
  return MODES[mode] ?? { label: mode, color: "#64748b" };
}

/**
 * Nom français officiel du brawler à partir de son nom anglais ("EL PRIMO" -> "El Costo").
 * Un brawler pas encore traduit garde son nom anglais en minuscules ("MR. P" -> "Mr. P").
 */
export function brawlerName(raw: string, id?: number): string {
  const fr = (id !== undefined && FR_BRAWLERS_BY_ID.get(id)) || FR_BRAWLERS.get(nameKey(raw));
  return fr || englishName(raw);
}

/** Nom anglais de l'API mis en minuscules : "MR. P" -> "Mr. P", "8-BIT" -> "8-Bit". */
export function englishName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s\-.&])([a-zà-ÿ])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export function brawlerImg(id: number): string {
  return `https://cdn.brawlify.com/brawlers/borderless/${id}.png`;
}

export function mapImg(id: number): string {
  return `https://cdn.brawlify.com/maps/regular/${id}.png`;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function signedPct(x: number, digits = 1): string {
  const v = (x * 100).toFixed(digits);
  return x >= 0 ? `+${v}%` : `${v}%`;
}

export const TIER_COLORS: Record<string, string> = {
  S: "#ff5c5c",
  A: "#ff9f43",
  B: "#feca57",
  C: "#1dd1a1",
  D: "#54a0ff",
};

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export const DAY_OPTIONS = [3, 7, 14, 30] as const;

// Classé (« soloRanked » dans l'API) ou parties en trophées (« ranked » dans l'API).
export type Queue = "classe" | "trophees";
export const QUEUES: { key: Queue; label: string; type: string }[] = [
  { key: "classe", label: "Classé", type: "soloRanked" },
  { key: "trophees", label: "Trophées", type: "ranked" },
];
export const queueType = (q: Queue) => QUEUES.find((x) => x.key === q)!.type;
export const queueLabel = (q: Queue) => QUEUES.find((x) => x.key === q)!.label;

export type Filter = { days: number; queue: Queue; mode: string | null };

/** Modes Survivant (Showdown) : classement final au lieu de victoire / défaite. */
export function isShowdown(mode: string | null | undefined): boolean {
  return Boolean(mode && /showdown/i.test(mode));
}

export const SHOWDOWN_NOTE =
  "En Survivant, une « victoire » = finir dans la première moitié du classement (top 5 sur 10 en solo, top 2 sur 4 équipes en trio…).";
