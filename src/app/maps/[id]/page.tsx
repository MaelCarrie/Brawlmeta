import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrawlerTable } from "@/components/brawler-table";
import { CompList } from "@/components/comp-list";
import { SafeImg } from "@/components/safe-img";
import { TierList } from "@/components/tier-list";
import { FilterBar } from "@/components/filter-bar";
import { Loading, ModeBadge } from "@/components/ui";
import { isShowdown, mapImg, mapName, modeInfo, queueLabel, SHOWDOWN_NOTE } from "@/lib/format";
import { allBrawlers, brawlerStats, compStats, mapInfo, mapPool, overview, parseFilter } from "@/lib/stats";

export default function MapPage(props: PageProps<"/maps/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <MapContent {...props} />
    </Suspense>
  );
}

async function MapContent({ params, searchParams }: PageProps<"/maps/[id]">) {
  const id = Number((await params).id);
  const f = { ...parseFilter(await searchParams), mode: null };
  await connection();
  const map = mapInfo(id);
  if (!map) notFound();

  const stats = brawlerStats(f, id);
  const comps = compStats(f, id, { minGames: 3, limit: 10 });
  const names = new Map(allBrawlers().map((b) => [b.id, b.name]));
  const showdown = isShowdown(map.mode);
  const games = mapPool(f, 1).find((m) => m.id === id)?.games ?? 0;
  // Survivant solo : chaque joueur est seul, il n'y a pas de compo à classer.
  const teamSize = map.mode === "trioShowdown" ? 3 : /duo/i.test(map.mode) ? 2 : showdown ? 1 : 3;
  const compTitle = teamSize === 2 ? "Meilleurs duos" : showdown && teamSize === 3 ? "Meilleurs trios" : "Meilleures compos";
  const { demo } = overview(f);
  const fr = mapName(map.name);

  return (
    <>
      <Link href={f.queue === "trophees" ? "/maps?file=trophees" : "/maps"} className="text-sm text-muted hover:text-ink">
        ← Toutes les maps
      </Link>
      <div className="mb-8 mt-3 flex flex-wrap items-center gap-5">
        <span
          className="h-28 w-28 overflow-hidden rounded-xl border border-line [&>*]:h-full [&>*]:w-full"
          style={{ background: `${modeInfo(map.mode).color}33` }}
        >
          <SafeImg src={mapImg(map.id)} alt={fr} className="object-cover" fallback="🗺" />
        </span>
        <div className="flex-1">
          <ModeBadge mode={map.mode} />
          <h1 className="h-display mt-1 text-4xl">{fr}</h1>
          {fr !== map.name && <p className="text-sm text-muted">{map.name}</p>}
          <p className="text-muted">
            {Math.round(games).toLocaleString("fr-FR")} parties en {queueLabel(f.queue).toLowerCase()} sur {f.days} jours
            {demo && " (démo)"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 self-end">
          {!showdown && (
            <Link
              href={`/draft?map=${id}${f.queue === "trophees" ? "&file=trophees" : ""}`}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:brightness-110"
            >
              Préparer un draft sur cette map →
            </Link>
          )}
        </div>
      </div>

      <FilterBar basePath={`/maps/${id}`} filter={f} show={{ queue: true, days: true }} />
      {showdown && <p className="-mt-3 mb-6 text-sm text-muted">{SHOWDOWN_NOTE}</p>}
      <div className={`grid gap-8 ${teamSize > 1 ? "lg:grid-cols-[1fr_380px]" : ""}`}>
        <section>
          <h2 className="h-display mb-3 text-2xl">Tier list de la map</h2>
          <TierList stats={stats} size={46} />
        </section>
        {teamSize > 1 && (
          <section>
            <h2 className="h-display mb-3 text-2xl">{compTitle}</h2>
            <CompList comps={comps} names={names} />
          </section>
        )}
      </div>
      <section className="mt-8">
        <h2 className="h-display mb-3 text-2xl">Détail par brawler</h2>
        <BrawlerTable stats={stats} />
      </section>
    </>
  );
}
