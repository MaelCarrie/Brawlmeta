import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PatchChange } from "@/components/patch-change";
import { BrawlerIcon, EmptyState, Loading, PageTitle } from "@/components/ui";
import { CHANGE_STYLES, getPatches, type ChangeType } from "@/lib/balance";
import { brawlerName, formatDate } from "@/lib/format";
import { allBrawlers } from "@/lib/stats";

export const metadata: Metadata = { title: "Buffs & nerfs" };

export default function PatchsPage({ searchParams }: PageProps<"/patchs">) {
  return (
    <>
      <PageTitle
        title="Buffs & nerfs"
        subtitle="Les changements d'équilibrage de chaque mise à jour. Les données viennent du fichier content/balance-changes.json."
      />
      <Suspense fallback={<Loading />}>
        <PatchList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PatchList({ searchParams }: { searchParams: PageProps<"/patchs">["searchParams"] }) {
  const raw = (await searchParams).type;
  const filter = (typeof raw === "string" && raw in CHANGE_STYLES ? raw : null) as ChangeType | null;
  await connection();
  const patches = await getPatches();
  const ids = new Map(allBrawlers().map((b) => [b.name.toUpperCase(), b.id]));

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <FilterLink active={!filter} href="/patchs" label="Tout" />
        {(Object.keys(CHANGE_STYLES) as ChangeType[]).map((t) => (
          <FilterLink key={t} active={filter === t} href={`/patchs?type=${t}`} label={CHANGE_STYLES[t].label} color={CHANGE_STYLES[t].color} />
        ))}
      </div>
      {patches.length === 0 && <EmptyState>Aucune mise à jour enregistrée.</EmptyState>}
      <div className="space-y-8">
        {patches.map((p) => {
          const changes = p.changes.filter((c) => !filter || c.type === filter);
          if (changes.length === 0) return null;
          return (
            <section key={p.version + p.date}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                <h2 className="h-display text-2xl">{p.version}</h2>
                <span className="text-sm text-muted">{formatDate(Date.parse(p.date))}</span>
                {p.exemple && (
                  <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    Exemple à remplacer
                  </span>
                )}
                {p.source && (
                  <a href={p.source} target="_blank" rel="noreferrer" className="text-sm text-accent-2 hover:underline">
                    Source ↗
                  </a>
                )}
              </div>
              <p className="mb-3 text-muted">{p.title}</p>
              <ul className="card divide-y divide-line">
                {changes.map((c, i) => {
                  const id = ids.get(c.brawler.toUpperCase());
                  return (
                    <li key={i} className="flex items-center gap-3 p-3">
                      {id ? <BrawlerIcon id={id} name={c.brawler} size={40} /> : <span className="h-10 w-10 rounded-lg bg-surface-2" />}
                      <div className="min-w-0">
                        <p className="font-semibold">{brawlerName(c.brawler)}</p>
                        <PatchChange change={c} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function FilterLink({ href, label, active, color }: { href: string; label: string; active: boolean; color?: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-1.5 ${active ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"}`}
      style={active && color ? { borderColor: color } : undefined}
    >
      {label}
    </Link>
  );
}
