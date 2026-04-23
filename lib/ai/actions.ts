"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import {
  AIConfigError,
  AIRuntimeError,
  getModel,
  getOpenAI,
  isAIConfigured,
  trimProse,
} from "./client";
import {
  buildChildrenPrompt,
  buildDescribePrompt,
  buildHierarchyPrompt,
} from "./prompts";
import {
  applyChildrenSchema,
  applyHierarchySchema,
  childrenDraftSchema,
  descriptionDraftSchema,
  hierarchyDraftSchema,
  aiChildKindEnum,
  aiDescribeKindEnum,
  aiParentKindEnum,
  type ApplyChildrenInput,
  type ApplyHierarchyInput,
  type AiChildKind,
  type AiDescribeKind,
  type AiParentKind,
  type ChildrenDraft,
  type DescriptionDraft,
  type HierarchyDraft,
} from "./schemas";
import { assertRate, RateLimitError } from "./rate-limit";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "CONFIG" | "RATE" | "VALIDATION" | "RUNTIME" };

async function callOpenAI(system: string, user: string): Promise<unknown> {
  const openai = getOpenAI();
  const model = getModel();
  let res;
  try {
    res = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } catch (err: any) {
    throw new AIRuntimeError(
      `OpenAI call failed: ${err?.message ?? "unknown error"}`,
    );
  }
  const content = res.choices?.[0]?.message?.content;
  if (!content) throw new AIRuntimeError("OpenAI returned an empty response");
  try {
    return JSON.parse(content);
  } catch {
    throw new AIRuntimeError("OpenAI returned non-JSON content");
  }
}

function handleError(err: unknown): ActionResult<never> {
  if (err instanceof AIConfigError) {
    return { ok: false, error: err.message, code: "CONFIG" };
  }
  if (err instanceof RateLimitError) {
    return { ok: false, error: err.message, code: "RATE" };
  }
  if (err instanceof AIRuntimeError) {
    return { ok: false, error: err.message, code: "RUNTIME" };
  }
  if (err instanceof Error) {
    return { ok: false, error: err.message, code: "RUNTIME" };
  }
  return { ok: false, error: "Unknown error", code: "RUNTIME" };
}

// ---------------------------------------------------------------------------
// Capability A — prose -> hierarchy draft
// ---------------------------------------------------------------------------

export async function aiIsConfigured(): Promise<boolean> {
  return isAIConfigured();
}

const INCLUDE_DEFAULT = {
  products: false,
  initiatives: true,
  epics: true,
  stories: true,
};

export async function draftHierarchyFromText(input: {
  text: string;
  anchorProductId?: string | null;
  include?: Partial<typeof INCLUDE_DEFAULT>;
}): Promise<ActionResult<HierarchyDraft>> {
  try {
    const user = await assertCanWrite();
    assertRate(user.id, "draft");
    if (!input.text || input.text.trim().length < 10) {
      return { ok: false, error: "Please provide at least a short paragraph of context." };
    }
    const include = { ...INCLUDE_DEFAULT, ...(input.include ?? {}) };
    const [anchor, existingProducts, types] = await Promise.all([
      input.anchorProductId
        ? prisma.product.findUnique({
            where: { id: input.anchorProductId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.initiativeType.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);
    const prompt = buildHierarchyPrompt({
      text: trimProse(input.text),
      anchorProduct: anchor,
      include,
      existingProducts,
      initiativeTypes: types,
    });
    const raw = await callOpenAI(prompt.system, prompt.user);
    const parsed = hierarchyDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "AI returned invalid data; please regenerate.",
        code: "VALIDATION",
      };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// Capability B — suggest children
// ---------------------------------------------------------------------------

interface ParentContext {
  name: string;
  description: string | null;
  siblings: Array<{ name: string }>;
}

async function loadParentContext(
  kind: AiParentKind,
  id: string,
): Promise<ParentContext | null> {
  if (kind === "PRODUCT") {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        initiatives: {
          take: 10,
          orderBy: { initiative: { updatedAt: "desc" } },
          select: { initiative: { select: { name: true } } },
        },
        directEpics: {
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: { name: true },
        },
      },
    });
    if (!p) return null;
    const siblings = [
      ...p.initiatives.map((x) => ({ name: x.initiative.name })),
      ...p.directEpics.map((x) => ({ name: x.name })),
    ];
    return { name: p.name, description: p.description, siblings };
  }
  if (kind === "INITIATIVE") {
    const i = await prisma.initiative.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        epics: { take: 20, orderBy: { updatedAt: "desc" }, select: { name: true } },
      },
    });
    if (!i) return null;
    return { name: i.name, description: i.description, siblings: i.epics };
  }
  if (kind === "EPIC") {
    const e = await prisma.epic.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        stories: { take: 20, orderBy: { updatedAt: "desc" }, select: { name: true } },
      },
    });
    if (!e) return null;
    return { name: e.name, description: e.description, siblings: e.stories };
  }
  if (kind === "STORY") {
    const s = await prisma.story.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        tasks: { take: 20, orderBy: { updatedAt: "desc" }, select: { name: true } },
      },
    });
    if (!s) return null;
    return { name: s.name, description: s.description, siblings: s.tasks };
  }
  return null;
}

function defaultChildKind(parent: AiParentKind): AiChildKind {
  if (parent === "PRODUCT") return "INITIATIVE";
  if (parent === "INITIATIVE") return "EPIC";
  if (parent === "EPIC") return "STORY";
  return "TASK";
}

export async function suggestChildren(input: {
  parentKind: AiParentKind;
  parentId: string;
  childKind?: AiChildKind;
  count?: number;
}): Promise<ActionResult<{ items: ChildrenDraft["items"]; childKind: AiChildKind }>> {
  try {
    const user = await assertCanWrite();
    assertRate(user.id, "children");
    const parentKind = aiParentKindEnum.parse(input.parentKind);
    const childKind = aiChildKindEnum.parse(input.childKind ?? defaultChildKind(parentKind));
    if (!isValidParentChild(parentKind, childKind)) {
      return { ok: false, error: `${parentKind} cannot parent ${childKind}.` };
    }
    const ctx = await loadParentContext(parentKind, input.parentId);
    if (!ctx) return { ok: false, error: "Parent not found" };
    const prompt = buildChildrenPrompt({
      parentKind,
      childKind,
      parent: { name: ctx.name, description: ctx.description },
      siblings: ctx.siblings,
      count: Math.min(12, Math.max(3, input.count ?? 6)),
    });
    const raw = await callOpenAI(prompt.system, prompt.user);
    const parsed = childrenDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "AI returned invalid data; please regenerate.",
        code: "VALIDATION",
      };
    }
    return { ok: true, data: { items: parsed.data.items, childKind } };
  } catch (err) {
    return handleError(err);
  }
}

function isValidParentChild(parent: AiParentKind, child: AiChildKind): boolean {
  if (parent === "PRODUCT") return child === "INITIATIVE" || child === "EPIC";
  if (parent === "INITIATIVE") return child === "EPIC";
  if (parent === "EPIC") return child === "STORY";
  if (parent === "STORY") return child === "TASK";
  return false;
}

// ---------------------------------------------------------------------------
// Capability C — improve description
// ---------------------------------------------------------------------------

export async function improveDescription(input: {
  kind: AiDescribeKind;
  name: string;
  currentDescription?: string | null;
}): Promise<ActionResult<DescriptionDraft>> {
  try {
    const user = await assertCanWrite();
    assertRate(user.id, "describe");
    const kind = aiDescribeKindEnum.parse(input.kind);
    if (!input.name || !input.name.trim()) {
      return { ok: false, error: "Please enter a name first." };
    }
    const prompt = buildDescribePrompt({
      kind,
      name: input.name.trim(),
      currentDescription: input.currentDescription ?? null,
    });
    const raw = await callOpenAI(prompt.system, prompt.user);
    const parsed = descriptionDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "AI returned invalid data; please regenerate.",
        code: "VALIDATION",
      };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// Apply hierarchy draft (Capability A commit)
// ---------------------------------------------------------------------------

interface ApplyHierarchyResult {
  createdProductIds: string[];
  createdInitiativeIds: string[];
  createdEpicIds: string[];
  createdStoryIds: string[];
}

export async function applyHierarchyDraft(
  input: ApplyHierarchyInput,
): Promise<ActionResult<ApplyHierarchyResult>> {
  try {
    const user = await assertCanWrite();
    const parsed = applyHierarchySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid payload", code: "VALIDATION" };
    }
    const d = parsed.data;

    const productIdByRef = new Map<string, string>();
    const initiativeIdByRef = new Map<string, string>();
    const epicIdByRef = new Map<string, string>();
    const storyIdByRef = new Map<string, string>();

    const result: ApplyHierarchyResult = {
      createdProductIds: [],
      createdInitiativeIds: [],
      createdEpicIds: [],
      createdStoryIds: [],
    };

    await prisma.$transaction(async (tx) => {
      for (const p of d.products ?? []) {
        if (p.existingId) {
          productIdByRef.set(p.ref, p.existingId);
          continue;
        }
        const count = await tx.product.count();
        const created = await tx.product.create({
          data: {
            name: p.name,
            description: p.description ?? null,
            orderIndex: count,
          },
          select: { id: true, name: true },
        });
        productIdByRef.set(p.ref, created.id);
        result.createdProductIds.push(created.id);
        await tx.activityLog.create({
          data: {
            itemType: "PRODUCT",
            itemId: created.id,
            actorId: user.id,
            kind: "CREATED",
            summary: `Created product "${created.name}" via AI`,
            diff: { source: "ai" } as Prisma.InputJsonValue,
          },
        });
      }

      for (const i of d.initiatives ?? []) {
        let initiativeId: string;
        if (i.existingId) {
          initiativeId = i.existingId;
          initiativeIdByRef.set(i.ref, initiativeId);
        } else {
          const count = await tx.initiative.count();
          const created = await tx.initiative.create({
            data: {
              name: i.name,
              description: i.description ?? null,
              typeId: i.typeId ?? null,
              priority: i.priority ?? "P2",
              orderIndex: count,
            },
            select: { id: true, name: true },
          });
          initiativeId = created.id;
          initiativeIdByRef.set(i.ref, initiativeId);
          result.createdInitiativeIds.push(initiativeId);
          await tx.activityLog.create({
            data: {
              itemType: "INITIATIVE",
              itemId: initiativeId,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created initiative "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
        const productIds = new Set<string>();
        for (const ref of i.productRefs ?? []) {
          const pid = productIdByRef.get(ref);
          if (pid) productIds.add(pid);
        }
        for (const existing of i.productExistingIds ?? []) productIds.add(existing);
        for (const pid of productIds) {
          await tx.initiativeProduct
            .create({ data: { initiativeId, productId: pid } })
            .catch(() => {});
        }
      }

      for (const e of d.epics ?? []) {
        let initiativeId: string | null = null;
        if (e.initiativeExistingId) initiativeId = e.initiativeExistingId;
        else if (e.initiativeRef) initiativeId = initiativeIdByRef.get(e.initiativeRef) ?? null;
        let productId: string | null = null;
        if (e.productExistingId) productId = e.productExistingId;
        else if (e.productRef) productId = productIdByRef.get(e.productRef) ?? null;
        if (!initiativeId && !productId) {
          throw new AIRuntimeError(
            `Epic "${e.name}" is missing a parent initiative or product`,
          );
        }
        const count = await tx.epic.count({
          where: initiativeId ? { initiativeId } : { productId: productId ?? undefined },
        });
        const created = await tx.epic.create({
          data: {
            initiativeId,
            productId,
            name: e.name,
            description: e.description ?? null,
            priority: e.priority ?? "P2",
            orderIndex: count,
          },
          select: { id: true, name: true },
        });
        epicIdByRef.set(e.ref, created.id);
        result.createdEpicIds.push(created.id);
        await tx.activityLog.create({
          data: {
            itemType: "EPIC",
            itemId: created.id,
            actorId: user.id,
            kind: "CREATED",
            summary: `Created epic "${created.name}" via AI`,
            diff: { source: "ai" } as Prisma.InputJsonValue,
          },
        });
      }

      for (const s of d.stories ?? []) {
        let epicId: string | null = null;
        if (s.epicExistingId) epicId = s.epicExistingId;
        else if (s.epicRef) epicId = epicIdByRef.get(s.epicRef) ?? null;
        if (!epicId) {
          throw new AIRuntimeError(`Story "${s.name}" is missing a parent epic`);
        }
        const count = await tx.story.count({ where: { epicId } });
        const created = await tx.story.create({
          data: {
            epicId,
            name: s.name,
            description: s.description ?? null,
            priority: s.priority ?? "P2",
            orderIndex: count,
          },
          select: { id: true, name: true },
        });
        storyIdByRef.set(s.ref, created.id);
        result.createdStoryIds.push(created.id);
        await tx.activityLog.create({
          data: {
            itemType: "STORY",
            itemId: created.id,
            actorId: user.id,
            kind: "CREATED",
            summary: `Created story "${created.name}" via AI`,
            diff: { source: "ai" } as Prisma.InputJsonValue,
          },
        });
      }
    });

    revalidatePath("/products");
    revalidatePath("/roadmap");
    revalidatePath("/initiatives");
    revalidatePath("/epics");
    return { ok: true, data: result };
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// Apply children draft (Capability B commit)
// ---------------------------------------------------------------------------

export async function applyChildrenDraft(
  input: ApplyChildrenInput,
): Promise<ActionResult<{ createdIds: string[] }>> {
  try {
    const user = await assertCanWrite();
    const parsed = applyChildrenSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid payload", code: "VALIDATION" };
    }
    const { parentKind, parentId, items, childKind } = parsed.data;
    if (!isValidParentChild(parentKind, childKind)) {
      return { ok: false, error: `${parentKind} cannot parent ${childKind}.` };
    }

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      if (childKind === "INITIATIVE" && parentKind === "PRODUCT") {
        for (const it of items) {
          const count = await tx.initiative.count();
          const created = await tx.initiative.create({
            data: {
              name: it.name,
              description: it.description ?? null,
              status: it.status ?? "PLANNED",
              priority: it.priority ?? "P2",
              orderIndex: count,
              products: {
                create: { productId: parentId },
              },
            },
            select: { id: true, name: true },
          });
          createdIds.push(created.id);
          await tx.activityLog.create({
            data: {
              itemType: "INITIATIVE",
              itemId: created.id,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created initiative "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
      } else if (childKind === "EPIC" && parentKind === "PRODUCT") {
        for (const it of items) {
          const count = await tx.epic.count({ where: { productId: parentId } });
          const created = await tx.epic.create({
            data: {
              productId: parentId,
              name: it.name,
              description: it.description ?? null,
              status: it.status ?? "PLANNED",
              priority: it.priority ?? "P2",
              orderIndex: count,
            },
            select: { id: true, name: true },
          });
          createdIds.push(created.id);
          await tx.activityLog.create({
            data: {
              itemType: "EPIC",
              itemId: created.id,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created epic "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
      } else if (childKind === "EPIC" && parentKind === "INITIATIVE") {
        for (const it of items) {
          const count = await tx.epic.count({ where: { initiativeId: parentId } });
          const created = await tx.epic.create({
            data: {
              initiativeId: parentId,
              name: it.name,
              description: it.description ?? null,
              status: it.status ?? "PLANNED",
              priority: it.priority ?? "P2",
              orderIndex: count,
            },
            select: { id: true, name: true },
          });
          createdIds.push(created.id);
          await tx.activityLog.create({
            data: {
              itemType: "EPIC",
              itemId: created.id,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created epic "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
      } else if (childKind === "STORY" && parentKind === "EPIC") {
        for (const it of items) {
          const count = await tx.story.count({ where: { epicId: parentId } });
          const created = await tx.story.create({
            data: {
              epicId: parentId,
              name: it.name,
              description: it.description ?? null,
              status: it.status ?? "PLANNED",
              priority: it.priority ?? "P2",
              orderIndex: count,
            },
            select: { id: true, name: true },
          });
          createdIds.push(created.id);
          await tx.activityLog.create({
            data: {
              itemType: "STORY",
              itemId: created.id,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created story "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
      } else if (childKind === "TASK" && parentKind === "STORY") {
        for (const it of items) {
          const count = await tx.task.count({ where: { storyId: parentId } });
          const created = await tx.task.create({
            data: {
              storyId: parentId,
              name: it.name,
              description: it.description ?? null,
              status: it.status ?? "PLANNED",
              priority: it.priority ?? "P2",
              orderIndex: count,
            },
            select: { id: true, name: true },
          });
          createdIds.push(created.id);
          await tx.activityLog.create({
            data: {
              itemType: "TASK",
              itemId: created.id,
              actorId: user.id,
              kind: "CREATED",
              summary: `Created task "${created.name}" via AI`,
              diff: { source: "ai" } as Prisma.InputJsonValue,
            },
          });
        }
      } else {
        throw new AIRuntimeError(
          `Unsupported parent/child combination: ${parentKind} -> ${childKind}`,
        );
      }
    });

    if (parentKind === "PRODUCT") revalidatePath(`/products/${parentId}`);
    if (parentKind === "INITIATIVE") revalidatePath(`/initiatives/${parentId}`);
    if (parentKind === "EPIC") revalidatePath(`/epics/${parentId}`);
    if (parentKind === "STORY") revalidatePath(`/stories/${parentId}`);

    return { ok: true, data: { createdIds } };
  } catch (err) {
    return handleError(err);
  }
}
