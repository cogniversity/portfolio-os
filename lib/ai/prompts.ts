import type { AiChildKind, AiDescribeKind, AiParentKind } from "./schemas";

const ORG_GLOSSARY = `Portfolio OS uses this work-item hierarchy:
  Portfolio -> Product -> Initiative -> Epic -> Story -> Task
Rules:
- An Initiative may span multiple Products (many-to-many via InitiativeProduct).
- An Epic may either roll up to an Initiative, or attach directly to a Product (not both required; but at least one).
- A Story always lives under an Epic. A Task lives under a Story.
- Release is a cross-cutting bucket of Epics/Stories; not part of the parent chain.

Enums:
- status: one of DRAFT | PLANNED | IN_PROGRESS | IN_REVIEW | DONE | RELEASED | CANCELLED
- priority: one of P0 | P1 | P2 | P3

You are assisting a product manager. Write concise, action-oriented names (<= 80 chars) and crisp descriptions.
Never invent or emit database ids. Use the provided schema exactly. If a field isn't known, omit it.`;

export const SYSTEM_ROLE = `You are a senior product-operations assistant embedded in Portfolio OS.\n${ORG_GLOSSARY}`;

export interface PromptPair {
  system: string;
  user: string;
}

interface HierarchyPromptInput {
  text: string;
  anchorProduct?: { id: string; name: string } | null;
  include: {
    products: boolean;
    initiatives: boolean;
    epics: boolean;
    stories: boolean;
  };
  existingProducts?: Array<{ id: string; name: string }>;
  initiativeTypes?: Array<{ name: string }>;
}

export function buildHierarchyPrompt(input: HierarchyPromptInput): PromptPair {
  const levels: string[] = [];
  if (input.include.products) levels.push("products");
  if (input.include.initiatives) levels.push("initiatives");
  if (input.include.epics) levels.push("epics");
  if (input.include.stories) levels.push("stories");

  const anchor = input.anchorProduct
    ? `The user anchored this plan to the existing product \"${input.anchorProduct.name}\". Do NOT emit a product row for it; instead, attach new initiatives to it by adding its name in productRefs using the temp ref \"__anchor__\", and feel free to create epics with productRef: \"__anchor__\" when direct-to-product.`
    : "No anchor product was selected. Emit products only if the user's prose clearly describes a new product; otherwise prefer initiatives, epics, and stories.";

  const existing =
    input.existingProducts && input.existingProducts.length
      ? `Existing products in this org (for context, don't duplicate):\n${input.existingProducts.map((p) => `- ${p.name}`).join("\n")}`
      : "";

  const types =
    input.initiativeTypes && input.initiativeTypes.length
      ? `Available initiative types: ${input.initiativeTypes.map((t) => t.name).join(", ")}. Fill typeName when it clearly matches one of these.`
      : "";

  const schemaHint = `Return STRICT JSON with this shape (omit empty arrays or unknown fields):
{
  "products":    [{ "ref": "p1", "name": "...", "description": "..." }],
  "initiatives": [{ "ref": "i1", "name": "...", "description": "...", "typeName": "...", "productRefs": ["p1" | "__anchor__"], "priority": "P0|P1|P2|P3" }],
  "epics":       [{ "ref": "e1", "name": "...", "description": "...", "initiativeRef": "i1", "productRef": "p1" | "__anchor__", "priority": "P0|P1|P2|P3" }],
  "stories":     [{ "ref": "s1", "name": "...", "description": "...", "epicRef": "e1", "priority": "P0|P1|P2|P3" }]
}
Every ref must be unique across the whole response and match [A-Za-z0-9_-]+.
Only include the levels the user asked for: ${levels.join(", ") || "stories"}.
An epic must reference at least one parent (initiativeRef or productRef).`;

  return {
    system: SYSTEM_ROLE,
    user: [
      anchor,
      existing,
      types,
      schemaHint,
      "",
      "User prose:",
      input.text.trim(),
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

interface ChildrenPromptInput {
  parentKind: AiParentKind;
  childKind: AiChildKind;
  parent: {
    name: string;
    description?: string | null;
  };
  siblings?: Array<{ name: string }>;
  count: number;
}

export function buildChildrenPrompt(input: ChildrenPromptInput): PromptPair {
  const siblingsBlock = input.siblings && input.siblings.length
    ? `Recent existing ${input.childKind.toLowerCase()}s under this parent (do not duplicate):\n${input.siblings.slice(0, 20).map((s) => `- ${s.name}`).join("\n")}`
    : `No existing ${input.childKind.toLowerCase()}s yet.`;

  const guidance = childGuidance(input.parentKind, input.childKind);

  const schemaHint = `Return STRICT JSON:
{ "items": [ { "name": "...", "description": "...", "status": "PLANNED", "priority": "P2" } ] }
Generate between 3 and ${Math.min(12, Math.max(3, input.count))} items. name is required, other fields optional.`;

  return {
    system: SYSTEM_ROLE,
    user: [
      `Parent kind: ${input.parentKind}`,
      `Target child kind: ${input.childKind}`,
      `Parent name: ${input.parent.name}`,
      input.parent.description ? `Parent description:\n${input.parent.description}` : "",
      siblingsBlock,
      guidance,
      schemaHint,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function childGuidance(parent: AiParentKind, child: AiChildKind): string {
  if (parent === "PRODUCT" && child === "INITIATIVE") {
    return "Propose initiatives that are outcome-oriented, span 1-2 quarters, and map to strategic themes for this product.";
  }
  if (parent === "PRODUCT" && child === "EPIC") {
    return "Propose direct-to-product epics: cross-cutting platform / hardening / discovery work that doesn't fit under a single initiative.";
  }
  if (parent === "INITIATIVE" && child === "EPIC") {
    return "Propose epics that break the initiative into delivery-sized chunks, each shippable in 2-6 weeks.";
  }
  if (parent === "EPIC" && child === "STORY") {
    return "Propose user stories in the form \"As a <role>, I want <capability>, so that <benefit>.\" Keep each story deliverable in <= 1 sprint.";
  }
  if (parent === "STORY" && child === "TASK") {
    return "Propose implementation tasks: small, concrete engineering / design / QA steps needed to ship this story.";
  }
  return "Propose items appropriate for the target child kind.";
}

interface DescribePromptInput {
  kind: AiDescribeKind;
  name: string;
  currentDescription?: string | null;
}

export function buildDescribePrompt(input: DescribePromptInput): PromptPair {
  const user = [
    `You are improving the description of a ${input.kind.toLowerCase()} titled \"${input.name}\".`,
    input.currentDescription && input.currentDescription.trim()
      ? `Current description (preserve intent, improve clarity/structure):\n${input.currentDescription.trim()}`
      : `No description yet. Write a new one grounded in the title.`,
    `Guidelines:
- 80-300 words, markdown allowed.
- Start with a one-sentence summary.
- Then bullet points for: outcomes, scope (in/out), success signals.
- Do not invent stakeholders, dates, or metrics that weren't implied.
- No headings deeper than H3.`,
    `Return STRICT JSON: { "suggestion": "<the improved description as markdown>" }`,
  ].join("\n\n");

  return { system: SYSTEM_ROLE, user };
}
