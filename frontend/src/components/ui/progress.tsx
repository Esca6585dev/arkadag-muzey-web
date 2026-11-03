import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value?: number | null;
  max?: number;
}) {
  const safe = Math.min(Math.max(value ?? 0, 0), max);
  const percent = max > 0 ? (safe / max) * 100 : 0;

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={safe}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </div>
  );
}

export { Progress };
