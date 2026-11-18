import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DraftTool } from "@/components/draft-tool";
import { EmptyState, Loading, PageTitle } from "@/components/ui";
import { isShowdown } from "@/lib/format";
import { allBrawlers, DEFAULT_DAYS, mapPool, parseQueue } from "@/lib/stats";

export const metadata: Metadata = { title: "Assistant draft" };

export default function DraftPage({ searchParams }: PageProps<"/draft">) {
  return (
    <>
      <PageTitle
        title="Assistant draft"
        subtitle="Choisis Classé ou Trophées, cherche ta map, puis entre les bans et les picks au fur et à mesure. Le site te propose les meilleurs choix restants et la meilleure compo possible."
      />
      <Suspense fallback={<Loading />}>
        <DraftLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DraftLoader({ searchParams }: { searchParams: PageProps<"/draft">["searchParams"] }) {
  const sp = await searchParams;
  const initialMap = Number(sp.map) || null;
  const initialQueue = parseQueue(sp.file);
  await connection();
  const brawlers = allBrawlers();
  const maps = {
    classe: mapPool({ days: DEFAULT_DAYS, queue: "classe", mode: null }, 1),
    // Pas de draft en Survivant : on ne garde que les modes en équipes.
    trophees: mapPool({ days: DEFAULT_DAYS, queue: "trophees", mode: null }, 1).filter((m) => !isShowdown(m.mode)),
  };
  if (brawlers.length === 0) {
    return <EmptyState>Aucun brawler en base. Lance <code>npm run collect</code> (ou <code>npm run demo</code>).</EmptyState>;
  }
  return <DraftTool brawlers={brawlers} maps={maps} initialMap={initialMap} initialQueue={initialQueue} />;
}
