import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrawlerTable } from "@/components/brawler-table";
import { FilterBar } from "@/components/filter-bar";
import { TierList } from "@/components/tier-list";
import { EmptyState, Loading, PageTitle } from "@/components/ui";
import { isShowdown, modeInfo, queueLabel, SHOWDOWN_NOTE } from "@/lib/format";
import { brawlerStats, overview, parseFilter } from "@/lib/stats";
import { availableModes } from "@/lib/stats";

export const metadata: Metadata = { title: "Tier list" };

export default function MetaPage({ searchParams }: PageProps<"/meta">) {
  return (
    <Suspense fallback={<Loading />}>
      <MetaContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MetaContent({ searchParams }: { searchParams: PageProps<"/meta">["searchParams"] }) {
  const f = parseFilter(await searchParams);
  await connection();
  const stats = brawlerStats(f);
  const info = overview(f);
  const scope = f.mode ? ` en ${modeInfo(f.mode).label}` : "";

  return (
    <>
      <PageTitle
        title={`Tier list ${queueLabel(f.queue).toLowerCase()}${scope}`}
        subtitle={`Basée sur ${info.battles.toLocaleString("fr-FR")} parties (${queueLabel(f.queue).toLowerCase()}${scope}) des ${f.days} derniers jours. Le score est le taux de victoire corrigé : un brawler peu joué est ramené vers sa moyenne tant qu'il n'a pas assez de parties.`}
      />
      <FilterBar basePath="/meta" filter={f} modes={availableModes(f)} />
      {isShowdown(f.mode) && <p className="-mt-3 mb-6 text-sm text-muted">{SHOWDOWN_NOTE}</p>}
      {stats.length === 0 ? (
        <EmptyState>Aucune partie pour ces filtres. Lance une collecte avec <code>npm run collect</code>.</EmptyState>
      ) : (
        <div className="space-y-8">
          <TierList stats={stats} />
          <section>
            <h2 className="h-display mb-3 text-2xl">Tous les brawlers</h2>
            <BrawlerTable stats={stats} />
          </section>
        </div>
      )}
    </>
  );
}
