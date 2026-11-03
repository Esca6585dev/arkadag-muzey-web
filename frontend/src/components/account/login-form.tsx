"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/account/password-input";
import { ApiRequestError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({ email: z.string().email("emailInvalid"), password: z.string().min(1, "passwordRequired"), remember: z.boolean() });
type Values = z.infer<typeof schema>;

/** Accept only same-site relative paths; strip a leading /{locale} for the locale-aware router. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  const stripped = raw.replace(/^\/(tk|ru|en)(?=\/|$|\?)/, "");
  if (stripped === "") return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });
  const msg = (m?: string) => (m ? t(m as "emailInvalid") : undefined);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const user = await login(values.email, values.password, values.remember);
      toast.success(t("welcome", { name: user.name }));
      const next = safeNext(params.get("next"));
      router.push(next ?? (user.role === "admin" || user.role === "editor" ? "/admin" : "/account"));
      router.refresh();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.status === 401) setFormError(t("invalid"));
        else if (e.fields && Object.keys(e.fields).length) {
          for (const [k, v] of Object.entries(e.fields)) if (k in values) form.setError(k as keyof Values, { message: v });
        } else setFormError(e.message || t("error"));
      } else setFormError(t("error"));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
        {formError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" className="h-11" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.email?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.password?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="remember" className="cursor-pointer font-normal">
                {t("remember")}
              </Label>
            </div>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="h-11 w-full rounded-full">
          {form.formState.isSubmitting ? <Spinner size="sm" /> : <LogIn className="size-4" />}
          {form.formState.isSubmitting ? t("loggingIn") : t("login")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("orRegister")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
