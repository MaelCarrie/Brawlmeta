import { readFile } from "node:fs/promises";
import path from "node:path";

export type ChangeType = "buff" | "nerf" | "rework" | "ajustement";
export type BalanceChange = { brawler: string; type: ChangeType; text: string };
export type Patch = {
  version: string;
  date: string;
  title: string;
  source?: string;
  exemple?: boolean;
  changes: BalanceChange[];
};

export const CHANGE_STYLES: Record<ChangeType, { label: string; color: string; icon: string }> = {
  buff: { label: "Buff", color: "#22c55e", icon: "▲" },
  nerf: { label: "Nerf", color: "#ef4444", icon: "▼" },
  rework: { label: "Rework", color: "#a855f7", icon: "↻" },
  ajustement: { label: "Ajustement", color: "#eab308", icon: "◆" },
};

/** Lu à chaque requête : on peut modifier le JSON sans redémarrer le site. */
export async function getPatches(): Promise<Patch[]> {
  const file = path.join(process.cwd(), "content", "balance-changes.json");
  const data = JSON.parse(await readFile(file, "utf8")) as { patches: Patch[] };
  return [...data.patches].sort((a, b) => b.date.localeCompare(a.date));
}

const norm = (s: string) => s.trim().toUpperCase();

export async function changesForBrawler(name: string) {
  return (await getPatches()).flatMap((p) =>
    p.changes.filter((c) => norm(c.brawler) === norm(name)).map((c) => ({ ...c, patch: p })),
  );
}
