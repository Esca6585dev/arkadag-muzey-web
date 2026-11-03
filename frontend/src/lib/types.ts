/* Types mirroring the Go backend models (docs/API.md). */

export type Translatable = Record<string, string>;

export interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: Meta;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type Role = "admin" | "editor" | "user";
export type Status = "draft" | "published" | "archived";

export interface User extends Timestamps {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  phone: string;
  locale: string;
  status: "active" | "blocked" | "inactive" | "banned";
  last_login_at: string | null;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Language extends Timestamps {
  id: number;
  code: string;
  name: string;
  native_name: string;
  flag: string;
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
}

export type SettingType =
  | "text"
  | "textarea"
  | "richtext"
  | "translatable"
  | "translatable_textarea"
  | "image"
  | "bool"
  | "number"
  | "color"
  | "json"
  | "select";

export interface Setting extends Timestamps {
  id: number;
  key: string;
  value: unknown;
  group: string;
  type: SettingType;
  label: string;
  options: { value: string; label: string }[] | null;
  is_public: boolean;
  sort_order: number;
}

export interface SettingGroup {
  group: string;
  settings: Setting[];
}

export interface Translation extends Timestamps {
  id: number;
  key: string;
  values: Translatable;
  group: string;
}

export interface MenuItem extends Timestamps {
  id: number;
  menu_id: number;
  parent_id: number | null;
  title: Translatable;
  type: "link" | "external" | "page";
  url: string;
  target: "_self" | "_blank";
  icon: string;
  sort_order: number;
  is_active: boolean;
  children?: MenuItem[];
}

export interface Menu extends Timestamps {
  id: number;
  slug: string;
  name: string;
  items?: MenuItem[];
}

export interface Block<S = Record<string, unknown>> {
  id: string;
  type: string;
  settings: S;
}

export interface Page extends Timestamps {
  id: number;
  slug: string;
  title: Translatable;
  excerpt: Translatable;
  blocks: Block[];
  cover_image: string;
  template: string;
  status: Status;
  is_system: boolean;
  meta_title: Translatable;
  meta_description: Translatable;
  created_by: number | null;
}

export interface Category extends Timestamps {
  id: number;
  slug: string;
  name: Translatable;
  description: Translatable;
  image: string;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  article_count?: number;
}

export interface Tag extends Timestamps {
  id: number;
  slug: string;
  name: Translatable;
}

export interface Article extends Timestamps {
  id: number;
  slug: string;
  title: Translatable;
  excerpt: Translatable;
  body: Translatable | null;
  cover_image: string;
  images: string[];
  category_id: number | null;
  category?: Category | null;
  author_id: number | null;
  author?: Pick<User, "id" | "name" | "avatar"> | null;
  tags?: Tag[];
  status: Status;
  is_featured: boolean;
  published_at: string | null;
  views: number;
  meta_title: Translatable;
  meta_description: Translatable;
  legacy_id?: number | null;
}

export interface Hall extends Timestamps {
  id: number;
  slug: string;
  name: Translatable;
  summary: Translatable;
  description: Translatable;
  cover_image: string;
  images: string[];
  icon: string;
  floor: string;
  sort_order: number;
  is_active: boolean;
  exhibits?: Exhibit[];
  exhibit_count?: number;
}

export interface Exhibit extends Timestamps {
  id: number;
  slug: string;
  title: Translatable;
  summary: Translatable;
  description: Translatable;
  image: string;
  images: string[];
  hall_id: number | null;
  hall?: Hall | null;
  period: Translatable;
  material: Translatable;
  origin: Translatable;
  inventory_no: string;
  is_featured: boolean;
  sort_order: number;
  status: Status;
  views: number;
}

export interface GalleryItem extends Timestamps {
  id: number;
  gallery_id: number;
  image: string;
  caption: Translatable;
  sort_order: number;
}

export interface Gallery extends Timestamps {
  id: number;
  slug: string;
  title: Translatable;
  description: Translatable;
  cover_image: string;
  items?: GalleryItem[];
  sort_order: number;
  is_active: boolean;
  item_count?: number;
}

export interface Event extends Timestamps {
  id: number;
  slug: string;
  title: Translatable;
  summary: Translatable;
  description: Translatable;
  image: string;
  location: Translatable;
  starts_at: string;
  ends_at: string | null;
  status: Status;
  is_featured: boolean;
  price: Translatable;
}

export interface Slide extends Timestamps {
  id: number;
  title: Translatable;
  subtitle: Translatable;
  image: string;
  mobile_image: string;
  button_text: Translatable;
  button_url: string;
  button2_text: Translatable;
  button2_url: string;
  position: string;
  sort_order: number;
  is_active: boolean;
}

export interface Media extends Timestamps {
  id: number;
  file_name: string;
  original_name: string;
  path: string;
  url: string;
  thumb_url: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  folder: string;
  alt: Translatable;
  uploaded_by: number | null;
}

export interface ContactMessage extends Timestamps {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  reply: string;
  ip: string;
  user_id: number | null;
  locale: string;
}

export interface Subscriber extends Timestamps {
  id: number;
  email: string;
  name: string;
  locale: string;
  is_confirmed: boolean;
  unsubscribed_at: string | null;
}

export type FavoriteType = "article" | "exhibit" | "event" | "hall";

export interface Favorite extends Timestamps {
  id: number;
  user_id: number;
  target_type: FavoriteType;
  target_id: number;
  target?: Article | Exhibit | Event | Hall;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user?: Pick<User, "id" | "name" | "email" | "avatar"> | null;
  action: string;
  entity: string;
  entity_id: number;
  details: unknown;
  ip: string;
  created_at: string;
}

export interface Bootstrap {
  locale: string;
  default_locale: string;
  settings: Record<string, unknown>;
  languages: Language[];
  menus: Record<string, MenuItem[]>;
  translations: Record<string, string>;
}

export interface DashboardData {
  counts: {
    articles: number;
    published_articles: number;
    exhibits: number;
    halls: number;
    galleries: number;
    events: number;
    users: number;
    messages_new: number;
    subscribers: number;
    media: number;
  };
  views: { articles: number; exhibits: number };
  charts: {
    articles_by_month: { month: string; count: number }[];
    top_articles: { id: number; title: Translatable; views: number }[];
    messages_by_month: { month: string; count: number }[];
  };
  recent: { articles: Article[]; messages: ContactMessage[]; logs: ActivityLog[] };
}

export interface SearchResult {
  articles: Article[];
  exhibits: Exhibit[];
  halls: Hall[];
  events: Event[];
  pages: Page[];
  total: number;
}

export interface PublicStats {
  exhibits: number;
  halls: number;
  articles: number;
  events: number;
  galleries: number;
}
