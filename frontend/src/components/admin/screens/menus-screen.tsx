"use client";
// Menus: list of menus and a tree editor. Order/nesting is changed with move/indent buttons and
// saved in one PUT /menus/:id/tree; items are added/edited/deleted through dialogs.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, IndentDecrease, IndentIncrease, ListTree, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn, t as tr } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { TranslatableField, type TranslatableValue } from "../translatable-field";
import { useConfirm } from "../confirm-dialog";
import { useUnsavedChangesWarning } from "../resource-form-layout";

interface MenuItem {
  id: number;
  parent_id: number | null;
  title: TranslatableValue;
  type: string;
  url: string;
  target: string;
  icon: string;
  is_active: boolean;
  children?: MenuItem[];
}
interface Menu {
  id: number;
  slug: string;
  name: string;
  items?: MenuItem[];
}

const MAX_DEPTH = 2;

export function MenusList() {
  const t = useTranslations("admin");
  const q = useQuery({ queryKey: ["admin", "menus", "list"], queryFn: () => api.list<Menu>("/admin/menus", { params: { limit: 50 } }) });
  return (
    <>
      <PageHeader title={t("menus.title")} description={t("menus.dragHint")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {q.isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        {q.data?.data.map((m) => (
          <Link key={m.id} href={`/admin/menus/${m.id}`} className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-primary/40">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ListTree className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{m.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">{m.slug}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </>
  );
}

/* ---------- tree helpers ---------- */

type Path = number[];
const clone = (items: MenuItem[]): MenuItem[] => items.map((i) => ({ ...i, children: clone(i.children ?? []) }));
function siblingsAt(tree: MenuItem[], parentPath: Path): MenuItem[] {
  let list = tree;
  for (const i of parentPath) list = list[i].children!;
  return list;
}
function move(tree: MenuItem[], path: Path, op: "up" | "down" | "in" | "out"): MenuItem[] {
  const next = clone(tree);
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const sibs = siblingsAt(next, parentPath);
  const [node] = sibs.splice(idx, 1);
  if (op === "up") sibs.splice(Math.max(0, idx - 1), 0, node);
  else if (op === "down") sibs.splice(Math.min(sibs.length, idx + 1), 0, node);
  else if (op === "in") sibs[idx - 1].children!.push(node);
  else {
    const grand = siblingsAt(next, parentPath.slice(0, -1));
    grand.splice(parentPath[parentPath.length - 1] + 1, 0, node);
  }
  return next;
}
const toPayload = (items: MenuItem[]): { id: number; children: unknown[] }[] => items.map((i) => ({ id: i.id, children: toPayload(i.children ?? []) }));

/* ---------- editor ---------- */

export function MenuEditor({ id }: { id: number }) {
  const q = useQuery({ queryKey: ["admin", "menus", "item", String(id)], queryFn: () => api.get<Menu>(`/admin/menus/${id}`) });
  if (q.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!q.data) return null;
  return <TreeEditor key={q.dataUpdatedAt} menu={q.data} />;
}

type Draft = { id?: number; title: TranslatableValue; type: string; url: string; target: string; icon: string; is_active: boolean };
const EMPTY: Draft = { title: {}, type: "link", url: "", target: "_self", icon: "", is_active: true };

function TreeEditor({ menu }: { menu: Menu }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const [tree, setTree] = useState<MenuItem[]>(() => clone(menu.items ?? []));
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  useUnsavedChangesWarning(dirty);

  const reload = () => qc.invalidateQueries({ queryKey: ["admin", "menus"] });
  const call = async (fn: () => Promise<unknown>, msg = t("form.saved")) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = (path: Path, op: "up" | "down" | "in" | "out") => {
    setTree((cur) => move(cur, path, op));
    setDirty(true);
  };

  const renderLevel = (items: MenuItem[], parentPath: Path, depth: number) => (
    <ul className={cn("space-y-2", depth > 0 && "mt-2 border-l-2 border-dashed border-border pl-4 sm:pl-6")}>
      {items.map((item, i) => {
        const path = [...parentPath, i];
        return (
          <li key={item.id}>
            <div className={cn("flex items-center gap-2 rounded-xl border border-border/70 bg-card p-2.5 pl-4 shadow-sm", !item.is_active && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {tr(item.title as Record<string, string>, locale) || "—"}
                  {!item.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">({t("menus.inactive")})</span>}
                </p>
                <p className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                  {item.target === "_blank" && <ExternalLink className="size-3" />}
                  {item.url || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => apply(path, "up")} aria-label={t("form.moveUp")} title={t("form.moveUp")}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={i === items.length - 1} onClick={() => apply(path, "down")} aria-label={t("form.moveDown")} title={t("form.moveDown")}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden size-8 sm:inline-flex" disabled={i === 0 || depth + 1 >= MAX_DEPTH || !!item.children?.length} onClick={() => apply(path, "in")} aria-label={t("menus.indent")} title={t("menus.indent")}>
                  <IndentIncrease className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden size-8 sm:inline-flex" disabled={depth === 0} onClick={() => apply(path, "out")} aria-label={t("menus.outdent")} title={t("menus.outdent")}>
                  <IndentDecrease className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={dirty || busy} onClick={() => setDraft({ id: item.id, title: { ...item.title }, type: item.type || "link", url: item.url, target: item.target || "_self", icon: item.icon, is_active: item.is_active })} aria-label={tc("edit")} title={dirty ? t("menus.saveFirst") : tc("edit")}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  disabled={dirty || busy}
                  onClick={async () => {
                    if (await confirm()) void call(() => api.del(`/admin/menus/${menu.id}/items/${item.id}`), t("form.deleted"));
                  }}
                  aria-label={tc("delete")}
                  title={dirty ? t("menus.saveFirst") : tc("delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            {!!item.children?.length && renderLevel(item.children, path, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.tk?.trim()) {
      toast.error(t("form.validationError"));
      return;
    }
    const { id: itemId, ...body } = draft;
    setDraft(null);
    void call(() => (itemId ? api.put(`/admin/menus/${menu.id}/items/${itemId}`, body) : api.post(`/admin/menus/${menu.id}/items`, { ...body, parent_id: null })));
  };

  return (
    <>
      {dialog}
      <PageHeader
        title={menu.name}
        description={t("menus.dragHint")}
        backHref="/admin/menus"
        backLabel={t("menus.title")}
        actions={
          <>
            <Button variant="outline" className="rounded-full" disabled={dirty || busy} onClick={() => setDraft({ ...EMPTY })} title={dirty ? t("menus.saveFirst") : undefined}>
              <Plus className="size-4" /> {t("menus.addItem")}
            </Button>
            <Button className="rounded-full" disabled={!dirty || busy} onClick={() => void call(() => api.put(`/admin/menus/${menu.id}/tree`, { items: toPayload(tree) }), t("menus.treeSaved"))}>
              <Save className="size-4" /> {t("menus.saveTree")}
            </Button>
          </>
        }
      />
      <div className="max-w-3xl">{tree.length ? renderLevel(tree, [], 0) : <p className="text-sm text-muted-foreground">{t("table.noData")}</p>}</div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("menus.editItem") : t("menus.addItem")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("form.title")} *</Label>
                <TranslatableField kind="input" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("form.type")}</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v, target: v === "external" ? "_blank" : draft.target })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["link", "page", "external"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`menus.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("form.target")}</Label>
                  <Select value={draft.target} onValueChange={(v) => setDraft({ ...draft, target: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_self">{t("form.sameTab")}</SelectItem>
                      <SelectItem value="_blank">{t("form.newTab")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("form.url")}</Label>
                <Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder={draft.type === "external" ? "https://" : "/halls"} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                <Label>{t("form.active")}</Label>
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={saveDraft}>{t("kit.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
