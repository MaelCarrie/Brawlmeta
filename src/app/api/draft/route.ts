import { recommendDraft } from "@/lib/draft";
import { normalizeTag, type OwnedBrawler } from "@/lib/player";
import { parseDays, parseQueue } from "@/lib/stats";

const int = (v: unknown) => (Number.isInteger(Number(v)) ? Number(v) : 0);

function parsePlayer(v: unknown): { tag: string; brawlers: OwnedBrawler[] } | null {
  if (!v || typeof v !== "object") return null;
  const p = v as { tag?: unknown; brawlers?: unknown };
  const tag = normalizeTag(String(p.tag ?? ""));
  if (!tag || !Array.isArray(p.brawlers)) return null;
  const brawlers = p.brawlers.slice(0, 500).map((b: Record<string, unknown>) => ({
    id: int(b.id),
    power: int(b.power),
    gadgets: int(b.gadgets),
    starPowers: int(b.starPowers),
    gears: int(b.gears),
    hyperCharges: int(b.hyperCharges),
  }));
  return { tag: `#${tag}`, brawlers };
}

const ids = (v: unknown, max: number): number[] =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter(Number.isInteger))].slice(0, max) : [];

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  const mapId = Number(body.mapId);
  const result = recommendDraft({
    mapId: Number.isInteger(mapId) && mapId > 0 ? mapId : null,
    bans: ids(body.bans, 6),
    allies: ids(body.allies, 3),
    enemies: ids(body.enemies, 3),
    player: parsePlayer(body.player),
    filter: {
      days: parseDays(String(body.days ?? "")),
      queue: parseQueue(String(body.queue ?? "")),
      mode: null,
    },
  });
  return Response.json(result);
}
