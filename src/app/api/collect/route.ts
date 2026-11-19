import { connection } from "next/server";
import { collectStatus, startCollect, stopCollect } from "@/lib/collect-runner";

/** État de la collecte (interrogé régulièrement par le bouton). */
export async function GET() {
  await connection();
  return Response.json(collectStatus());
}

/** { action: "start" | "stop" } */
export async function POST(req: Request) {
  // Seul le site lui-même peut lancer une collecte (pas un autre site ouvert dans le navigateur).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return Response.json({ error: "Origine refusée." }, { status: 403 });
  }
  let action = "start";
  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action === "stop") action = "stop";
  } catch {}
  if (action === "stop") {
    stopCollect();
    return Response.json(collectStatus());
  }
  const res = startCollect();
  if (!res.ok) return Response.json({ ...collectStatus(), error: res.error }, { status: 409 });
  return Response.json(collectStatus());
}
