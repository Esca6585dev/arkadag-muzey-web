"use client";

// TEMPORARY demo of the admin form kit (delete when screens are built).
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Form } from "@/components/ui/form";
import { TranslatableFormField } from "@/components/admin/translatable-field";
import { ImageFormField } from "@/components/admin/image-field";
import { ImagesFormField } from "@/components/admin/images-field";
import { FormCard, ResourceFormLayout, SeoFields, SlugField } from "@/components/admin/resource-form-layout";

const tr = z.object({ tk: z.string().optional(), ru: z.string().optional(), en: z.string().optional() });
const schema = z.object({
  title: tr.refine((v) => !!v.tk?.trim(), "Turkmen title is required"),
  slug: z.string().optional(),
  excerpt: tr,
  body: tr,
  cover_image: z.string().optional(),
  images: z.array(z.string()),
  meta_title: tr,
  meta_description: tr,
});
type Values = z.infer<typeof schema>;

export default function KitDemoPage() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: {}, slug: "", excerpt: {}, body: {}, cover_image: "", images: [], meta_title: {}, meta_description: {} },
  });
  const { control, formState } = form;
  return (
    <div className="p-4 sm:p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => { toast.success("Submitted"); console.log(v); form.reset(v); })}>
          <ResourceFormLayout
            isDirty={formState.isDirty}
            saving={formState.isSubmitting}
            onCancel={() => history.back()}
            onSaveAndClose={() => void form.handleSubmit(() => toast.success("Saved & close"))()}
            side={
              <>
                <FormCard title="Cover image">
                  <ImageFormField control={control} name="cover_image" aspect="16/9" allowUrl />
                </FormCard>
                <SeoFields<Values> />
              </>
            }
          >
            <FormCard title="Content" description="Translatable fields">
              <TranslatableFormField control={control} name="title" label="Title" />
              <SlugField<Values> titleName="title" />
              <TranslatableFormField control={control} name="excerpt" label="Excerpt" kind="textarea" />
              <TranslatableFormField control={control} name="body" label="Body" kind="rich" />
            </FormCard>
            <FormCard title="Gallery">
              <ImagesFormField control={control} name="images" />
            </FormCard>
          </ResourceFormLayout>
        </form>
      </Form>
    </div>
  );
}
