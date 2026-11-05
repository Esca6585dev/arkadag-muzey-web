"use client";
// Interface text overrides (keys like "nav.home"): inline editing per row, add, delete,
// JSON import/export in the {key: {tk, ru, en}} shape accepted by POST /translations/import.

import { useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { PageHeader } from "../page-header";
import { useConfirm } from "../confirm-dialog";

const LANGS = ["tk", "ru", "en"] as const;
type Values = Partial<Record<(typeof LANGS)[number], string>>;
interface Translation {
  id: number;
  key: string;
  group: string;
  values: Values | null;
}

function Row({ item, onSaved, onDelete }: { item: Translation; onSaved: () => void; onDelete: () => void }) {
  const t = useTranslations("admin");
  const [values, setValues] = useState<Values>({ ...(item.values ?? {}) });
  const [busy, setBusy] = useState(false);
  const dirty = LANGS.some((l) => (values[l] ?? "") !== (item.values?.[l] ?? ""));
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="break-all font-mono text-xs font-medium">{item.key}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.group}</p>
      </td>
      {LANGS.map((l) => (
        <td key={l} className="px-2 py-2">
          <Input value={values[l] ?? ""} onChange={(e) => setValues({ ...values, [l]: e.target.value })} aria-label={`${item.key} ${l}`} className="h-9" />
        </td>
      ))}
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <Button
          size="icon"
          variant={dirty ? "default" : "ghost"}
          className="size-9"
          disabled={!dirty || busy}
          aria-label={t("kit.save")}
          onClick={async () => {
            setBusy(true);
            try {
              await api.put(`/admin/translations/${item.id}`, { values });
              toast.success(t("form.saved"));
              onSaved();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" className="size-9 text-destructive" aria-label="delete" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
}

export function TranslationsScreen() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<{ key: string; group: string; values: Values } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const list = useQuery({
    queryKey: ["admin", "translations", "list", { search, page }],
    queryFn: () => api.list<Translation>("/admin/translations", { params: { search: search || undefined, page, limit: 50 } }),
    placeholderData: keepPreviousData,
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["admin", "translations"] });
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  const exportAll = async () => {
    const all: Translation[] = [];
    for (let p = 1; p <= 50; p++) {
      const r = await api.list<Translation>("/admin/translations", { params: { page: p, limit: 200 } });
      all.push(...r.data);
      if (p >= r.meta.pages) break;
    }
    const entries = Object.fromEntries(all.map((x) => [x.key, x.values ?? {}]));
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "translations.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const entries = JSON.parse(await file.text());
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("JSON: {\"key\": {\"tk\": \"...\"}}");
      await api.post("/admin/translations/import", { entries });
      toast.success(t("form.saved"));
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      {dialog}
      <PageHeader
        title={t("translations")}
        description={t("translationsPage.hint")}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
            <Button variant="outline" className="rounded-full" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> {t("translationsPage.import")}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => void exportAll()}>
              <Download className="size-4" /> {t("translationsPage.export")}
            </Button>
            <Button className="rounded-full" onClick={() => setDraft({ key: "", group: "common", values: {} })}>
              <Plus className="size-4" /> {t("list.new")}
            </Button>
          </>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 p-3 sm:p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder={t("kit.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-64 px-4 py-3 font-medium">{t("table.key")}</th>
                {LANGS.map((l) => (
                  <th key={l} className="px-2 py-3 font-medium">
                    {l}
                  </th>
                ))}
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {list.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-3">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))}
              {!list.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    {t("table.noData")}
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <Row
                  key={`${item.id}-${JSON.stringify(item.values)}`}
                  item={item}
                  onSaved={() => void reload()}
                  onDelete={async () => {
                    if (!(await confirm())) return;
                    try {
                      await api.del(`/admin/translations/${item.id}`);
                      toast.success(t("form.deleted"));
                      await reload();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
            <span>{tc("page", { page: meta.page, pages: meta.pages })}</span>
            <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={tc("previous")}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" disabled={page >= meta.pages} onClick={() => setPage(page + 1)} aria-label={tc("next")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("list.new")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label>{t("form.key")} *</Label>
                  <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="nav.home" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>{t("form.group")}</Label>
                  <Input value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} />
                </div>
              </div>
              {LANGS.map((l) => (
                <div key={l} className="space-y-2">
                  <Label className="uppercase">{l}</Label>
                  <Input value={draft.values[l] ?? ""} onChange={(e) => setDraft({ ...draft, values: { ...draft.values, [l]: e.target.value } })} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!draft?.key.trim()) return;
                try {
                  await api.post("/admin/translations", draft);
                  toast.success(t("form.created"));
                  setDraft(null);
                  await reload();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {t("kit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
