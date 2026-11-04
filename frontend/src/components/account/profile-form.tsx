"use client";

import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api } from "@/lib/api";
import { errorMessage, useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/utils";
import type { Language, User } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120),
  phone: z.string().trim().max(40),
  avatar: z.string().trim().max(500),
  locale: z.string().min(1),
});
type Values = z.infer<typeof schema>;

export function ProfileForm({ languages }: { languages: Language[] }) {
  const t = useTranslations("account");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const { user, setUser, refresh } = useAuth();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? "", phone: user?.phone ?? "", avatar: user?.avatar ?? "", locale: user?.locale || "tk" },
  });
  const avatar = useWatch({ control: form.control, name: "avatar" });
  const name = useWatch({ control: form.control, name: "name" });

  async function onSubmit(v: Values) {
    try {
      const updated = await api.put<User>("/auth/me", { name: v.name, phone: v.phone, avatar: v.avatar, locale: v.locale });
      if (updated && typeof updated === "object" && "id" in updated) setUser(updated);
      else await refresh();
      form.reset(v);
      toast.success(t("profileUpdated"));
    } catch (e) {
      const { message, fields } = errorMessage(e, t("profileSaveError"));
      if (fields) for (const [k, m] of Object.entries(fields)) if (k in v) form.setError(k as keyof Values, { message: m });
      toast.error(message);
    }
  }

  const busy = form.formState.isSubmitting;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-20 border-2 border-accent/50" aria-label={t("avatarPreview")}>
            <AvatarImage src={avatar || undefined} alt="" />
            <AvatarFallback className="bg-primary text-xl text-primary-foreground">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{user?.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ta("name")}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" className="h-11" {...field} />
                </FormControl>
                <FormMessage>{form.formState.errors.name?.message && ta("nameRequired")}</FormMessage>
              </FormItem>
            )}
          />
          <div className="grid gap-2">
            <label htmlFor="profile-email" className="text-sm font-medium leading-none">
              {t("yourEmail")}
            </label>
            <Input id="profile-email" value={user?.email ?? ""} readOnly disabled className="h-11" aria-describedby="profile-email-help" />
            <p id="profile-email-help" className="text-xs text-muted-foreground">
              {t("emailReadOnly")}
            </p>
          </div>
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ta("phone")}</FormLabel>
                <FormControl>
                  <Input type="tel" autoComplete="tel" className="h-11" {...field} />
                </FormControl>
                <FormDescription>{t("phoneHelp")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("language")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {languages
                      .filter((l) => l.is_enabled)
                      .map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.native_name || l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="avatar"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t("avatarUrl")}</FormLabel>
                <FormControl>
                  <Input type="text" inputMode="url" placeholder="https://" className="h-11" {...field} />
                </FormControl>
                <FormDescription>{t("avatarHelp")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !form.formState.isDirty} className="h-11 w-full rounded-full px-6 sm:w-auto">
            {busy ? <Spinner size="sm" /> : <Save className="size-4" />}
            {busy ? tc("saving") : t("updateProfile")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
