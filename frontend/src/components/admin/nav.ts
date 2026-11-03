import {
  BookOpen,
  CalendarDays,
  FileText,
  FolderTree,
  GalleryHorizontalEnd,
  Globe,
  History,
  Images,
  Inbox,
  Landmark,
  Languages,
  LayoutDashboard,
  ListTree,
  Mail,
  Settings,
  Sparkles,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface AdminNavItem {
  href: string;
  /** key under the `admin` messages namespace */
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  badge?: "messages";
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: "", items: [{ href: "/admin", label: "dashboard", icon: LayoutDashboard }] },
  {
    label: "content",
    items: [
      { href: "/admin/articles", label: "articles", icon: BookOpen },
      { href: "/admin/categories", label: "categories", icon: FolderTree },
      { href: "/admin/tags", label: "tags", icon: Tags },
      { href: "/admin/pages", label: "pages", icon: FileText },
    ],
  },
  {
    label: "museum",
    items: [
      { href: "/admin/halls", label: "halls", icon: Landmark },
      { href: "/admin/exhibits", label: "exhibits", icon: Sparkles },
      { href: "/admin/galleries", label: "galleries", icon: GalleryHorizontalEnd },
      { href: "/admin/events", label: "events", icon: CalendarDays },
      { href: "/admin/slides", label: "slides", icon: Images },
    ],
  },
  {
    label: "media",
    items: [
      { href: "/admin/media", label: "mediaLibrary", icon: Images },
      { href: "/admin/menus", label: "menus", icon: ListTree },
    ],
  },
  {
    label: "communication",
    items: [
      { href: "/admin/messages", label: "messages", icon: Inbox, badge: "messages" },
      { href: "/admin/subscribers", label: "subscribers", icon: Mail },
    ],
  },
  {
    label: "system",
    items: [
      { href: "/admin/users", label: "users", icon: Users, roles: ["admin"] },
      { href: "/admin/settings", label: "settings", icon: Settings },
      { href: "/admin/languages", label: "languages", icon: Globe, roles: ["admin"] },
      { href: "/admin/translations", label: "translations", icon: Languages },
      { href: "/admin/activity-logs", label: "activityLogs", icon: History, roles: ["admin"] },
    ],
  },
];
