"use client";
// Row action for the languages list: PUT /admin/languages/:id/default.

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { resourceKeys } from "../use-resource";

export function MakeDefaultLanguage({ id }: { id: number }) {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  return (
    <DropdownMenuItem
      onClick={async () => {
        try {
          await api.put(`/admin/languages/${id}/default`);
          toast.success(t("form.saved"));
          qc.invalidateQueries({ queryKey: resourceKeys.all("languages") });
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <Star className="size-4" /> {t("form.default")}
    </DropdownMenuItem>
  );
}
