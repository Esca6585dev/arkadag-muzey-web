import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { getBootstrap } from "@/lib/site";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

/**
 * Applies text overrides edited in the admin (Translations, keys like "nav.home") on top of the
 * bundled messages. Only existing string keys are replaced, so a typo cannot break the UI.
 */
function withOverrides(base: Messages, overrides: Record<string, string>): Messages {
  const entries = Object.entries(overrides ?? {}).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  if (!entries.length) return base;
  const messages = structuredClone(base);
  for (const [key, value] of entries) {
    const parts = key.split(".");
    const last = parts.pop()!;
    let node: unknown = messages;
    for (const p of parts) node = node && typeof node === "object" ? (node as Messages)[p] : undefined;
    if (node && typeof node === "object" && typeof (node as Messages)[last] === "string") {
      (node as Messages)[last] = value;
    }
  }
  return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const base = (await import(`../messages/${locale}.json`)).default as Messages;
  const boot = await getBootstrap(locale);

  return {
    locale,
    messages: withOverrides(base, boot.translations),
    timeZone: "Asia/Ashgabat",
  };
});
