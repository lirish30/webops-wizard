export type PaginationInput = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type SortDirection = "asc" | "desc";

export type SortInput<TAllowed extends string> = {
  field: TAllowed;
  direction: SortDirection;
};

function toSingleValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === "string");
    if (typeof firstString === "string") {
      const trimmed = firstString.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

export function parsePagination(query: Record<string, unknown>, config?: {
  defaultPageSize?: number;
  maxPageSize?: number;
}): PaginationInput {
  const defaultPageSize = config?.defaultPageSize ?? 25;
  const maxPageSize = config?.maxPageSize ?? 100;

  const pageRaw = toSingleValue(query.page);
  const pageSizeRaw = toSingleValue(query.pageSize);

  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const requestedSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : defaultPageSize;

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? Math.min(requestedSize, maxPageSize)
      : defaultPageSize;

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize
  };
}

export function buildPaginationMeta(
  pagination: PaginationInput,
  total: number
): { page: number; pageSize: number; total: number; totalPages: number } {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize))
  };
}

export function parseSort<TAllowed extends string>(
  query: Record<string, unknown>,
  config: {
    defaultSort: SortInput<TAllowed>;
    allowedFields: readonly TAllowed[];
  }
): SortInput<TAllowed> {
  const raw = toSingleValue(query.sort);
  if (!raw) {
    return config.defaultSort;
  }

  const [fieldPart, directionPart] = raw.split(":");
  const field = fieldPart?.trim() as TAllowed | undefined;
  const directionRaw = directionPart?.trim().toLowerCase();

  if (!field || !config.allowedFields.includes(field)) {
    return config.defaultSort;
  }

  const direction: SortDirection = directionRaw === "asc" ? "asc" : "desc";

  return { field, direction };
}

export function parseFilters<TAllowed extends string>(
  query: Record<string, unknown>,
  allowedFields: readonly TAllowed[]
): Partial<Record<TAllowed, string>> {
  const filters: Partial<Record<TAllowed, string>> = {};

  for (const field of allowedFields) {
    const value = toSingleValue(query[field]);
    if (value) {
      filters[field] = value;
    }
  }

  return filters;
}
