type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  skip: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

export const extractPaginationMeta = (payload: unknown, fallbackLimit = 50): PaginationMeta => {
  const value = unwrapPayload(payload);

  if (!isRecord(value)) {
    return {
      total: 0,
      page: 1,
      limit: fallbackLimit,
      skip: 0,
    };
  }

  const rows = Array.isArray(value.data) ? value.data : [];
  const limit = typeof value.limit === "number" && value.limit > 0 ? value.limit : fallbackLimit;
  const skip = typeof value.skip === "number" && value.skip >= 0 ? value.skip : 0;
  const page =
    typeof value.page === "number" && value.page > 0
      ? value.page
      : Math.floor(skip / Math.max(limit, 1)) + 1;

  return {
    total: typeof value.total === "number" ? value.total : rows.length,
    page,
    limit,
    skip,
  };
};
