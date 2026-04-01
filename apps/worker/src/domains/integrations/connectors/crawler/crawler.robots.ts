export interface RobotsRule {
  pattern: string;
  allow: boolean;
}

export interface RobotsRuleSet {
  groups: Map<string, RobotsRule[]>;
}

function normalizeUserAgent(value: string): string {
  return value.trim().toLowerCase();
}

export function parseRobotsTxt(text: string): RobotsRuleSet {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      currentAgents = [];
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const field = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (field === "user-agent") {
      const agent = normalizeUserAgent(value);
      currentAgents = [...currentAgents, agent];
      if (!groups.has(agent)) {
        groups.set(agent, []);
      }
      continue;
    }

    if ((field === "allow" || field === "disallow") && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        groups.get(agent)?.push({
          pattern: value,
          allow: field === "allow"
        });
      }
    }
  }

  return { groups };
}

function resolveRules(rules: RobotsRuleSet, userAgent: string): RobotsRule[] {
  const normalized = normalizeUserAgent(userAgent);
  return [
    ...(rules.groups.get(normalized) ?? []),
    ...(rules.groups.get("*") ?? [])
  ];
}

export function isAllowedByRobots(input: {
  rules: RobotsRuleSet;
  userAgent: string;
  url: string;
}): boolean {
  const pathname = new URL(input.url).pathname || "/";
  const matches = resolveRules(input.rules, input.userAgent).filter((rule) => {
    if (rule.pattern === "") {
      return true;
    }

    return pathname.startsWith(rule.pattern);
  });

  if (matches.length === 0) {
    return true;
  }

  matches.sort((left, right) => {
    if (right.pattern.length !== left.pattern.length) {
      return right.pattern.length - left.pattern.length;
    }

    return Number(right.allow) - Number(left.allow);
  });

  return matches[0]?.allow ?? true;
}
