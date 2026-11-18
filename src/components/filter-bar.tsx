import Link from "next/link";
import { DAY_OPTIONS, MODES, modeInfo, QUEUES, type Filter } from "@/lib/format";

type Show = { queue?: boolean; mode?: boolean; days?: boolean };

/** Construit l'URL de la page avec un filtre modifié (les valeurs par défaut sont omises). */
export function filterHref(basePath: string, f: Filter, change: Partial<Filter>): string {
  const next = { ...f, ...change };
  const params = new URLSearchParams();
  if (next.queue !== "classe") params.set("file", next.queue);
  if (next.mode) params.set("mode", next.mode);
  params.set("days", String(next.days));
  return `${basePath}?${params}`;
}

function Pill({ href, active, children, color }: { href: string; active: boolean; children: React.ReactNode; color?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition ${
        active ? "bg-accent font-semibold text-bg" : "text-muted hover:text-ink"
      }`}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </Link>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">{children}</div>;
}

export function FilterBar({
  basePath,
  filter,
  show = { queue: true, mode: true, days: true },
  modes,
}: {
  basePath: string;
  filter: Filter;
  show?: Show;
  /** Modes proposés (par défaut : les 6 modes du classé). */
  modes?: string[];
}) {
  const modeList = modes ?? Object.keys(MODES).slice(0, 6);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {show.queue && (
        <Group>
          {QUEUES.map((q) => (
            <Pill key={q.key} href={filterHref(basePath, filter, { queue: q.key })} active={filter.queue === q.key}>
              {q.label}
            </Pill>
          ))}
        </Group>
      )}
      {show.mode && (
        <Group>
          <Pill href={filterHref(basePath, filter, { mode: null })} active={!filter.mode}>
            Tous les modes
          </Pill>
          {modeList.map((key) => (
            <Pill key={key} href={filterHref(basePath, filter, { mode: key })} active={filter.mode === key} color={modeInfo(key).color}>
              {modeInfo(key).label}
            </Pill>
          ))}
        </Group>
      )}
      {show.days && (
        <Group>
          {DAY_OPTIONS.map((d) => (
            <Pill key={d} href={filterHref(basePath, filter, { days: d })} active={filter.days === d}>
              {d} j
            </Pill>
          ))}
        </Group>
      )}
    </div>
  );
}
