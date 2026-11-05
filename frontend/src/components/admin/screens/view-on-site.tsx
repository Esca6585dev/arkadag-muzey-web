"use client";
// Row action that opens a public URL in a new tab.

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ViewOnSite({ href }: { href: string }) {
  const t = useTranslations("admin");
  return (
    <DropdownMenuItem asChild>
      <Link href={href} target="_blank">
        <ExternalLink className="size-4" /> {t("viewSite")}
      </Link>
    </DropdownMenuItem>
  );
}
