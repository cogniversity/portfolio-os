"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportToolbar({
  csvHref,
  children,
}: {
  csvHref: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card/80 p-2 backdrop-blur">
      {children}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={csvHref}>
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
