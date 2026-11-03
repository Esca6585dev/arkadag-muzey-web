import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          data-slot="empty-state-icon"
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <h3 data-slot="empty-state-title" className="text-base font-semibold text-foreground">
        {title}
      </h3>
      {description ? (
        <p
          data-slot="empty-state-description"
          className="max-w-sm text-sm text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div data-slot="empty-state-action" className="mt-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
