// Settings schema of every page block type. Keys and value types match what the renderers in
// src/components/blocks/* read (translatable objects for text, plain strings for URLs/slugs,
// numbers for limits, arrays for items/images). Labels are keys in the `admin` namespace.

import {
  AlignLeft,
  BarChart3,
  CalendarDays,
  Columns2,
  Film,
  GalleryHorizontalEnd,
  HelpCircle,
  History,
  Images,
  Info,
  Landmark,
  LayoutTemplate,
  Megaphone,
  MoveVertical,
  Newspaper,
  PanelTop,
  Phone,
  Presentation,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

export type BlockField =
  | { k: string; t: "tr" | "trText" | "trRich" | "text" | "number" | "bool" | "image" | "images"; label: string }
  | { k: string; t: "select"; label: string; options: string[] }
  | { k: string; t: "items"; label: string; fields: BlockField[] };

export interface BlockSchema {
  icon: LucideIcon;
  fields: BlockField[];
  defaults?: Record<string, unknown>;
}

const LABEL: BlockField = { k: "label", t: "tr", label: "blockFields.label" };
const TITLE: BlockField = { k: "title", t: "tr", label: "form.title" };
const BUTTON: BlockField[] = [
  { k: "button_text", t: "tr", label: "form.buttonText" },
  { k: "button_url", t: "text", label: "form.buttonUrl" },
];
const LIMIT: BlockField = { k: "limit", t: "number", label: "blockFields.limit" };
const POSITION: BlockField = { k: "image_position", t: "select", label: "blockFields.imagePosition", options: ["left", "right"] };

export const BLOCK_SCHEMAS: Record<string, BlockSchema> = {
  hero: {
    icon: Presentation,
    defaults: { source: "slides", position: "home", height: "full" },
    fields: [
      { k: "source", t: "select", label: "blockFields.source", options: ["slides", "custom"] },
      { k: "height", t: "select", label: "blockFields.height", options: ["full", "large", "medium"] },
      { k: "position", t: "text", label: "blockFields.slidePosition" },
      TITLE,
      { k: "subtitle", t: "trText", label: "form.subtitle" },
      { k: "image", t: "image", label: "form.image" },
      ...BUTTON,
      { k: "button2_text", t: "tr", label: "form.button2Text" },
      { k: "button2_url", t: "text", label: "form.button2Url" },
    ],
  },
  page_header: {
    icon: PanelTop,
    fields: [TITLE, { k: "subtitle", t: "trText", label: "form.subtitle" }, { k: "image", t: "image", label: "form.image" }],
  },
  about_intro: {
    icon: Landmark,
    defaults: { show_stats: true, image_position: "left" },
    fields: [LABEL, TITLE, { k: "text", t: "trRich", label: "blockFields.text" }, { k: "images", t: "images", label: "form.images" }, POSITION, { k: "show_stats", t: "bool", label: "blockFields.showStats" }, ...BUTTON],
  },
  rich_text: {
    icon: AlignLeft,
    fields: [TITLE, { k: "content", t: "trRich", label: "blockFields.content" }, { k: "align", t: "select", label: "blockFields.align", options: ["center", "left"] }],
  },
  image_text: {
    icon: Columns2,
    defaults: { image_position: "left" },
    fields: [LABEL, TITLE, { k: "text", t: "trRich", label: "blockFields.text" }, { k: "image", t: "image", label: "form.image" }, { k: "image2", t: "image", label: "blockFields.image2" }, POSITION, ...BUTTON],
  },
  stats: {
    icon: BarChart3,
    defaults: { source: "settings" },
    fields: [
      TITLE,
      { k: "source", t: "select", label: "blockFields.source", options: ["settings", "custom"] },
      {
        k: "items",
        t: "items",
        label: "blockFields.items",
        fields: [
          { k: "value", t: "text", label: "form.value" },
          { k: "suffix", t: "text", label: "blockFields.suffix" },
          { k: "label", t: "tr", label: "form.label" },
        ],
      },
    ],
  },
  features: {
    icon: Star,
    fields: [
      LABEL,
      TITLE,
      {
        k: "items",
        t: "items",
        label: "blockFields.items",
        fields: [
          { k: "icon", t: "text", label: "form.icon" },
          { k: "title", t: "tr", label: "form.title" },
          { k: "text", t: "trText", label: "blockFields.text" },
        ],
      },
    ],
  },
  halls_grid: { icon: Landmark, defaults: { limit: 6 }, fields: [LABEL, TITLE, LIMIT, ...BUTTON] },
  exhibits_featured: { icon: Sparkles, defaults: { limit: 6 }, fields: [LABEL, TITLE, LIMIT, ...BUTTON] },
  latest_news: { icon: Newspaper, defaults: { limit: 4 }, fields: [LABEL, TITLE, LIMIT, { k: "category", t: "text", label: "blockFields.category" }, ...BUTTON] },
  events_upcoming: { icon: CalendarDays, defaults: { limit: 3 }, fields: [LABEL, TITLE, LIMIT, { k: "button_url", t: "text", label: "form.buttonUrl" }] },
  gallery_strip: {
    icon: GalleryHorizontalEnd,
    defaults: { limit: 8 },
    fields: [LABEL, TITLE, { k: "gallery_slug", t: "text", label: "blockFields.gallerySlug" }, LIMIT, { k: "button_url", t: "text", label: "form.buttonUrl" }],
  },
  gallery: { icon: Images, fields: [TITLE, { k: "gallery_slug", t: "text", label: "blockFields.gallerySlug" }, { k: "images", t: "images", label: "form.images" }] },
  visit_cta: {
    icon: Megaphone,
    defaults: { show_map: true },
    fields: [LABEL, TITLE, { k: "text", t: "trText", label: "blockFields.text" }, { k: "show_map", t: "bool", label: "blockFields.showMap" }, ...BUTTON],
  },
  visit_info: { icon: Info, fields: [] },
  contact: {
    icon: Phone,
    defaults: { show_form: true, show_map: true, show_info: true },
    fields: [
      { k: "show_info", t: "bool", label: "blockFields.showInfo" },
      { k: "show_form", t: "bool", label: "blockFields.showForm" },
      { k: "show_map", t: "bool", label: "blockFields.showMap" },
    ],
  },
  faq: {
    icon: HelpCircle,
    fields: [
      LABEL,
      TITLE,
      {
        k: "items",
        t: "items",
        label: "blockFields.items",
        fields: [
          { k: "question", t: "tr", label: "blockFields.question" },
          { k: "answer", t: "trText", label: "blockFields.answer" },
        ],
      },
    ],
  },
  cta: { icon: LayoutTemplate, fields: [LABEL, TITLE, { k: "text", t: "trText", label: "blockFields.text" }, { k: "image", t: "image", label: "form.image" }, ...BUTTON] },
  video: { icon: Film, fields: [TITLE, { k: "url", t: "text", label: "form.url" }] },
  spacer: { icon: MoveVertical, defaults: { size: "md" }, fields: [{ k: "size", t: "select", label: "blockFields.size", options: ["sm", "md", "lg"] }] },
  timeline: {
    icon: History,
    fields: [
      LABEL,
      TITLE,
      {
        k: "items",
        t: "items",
        label: "blockFields.items",
        fields: [
          { k: "year", t: "text", label: "blockFields.year" },
          { k: "title", t: "tr", label: "form.title" },
          { k: "text", t: "trText", label: "blockFields.text" },
        ],
      },
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS);

/** Keys a schema knows about; anything else is kept and editable as raw JSON. */
export function knownKeys(type: string): Set<string> {
  return new Set((BLOCK_SCHEMAS[type]?.fields ?? []).map((f) => f.k));
}
