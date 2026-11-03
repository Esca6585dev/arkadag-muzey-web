"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

const FALLBACK: Pick<Language, "code" | "name" | "native_name" | "flag">[] = [
  { code: "tk", name: "Turkmen", native_name: "Türkmençe", flag: "🇹🇲" },
  { code: "ru", name: "Russian", native_name: "Русский", flag: "🇷🇺" },
  { code: "en", name: "English", native_name: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher({
  languages,
  className,
  variant = "ghost",
  compact = false,
}: {
  languages?: Language[];
  className?: string;
  variant?: "ghost" | "outline";
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const list = (languages && languages.length ? languages : FALLBACK).filter((l) => (routing.locales as readonly string[]).includes(l.code));
  const current = list.find((l) => l.code === locale) ?? list[0];

  function switchTo(code: string) {
    // Keep the same route and dynamic params, only change the locale segment.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace({ pathname, params: params as any } as any, { locale: code as (typeof routing.locales)[number] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={compact ? "icon" : "sm"} className={cn("rounded-full gap-2", className)} aria-label={t("language")}>
          <Globe className="size-[1.1rem]" />
          {!compact && <span className="text-xs font-semibold uppercase tracking-wider">{current?.code}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {list.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => switchTo(l.code)} className="justify-between">
            <span className="flex items-center gap-2">
              <span aria-hidden>{l.flag}</span>
              {l.native_name || l.name}
            </span>
            {l.code === locale && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
