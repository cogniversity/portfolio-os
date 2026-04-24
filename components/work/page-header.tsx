import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
  breadcrumbs,
  backHref,
  backLabel = "Back",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  breadcrumbs?: React.ReactNode;
  /** e.g. detail page — leaves edit without using the sidebar */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur",
        className,
      )}
    >
      {backHref && (
        <div className="mb-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </div>
      )}
      {breadcrumbs && (
        <div className="mb-1 text-xs text-muted-foreground">{breadcrumbs}</div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
