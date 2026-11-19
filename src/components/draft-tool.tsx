"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SafeImg } from "./safe-img";
import type { DraftResult, Factor } from "@/lib/draft";
import type { OwnedBrawler, PlayerProfile } from "@/lib/player";
import {
  BRAWLER_CLASSES,
  brawlerClass,
  brawlerImg,
  brawlerName,
  mapImg,
  mapName,
  modeInfo,
  pct,
  QUEUES,
  searchKey,
  signedPct,
  type Queue,
} from "@/lib/format";

type Brawler = { id: number; name: string };
type MapOption = { id: number; name: string; mode: string };
type Slot = "bans" | "allies" | "enemies";
type Picks = Record<Slot, number[]>;
/** Qui fait le premier pick après les bans (null = ordre libre). */
type FirstPick = "nous" | "eux" | null;

const SLOTS: { key: Slot; label: string; max: number; color: string }[] = [
  { key: "bans", label: "Bans", max: 6, color: "#94a3b8" },
  { key: "allies", label: "Ton équipe", max: 3, color: "#4cc9f0" },
  { key: "enemies", label: "Adversaires", max: 3, color: "#ef4444" },
];
const slotInfo = (k: Slot) => SLOTS.find((s) => s.key === k)!;
const EMPTY: Picks = { bans: [], allies: [], enemies: [] };
const MAX_POWER = 11;

// Ordre des picks en classé : 1 - 2 - 2 - 1.
const ORDER: Record<"nous" | "eux", Slot[]> = {
  nous: ["allies", "enemies", "enemies", "allies", "allies", "enemies"],
  eux: ["enemies", "allies", "allies", "enemies", "enemies", "allies"],
};

/**
 * À qui c'est le tour d'après l'ordre du draft (null = draft terminé).
 * Sert seulement d'indication : la catégorie où on ajoute ne change jamais toute seule.
 */
function nextSlot(p: Picks, first: FirstPick): Slot | null {
  if (p.bans.length < 6) return "bans";
  if (first) {
    const count: Record<Slot, number> = { allies: 0, enemies: 0, bans: 0 };
    for (const s of ORDER[first]) {
      count[s]++;
      if (p[s].length < count[s]) return s;
    }
    return null;
  }
  return SLOTS.find((s) => p[s.key].length < s.max)?.key ?? null;
}

// localStorage peut être indisponible (navigation privée…).
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
};

function Icon({
  b,
  size = 48,
  dim = false,
  owned,
}: {
  b: Brawler;
  size?: number;
  dim?: boolean;
  /** Infos du compte lié : affiche le niveau s'il n'est pas au max. */
  owned?: OwnedBrawler | null;
}) {
  const low = owned && owned.power < MAX_POWER;
  return (
    <span
      className={`relative block overflow-hidden rounded-lg bg-surface-2 [&>*:first-child]:h-full [&>*:first-child]:w-full ${dim ? "opacity-25 grayscale" : ""}`}
      style={{ width: size, height: size }}
      title={brawlerName(b.name, b.id) + (owned ? ` · niveau ${owned.power}` : "")}
    >
      <SafeImg src={brawlerImg(b.id)} alt={brawlerName(b.name, b.id)} className="object-contain" />
      {low && (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/75 px-1 text-[10px] font-bold leading-4 text-accent">
          {owned.power}
        </span>
      )}
    </span>
  );
}

export function DraftTool({
  brawlers,
  maps,
  initialMap,
  initialQueue,
}: {
  brawlers: Brawler[];
  maps: Record<Queue, MapOption[]>;
  initialMap: number | null;
  initialQueue: Queue;
}) {
  const byId = useMemo(() => new Map(brawlers.map((b) => [b.id, b])), [brawlers]);
  const [queue, setQueue] = useState<Queue>(initialQueue);
  const [mapId, setMapId] = useState<number | null>(
    initialMap && maps[initialQueue].some((m) => m.id === initialMap) ? initialMap : null,
  );
  const [picks, setPicks] = useState<Picks>(EMPTY);
  const [history, setHistory] = useState<{ slot: Slot; id: number }[]>([]);
  const [firstPick, setFirstPick] = useState<FirstPick>(null);
  // Catégorie où l'on ajoute : c'est toujours l'utilisateur qui la choisit.
  const [target, setTarget] = useState<Slot>("bans");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "nom">("score");
  const [grouped, setGrouped] = useState(true);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  // Compte lié
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);

  // Préférences mémorisées dans le navigateur.
  useEffect(() => {
    const q = store.get("bm-queue");
    const m = Number(store.get("bm-map")) || null;
    if (!initialMap && (q === "classe" || q === "trophees")) {
      setQueue(q);
      if (m && maps[q].some((x) => x.id === m)) setMapId(m);
    }
    const fp = store.get("bm-first");
    if (fp === "nous" || fp === "eux") setFirstPick(fp);
    if (store.get("bm-only-mine") === "0") setOnlyMine(false);
    const s = store.get("bm-sort");
    if (s === "nom" || s === "score") setSortBy(s);
    if (store.get("bm-grouped") === "0") setGrouped(false);
    setRestored(true);
  }, [initialMap, maps]);
  useEffect(() => {
    if (!restored) return;
    store.set("bm-queue", queue);
    store.set("bm-map", mapId ? String(mapId) : null);
    store.set("bm-first", firstPick);
    store.set("bm-only-mine", onlyMine ? "1" : "0");
    store.set("bm-sort", sortBy);
    store.set("bm-grouped", grouped ? "1" : "0");
  }, [restored, queue, mapId, firstPick, onlyMine, sortBy, grouped]);

  const owned = useMemo(() => (player ? new Map(player.brawlers.map((b) => [b.id, b])) : null), [player]);
  const useOwned = Boolean(owned && onlyMine);

  // Tour indiqué par l'ordre du draft (indication seulement).
  const turn = nextSlot(picks, firstPick);
  const done = SLOTS.every((s) => picks[s.key].length >= s.max);
  const targetFull = picks[target].length >= slotInfo(target).max;
  const taken = new Set([...picks.bans, ...picks.allies, ...picks.enemies]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapId,
        queue,
        ...picks,
        player: useOwned && player ? { tag: player.tag, brawlers: player.brawlers } : null,
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data: DraftResult) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [mapId, queue, picks, useOwned, player]);

  function changeQueue(q: Queue) {
    setQueue(q);
    // La map choisie n'existe pas forcément dans l'autre file.
    if (mapId && !maps[q].some((m) => m.id === mapId)) setMapId(null);
  }

  function add(slot: Slot, id: number) {
    if (taken.has(id) || picks[slot].length >= slotInfo(slot).max) return;
    setPicks({ ...picks, [slot]: [...picks[slot], id] });
    setHistory([...history, { slot, id }]);
  }

  function remove(slot: Slot, id: number) {
    setPicks({ ...picks, [slot]: picks[slot].filter((x) => x !== id) });
    setHistory(history.filter((h) => h.id !== id));
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    setPicks({ ...picks, [last.slot]: picks[last.slot].filter((x) => x !== last.id) });
    setHistory(history.slice(0, -1));
  }

  function reset() {
    setPicks(EMPTY);
    setHistory([]);
    setTarget("bans");
    setSearch("");
  }

  const q = searchKey(search.trim());
  const scores = result?.scores ?? {};
  const grid = brawlers
    .filter((b) => !q || searchKey(brawlerName(b.name, b.id), b.name).includes(q))
    .sort((a, b) => {
      if (sortBy === "nom") return brawlerName(a.name, a.id).localeCompare(brawlerName(b.name, b.id), "fr");
      // Brawlers déjà pris à la fin, les autres par score décroissant.
      const ta = taken.has(a.id) ? 1 : 0;
      const tb = taken.has(b.id) ? 1 : 0;
      return ta - tb || (scores[b.id] ?? 0) - (scores[a.id] ?? 0);
    });
  // Groupes par classe (Tank, Soutien…), chacun trié comme la grille.
  const groups = grouped
    ? BRAWLER_CLASSES.map((c) => ({ ...c, list: grid.filter((b) => brawlerClass(b.id) === c.key) })).filter(
        (g) => g.list.length > 0,
      )
    : [{ key: "tous", label: "", list: grid }];
  const name = (id: number) => {
    const b = byId.get(id);
    return b ? brawlerName(b.name, b.id) : String(id);
  };
  const t = slotInfo(target);
  const turnHint = !firstPick || done
    ? null
    : turn === "bans"
      ? "Ordre du draft : bans"
      : turn === "allies"
        ? "Ordre du draft : à ton équipe"
        : turn === "enemies"
          ? "Ordre du draft : aux adversaires"
          : null;
  const quick = result ? result.recommendations.slice(0, 6) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0 space-y-4">
        <AccountPanel player={player} onPlayer={setPlayer} onlyMine={onlyMine} onOnlyMine={setOnlyMine} />

        {/* File, ordre du draft, map */}
        <div className="card space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pills value={queue} onChange={changeQueue} options={QUEUES.map((x) => ({ value: x.key, label: x.label }))} />
            <span className="ml-auto flex items-center gap-2 text-sm text-muted">
              1er pick
              <Pills
                value={firstPick}
                onChange={setFirstPick}
                options={[
                  { value: "nous", label: "Nous" },
                  { value: "eux", label: "Eux" },
                  { value: null, label: "Libre" },
                ]}
              />
            </span>
          </div>
          <MapPicker maps={maps[queue]} value={mapId} onChange={setMapId} />
        </div>

        {/* Emplacements : collés en haut de l'écran sur mobile */}
        <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="flex items-center gap-2 text-sm">
            <span className="min-w-0 leading-tight">
              {done ? (
                <span className="font-semibold">Draft terminé</span>
              ) : (
                <>
                  <span className="text-muted">Ajout dans : </span>
                  <b style={{ color: t.color }}>{t.label}</b>
                  {targetFull && <span className="text-muted"> (complet, choisis une autre catégorie)</span>}
                </>
              )}
              {turnHint && <span className="block text-xs text-muted">{turnHint}</span>}
            </span>
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="ml-auto shrink-0 whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 text-muted enabled:hover:text-ink disabled:opacity-40"
            >
              ↶ Annuler
            </button>
            <button onClick={reset} className="shrink-0 whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 text-muted hover:text-ink">
              Réinitialiser
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((s) => {
              const size = s.key === "bans" ? 28 : 40;
              const active = target === s.key;
              const theirTurn = Boolean(firstPick) && turn === s.key && !done;
              return (
                <div
                  key={s.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => setTarget(s.key)}
                  onKeyDown={(e) => e.key === "Enter" && setTarget(s.key)}
                  className={`card cursor-pointer p-2 transition sm:p-3 ${active ? "ring-2" : "opacity-70 hover:opacity-100"}`}
                  style={active ? ({ "--tw-ring-color": s.color, background: `${s.color}14` } as React.CSSProperties) : undefined}
                >
                  <span className="mb-1.5 flex items-center justify-between gap-1 text-xs font-semibold sm:text-sm" style={{ color: s.color }}>
                    <span className="truncate">
                      {s.label}
                      {theirTurn && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: s.color }} title="À jouer d'après l'ordre du draft" />}
                    </span>
                    <span className="text-muted">{picks[s.key].length}/{s.max}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {Array.from({ length: s.max }, (_, i) => {
                      const id = picks[s.key][i];
                      const b = id !== undefined ? byId.get(id) : undefined;
                      return b ? (
                        <span
                          key={i}
                          role="button"
                          title="Retirer"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(s.key, b.id);
                          }}
                          className="relative block"
                        >
                          <Icon b={b} size={size} owned={s.key === "allies" ? owned?.get(b.id) : undefined} />
                          {s.key === "bans" && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 font-bold text-loss">
                              ✕
                            </span>
                          )}
                        </span>
                      ) : (
                        <span key={i} className="block rounded-lg border border-dashed border-line" style={{ width: size, height: size }} />
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Conseil rapide, visible sans scroller sur mobile */}
          {result && !done && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
              {target === "bans" ? (
                result.suggestedBans.length > 0 && (
                  <>
                    <span className="shrink-0 text-xs text-muted">Bannir :</span>
                    {result.suggestedBans.map((s) => {
                      const b = byId.get(s.id);
                      return b ? (
                        <button key={s.id} onClick={() => add("bans", s.id)} className="shrink-0">
                          <Icon b={b} size={38} />
                        </button>
                      ) : null;
                    })}
                  </>
                )
              ) : target === "allies" && quick.length > 0 ? (
                <>
                  <span className="shrink-0 text-xs text-accent">Top picks :</span>
                  {quick.map((r) => {
                    const b = byId.get(r.id);
                    return b ? (
                      <button key={r.id} onClick={() => add("allies", r.id)} className="shrink-0 text-center">
                        <Icon b={b} size={38} owned={owned?.get(r.id)} />
                        <span className="block text-[10px] text-muted">{pct(r.score, 0)}</span>
                      </button>
                    ) : null;
                  })}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Grille des brawlers */}
        <div className="card p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Entrée = ajoute le premier résultat disponible.
                if (e.key !== "Enter") return;
                const first = grid.find((b) => !taken.has(b.id));
                if (first && !targetFull) {
                  add(target, first.id);
                  setSearch("");
                }
              }}
              placeholder="Rechercher (Entrée = ajouter)…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2"
            />
            <Pills
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "score", label: "Meilleurs" },
                { value: "nom", label: "A-Z" },
              ]}
            />
            <Pills
              value={grouped ? "classe" : "tous"}
              onChange={(v) => setGrouped(v === "classe")}
              options={[
                { value: "classe", label: "Par classe" },
                { value: "tous", label: "Tous" },
              ]}
            />
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Ajouter à :</span>
            {SLOTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setTarget(s.key)}
                className={`rounded-md border px-2 py-1 font-semibold transition ${target === s.key ? "" : "border-line opacity-60 hover:opacity-100"}`}
                style={target === s.key ? { borderColor: s.color, color: s.color, background: `${s.color}1f` } : { color: s.color }}
              >
                {s.label} {picks[s.key].length}/{s.max}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-muted">
            {targetFull ? (
              <span className="text-accent">{t.label} : complet. Choisis une autre catégorie pour continuer.</span>
            ) : (
              <>
                Toucher = ajouter à <b style={{ color: t.color }}>{t.label}</b>
              </>
            )}
            {sortBy === "score" && " · du plus fort au plus faible dans ce draft"}
            {owned && " · chiffre = niveau de ton brawler s'il n'est pas au max · pâle = pas débloqué"}
          </p>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.key}>
                {g.label && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    {g.label} <span className="font-normal">· {g.list.length}</span>
                  </p>
                )}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                  {g.list.map((b) => {
                    const mine = owned?.get(b.id);
                    const locked = Boolean(owned && !mine && target === "allies");
                    return (
                      <button
                        key={b.id}
                        disabled={taken.has(b.id) || targetFull}
                        onClick={() => add(target, b.id)}
                        title={brawlerName(b.name, b.id)}
                        className={`transition enabled:hover:scale-110 disabled:cursor-not-allowed ${locked ? "opacity-40" : ""}`}
                      >
                        <Icon b={b} size={52} dim={taken.has(b.id)} owned={mine} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grid.length === 0 && <p className="text-sm text-muted">Aucun brawler trouvé.</p>}
          </div>
        </div>
      </div>

      {/* Recommandations */}
      <aside className={`min-w-0 space-y-5 transition ${loading ? "opacity-60" : ""}`}>
        {result && result.suggestedComp.length > 0 && (
          <section className="card border-accent/40 p-4">
            <h2 className="h-display mb-1 text-xl text-accent">Compo conseillée</h2>
            <p className="mb-3 text-xs text-muted">
              Ton équipe complétée avec les meilleurs choix restants{useOwned ? ", parmi tes brawlers" : ""}.
            </p>
            <div className="flex gap-2">
              {result.suggestedComp.map((id) => {
                const b = byId.get(id);
                if (!b) return null;
                const mine = picks.allies.includes(id);
                return (
                  <button key={id} onClick={() => !mine && add("allies", id)} className="text-center" disabled={mine}>
                    <Icon b={b} size={64} owned={owned?.get(id)} />
                    <span className="mt-1 block text-xs">{brawlerName(b.name, b.id)}</span>
                    {!mine && <span className="text-[10px] text-accent-2">+ choisir</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {result && result.suggestedBans.length > 0 && picks.bans.length < 6 && (
          <section className="card p-4">
            <h2 className="h-display mb-1 text-xl">Bans conseillés</h2>
            <p className="mb-3 text-xs text-muted">Les brawlers les plus forts sur cette map.</p>
            <div className="flex flex-wrap gap-2">
              {result.suggestedBans.map((s) => {
                const b = byId.get(s.id);
                return b ? (
                  <button key={s.id} onClick={() => add("bans", s.id)} className="text-center" title="Bannir">
                    <Icon b={b} size={44} />
                    <span className="text-[10px] text-muted">{pct(s.adj, 0)}</span>
                  </button>
                ) : null;
              })}
            </div>
          </section>
        )}

        {result && result.recommendations.length > 0 && (
          <section className="card p-4">
            <h2 className="h-display mb-3 text-xl">Meilleurs picks{useOwned ? " (tes brawlers)" : ""}</h2>
            <ol className="space-y-2">
              {result.recommendations.map((r) => {
                const b = byId.get(r.id);
                if (!b) return null;
                const mine = owned?.get(r.id);
                return (
                  <li key={r.id} className="flex items-start gap-3 rounded-lg p-1.5 hover:bg-surface-2">
                    <button onClick={() => add("allies", r.id)} title="Ajouter à mon équipe">
                      <Icon b={b} size={44} owned={mine} />
                    </button>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link href={`/brawlers/${r.id}`} className="font-semibold hover:text-accent">
                          {brawlerName(b.name, b.id)}
                        </Link>
                        <span className="font-bold">{pct(r.score)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                        <span>
                          Map {pct(r.base)} ({r.baseGames})
                        </span>
                        {r.synergyDetails.length > 0 && <Delta label="Synergie" value={r.synergy} />}
                        {r.counterDetails.length > 0 && <Delta label="Contre" value={r.counter} />}
                      </div>
                      {useOwned && <Personal r={r} owned={mine} />}
                      <Details
                        items={[...r.synergyDetails.map((f) => ({ ...f, kind: "avec" })), ...r.counterDetails.map((f) => ({ ...f, kind: "vs" }))]}
                        name={name}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {result && result.dataComps.length > 0 && (
          <section className="card p-4">
            <h2 className="h-display mb-1 text-xl">Compos qui gagnent ici</h2>
            <p className="mb-3 text-xs text-muted">Compos réellement jouées sur la map, compatibles avec ton draft.</p>
            <ul className="space-y-2">
              {result.dataComps.map((c) => (
                <li key={c.ids.join("-")} className="flex items-center gap-2">
                  {c.ids.map((id) => {
                    const b = byId.get(id);
                    return b ? <Icon key={id} b={b} size={36} /> : null;
                  })}
                  <span className="ml-auto text-right text-sm">
                    <b>{pct(c.adj)}</b>
                    <span className="block text-xs text-muted">{c.games} parties</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

function Pills<T extends string | null>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <span className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-sm ${value === o.value ? "bg-accent font-semibold text-bg" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** Part personnalisée du score : équipement du brawler et winrate perso. */
function Personal({ r, owned }: { r: DraftResult["recommendations"][number]; owned?: OwnedBrawler }) {
  const missing = owned
    ? [
        owned.power < MAX_POWER && `niveau ${owned.power}`,
        owned.gadgets === 0 && "pas de gadget",
        owned.starPowers === 0 && "pas de pouvoir star",
      ].filter(Boolean)
    : [];
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
      {missing.length > 0 ? (
        <span className="text-accent">
          ⚠ {missing.join(", ")} <span className="text-loss">{signedPct(r.build)}</span>
        </span>
      ) : (
        <span className="text-win">✓ Au max{owned && owned.hyperCharges > 0 ? " + hypercharge" : ""}</span>
      )}
      {r.personalGames > 0 ? (
        <span className="text-muted">
          Toi : {r.personalWins}/{r.personalGames} victoires{" "}
          <span className={r.personal >= 0 ? "text-win" : "text-loss"}>{signedPct(r.personal)}</span>
        </span>
      ) : (
        <span className="text-muted">Toi : pas encore de parties</span>
      )}
    </p>
  );
}

function AccountPanel({
  player,
  onPlayer,
  onlyMine,
  onOnlyMine,
}: {
  player: PlayerProfile | null;
  onPlayer: (p: PlayerProfile | null) => void;
  onlyMine: boolean;
  onOnlyMine: (v: boolean) => void;
}) {
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function link(raw: string) {
    setStatus("loading");
    try {
      const res = await fetch(`/api/player?tag=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onPlayer(data);
      store.set("bm-tag", data.tag);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setStatus("error");
    }
  }

  // Recharge le compte mémorisé (niveaux à jour à chaque visite).
  useEffect(() => {
    const saved = store.get("bm-tag");
    if (saved) link(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (player) {
    const maxed = player.brawlers.filter((b) => b.power >= MAX_POWER).length;
    return (
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
        <span>
          <b>{player.name}</b> <span className="text-muted">{player.tag}</span>
          <span className="block text-xs text-muted">
            {player.brawlers.length} brawlers · {maxed} au niveau 11 · {player.personal.games} parties perso
            enregistrées ({player.personal.games ? pct(player.personal.wins / player.personal.games, 0) : "–"} de victoires)
          </span>
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-2" title="Seulement tes brawlers, malus s'ils ne sont pas au max, bonus/malus selon ton winrate perso">
          <input type="checkbox" checked={onlyMine} onChange={(e) => onOnlyMine(e.target.checked)} className="accent-[#ffc93c]" />
          Conseils personnalisés
        </label>
        <button
          onClick={() => {
            onPlayer(null);
            store.set("bm-tag", null);
          }}
          className="text-xs text-muted hover:text-loss"
        >
          Délier
        </button>
      </div>
    );
  }

  return (
    <form
      className="card flex flex-wrap items-center gap-2 p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (tag.trim()) link(tag);
      }}
    >
      <span className="text-muted">Lier ton compte :</span>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="#TONTAG"
        autoCapitalize="characters"
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 uppercase"
      />
      <button disabled={status === "loading"} className="rounded-lg bg-accent px-4 py-2 font-semibold text-bg disabled:opacity-60">
        {status === "loading" ? "…" : "Lier"}
      </button>
      <span className="w-full text-xs text-muted">
        {status === "error" ? (
          <span className="text-loss">{error}</span>
        ) : (
          "Ton tag est sur ton profil en jeu, sous ton pseudo. Le site ne te conseillera que les brawlers que tu as et signalera ceux qui ne sont pas au max."
        )}
      </span>
    </form>
  );
}

function Delta({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label} <span className={value >= 0 ? "text-win" : "text-loss"}>{signedPct(value)}</span>
    </span>
  );
}

function Details({ items, name }: { items: (Factor & { kind: string })[]; name: (id: number) => string }) {
  const notable = items.filter((f) => Math.abs(f.delta) >= 0.01).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (notable.length === 0) return null;
  return (
    <p className="mt-0.5 text-[11px] text-muted">
      {notable.slice(0, 3).map((f, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <span className={f.delta >= 0 ? "text-win" : "text-loss"}>{signedPct(f.delta)}</span> {f.kind} {name(f.id)}
        </span>
      ))}
    </p>
  );
}

function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: MapOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = maps.find((m) => m.id === value) ?? null;

  const q = searchKey(query.trim());
  const results = maps.filter((m) => !q || searchKey(mapName(m.name), m.name, modeInfo(m.mode).label).includes(q));
  const byMode = Map.groupBy(results, (m) => m.mode);

  function choose(id: number | null) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        {selected && (
          <span
            className="h-11 w-11 shrink-0 overflow-hidden rounded-lg [&>*]:h-full [&>*]:w-full"
            style={{ background: `${modeInfo(selected.mode).color}33` }}
          >
            <SafeImg src={mapImg(selected.id)} alt={mapName(selected.name)} className="object-cover" fallback="🗺" />
          </span>
        )}
        <input
          value={open ? query : selected ? `${mapName(selected.name)} · ${modeInfo(selected.mode).label}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) choose(results[0].id);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Rechercher une map ou un mode (ex. : prime, cercle de feu)…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2"
        />
        {selected && (
          <button onClick={() => choose(null)} className="text-sm text-muted hover:text-ink" title="Toutes les maps">
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-2xl">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(null)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-2"
          >
            Toutes les maps (stats globales)
          </button>
          {results.length === 0 && <p className="px-3 py-2 text-sm text-muted">Aucune map trouvée.</p>}
          {[...byMode].map(([mode, list]) => (
            <div key={mode}>
              <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: modeInfo(mode).color }}>
                {modeInfo(mode).label}
              </p>
              {list.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(m.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left hover:bg-surface-2 ${m.id === value ? "bg-surface-2" : ""}`}
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded [&>*]:h-full [&>*]:w-full">
                    <SafeImg src={mapImg(m.id)} alt={mapName(m.name)} className="object-cover" fallback="🗺" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{mapName(m.name)}</span>
                    {mapName(m.name) !== m.name && <span className="block truncate text-xs text-muted">{m.name}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
