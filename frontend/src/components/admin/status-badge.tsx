"use client";
// Theme-aware pill for record states (draft/published/archived, new/read/replied, active/blocked/inactive).
// Unknown values fall back to a neutral pill with the raw value.
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  published: "bg-success/12 text-success ring-success/25",
  active: "bg-success/12 text-success ring-success/25",
  replied: "bg-success/12 text-success ring-success/25",
  draft: "bg-warning/12 text-warning ring-warning/25",
  new: "bg-info/12 text-info ring-info/25",
  read: "bg-muted text-muted-foreground ring-border",
  archived: "bg-muted text-muted-foreground ring-border",
  inactive: "bg-muted text-muted-foreground ring-border",
  blocked: "bg-destructive/10 text-destructive ring-destructive/25",
};

const KNOWN = new Set(Object.keys(TONES));

export function StatusBadge({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  const t = useTranslations("admin.status");
  const value = status || "draft";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[value] ?? "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? (KNOWN.has(value) ? t(value) : value)}
    </span>
  );
}

/** Active/inactive pill for boolean flags. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge status={active ? "active" : "inactive"} />;
}
