import Link from "next/link";
import { SafeImg } from "./safe-img";
import { ModeBadge } from "./ui";
import { mapImg, mapName, modeInfo, type Queue } from "@/lib/format";
import type { MapRow } from "@/lib/stats";

export function MapCard({ map, queue = "classe" }: { map: MapRow; queue?: Queue }) {
  const fr = mapName(map.name);
  return (
    <Link
      href={`/maps/${map.id}${queue === "trophees" ? "?file=trophees" : ""}`}
      className="card group flex items-center gap-3 overflow-hidden p-2 transition hover:border-accent/60"
    >
      <span
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg [&>*]:h-full [&>*]:w-full"
        style={{ background: `${modeInfo(map.mode).color}33` }}
      >
        <SafeImg src={mapImg(map.id)} alt={fr} className="object-cover" fallback="🗺" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold group-hover:text-accent">{fr}</span>
        {fr !== map.name && <span className="block truncate text-xs text-muted">{map.name}</span>}
        <span className="mt-0.5 flex items-center gap-2">
          <ModeBadge mode={map.mode} />
          <span className="text-xs text-muted">{map.games.toLocaleString("fr-FR")} parties</span>
        </span>
      </span>
    </Link>
  );
}
