import { PrismaClient, type CustomFieldKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type FieldSpec = {
  key: string;
  label: string;
  kind: CustomFieldKind;
  required?: boolean;
  options?: { values?: string[] };
};

const BUILT_IN_TYPES: Array<{
  key: string;
  name: string;
  color: string;
  fields: FieldSpec[];
}> = [
  {
    key: "customization",
    name: "Customization",
    color: "#f97316",
    fields: [
      { key: "customer", label: "Customer", kind: "TEXT", required: true },
      { key: "base_product", label: "Base product", kind: "TEXT" },
      { key: "scope_summary", label: "Scope summary", kind: "TEXTAREA" },
      { key: "customer_link", label: "Customer link", kind: "CUSTOMER_LINK" },
    ],
  },
  {
    key: "variant",
    name: "Variant",
    color: "#8b5cf6",
    fields: [
      { key: "base_product", label: "Base product", kind: "TEXT", required: true },
      { key: "variant_details", label: "Variant details", kind: "TEXTAREA" },
      { key: "target_segment", label: "Target segment", kind: "TEXT" },
    ],
  },
  {
    key: "demo",
    name: "Demo",
    color: "#ec4899",
    fields: [
      { key: "customer", label: "Customer", kind: "TEXT", required: true },
      { key: "demo_date", label: "Demo date", kind: "DATE", required: true },
      { key: "location", label: "Location", kind: "TEXT" },
    ],
  },
  {
    key: "event",
    name: "Event",
    color: "#eab308",
    fields: [
      { key: "event_name", label: "Event name", kind: "TEXT", required: true },
      { key: "start_date", label: "Start date", kind: "DATE", required: true },
      { key: "end_date", label: "End date", kind: "DATE" },
      { key: "location", label: "Location", kind: "TEXT" },
    ],
  },
  {
    key: "pov",
    name: "PoV",
    color: "#06b6d4",
    fields: [
      { key: "customer", label: "Customer", kind: "TEXT", required: true },
      { key: "start_date", label: "Start date", kind: "DATE" },
      { key: "end_date", label: "End date", kind: "DATE" },
      { key: "success_criteria", label: "Success criteria", kind: "TEXTAREA" },
    ],
  },
  {
    key: "other",
    name: "Other",
    color: "#6366f1",
    fields: [{ key: "notes", label: "Notes", kind: "TEXTAREA" }],
  },
];

async function seedTypes() {
  for (const t of BUILT_IN_TYPES) {
    const existing = await prisma.initiativeType.findUnique({ where: { key: t.key } });
    if (existing) {
      await prisma.initiativeType.update({
        where: { id: existing.id },
        data: { name: t.name, color: t.color, isBuiltIn: true },
      });
      for (let i = 0; i < t.fields.length; i++) {
        const f = t.fields[i];
        await prisma.customFieldDefinition.upsert({
          where: { typeId_key: { typeId: existing.id, key: f.key } },
          update: {
            label: f.label,
            kind: f.kind,
            required: f.required ?? false,
            orderIndex: i,
            options: f.options ?? undefined,
          },
          create: {
            typeId: existing.id,
            key: f.key,
            label: f.label,
            kind: f.kind,
            required: f.required ?? false,
            orderIndex: i,
            options: f.options ?? undefined,
          },
        });
      }
      continue;
    }
    await prisma.initiativeType.create({
      data: {
        key: t.key,
        name: t.name,
        color: t.color,
        isBuiltIn: true,
        fields: {
          create: t.fields.map((f, i) => ({
            key: f.key,
            label: f.label,
            kind: f.kind,
            required: f.required ?? false,
            orderIndex: i,
            options: f.options ?? undefined,
          })),
        },
      },
    });
  }
}

async function seedUsers() {
  const users = [
    { email: "leader@example.com", name: "Lena Leader", role: "LEADER" },
    { email: "leader2@example.com", name: "Leo Leader", role: "LEADER" },
    { email: "pm@example.com", name: "Priya PM", role: "PRODUCT_MANAGER" },
    { email: "pm2@example.com", name: "Paul PM", role: "PRODUCT_MANAGER" },
    { email: "pm3@example.com", name: "Pat PM", role: "PRODUCT_MANAGER" },
    { email: "team@example.com", name: "Tia Team", role: "TEAM_MEMBER" },
    { email: "team2@example.com", name: "Tom Team", role: "TEAM_MEMBER" },
    { email: "team3@example.com", name: "Tara Team", role: "TEAM_MEMBER" },
    { email: "team4@example.com", name: "Theo Team", role: "TEAM_MEMBER" },
  ] as const;

  const pwHash = await bcrypt.hash("password123", 10);
  const platformTeam = await prisma.team.upsert({
    where: { name: "Platform" },
    update: {},
    create: { name: "Platform" },
  });
  const appTeam = await prisma.team.upsert({
    where: { name: "Apps" },
    update: {},
    create: { name: "Apps" },
  });

  const created: Record<string, { id: string; email: string; name: string }> = {};
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash: pwHash },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: u.role } },
      update: {},
      create: { userId: user.id, role: u.role },
    });
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: { fullName: u.name },
      create: {
        userId: user.id,
        fullName: u.name,
        teamId: i % 2 === 0 ? platformTeam.id : appTeam.id,
      },
    });
    created[u.email] = { id: user.id, email: user.email, name: user.name ?? u.name };
  }
  return created;
}

async function resetWorkData() {
  await prisma.activityLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.releaseStory.deleteMany({});
  await prisma.releaseEpic.deleteMany({});
  await prisma.release.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.story.deleteMany({});
  await prisma.epic.deleteMany({});
  await prisma.customFieldValue.deleteMany({});
  await prisma.initiativeProduct.deleteMany({});
  await prisma.initiative.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.portfolio.deleteMany({});
}

function daysFrom(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function seedWork(
  users: Record<string, { id: string; email: string; name: string }>,
) {
  const pm = users["pm@example.com"];
  const pm2 = users["pm2@example.com"];
  const pm3 = users["pm3@example.com"];
  const t1 = users["team@example.com"];
  const t2 = users["team2@example.com"];
  const t3 = users["team3@example.com"];
  const t4 = users["team4@example.com"];

  const types = await prisma.initiativeType.findMany();
  const typeByKey = new Map(types.map((t) => [t.key, t] as const));

  const platform = await prisma.portfolio.create({
    data: {
      name: "Platform",
      description: "Core platform capabilities",
      ownerId: pm.id,
      status: "IN_PROGRESS",
      priority: "P1",
      startDate: daysFrom(-120),
      targetDate: daysFrom(240),
    },
  });
  const apps = await prisma.portfolio.create({
    data: {
      name: "Customer apps",
      description: "End-user products",
      ownerId: pm2.id,
      status: "IN_PROGRESS",
      priority: "P1",
      startDate: daysFrom(-60),
      targetDate: daysFrom(300),
    },
  });

  const prodA = await prisma.product.create({
    data: {
      portfolioId: platform.id,
      name: "Orbit Core",
      description: "Internal platform services",
      color: "#6366f1",
      ownerId: pm.id,
      status: "IN_PROGRESS",
      priority: "P1",
      startDate: daysFrom(-100),
      targetDate: daysFrom(180),
    },
  });
  const prodB = await prisma.product.create({
    data: {
      portfolioId: platform.id,
      name: "Orbit Data",
      description: "Data services and analytics",
      color: "#10b981",
      ownerId: pm.id,
      status: "PLANNED",
      priority: "P2",
      startDate: daysFrom(-30),
      targetDate: daysFrom(210),
    },
  });
  const prodC = await prisma.product.create({
    data: {
      portfolioId: apps.id,
      name: "Atlas Web",
      description: "Flagship SaaS web app",
      color: "#ec4899",
      ownerId: pm2.id,
      status: "IN_PROGRESS",
      priority: "P0",
      startDate: daysFrom(-90),
      targetDate: daysFrom(200),
    },
  });
  const prodD = await prisma.product.create({
    data: {
      portfolioId: apps.id,
      name: "Atlas Mobile",
      description: "Mobile companion app",
      color: "#f97316",
      ownerId: pm3.id,
      status: "PLANNED",
      priority: "P2",
      startDate: daysFrom(-20),
      targetDate: daysFrom(260),
    },
  });
  const products = [prodA, prodB, prodC, prodD];

  type InitSpec = {
    name: string;
    typeKey: string;
    status: "PLANNED" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "DRAFT";
    priority: "P0" | "P1" | "P2" | "P3";
    ownerId: string;
    productIds: string[];
    startDelta: number;
    endDelta: number;
    fields?: Record<string, unknown>;
  };

  const initSpecs: InitSpec[] = [
    {
      name: "Authentication overhaul",
      typeKey: "other",
      status: "IN_PROGRESS",
      priority: "P0",
      ownerId: pm.id,
      productIds: [prodA.id],
      startDelta: -60,
      endDelta: 45,
      fields: { notes: "Unify SSO across all Orbit products." },
    },
    {
      name: "Realtime sync engine",
      typeKey: "other",
      status: "PLANNED",
      priority: "P1",
      ownerId: pm.id,
      productIds: [prodA.id, prodB.id],
      startDelta: 30,
      endDelta: 180,
    },
    {
      name: "Enterprise data residency",
      typeKey: "customization",
      status: "IN_PROGRESS",
      priority: "P0",
      ownerId: pm2.id,
      productIds: [prodB.id, prodC.id],
      startDelta: -30,
      endDelta: 90,
      fields: {
        customer: "Acme Corp",
        base_product: "Orbit Data",
        scope_summary: "Region-pinned storage and key management.",
      },
    },
    {
      name: "Atlas Web EU variant",
      typeKey: "variant",
      status: "PLANNED",
      priority: "P1",
      ownerId: pm2.id,
      productIds: [prodC.id],
      startDelta: 15,
      endDelta: 150,
      fields: {
        base_product: "Atlas Web",
        variant_details: "GDPR-ready edition with locale packs.",
        target_segment: "EU mid-market",
      },
    },
    {
      name: "Atlas Mobile launch",
      typeKey: "other",
      status: "PLANNED",
      priority: "P0",
      ownerId: pm3.id,
      productIds: [prodD.id],
      startDelta: 0,
      endDelta: 240,
    },
    {
      name: "Q2 product demo",
      typeKey: "demo",
      status: "PLANNED",
      priority: "P2",
      ownerId: pm.id,
      productIds: [prodA.id, prodC.id],
      startDelta: 10,
      endDelta: 20,
      fields: {
        customer: "Initech",
        demo_date: daysFrom(18).toISOString().slice(0, 10),
        location: "Virtual",
      },
    },
    {
      name: "DevCon keynote",
      typeKey: "event",
      status: "PLANNED",
      priority: "P1",
      ownerId: pm2.id,
      productIds: [prodA.id, prodB.id, prodC.id, prodD.id],
      startDelta: 55,
      endDelta: 58,
      fields: {
        event_name: "DevCon 2026",
        start_date: daysFrom(55).toISOString().slice(0, 10),
        end_date: daysFrom(58).toISOString().slice(0, 10),
        location: "Berlin",
      },
    },
    {
      name: "Globex PoV",
      typeKey: "pov",
      status: "IN_PROGRESS",
      priority: "P1",
      ownerId: pm3.id,
      productIds: [prodC.id],
      startDelta: -14,
      endDelta: 42,
      fields: {
        customer: "Globex",
        start_date: daysFrom(-14).toISOString().slice(0, 10),
        end_date: daysFrom(42).toISOString().slice(0, 10),
        success_criteria: "Ingest 10M events/day with p95 < 200ms.",
      },
    },
    {
      name: "Umbrella onboarding PoV",
      typeKey: "pov",
      status: "PLANNED",
      priority: "P2",
      ownerId: pm2.id,
      productIds: [prodC.id, prodD.id],
      startDelta: 30,
      endDelta: 90,
      fields: {
        customer: "Umbrella",
        start_date: daysFrom(30).toISOString().slice(0, 10),
        end_date: daysFrom(90).toISOString().slice(0, 10),
        success_criteria: "Validate multi-region replication.",
      },
    },
    {
      name: "Observability platform",
      typeKey: "other",
      status: "PLANNED",
      priority: "P1",
      ownerId: pm.id,
      productIds: [prodA.id, prodB.id],
      startDelta: 20,
      endDelta: 160,
    },
    {
      name: "Billing revamp",
      typeKey: "other",
      status: "DONE",
      priority: "P1",
      ownerId: pm2.id,
      productIds: [prodC.id],
      startDelta: -180,
      endDelta: -10,
    },
    {
      name: "Mobile offline mode",
      typeKey: "variant",
      status: "PLANNED",
      priority: "P2",
      ownerId: pm3.id,
      productIds: [prodD.id],
      startDelta: 60,
      endDelta: 210,
      fields: {
        base_product: "Atlas Mobile",
        variant_details: "Offline-first sync via CRDTs.",
        target_segment: "Field ops",
      },
    },
  ];

  const createdInits: Array<{ id: string; name: string; productIds: string[] }> = [];

  for (const spec of initSpecs) {
    const type = typeByKey.get(spec.typeKey)!;
    const init = await prisma.initiative.create({
      data: {
        name: spec.name,
        typeId: type.id,
        ownerId: spec.ownerId,
        status: spec.status,
        priority: spec.priority,
        startDate: daysFrom(spec.startDelta),
        targetDate: daysFrom(spec.endDelta),
        products: {
          create: spec.productIds.map((pid) => ({ productId: pid })),
        },
      },
    });

    if (spec.fields) {
      const defs = await prisma.customFieldDefinition.findMany({
        where: { typeId: type.id },
      });
      for (const def of defs) {
        const raw = spec.fields[def.key];
        if (raw === undefined) continue;
        await prisma.customFieldValue.create({
          data: {
            initiativeId: init.id,
            definitionId: def.id,
            value: raw as any,
          },
        });
      }
    }

    createdInits.push({
      id: init.id,
      name: init.name,
      productIds: spec.productIds,
    });
  }

  const teamPool = [t1, t2, t3, t4];

  for (let i = 0; i < createdInits.length; i++) {
    const init = createdInits[i];
    const numEpics = 2 + (i % 2);
    for (let e = 0; e < numEpics; e++) {
      const epic = await prisma.epic.create({
        data: {
          initiativeId: init.id,
          name: `${init.name} · Epic ${e + 1}`,
          ownerId: [pm, pm2, pm3][e % 3].id,
          status: e === 0 ? "IN_PROGRESS" : "PLANNED",
          priority: "P1",
          startDate: daysFrom(-20 + e * 15),
          targetDate: daysFrom(30 + e * 25),
          orderIndex: e,
        },
      });

      const numStories = 2 + (e % 2);
      for (let s = 0; s < numStories; s++) {
        const assignee = teamPool[(i + e + s) % teamPool.length];
        const story = await prisma.story.create({
          data: {
            epicId: epic.id,
            name: `Story ${s + 1} in ${epic.name}`,
            ownerId: epic.ownerId,
            assigneeId: assignee.id,
            status:
              s === 0 && e === 0
                ? "IN_PROGRESS"
                : s === 1
                  ? "IN_REVIEW"
                  : "PLANNED",
            priority: s % 2 === 0 ? "P1" : "P2",
            startDate: daysFrom(-10 + e * 10 + s * 3),
            targetDate: daysFrom(15 + e * 20 + s * 5),
            orderIndex: s,
          },
        });

        const numTasks = 2;
        for (let tk = 0; tk < numTasks; tk++) {
          await prisma.task.create({
            data: {
              storyId: story.id,
              name: `Task ${tk + 1}`,
              ownerId: assignee.id,
              assigneeId: teamPool[(tk + s) % teamPool.length].id,
              status: tk === 0 ? "IN_PROGRESS" : "PLANNED",
              priority: "P2",
              orderIndex: tk,
            },
          });
        }
      }
    }
  }

  await prisma.epic.create({
    data: {
      productId: prodC.id,
      initiativeId: null,
      name: `${prodC.name} · Platform hardening`,
      description:
        "Cross-cutting product-direct epic not tied to any strategic initiative.",
      ownerId: pm2.id,
      status: "IN_PROGRESS",
      priority: "P1",
      startDate: daysFrom(-10),
      targetDate: daysFrom(45),
      orderIndex: 0,
    },
  });

  const prodRels: Record<string, string[]> = {};
  for (const p of products) {
    const rels = [
      {
        name: `${p.name} 1.0`,
        version: "1.0",
        status: "RELEASED" as const,
        plannedDate: daysFrom(-90),
        actualDate: daysFrom(-80),
      },
      {
        name: `${p.name} 1.1`,
        version: "1.1",
        status: "IN_DEVELOPMENT" as const,
        plannedDate: daysFrom(20),
      },
      {
        name: `${p.name} 2.0`,
        version: "2.0",
        status: "PLANNED" as const,
        plannedDate: daysFrom(120),
      },
    ];
    prodRels[p.id] = [];
    for (const r of rels) {
      const rel = await prisma.release.create({
        data: {
          productId: p.id,
          ...r,
        },
      });
      prodRels[p.id].push(rel.id);
    }
  }

  const allEpics = await prisma.epic.findMany({
    include: { initiative: { include: { products: true } } },
  });
  for (const epic of allEpics) {
    const productId =
      epic.productId ?? epic.initiative?.products[0]?.productId ?? null;
    if (!productId) continue;
    const rels = prodRels[productId] ?? [];
    if (rels.length < 2) continue;
    const targetRelId = rels[1];
    try {
      await prisma.releaseEpic.create({
        data: { releaseId: targetRelId, epicId: epic.id },
      });
    } catch {
      // ignore duplicates
    }
  }

  const pickPm = pm;
  await prisma.comment.create({
    data: {
      itemType: "INITIATIVE",
      itemId: createdInits[0].id,
      authorId: pickPm.id,
      body: "Kicking this off. @tia please start scoping the auth flows.",
      mentions: ["tia"],
    },
  });
  await prisma.activityLog.create({
    data: {
      itemType: "INITIATIVE",
      itemId: createdInits[0].id,
      actorId: pickPm.id,
      kind: "CREATED",
      summary: `Seeded initiative "${createdInits[0].name}"`,
    },
  });
}

async function main() {
  console.log("→ Seeding initiative types");
  await seedTypes();
  console.log("→ Seeding users, teams, roles");
  const users = await seedUsers();
  console.log("→ Resetting work data");
  await resetWorkData();
  console.log("→ Seeding portfolios, products, initiatives, epics, stories, tasks, releases");
  await seedWork(users);
  console.log("✔ Seed complete. Login: pm@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
