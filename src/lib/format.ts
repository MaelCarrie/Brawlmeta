// Utilitaires d'affichage partagés (client + serveur).

import mapNamesFr from "../../content/map-names-fr.json" with { type: "json" };

const FR_MAP_NAMES: Record<string, string> = mapNamesFr.noms;

/** Nom français de la map (ou le nom anglais si pas encore traduit). */
export function mapName(name: string): string {
  return FR_MAP_NAMES[name] ?? name;
}

export function hasFrenchName(name: string): boolean {
  return name in FR_MAP_NAMES;
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

/** "EL PRIMO" -> "El Primo", "MR. P" -> "Mr. P", "8-BIT" -> "8-Bit" */
export function brawlerName(raw: string): string {
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
