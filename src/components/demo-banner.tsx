import { connection } from "next/server";
import { getMeta } from "@/lib/db";

export async function DemoBanner() {
  await connection();
  if (getMeta("demo") !== "1") return null;
  return (
    <div className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-accent">
      Données de démonstration (fictives). Ajoute ta clé API dans <code>.env</code> puis lance{" "}
      <code className="rounded bg-black/30 px-1">npm run collect</code> pour afficher la vraie méta.
    </div>
  );
}
