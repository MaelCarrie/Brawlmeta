// Lance `scripts/collect.ts` depuis le site (bouton « Mettre à jour les données »)
// et garde son état en mémoire pour l'afficher pendant qu'il tourne.

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { getMeta } from "./db.ts";
import { hasApiKey } from "./api-key.ts";

export type CollectStatus = {
  /** Bouton désactivé par BS_COLLECT_BUTTON=0 (site en ligne par exemple). */
  enabled: boolean;
  hasKey: boolean;
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  /** Code de sortie de la dernière collecte (0 = réussie). */
  exitCode: number | null;
  /** Joueurs analysés / à analyser, d'après les lignes de progression du script. */
  progress: { done: number; total: number } | null;
  lastCollect: number | null;
  log: string[];
};

type State = {
  child: ChildProcess | null;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  progress: { done: number; total: number } | null;
  log: string[];
};

// Sur globalThis : survit aux rechargements de module en développement.
const g = globalThis as typeof globalThis & { __bmCollect?: State };
const state: State = (g.__bmCollect ??= {
  child: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  progress: null,
  log: [],
});

const MAX_LOG = 200;
export const collectEnabled = process.env.BS_COLLECT_BUTTON !== "0";

function push(chunk: string) {
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.trim()) continue;
    state.log.push(line);
    const m = line.match(/(\d+)\/(\d+) joueurs/);
    if (m) state.progress = { done: Number(m[1]), total: Number(m[2]) };
  }
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function collectStatus(): CollectStatus {
  const last = Number(getMeta("last_collect"));
  return {
    enabled: collectEnabled,
    hasKey: hasApiKey,
    running: state.child !== null,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    exitCode: state.exitCode,
    progress: state.progress,
    lastCollect: Number.isFinite(last) && last > 0 ? last : null,
    log: state.log.slice(-40),
  };
}

/** Démarre une collecte, sauf si une autre tourne déjà. */
export function startCollect(): { ok: boolean; error?: string } {
  if (!collectEnabled) return { ok: false, error: "La collecte depuis le site est désactivée (BS_COLLECT_BUTTON=0)." };
  if (!hasApiKey) return { ok: false, error: "BS_API_KEY manquant dans .env." };
  if (state.child) return { ok: false, error: "Une collecte est déjà en cours." };

  // Le script est lancé depuis le dossier courant (celui du site), sans référence explicite
  // à ce dossier : sinon Turbopack l'analyse en entier (base de données comprise) et la relit
  // à chaque écriture de la collecte, ce qui bloque la compilation en mode dev.
  const script = path.join(/* turbopackIgnore: true */ "scripts", "collect.ts");
  const child = spawn(process.execPath, ["--env-file-if-exists=.env", script], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  state.child = child;
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.exitCode = null;
  state.progress = null;
  state.log = [];
  child.stdout?.setEncoding("utf8").on("data", push);
  child.stderr?.setEncoding("utf8").on("data", push);
  child.on("error", (e) => push(`Erreur : ${e.message}`));
  child.on("close", (code, signal) => {
    state.child = null;
    state.finishedAt = Date.now();
    // Arrêtée à la main (signal) : ce n'est pas un échec.
    state.exitCode = signal ? null : code;
    if (signal) push("Collecte arrêtée.");
  });
  return { ok: true };
}

/** Arrête la collecte en cours (les parties déjà récupérées restent en base). */
export function stopCollect(): boolean {
  if (!state.child) return false;
  state.child.kill("SIGTERM");
  return true;
}
