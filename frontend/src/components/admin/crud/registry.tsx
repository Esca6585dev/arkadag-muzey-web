"use client";
// Admin resources driven by configuration: list columns/filters + form cards per resource.
// Routes /admin/<resource>, /admin/<resource>/new and /admin/<resource>/<id> render these through
// app/[locale]/admin/[resource]/[[...rest]]/page.tsx. Names must also be listed in resource-names.ts.

import type { ReactNode } from "react";
import { t as tr } from "@/lib/utils";
import type { Column, FilterDef } from "../resource-table";
import { TitleCell } from "../resource-table";
import { MessageDetail } from "../screens/message-detail";
import { GalleryItems } from "../screens/gallery-items";
import { ViewOnSite } from "../screens/view-on-site";
import { BlockEditor, type Block } from "../blocks/block-editor";
import { MakeDefaultLanguage } from "../screens/make-default-language";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { columnKit, type ColumnCtx, type Row } from "./columns";
import { trLabel, type FieldDef } from "./fields";
import type { FormConfig } from "./resource-form";

export interface ListConfig {
  columns: (ctx: ColumnCtx) => Column<Row>[];
  filters?: (ctx: ColumnCtx & { ts: (k: string) => string }) => FilterDef[];
  defaultSort?: string;
  /** false hides the "new" button and the form routes */
  creatable?: boolean;
  /** false makes rows read-only (no edit link) */
  editable?: boolean;
  deletable?: boolean | ((row: Row) => boolean);
  selectable?: boolean;
  toolbar?: (ctx: ColumnCtx) => ReactNode;
  rowActions?: (row: Row) => ReactNode;
}

export interface ResourceDef {
  titleKey: string;
  list: ListConfig;
  form?: Omit<FormConfig, "resource" | "listHref" | "titleKey">;
  /** Replaces the generic form (e.g. message detail). */
  detail?: (id: number) => ReactNode;
}

const statusOptions = (ts: (k: string) => string) => ["draft", "published", "archived"].map((v) => ({ value: v, label: ts(v) }));
const STATUS_SELECT = (def = "draft"): FieldDef => ({
  name: "status",
  label: "form.status",
  type: "select",
  default: def,
  required: true,
  translate: true,
  options: [
    { value: "draft", label: "status.draft" },
    { value: "published", label: "status.published" },
    { value: "archived", label: "status.archived" },
  ],
});
const SORT: FieldDef = { name: "sort_order", label: "form.sortOrder", type: "number", default: 0, width: "half" };
const ACTIVE: FieldDef = { name: "is_active", label: "form.active", type: "switch", default: true };
const FEATURED: FieldDef = { name: "is_featured", label: "form.featured", type: "switch", default: false };

export const RESOURCES: Record<string, ResourceDef> = {
  articles: {
    titleKey: "articles",
    list: {
      defaultSort: "-id",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb(), k.title(), k.text("category", "table.category", (r) => (r.category as Row | null)?.name), k.status(), k.number("views", "table.views"), k.date("published_at", "table.published")];
      },
      filters: ({ t, ts }) => [
        { key: "status", label: t("table.status"), options: statusOptions(ts) },
        { key: "featured", label: t("table.featured"), options: [{ value: "true", label: t("table.featured") }] },
      ],
    },
    form: {
      headingField: "title",
      seo: true,
      publicHref: (r) => (r.status === "published" ? `/news/${r.slug}` : undefined),
      main: [
        {
          title: "form.content",
          fields: [
            { name: "title", label: "form.title", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "title" },
            { name: "excerpt", label: "form.excerpt", type: "translatable", kind: "textarea", rows: 3 },
            { name: "body", label: "form.body", type: "translatable", kind: "rich" },
          ],
        },
        { title: "form.images", fields: [{ name: "images", label: "form.images", type: "images", folder: "news" }] },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            STATUS_SELECT(),
            { name: "published_at", label: "form.publishedAt", type: "datetime" },
            { name: "category_id", label: "form.category", type: "select", numeric: true, nullable: true, optionsFrom: { resource: "categories", label: trLabel("name") } },
            FEATURED,
          ],
        },
        { title: "form.coverImage", fields: [{ name: "cover_image", label: "", type: "image", folder: "news" }] },
        { title: "form.tags", fields: [{ name: "tags", label: "", type: "multiselect", optionsFrom: { resource: "tags", label: trLabel("name") } }] },
      ],
    },
  },

  categories: {
    titleKey: "categories",
    list: {
      defaultSort: "sort_order",
      columns: (c) => {
        const k = columnKit(c);
        return [k.title("name", undefined, "table.name"), k.number("article_count", "table.items", false), k.number("sort_order", "table.order"), k.active()];
      },
    },
    form: {
      headingField: "name",
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "name", label: "form.name", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "name" },
            { name: "description", label: "form.description", type: "translatable", kind: "textarea" },
          ],
        },
      ],
      side: [
        {
          title: "form.settings",
          fields: [{ name: "parent_id", label: "form.parent", type: "select", numeric: true, nullable: true, optionsFrom: { resource: "categories", label: trLabel("name") } }, SORT, ACTIVE],
        },
        { title: "form.image", fields: [{ name: "image", label: "", type: "image", folder: "categories" }] },
      ],
    },
  },

  tags: {
    titleKey: "tags",
    list: {
      columns: (c) => [columnKit(c).title("name", undefined, "table.name"), columnKit(c).date("created_at", "table.created")],
    },
    form: {
      headingField: "name",
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "name", label: "form.name", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "name" },
          ],
        },
      ],
    },
  },

  halls: {
    titleKey: "halls",
    list: {
      defaultSort: "sort_order",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb(), k.title("name", undefined, "table.name"), k.number("exhibit_count", "table.items", false), k.number("sort_order", "table.order"), k.active()];
      },
    },
    form: {
      headingField: "name",
      publicHref: (r) => (r.is_active ? `/halls/${r.slug}` : undefined),
      main: [
        {
          title: "form.content",
          fields: [
            { name: "name", label: "form.name", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "name" },
            { name: "summary", label: "form.summary", type: "translatable", kind: "textarea", rows: 3 },
            { name: "description", label: "form.description", type: "translatable", kind: "rich" },
          ],
        },
        { title: "form.images", fields: [{ name: "images", label: "form.images", type: "images", folder: "halls" }] },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            { name: "floor", label: "form.floor", type: "text", width: "half" },
            SORT,
            { name: "icon", label: "form.icon", type: "text", placeholder: "landmark" },
            ACTIVE,
          ],
        },
        { title: "form.coverImage", fields: [{ name: "cover_image", label: "", type: "image", folder: "halls" }] },
      ],
    },
  },

  exhibits: {
    titleKey: "exhibits",
    list: {
      defaultSort: "-id",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb("image"), k.title(), k.text("hall", "table.hall", (r) => (r.hall as Row | null)?.name), k.status(), k.number("views", "table.views")];
      },
      filters: ({ t, ts }) => [
        { key: "status", label: t("table.status"), options: statusOptions(ts) },
        { key: "featured", label: t("table.featured"), options: [{ value: "true", label: t("table.featured") }] },
      ],
    },
    form: {
      headingField: "title",
      publicHref: (r) => (r.status === "published" ? `/exhibits/${r.slug}` : undefined),
      main: [
        {
          title: "form.content",
          fields: [
            { name: "title", label: "form.title", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "title" },
            { name: "summary", label: "form.summary", type: "translatable", kind: "textarea", rows: 3 },
            { name: "description", label: "form.description", type: "translatable", kind: "rich" },
          ],
        },
        {
          title: "form.basic",
          fields: [
            { name: "period", label: "form.period", type: "translatable", width: "half" },
            { name: "material", label: "form.material", type: "translatable", width: "half" },
            { name: "origin", label: "form.origin", type: "translatable", width: "half" },
            { name: "inventory_no", label: "form.inventoryNo", type: "text", width: "half" },
          ],
        },
        { title: "form.images", fields: [{ name: "images", label: "form.images", type: "images", folder: "exhibits" }] },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            STATUS_SELECT(),
            { name: "hall_id", label: "form.hall", type: "select", numeric: true, nullable: true, optionsFrom: { resource: "halls", label: trLabel("name") } },
            SORT,
            FEATURED,
          ],
        },
        { title: "form.image", fields: [{ name: "image", label: "", type: "image", folder: "exhibits", aspect: "4/3" }] },
      ],
    },
  },

  events: {
    titleKey: "events",
    list: {
      defaultSort: "-starts_at",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb("image"), k.title(), k.date("starts_at", "table.starts", true), k.text("location", "table.position", undefined, "hidden md:table-cell"), k.status()];
      },
      filters: ({ t, ts }) => [{ key: "status", label: t("table.status"), options: statusOptions(ts) }],
    },
    form: {
      headingField: "title",
      publicHref: (r) => (r.status === "published" ? `/events/${r.slug}` : undefined),
      main: [
        {
          title: "form.content",
          fields: [
            { name: "title", label: "form.title", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "title" },
            { name: "summary", label: "form.summary", type: "translatable", kind: "textarea", rows: 3 },
            { name: "description", label: "form.description", type: "translatable", kind: "rich" },
          ],
        },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            STATUS_SELECT(),
            { name: "starts_at", label: "form.startsAt", type: "datetime", required: true },
            { name: "ends_at", label: "form.endsAt", type: "datetime" },
            { name: "location", label: "form.location", type: "translatable" },
            { name: "price", label: "form.price", type: "translatable" },
            FEATURED,
          ],
        },
        { title: "form.image", fields: [{ name: "image", label: "", type: "image", folder: "events" }] },
      ],
    },
  },

  slides: {
    titleKey: "slides",
    list: {
      defaultSort: "sort_order",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb("image"), k.title("title", (r) => r.button_url as string), k.text("position", "table.position"), k.number("sort_order", "table.order"), k.active()];
      },
    },
    form: {
      headingField: "title",
      main: [
        {
          title: "form.content",
          fields: [
            { name: "title", label: "form.title", type: "translatable" },
            { name: "subtitle", label: "form.subtitle", type: "translatable", kind: "textarea", rows: 2 },
            { name: "button_text", label: "form.buttonText", type: "translatable", width: "half" },
            { name: "button_url", label: "form.buttonUrl", type: "url", width: "half", placeholder: "/halls" },
            { name: "button2_text", label: "form.button2Text", type: "translatable", width: "half" },
            { name: "button2_url", label: "form.button2Url", type: "url", width: "half" },
          ],
        },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            { name: "position", label: "form.position", type: "select", default: "home", required: true, options: [{ value: "home", label: "home" }] },
            SORT,
            ACTIVE,
          ],
        },
        {
          title: "form.media",
          fields: [
            { name: "image", label: "form.image", type: "image", folder: "slides", required: true },
            { name: "mobile_image", label: "form.mobileImage", type: "image", folder: "slides", aspect: "9/16" },
          ],
        },
      ],
    },
  },

  galleries: {
    titleKey: "galleries",
    list: {
      defaultSort: "sort_order",
      columns: (c) => {
        const k = columnKit(c);
        return [k.thumb(), k.title(), k.number("item_count", "table.items", false), k.number("sort_order", "table.order"), k.active()];
      },
    },
    form: {
      headingField: "title",
      publicHref: (r) => (r.is_active ? `/gallery/${r.slug}` : undefined),
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "title", label: "form.title", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "title" },
            { name: "description", label: "form.description", type: "translatable", kind: "textarea" },
          ],
        },
      ],
      side: [
        { title: "form.settings", fields: [SORT, ACTIVE] },
        { title: "form.coverImage", fields: [{ name: "cover_image", label: "", type: "image", folder: "galleries" }] },
      ],
      extra: (r) => <GalleryItems galleryId={r.id} />,
    },
  },
};

const ENTITIES = ["article", "category", "tag", "page", "hall", "exhibit", "gallery", "event", "slide", "menu", "message", "subscriber", "user", "language", "translation", "setting", "media"];
const LOG_ACTIONS = ["create", "update", "delete", "login", "register", "import", "password_change"];

const ROUTE_PAGES = ["home", "about", "contact", "visit"];
/** Public URL of a dynamic page. */
export const pagePath = (slug: string) => (slug === "home" ? "/" : ROUTE_PAGES.includes(slug) ? `/${slug}` : `/p/${slug}`);

Object.assign(RESOURCES, {
  pages: {
    titleKey: "pages",
    list: {
      defaultSort: "-updated_at",
      columns: (c) => {
        const k = columnKit(c);
        return [k.title("title", (r) => pagePath(r.slug as string)), k.text("blocks", "form.blocks", (r) => String((r.blocks as unknown[] | null)?.length ?? 0), "hidden md:table-cell"), k.status(), k.date("updated_at", "table.updated")];
      },
      filters: ({ t, ts }) => [{ key: "status", label: t("table.status"), options: statusOptions(ts) }],
      deletable: (r) => !r.is_system && !ROUTE_PAGES.includes(r.slug as string),
      rowActions: (r) => <ViewOnSite href={pagePath(r.slug as string)} />,
    },
    form: {
      headingField: "title",
      seo: true,
      publicHref: (r) => (r.status === "published" ? pagePath(r.slug as string) : undefined),
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "title", label: "form.title", type: "translatable", required: true },
            { name: "slug", label: "form.slug", type: "slug", from: "title", description: "form.slugHint" },
            { name: "excerpt", label: "form.excerpt", type: "translatable", kind: "textarea", rows: 2 },
          ],
        },
        { title: "form.blocks", fields: [{ name: "blocks", label: "", type: "custom", default: [], render: (p) => <BlockEditor value={p.value as Block[]} onChange={p.onChange} /> }] },
      ],
      side: [
        { title: "form.settings", fields: [STATUS_SELECT("published")] },
        { title: "form.coverImage", fields: [{ name: "cover_image", label: "", type: "image", folder: "pages" }] },
      ],
    },
  },

  messages: {
    titleKey: "messages",
    detail: (id: number) => <MessageDetail id={id} />,
    list: {
      defaultSort: "-id",
      creatable: false,
      columns: (c) => {
        const k = columnKit(c);
        return [
          {
            key: "name",
            header: c.t("table.name"),
            cell: (r: Row) => (
              <TitleCell
                title={<span className={r.status === "new" ? "font-semibold" : "font-normal"}>{String(r.name)}</span>}
                subtitle={String(r.email)}
                href={`${c.basePath}/${r.id}`}
              />
            ),
          },
          k.text("subject", "table.subject", (r) => r.subject || String(r.message ?? "").slice(0, 80)),
          k.status(),
          k.date("created_at", "table.date", true),
        ];
      },
      filters: ({ t }) => [{ key: "status", label: t("table.status"), options: ["new", "read", "replied"].map((v) => ({ value: v, label: t(`status.${v}`) })) }],
    },
  },

  users: {
    titleKey: "users",
    list: {
      defaultSort: "-id",
      columns: (c) => {
        const k = columnKit(c);
        return [
          k.title("name", (r) => r.email as string, "table.name"),
          k.text("role", "table.role", (r) => c.t(`roles.${r.role}`)),
          k.status(),
          k.date("last_login_at", "table.lastLogin", true),
        ];
      },
      filters: ({ t }) => [{ key: "status", label: t("table.status"), options: ["active", "blocked"].map((v) => ({ value: v, label: t(`status.${v}`) })) }],
    },
    form: {
      headingField: "name",
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "name", label: "form.name", type: "text", required: true },
            { name: "email", label: "form.email", type: "email", required: true, width: "half" },
            { name: "phone", label: "form.phone", type: "text", width: "half" },
            { name: "password", label: "form.password", type: "password", description: "form.passwordHint" },
          ],
        },
      ],
      side: [
        {
          title: "form.settings",
          fields: [
            { name: "role", label: "form.role", type: "select", default: "editor", required: true, translate: true, options: ["admin", "editor", "user"].map((v) => ({ value: v, label: `roles.${v}` })) },
            { name: "status", label: "form.status", type: "select", default: "active", required: true, translate: true, options: ["active", "blocked"].map((v) => ({ value: v, label: `status.${v}` })) },
          ],
        },
      ],
    },
  },

  languages: {
    titleKey: "languages",
    list: {
      defaultSort: "sort_order",
      columns: (c) => {
        const k = columnKit(c);
        return [
          k.text("flag", "form.flag", undefined, "w-14 text-xl"),
          k.title("native_name", (r) => `${r.code} · ${r.name}${r.is_default ? ` · ${c.t("table.default")}` : ""}`, "table.name"),
          k.number("sort_order", "table.order"),
          k.active("is_enabled"),
        ];
      },
      deletable: (r) => !r.is_default,
      rowActions: (r) => (r.is_default ? null : <MakeDefaultLanguage id={r.id} />),
    },
    form: {
      headingField: "native_name",
      main: [
        {
          title: "form.basic",
          fields: [
            { name: "code", label: "form.code", type: "text", required: true, width: "half" },
            { name: "flag", label: "form.flag", type: "text", width: "half" },
            { name: "name", label: "form.name", type: "text", required: true, width: "half" },
            { name: "native_name", label: "form.nativeName", type: "text", width: "half" },
          ],
        },
      ],
      side: [{ title: "form.settings", fields: [SORT, { name: "is_enabled", label: "form.enabled", type: "switch", default: true }] }],
    },
  },

  subscribers: {
    titleKey: "subscribers",
    list: {
      defaultSort: "-id",
      creatable: false,
      editable: false,
      columns: (c) => {
        const k = columnKit(c);
        return [
          k.text("email", "table.email", undefined, "font-medium"),
          k.text("name", "table.name"),
          k.text("locale", "form.language"),
          { key: "state", header: c.t("table.status"), cell: (r) => columnKit(c).active("x").cell({ ...r, x: r.is_confirmed && !r.unsubscribed_at }) },
          k.date("created_at", "table.created"),
        ];
      },
      toolbar: (c) => (
        <Button asChild size="sm" variant="outline" className="h-9">
          <a href="/api/v1/admin/subscribers/export.csv" download>
            <Download className="size-4" /> {c.t("translationsPage.export")} CSV
          </a>
        </Button>
      ),
      filters: ({ t }) => [
        {
          key: "confirmed",
          label: t("table.status"),
          options: [
            { value: "true", label: t("status.active") },
            { value: "false", label: t("status.inactive") },
          ],
        },
      ],
    },
  },

  "activity-logs": {
    titleKey: "activityLogs",
    list: {
      defaultSort: "-id",
      creatable: false,
      editable: false,
      deletable: false,
      selectable: false,
      columns: (c) => {
        const k = columnKit(c);
        return [
          k.date("created_at", "table.date", true),
          k.text("user", "table.user", (r) => (r.user as Row | null)?.name),
          k.text("action", "table.action", (r) => (LOG_ACTIONS.includes(r.action as string) ? c.t(`logs.${r.action}`) : r.action)),
          k.text("entity", "table.entity", (r) => `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ""}`),
          k.text("ip", "table.ip", undefined, "hidden md:table-cell font-mono text-xs"),
        ];
      },
      filters: ({ t }) => [
        { key: "entity", label: t("table.entity"), options: ENTITIES.map((v) => ({ value: v, label: v })) },
        { key: "action", label: t("table.action"), options: LOG_ACTIONS.map((v) => ({ value: v, label: t(`logs.${v}`) })) },
      ],
    },
  },
} satisfies Record<string, ResourceDef>);

/** Display name of a record for headings (translatable or plain). */
export function recordName(r: Row, field: string, locale: string): string {
  const v = r[field];
  return v && typeof v === "object" ? tr(v as Record<string, string>, locale) : String(v ?? "");
}
