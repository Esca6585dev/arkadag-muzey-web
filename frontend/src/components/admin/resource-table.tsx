"use client";
// Generic admin list for `/admin/<resource>`: columns with render functions, debounced search,
// filter selects, sortable headers, pagination + per-page, row selection with bulk delete and
// row actions (edit / delete / custom). Page, search, filters and sort live in the URL query.
// See docs/ADMIN.md for an example.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ListParams } from "@/lib/admin-types";
import { useBulkDeleteResource, useDeleteResource, useResourceList } from "./use-resource";
import { useConfirm } from "./confirm-dialog";

export interface Column<T> {
  /** Unique key; also the sort field when `sortable` is true. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** true -> sort by `key`; string -> sort by that field. */
  sortable?: boolean | string;
  /** Classes for both <th> and <td> (width, alignment, `hidden md:table-cell`, ...). */
  className?: string;
}

export interface FilterDef {
  /** Query parameter sent to the API, e.g. "status" or "category_id". */
  key: string;
  /** Placeholder shown when no value is selected ("All ..."). */
  label: string;
  options: { value: string; label: string }[];
}

interface Props<T> {
  resource: string;
  columns: Column<T>[];
  filters?: FilterDef[];
  searchable?: boolean;
  searchPlaceholder?: string;
  defaultSort?: string;
  defaultLimit?: number;
  /** Fixed params always sent (not shown in the URL). */
  params?: ListParams;
  /** Link for the edit action (and row title click handlers can reuse it). */
  editHref?: (row: T) => string | undefined;
  /** Alternative to editHref, e.g. to open a dialog. */
  onEdit?: (row: T) => void;
  canDelete?: (row: T) => boolean;
  /** Disable to hide checkboxes and bulk delete. */
  selectable?: boolean;
  /** Extra dropdown items per row. */
  rowActions?: (row: T) => ReactNode;
  /** Extra content on the right of the toolbar (export buttons, ...). */
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

const LIMITS = [10, 20, 50, 100];

export function ResourceTable<T extends { id: number }>({
  resource,
  columns,
  filters = [],
  searchable = true,
  searchPlaceholder,
  defaultSort,
  defaultLimit = 20,
  params: fixedParams,
  editHref,
  onEdit,
  canDelete = () => true,
  selectable = true,
  rowActions,
  toolbar,
  emptyTitle,
  emptyDescription,
}: Props<T>) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Number(sp.get("limit")) || defaultLimit;
  const search = sp.get("search") ?? "";
  const sort = sp.get("sort") ?? defaultSort ?? "";
  const filterValues = Object.fromEntries(filters.map((f) => [f.key, sp.get(f.key) ?? ""]));

  const query: ListParams = { ...fixedParams, page, limit, sort: sort || undefined, search: search || undefined };
  for (const [k, v] of Object.entries(filterValues)) if (v) query[k] = v;

  const list = useResourceList<T>(resource, query);
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const meta = list.data?.meta;

  const setQuery = (patch: Record<string, string | number | undefined>, resetPage = true) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === null) next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced search input -> URL
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    if (searchInput === search) return;
    const id = setTimeout(() => setQuery({ search: searchInput.trim() || undefined }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Selection (ids on the current page)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const visibleSelected = pageIds.filter((id) => selected.has(id));
  const allSelected = pageIds.length > 0 && visibleSelected.length === pageIds.length;
  const toggleAll = (on: boolean) => setSelected(on ? new Set(pageIds) : new Set());
  const toggleOne = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const del = useDeleteResource(resource);
  const bulk = useBulkDeleteResource(resource);
  const { confirm, dialog } = useConfirm();

  const onDelete = async (row: T) => {
    if (await confirm()) del.mutate(row.id);
  };
  const onBulkDelete = async () => {
    if (!visibleSelected.length) return;
    if (await confirm({ description: t("form.bulkDeleteConfirm", { count: visibleSelected.length }) })) {
      bulk.mutate(visibleSelected, { onSuccess: () => setSelected(new Set()) });
    }
  };

  const sortField = (c: Column<T>) => (typeof c.sortable === "string" ? c.sortable : c.key);
  const toggleSort = (c: Column<T>) => {
    const f = sortField(c);
    const next = sort === f ? `-${f}` : sort === `-${f}` ? "" : f;
    setQuery({ sort: next || undefined });
  };

  const hasFilters = !!search || Object.values(filterValues).some(Boolean);
  const clearFilters = () => {
    setSearchInput("");
    setQuery(Object.fromEntries([["search", undefined], ...filters.map((f) => [f.key, undefined])]));
  };

  const showActions = true;
  const colCount = columns.length + (selectable ? 1 : 0) + (showActions ? 1 : 0);
  const from = meta && meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      {dialog}
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:p-4 lg:flex-row lg:items-center">
        {searchable && (
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder ?? t("search")}
              className="h-9 pl-9"
              aria-label={searchPlaceholder ?? t("search")}
            />
          </div>
        )}
        {filters.map((f) => (
          <Select key={f.key} value={filterValues[f.key] || "__all"} onValueChange={(v) => setQuery({ [f.key]: v === "__all" ? undefined : v })}>
            <SelectTrigger size="sm" className="h-9 w-full lg:w-44" aria-label={f.label}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{f.label}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 self-start lg:self-auto">
            <X className="size-4" /> {t("list.clearFilters")}
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {selectable && visibleSelected.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{t("table.selected", { count: visibleSelected.length })}</span>
              <Button variant="destructive" size="sm" onClick={onBulkDelete} disabled={bulk.isPending}>
                <Trash2 className="size-4" /> {t("list.deleteSelected")}
              </Button>
            </>
          )}
          {toolbar}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label={t("table.selectAll")} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-medium", c.className)}>
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c)} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
                      {c.header}
                      {sort === sortField(c) ? (
                        <ArrowUp className="size-3.5" aria-label={t("list.sortAsc")} />
                      ) : sort === `-${sortField(c)}` ? (
                        <ArrowDown className="size-3.5" aria-label={t("list.sortDesc")} />
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {showActions && <th className="w-14 px-4 py-3 text-right"><span className="sr-only">{t("table.actions")}</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {list.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={colCount} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {!list.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="p-6">
                  <EmptyState
                    icon={<Search />}
                    title={list.isError ? t("errors.loadFailed") : (emptyTitle ?? t("table.noData"))}
                    description={list.isError ? (list.error as Error).message : emptyDescription}
                  />
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const href = editHref?.(row);
              const deletable = canDelete(row);
              return (
                <tr key={row.id} className={cn("transition-colors hover:bg-muted/40", selected.has(row.id) && "bg-primary-soft/40")}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={(v) => toggleOne(row.id, !!v)} aria-label={`#${row.id}`} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t("table.actions")}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          {href && (
                            <DropdownMenuItem asChild>
                              <Link href={href}>
                                <Pencil className="size-4" /> {tc("edit")}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {!href && onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(row)}>
                              <Pencil className="size-4" /> {tc("edit")}
                            </DropdownMenuItem>
                          )}
                          {rowActions?.(row)}
                          {deletable && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
                                <Trash2 className="size-4" /> {tc("delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      {meta && meta.total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{tc("showing", { from, to, total: meta.total })}</span>
          <div className="flex items-center gap-2">
            <Select value={String(limit)} onValueChange={(v) => setQuery({ limit: Number(v) === defaultLimit ? undefined : v })}>
              <SelectTrigger size="sm" className="h-8 w-[72px]" aria-label={t("table.perPage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden whitespace-nowrap sm:inline">{tc("page", { page: meta.page, pages: Math.max(1, meta.pages) })}</span>
            <Button variant="outline" size="icon" className="size-8" disabled={meta.page <= 1} onClick={() => setQuery({ page: meta.page - 1 }, false)} aria-label={tc("previous")}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" disabled={meta.page >= meta.pages} onClick={() => setQuery({ page: meta.page + 1 }, false)} aria-label={tc("next")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small helper for "title + subtitle" cells with an optional link. */
export function TitleCell({ title, subtitle, href }: { title: ReactNode; subtitle?: ReactNode; href?: string }) {
  const main = <span className="line-clamp-2 font-medium text-foreground">{title}</span>;
  return (
    <div className="min-w-0 max-w-md">
      {href ? (
        <Link href={href} className="hover:text-primary hover:underline">
          {main}
        </Link>
      ) : (
        main
      )}
      {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
