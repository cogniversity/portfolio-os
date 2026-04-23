import { z } from "zod";
import {
  priorityEnum,
  workStatusEnum,
} from "@/lib/zod-schemas";

export const aiChildKindEnum = z.enum([
  "INITIATIVE",
  "EPIC",
  "STORY",
  "TASK",
]);
export type AiChildKind = z.infer<typeof aiChildKindEnum>;

export const aiParentKindEnum = z.enum([
  "PRODUCT",
  "INITIATIVE",
  "EPIC",
  "STORY",
]);
export type AiParentKind = z.infer<typeof aiParentKindEnum>;

export const aiDescribeKindEnum = z.enum([
  "PORTFOLIO",
  "PRODUCT",
  "INITIATIVE",
  "EPIC",
  "STORY",
  "TASK",
  "RELEASE",
]);
export type AiDescribeKind = z.infer<typeof aiDescribeKindEnum>;

const nameField = z.string().min(1).max(200);
const descField = z.string().max(4000).optional().nullable();
const optionalStatus = workStatusEnum.optional();
const optionalPriority = priorityEnum.optional();

export const childItemSchema = z.object({
  name: nameField,
  description: descField,
  status: optionalStatus,
  priority: optionalPriority,
});
export type ChildItem = z.infer<typeof childItemSchema>;

export const childrenDraftSchema = z.object({
  items: z.array(childItemSchema).min(0).max(20),
});
export type ChildrenDraft = z.infer<typeof childrenDraftSchema>;

export const descriptionDraftSchema = z.object({
  suggestion: z.string().min(1).max(4000),
});
export type DescriptionDraft = z.infer<typeof descriptionDraftSchema>;

/**
 * Hierarchy draft uses temp `ref` strings so children can reference proposed
 * parents without inventing DB ids. Every row without a parent becomes a
 * top-level item for that level.
 */
const refField = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9_-]+$/, "ref must be alphanumeric/underscore/dash");

export const productDraftSchema = z.object({
  ref: refField,
  name: nameField,
  description: descField,
});

export const initiativeDraftSchema = z.object({
  ref: refField,
  name: nameField,
  description: descField,
  typeName: z.string().max(80).optional().nullable(),
  productRefs: z.array(refField).optional().default([]),
  priority: optionalPriority,
});

export const epicDraftSchema = z
  .object({
    ref: refField,
    name: nameField,
    description: descField,
    initiativeRef: refField.optional().nullable(),
    productRef: refField.optional().nullable(),
    priority: optionalPriority,
  })
  .refine((d) => Boolean(d.initiativeRef) || Boolean(d.productRef), {
    message: "Epic must reference at least one parent (initiativeRef or productRef)",
    path: ["initiativeRef"],
  });

export const storyDraftSchema = z.object({
  ref: refField,
  name: nameField,
  description: descField,
  epicRef: refField,
  priority: optionalPriority,
});

export const hierarchyDraftSchema = z.object({
  products: z.array(productDraftSchema).max(20).optional().default([]),
  initiatives: z.array(initiativeDraftSchema).max(30).optional().default([]),
  epics: z.array(epicDraftSchema).max(60).optional().default([]),
  stories: z.array(storyDraftSchema).max(100).optional().default([]),
});
export type HierarchyDraft = z.infer<typeof hierarchyDraftSchema>;

/**
 * Shape accepted by applyHierarchyDraft. The client may re-anchor proposed
 * entities to existing entities by passing real ids via the `*ExistingId`
 * fields; when present they take precedence over the ref wiring.
 */
const applyProductSchema = z.object({
  ref: refField,
  existingId: z.string().optional().nullable(),
  name: nameField,
  description: descField,
});

const applyInitiativeSchema = z.object({
  ref: refField,
  existingId: z.string().optional().nullable(),
  name: nameField,
  description: descField,
  typeId: z.string().optional().nullable(),
  productRefs: z.array(refField).optional().default([]),
  productExistingIds: z.array(z.string()).optional().default([]),
  priority: optionalPriority,
});

const applyEpicSchema = z.object({
  ref: refField,
  name: nameField,
  description: descField,
  initiativeRef: refField.optional().nullable(),
  initiativeExistingId: z.string().optional().nullable(),
  productRef: refField.optional().nullable(),
  productExistingId: z.string().optional().nullable(),
  priority: optionalPriority,
});

const applyStorySchema = z.object({
  ref: refField,
  name: nameField,
  description: descField,
  epicRef: refField.optional().nullable(),
  epicExistingId: z.string().optional().nullable(),
  priority: optionalPriority,
});

export const applyHierarchySchema = z.object({
  products: z.array(applyProductSchema).optional().default([]),
  initiatives: z.array(applyInitiativeSchema).optional().default([]),
  epics: z.array(applyEpicSchema).optional().default([]),
  stories: z.array(applyStorySchema).optional().default([]),
});
export type ApplyHierarchyInput = z.infer<typeof applyHierarchySchema>;

export const applyChildrenSchema = z.object({
  parentKind: aiParentKindEnum,
  parentId: z.string().min(1),
  items: z.array(childItemSchema).min(1).max(20),
  childKind: aiChildKindEnum,
});
export type ApplyChildrenInput = z.infer<typeof applyChildrenSchema>;
