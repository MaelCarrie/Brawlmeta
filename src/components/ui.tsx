import Link from "next/link";
import { SafeImg } from "./safe-img";
import { brawlerImg, brawlerName, modeInfo, pct, TIER_COLORS } from "@/lib/format";

export function BrawlerIcon({
  id,
  name,
  size = 40,
  link = true,
  className = "",
}: {
  id: number;
  name: string;
  size?: number;
  link?: boolean;
  className?: string;
}) {
  const img = (
    <SafeImg
      src={brawlerImg(id)}
      alt={brawlerName(name)}
      className={`rounded-lg bg-surface-2 object-contain ${className}`}
    />
  );
  const box = (
    <span title={brawlerName(name)} className="inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="block h-full w-full [&>*]:h-full [&>*]:w-full">{img}</span>
    </span>
  );
  return link ? (
    <Link href={`/brawlers/${id}`} className="inline-block transition hover:scale-110">
      {box}
    </Link>
  ) : (
    box
  );
}

export function TierBadge({ tier, size = "md" }: { tier: string | null; size?: "md" | "lg" }) {
  if (!tier) return <span className="text-muted">–</span>;
  const cls = size === "lg" ? "w-14 h-14 text-3xl" : "w-7 h-7 text-base";
  return (
    <span
      className={`h-display inline-flex items-center justify-center rounded-lg text-bg ${cls}`}
      style={{ background: TIER_COLORS[tier] }}
    >
      {tier}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const m = modeInfo(mode);
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${m.color}26`, color: m.color }}
    >
      {m.label}
    </span>
  );
}

/** Taux de victoire coloré selon l'écart à 50 %. */
export function WinRate({ value }: { value: number }) {
  const color = value >= 0.52 ? "text-win" : value <= 0.48 ? "text-loss" : "text-ink";
  return <span className={`font-semibold ${color}`}>{pct(value)}</span>;
}

export function Bar({ value, max, color = "var(--color-accent-2)" }: { value: number; max: number; color?: string }) {
  return (
    <span className="block h-1.5 w-full min-w-16 overflow-hidden rounded bg-surface-2">
      <span className="block h-full rounded" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </span>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-display text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-muted">{children}</div>;
}

export function Loading() {
  return <div className="card animate-pulse p-8 text-center text-muted">Chargement…</div>;
}
