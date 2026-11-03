import { cache } from "react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { api } from "./api";
import { t } from "./utils";
import type { Bootstrap, Translatable, User } from "./types";

const REVALIDATE = 60;

/** Layout data (settings, menus, languages) — cached per request and revalidated every minute. */
export const getBootstrap = cache(async (locale: string): Promise<Bootstrap> => {
  try {
    return await api.get<Bootstrap>("/public/bootstrap", { params: { locale }, revalidate: REVALIDATE, tags: ["bootstrap"] });
  } catch {
    return { locale, default_locale: "tk", settings: {}, languages: [], menus: {}, translations: {} };
  }
});

/** Typed accessors for settings values. */
export function setting<T = unknown>(settings: Record<string, unknown>, key: string, fallback?: T): T {
  const v = settings[key];
  if (v === undefined || v === null) return fallback as T;
  return v as T;
}

export function settingText(settings: Record<string, unknown>, key: string, locale: string, fallback = ""): string {
  const v = settings[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v === "string") return v || fallback;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return t(v as Translatable, locale) || fallback;
}

export function settingBool(settings: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = settings[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

/** Current user from the httpOnly cookie, resolved on the server (null when signed out). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const access = store.get("access_token")?.value;
  const refresh = store.get("refresh_token")?.value;
  if (!access && !refresh) return null;
  if (!access) return null; // the client will refresh via /auth/refresh
  try {
    return await api.get<User>("/auth/me", { headers: { Authorization: `Bearer ${access}` } });
  } catch {
    return null;
  }
});

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : `/${path}`);
}

/** Build page metadata from translatable fields + site defaults. */
export async function buildMetadata(
  locale: string,
  input: { title?: Translatable | string; description?: Translatable | string; image?: string; path?: string },
): Promise<Metadata> {
  const boot = await getBootstrap(locale);
  const siteName = settingText(boot.settings, "site.name", locale, "Arkadag Museum");
  const defaultTitle = settingText(boot.settings, "seo.title", locale, siteName);
  const defaultDesc = settingText(boot.settings, "seo.description", locale, "");
  const title = typeof input.title === "string" ? input.title : t(input.title, locale);
  const description = (typeof input.description === "string" ? input.description : t(input.description, locale)) || defaultDesc;
  const image = input.image || settingText(boot.settings, "seo.og_image", locale, "");
  const url = siteUrl(`/${locale}${input.path ?? ""}`);
  return {
    title: title ? `${title} · ${siteName}` : defaultTitle,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(["tk", "ru", "en"].map((l) => [l, siteUrl(`/${l}${input.path ?? ""}`)])),
    },
    openGraph: {
      title: title || defaultTitle,
      description,
      url,
      siteName,
      type: "website",
      locale,
      images: image ? [{ url: image.startsWith("http") ? image : siteUrl(image) }] : undefined,
    },
    twitter: { card: "summary_large_image", title: title || defaultTitle, description },
  };
}
