"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AiButton } from "./ai-button";
import {
  SuggestionsDialog,
  type SuggestionRow,
} from "./suggestions-dialog";
import { applyChildrenDraft, suggestChildren } from "@/lib/ai/actions";
import type {
  AiChildKind,
  AiParentKind,
} from "@/lib/ai/schemas";

interface Props {
  parentKind: AiParentKind;
  parentId: string;
  parentName: string;
  allowedChildKinds?: AiChildKind[];
  defaultChildKind?: AiChildKind;
  buttonLabel?: string;
}

const PARENT_TO_DEFAULT: Record<AiParentKind, AiChildKind> = {
  PRODUCT: "INITIATIVE",
  INITIATIVE: "EPIC",
  EPIC: "STORY",
  STORY: "TASK",
};

const PARENT_TO_ALLOWED: Record<AiParentKind, AiChildKind[]> = {
  PRODUCT: ["INITIATIVE", "EPIC"],
  INITIATIVE: ["EPIC"],
  EPIC: ["STORY"],
  STORY: ["TASK"],
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function SuggestChildrenButton(props: Props) {
  const router = useRouter();
  const allowed = props.allowedChildKinds ?? PARENT_TO_ALLOWED[props.parentKind];
  const [open, setOpen] = React.useState(false);
  const [childKind, setChildKind] = React.useState<AiChildKind>(
    props.defaultChildKind ?? PARENT_TO_DEFAULT[props.parentKind],
  );
  const [rows, setRows] = React.useState<SuggestionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  const loadSuggestions = React.useCallback(
    async (kind: AiChildKind) => {
      setLoading(true);
      setRows([]);
      const res = await suggestChildren({
        parentKind: props.parentKind,
        parentId: props.parentId,
        childKind: kind,
      });
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(
        res.data.items.map((it) => ({
          id: genId(),
          name: it.name,
          description: it.description ?? "",
          status: it.status ?? "PLANNED",
          priority: it.priority ?? "P2",
          kept: true,
        })),
      );
    },
    [props.parentKind, props.parentId],
  );

  function handleOpen() {
    setOpen(true);
    void loadSuggestions(childKind);
  }

  async function handleApply() {
    const kept = rows.filter((r) => r.kept);
    if (kept.length === 0) return;
    setApplying(true);
    const res = await applyChildrenDraft({
      parentKind: props.parentKind,
      parentId: props.parentId,
      childKind,
      items: kept.map((r) => ({
        name: r.name,
        description: r.description || null,
        status: (r.status as any) ?? "PLANNED",
        priority: (r.priority as any) ?? "P2",
      })),
    });
    setApplying(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Created ${res.data.createdIds.length} ${childKind.toLowerCase()}(s).`,
    );
    setOpen(false);
    setRows([]);
    router.refresh();
  }

  const kindLabel = `${childKind.charAt(0) + childKind.slice(1).toLowerCase()} under ${props.parentName}`;

  const headerExtra =
    allowed.length > 1 ? (
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Suggest</Label>
        <Select
          value={childKind}
          onValueChange={(v) => {
            const next = v as AiChildKind;
            setChildKind(next);
            void loadSuggestions(next);
          }}
        >
          <SelectTrigger className="h-7 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((o) => (
              <SelectItem key={o} value={o}>
                {o.charAt(0) + o.slice(1).toLowerCase()}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  return (
    <>
      <AiButton size="sm" onClick={handleOpen}>
        {props.buttonLabel ?? "Suggest children"}
      </AiButton>
      <SuggestionsDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setRows([]);
        }}
        title={`AI suggestions for ${props.parentName}`}
        description="Review, edit, toggle, and confirm. Nothing is created until you apply."
        kindLabel={kindLabel}
        headerExtra={headerExtra}
        rows={rows}
        onRowsChange={setRows}
        onConfirm={handleApply}
        onRegenerate={() => loadSuggestions(childKind)}
        regenerating={loading}
        loading={loading}
        applying={applying}
      />
    </>
  );
}
