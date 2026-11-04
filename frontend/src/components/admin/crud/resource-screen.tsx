"use client";
// Renders the list, create or edit screen of a registry resource.

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { ResourceTable } from "../resource-table";
import type { Row } from "./columns";
import { RESOURCES } from "./registry";
import { ResourceForm } from "./resource-form";

export function ResourceScreen({ resource, mode, id }: { resource: string; mode: "list" | "new" | "edit"; id?: number }) {
  const t = useTranslations("admin");
  const ts = useTranslations("admin.status");
  const locale = useLocale();
  const def = RESOURCES[resource];
  const basePath = `/admin/${resource}`;
  if (!def) return null;

  if (mode !== "list") {
    if (def.detail && id) return <>{def.detail(id)}</>;
    if (!def.form) return null;
    return <ResourceForm config={{ ...def.form, resource, listHref: basePath, titleKey: def.titleKey }} id={id} />;
  }

  const ctx = { t: t as unknown as (k: string, v?: Record<string, string | number>) => string, locale, basePath };
  const creatable = def.list.creatable !== false && !!def.form;
  const editable = def.list.editable !== false && (!!def.form || !!def.detail);
  const deletable = def.list.deletable ?? true;

  return (
    <>
      <PageHeader
        title={t(def.titleKey)}
        actions={
          creatable ? (
            <Button asChild className="rounded-full">
              <Link href={`${basePath}/new`}>
                <Plus className="size-4" /> {t("list.new")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ResourceTable<Row>
        resource={resource}
        columns={def.list.columns(ctx)}
        filters={def.list.filters?.({ ...ctx, ts: (k: string) => ts(k) })}
        defaultSort={def.list.defaultSort}
        editHref={editable ? (r) => `${basePath}/${r.id}` : undefined}
        canDelete={typeof deletable === "function" ? deletable : () => deletable}
        selectable={def.list.selectable ?? deletable !== false}
        toolbar={def.list.toolbar?.(ctx)}
        rowActions={def.list.rowActions}
      />
    </>
  );
}
