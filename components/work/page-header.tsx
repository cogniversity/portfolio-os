import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
  breadcrumbs,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  breadcrumbs?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur",
        className,
      )}
    >
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
