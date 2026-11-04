"use client";
// Admin home: counters, monthly charts, most read articles, recent content/messages/activity.

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BookOpen,
  CalendarDays,
  Eye,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Inbox,
  Landmark,
  Mail,
  Plus,
  Settings,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/admin-types";
import { formatDate, formatNumber, t as tr } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

function monthLabel(month: string, locale: string) {
  const d = new Date(`${month}-01T00:00:00`);
  try {
    return d.toLocaleDateString(locale, { month: "short" });
  } catch {
    return month.slice(5);
  }
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, sub, href }: { icon: LucideIcon; label: string; value: number; sub?: string; href?: string }) {
  const locale = useLocale();
  const body = (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatNumber(value, locale)}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" };

export function AdminDashboard() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => api.get<DashboardData>("/admin/dashboard") });
  const d = q.data;

  const header = (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t("welcome", { name: user?.name ?? "" })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dash.subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-full">
          <Link href="/admin/articles/new">
            <Plus className="size-4" /> {t("dash.newArticle")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/admin/media">
            <Upload className="size-4" /> {t("dash.uploadMedia")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/admin/events/new">
            <CalendarDays className="size-4" /> {t("dash.newEvent")}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/admin/settings">
            <Settings className="size-4" /> {t("dash.openSettings")}
          </Link>
        </Button>
      </div>
    </div>
  );

  if (q.isLoading || !d) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 rounded-2xl" />
        {q.isError && <p className="mt-4 text-sm text-destructive">{t("errors.loadFailed")}</p>}
      </>
    );
  }

  const c = d.counts;
  const articlesChart = d.charts.articles_by_month.map((p) => ({ name: monthLabel(p.month, locale), count: p.count }));
  const messagesChart = d.charts.messages_by_month.map((p) => ({ name: monthLabel(p.month, locale), count: p.count }));

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={BookOpen} label={t("stats.articles")} value={c.articles ?? 0} sub={`${t("stats.published")}: ${formatNumber(c.published_articles ?? 0, locale)}`} href="/admin/articles" />
        <Stat icon={Sparkles} label={t("stats.exhibits")} value={c.exhibits ?? 0} href="/admin/exhibits" />
        <Stat icon={Landmark} label={t("stats.halls")} value={c.halls ?? 0} href="/admin/halls" />
        <Stat icon={Inbox} label={t("stats.newMessages")} value={c.messages_new ?? 0} href="/admin/messages?status=new" />
        <Stat icon={CalendarDays} label={t("stats.events")} value={c.events ?? 0} href="/admin/events" />
        <Stat icon={GalleryHorizontalEnd} label={t("stats.galleries")} value={c.galleries ?? 0} href="/admin/galleries" />
        <Stat icon={Mail} label={t("stats.subscribers")} value={c.subscribers ?? 0} href="/admin/subscribers" />
        <Stat icon={Users} label={t("stats.users")} value={c.users ?? 0} href="/admin/users" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={t("charts.articlesByMonth")} className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={articlesChart} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="artFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" name={t("stats.articles")} stroke="var(--primary)" strokeWidth={2} fill="url(#artFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("charts.topArticles")}>
          <ol className="space-y-3">
            {d.charts.top_articles.slice(0, 6).map((a, i) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                <Link href={`/admin/articles/${a.id}`} className="line-clamp-2 flex-1 text-sm hover:text-primary">
                  {tr(a.title, locale)}
                </Link>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Eye className="size-3.5" /> {formatNumber(a.views, locale)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title={t("recent.articles")}
          action={
            <Link href="/admin/articles" className="text-xs font-medium text-primary hover:underline">
              {t("dash.viewAll")}
            </Link>
          }
        >
          <ul className="divide-y divide-border/70">
            {d.recent.articles.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/articles/${a.id}`} className="line-clamp-1 text-sm hover:text-primary">
                  {tr(a.title, locale) || `#${a.id}`}
                </Link>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title={t("recent.messages")}
          action={
            <Link href="/admin/messages" className="text-xs font-medium text-primary hover:underline">
              {t("dash.viewAll")}
            </Link>
          }
        >
          <ul className="divide-y divide-border/70">
            {d.recent.messages.map((m) => (
              <li key={m.id} className="py-2.5">
                <Link href={`/admin/messages/${m.id}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className={`block truncate text-sm ${m.status === "new" ? "font-semibold" : ""}`}>{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.subject || m.message}</span>
                  </span>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
            {!d.recent.messages.length && <li className="py-6 text-center text-sm text-muted-foreground">{t("table.noData")}</li>}
          </ul>
          <div className="mt-4 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={messagesChart} margin={{ left: -28, right: 0, top: 4 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" name={t("charts.messagesByMonth")} fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("recent.activity")}>
          <ul className="space-y-3">
            {d.recent.logs.map((l) => (
              <li key={l.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/70" />
                <span className="min-w-0">
                  <span className="font-medium">{l.user?.name ?? "—"}</span>{" "}
                  <span className="text-muted-foreground">
                    {t.has(`logs.${l.action}`) ? t(`logs.${l.action}`) : l.action} · {l.entity}
                    {l.entity_id ? ` #${l.entity_id}` : ""}
                  </span>
                  <span className="block text-xs text-muted-foreground/80">{formatDate(l.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
              </li>
            ))}
            {!d.recent.logs.length && <li className="py-6 text-center text-sm text-muted-foreground">{t("dash.noActivity")}</li>}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Eye} label={t("stats.articleViews")} value={d.views.articles ?? 0} />
        <Stat icon={Eye} label={t("stats.exhibitViews")} value={d.views.exhibits ?? 0} />
        <Stat icon={ImageIcon} label={t("stats.media")} value={c.media ?? 0} href="/admin/media" />
      </div>
    </>
  );
}
