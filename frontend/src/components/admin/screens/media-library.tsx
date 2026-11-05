"use client";
// Media library: folders, search, drag & drop upload and a details dialog (alt text, folder,
// URL copy, delete) for every uploaded file.

import { useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Copy, FileText, Folder, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import type { Media } from "@/lib/types";
import { cn, fileSize, formatDate } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { isImage, uploadFiles } from "../media-picker";
import { TranslatableField, type TranslatableValue } from "../translatable-field";
import { useConfirm } from "../confirm-dialog";

const LIMIT = 30;

export function MediaLibrary() {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const folders = useQuery({ queryKey: ["admin", "media", "folders"], queryFn: () => api.get<{ folder: string; count: number }[]>("/admin/media/folders") });
  const list = useQuery({
    queryKey: ["admin", "media", "list", { folder, search, page }],
    queryFn: () => api.list<Media>("/admin/media", { params: { folder: folder || undefined, search: search || undefined, page, limit: LIMIT, sort: "-id" } }),
    placeholderData: keepPreviousData,
  });
  const files = list.data?.data ?? [];
  const meta = list.data?.meta;
  const total = (folders.data ?? []).reduce((n, f) => n + f.count, 0);

  const upload = async (picked: File[]) => {
    if (!picked.length) return;
    setProgress(0);
    try {
      const done = await uploadFiles(picked, folder, setProgress);
      toast.success(`${t("media.uploaded")}: ${done.length}`);
      setPage(1);
      await qc.invalidateQueries({ queryKey: ["admin", "media"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const folderButton = (value: string, label: string, count: number) => (
    <button
      key={value || "__all"}
      type="button"
      onClick={() => {
        setFolder(value);
        setPage(1);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        folder === value ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Folder className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("media.title")}
        actions={
          <>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                void upload(picked);
              }}
            />
            <Button className="rounded-full" onClick={() => input.current?.click()} disabled={progress !== null}>
              <Upload className="size-4" /> {t("media.upload")}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("media.folders")}</p>
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {folderButton("", t("media.allFolders"), total)}
            {(folders.data ?? []).filter((f) => f.folder).map((f) => folderButton(f.folder, f.folder, f.count))}
          </div>
        </aside>

        <section
          className={cn("min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors", dragging && "border-primary bg-primary-soft/30")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
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
            <p className="text-xs text-muted-foreground">{t("form.dropHere")}</p>
          </div>
          {progress !== null && <Progress value={progress} className="mb-4" />}

          {list.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <EmptyState icon={<Upload />} title={t("media.noFiles")} description={t("form.dropHere")} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {files.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className="group overflow-hidden rounded-xl border border-border/70 bg-background text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    {isImage(m) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumb_url || m.url} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <FileText className="size-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{m.original_name || m.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">{fileSize(m.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {meta && meta.pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
              <span>
                {meta.page} / {meta.pages}
              </span>
              <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="previous">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="size-8" disabled={page >= meta.pages} onClick={() => setPage(page + 1)} aria-label="next">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </section>
      </div>
      {selected && <MediaDetails key={selected.id} media={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function MediaDetails({ media, onClose }: { media: Media; onClose: () => void }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const [alt, setAlt] = useState<TranslatableValue>({ ...(media.alt ?? {}) });
  const [folder, setFolder] = useState(media.folder ?? "");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const absolute = typeof window === "undefined" ? media.url : new URL(media.url, window.location.origin).toString();

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["admin", "media"] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {dialog}
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{media.original_name || media.file_name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted">
            {isImage(media) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="" className="max-h-80 w-full object-contain" />
            ) : (
              <FileText className="m-12 size-16 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
              <dt>{t("table.size")}</dt>
              <dd className="text-foreground">{fileSize(media.size)}</dd>
              {media.width > 0 && (
                <>
                  <dt>{t("media.dimensions")}</dt>
                  <dd className="text-foreground">
                    {media.width} × {media.height}
                  </dd>
                </>
              )}
              <dt>{t("table.type")}</dt>
              <dd className="truncate text-foreground">{media.mime}</dd>
              <dt>{t("media.uploaded")}</dt>
              <dd className="text-foreground">{formatDate(media.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}</dd>
            </dl>
            <div className="flex gap-2">
              <Input readOnly value={absolute} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("media.copyUrl")}
                onClick={() => navigator.clipboard.writeText(absolute).then(() => toast.success(tc("copied")))}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{t("form.alt")}</Label>
              <TranslatableField kind="input" value={alt} onChange={setAlt} />
            </div>
            <div className="space-y-2">
              <Label>{t("table.folder")}</Label>
              <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t("media.newFolder")} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={async () => {
              if (await confirm()) void act(() => api.del(`/admin/media/${media.id}`), t("form.deleted"));
            }}
          >
            <Trash2 className="size-4" /> {t("media.deleteFile")}
          </Button>
          <Button disabled={busy} onClick={() => void act(() => api.put(`/admin/media/${media.id}`, { alt, folder }), t("form.saved"))}>
            {t("kit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
