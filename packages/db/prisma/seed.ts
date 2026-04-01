import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date("2026-04-01T12:00:00.000Z");

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42_2026);

function int(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[int(0, arr.length - 1)] as T;
}

function chance(p: number) {
  return rand() < p;
}

function daysAgo(days: number) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, "").toLowerCase() || "/";
}

const users = [
  { id: "usr_alex", email: "alex@aurora-app.com", fullName: "Alex Rivera" },
  { id: "usr_priya", email: "priya@northstar.agency", fullName: "Priya Shah" },
  { id: "usr_maya", email: "maya@aurora-app.com", fullName: "Maya Chen" },
  { id: "usr_noah", email: "noah@aurora-app.com", fullName: "Noah Davis" },
  { id: "usr_liam", email: "liam@northstar.agency", fullName: "Liam Brooks" },
  { id: "usr_zoe", email: "zoe@northstaroutdoor.com", fullName: "Zoe Bennett" },
  {
    id: "usr_omar",
    email: "omar@northstaroutdoor.com",
    fullName: "Omar Hassan"
  },
  { id: "usr_ivy", email: "ivy@aurora-app.com", fullName: "Ivy Tran" }
] as const;

const workspaces = [
  {
    id: "ws_aurora",
    name: "Aurora Growth Team",
    slug: "aurora-growth",
    ownerUserId: "usr_alex",
    planTier: "pro" as const,
    region: "us",
    status: "active" as const
  },
  {
    id: "ws_northstar",
    name: "Northstar Agency Portfolio",
    slug: "northstar-portfolio",
    ownerUserId: "usr_priya",
    planTier: "growth" as const,
    region: "us",
    status: "active" as const
  }
] as const;

const properties = [
  {
    id: "prop_aurora_main",
    workspaceId: "ws_aurora",
    name: "Aurora App Marketing",
    primaryDomain: "www.aurora-app.com",
    environment: "prod" as const,
    businessModel: "trial" as const,
    status: "active" as const
  },
  {
    id: "prop_aurora_docs",
    workspaceId: "ws_aurora",
    name: "Aurora Help Center",
    primaryDomain: "help.aurora-app.com",
    environment: "prod" as const,
    businessModel: "hybrid" as const,
    status: "active" as const
  },
  {
    id: "prop_northstar",
    workspaceId: "ws_northstar",
    name: "Northstar Outdoor",
    primaryDomain: "www.northstar-outdoor.com",
    environment: "prod" as const,
    businessModel: "ecommerce_like" as const,
    status: "active" as const
  }
] as const;

const pageCountsByProperty: Record<string, number> = {
  prop_aurora_main: 80,
  prop_aurora_docs: 60,
  prop_northstar: 60
};

const templateDefs = [
  { key: "home", name: "Homepage", family: "marketing", active: true },
  {
    key: "landing",
    name: "Campaign Landing",
    family: "marketing",
    active: true
  },
  { key: "feature", name: "Feature Detail", family: "product", active: true },
  { key: "blog", name: "Blog Article", family: "content", active: true },
  { key: "docs", name: "Docs Article", family: "docs", active: true },
  { key: "legal", name: "Legal Page", family: "compliance", active: false }
] as const;

const pageGroupDefs = [
  { key: "growth", name: "Growth Funnel", type: "funnel" as const },
  { key: "seo", name: "SEO Priority", type: "priority" as const },
  { key: "product", name: "Product Surface", type: "business_line" as const },
  { key: "content", name: "Content Library", type: "structural" as const },
  { key: "ownership", name: "Owned By Demand Gen", type: "owner" as const }
] as const;

const topicWords = [
  "analytics",
  "attribution",
  "tracking",
  "seo",
  "conversion",
  "performance",
  "governance",
  "experiments",
  "schema",
  "crawl",
  "indexing",
  "intent",
  "pipeline",
  "revenue",
  "engagement",
  "activation",
  "retention",
  "velocity",
  "content",
  "ops"
];

const recommendationStatuses = [
  "new",
  "triaged",
  "accepted",
  "in_progress",
  "awaiting_validation",
  "validated",
  "blocked",
  "archived"
] as const;

const reportStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "sent"
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("Dry run enabled. No writes will be performed.");
    return;
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs",
      "alerts",
      "reports",
      "recommendations",
      "experiments",
      "release_events",
      "conversion_definition_versions",
      "conversion_definitions",
      "query_metric_daily",
      "page_metric_daily",
      "page_state_snapshots",
      "localization_variants",
      "url_records",
      "canonical_pages",
      "templates",
      "page_groups",
      "measurement_annotations",
      "comparability_windows",
      "data_source_health",
      "integration_connections",
      "property_settings",
      "properties",
      "workspace_invites",
      "password_reset_tokens",
      "auth_sessions",
      "workspace_memberships",
      "external_identity_links",
      "identity_providers",
      "workspaces",
      "users"
    CASCADE;
  `);

  await prisma.user.createMany({
    data: users.map((u) => ({ ...u, status: "active" }))
  });
  await prisma.workspace.createMany({ data: workspaces });

  await prisma.workspaceMembership.createMany({
    data: [
      {
        id: "m_aurora_owner",
        workspaceId: "ws_aurora",
        userId: "usr_alex",
        role: "owner"
      },
      {
        id: "m_aurora_admin",
        workspaceId: "ws_aurora",
        userId: "usr_maya",
        role: "admin"
      },
      {
        id: "m_aurora_analyst",
        workspaceId: "ws_aurora",
        userId: "usr_noah",
        role: "analyst"
      },
      {
        id: "m_aurora_manager",
        workspaceId: "ws_aurora",
        userId: "usr_ivy",
        role: "manager"
      },
      {
        id: "m_north_owner",
        workspaceId: "ws_northstar",
        userId: "usr_priya",
        role: "owner"
      },
      {
        id: "m_north_admin",
        workspaceId: "ws_northstar",
        userId: "usr_liam",
        role: "admin"
      },
      {
        id: "m_north_client",
        workspaceId: "ws_northstar",
        userId: "usr_zoe",
        role: "client_viewer"
      },
      {
        id: "m_north_analyst",
        workspaceId: "ws_northstar",
        userId: "usr_omar",
        role: "analyst"
      }
    ]
  });

  await prisma.property.createMany({ data: properties });

  for (const property of properties) {
    await prisma.propertySetting.create({
      data: {
        id: `ps_${property.id}`,
        propertyId: property.id,
        includeRulesJson: { host: property.primaryDomain },
        taxonomySettingsJson: { version: 1, tags: ["seo", "cro", "content"] },
        benchmarkSettingsJson: { windowDays: 28, compare: "previous_period" },
        alertSettingsJson: { emailDigest: "weekly", slack: true },
        trustPolicyJson: { requireDualSource: true, minimumCoverage: 0.85 }
      }
    });
  }

  const templateIdsByProperty: Record<string, string[]> = {};
  const groupIdsByProperty: Record<string, string[]> = {};

  for (const property of properties) {
    templateIdsByProperty[property.id] = [];
    groupIdsByProperty[property.id] = [];

    for (const t of templateDefs) {
      const id = `tpl_${property.id}_${t.key}`;
      templateIdsByProperty[property.id].push(id);
      await prisma.template.create({
        data: {
          id,
          propertyId: property.id,
          name: t.name,
          templateFamily: t.family,
          description: `${t.name} for ${property.name}`,
          active: t.active
        }
      });
    }

    for (const g of pageGroupDefs) {
      const id = `pg_${property.id}_${g.key}`;
      groupIdsByProperty[property.id].push(id);
      await prisma.pageGroup.create({
        data: {
          id,
          propertyId: property.id,
          name: g.name,
          groupType: g.type,
          description: `${g.name} segment for ${property.name}`
        }
      });
    }
  }

  const pages: Array<{
    id: string;
    propertyId: string;
    canonicalUrl: string;
    normalizedUrlKey: string;
    templateId: string | null;
    pageGroupId: string | null;
    ownerUserId: string | null;
  }> = [];

  for (const property of properties) {
    const pageCount = pageCountsByProperty[property.id];
    const templateIds = templateIdsByProperty[property.id] ?? [];
    const groupIds = groupIdsByProperty[property.id] ?? [];

    for (let i = 1; i <= pageCount; i += 1) {
      const templateId = chance(0.9) ? pick(templateIds) : null;
      const pageGroupId = chance(0.85) ? pick(groupIds) : null;

      let path = "/";
      if (!templateId || templateId.endsWith("home")) {
        path = i === 1 ? "/" : `/overview/${i}`;
      } else if (templateId.includes("landing")) {
        path = `/lp/${pick(topicWords)}-${pick(topicWords)}-${i}`;
      } else if (templateId.includes("feature")) {
        path = `/features/${pick(topicWords)}-${i}`;
      } else if (templateId.includes("blog")) {
        path = `/blog/${pick(topicWords)}-${pick(topicWords)}-${i}`;
      } else if (templateId.includes("docs")) {
        path = `/docs/${pick(topicWords)}/${pick(topicWords)}-${i}`;
      } else {
        path = `/legal/${pick(["privacy", "terms", "security", "compliance"])}-${i}`;
      }

      const normalizedUrlKey = normalizePath(path);
      const canonicalUrl = `https://${property.primaryDomain}${normalizedUrlKey}`;
      const pageId = `pgc_${property.id}_${i.toString().padStart(3, "0")}`;

      const ownerByWorkspace =
        property.workspaceId === "ws_aurora"
          ? pick(["usr_alex", "usr_maya", "usr_noah", "usr_ivy"])
          : pick(["usr_priya", "usr_liam", "usr_zoe", "usr_omar"]);

      pages.push({
        id: pageId,
        propertyId: property.id,
        canonicalUrl,
        normalizedUrlKey,
        templateId,
        pageGroupId,
        ownerUserId: chance(0.75) ? ownerByWorkspace : null
      });
    }
  }

  await prisma.canonicalPage.createMany({
    data: pages.map((p, i) => ({
      id: p.id,
      propertyId: p.propertyId,
      canonicalUrl: p.canonicalUrl,
      normalizedUrlKey: p.normalizedUrlKey,
      title: `Page ${i + 1} - ${p.normalizedUrlKey}`,
      h1: `${p.normalizedUrlKey.replaceAll("/", " ").trim() || "Home"}`,
      templateId: p.templateId,
      pageGroupId: p.pageGroupId,
      ownerUserId: p.ownerUserId,
      pageArchetype: pick([
        "pillar",
        "support",
        "landing",
        "experiment",
        "evergreen"
      ]),
      contentType: pick([
        "commercial",
        "educational",
        "navigational",
        "transactional"
      ]),
      funnelStage: pick([
        "awareness",
        "consideration",
        "decision",
        "retention"
      ]),
      ownerTeam: pick(["demand-gen", "seo", "content", "product-marketing"]),
      languageCode: pick(["en", "en", "en", "es", "fr"]),
      regionCode: pick(["US", "US", "CA", "GB"]),
      indexabilityStatus: pick([
        "indexable",
        "indexable",
        "indexable",
        "noindex",
        "unknown"
      ]),
      priorityTier: pick(["p0", "p1", "p1", "p2", "p2", "p3"]),
      status: pick([
        "active",
        "active",
        "active",
        "active",
        "retired",
        "redirected",
        "draft_like"
      ]),
      firstSeenAt: daysAgo(int(45, 420)),
      lastSeenAt: daysAgo(int(0, 8))
    }))
  });

  const urlRecords = pages.map((p) => ({
    id: `url_${p.id}`,
    propertyId: p.propertyId,
    canonicalPageId: p.id,
    rawUrl: p.canonicalUrl,
    normalizedUrlKey: p.normalizedUrlKey,
    isCurrentAlias: true,
    firstSeenAt: daysAgo(int(45, 420)),
    lastSeenAt: daysAgo(int(0, 8)),
    source: pick(["sitemap", "crawler", "cms"])
  }));

  const legacyAliases = pages
    .filter(() => chance(0.2))
    .map((p) => ({
      id: `url_legacy_${p.id}`,
      propertyId: p.propertyId,
      canonicalPageId: p.id,
      rawUrl: `${p.canonicalUrl}-legacy`,
      normalizedUrlKey: `${p.normalizedUrlKey}-legacy`,
      isCurrentAlias: false,
      firstSeenAt: daysAgo(int(380, 540)),
      lastSeenAt: daysAgo(int(60, 200)),
      source: "migration"
    }));

  await prisma.urlRecord.createMany({
    data: [...urlRecords, ...legacyAliases]
  });

  const localizationRows = pages
    .filter(() => chance(0.3))
    .map((p, idx) => ({
      id: `loc_${idx.toString().padStart(3, "0")}_${p.id}`,
      canonicalPageId: p.id,
      localeCode: pick(["en-US", "en-GB", "es-ES", "fr-CA"]),
      regionCode: pick(["US", "GB", "ES", "CA", null]),
      urlRecordId: `url_${p.id}`,
      isPrimary: chance(0.35)
    }));

  if (localizationRows.length > 0) {
    await prisma.localizationVariant.createMany({ data: localizationRows });
  }

  const recommendationRows = Array.from({ length: 72 }, (_, i) => {
    const property = pick(properties);
    const propertyPages = pages.filter((p) => p.propertyId === property.id);
    const targetPage = pick(propertyPages);
    const status = recommendationStatuses[i % recommendationStatuses.length] as
      | "new"
      | "triaged"
      | "accepted"
      | "in_progress"
      | "awaiting_validation"
      | "validated"
      | "blocked"
      | "archived";

    const scopeType = pick([
      "property",
      "page",
      "template",
      "page_group"
    ] as const);

    let relatedScopeId = property.id;
    if (scopeType === "page") relatedScopeId = targetPage.id;
    if (scopeType === "template")
      relatedScopeId = pick(templateIdsByProperty[property.id] ?? []);
    if (scopeType === "page_group")
      relatedScopeId = pick(groupIdsByProperty[property.id] ?? []);

    const ownerUserId =
      property.workspaceId === "ws_aurora"
        ? pick(["usr_alex", "usr_maya", "usr_noah", "usr_ivy"])
        : pick(["usr_priya", "usr_liam", "usr_zoe", "usr_omar"]);

    return {
      id: `rec_${(i + 1).toString().padStart(3, "0")}`,
      propertyId: property.id,
      recommendationType: pick([
        "fix",
        "improve",
        "test",
        "refresh",
        "consolidate",
        "investigate",
        "monitor",
        "validate"
      ] as const),
      domain: pick([
        "seo",
        "cro",
        "content",
        "technical",
        "trust",
        "reporting"
      ] as const),
      relatedScopeType: scopeType,
      relatedScopeId,
      title: `Improve ${pick(["title tags", "internal linking", "CTA clarity", "schema coverage", "page speed", "tracking consistency"])} on ${targetPage.normalizedUrlKey}`,
      summary: `Opportunity identified from weekly trend analysis for ${property.name}.`,
      whyItMatters:
        "This issue impacts discoverability, conversion quality, or reporting confidence.",
      suggestedAction:
        "Implement the fix behind a measurable rollout and validate with weekly trend checks.",
      impactScore: Number((rand() * 100).toFixed(2)),
      actionabilityScore: Number((30 + rand() * 70).toFixed(2)),
      trustScore: Number((0.4 + rand() * 0.6).toFixed(4)),
      confidenceScore: Number((0.35 + rand() * 0.65).toFixed(4)),
      severity: pick(["low", "medium", "medium", "high", "critical"] as const),
      estimatedEffort: pick(["xs", "s", "m", "l"] as const),
      expectedTimeToImpactDays: int(7, 45),
      reversibilityRisk: pick(["low", "medium", "high"] as const),
      dependencyFlagsJson: {
        requiresEngineering: chance(0.55),
        requiresContent: chance(0.45)
      },
      status,
      archivedAt: status === "archived" ? daysAgo(int(3, 90)) : null,
      ownerTeam: pick(["seo", "growth", "web", "analytics"]),
      ownerUserId,
      dueDate: addDays(NOW, int(-14, 35)),
      linkedTicketRef: `WEB-${int(1000, 3200)}`,
      approvalState: pick(["none", "pending", "approved", "rejected"] as const),
      implementationVerificationState: pick([
        "not_started",
        "pending",
        "passed",
        "failed"
      ] as const),
      generatedAt: daysAgo(int(1, 60)),
      createdAt: daysAgo(int(1, 60)),
      updatedAt: daysAgo(int(0, 20))
    };
  });

  await prisma.recommendation.createMany({ data: recommendationRows });

  const alertRows = Array.from({ length: 42 }, (_, i) => {
    const property = pick(properties);
    const propertyPages = pages.filter((p) => p.propertyId === property.id);
    const targetPage = pick(propertyPages);
    const status = pick([
      "open",
      "acknowledged",
      "resolved",
      "suppressed"
    ] as const);
    const triggeredAt = daysAgo(int(0, 35));

    return {
      id: `alr_${(i + 1).toString().padStart(3, "0")}`,
      propertyId: property.id,
      alertType: pick([
        "traffic_anomaly",
        "conversion_anomaly",
        "ranking_drop",
        "indexing_issue",
        "page_speed_regression",
        "tracking_failure",
        "content_change",
        "release_regression"
      ] as const),
      relatedScopeType: pick([
        "property",
        "page",
        "template",
        "page_group"
      ] as const),
      relatedScopeId: targetPage.id,
      severity: pick(["info", "warning", "critical"] as const),
      title: `Anomaly on ${targetPage.normalizedUrlKey}`,
      message: `Detected statistically significant deviation for ${targetPage.normalizedUrlKey}.`,
      evidenceJson: {
        baseline: Number((rand() * 1000).toFixed(2)),
        current: Number((rand() * 1000).toFixed(2)),
        zScore: Number((1 + rand() * 5).toFixed(2))
      },
      confidenceScore: Number((0.4 + rand() * 0.6).toFixed(4)),
      dedupeKey:
        status === "open" || status === "acknowledged"
          ? `active:${property.id}:${i}`
          : `hist:${property.id}:${i}`,
      status,
      triggeredAt,
      resolvedAt: status === "resolved" ? addDays(triggeredAt, int(1, 6)) : null
    };
  });

  await prisma.alert.createMany({ data: alertRows });

  const releaseRows = Array.from({ length: 28 }, (_, i) => {
    const property = pick(properties);
    const propertyPages = pages.filter((p) => p.propertyId === property.id);
    const targetPage = pick(propertyPages);
    const startedAt = daysAgo(int(0, 70));

    return {
      id: `rel_${(i + 1).toString().padStart(3, "0")}`,
      propertyId: property.id,
      eventType: pick([
        "deploy",
        "cms_publish",
        "campaign_launch",
        "tracking_change",
        "migration",
        "manual"
      ] as const),
      title: `${pick(["Deploy", "CMS Publish", "Tracking Update", "Template Rollout"])} - ${targetPage.normalizedUrlKey}`,
      description:
        "Release correlated with observable movement in search and conversion metrics.",
      relatedScopeType: pick([
        "property",
        "page",
        "template",
        "page_group"
      ] as const),
      relatedScopeId: targetPage.id,
      source: pick(["github-actions", "cms", "manual", "release-bot"]),
      startedAt,
      endedAt: chance(0.6) ? addDays(startedAt, int(0, 2)) : null,
      createdByUserId:
        property.workspaceId === "ws_aurora"
          ? pick(["usr_alex", "usr_maya", "usr_noah"])
          : pick(["usr_priya", "usr_liam", "usr_omar"])
    };
  });

  await prisma.releaseAnnotation.createMany({ data: releaseRows });

  const annotationRows = Array.from({ length: 36 }, (_, i) => {
    const property = pick(properties);
    const propertyPages = pages.filter((p) => p.propertyId === property.id);
    const targetPage = pick(propertyPages);
    const activeFrom = daysAgo(int(0, 120));
    const hasEnd = chance(0.4);

    return {
      id: `ann_${(i + 1).toString().padStart(3, "0")}`,
      propertyId: property.id,
      scopeType: pick([
        "property",
        "page",
        "template",
        "metric",
        "report"
      ] as const),
      scopeId: targetPage.id,
      annotationType: pick([
        "tracking_change",
        "consent_issue",
        "source_conflict",
        "caveat",
        "outage"
      ] as const),
      title: `Trust Note ${i + 1}`,
      description:
        "Known data trust caveat captured for historical interpretation in dashboards and reports.",
      severity: pick(["info", "warning", "critical"] as const),
      activeFrom,
      activeTo: hasEnd ? addDays(activeFrom, int(2, 30)) : null,
      createdByUserId:
        property.workspaceId === "ws_aurora"
          ? pick(["usr_alex", "usr_maya", "usr_ivy"])
          : pick(["usr_priya", "usr_liam", "usr_omar"]),
      createdAt: daysAgo(int(0, 120))
    };
  });

  await prisma.measurementAnnotation.createMany({ data: annotationRows });

  const reportRows = properties.flatMap((property) => {
    const rows: Prisma.ReportCreateManyInput[] = [];

    for (let week = 0; week < 8; week += 1) {
      const end = daysAgo(week * 7);
      const start = addDays(end, -6);
      const status = reportStatuses[week % reportStatuses.length] as
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent";

      const generatedBy = pick(["system", "user", "ai_assisted"] as const);
      const generatedByUserId =
        generatedBy === "user"
          ? property.workspaceId === "ws_aurora"
            ? pick(["usr_alex", "usr_maya", "usr_noah"])
            : pick(["usr_priya", "usr_liam", "usr_omar"])
          : null;

      const approvedByUserId =
        status === "approved" || status === "sent"
          ? property.workspaceId === "ws_aurora"
            ? pick(["usr_alex", "usr_maya"])
            : pick(["usr_priya", "usr_liam"])
          : null;

      rows.push({
        id: `rpt_${property.id}_${week + 1}`,
        propertyId: property.id,
        reportType: pick([
          "weekly",
          "seo_monthly",
          "cro_monthly",
          "leadership"
        ] as const),
        title: `${property.name} Weekly Intelligence - Week ${8 - week}`,
        dateRangeStart: start,
        dateRangeEnd: end,
        audiencePreset: pick(["exec", "growth-team", "content-team", "client"]),
        summaryMarkdown:
          "## Highlights\n- Traffic trends are stable\n- Top opportunities identified\n- Trust caveats documented",
        status,
        generatedBy,
        generatedByUserId,
        approvedByUserId,
        sentAt: status === "sent" ? addDays(end, 1) : null,
        createdAt: addDays(end, 1),
        updatedAt: addDays(end, 2)
      });
    }

    return rows;
  });

  await prisma.report.createMany({ data: reportRows });

  console.log("Seed complete:");
  console.log(`- Workspaces: ${workspaces.length}`);
  console.log(`- Properties: ${properties.length}`);
  console.log(`- Canonical pages: ${pages.length}`);
  console.log(`- Recommendations: ${recommendationRows.length}`);
  console.log(`- Alerts: ${alertRows.length}`);
  console.log(`- Release events: ${releaseRows.length}`);
  console.log(`- Trust annotations: ${annotationRows.length}`);
  console.log(`- Weekly reports: ${reportRows.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
