"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileText, Landmark, Newspaper, Search, Sparkles } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { t as tr } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced, locale],
    queryFn: () => api.get<SearchResult>("/public/search", { params: { q: debounced, locale } }),
    enabled: debounced.length >= 2,
  });

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };

  const groups = [
    { key: "articles", icon: Newspaper, items: data?.articles ?? [], href: (s: string) => `/news/${s}`, field: "title" as const },
    { key: "exhibits", icon: Sparkles, items: data?.exhibits ?? [], href: (s: string) => `/exhibits/${s}`, field: "title" as const },
    { key: "halls", icon: Landmark, items: data?.halls ?? [], href: (s: string) => `/halls/${s}`, field: "name" as const },
    { key: "events", icon: Calendar, items: data?.events ?? [], href: (s: string) => `/events/${s}`, field: "title" as const },
    { key: "pages", icon: FileText, items: data?.pages ?? [], href: (s: string) => (s === "home" ? "/" : s === "about" || s === "contact" || s === "visit" ? `/${s}` : `/p/${s}`), field: "title" as const },
  ];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("common.search")} description={t("search.placeholder")}>
      <CommandInput placeholder={t("search.placeholder")} value={q} onValueChange={setQ} />
      <CommandList className="max-h-[60vh]">
        {debounced.length < 2 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Search className="size-6 opacity-50" />
            {t("search.minChars")}
          </div>
        )}
        {debounced.length >= 2 && !isFetching && total === 0 && <CommandEmpty>{t("common.noResults")}</CommandEmpty>}
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <CommandGroup key={g.key} heading={t(`search.${g.key}` as "search.articles")}>
                {g.items.map((item) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const label = tr((item as any)[g.field], locale);
                  return (
                    <CommandItem key={`${g.key}-${item.id}`} value={`${g.key}-${item.id}-${label}`} onSelect={() => go(g.href(item.slug))}>
                      <g.icon className="size-4 text-muted-foreground" />
                      <span className="truncate">{label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ),
        )}
        {debounced.length >= 2 && total > 0 && (
          <CommandGroup>
            <CommandItem value={`all-${debounced}`} onSelect={() => go(`/search?q=${encodeURIComponent(debounced)}`)}>
              <Search className="size-4" />
              {t("common.viewAll")}
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
