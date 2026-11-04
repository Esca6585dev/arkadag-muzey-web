import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { getBootstrap, getCurrentUser, settingText } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return {
    title: { template: `%s · ${t("title")}`, default: t("title") },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login?next=/admin", locale });

  if (user!.role !== "admin" && user!.role !== "editor") {
    const t = await getTranslations("admin");
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold">{t("errors.forbidden")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("shell.forbiddenText")}</p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/">{t("shell.backHome")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const boot = await getBootstrap(locale);
  const s = boot.settings;
  const siteName = settingText(s, "site.short_name", locale, settingText(s, "site.name", locale, "Arkadag Museum"));
  return (
    <AdminShell languages={boot.languages} siteName={siteName} logo={settingText(s, "site.logo", locale, "/logo.png")}>
      {children}
    </AdminShell>
  );
}
