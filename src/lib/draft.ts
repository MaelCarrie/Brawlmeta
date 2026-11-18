// Moteur de recommandation pour le draft en classé.
//
// Score d'un candidat c :
//   score = taux ajusté de c sur la map
//         + moyenne(synergie de c avec chaque allié déjà choisi)
//         + moyenne(avantage de c contre chaque ennemi déjà choisi)
// La synergie et l'avantage sont mesurés en écart par rapport au taux de
// victoire habituel de c, sur toutes les maps de la période (sinon les
// échantillons sont trop petits).

import {
  allBrawlers,
  brawlerStats,
  compStats,
  pairStats,
  shrink,
  type CompStat,
  type Filter,
  type PairRow,
} from "./stats";
import { personalStats } from "./personal.ts";
import type { OwnedBrawler } from "./player";

export type DraftInput = {
  mapId: number | null;
  bans: number[];
  allies: number[];
  enemies: number[];
  /**
   * Compte lié (conseils personnalisés) : seuls ses brawlers sont proposés,
   * avec un malus s'ils ne sont pas au max et un bonus/malus selon son winrate perso.
   */
  player?: { tag: string; brawlers: OwnedBrawler[] } | null;
  /** Période et file (classé / trophées) ; le mode est déduit de la map. */
  filter: Filter;
};

export type Factor = { id: number; delta: number; games: number };

export type Recommendation = {
  id: number;
  score: number;
  base: number;
  baseGames: number;
  synergy: number;
  counter: number;
  synergyDetails: Factor[];
  counterDetails: Factor[];
  /** Malus de niveau / gadget / pouvoir star (≤ 0). */
  build: number;
  /** Écart dû à ton winrate perso avec ce brawler. */
  personal: number;
  personalGames: number;
  personalWins: number;
};

export type DraftResult = {
  recommendations: Recommendation[];
  suggestedComp: number[];
  dataComps: CompStat[];
  suggestedBans: { id: number; adj: number; games: number }[];
  /** Score de chaque brawler encore disponible (pour trier la grille). */
  scores: Record<number, number>;
};

const PAIR_K = 20;
const PERSONAL_K = 40;
const PERSONAL_CAP = 0.08;
const MAX_POWER = 11;

/** Malus pour un brawler pas au max : -1 % par niveau manquant, -1,5 % sans gadget, -2 % sans pouvoir star. */
export function buildPenalty(b: OwnedBrawler): number {
  return -Math.min(0.05, 0.01 * Math.max(0, MAX_POWER - b.power)) - (b.gadgets === 0 ? 0.015 : 0) - (b.starPowers === 0 ? 0.02 : 0);
}

export function recommendDraft(input: DraftInput): DraftResult {
  const { mapId } = input;
  const f: Filter = { ...input.filter, mode: null };
  const bans = new Set(input.bans);
  const allies = input.allies.slice(0, 3);
  const enemies = input.enemies.slice(0, 3);

  const global = new Map(brawlerStats(f).map((s) => [s.id, s]));
  const onMap = mapId ? new Map(brawlerStats(f, mapId).map((s) => [s.id, s])) : global;

  // Cache des stats de paires : une requête par brawler concerné.
  const teammateCache = new Map<number, Map<number, PairRow>>();
  const opponentCache = new Map<number, Map<number, PairRow>>();
  const teammates = (id: number) => {
    if (!teammateCache.has(id)) teammateCache.set(id, new Map(pairStats(id, f, true).map((r) => [r.id, r])));
    return teammateCache.get(id)!;
  };
  const opponents = (id: number) => {
    if (!opponentCache.has(id)) opponentCache.set(id, new Map(pairStats(id, f, false).map((r) => [r.id, r])));
    return opponentCache.get(id)!;
  };

  const globalAdj = (id: number) => global.get(id)?.adj ?? 0.5;

  // Personnalisation
  const builds = input.player ? new Map(input.player.brawlers.map((b) => [b.id, b])) : null;
  const me = input.player ? personalStats(input.player.tag) : null;
  // Niveau général du joueur, pour ne pas confondre « bon joueur » et « bon avec ce brawler ».
  const myAvg = me ? shrink(me.wins, me.games, 0.5, 20) : 0.5;

  function evaluate(c: number, team: number[]): Recommendation {
    const g = globalAdj(c);
    const m = onMap.get(c);
    const base = m ? m.adj : g;

    const synergyDetails = team.map((a) => {
      // Les victoires de a avec c sont aussi celles de c avec a (même équipe).
      const row = teammates(a).get(c);
      const games = row?.games ?? 0;
      return { id: a, games, delta: shrink(row?.wins ?? 0, games, g, PAIR_K) - g };
    });
    const counterDetails = enemies.map((e) => {
      // Vu depuis e : les victoires de c sont les défaites de e.
      const row = opponents(e).get(c);
      const games = row?.games ?? 0;
      return { id: e, games, delta: shrink(games - (row?.wins ?? 0), games, g, PAIR_K) - g };
    });
    const mean = (xs: Factor[]) => (xs.length ? xs.reduce((s, x) => s + x.delta, 0) / xs.length : 0);
    const synergy = mean(synergyDetails);
    const counter = mean(counterDetails);

    const own = builds?.get(c);
    const build = own ? buildPenalty(own) : 0;
    // Attendu pour ce joueur avec c = son niveau général + la force de c dans la méta.
    const mine = me?.byBrawler.get(c);
    const expected = myAvg + (g - 0.5);
    const personal = mine
      ? Math.max(-PERSONAL_CAP, Math.min(PERSONAL_CAP, shrink(mine.wins, mine.games, expected, PERSONAL_K) - expected))
      : 0;
    return {
      id: c,
      score: base + synergy + counter + build + personal,
      base,
      baseGames: m?.games ?? 0,
      synergy,
      counter,
      synergyDetails,
      counterDetails,
      build,
      personal,
      personalGames: mine?.games ?? 0,
      personalWins: mine?.wins ?? 0,
    };
  }

  const roster = allBrawlers().map((b) => b.id);
  const taken = new Set([...bans, ...allies, ...enemies]);
  const owned = builds ? new Set(builds.keys()) : null;
  const available = roster.filter((id) => !taken.has(id) && (!owned || owned.has(id)));

  const evaluated = roster.filter((id) => !taken.has(id)).map((c) => evaluate(c, allies));
  const scores = Object.fromEntries(evaluated.map((r) => [r.id, r.score]));

  const recommendations =
    allies.length < 3
      ? evaluated
          .filter((r) => !owned || owned.has(r.id))
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
      : [];

  // Compo complète conseillée : on complète l'équipe un pick à la fois.
  const suggestedComp = [...allies];
  while (suggestedComp.length < 3) {
    const best = available
      .filter((id) => !suggestedComp.includes(id))
      .map((c) => evaluate(c, suggestedComp))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) break;
    suggestedComp.push(best.id);
  }

  // Compos jouées sur la map : les membres à ajouter doivent être possédés.
  const dataComps = mapId
    ? compStats(f, mapId, { minGames: 3, limit: owned ? 60 : 8, include: allies, exclude: [...bans, ...enemies] })
        .filter((c) => !owned || c.ids.every((id) => allies.includes(id) || owned.has(id)))
        .slice(0, 8)
    : [];

  const suggestedBans = mapId
    ? [...onMap.values()]
        .filter((s) => s.tier !== null && !taken.has(s.id))
        .sort((a, b) => b.adj - a.adj)
        .slice(0, 6)
        .map((s) => ({ id: s.id, adj: s.adj, games: s.games }))
    : [];

  return { recommendations, suggestedComp, dataComps, suggestedBans, scores };
}
