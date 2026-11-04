"use client";

/**
 * TranslatableField: one logical field with language tabs (tk/ru/en) rendering Input, Textarea or RichTextEditor.
 * Value is `{tk?, ru?, en?}`. Standalone (value/onChange) or via `TranslatableFormField` (react-hook-form).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RichTextEditor } from "./rich-text-editor";

export type TranslatableValue = Record<string, string | undefined>;

export const DEFAULT_LANGUAGES = ["tk", "ru", "en"];

export interface TranslatableFieldProps {
  value?: TranslatableValue | null;
  onChange: (value: TranslatableValue) => void;
  kind?: "input" | "textarea" | "rich";
  /** Enabled language codes (default tk, ru, en). */
  languages?: string[];
  /** Language that is required / shown first (default "tk"). */
  defaultLanguage?: string;
  /** Textarea rows or rich-editor min height is derived from this (default 4). */
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const clean = (s?: string) => (s ?? "").replace(/<[^>]*>/g, "").trim();

export function TranslatableField({
  value, onChange, kind = "input", languages = DEFAULT_LANGUAGES, defaultLanguage = "tk", rows = 4,
  placeholder, disabled, className, id,
}: TranslatableFieldProps) {
  const t = useTranslations("admin.kit");
  const langs = languages.includes(defaultLanguage) ? [defaultLanguage, ...languages.filter((l) => l !== defaultLanguage)] : languages;
  const [active, setActive] = React.useState(langs[0]);
  const v = value ?? {};
  const set = (lang: string, text: string) => onChange({ ...v, [lang]: text });

  return (
    <div className={cn("space-y-2", className)}>
      <div role="tablist" className="flex flex-wrap items-center gap-1">
        {langs.map((l) => {
          const filled = clean(v[l]).length > 0 || (kind === "rich" && /<img/i.test(v[l] ?? ""));
          const isActive = l === active;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(l)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {l}
              {l === defaultLanguage && <span aria-label={t("required")} className={isActive ? "text-primary-foreground" : "text-destructive"}>*</span>}
              <span
                aria-label={filled ? t("filled") : t("empty")}
                className={cn("size-1.5 rounded-full", filled ? "bg-emerald-400" : isActive ? "bg-primary-foreground/40" : "bg-muted-foreground/30")}
              />
            </button>
          );
        })}
      </div>
      {kind === "rich" ? (
        <RichTextEditor value={v[active] ?? ""} onChange={(h) => set(active, h)} placeholder={placeholder} minHeight={rows * 40 + 100} disabled={disabled} />
      ) : kind === "textarea" ? (
        <Textarea id={id} value={v[active] ?? ""} onChange={(e) => set(active, e.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} />
      ) : (
        <Input id={id} value={v[active] ?? ""} onChange={(e) => set(active, e.target.value)} placeholder={placeholder} disabled={disabled} />
      )}
    </div>
  );
}

export interface TranslatableFormFieldProps<T extends FieldValues> extends Omit<TranslatableFieldProps, "value" | "onChange" | "id"> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export function TranslatableFormField<T extends FieldValues>({ control, name, label, description, ...rest }: TranslatableFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <TranslatableField {...rest} value={field.value as TranslatableValue | undefined} onChange={field.onChange} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
