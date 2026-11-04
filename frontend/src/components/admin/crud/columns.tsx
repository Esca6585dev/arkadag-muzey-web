"use client";
// Column builders for ResourceTable used by the resource registry. `columnKit(ctx)` returns helpers
// bound to the current locale/translations so registry entries stay short.

import { ImageIcon, Star } from "lucide-react";
import { formatDate, formatNumber, t as tr } from "@/lib/utils";
import type { Column } from "../resource-table";
import { TitleCell } from "../resource-table";
import { ActiveBadge, StatusBadge } from "../status-badge";

export type Row = Record<string, unknown> & { id: number };
export type Translator = (key: string, values?: Record<string, string | number>) => string;
export interface ColumnCtx {
  /** `admin` namespace translator */
  t: Translator;
  locale: string;
  basePath: string;
}

export function Thumb({ src, className = "h-10 w-14" }: { src?: string | null; className?: string }) {
  return (
    <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted text-muted-foreground`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </div>
  );
}

const trv = (v: unknown, locale: string) => (typeof v === "string" ? v : tr(v as Record<string, string> | null, locale));

export function columnKit({ t, locale, basePath }: ColumnCtx) {
  return {
    thumb: (key = "cover_image", header = "table.image"): Column<Row> => ({
      key,
      header: t(header),
      className: "w-20",
      cell: (r) => <Thumb src={r[key] as string} />,
    }),
    title: (key = "title", sub?: (r: Row) => string | undefined, header = "table.title"): Column<Row> => ({
      key,
      header: t(header),
      sortable: "id",
      cell: (r) => (
        <TitleCell
          title={
            <>
              {trv(r[key], locale) || `#${r.id}`}
              {r.is_featured === true && <Star className="ml-1.5 inline size-3.5 fill-accent text-accent" aria-label={t("table.featured")} />}
            </>
          }
          subtitle={sub ? sub(r) : (r.slug as string)}
          href={`${basePath}/${r.id}`}
        />
      ),
    }),
    text: (key: string, header: string, get?: (r: Row) => unknown, className = ""): Column<Row> => ({
      key,
      header: t(header),
      className,
      cell: (r) => {
        const v = get ? get(r) : r[key];
        const s = v && typeof v === "object" ? trv(v, locale) : String(v ?? "");
        return s ? <span className="text-muted-foreground">{s}</span> : <span className="text-muted-foreground/50">—</span>;
      },
    }),
    number: (key: string, header: string, sortable = true): Column<Row> => ({
      key,
      header: t(header),
      sortable,
      className: "hidden text-right tabular-nums md:table-cell",
      cell: (r) => formatNumber(Number(r[key] ?? 0), locale),
    }),
    status: (key = "status"): Column<Row> => ({ key, header: t("table.status"), cell: (r) => <StatusBadge status={r[key] as string} /> }),
    active: (key = "is_active"): Column<Row> => ({ key, header: t("table.active"), cell: (r) => <ActiveBadge active={!!r[key]} /> }),
    date: (key: string, header: string, withTime = false): Column<Row> => ({
      key,
      header: t(header),
      sortable: true,
      className: "hidden whitespace-nowrap text-muted-foreground lg:table-cell",
      cell: (r) =>
        r[key] ? formatDate(r[key] as string, locale, withTime ? { dateStyle: "medium", timeStyle: "short" } : undefined) : "—",
    }),
  };
}
