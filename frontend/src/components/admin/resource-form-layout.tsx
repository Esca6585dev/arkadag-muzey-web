"use client";

/**
 * Page-level form layout kit for admin resource forms (use inside a react-hook-form <Form>):
 * ResourceFormLayout (2 columns + sticky save bar), FormCard, FormSaveBar, useUnsavedChangesWarning,
 * SlugField (generate from title), SeoFields (collapsible translatable meta title/description).
 */
import * as React from "react";
import { useFormContext, useWatch, type FieldPath, type FieldValues } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Wand2 } from "lucide-react";

import { cn, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TranslatableFormField, type TranslatableValue } from "./translatable-field";

/** Warns on tab close / reload while the form has unsaved changes. */
export function useUnsavedChangesWarning(isDirty: boolean) {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}

export function FormCard({ title, description, children, className, action }: { title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-xs", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export interface FormSaveBarProps {
  isDirty: boolean;
  saving?: boolean;
  /** Back/cancel handler (e.g. router.push(list)). */
  onCancel?: () => void;
  /** If provided a "Save & close" button is shown; call handleSubmit(...) with a close flag inside. */
  onSaveAndClose?: () => void;
  className?: string;
}

/** Sticky bottom bar. "Save" is a submit button, so place it inside the <form>. */
export function FormSaveBar({ isDirty, saving, onCancel, onSaveAndClose, className }: FormSaveBarProps) {
  const t = useTranslations("admin");
  return (
    <div className={cn("sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("mr-auto flex items-center gap-2 text-sm", isDirty ? "text-accent" : "text-muted-foreground")}>
          <span className={cn("size-2 rounded-full", isDirty ? "bg-accent" : "bg-muted-foreground/40")} />
          {isDirty ? t("form.unsavedChanges") : t("kit.noChanges")}
        </span>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {t("kit.cancel")}
          </Button>
        )}
        {onSaveAndClose && (
          <Button type="button" variant="outline" onClick={onSaveAndClose} disabled={saving}>
            {t("kit.saveClose")}
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("kit.save")}
        </Button>
      </div>
    </div>
  );
}

export interface ResourceFormLayoutProps extends FormSaveBarProps {
  /** Main column content (FormCards). */
  children: React.ReactNode;
  /** Side column content (status, cover image, SEO...). Stacks below on mobile. */
  side?: React.ReactNode;
  /** Optional heading rendered above the grid. */
  header?: React.ReactNode;
}

export function ResourceFormLayout({ children, side, header, ...bar }: ResourceFormLayoutProps) {
  useUnsavedChangesWarning(bar.isDirty);
  return (
    <div>
      {header}
      <div className={cn("grid gap-6", side && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <div className="min-w-0 space-y-6">{children}</div>
        {side && <aside className="min-w-0 space-y-6">{side}</aside>}
      </div>
      <FormSaveBar {...bar} />
    </div>
  );
}

export interface SlugFieldProps<T extends FieldValues> {
  name?: FieldPath<T>;
  /** Field path holding the title; a translatable object `{tk,..}` or a plain string. */
  titleName: FieldPath<T>;
  /** Language used to derive the slug from a translatable title (default "tk"). */
  language?: string;
  label?: React.ReactNode;
}

export function SlugField<T extends FieldValues>({ name = "slug" as FieldPath<T>, titleName, language = "tk", label }: SlugFieldProps<T>) {
  const t = useTranslations("admin");
  const { control, setValue } = useFormContext<T>();
  const title = useWatch({ control, name: titleName }) as unknown;
  const source = typeof title === "string" ? title : ((title as TranslatableValue | undefined)?.[language] ?? "");
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label ?? t("form.slug")}</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <Input {...field} value={(field.value as string) ?? ""} placeholder="my-article-slug" />
            </FormControl>
            <Button
              type="button"
              variant="outline"
              disabled={!source}
              onClick={() => setValue(name, slugify(source) as never, { shouldDirty: true, shouldValidate: true })}
            >
              <Wand2 className="size-4" />
              {t("form.generate")}
            </Button>
          </div>
          <FormDescription>{t("form.slugHint")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export interface SeoFieldsProps<T extends FieldValues> {
  titleName?: FieldPath<T>;
  descriptionName?: FieldPath<T>;
  languages?: string[];
  defaultOpen?: boolean;
}

export function SeoFields<T extends FieldValues>({ titleName = "meta_title" as FieldPath<T>, descriptionName = "meta_description" as FieldPath<T>, languages, defaultOpen = false }: SeoFieldsProps<T>) {
  const t = useTranslations("admin");
  const { control } = useFormContext<T>();
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-border/70 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="text-base font-semibold">{t("form.seo")}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border/70 p-5">
          <TranslatableFormField control={control} name={titleName} label={t("form.metaTitle")} languages={languages} />
          <TranslatableFormField control={control} name={descriptionName} label={t("form.metaDescription")} kind="textarea" rows={3} languages={languages} />
        </div>
      )}
    </section>
  );
}
