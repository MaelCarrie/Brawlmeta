import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { MapCard } from "@/components/map-card";
import { EmptyState, Loading, PageTitle } from "@/components/ui";
import { modeInfo, queueLabel } from "@/lib/format";
import { mapPool, parseFilter } from "@/lib/stats";
import { availableModes } from "@/lib/stats";

export const metadata: Metadata = { title: "Maps" };

export default function MapsPage({ searchParams }: PageProps<"/maps">) {
  return (
    <Suspense fallback={<Loading />}>
      <MapsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MapsContent({ searchParams }: { searchParams: PageProps<"/maps">["searchParams"] }) {
  const f = parseFilter(await searchParams);
  await connection();
  const maps = mapPool(f);
  const byMode = Map.groupBy(maps, (m) => m.mode);

  return (
    <>
      <PageTitle
        title={`Maps ${f.queue === "classe" ? "classées" : "en trophées"}`}
        subtitle={`Les maps jouées en ${queueLabel(f.queue).toLowerCase()} sur la période. Clique sur une map pour voir sa tier list et ses meilleures compos.`}
      />
      <FilterBar basePath="/maps" filter={f} modes={availableModes(f)} />
      {maps.length === 0 && <EmptyState>Aucune map pour ces filtres.</EmptyState>}
      <div className="space-y-8">
        {[...byMode].map(([mode, list]) => (
          <section key={mode}>
            <h2 className="h-display mb-3 text-2xl" style={{ color: modeInfo(mode).color }}>
              {modeInfo(mode).label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <MapCard key={m.id} map={m} queue={f.queue} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
