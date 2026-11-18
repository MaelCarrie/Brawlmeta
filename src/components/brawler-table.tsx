import Link from "next/link";
import { Bar, BrawlerIcon, TierBadge, WinRate } from "./ui";
import { brawlerName, pct } from "@/lib/format";
import type { BrawlerStat } from "@/lib/stats";

export function BrawlerTable({ stats, limit }: { stats: BrawlerStat[]; limit?: number }) {
  const rows = limit ? stats.slice(0, limit) : stats;
  const maxPick = Math.max(...stats.map((s) => s.pickRate), 0.01);
  return (
    <div className="card overflow-x-auto">
      <table className="stats">
        <thead>
          <tr>
            <th>#</th>
            <th>Brawler</th>
            <th>Tier</th>
            <th title="Taux de victoire corrigé selon le nombre de parties">Score</th>
            <th>Victoires</th>
            <th>Présence</th>
            <th className="text-right">Parties</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.id}>
              <td className="text-muted">{i + 1}</td>
              <td>
                <Link href={`/brawlers/${s.id}`} className="flex items-center gap-3 font-medium hover:text-accent">
                  <BrawlerIcon id={s.id} name={s.name} size={32} link={false} />
                  {brawlerName(s.name)}
                </Link>
              </td>
              <td><TierBadge tier={s.tier} /></td>
              <td className="font-semibold">{pct(s.adj)}</td>
              <td><WinRate value={s.winRate} /></td>
              <td>
                <div className="flex items-center gap-2">
                  <span className="w-12">{pct(s.pickRate)}</span>
                  <Bar value={s.pickRate} max={maxPick} />
                </div>
              </td>
              <td className="text-right text-muted">{s.games.toLocaleString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
