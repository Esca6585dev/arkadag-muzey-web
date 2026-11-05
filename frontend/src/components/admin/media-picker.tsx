"use client";

/**
 * MediaPicker: dialog to choose (Library tab) or upload (Upload tab) media.
 * Library: GET /admin/media (folder, search, page). Upload: POST /admin/media/upload multipart
 * (`files`, optional `folder`) via XMLHttpRequest for progress. Uploaded files are auto-selected.
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, FileText, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { api, apiBase } from "@/lib/api";
import { cn, fileSize } from "@/lib/utils";
import type { Media } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Allow selecting several files. Default false. */
  multiple?: boolean;
  /** "image" (default) shows only images; "all" shows every media type. */
  accept?: "image" | "all";
  /** Folder preselected for uploads / filter. */
  defaultFolder?: string;
  /** Called with the selected Media objects (use `.url` for the stored value). */
  onSelect: (items: Media[]) => void;
}

export const isImage = (m: Media) => (m.mime || "").startsWith("image/");

export function uploadFiles(files: File[], folder: string, onProgress: (p: number) => void): Promise<Media[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (folder) fd.append("folder", folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase()}/admin/media/upload`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          if (json.errors?.length) toast.error(json.errors.map((x: { file: string; error: string }) => `${x.file}: ${x.error}`).join("\n"));
          resolve(json.data ?? []);
        } else reject(new Error(json?.error?.message || `HTTP ${xhr.status}`));
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.send(fd);
  });
}

export function MediaPicker({ open, onOpenChange: setOpenProp, multiple = false, accept = "image", defaultFolder = "", onSelect }: MediaPickerProps) {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  const onOpenChange = (o: boolean) => {
    if (!o) {
      setSelected([]);
      setTab("library");
    }
    setOpenProp(o);
  };
  const [tab, setTab] = React.useState("library");
  const [folder, setFolder] = React.useState(defaultFolder);
  const [uploadFolder, setUploadFolder] = React.useState(defaultFolder);
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Media[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);


  const folders = useQuery({
    queryKey: ["admin", "media-folders"],
    queryFn: () => api.get<{ folder: string; count: number }[]>("/admin/media/folders"),
    enabled: open,
  });
  const list = useQuery({
    queryKey: ["admin", "media-picker", { folder, q, page }],
    queryFn: () => api.list<Media>("/admin/media", { params: { folder, search: q, page, limit: 24 } }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const items = (list.data?.data ?? []).filter((m) => accept === "all" || isImage(m));
  const pages = list.data?.meta.pages ?? 1;

  const toggle = (m: Media) =>
    setSelected((cur) => {
      const has = cur.some((x) => x.id === m.id);
      if (!multiple) return has ? [] : [m];
      return has ? cur.filter((x) => x.id !== m.id) : [...cur, m];
    });

  async function handleFiles(fl: FileList | File[]) {
    let files = Array.from(fl);
    if (accept === "image") files = files.filter((f) => f.type.startsWith("image/"));
    if (!multiple) files = files.slice(0, 1);
    if (!files.length) return;
    setProgress(0);
    try {
      const saved = await uploadFiles(files, uploadFolder.trim(), setProgress);
      qc.invalidateQueries({ queryKey: ["admin", "media-picker"] });
      qc.invalidateQueries({ queryKey: ["admin", "media-folders"] });
      if (saved.length) {
        setSelected((cur) => (multiple ? [...cur, ...saved] : saved.slice(0, 1)));
        setTab("library");
        setFolder("");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const confirm = () => {
    if (!selected.length) return;
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("form.selectImage")}</DialogTitle>
          <DialogDescription className="sr-only">{t("media.title")}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="library">{t("form.chooseFromLibrary")}</TabsTrigger>
            <TabsTrigger value="upload">{t("form.upload")}</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("kit.search")} className="pl-9" />
              </div>
              <select
                value={folder}
                onChange={(e) => {
                  setFolder(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("media.folders")}
              >
                <option value="">{t("media.allFolders")}</option>
                {(folders.data ?? []).map((f) => (
                  <option key={f.folder} value={f.folder}>
                    {f.folder} ({f.count})
                  </option>
                ))}
              </select>
            </div>
            {list.isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("media.noFiles")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {items.map((m) => {
                  const on = selected.some((x) => x.id === m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggle(m)}
                      title={`${m.original_name} · ${fileSize(m.size)}`}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on ? "border-primary ring-2 ring-primary" : "border-border",
                      )}
                    >
                      {isImage(m) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumb_url || m.url} alt={m.original_name} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full flex-col items-center justify-center gap-1 p-1 text-xs text-muted-foreground">
                          <FileText className="size-6" />
                          <span className="line-clamp-2 break-all">{m.original_name}</span>
                        </span>
                      )}
                      {on && (
                        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {pages}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  ›
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <Input value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} placeholder={t("media.newFolder")} list="kit-media-folders" />
            <datalist id="kit-media-folders">
              {(folders.data ?? []).map((f) => (
                <option key={f.folder} value={f.folder} />
              ))}
            </datalist>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-14 text-center text-sm text-muted-foreground transition-colors",
                drag ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/50",
              )}
            >
              <UploadCloud className="size-8" />
              <span>{progress !== null ? t("form.uploading") : t("form.dropHere")}</span>
              {progress !== null && <Progress value={progress} className="mt-2 w-64 max-w-full" />}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple={multiple}
              accept={accept === "image" ? "image/*" : undefined}
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">{selected.length > 0 ? `${selected.length} ✓` : ""}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("kit.cancel")}
            </Button>
            <Button type="button" disabled={!selected.length} onClick={confirm}>
              {t("media.select")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
