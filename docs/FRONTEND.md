# Frontend conventions (Next.js 16 + next-intl + Tailwind v4)

Location: `frontend/`. Read `node_modules/next/dist/docs/` for Next 16 specifics when unsure (e.g. `params` is a Promise, `proxy.ts` replaces middleware).

## Routing
* All routes live under `src/app/[locale]/` (`tk` default, `ru`, `en`; prefix always present).
* Public site pages: `src/app/[locale]/(site)/...` — they get the site header/footer from `(site)/layout.tsx`.
* Auth pages: `src/app/[locale]/(auth)/login`, `register` (own minimal layout).
* User area: `src/app/[locale]/account/...` (own layout with sidebar). Admin: `src/app/[locale]/admin/...`.
* Every page: `type Props = { params: Promise<{ locale: string; slug?: string }>; searchParams: Promise<Record<string, string | undefined>> }`, call `setRequestLocale(locale)` first, export `generateMetadata` using `buildMetadata(locale, {title, description, image, path})` from `@/lib/site`.
* Links: ALWAYS `import { Link, useRouter, usePathname, redirect } from "@/i18n/navigation"` (locale-aware). Hrefs are locale-less (`/news/slug`).

## Data
* `@/lib/api`: `api.get<T>(path, {params, revalidate, tags, locale})` returns `data`; `api.list<T>()` returns `{data, meta}`; `api.safeGet/safeList` never throw (use in server components for optional data); `api.post/put/del`. Paths are relative to `/api/v1` (e.g. `/public/articles`). Errors throw `ApiRequestError {status, code, message, fields}`.
* Server components fetch with `revalidate: 60`. Client components use `@tanstack/react-query` (`useQuery`, `useMutation`) with `api.*`.
* The API contract is `docs/API.md`; TS types are in `@/lib/types` (Article, Hall, Exhibit, Gallery, Event, User, Favorite, ...).
* Translatable fields (`{tk,ru,en}`) are rendered with `t(value, locale)` from `@/lib/utils` (falls back to tk). Other helpers there: `cn`, `excerpt`, `stripHtml`, `formatDate(value, locale, opts?)`, `formatNumber`, `initials`, `isExternal`, `fileSize`.
* Site settings/menus: `getBootstrap(locale)`, `settingText(settings, key, locale)`, `settingBool(...)` from `@/lib/site`. Current user on the server: `getCurrentUser()`; on the client: `useAuth()` from `@/hooks/use-auth` (`user, loading, isAdmin, isEditor, login, register, logout, refresh, setUser`) and `errorMessage(e)`.

## i18n
* UI strings: `src/messages/{tk,ru,en}.json`. Server: `const t = await getTranslations("news")`; client: `useTranslations("news")`. When you add keys, add them to ALL THREE files (tk = Turkmen Latin with ä ň ö ü ý ş ž ç, ru, en) and keep the structure identical.

## UI kit
* shadcn-style components in `@/components/ui/*` (button, input, textarea, label, card, badge, dialog, alert-dialog, dropdown-menu, tabs, select, switch, checkbox, popover, tooltip, avatar, separator, scroll-area, sheet, skeleton, table, sonner(`toast` from "sonner"), command, accordion, breadcrumb, pagination, progress, form (react-hook-form), alert, empty-state, spinner).
* Shared: `@/components/shared/smart-image` (`<SmartImage src alt fill className wrapperClassName sizes/>` with placeholder fallback; `/uploads/...` URLs work as-is), `section-heading` (`<SectionHeading eyebrow title description action actionHref align/>`), `theme-toggle`, `language-switcher`, `brand-icons`.
* Site: `@/components/site/cards` (`ArticleCard` variants default|horizontal|featured, `HallCard`, `ExhibitCard`, `EventCard`, `GalleryCard`), `contact-form`, `newsletter-form`, `dynamic-page`.
* Blocks: `@/components/blocks/content-blocks` exports `PageHeaderBlock({s:{title, subtitle, image}, locale})` — use it as the top banner of list pages (title/subtitle as plain strings are fine: pass `{ title: {[locale]: "..."} }` or strings via the `fallbackTitle` prop).
* Icons: `lucide-react` (no brand icons there — use `brand-icons`).

## Design language
* Museum look: emerald primary (`bg-primary`, `text-primary`, `bg-primary-soft`), antique gold accent (`text-accent`, `bg-accent`), warm neutrals. Dark mode via `.dark` — only use theme tokens (`bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`), never hard-coded grays.
* Custom utilities: `container-x` (page container), `section` (vertical rhythm), `eyebrow` (small gold label), `heading-xl|lg|md` (serif display headings), `card-hover`, `bg-ornament`, `prose-museum` (for HTML bodies from the API — render with `dangerouslySetInnerHTML`).
* Cards: `rounded-2xl border border-border/70 bg-card`, generous spacing, subtle hover lift. Buttons: `rounded-full`.
* Must look great at 390px wide and in both themes. Empty states use `<EmptyState icon title description/>` from `@/components/ui/empty-state`. Loading UI: `loading.tsx` with `<Skeleton/>` grids.

## Checks
`npx tsc --noEmit -p tsconfig.json` and `npx eslint <your paths>` must be clean. Dev server: `http://localhost:3000` (API on `http://localhost:8085`, admin `admin@arkadagshahermuzey.gov.tm` / `Admin12345!`). `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/tk/<route>` should be 200 for every page you add. Do not run git, do not restart or kill servers you did not start, do not edit files outside your scope (report needed changes instead).
