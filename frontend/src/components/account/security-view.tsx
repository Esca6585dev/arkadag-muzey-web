"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/account/password-input";
import { api } from "@/lib/api";
import { errorMessage, useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";

interface Session {
  id: number;
  user_agent: string;
  ip: string;
  expires_at: string;
  created_at: string;
}

const schema = z
  .object({
    current_password: z.string().min(1, "passwordRequired"),
    new_password: z.string().min(8, "passwordMin"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "passwordMismatch" });
type Values = z.infer<typeof schema>;

function describeAgent(ua: string, fallback: string) {
  if (!ua) return { label: fallback, mobile: false };
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const label = [br, os].filter(Boolean).join(" · ") || ua.slice(0, 60);
  return { label, mobile: /Mobile|Android|iPhone/i.test(ua) };
}

export function SecurityView() {
  const t = useTranslations("account");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const { logout } = useAuth();
  const [revoking, setRevoking] = useState<Session | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current_password: "", new_password: "", confirm: "" } });
  const msg = (m?: string) => (m ? ta(m as "passwordMin") : undefined);

  async function onSubmit(v: Values) {
    try {
      await api.put("/auth/me/password", { current_password: v.current_password, new_password: v.new_password });
      toast.success(t("passwordChanged"));
      form.reset();
    } catch (e) {
      const { message, fields } = errorMessage(e, t("tryAgain"));
      if (fields) for (const [k, m] of Object.entries(fields)) if (k in v) form.setError(k as keyof Values, { message: m });
      toast.error(message);
    }
  }

  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: () => api.get<Session[]>("/auth/sessions") });
  const list = [...(sessions.data ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  // The refresh token is HttpOnly and the API does not flag the current session: the newest one is the best guess.
  const currentId = list[0]?.id;

  const revoke = useMutation({
    mutationFn: (s: Session) => api.del(`/auth/sessions/${s.id}`),
    onSuccess: () => {
      toast.success(t("sessionRevoked"));
      void qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (e) => toast.error(errorMessage(e, t("tryAgain")).message),
    onSettled: () => setRevoking(null),
  });

  async function signOut() {
    setSigningOut(true);
    await logout();
    toast.success(ta("logoutSuccess"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-8" aria-labelledby="pw-title">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 id="pw-title" className="font-display text-xl font-semibold">
              {t("passwordSection")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("passwordSectionHelp")}</p>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-6 grid max-w-xl gap-5">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("currentPassword")}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage>{msg(form.formState.errors.current_password?.message)}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("newPassword")}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{t("passwordHelp")}</p>
                  <FormMessage>{msg(form.formState.errors.new_password?.message)}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("confirmPassword")}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage>{msg(form.formState.errors.confirm?.message)}</FormMessage>
                </FormItem>
              )}
            />
            <div>
              <Button type="submit" disabled={form.formState.isSubmitting} className="h-11 w-full rounded-full px-6 sm:w-auto">
                {form.formState.isSubmitting ? <Spinner size="sm" /> : <ShieldCheck className="size-4" />}
                {form.formState.isSubmitting ? tc("saving") : t("changePassword")}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-8" aria-labelledby="sess-title">
        <h2 id="sess-title" className="font-display text-xl font-semibold">
          {t("sessions")}
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">{t("sessionsHelp")}</p>
        {sessions.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : sessions.isError ? (
          <EmptyState
            title={t("loadError")}
            action={
              <Button variant="outline" className="rounded-full" onClick={() => void sessions.refetch()}>
                {tc("retry")}
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState icon={<Monitor />} title={t("noSessions")} />
        ) : (
          <ul className="space-y-3">
            {list.map((s) => {
              const d = describeAgent(s.user_agent, t("unknownDevice"));
              const Icon = d.mobile ? Smartphone : Monitor;
              const current = s.id === currentId;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 p-4 sm:flex-nowrap">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="break-all">{d.label}</span>
                      {current && <Badge className="bg-primary text-primary-foreground">{t("currentSession")}</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.ip && <>{s.ip} · </>}
                      {t("signedInOn", { date: formatDate(s.created_at, locale) })} · {t("expiresOn", { date: formatDate(s.expires_at, locale) })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full" disabled={revoke.isPending && revoke.variables?.id === s.id} onClick={() => setRevoking(s)}>
                    {t("revokeSession")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-8">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("signOut")}</h2>
          <p className="text-sm text-muted-foreground">{t("signOutHelp")}</p>
        </div>
        <Button variant="outline" className="h-11 w-full rounded-full sm:w-auto" disabled={signingOut} onClick={signOut}>
          {signingOut ? <Spinner size="sm" /> : <LogOut className="size-4" />}
          {t("signOutNow")}
        </Button>
      </section>

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && !revoke.isPending && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (revoking) revoke.mutate(revoking);
              }}
            >
              {revoke.isPending ? t("revoking") : t("revokeSession")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
