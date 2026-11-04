"use client";

/**
 * ImagesField: multiple image URLs (string[]) with drag-to-reorder (dnd-kit), remove and
 * multi-select add through MediaPicker. `ImagesFormField` = react-hook-form wrapper.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, X } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/shared/smart-image";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MediaPicker } from "./media-picker";

export interface ImagesFieldProps {
  value?: string[] | null;
  onChange: (value: string[]) => void;
  folder?: string;
  /** Maximum number of images (unlimited by default). */
  max?: number;
  className?: string;
  disabled?: boolean;
}

function Thumb({ id, src, onRemove, label }: { id: string; src: string; onRemove: () => void; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <SmartImage src={src} alt="" fill className="object-cover" sizes="160px" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="drag"
        className="absolute left-1 top-1 flex size-6 cursor-grab touch-none items-center justify-center rounded bg-background/80 text-foreground opacity-100 backdrop-blur active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        title={label}
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded bg-destructive text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ImagesField({ value, onChange, folder, max, className, disabled }: ImagesFieldProps) {
  const t = useTranslations("admin");
  const [open, setOpen] = React.useState(false);
  const list = React.useMemo(() => value ?? [], [value]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // dnd ids must be unique: suffix duplicates with their index.
  const ids = React.useMemo(() => list.map((u, i) => `${i}::${u}`), [list]);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove(list, from, to));
  }

  const canAdd = !disabled && (max === undefined || list.length < max);

  return (
    <div className={cn("space-y-2", className)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {list.map((src, i) => (
              <Thumb key={ids[i]} id={ids[i]} src={src} label={t("form.removeImage")} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <ImagePlus className="size-6" />
                {t("kit.addImages")}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {list.length > 1 && <p className="text-xs text-muted-foreground">{t("kit.dragReorder")}</p>}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        multiple
        defaultFolder={folder}
        onSelect={(items) => {
          const next = [...list, ...items.map((m) => m.url)];
          onChange(max ? next.slice(0, max) : next);
        }}
      />
    </div>
  );
}

export interface ImagesFormFieldProps<T extends FieldValues> extends Omit<ImagesFieldProps, "value" | "onChange"> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export function ImagesFormField<T extends FieldValues>({ control, name, label, description, ...rest }: ImagesFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <ImagesField {...rest} value={field.value as string[] | undefined} onChange={field.onChange} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
