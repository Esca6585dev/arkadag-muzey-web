"use client";
// Generic create/edit page for a config-driven admin resource (see registry.tsx).
// Loads the record, builds react-hook-form values from the FieldDefs, checks required fields,
// saves via POST/PUT and keeps the form in sync with what the API returned.

import type { ReactNode } from "react";
import { useForm, type FieldValues, type Path } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { t as tr } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { FormCard, ResourceFormLayout, SeoFields } from "../resource-form-layout";
import { useResourceItem, useSaveResource } from "../use-resource";
import { FieldRenderer, isMissing, toFormValue, toPayloadValue, type FieldDef } from "./fields";

export type Row = Record<string, unknown> & { id: number };

export interface CardDef {
  /** i18n key in the `admin` namespace */
  title?: string;
  fields: FieldDef[];
}

export interface FormConfig {
  resource: string;
  listHref: string;
  /** i18n key (admin namespace) of the resource name, e.g. "halls" */
  titleKey: string;
  /** Translatable field used as the heading of an existing record */
  headingField: string;
  main: CardDef[];
  side?: CardDef[];
  /** Adds the collapsible meta_title / meta_description card */
  seo?: boolean;
  /** Public URL of a record ("view on site" button) */
  publicHref?: (record: Row) => string | undefined;
  /** Extra panel below the form for saved records (e.g. gallery items) */
  extra?: (record: Row) => ReactNode;
}

const SEO_FIELDS: FieldDef[] = [
  { name: "meta_title", label: "form.metaTitle", type: "translatable" },
  { name: "meta_description", label: "form.metaDescription", type: "translatable" },
];

function allFields(c: FormConfig): FieldDef[] {
  const fields = [...c.main, ...(c.side ?? [])].flatMap((card) => card.fields);
  return c.seo ? [...fields, ...SEO_FIELDS] : fields;
}

function toValues(c: FormConfig, record?: Row): FieldValues {
  return Object.fromEntries(allFields(c).map((f) => [f.name, toFormValue(f, record ? record[f.name] : f.default)]));
}

export function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export function ResourceForm({ config, id }: { config: FormConfig; id?: number }) {
  const t = useTranslations("admin");
  const item = useResourceItem<Row>(config.resource, id);
  if (id && item.isLoading) return <FormSkeleton />;
  if (id && !item.data) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title={t("errors.notFound")}
        action={
          <Button asChild variant="outline" className="rounded-full">
            <Link href={config.listHref}>{t(config.titleKey)}</Link>
          </Button>
        }
      />
    );
  }
  // Mount the form once the record is known so defaultValues are right from the start.
  return <ResourceFormInner key={item.data?.id ?? "new"} config={config} id={id} record={item.data} />;
}

function ResourceFormInner({ config, id, record }: { config: FormConfig; id?: number; record?: Row }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const fields = allFields(config);
  const form = useForm<FieldValues>({ defaultValues: toValues(config, record) });
  const { save, isSaving } = useSaveResource<Row>(config.resource);

  const submit = (close: boolean) =>
    form.handleSubmit(async (values) => {
      const missing = fields.filter((f) => isMissing(f, values[f.name]));
      if (missing.length) {
        missing.forEach((f) => form.setError(f.name as Path<FieldValues>, { message: t("kit.required") }));
        toast.error(t("form.validationError"));
        return;
      }
      const payload = Object.fromEntries(fields.map((f) => [f.name, toPayloadValue(f, values[f.name])]));
      const res = await save({ id, values: payload });
      if (!res.ok) {
        Object.entries(res.fields ?? {}).forEach(([k, m]) => form.setError(k as Path<FieldValues>, { message: m }));
        return;
      }
      form.reset(res.data ? toValues(config, res.data) : values);
      if (close) router.push(config.listHref);
      else if (!id && res.data) router.replace(`${config.listHref}/${res.data.id}`);
    });

  const headingValue = record?.[config.headingField];
  const heading = record
    ? (typeof headingValue === "string" ? headingValue : tr(headingValue as Record<string, string>, locale)) || `#${record.id}` : `${t("list.new")} · ${t(config.titleKey)}`;
  const publicUrl = record && config.publicHref?.(record);

  const renderCards = (cards: CardDef[]) =>
    cards.map((card, i) => (
      <FormCard key={card.title ?? i} title={card.title ? t(card.title) : undefined}>
        <div className="grid gap-5 sm:grid-cols-2">
          {card.fields.map((f) => (
            <FieldRenderer key={f.name} field={f} control={form.control} />
          ))}
        </div>
      </FormCard>
    ));

  return (
    <>
      <PageHeader
        title={heading}
        backHref={config.listHref}
        backLabel={t(config.titleKey)}
        actions={
          publicUrl ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={publicUrl} target="_blank">
                <ExternalLink className="size-4" /> {t("form.preview")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Form {...form}>
        <form onSubmit={submit(false)}>
          <ResourceFormLayout
            isDirty={form.formState.isDirty}
            saving={isSaving || form.formState.isSubmitting}
            onCancel={() => router.push(config.listHref)}
            onSaveAndClose={() => void submit(true)()}
            side={
              <>
                {renderCards(config.side ?? [])}
                {config.seo && <SeoFields<FieldValues> />}
              </>
            }
          >
            {renderCards(config.main)}
          </ResourceFormLayout>
        </form>
      </Form>
      {record && config.extra && <div className="mt-6">{config.extra(record)}</div>}
    </>
  );
}
