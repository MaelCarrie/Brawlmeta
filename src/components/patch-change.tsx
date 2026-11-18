import { CHANGE_STYLES, type BalanceChange } from "@/lib/balance";

export function PatchChange({ change }: { change: BalanceChange }) {
  const s = CHANGE_STYLES[change.type] ?? CHANGE_STYLES.ajustement;
  return (
    <p className="flex items-start gap-2 text-sm">
      <span
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold"
        style={{ background: `${s.color}22`, color: s.color }}
      >
        {s.icon} {s.label}
      </span>
      <span>{change.text}</span>
    </p>
  );
}
