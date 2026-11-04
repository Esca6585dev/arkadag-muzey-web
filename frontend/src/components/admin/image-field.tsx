"use client";

/**
 * ImageField: single image URL value (e.g. "/uploads/general/2026/01/x.jpg") with preview,
 * MediaPicker selection, remove and optional manual URL input. `ImageFormField` = react-hook-form wrapper.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2 } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SmartImage } from "@/components/shared/smart-image";
import { MediaPicker } from "./media-picker";

export interface ImageFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  /** CSS aspect ratio of the preview, e.g. "16/9" (default), "1/1", "3/4". */
  aspect?: string;
  /** Show a text input to type/paste a URL manually. */
  allowUrl?: boolean;
  /** Upload folder suggestion for the picker. */
  folder?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageField({ value, onChange, aspect = "16/9", allowUrl = false, folder, className, disabled }: ImageFieldProps) {
  const t = useTranslations("admin");
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/40"
        style={{ aspectRatio: aspect }}
      >
        {value ? (
          <SmartImage src={value} alt="" fill className="object-cover" sizes="400px" />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <ImagePlus className="size-7" />
            {t("form.selectImage")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          <ImagePlus className="size-4" />
          {value ? t("kit.change") : t("form.selectImage")}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange("")} className="text-destructive">
            <Trash2 className="size-4" />
            {t("form.removeImage")}
          </Button>
        )}
      </div>
      {allowUrl && (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… https://…" disabled={disabled} />
      )}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        defaultFolder={folder}
        onSelect={(items) => items[0] && onChange(items[0].url)}
      />
    </div>
  );
}

export interface ImageFormFieldProps<T extends FieldValues> extends Omit<ImageFieldProps, "value" | "onChange"> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export function ImageFormField<T extends FieldValues>({ control, name, label, description, ...rest }: ImageFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <ImageField {...rest} value={field.value as string | undefined} onChange={field.onChange} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
