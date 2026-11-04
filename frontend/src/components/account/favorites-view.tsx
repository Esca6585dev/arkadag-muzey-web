"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FavoriteCard } from "@/components/account/favorite-card";
import { api } from "@/lib/api";
import type { Favorite, FavoriteType } from "@/lib/types";

type Tab = "all" | FavoriteType;

export function FavoritesView() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: tc("all") },
    { value: "article", label: t("tabNews") },
    { value: "exhibit", label: t("tabExhibits") },
    { value: "hall", label: t("tabHalls") },
    { value: "event", label: t("tabEvents") },
  ];

  const q = useQuery({
    queryKey: ["user", "favorites", tab],
    queryFn: () => api.get<Favorite[]>("/user/favorites", { params: tab === "all" ? undefined : { type: tab } }),
  });

  const remove = useMutation({
    mutationFn: (f: Favorite) => api.del(`/user/favorites/${f.target_type}/${f.target_id}`),
    onMutate: async (f) => {
      await qc.cancelQueries({ queryKey: ["user", "favorites"] });
      const snapshots = qc.getQueriesData<Favorite[]>({ queryKey: ["user", "favorites"] });
      qc.setQueriesData<Favorite[]>({ queryKey: ["user", "favorites"] }, (old) => old?.filter((x) => x.id !== f.id));
      return { snapshots };
    },
    onError: (_e, _f, ctx) => {
      ctx?.snapshots.forEach(([k, v]) => qc.setQueryData(k, v));
      toast.error(tc("error"));
    },
    onSuccess: () => toast.success(t("favoriteRemoved")),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["user", "favorites"] });
      void qc.invalidateQueries({ queryKey: ["user", "dashboard"] });
    },
  });

  const items = (q.data ?? []).filter((f) => f.target);

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto">
            {tabs.map((x) => (
              <TabsTrigger key={x.value} value={x.value} className="rounded-full px-4 py-2">
                {x.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <EmptyState
          title={t("loadError")}
          action={
            <Button variant="outline" className="rounded-full" onClick={() => void q.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title={t("noFavorites")}
          description={t("noFavoritesText")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-full">
                <Link href="/exhibits">{t("browseExhibits")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/halls">{t("browseHalls")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/news">{t("browseNews")}</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((f) => (
            <FavoriteCard key={f.id} favorite={f} locale={locale} onRemove={() => remove.mutate(f)} removing={remove.isPending && remove.variables?.id === f.id} />
          ))}
        </div>
      )}
    </div>
  );
}
