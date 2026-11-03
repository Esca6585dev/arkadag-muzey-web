import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  actionHref,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode | string;
  actionHref?: string;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 md:mb-14",
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <span className={cn("eyebrow", align === "center" && "before:hidden")}>{eyebrow}</span>}
        <Tag className="heading-lg text-balance">{title}</Tag>
        {description && <p className="mt-3 text-base text-muted-foreground md:text-lg">{description}</p>}
      </div>
      {action && actionHref ? (
        <Button asChild variant="outline" className="group shrink-0 rounded-full">
          <Link href={actionHref}>
            {action}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      ) : (
        action
      )}
    </div>
  );
}
