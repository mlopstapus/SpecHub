import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 py-1 font-mono text-[10.5px] font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "border border-border bg-surface-2 text-dim",
        accent: "border border-transparent bg-a-soft text-a",
        green: "border border-transparent bg-green-soft text-green",
        blue: "border border-transparent bg-blue-soft text-blue",
        red: "border border-transparent bg-red-soft text-red",
        violet: "border border-transparent bg-violet-soft text-violet",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading colored dot, used for verb/action badges (e.g. audit log actions). */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
