import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function pageList(current: number, total: number): (number | "gap-l" | "gap-r")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "gap-l" | "gap-r")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("gap-l");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("gap-r");
  out.push(total);
  return out;
}

const base =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Server-side pagination: links preserve all other query params. */
export async function ListPagination({
  pathname,
  page,
  pages,
  query = {},
}: {
  pathname: string;
  page: number;
  pages: number;
  query?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("common");
  const href = (p: number) => {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") q[k] = v;
    if (p > 1) q.page = String(p);
    return { pathname, query: q } as never;
  };

  return (
    <nav aria-label={t("pagination")} className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label={t("previous")} className={cn(base, "border border-border bg-card hover:bg-muted")}>
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span aria-hidden className={cn(base, "border border-border/50 text-muted-foreground/40")}>
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>
        {pageList(page, pages).map((p) =>
          typeof p === "string" ? (
            <li key={p} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-label={t("page", { page: p, pages })}
                aria-current={p === page ? "page" : undefined}
                className={cn(base, p === page ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card hover:bg-muted")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} aria-label={t("next")} className={cn(base, "border border-border bg-card hover:bg-muted")}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span aria-hidden className={cn(base, "border border-border/50 text-muted-foreground/40")}>
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

/** Pill-style filter link used on list pages. */
export function FilterPill({ href, active, children }: { href: string | { pathname: string; query: Record<string, string> }; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as never}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/80 hover:border-primary/50 hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}
