import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

const LOCALES = ["tk", "ru", "en"];
const STATIC_PATHS = ["", "/about", "/visit", "/contact", "/news", "/halls", "/exhibits", "/events", "/gallery"];

type Entry = { slug: string; updated_at?: string };

/** All records of a public list endpoint for one locale (the API filters by available translations). */
async function collect(path: string, locale: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, meta } = await api.safeList<Entry>(path, { params: { page, limit: 200 }, locale, revalidate });
    out.push(...data);
    if (page >= meta.pages) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const alternates = (path: string) => ({ languages: Object.fromEntries(LOCALES.map((l) => [l, siteUrl(`/${l}${path}`)])) });

  for (const path of STATIC_PATHS) {
    for (const l of LOCALES) {
      entries.push({ url: siteUrl(`/${l}${path}`), changeFrequency: path === "" || path === "/news" ? "daily" : "weekly", priority: path === "" ? 1 : 0.7, alternates: alternates(path) });
    }
  }

  const sections: { api: string; route: string; freq: "weekly" | "monthly" }[] = [
    { api: "/public/articles", route: "/news", freq: "monthly" },
    { api: "/public/halls", route: "/halls", freq: "monthly" },
    { api: "/public/exhibits", route: "/exhibits", freq: "monthly" },
    { api: "/public/events", route: "/events", freq: "weekly" },
    { api: "/public/galleries", route: "/gallery", freq: "monthly" },
  ];
  for (const s of sections) {
    for (const l of LOCALES) {
      for (const item of await collect(s.api, l)) {
        entries.push({
          url: siteUrl(`/${l}${s.route}/${item.slug}`),
          lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
          changeFrequency: s.freq,
          priority: 0.6,
        });
      }
    }
  }
  return entries;
}
