import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MapCard } from "@/components/map-card";
import { PatchChange } from "@/components/patch-change";
import { BrawlerIcon, Loading, TierBadge, WinRate } from "@/components/ui";
import { getPatches } from "@/lib/balance";
import { brawlerName, formatDate, pct } from "@/lib/format";
import { allBrawlers, brawlerStats, DEFAULT_DAYS, mapPool, overview, type Filter } from "@/lib/stats";

export default function Home() {
  return (
    <>
      <section className="mb-10">
        <h1 className="h-display text-5xl leading-tight sm:text-6xl">
          La méta du <span className="text-accent">classé</span>, map par map.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Tier list calculée sur les parties classées des meilleurs joueurs, meilleures compos pour chaque map,
          buffs et nerfs, et un assistant pour réussir ton draft.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/draft" className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-bg hover:brightness-110">
            Lancer l&apos;assistant draft
          </Link>
          <Link href="/meta" className="rounded-lg border border-line px-5 py-2.5 font-semibold hover:bg-surface-2">
            Voir la tier list
          </Link>
        </div>
      </section>
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await connection();
  const days = DEFAULT_DAYS;
  const f: Filter = { days, queue: "classe", mode: null };
  const info = overview(f);
  const stats = brawlerStats(f);
  const top = stats.filter((s) => s.tier === "S" || s.tier === "A").slice(0, 8);
  const maps = mapPool(f).slice(0, 6);
  const patch = (await getPatches())[0];
  const ids = new Map(allBrawlers().map((b) => [b.name.toUpperCase(), b.id]));

  return (
    <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Parties classées analysées" value={info.battles.toLocaleString("fr-FR")} sub={`${days} derniers jours`} />
        <Stat label="Brawlers classés" value={String(stats.filter((s) => s.tier).length)} />
        <Stat
          label="Dernière collecte"
          value={info.lastCollect ? formatDate(info.lastCollect) : info.demo ? "Démo" : "Jamais"}
          sub={info.lastTime ? `partie la plus récente : ${formatDate(info.lastTime)}` : undefined}
        />
      </div>

      <section>
        <SectionHead title="Les plus forts en classé" href="/meta" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((s) => (
            <Link key={s.id} href={`/brawlers/${s.id}`} className="card flex items-center gap-3 p-3 transition hover:border-accent/60">
              <BrawlerIcon id={s.id} name={s.name} size={48} link={false} />
              <span className="flex-1">
                <span className="block font-semibold">{brawlerName(s.name)}</span>
                <span className="text-xs text-muted">
                  <WinRate value={s.winRate} /> · présence {pct(s.pickRate)}
                </span>
              </span>
              <TierBadge tier={s.tier} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHead title="Maps classées les plus jouées" href="/maps" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((m) => (
            <MapCard key={m.id} map={m} />
          ))}
        </div>
      </section>

      {patch && (
        <section>
          <SectionHead title={`Dernière mise à jour : ${patch.version}`} href="/patchs" />
          <ul className="card divide-y divide-line">
            {patch.changes.slice(0, 5).map((c, i) => (
              <li key={i} className="flex items-center gap-3 p-3">
                {ids.get(c.brawler.toUpperCase()) && (
                  <BrawlerIcon id={ids.get(c.brawler.toUpperCase())!} name={c.brawler} size={36} />
                )}
                <span className="w-28 shrink-0 font-semibold">{brawlerName(c.brawler)}</span>
                <PatchChange change={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="h-display mt-1 text-3xl">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="h-display text-2xl">{title}</h2>
      <Link href={href} className="text-sm text-accent-2 hover:underline">Tout voir →</Link>
    </div>
  );
}
