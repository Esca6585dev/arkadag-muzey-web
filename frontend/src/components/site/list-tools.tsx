import { ChevronRight, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** GET search form that preserves other params through hidden inputs. */
export async function ListSearch({ q, placeholder, hidden = {}, className }: { q?: string; placeholder: string; hidden?: Record<string, string | undefined>; className?: string }) {
  const t = await getTranslations("common");
  return (
    <form method="get" action="" role="search" className={className ?? "relative w-full md:max-w-xs"}>
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={t("search")}
        className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
    </form>
  );
}

export async function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  const t = await getTranslations("common");
  const all = [{ label: t("home"), href: "/" }, ...items];
  return (
    <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((c, i) => (
          <li key={i} className="inline-flex min-w-0 items-center gap-1.5">
            {c.href ? (
              <Link href={c.href as never} className="transition-colors hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="line-clamp-1 text-foreground">
                {c.label}
              </span>
            )}
            {i < all.length - 1 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
