import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PatchChange } from "@/components/patch-change";
import { FilterBar, filterHref } from "@/components/filter-bar";
import { BrawlerIcon, Loading, ModeBadge, TierBadge, WinRate } from "@/components/ui";
import { changesForBrawler } from "@/lib/balance";
import { BRAWLER_CLASSES, brawlerClass, brawlerName, englishName, formatDate, isShowdown, mapName, modeInfo, pct, queueLabel, SHOWDOWN_NOTE, signedPct, type Filter } from "@/lib/format";
import { allBrawlers, brawlerInfo, brawlerMaps, brawlerStats, pairStats, parseFilter, shrink } from "@/lib/stats";
import { availableModes } from "@/lib/stats";

export default function BrawlerPage(props: PageProps<"/brawlers/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <BrawlerContent {...props} />
    </Suspense>
  );
}

type Rel = { id: number; delta: number; games: number; winRate: number };

async function BrawlerContent({ params, searchParams }: PageProps<"/brawlers/[id]">) {
  const id = Number((await params).id);
  const f = parseFilter(await searchParams);
  await connection();
  const info = brawlerInfo(id);
  if (!info) notFound();

  const all = brawlerStats(f);
  const me = all.find((s) => s.id === id);
  const base = me?.adj ?? 0.5;
  const names = new Map(allBrawlers().map((b) => [b.id, b.name]));
  const maps = brawlerMaps(id, f);

  // Écart au taux de victoire habituel du brawler, avec ou contre chaque autre brawler.
  const rel = (sameTeam: boolean): Rel[] =>
    pairStats(id, f, sameTeam)
      .filter((r) => r.games >= 5)
      .map((r) => ({
        id: r.id,
        games: r.games,
        winRate: r.wins / r.games,
        delta: shrink(r.wins, r.games, base, 20) - base,
      }))
      .sort((a, b) => b.delta - a.delta);
  const mates = rel(true);
  const versus = rel(false);
  const changes = await changesForBrawler(info.name);

  return (
    <>
      <Link href={filterHref("/meta", f, {})} className="text-sm text-muted hover:text-ink">← Tier list</Link>
      <div className="mb-8 mt-3 flex flex-wrap items-center gap-5">
        <BrawlerIcon id={id} name={info.name} size={96} link={false} />
        <div className="flex-1">
          <h1 className="h-display text-5xl">{brawlerName(info.name, info.id)}</h1>
          <p className="text-sm text-muted">
            {BRAWLER_CLASSES.find((c) => c.key === brawlerClass(info.id))?.label}
            {brawlerName(info.name, info.id) !== englishName(info.name) && <> · en anglais : {englishName(info.name)}</>}
          </p>
          {me ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2">Tier <TierBadge tier={me.tier} /></span>
              <span>Score <b>{pct(me.adj)}</b></span>
              <span>Victoires <WinRate value={me.winRate} /></span>
              <span>Présence <b>{pct(me.pickRate)}</b></span>
              <span className="text-muted">{me.games.toLocaleString("fr-FR")} parties</span>
            </div>
          ) : (
            <p className="mt-2 text-muted">Pas de parties classées sur cette période.</p>
          )}
        </div>
      </div>
      <FilterBar basePath={`/brawlers/${id}`} filter={f} modes={availableModes(f)} />
      <p className="-mt-3 mb-6 text-sm text-muted">
        Stats en {queueLabel(f.queue).toLowerCase()}
        {f.mode ? `, ${modeInfo(f.mode).label}` : ", tous modes en équipes"}, sur {f.days} jours.
        {isShowdown(f.mode) && ` ${SHOWDOWN_NOTE}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="h-display mb-3 text-xl">Meilleures maps</h2>
          <MapRows rows={maps.slice(0, 6)} f={f} />
        </section>
        <section className="card p-5">
          <h2 className="h-display mb-3 text-xl">Maps à éviter</h2>
          <MapRows rows={maps.slice(Math.max(6, maps.length - 6)).reverse()} f={f} />
        </section>
        <section className="card p-5">
          <h2 className="h-display mb-1 text-xl">Meilleurs coéquipiers</h2>
          <p className="mb-3 text-xs text-muted">Écart par rapport à son taux de victoire habituel.</p>
          <RelRows rows={mates.slice(0, 6)} names={names} />
        </section>
        <section className="card p-5">
          <h2 className="h-display mb-1 text-xl">Matchups</h2>
          <p className="mb-3 text-xs text-muted">Contre qui il gagne le plus (en haut) et le moins (en bas).</p>
          <RelRows rows={versus.slice(0, 4)} names={names} />
          <hr className="my-3 border-line" />
          <RelRows rows={versus.slice(Math.max(4, versus.length - 4))} names={names} />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="h-display mb-3 text-2xl">Historique d&apos;équilibrage</h2>
        {changes.length === 0 ? (
          <p className="text-sm text-muted">Aucun changement enregistré pour ce brawler.</p>
        ) : (
          <ul className="space-y-2">
            {changes.map((c, i) => (
              <li key={i} className="card p-3">
                <p className="mb-1 text-xs text-muted">
                  {c.patch.version} · {formatDate(Date.parse(c.patch.date))}
                  {c.patch.exemple && " · exemple"}
                </p>
                <PatchChange change={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function MapRows({ rows, f }: { rows: ReturnType<typeof brawlerMaps>; f: Filter }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Pas de données.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((m) => (
        <li key={m.id} className="flex items-center gap-2">
          <Link href={filterHref(`/maps/${m.id}`, f, { mode: null })} className="truncate font-medium hover:text-accent" title={m.name}>
            {mapName(m.name)}
          </Link>
          <ModeBadge mode={m.mode} />
          <span className="ml-auto font-semibold">{pct(m.adj)}</span>
          <span className="w-20 text-right text-xs text-muted">{m.games} parties</span>
        </li>
      ))}
    </ul>
  );
}

function RelRows({ rows, names }: { rows: Rel[]; names: Map<number, string> }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Pas assez de données.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2">
          <BrawlerIcon id={r.id} name={names.get(r.id) ?? ""} size={30} />
          <span className="font-medium">{brawlerName(names.get(r.id) ?? String(r.id), r.id)}</span>
          <span className={`ml-auto font-semibold ${r.delta >= 0 ? "text-win" : "text-loss"}`}>{signedPct(r.delta)}</span>
          <span className="w-20 text-right text-xs text-muted">{r.games} parties</span>
        </li>
      ))}
    </ul>
  );
}
