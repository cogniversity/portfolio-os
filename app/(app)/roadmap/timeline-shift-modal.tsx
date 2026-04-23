"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { applyShiftAction, type SerializedImpact } from "./actions";

export function TimelineShiftModal({
  impact,
  proposed: _proposed,
  onClose,
  onApplied,
}: {
  impact: SerializedImpact;
  proposed: {
    kind: "initiative" | "epic" | "story";
    id: string;
    newStart: string | null;
    newEnd: string | null;
  };
  onClose: () => void;
  onApplied: () => void;
}) {
  const [pushReleases, setPushReleases] = useState(true);
  const [pending, start] = useTransition();

  function apply() {
    start(async () => {
      const res = await applyShiftAction(impact, pushReleases);
      if (!res.ok) {
        toast.error("Failed to apply");
        return;
      }
      toast.success("Timeline updated");
      onApplied();
    });
  }

  const breaking = impact.releaseImpacts.filter((r) => r.breaks);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm timeline change</DialogTitle>
          <DialogDescription>{impact.summary}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-3 overflow-auto">
          {breaking.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Release date breaks ({breaking.length})
              </div>
              <ul className="space-y-1 text-sm">
                {breaking.map((r) => (
                  <li key={r.releaseId} className="flex items-center justify-between">
                    <span>{r.releaseName}</span>
                    <span className="text-muted-foreground">
                      {r.plannedDate && format(new Date(r.plannedDate), "MMM d")} →{" "}
                      <span className="font-medium text-destructive">
                        {r.suggestedDate && format(new Date(r.suggestedDate), "MMM d")}
                      </span>{" "}
                      (+{r.deltaDays}d)
                    </span>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <Checkbox
                  checked={pushReleases}
                  onCheckedChange={(v) => setPushReleases(!!v)}
                />
                Also push release planned dates to accommodate
              </label>
            </div>
          )}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Items moved ({impact.moved.length})
            </div>
            <div className="divide-y rounded-md border bg-card">
              {impact.moved.map((m) => (
                <div key={m.kind + m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                    {m.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.fromEnd ? format(new Date(m.fromEnd), "MMM d") : "—"} →{" "}
                    <span className="font-medium">
                      {m.toEnd ? format(new Date(m.toEnd), "MMM d") : "—"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={pending}>
            {pending ? "Applying..." : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
