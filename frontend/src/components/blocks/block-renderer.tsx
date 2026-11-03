import type { Block } from "@/lib/types";
import { t as tr } from "@/lib/utils";
import {
  CtaBlock,
  FaqBlock,
  FeaturesBlock,
  ImageTextBlock,
  ImagesGridBlock,
  PageHeaderBlock,
  RichTextBlock,
  SpacerBlock,
  StatsBlock,
  TimelineBlock,
  VideoBlock,
  arr,
  plain,
  str,
  type S,
} from "./content-blocks";
import {
  AboutIntroBlock,
  ContactBlock,
  EventsUpcomingBlock,
  ExhibitsFeaturedBlock,
  GalleryStripBlock,
  HallsGridBlock,
  HeroBlock,
  LatestNewsBlock,
  VisitCtaBlock,
  VisitInfoBlock,
  settingsStats,
} from "./data-blocks";

/**
 * Renders the ordered block list of a dynamic page. Unknown block types are skipped.
 * Blocks that need data are async server components.
 */
export async function BlockRenderer({ blocks, locale, pageTitle }: { blocks: Block[]; locale: string; pageTitle?: string }) {
  const list = Array.isArray(blocks) ? blocks : [];
  return (
    <>
      {list.map((b, i) => (
        <RenderBlock key={b.id || i} block={b} locale={locale} pageTitle={pageTitle} />
      ))}
    </>
  );
}

export async function RenderBlock({ block, locale, pageTitle }: { block: Block; locale: string; pageTitle?: string }) {
  const s = (block.settings ?? {}) as S;
  switch (block.type) {
    case "hero":
      return <HeroBlock s={s} locale={locale} />;
    case "page_header":
      return <PageHeaderBlock s={s} locale={locale} fallbackTitle={pageTitle} />;
    case "about_intro":
      return <AboutIntroBlock s={s} locale={locale} />;
    case "rich_text":
      return <RichTextBlock s={s} locale={locale} />;
    case "image_text":
      return <ImageTextBlock s={s} locale={locale} />;
    case "stats":
      return <StatsBlock s={s} locale={locale} settingsStats={await settingsStats(locale)} />;
    case "features":
      return <FeaturesBlock s={s} locale={locale} />;
    case "halls_grid":
      return <HallsGridBlock s={s} locale={locale} />;
    case "exhibits_featured":
      return <ExhibitsFeaturedBlock s={s} locale={locale} />;
    case "latest_news":
      return <LatestNewsBlock s={s} locale={locale} />;
    case "events_upcoming":
      return <EventsUpcomingBlock s={s} locale={locale} />;
    case "gallery_strip":
      return <GalleryStripBlock s={s} locale={locale} />;
    case "gallery":
      if (plain(s, "gallery_slug")) return <GalleryStripBlock s={{ ...s, limit: s.limit ?? 24 }} locale={locale} />;
      return <ImagesGridBlock images={arr<string>(s, "images")} title={str(s, "title", locale)} />;
    case "visit_cta":
      return <VisitCtaBlock s={s} locale={locale} />;
    case "visit_info":
      return <VisitInfoBlock s={s} locale={locale} />;
    case "contact":
      return <ContactBlock s={s} locale={locale} />;
    case "faq":
      return <FaqBlock s={s} locale={locale} />;
    case "cta":
      return <CtaBlock s={s} locale={locale} />;
    case "video":
      return <VideoBlock s={s} locale={locale} />;
    case "spacer":
      return <SpacerBlock s={s} />;
    case "timeline":
      return <TimelineBlock s={s} locale={locale} />;
    default:
      if (process.env.NODE_ENV !== "production") {
        return (
          <div className="container-x my-6 rounded-lg border border-dashed border-warning/60 p-4 text-sm text-warning">
            Unknown block type: <code>{block.type}</code> {tr(s.title as Record<string, string>, locale)}
          </div>
        );
      }
      return null;
  }
}
