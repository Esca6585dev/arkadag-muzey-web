"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FavoriteType } from "@/lib/types";

export function FavoriteButton({ type, id, variant = "icon", className }: { type: FavoriteType; id: number; variant?: "icon" | "button"; className?: string }) {
  const t = useTranslations("account");
  const tn = useTranslations("nav");
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["favorite", type, id, user?.id ?? 0];

  const { data: active = false } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const r = await api.get<{ ids: number[] }>("/user/favorites/check", { params: { type, ids: String(id) } });
      return (r?.ids ?? []).includes(id);
    },
  });

  const toggle = useMutation({
    mutationFn: () => api.post<{ favorited: boolean }>("/user/favorites", { target_type: type, target_id: id }),
    onSuccess: (r) => {
      qc.setQueryData(key, !!r?.favorited);
      toast.success(r?.favorited ? t("favoriteAdded") : t("favoriteRemoved"));
    },
    onError: () => toast.error(t("loginToFavorite")),
  });

  const onClick = () => {
    if (!user) {
      toast(t("loginToFavorite"), { action: { label: tn("login"), onClick: () => router.push("/login") } });
      return;
    }
    toggle.mutate();
  };

  const label = active ? t("removeFavorite") : t("addFavorite");
  const heart = <Heart className={cn("size-4", active && "fill-current text-destructive")} />;

  if (variant === "button") {
    return (
      <Button type="button" variant="outline" onClick={onClick} disabled={toggle.isPending} aria-pressed={active} className={cn("rounded-full", className)}>
        {heart}
        {label}
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" size="icon" onClick={onClick} disabled={toggle.isPending} aria-pressed={active} aria-label={label} title={label} className={cn("rounded-full", className)}>
      {heart}
    </Button>
  );
}
