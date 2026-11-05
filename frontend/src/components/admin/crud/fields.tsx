"use client";
// Config-driven form fields for admin resources. A FieldDef describes one model field; FieldRenderer
// draws it with the right kit component, and toFormValue/toPayloadValue convert between the API
// record and react-hook-form values. Labels are i18n keys in the `admin` namespace (e.g. "form.title").

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn, t as tr } from "@/lib/utils";
import { TranslatableFormField } from "../translatable-field";
import { ImageFormField } from "../image-field";
import { ImagesFormField } from "../images-field";
import { SlugField } from "../resource-form-layout";

type Row = Record<string, unknown> & { id: number };

/** Options loaded from another admin resource (e.g. categories for an article). */
export interface OptionsSource {
  resource: string;
  label: (row: Row, locale: string) => string;
  params?: Record<string, string | number>;
}

interface Base {
  name: string;
  /** i18n key in the `admin` namespace */
  label: string;
  description?: string;
  required?: boolean;
  /** Default for new records */
  default?: unknown;
  /** Grid span inside a card: "half" puts two fields side by side on wide screens */
  width?: "full" | "half";
}

export type FieldDef =
  | (Base & { type: "translatable"; kind?: "input" | "textarea" | "rich"; rows?: number })
  | (Base & { type: "text" | "textarea" | "url" | "email"; placeholder?: string })
  | (Base & { type: "number" })
  | (Base & { type: "switch" })
  | (Base & {
      type: "select";
      options?: { value: string; label: string }[];
      /** option labels are i18n keys in the admin namespace */
      translate?: boolean;
      optionsFrom?: OptionsSource;
      numeric?: boolean;
      nullable?: boolean;
    })
  | (Base & { type: "password" })
  /** Custom editor (e.g. page blocks); the value is passed through unchanged. */
  | (Base & { type: "custom"; render: (p: { value: unknown; onChange: (v: unknown) => void }) => React.ReactNode })
  | (Base & { type: "multiselect"; optionsFrom: OptionsSource })
  | (Base & { type: "image"; aspect?: string; folder?: string })
  | (Base & { type: "images"; folder?: string })
  | (Base & { type: "datetime" })
  | (Base & { type: "slug"; from: string });

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO string -> value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** API record value -> form value. */
export function toFormValue(f: FieldDef, raw: unknown): unknown {
  switch (f.type) {
    case "translatable":
      return raw && typeof raw === "object" ? { ...(raw as object) } : {};
    case "number":
      return typeof raw === "number" ? raw : Number(raw ?? f.default ?? 0) || 0;
    case "switch":
      return typeof raw === "boolean" ? raw : Boolean(f.default ?? false);
    case "select":
      return raw === null || raw === undefined ? String(f.default ?? "") : String(raw);
    case "multiselect":
      return Array.isArray(raw) ? raw.map((x) => (typeof x === "object" && x ? (x as Row).id : Number(x))) : [];
    case "images":
      return Array.isArray(raw) ? [...raw] : [];
    case "datetime":
      return toLocalInput(raw as string | null);
    case "password":
      return "";
    case "custom":
      return structuredClone(raw ?? f.default ?? null);
    default:
      return raw === null || raw === undefined ? String(f.default ?? "") : String(raw);
  }
}

/** Form value -> API payload value. */
export function toPayloadValue(f: FieldDef, v: unknown): unknown {
  switch (f.type) {
    case "number":
      return Number(v) || 0;
    case "select":
      if (v === "" || v === undefined) return f.nullable || f.numeric ? null : "";
      return f.numeric ? Number(v) : v;
    case "multiselect":
      return ((v as number[]) ?? []).map((id) => ({ id }));
    case "datetime":
      return v ? new Date(v as string).toISOString() : null;
    case "password":
      return v ? v : undefined;
    default:
      return v;
  }
}

/** Returns true when a required field has no value (translatable: default language). */
export function isMissing(f: FieldDef, v: unknown): boolean {
  if (!f.required) return false;
  if (f.type === "translatable") return !String((v as Record<string, string>)?.tk ?? "").replace(/<[^>]*>/g, "").trim();
  if (f.type === "images" || f.type === "multiselect") return !(v as unknown[])?.length;
  return v === undefined || v === null || String(v).trim() === "";
}

function useOptions(src?: OptionsSource) {
  const locale = useLocale();
  const q = useQuery({
    queryKey: ["admin", src?.resource ?? "-", "options", src?.params ?? {}],
    queryFn: () => api.list<Row>(`/admin/${src!.resource}`, { params: { limit: 200, ...src!.params } }),
    enabled: !!src,
    staleTime: 60_000,
  });
  return (q.data?.data ?? []).map((r) => ({ value: String(r.id), label: src!.label(r, locale) || `#${r.id}` }));
}

export function FieldRenderer<T extends FieldValues>({ field: f, control }: { field: FieldDef; control: Control<T> }) {
  const t = useTranslations("admin");
  const name = f.name as Path<T>;
  const label = f.label ? `${t(f.label)}${f.required ? " *" : ""}` : undefined;
  const description = f.description ? t(f.description) : undefined;
  const span = f.width === "half" ? "sm:col-span-1" : "sm:col-span-2";

  if (f.type === "translatable") {
    return (
      <div className={span}>
        <TranslatableFormField control={control} name={name} label={label} description={description} kind={f.kind ?? "input"} rows={f.rows} />
      </div>
    );
  }
  if (f.type === "image") {
    return (
      <div className={span}>
        <ImageFormField control={control} name={name} label={label} description={description} aspect={f.aspect} folder={f.folder} allowUrl />
      </div>
    );
  }
  if (f.type === "images") {
    return (
      <div className={span}>
        <ImagesFormField control={control} name={name} label={label} description={description} folder={f.folder} />
      </div>
    );
  }
  if (f.type === "slug") {
    return (
      <div className={span}>
        <SlugField<T> name={name} titleName={f.from as Path<T>} label={label} />
      </div>
    );
  }
  if (f.type === "custom") {
    return (
      <div className={span}>
        <FormField control={control} name={name} render={({ field }) => <>{f.render({ value: field.value, onChange: field.onChange })}</>} />
      </div>
    );
  }
  if (f.type === "select") return <SelectField f={f} control={control} label={label} description={description} span={span} />;
  if (f.type === "multiselect") return <MultiSelectField f={f} control={control} label={label} description={description} span={span} />;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) =>
        f.type === "switch" ? (
          <FormItem className={cn("flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3", span)}>
            <div className="space-y-0.5">
              <FormLabel>{label}</FormLabel>
              {description && <FormDescription>{description}</FormDescription>}
            </div>
            <FormControl>
              <Switch checked={!!field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        ) : (
          <FormItem className={span}>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              {f.type === "textarea" ? (
                <Textarea rows={4} placeholder={f.placeholder} {...field} value={(field.value as string) ?? ""} />
              ) : (
                <Input
                  type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : f.type === "url" ? "text" : f.type}
                  autoComplete={f.type === "password" ? "new-password" : undefined}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  {...field}
                  value={(field.value as string | number) ?? ""}
                />
              )}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }
    />
  );
}

type SelectDef = Extract<FieldDef, { type: "select" }>;
type MultiDef = Extract<FieldDef, { type: "multiselect" }>;

function SelectField<T extends FieldValues>({ f, control, label, description, span }: { f: SelectDef; control: Control<T>; label?: string; description?: string; span: string }) {
  const tc = useTranslations("common");
  const t = useTranslations("admin");
  const loaded = useOptions(f.optionsFrom);
  const options = f.options ? f.options.map((o) => ({ value: o.value, label: f.translate ? t(o.label) : o.label })) : loaded;
  return (
    <FormField
      control={control}
      name={f.name as Path<T>}
      render={({ field }) => (
        <FormItem className={span}>
          {label && <FormLabel>{label}</FormLabel>}
          <Select value={(field.value as string) || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {(f.nullable || !f.required) && <SelectItem value="__none">—</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
              {!options.length && f.optionsFrom && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">{tc("loading")}</div>
              )}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MultiSelectField<T extends FieldValues>({ f, control, label, description, span }: { f: MultiDef; control: Control<T>; label?: string; description?: string; span: string }) {
  const options = useOptions(f.optionsFrom);
  return (
    <FormField
      control={control}
      name={f.name as Path<T>}
      render={({ field }) => {
        const selected = new Set<number>((field.value as number[]) ?? []);
        const toggle = (id: number) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          field.onChange([...next]);
        };
        return (
          <FormItem className={span}>
            {label && <FormLabel>{label}</FormLabel>}
            <div className="flex flex-wrap gap-2">
              {options.map((o) => {
                const on = selected.has(Number(o.value));
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(Number(o.value))}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Translatable label helper for option sources. */
export const trLabel = (key: string) => (row: Row, locale: string) => tr(row[key] as Record<string, string>, locale);
