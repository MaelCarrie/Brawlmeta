import { BrawlerIcon, WinRate } from "./ui";
import { pct } from "@/lib/format";
import type { CompStat } from "@/lib/stats";

export function CompList({ comps, names }: { comps: CompStat[]; names: Map<number, string> }) {
  if (comps.length === 0) {
    return <p className="text-sm text-muted">Pas encore assez de parties pour classer des compos.</p>;
  }
  return (
    <ol className="space-y-2">
      {comps.map((c, i) => (
        <li key={c.ids.join("-")} className="card flex items-center gap-3 p-2.5">
          <span className="h-display w-6 text-center text-lg text-muted">{i + 1}</span>
          <span className="flex gap-1.5">
            {c.ids.map((id) => (
              <BrawlerIcon key={id} id={id} name={names.get(id) ?? String(id)} size={44} />
            ))}
          </span>
          <span className="ml-auto text-right text-sm">
            <span className="block font-semibold">{pct(c.adj)}</span>
            <span className="block text-xs text-muted">
              <WinRate value={c.winRate} /> sur {c.games} parties
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
