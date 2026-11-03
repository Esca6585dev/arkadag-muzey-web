# Arkadag Museum API contract (v1)

Base URL: `/api/v1`. JSON everywhere. All list endpoints return `{ "data": [...], "meta": {page, limit, total, pages} }`,
single resources return `{ "data": {...} }`, errors return `{ "error": {code, message, fields?} }`
(`fields` is `{field: message}` on 422 `validation_error`).

## Conventions

* **Translatable** fields are JSON objects keyed by language code: `{"tk": "...", "ru": "...", "en": "..."}`.
  Public endpoints return the whole object; the client picks the locale and falls back to the default language (`tk`).
* **Locale** for public endpoints: `?locale=tk|ru|en` (also `X-Locale` header). Lists of articles only return
  rows that have a title in that locale.
* **Pagination / sorting / search** on every list: `?page=1&limit=20&sort=-created_at&search=text`.
  `sort` is a whitelisted column, prefix `-` for DESC. Search runs `LIKE` across title/name/slug columns.
* **Auth**: `POST /auth/login` sets httpOnly cookies `access_token` (1h) and `refresh_token` (30d) and also returns
  them in the body. Send either the cookie or `Authorization: Bearer <access_token>`.
  `POST /auth/refresh` rotates tokens (cookie or body `{refresh_token}`).
* **Roles**: `admin` (everything), `editor` (content: everything under `/admin` except users, settings write,
  languages, activity logs), `user` (account area only).
* **Standard admin CRUD** (`/admin/<resource>`): `GET /` (list), `GET /:id`, `POST /`, `PUT /:id` (partial overlay:
  absent fields are kept), `PATCH /:id` (same as PUT), `DELETE /:id`, `POST /reorder {ids:[...]}` (sets sort_order by
  position), `POST /bulk-delete {ids:[...]}`.
* **Images** are stored as URL paths (`/uploads/...`); upload via `/admin/media/upload` first, then save the URL on the entity.
* Timestamps are RFC3339 UTC.

## Public (`/public`, no auth; user is attached when a cookie is present)

| Method | Path | Notes |
|---|---|---|
| GET | `/bootstrap?locale=` | `{settings:{key:value} (public only), languages:[...enabled], menus:{header:[tree], footer:[tree]}, translations:{key:string for locale}}` – menu tree items: `{id,title,type,url,target,icon,children:[]}` |
| GET | `/pages/:slug` | published page: `{id,slug,title,excerpt,blocks:[{id,type,settings}],cover_image,template,meta_title,meta_description}` |
| GET | `/slides?position=home` | active slides ordered by sort_order |
| GET | `/categories` | active, with `article_count` |
| GET | `/articles?category=slug&tag=slug&featured=true&search=&page&limit&sort` | published, locale-filtered, `body` omitted |
| GET | `/articles/:slug` | `{article, related:[...4]}`, increments views |
| GET | `/halls` | active halls ordered by sort_order, each with `exhibit_count` |
| GET | `/halls/:slug` | hall with `exhibits` (published, ordered) |
| GET | `/exhibits?hall=slug&featured=true&search=&page&limit` | published |
| GET | `/exhibits/:slug` | `{exhibit (with hall), related:[...6 same hall]}`, increments views |
| GET | `/galleries` | active, with `item_count` |
| GET | `/galleries/:slug` | gallery with `items` ordered |
| GET | `/events?upcoming=true` or `?past=true` + pagination | published; upcoming = `ends_at >= now OR starts_at >= now`; default sort `starts_at` asc for upcoming, desc for past |
| GET | `/events/:slug` | event |
| GET | `/search?q=&locale=` | `{articles:[5], exhibits:[5], halls:[5], events:[5], pages:[5], total:n}` (min 2 chars) |
| GET | `/stats` | `{exhibits, halls, articles, events, galleries}` published counts |
| POST | `/contact` | `{name,email,phone?,subject?,message}` → 201; rate limited 5/10min per IP; stores `locale`, `ip`, `user_id` if logged in |
| POST | `/subscribe` | `{email,name?,locale?}` → 201 `{message}`; idempotent; confirmed immediately (no SMTP) |
| GET | `/unsubscribe?token=` | sets unsubscribed_at |

## Auth (`/auth`)

`POST /register {name,email,password,phone?,locale?}` (blocked when setting `features.registration` is false) ·
`POST /login {email,password}` · `POST /refresh` · `POST /logout` · `GET /me` · `PUT /me {name?,phone?,avatar?,locale?}` ·
`PUT /me/password {current_password,new_password}` · `GET /sessions` · `DELETE /sessions/:id`.
Login/register/refresh respond `{data:{user, access_token, refresh_token, expires_in}}`.

## User (`/user`, any authenticated user)

| Method | Path | Notes |
|---|---|---|
| GET | `/favorites?type=article|exhibit|event|hall` | each favorite includes `target` (the loaded entity, body omitted) |
| POST | `/favorites` | `{target_type,target_id}` toggles → `{favorited: bool}` |
| DELETE | `/favorites/:type/:id` | remove |
| GET | `/favorites/check?type=&ids=1,2,3` | `{ids:[favorited ids]}` |
| GET | `/messages` | the user's own contact messages (by user_id or email) |
| GET | `/dashboard` | `{favorites, messages, member_since}` |

## Admin (`/admin`, roles admin+editor unless stated)

### Dashboard
`GET /dashboard` →
```json
{"counts":{"articles":0,"published_articles":0,"exhibits":0,"halls":0,"galleries":0,"events":0,"users":0,"messages_new":0,"subscribers":0,"media":0},
 "views":{"articles":0,"exhibits":0},
 "charts":{"articles_by_month":[{"month":"2026-01","count":3}], "top_articles":[{"id":1,"title":{},"views":10}], "messages_by_month":[{"month":"2026-01","count":2}]},
 "recent":{"articles":[5],"messages":[5],"logs":[10 with user]}}
```
(last 12 months for charts)

### Standard CRUD resources
`articles` (filters: status, category_id, featured) · `categories` (filter: parent_id; default sort sort_order; include `article_count` in list) ·
`tags` · `pages` (filters: status; system pages cannot be deleted; slug auto from title) · `halls` (default sort sort_order; include `exhibit_count`) ·
`exhibits` (filters: hall_id, status, featured; preload Hall) · `galleries` (GET /:id includes items) · `events` (filters: status, upcoming/past) ·
`slides` (filter: position; default sort sort_order) · `menus` · `languages` (admin only) · `translations` (filter: group) ·
`messages` (no POST; filters: status) · `subscribers` (no POST/PUT; filters: confirmed) · `media` (no POST – use upload) · `users` (admin only).

Slug rule for all slugged entities: if `slug` is empty it is generated from the default-language title/name; slugs are made unique.

### Extra endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/galleries/:id/items` | `{image, caption?}` |
| POST | `/galleries/:id/items/bulk` | `{images:["/uploads/..",...]}` appends many |
| PUT | `/galleries/:id/items/:itemId` | `{image?, caption?, sort_order?}` |
| DELETE | `/galleries/:id/items/:itemId` | |
| POST | `/galleries/:id/items/reorder` | `{ids:[]}` |
| GET | `/menus/:id` | menu with `items` as a tree |
| POST | `/menus/:id/items` | `{title,type,url,target,icon,parent_id?,is_active}` |
| PUT | `/menus/:id/items/:itemId` | partial |
| DELETE | `/menus/:id/items/:itemId` | deletes children too |
| PUT | `/menus/:id/tree` | `{items:[{id,children:[{id,children:[]}]}]}` rewrites parent_id + sort_order |
| GET | `/settings` | `{data:[{group, settings:[Setting...]}]}` grouped, ordered by sort_order |
| PUT | `/settings` | admin only; `{values:{"site.name":{...},"contact.phone":"..."}}` bulk update of `value` only → returns updated list |
| POST | `/settings` | admin only; create a custom setting `{key,group,type,label,value,is_public}` |
| DELETE | `/settings/:id` | admin only |
| PUT | `/languages/:id/default` | admin only; makes it the only default |
| GET | `/translations/export?locale=` | flat `{key: value}` |
| POST | `/translations/import` | `{entries:{key:{tk,ru,en}}}` upsert |
| GET | `/media?folder=&search=&page&limit&sort` | list |
| POST | `/media/upload` | multipart: `files` (one or many) or `file`, optional `folder`; → `{data:[Media]}` (201) |
| PUT | `/media/:id` | `{alt?, folder?}` |
| DELETE | `/media/:id` | removes the file + thumb |
| GET | `/media/folders` | `[{folder, count}]` |
| GET | `/messages/:id` | marks status `read` when it was `new` |
| PUT | `/messages/:id` | `{status?, reply?}` |
| GET | `/messages/unread-count` | `{count}` |
| GET | `/subscribers/export.csv` | CSV download |
| POST | `/users` | admin only; `{name,email,password,role,status,phone}` |
| PUT | `/users/:id` | admin only; `{name?,email?,role?,status?,password?,phone?}`; cannot demote/block yourself |
| DELETE | `/users/:id` | admin only; cannot delete yourself |
| GET | `/activity-logs?entity=&action=&user_id=&page` | admin only; preload user |

## Block types for pages (rendered by the frontend)

`hero` (source: slides|custom, title, subtitle, image, button_text/url) · `page_header` (image, title, subtitle) ·
`about_intro` (label, title, text(html), images[], button_text/url, show_stats) · `rich_text` (content html) ·
`image_text` (label, title, text, image, image2, image_position) · `stats` (source: settings|custom, items[{value,suffix,label}]) ·
`features` (title, items[{icon,title,text}]) · `halls_grid` (label,title,limit,button_text/url) ·
`exhibits_featured` (label,title,limit,button_text/url) · `latest_news` (label,title,limit,category,button_text/url) ·
`events_upcoming` (label,title,limit,button_url) · `gallery_strip` (title,gallery_slug,limit,button_url) ·
`gallery` (gallery_slug or images[]) · `visit_cta` (label,title,text,show_map,button_text/url) · `visit_info` (source settings) ·
`contact` (show_form, show_map, show_info) · `faq` (title, items[{question,answer}]) · `cta` (title,text,button_text/url,image) ·
`video` (url,title) · `spacer` (size) · `timeline` (title, items[{year,title,text}]).
All textual settings are Translatable objects; `button_url` etc. are plain strings.
