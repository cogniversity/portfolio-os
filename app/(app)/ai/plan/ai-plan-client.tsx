"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiButton } from "@/components/ai/ai-button";
import {
  applyHierarchyDraft,
  draftHierarchyFromText,
} from "@/lib/ai/actions";
import type { HierarchyDraft } from "@/lib/ai/schemas";

const UNASSIGNED = "__unassigned__";

type ProductRow = {
  ref: string;
  name: string;
  description: string;
  kept: boolean;
};

type InitiativeRow = {
  ref: string;
  name: string;
  description: string;
  typeId: string | null;
  productRefs: string[];
  productExistingIds: string[];
  priority: string;
  kept: boolean;
};

type EpicRow = {
  ref: string;
  name: string;
  description: string;
  initiativeRef: string | null;
  initiativeExistingId: string | null;
  productRef: string | null;
  productExistingId: string | null;
  priority: string;
  kept: boolean;
};

type StoryRow = {
  ref: string;
  name: string;
  description: string;
  epicRef: string | null;
  epicExistingId: string | null;
  priority: string;
  kept: boolean;
};

interface Props {
  products: Array<{ id: string; name: string }>;
  initiativeTypes: Array<{ id: string; name: string }>;
  defaultProductId: string | null;
}

export function AiPlanClient({ products, initiativeTypes, defaultProductId }: Props) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [anchorProductId, setAnchorProductId] = React.useState<string | null>(
    defaultProductId,
  );
  const [include, setInclude] = React.useState({
    products: false,
    initiatives: true,
    epics: true,
    stories: true,
  });
  const [generating, setGenerating] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [productRows, setProductRows] = React.useState<ProductRow[]>([]);
  const [initiativeRows, setInitiativeRows] = React.useState<InitiativeRow[]>([]);
  const [epicRows, setEpicRows] = React.useState<EpicRow[]>([]);
  const [storyRows, setStoryRows] = React.useState<StoryRow[]>([]);
  const [hasDraft, setHasDraft] = React.useState(false);

  const anchorProduct = React.useMemo(
    () => products.find((p) => p.id === anchorProductId) ?? null,
    [anchorProductId, products],
  );

  async function handleGenerate() {
    if (text.trim().length < 10) {
      toast.error("Please paste at least a paragraph of context.");
      return;
    }
    setGenerating(true);
    const res = await draftHierarchyFromText({
      text,
      anchorProductId: anchorProductId ?? undefined,
      include,
    });
    setGenerating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    populateFromDraft(res.data);
    setHasDraft(true);
  }

  function populateFromDraft(d: HierarchyDraft) {
    setProductRows(
      (d.products ?? []).map((p) => ({
        ref: p.ref,
        name: p.name,
        description: p.description ?? "",
        kept: true,
      })),
    );
    setInitiativeRows(
      (d.initiatives ?? []).map((i) => {
        const productRefs: string[] = [];
        const productExistingIds: string[] = [];
        for (const r of i.productRefs ?? []) {
          if (r === "__anchor__" && anchorProduct) {
            productExistingIds.push(anchorProduct.id);
          } else {
            productRefs.push(r);
          }
        }
        const matchedType = i.typeName
          ? initiativeTypes.find(
              (t) => t.name.toLowerCase() === i.typeName!.toLowerCase(),
            ) ?? null
          : null;
        return {
          ref: i.ref,
          name: i.name,
          description: i.description ?? "",
          typeId: matchedType?.id ?? null,
          productRefs,
          productExistingIds,
          priority: i.priority ?? "P2",
          kept: true,
        };
      }),
    );
    setEpicRows(
      (d.epics ?? []).map((e) => {
        let productExistingId: string | null = null;
        let productRef: string | null = null;
        if (e.productRef === "__anchor__" && anchorProduct) {
          productExistingId = anchorProduct.id;
        } else if (e.productRef) {
          productRef = e.productRef;
        }
        return {
          ref: e.ref,
          name: e.name,
          description: e.description ?? "",
          initiativeRef: e.initiativeRef ?? null,
          initiativeExistingId: null,
          productRef,
          productExistingId,
          priority: e.priority ?? "P2",
          kept: true,
        };
      }),
    );
    setStoryRows(
      (d.stories ?? []).map((s) => ({
        ref: s.ref,
        name: s.name,
        description: s.description ?? "",
        epicRef: s.epicRef,
        epicExistingId: null,
        priority: s.priority ?? "P2",
        kept: true,
      })),
    );
  }

  async function handleApply() {
    const keptProducts = productRows.filter((r) => r.kept);
    const keptInitiatives = initiativeRows.filter((r) => r.kept);
    const keptEpics = epicRows.filter((r) => r.kept);
    const keptStories = storyRows.filter((r) => r.kept);
    const total =
      keptProducts.length +
      keptInitiatives.length +
      keptEpics.length +
      keptStories.length;
    if (total === 0) {
      toast.error("Nothing to apply. Keep at least one item.");
      return;
    }

    for (const e of keptEpics) {
      const hasInit =
        (e.initiativeRef &&
          keptInitiatives.some((i) => i.ref === e.initiativeRef)) ||
        e.initiativeExistingId;
      const hasProd = e.productRef
        ? keptProducts.some((p) => p.ref === e.productRef)
        : Boolean(e.productExistingId);
      if (!hasInit && !hasProd) {
        toast.error(
          `Epic "${e.name}" has no valid parent. Pick an initiative or product.`,
        );
        return;
      }
    }
    for (const s of keptStories) {
      const hasEpic = s.epicRef
        ? keptEpics.some((e) => e.ref === s.epicRef)
        : Boolean(s.epicExistingId);
      if (!hasEpic) {
        toast.error(`Story "${s.name}" has no valid parent epic.`);
        return;
      }
    }

    setApplying(true);
    const res = await applyHierarchyDraft({
      products: keptProducts.map((p) => ({
        ref: p.ref,
        name: p.name,
        description: p.description || null,
      })),
      initiatives: keptInitiatives.map((i) => ({
        ref: i.ref,
        name: i.name,
        description: i.description || null,
        typeId: i.typeId,
        productRefs: i.productRefs.filter((r) =>
          keptProducts.some((p) => p.ref === r),
        ),
        productExistingIds: i.productExistingIds,
        priority: (i.priority as any) ?? "P2",
      })),
      epics: keptEpics.map((e) => ({
        ref: e.ref,
        name: e.name,
        description: e.description || null,
        initiativeRef: e.initiativeRef,
        initiativeExistingId: e.initiativeExistingId,
        productRef: e.productRef,
        productExistingId: e.productExistingId,
        priority: (e.priority as any) ?? "P2",
      })),
      stories: keptStories.map((s) => ({
        ref: s.ref,
        name: s.name,
        description: s.description || null,
        epicRef: s.epicRef,
        epicExistingId: s.epicExistingId,
        priority: (s.priority as any) ?? "P2",
      })),
    });
    setApplying(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Created ${res.data.createdProductIds.length} products, ${res.data.createdInitiativeIds.length} initiatives, ${res.data.createdEpicIds.length} epics, ${res.data.createdStoryIds.length} stories.`,
    );
    router.push("/roadmap");
    router.refresh();
  }

  function reset() {
    setProductRows([]);
    setInitiativeRows([]);
    setEpicRows([]);
    setStoryRows([]);
    setHasDraft(false);
  }

  // Build option lists for cross-references
  const initiativeOptionsForEpics = initiativeRows
    .filter((r) => r.kept)
    .map((r) => ({ value: `ref:${r.ref}`, label: `(new) ${r.name}` }));
  const productOptionsForEpics = [
    ...productRows
      .filter((r) => r.kept)
      .map((r) => ({ value: `ref:${r.ref}`, label: `(new) ${r.name}` })),
    ...products.map((p) => ({ value: `id:${p.id}`, label: p.name })),
  ];
  const epicOptionsForStories = epicRows
    .filter((r) => r.kept)
    .map((r) => ({ value: `ref:${r.ref}`, label: `(new) ${r.name}` }));

  return (
    <div className="space-y-6">
      {!hasDraft ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-prose">Context</Label>
            <Textarea
              id="ai-prose"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste a PRD, meeting notes, customer interview transcript, or describe what you want to plan..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Tip: the more specific the context (goals, constraints, users), the
              better the draft. Max ~8 KB.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Anchor product (optional)</Label>
            <Select
              value={anchorProductId ?? UNASSIGNED}
              onValueChange={(v) =>
                setAnchorProductId(v === UNASSIGNED ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None — plan across portfolio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>
                  None — plan across portfolio
                </SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If chosen, AI will attach new initiatives and direct epics to this
              product.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Include levels</Label>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["products", "Products"],
                  ["initiatives", "Initiatives"],
                  ["epics", "Epics"],
                  ["stories", "Stories"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={include[key]}
                    onCheckedChange={(v) =>
                      setInclude((s) => ({ ...s, [key]: Boolean(v) }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <AiButton onClick={handleGenerate} pending={generating}>
              Generate draft
            </AiButton>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="text-sm text-muted-foreground">
              Review, edit, and toggle rows below. Use the trash icon to discard
              a row. Nothing is saved until you click Apply.
            </div>
            <Button type="button" variant="ghost" onClick={reset}>
              Start over
            </Button>
          </div>

          {productRows.length > 0 && (
            <Group title="Products" count={productRows.filter((r) => r.kept).length}>
              {productRows.map((row) => (
                <RowShell
                  key={row.ref}
                  kept={row.kept}
                  onToggle={() =>
                    setProductRows((rows) =>
                      rows.map((r) =>
                        r.ref === row.ref ? { ...r, kept: !r.kept } : r,
                      ),
                    )
                  }
                >
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setProductRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Product name"
                    className="font-medium"
                  />
                  <Textarea
                    value={row.description}
                    onChange={(e) =>
                      setProductRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref
                            ? { ...r, description: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Description"
                    rows={2}
                    className="text-sm"
                  />
                </RowShell>
              ))}
            </Group>
          )}

          {initiativeRows.length > 0 && (
            <Group
              title="Initiatives"
              count={initiativeRows.filter((r) => r.kept).length}
            >
              {initiativeRows.map((row) => (
                <RowShell
                  key={row.ref}
                  kept={row.kept}
                  onToggle={() =>
                    setInitiativeRows((rows) =>
                      rows.map((r) =>
                        r.ref === row.ref ? { ...r, kept: !r.kept } : r,
                      ),
                    )
                  }
                >
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setInitiativeRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Initiative name"
                    className="font-medium"
                  />
                  <Textarea
                    value={row.description}
                    onChange={(e) =>
                      setInitiativeRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref
                            ? { ...r, description: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Description"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Type
                      </Label>
                      <Select
                        value={row.typeId ?? UNASSIGNED}
                        onValueChange={(v) =>
                          setInitiativeRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref
                                ? { ...r, typeId: v === UNASSIGNED ? null : v }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>
                            (no type)
                          </SelectItem>
                          {initiativeTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Priority
                      </Label>
                      <Select
                        value={row.priority}
                        onValueChange={(v) =>
                          setInitiativeRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref ? { ...r, priority: v } : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["P0", "P1", "P2", "P3"].map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Attached to:{" "}
                    {[
                      ...row.productExistingIds
                        .map(
                          (id) => products.find((p) => p.id === id)?.name ?? id,
                        ),
                      ...row.productRefs.map((r) => {
                        const p = productRows.find((x) => x.ref === r);
                        return p ? `(new) ${p.name}` : r;
                      }),
                    ].join(", ") || "(unattached — add via Products list)"}
                  </div>
                </RowShell>
              ))}
            </Group>
          )}

          {epicRows.length > 0 && (
            <Group title="Epics" count={epicRows.filter((r) => r.kept).length}>
              {epicRows.map((row) => (
                <RowShell
                  key={row.ref}
                  kept={row.kept}
                  onToggle={() =>
                    setEpicRows((rows) =>
                      rows.map((r) =>
                        r.ref === row.ref ? { ...r, kept: !r.kept } : r,
                      ),
                    )
                  }
                >
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setEpicRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Epic name"
                    className="font-medium"
                  />
                  <Textarea
                    value={row.description}
                    onChange={(e) =>
                      setEpicRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref
                            ? { ...r, description: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Description"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Parent initiative
                      </Label>
                      <Select
                        value={
                          row.initiativeRef
                            ? `ref:${row.initiativeRef}`
                            : row.initiativeExistingId
                              ? `id:${row.initiativeExistingId}`
                              : UNASSIGNED
                        }
                        onValueChange={(v) =>
                          setEpicRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref
                                ? {
                                    ...r,
                                    initiativeRef: v.startsWith("ref:")
                                      ? v.slice(4)
                                      : null,
                                    initiativeExistingId: v.startsWith("id:")
                                      ? v.slice(3)
                                      : null,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="(none)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>(none)</SelectItem>
                          {initiativeOptionsForEpics.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Parent product (direct)
                      </Label>
                      <Select
                        value={
                          row.productRef
                            ? `ref:${row.productRef}`
                            : row.productExistingId
                              ? `id:${row.productExistingId}`
                              : UNASSIGNED
                        }
                        onValueChange={(v) =>
                          setEpicRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref
                                ? {
                                    ...r,
                                    productRef: v.startsWith("ref:")
                                      ? v.slice(4)
                                      : null,
                                    productExistingId: v.startsWith("id:")
                                      ? v.slice(3)
                                      : null,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="(none)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>(none)</SelectItem>
                          {productOptionsForEpics.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Priority
                    </Label>
                    <Select
                      value={row.priority}
                      onValueChange={(v) =>
                        setEpicRows((rows) =>
                          rows.map((r) =>
                            r.ref === row.ref ? { ...r, priority: v } : r,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["P0", "P1", "P2", "P3"].map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </RowShell>
              ))}
            </Group>
          )}

          {storyRows.length > 0 && (
            <Group title="Stories" count={storyRows.filter((r) => r.kept).length}>
              {storyRows.map((row) => (
                <RowShell
                  key={row.ref}
                  kept={row.kept}
                  onToggle={() =>
                    setStoryRows((rows) =>
                      rows.map((r) =>
                        r.ref === row.ref ? { ...r, kept: !r.kept } : r,
                      ),
                    )
                  }
                >
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setStoryRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Story name"
                    className="font-medium"
                  />
                  <Textarea
                    value={row.description}
                    onChange={(e) =>
                      setStoryRows((rows) =>
                        rows.map((r) =>
                          r.ref === row.ref
                            ? { ...r, description: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Description"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Parent epic
                      </Label>
                      <Select
                        value={
                          row.epicRef
                            ? `ref:${row.epicRef}`
                            : row.epicExistingId
                              ? `id:${row.epicExistingId}`
                              : UNASSIGNED
                        }
                        onValueChange={(v) =>
                          setStoryRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref
                                ? {
                                    ...r,
                                    epicRef: v.startsWith("ref:")
                                      ? v.slice(4)
                                      : null,
                                    epicExistingId: v.startsWith("id:")
                                      ? v.slice(3)
                                      : null,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="(pick epic)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>(none)</SelectItem>
                          {epicOptionsForStories.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Priority
                      </Label>
                      <Select
                        value={row.priority}
                        onValueChange={(v) =>
                          setStoryRows((rows) =>
                            rows.map((r) =>
                              r.ref === row.ref ? { ...r, priority: v } : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["P0", "P1", "P2", "P3"].map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </RowShell>
              ))}
            </Group>
          )}

          <div className="sticky bottom-0 -mx-6 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {totalKept(productRows, initiativeRows, epicRows, storyRows)} item(s)
              will be created.
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                Discard
              </Button>
              <Button type="button" onClick={handleApply} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function totalKept(
  p: ProductRow[],
  i: InitiativeRow[],
  e: EpicRow[],
  s: StoryRow[],
): number {
  return (
    p.filter((r) => r.kept).length +
    i.filter((r) => r.kept).length +
    e.filter((r) => r.kept).length +
    s.filter((r) => r.kept).length
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="outline" className="font-normal">
          {count}
        </Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowShell({
  kept,
  onToggle,
  children,
}: {
  kept: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "rounded-md border p-3 space-y-2 transition-colors " +
        (kept ? "bg-background" : "bg-muted/40 opacity-60")
      }
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">{children}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={onToggle}
          title={kept ? "Discard" : "Keep"}
        >
          {kept ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
