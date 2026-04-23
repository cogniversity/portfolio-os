"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AiButtonProps extends ButtonProps {
  pending?: boolean;
  iconOnly?: boolean;
}

export const AiButton = React.forwardRef<HTMLButtonElement, AiButtonProps>(
  (
    { children, pending, iconOnly, className, variant = "outline", size, disabled, ...rest },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        disabled={disabled || pending}
        className={cn(
          "gap-1.5 border-violet-500/40 text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200",
          iconOnly && "h-8 w-8",
          className,
        )}
        {...rest}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {!iconOnly && <span>{children}</span>}
      </Button>
    );
  },
);
AiButton.displayName = "AiButton";
