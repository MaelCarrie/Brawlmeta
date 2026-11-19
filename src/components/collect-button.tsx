"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CollectStatus } from "@/lib/collect-runner";

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Bouton du bandeau : lance `npm run collect` depuis le site et affiche la progression. */
export function CollectButton() {
  const router = useRouter();
  const [status, setStatus] = useState<CollectStatus | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const wasRunning = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/collect", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  // Pendant une collecte : rafraîchit l'état toutes les 2 s.
  const running = status?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running]);

  // Fin de collecte : recharge les données de la page affichée.
  useEffect(() => {
    if (wasRunning.current && !running) router.refresh();
    wasRunning.current = running;
  }, [running, router]);

  // Ferme le panneau en cliquant ailleurs.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function send(action: "start" | "stop") {
    setError("");
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      setStatus(data);
      if (action === "start" && res.ok) setOpen(true);
    } catch {
      setError("Impossible de joindre le serveur.");
    }
  }

  if (!status || !status.enabled) return null;

  const p = status.progress;
  const pctDone = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : null;
  const failed = !running && status.exitCode !== null && status.exitCode !== 0;
  const label = running
    ? pctDone !== null
      ? `Collecte… ${pctDone} %`
      : "Collecte…"
    : "Mettre à jour";

  return (
    <div ref={box} className="relative ml-auto">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
          running ? "border-accent/50 text-accent" : "border-line text-muted hover:text-ink"
        }`}
        title={
          status.hasKey
            ? `Récupère les dernières parties via l'API (comme npm run collect)${status.lastCollect ? ` · dernière collecte ${ago(status.lastCollect)}` : ""}`
            : "Ajoute ta clé API dans .env pour mettre à jour les données"
        }
      >
        <span className={running ? "inline-block animate-spin" : ""} aria-hidden>
          ⟳
        </span>
        {label}
        {failed && <span className="text-loss" title="La dernière collecte a échoué">!</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-lg border border-line bg-surface p-3 text-xs shadow-2xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-semibold text-ink">
              {running ? "Collecte en cours" : failed ? "Dernière collecte : échec" : "Collecte des données"}
            </span>
            <span className="ml-auto text-muted">
              {status.lastCollect ? `Dernière réussie ${ago(status.lastCollect)}` : "Jamais lancée"}
            </span>
          </div>
          {running && pctDone !== null && (
            <div className="mb-2 h-1.5 overflow-hidden rounded bg-surface-2">
              <div className="h-full bg-accent transition-all" style={{ width: `${pctDone}%` }} />
            </div>
          )}
          {!status.hasKey && <p className="mb-2 text-loss">Ajoute BS_API_KEY dans .env, puis redémarre le site.</p>}
          {error && <p className="mb-2 text-loss">{error}</p>}
          {status.log.length > 0 ? (
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[11px] leading-4 text-muted">
              {status.log.join("\n")}
            </pre>
          ) : (
            <p className="text-muted">
              Récupère les dernières parties des meilleurs joueurs (plusieurs minutes). Le site reste utilisable pendant
              la collecte ; les pages se mettent à jour à la fin.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            {running ? (
              <button onClick={() => send("stop")} className="rounded-md border border-line px-3 py-1 text-muted hover:text-loss">
                Arrêter
              </button>
            ) : (
              <button
                onClick={() => send("start")}
                disabled={!status.hasKey}
                className="rounded-md bg-accent px-3 py-1 font-semibold text-bg disabled:opacity-50"
              >
                Lancer la collecte
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
