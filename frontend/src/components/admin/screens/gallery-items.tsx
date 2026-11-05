"use client";
// Photos of a gallery: add many from the media library, edit captions, drag to reorder, delete.
// Each change is saved immediately through the gallery item endpoints.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SmartImage } from "@/components/shared/smart-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn, t as tr } from "@/lib/utils";
import { MediaPicker } from "../media-picker";
import { TranslatableField, type TranslatableValue } from "../translatable-field";
import { useConfirm } from "../confirm-dialog";
import { FormCard } from "../resource-form-layout";
import { resourceKeys } from "../use-resource";

interface Item {
  id: number;
  image: string;
  caption: TranslatableValue | null;
  sort_order: number;
}

function Tile({ item, onEdit, onDelete }: { item: Item; onEdit: () => void; onDelete: () => void }) {
  const locale = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const caption = tr(item.caption as Record<string, string>, locale);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group overflow-hidden rounded-xl border border-border/70 bg-background", isDragging && "z-10 shadow-lg")}
    >
      <div className="relative aspect-[4/3] bg-muted">
        <SmartImage src={item.image} alt={caption} fill className="object-cover" sizes="220px" />
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="drag"
          className="absolute left-2 top-2 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-background/85 backdrop-blur active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-1 p-2">
        <p className="line-clamp-1 flex-1 px-1 text-xs text-muted-foreground">{caption || "—"}</p>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onEdit} aria-label="edit">
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={onDelete} aria-label="delete">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function GalleryItems({ galleryId }: { galleryId: number }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const key = resourceKeys.item("galleries", galleryId);
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ items?: Item[] }>(`/admin/galleries/${galleryId}`) });
  const items = [...(q.data?.items ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const [order, setOrder] = useState<number[] | null>(null);
  const shown = order ? order.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i) : items;
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [caption, setCaption] = useState<TranslatableValue>({});
  const { confirm, dialog } = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: resourceKeys.all("galleries") });
    setOrder(null);
  };
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(t("form.saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
    await refresh();
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = shown.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(Number(e.active.id)), ids.indexOf(Number(e.over.id)));
    setOrder(next);
    void run(() => api.post(`/admin/galleries/${galleryId}/items/reorder`, { ids: next }));
  };

  return (
    <FormCard
      title={`${t("form.images")} (${items.length})`}
      action={
        <Button type="button" size="sm" className="rounded-full" onClick={() => setPicker(true)}>
          <ImagePlus className="size-4" /> {t("kit.addImages")}
        </Button>
      }
    >
      {dialog}
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground hover:bg-muted/50"
        >
          <ImagePlus className="size-6" /> {t("kit.addImages")}
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditing(item);
                    setCaption({ ...(item.caption ?? {}) });
                  }}
                  onDelete={async () => {
                    if (await confirm()) void run(() => api.del(`/admin/galleries/${galleryId}/items/${item.id}`));
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {items.length > 1 && <p className="mt-3 text-xs text-muted-foreground">{t("kit.dragReorder")}</p>}

      <MediaPicker
        open={picker}
        onOpenChange={setPicker}
        multiple
        defaultFolder="galleries"
        onSelect={(media) => {
          const images = media.map((m) => m.url).filter(Boolean);
          if (images.length) void run(() => api.post(`/admin/galleries/${galleryId}/items/bulk`, { images }));
        }}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("form.caption")}</DialogTitle>
          </DialogHeader>
          <TranslatableField kind="textarea" rows={3} value={caption} onChange={setCaption} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => {
                const it = editing;
                setEditing(null);
                if (it) void run(() => api.put(`/admin/galleries/${galleryId}/items/${it.id}`, { caption }));
              }}
            >
              {t("kit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormCard>
  );
}
