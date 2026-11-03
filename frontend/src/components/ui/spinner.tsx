import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-4",
  default: "size-6",
  lg: "size-8",
  xl: "size-12",
} as const;

function Spinner({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof Loader2>, "size"> & {
  size?: keyof typeof sizes;
}) {
  return (
    <Loader2
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("animate-spin text-muted-foreground", sizes[size], className)}
      {...props}
    />
  );
}

export { Spinner };
