import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import { t as tr } from "@/lib/utils";
import type { Page } from "@/lib/types";

export async function fetchPage(slug: string): Promise<Page | null> {
  return api.safeGet<Page>(`/public/pages/${slug}`, { revalidate: 60, tags: ["pages", `page:${slug}`] });
}

export async function pageMetadata(slug: string, locale: string, path?: string): Promise<Metadata> {
  const page = await fetchPage(slug);
  if (!page) return buildMetadata(locale, { path: path ?? `/${slug}` });
  return buildMetadata(locale, {
    title: tr(page.meta_title, locale) || tr(page.title, locale),
    description: tr(page.meta_description, locale) || tr(page.excerpt, locale),
    image: page.cover_image,
    path: path ?? (slug === "home" ? "" : `/${slug}`),
  });
}

/** Renders a block-based page. Adds a default header when the page has no hero/page_header block. */
export async function DynamicPage({ slug, locale }: { slug: string; locale: string }) {
  const page = await fetchPage(slug);
  if (!page) notFound();
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  const hasHeader = blocks.some((b) => b.type === "hero" || b.type === "page_header");
  const title = tr(page.title, locale);
  return (
    <>
      {!hasHeader && <PageHeaderBlock s={{ title: page.title, subtitle: page.excerpt, image: page.cover_image }} locale={locale} fallbackTitle={title} />}
      <BlockRenderer blocks={blocks} locale={locale} pageTitle={title} />
    </>
  );
}
