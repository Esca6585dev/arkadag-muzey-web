# Admin form kit (`frontend/src/components/admin/`)

All components are client components, theme-aware, and use i18n keys `admin.form.*`, `admin.media.*`, `admin.kit.*`.
Translatable values are `{tk?, ru?, en?}`; images are URL strings (`/uploads/...`).

| Component | File | Purpose |
|---|---|---|
| `TranslatableField` / `TranslatableFormField` | translatable-field.tsx | Language tabs + input/textarea/rich. Props: `value,onChange,kind("input"|"textarea"|"rich"),languages=["tk","ru","en"],defaultLanguage="tk",rows,placeholder,disabled`. Tab dot = filled, `*` = required language. Form wrapper adds `control,name,label,description`. |
| `RichTextEditor` | rich-text-editor.tsx | tiptap v3, HTML in/out. Props: `value,onChange,placeholder,minHeight,disabled`. Empty content emits `""`. Syncs on external `value` change. Image button opens MediaPicker. |
| `MediaPicker` | media-picker.tsx | Dialog. Props: `open,onOpenChange,multiple,accept("image"|"all"),defaultFolder,onSelect(Media[])`. Library (folder filter, search, pagination) + Upload (drag&drop, progress, auto-select). Use `media.url` as the stored value. |
| `ImageField` / `ImageFormField` | image-field.tsx | One image. Props: `value,onChange,aspect="16/9",allowUrl,folder,disabled`. |
| `ImagesField` / `ImagesFormField` | images-field.tsx | `string[]`, drag-to-reorder, remove, multi-add. Props: `value,onChange,folder,max`. |
| `ResourceFormLayout` | resource-form-layout.tsx | Main + 320px side column, sticky save bar. Props: `children,side,header,isDirty,saving,onCancel,onSaveAndClose`. Also calls `useUnsavedChangesWarning`. |
| `FormCard` | same | Section card: `title,description,action`. |
| `FormSaveBar` | same | Sticky bar (Save = submit button; must be inside `<form>`). |
| `useUnsavedChangesWarning(isDirty)` | same | `beforeunload` guard. |
| `SlugField` | same | Props `name="slug", titleName, language="tk"`; "Generate" uses `slugify`. Needs `<Form>` context. |
| `SeoFields` | same | Collapsible card with translatable `meta_title` / `meta_description` (override with `titleName`, `descriptionName`). |

Backend media API: `GET /admin/media?folder&search&page&limit`, `GET /admin/media/folders`, `POST /admin/media/upload`
(multipart `files`, optional `folder`; max `MAX_UPLOAD_MB`=20; jpg/png/gif/webp/svg/pdf/mp4/webm/mp3/doc(x)/xls(x)).
Backend returns `{data:[Media]}` (201) and optional `errors:[{file,error}]` for partially failed uploads.

## Example

```tsx
"use client";
const tr = z.object({ tk: z.string().optional(), ru: z.string().optional(), en: z.string().optional() });
const schema = z.object({
  title: tr.refine((v) => !!v.tk?.trim(), "Required"),
  slug: z.string().optional(),
  body: tr,
  cover_image: z.string().optional(),
  images: z.array(z.string()),
  meta_title: tr, meta_description: tr,
});
type Values = z.infer<typeof schema>;

export function ArticleForm({ initial, onSave }: { initial?: Partial<Values>; onSave: (v: Values) => Promise<void> }) {
  const form = useForm<Values>({ resolver: zodResolver(schema),
    defaultValues: { title: {}, slug: "", body: {}, cover_image: "", images: [], meta_title: {}, meta_description: {}, ...initial } });
  const { control, formState } = form;
  const submit = (close: boolean) => form.handleSubmit(async (v) => { await onSave(v); form.reset(v); if (close) router.push("/admin/articles"); });
  return (
    <Form {...form}>
      <form onSubmit={submit(false)}>
        <ResourceFormLayout isDirty={formState.isDirty} saving={formState.isSubmitting}
          onCancel={() => router.push("/admin/articles")} onSaveAndClose={() => void submit(true)()}
          side={<><FormCard title="Cover"><ImageFormField control={control} name="cover_image" /></FormCard><SeoFields<Values> /></>}>
          <FormCard title="Content">
            <TranslatableFormField control={control} name="title" label="Title" />
            <SlugField<Values> titleName="title" />
            <TranslatableFormField control={control} name="body" label="Body" kind="rich" />
          </FormCard>
          <FormCard title="Gallery"><ImagesFormField control={control} name="images" /></FormCard>
        </ResourceFormLayout>
      </form>
    </Form>
  );
}
```

Notes: after a successful save call `form.reset(values)` so `isDirty` clears. Send translatable objects as-is (the API accepts `{tk,ru,en}`).
A working demo lives at `/admin/kit-demo` (temporary; delete when real screens exist).
