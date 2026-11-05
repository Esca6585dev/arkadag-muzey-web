# Admin panel conventions

Admin lives in `frontend/src/app/[locale]/admin/`. The layout (`admin/layout.tsx`) already checks the session and role
(admin/editor) and wraps every page in `AdminShell` (sidebar from `src/components/admin/nav.ts`, top bar with the
current section name). Pages only render their content. Form components are documented in `docs/ADMIN-forms.md`.

## Where the screens live

Most resources are configuration, not pages: `src/components/admin/crud/registry.tsx` describes each one (list
columns, filters, row actions, form cards made of `FieldDef`s from `crud/fields.tsx`) and
`app/[locale]/admin/[resource]/[[...rest]]/page.tsx` renders list / new / edit for every name in
`crud/resource-names.ts`. To add a resource: add the backend CRUD, a registry entry and the name in resource-names.ts.
Field types: translatable (input/textarea/rich), text, textarea, url, email, password, number, switch, select
(static or loaded from another resource), multiselect, image, images, datetime, slug, custom (any editor, e.g. the
page block editor in `admin/blocks/`).

Screens that are not plain CRUD have their own routes: dashboard (`admin/page.tsx`), settings, menus (tree editor),
media library, translations. Message detail and gallery photos are registry `detail` / `extra` components in
`components/admin/screens/`.

## Routing pattern per resource (custom screens)

```
admin/<resource>/page.tsx          list   (server component: setRequestLocale + metadata, renders a client list)
admin/<resource>/new/page.tsx      create (renders the client form without id)
admin/<resource>/[id]/page.tsx     edit   (renders the client form with id)
```

Small resources (tags, categories, languages, ...) can edit in a `Dialog` from the list instead of separate pages.
Page files are thin server components:

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HallsList } from "@/components/admin/screens/halls-list";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("halls") };
}
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HallsList />;
}
```

Put screen components in `src/components/admin/screens/<resource>-list.tsx` / `<resource>-form.tsx`.
For `[id]` pages read `id` from params and pass it as a prop.

## Kit (`src/components/admin/`)

| File | Exports |
|---|---|
| `use-resource.ts` | `useResourceList<T>(resource, params)` → react-query `{data: {data, meta}}`; `useResourceItem<T>(resource, id)`; `useSaveResource<T>(resource)` → `{save({id?, values}) → {ok, data?, fields?}, isSaving}` (POST or PUT, toasts, invalidates; never throws); `useDeleteResource(resource)`; `useBulkDeleteResource(resource)`; `resourceKeys` for manual invalidation. `resource` is the path after `/admin/`, e.g. `"articles"`. |
| `resource-table.tsx` | `ResourceTable<T>` (see below), `TitleCell({title, subtitle?, href?})`, types `Column<T>`, `FilterDef` |
| `page-header.tsx` | `PageHeader({title, description?, actions?, backHref?, backLabel?})` |
| `status-badge.tsx` | `StatusBadge({status, label?})` for draft/published/archived/new/read/replied/active/blocked/inactive; `ActiveBadge({active})` |
| `confirm-dialog.tsx` | `ConfirmDialog` (controlled) and `useConfirm()` → `{confirm(opts?) → Promise<boolean>, dialog}`; render `{dialog}` once |
| form kit | `TranslatableFormField`, `RichTextEditor`, `MediaPicker`, `ImageFormField`, `ImagesFormField`, `ResourceFormLayout`, `FormCard`, `SlugField`, `SeoFields` — see `docs/ADMIN-forms.md` |

### ResourceTable

```tsx
<ResourceTable<Hall>
  resource="halls"                       // GET /admin/halls?page&limit&search&sort&<filters>
  defaultSort="sort_order"               // "-created_at" for newest first
  searchPlaceholder={t("search")}
  filters={[{ key: "status", label: t("table.status"), options: [{ value: "published", label: ts("published") }] }]}
  editHref={(h) => `/admin/halls/${h.id}`} // or onEdit={(row) => openDialog(row)}
  canDelete={(row) => !row.is_system}    // optional
  toolbar={<Button asChild size="sm"><Link href="/admin/halls/new">...</Link></Button>}
  columns={[
    { key: "cover", header: t("table.image"), className: "w-16", cell: (h) => <Thumb src={h.cover_image} /> },
    { key: "title", header: t("table.title"), sortable: true, cell: (h) => <TitleCell title={tr(h.title, locale)} subtitle={h.slug} href={`/admin/halls/${h.id}`} /> },
    { key: "status", header: t("table.status"), cell: (h) => <StatusBadge status={h.status} /> },
    { key: "updated_at", header: t("table.updated"), sortable: true, className: "hidden md:table-cell", cell: (h) => formatDate(h.updated_at, locale) },
  ]}
/>
```

Page, search (`search`), sort (`sort=field` / `sort=-field`), per-page (`limit`) and filters are stored in the URL.
Row actions: edit (link or callback), extra items via `rowActions(row)` (return `DropdownMenuItem`s), delete with confirm.
Bulk delete calls `POST /admin/<resource>/bulk-delete {ids}`.

### Form page skeleton

```tsx
"use client";
export function HallForm({ id }: { id?: number }) {
  const item = useResourceItem<Hall>("halls", id);
  if (id && item.isLoading) return <FormSkeleton />;
  if (id && !item.data) return <EmptyState title={t("errors.notFound")} />;
  // Mount the real form only when data is ready, so defaultValues are correct (no reset-in-effect).
  return <HallFormInner key={item.data?.id ?? "new"} id={id} initial={item.data ? toValues(item.data) : EMPTY} />;
}

function HallFormInner({ id, initial }: { id?: number; initial: Values }) {
  const router = useRouter();                       // from @/i18n/navigation
  const { save } = useSaveResource<Hall>("halls");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });

  const submit = (close: boolean) =>
    form.handleSubmit(async (values) => {
      const res = await save({ id, values: toPayload(values) });
      if (!res.ok) { Object.entries(res.fields ?? {}).forEach(([k, m]) => form.setError(k as never, { message: m })); return; }
      form.reset(values);
      if (close) router.push("/admin/halls");
      else if (!id && res.data) router.replace(`/admin/halls/${(res.data as Hall).id}`);
    });
  ...
}
```

- Translatable fields are sent as `{tk, ru, en}` objects; the default language (`tk`) is required for titles/names.
- Dates: API uses RFC3339 strings; use `<Input type="datetime-local">` and convert (`new Date(v).toISOString()`).
- Numbers from inputs must be converted (`z.coerce.number()`).
- Show `PageHeader` with `backHref` to the list on form pages.
- Read the backend model (`backend/internal/models/models.go`) and handler (`backend/internal/handlers/<resource>.go`) for the exact field names and validation before writing a form.

## Style rules

- Cards: `rounded-2xl border border-border/70 bg-card shadow-sm`; theme tokens only (works in dark mode); 390px friendly.
- Strings: `useTranslations("admin")` — keys `table.*`, `form.*`, `status.*`, `list.*`, `kit.*`, resource names. Add missing
  keys with the add-messages script for all three locales (tk / ru / en).
- Toasts come from the hooks; don't add duplicate ones.
