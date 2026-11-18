// Gestion de plusieurs clés API : une clé Supercell n'autorise que certaines IP.
// On peut en mettre plusieurs dans BS_API_KEY, séparées par des virgules (maison,
// école…) : la première qui accepte l'IP actuelle est utilisée et mémorisée.

const KEYS = (process.env.BS_API_KEY ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let current = 0;

export const hasApiKey = KEYS.length > 0;

/** fetch authentifié qui essaie les clés suivantes si l'IP est refusée. */
export async function apiFetch(url: string): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (current + i) % KEYS.length;
    res = await fetch(url, { headers: { Authorization: `Bearer ${KEYS[idx]}` }, cache: "no-store" });
    if (res.status !== 403) {
      current = idx;
      return res;
    }
  }
  return res ?? new Response(JSON.stringify({ reason: "noKey" }), { status: 403 });
}
