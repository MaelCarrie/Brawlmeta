// Profil d'un joueur via l'API officielle (côté serveur uniquement : la clé reste secrète).

import { apiFetch, hasApiKey } from "./api-key";
import { personalStats, storePersonalBattles, trackPlayer } from "./personal.ts";

export type OwnedBrawler = {
  id: number;
  power: number;
  gadgets: number;
  starPowers: number;
  gears: number;
  hyperCharges: number;
};

export type PlayerProfile = {
  tag: string;
  name: string;
  trophies: number;
  brawlers: OwnedBrawler[];
  /** Parties perso gardées en base (90 derniers jours), bilan global. */
  personal: { games: number; wins: number };
};

type ApiPlayer = {
  tag: string;
  name: string;
  trophies: number;
  brawlers: {
    id: number;
    power: number;
    gadgets?: unknown[];
    starPowers?: unknown[];
    gears?: unknown[];
    hyperCharges?: unknown[];
  }[];
};

export class PlayerError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Normalise un tag saisi : « #abc o12 » → « ABC012 ». Renvoie null s'il est invalide. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "").replace(/O/g, "0");
  return /^[0289PYLQGRJCUV]{3,12}$/.test(tag) ? tag : null;
}

const cache = new Map<string, { at: number; profile: PlayerProfile }>();
const TTL = 5 * 60 * 1000;

export async function fetchPlayer(tag: string): Promise<PlayerProfile> {
  const hit = cache.get(tag);
  if (hit && Date.now() - hit.at < TTL) return hit.profile;

  if (!hasApiKey) throw new PlayerError("Clé API absente côté serveur (BS_API_KEY).", 500);

  const res = await apiFetch(`https://api.brawlstars.com/v1/players/%23${tag}`);
  if (res.status === 404) throw new PlayerError("Aucun joueur avec ce tag.", 404);
  if (res.status === 403) throw new PlayerError("Aucune clé API n'autorise l'IP actuelle (ajoute-la sur developer.brawlstars.com).", 502);
  if (!res.ok) throw new PlayerError(`L'API Brawl Stars a répondu ${res.status}.`, 502);

  const p = (await res.json()) as ApiPlayer;

  // Historique : on garde les nouvelles parties et on suit ce compte à la collecte.
  trackPlayer(p.tag);
  const log = await apiFetch(`https://api.brawlstars.com/v1/players/%23${tag}/battlelog`);
  if (log.ok) storePersonalBattles(p.tag, ((await log.json()) as { items: [] }).items ?? []);
  const { games, wins } = personalStats(p.tag);

  const profile: PlayerProfile = {
    tag: p.tag,
    name: p.name,
    trophies: p.trophies,
    brawlers: p.brawlers.map((b) => ({
      id: b.id,
      power: b.power,
      gadgets: b.gadgets?.length ?? 0,
      starPowers: b.starPowers?.length ?? 0,
      gears: b.gears?.length ?? 0,
      hyperCharges: b.hyperCharges?.length ?? 0,
    })),
    personal: { games, wins },
  };
  cache.set(tag, { at: Date.now(), profile });
  return profile;
}
