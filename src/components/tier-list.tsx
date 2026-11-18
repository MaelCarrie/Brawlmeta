import { BrawlerIcon, TierBadge } from "./ui";
import { pct } from "@/lib/format";
import type { BrawlerStat, Tier } from "@/lib/stats";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];

export function TierList({ stats, size = 52 }: { stats: BrawlerStat[]; size?: number }) {
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {TIERS.map((tier) => {
        const list = stats.filter((s) => s.tier === tier);
        return (
          <div key={tier} className="flex items-stretch">
            <div className="flex w-20 shrink-0 items-center justify-center bg-surface-2/60">
              <TierBadge tier={tier} size="lg" />
            </div>
            <div className="flex min-h-16 flex-1 flex-wrap items-center gap-2 p-3">
              {list.length === 0 && <span className="text-sm text-muted">—</span>}
              {list.map((s) => (
                <div key={s.id} className="group relative">
                  <BrawlerIcon id={s.id} name={s.name} size={size} />
                  <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-bg/90 px-1 text-[10px] font-semibold tabular-nums">
                    {pct(s.winRate, 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
