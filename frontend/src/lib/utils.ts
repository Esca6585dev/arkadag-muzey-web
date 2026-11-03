import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Translatable value: {"tk": "...", "ru": "...", "en": "..."} */
export type Translatable = Record<string, string> | null | undefined;

/** Pick a localized string with fallback to the default locale (tk), then any value. */
export function t(value: Translatable, locale: string, fallback = "tk"): string {
  if (!value) return "";
  if (value[locale]) return value[locale];
  if (value[fallback]) return value[fallback];
  for (const v of Object.values(value)) if (v) return v;
  return "";
}

/** Resolve an API-relative media URL (e.g. /uploads/x.jpg) to an absolute URL for next/image. */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const base = (typeof window === "undefined" ? process.env.API_URL : process.env.NEXT_PUBLIC_API_URL) || "";
  if (!base) return path;
  return base.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function excerpt(html: string | null | undefined, length = 160): string {
  const text = stripHtml(html);
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : length) + "…";
}

export function formatDate(value?: string | Date | null, locale = "tk", opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const map: Record<string, string> = { tk: "tk-TM", ru: "ru-RU", en: "en-GB" };
  try {
    return new Intl.DateTimeFormat(map[locale] || locale, opts ?? { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts ?? { day: "numeric", month: "long", year: "numeric" }).format(d);
  }
}

export function formatNumber(n: number | string, locale = "tk"): string {
  const map: Record<string, string> = { tk: "tk-TM", ru: "ru-RU", en: "en-GB" };
  const num = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  try {
    return new Intl.NumberFormat(map[locale] || "en-GB").format(num);
  } catch {
    return String(num);
  }
}

export function slugify(input: string): string {
  const map: Record<string, string> = { ä: "a", ň: "n", ö: "o", ü: "u", ý: "y", ş: "s", ž: "z", ç: "c" };
  return input
    .toLowerCase()
    .replace(/[äňöüýşžç]/g, (c) => map[c] || c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function isExternal(url?: string): boolean {
  return !!url && /^(https?:)?\/\//i.test(url);
}

export function fileSize(bytes?: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
