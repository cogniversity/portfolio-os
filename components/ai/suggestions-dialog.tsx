"use client";

import * as React from "react";
import { Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface SuggestionRow {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  priority?: string;
  kept: boolean;
}

export interface SuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: SuggestionRow[];
  onRowsChange: (rows: SuggestionRow[]) => void;
  onConfirm: () => Promise<void> | void;
  applying?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  confirmLabel?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  kindLabel?: string;
  headerExtra?: React.ReactNode;
  renderExtraRowFields?: (
    row: SuggestionRow,
    update: (next: Partial<SuggestionRow>) => void,
  ) => React.ReactNode;
}

const STATUS_OPTIONS = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];
const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"];

export function SuggestionsDialog(props: SuggestionsDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    rows,
    onRowsChange,
    onConfirm,
    applying,
    loading,
    emptyLabel = "No suggestions yet.",
    confirmLabel,
    onRegenerate,
    regenerating,
    kindLabel,
    headerExtra,
    renderExtraRowFields,
  } = props;

  const keptCount = rows.filter((r) => r.kept).length;

  function updateRow(id: string, next: Partial<SuggestionRow>) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function handleConfirm() {
    if (keptCount === 0) {
      toast.error("Nothing to apply. Toggle at least one item.");
      return;
    }
    try {
      await onConfirm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {title}
            {kindLabel ? (
              <Badge variant="outline" className="font-normal">
                {kindLabel}
              </Badge>
            ) : null}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
          {headerExtra ? <div className="pt-1">{headerExtra}</div> : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating suggestions...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          ) : (
            rows.map((row, idx) => (
              <SuggestionRowView
                key={row.id}
                row={row}
                index={idx}
                onUpdate={(next) => updateRow(row.id, next)}
                extra={renderExtraRowFields?.(row, (next) => updateRow(row.id, next))}
              />
            ))
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t gap-2 sm:gap-2 flex-row items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {rows.length > 0 ? (
              <>
                <span className="font-medium text-foreground">{keptCount}</span> of{" "}
                {rows.length} will be created
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            {onRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onRegenerate}
                disabled={regenerating || applying}
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                Regenerate
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={applying || keptCount === 0}
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {confirmLabel ?? `Apply ${keptCount} item${keptCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SuggestionRowViewProps {
  row: SuggestionRow;
  index: number;
  onUpdate: (next: Partial<SuggestionRow>) => void;
  extra?: React.ReactNode;
}

function SuggestionRowView({ row, index, onUpdate, extra }: SuggestionRowViewProps) {
  return (
    <div
      className={
        "rounded-md border p-3 space-y-2 transition-colors " +
        (row.kept ? "bg-background" : "bg-muted/40 opacity-60")
      }
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Input
              value={row.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Name"
              className="font-medium"
            />
          </div>
          <Textarea
            value={row.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="text-sm resize-y"
          />
          {extra ? <div className="pt-1">{extra}</div> : null}
          <div className="flex flex-wrap gap-2">
            {row.status !== undefined ? (
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={row.status || "PLANNED"}
                  onValueChange={(v) => onUpdate({ status: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {row.priority !== undefined ? (
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select
                  value={row.priority || "P2"}
                  onValueChange={(v) => onUpdate({ priority: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onUpdate({ kept: !row.kept })}
          title={row.kept ? "Discard" : "Keep"}
        >
          {row.kept ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
