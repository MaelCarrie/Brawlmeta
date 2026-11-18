import { fetchPlayer, normalizeTag, PlayerError } from "@/lib/player";

export async function GET(req: Request) {
  const tag = normalizeTag(new URL(req.url).searchParams.get("tag") ?? "");
  if (!tag) return Response.json({ error: "Tag invalide (ex. : #2PP0LQ8Y)." }, { status: 400 });
  try {
    return Response.json(await fetchPlayer(tag));
  } catch (e) {
    const status = e instanceof PlayerError ? e.status : 502;
    const error = e instanceof PlayerError ? e.message : "Impossible de joindre l'API Brawl Stars.";
    return Response.json({ error }, { status });
  }
}
