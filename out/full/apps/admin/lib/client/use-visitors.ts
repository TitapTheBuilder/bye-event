"use client";

import type { Visitor } from "@repo/db";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface VisitorsQuery {
  search: string;
  visitorType?: "invited" | "guest";
  includeDeactivated: boolean;
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "name" | "company";
  sortDir: "asc" | "desc";
}

const DEFAULT_QUERY: VisitorsQuery = {
  search: "",
  includeDeactivated: false,
  page: 1,
  pageSize: 25,
  sortBy: "createdAt",
  sortDir: "desc",
};

function buildQueryString(query: VisitorsQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.visitorType) params.set("visitorType", query.visitorType);
  if (query.includeDeactivated) params.set("includeDeactivated", "true");
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sortBy", query.sortBy);
  params.set("sortDir", query.sortDir);
  return params.toString();
}

export function useVisitors(initialQuery: Partial<VisitorsQuery> = {}) {
  const [query, setQuery] = useState<VisitorsQuery>({ ...DEFAULT_QUERY, ...initialQuery });
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(() => buildQueryString(query), [query]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/visitors?${queryString}`);
      if (!res.ok) return;
      const data = (await res.json()) as { visitors: Visitor[]; total: number };
      setVisitors(data.visitors);
      setTotal(data.total);
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPage = useCallback((page: number) => setQuery((q) => ({ ...q, page })), []);
  const setSearch = useCallback(
    (search: string) => setQuery((q) => ({ ...q, search, page: 1 })),
    [],
  );
  const setVisitorTypeFilter = useCallback(
    (visitorType: VisitorsQuery["visitorType"]) => setQuery((q) => ({ ...q, visitorType, page: 1 })),
    [],
  );
  const setIncludeDeactivated = useCallback(
    (includeDeactivated: boolean) => setQuery((q) => ({ ...q, includeDeactivated, page: 1 })),
    [],
  );
  const setSort = useCallback(
    (sortBy: VisitorsQuery["sortBy"], sortDir: VisitorsQuery["sortDir"]) =>
      setQuery((q) => ({ ...q, sortBy, sortDir })),
    [],
  );

  return {
    query,
    visitors,
    total,
    isLoading,
    refresh,
    setPage,
    setSearch,
    setVisitorTypeFilter,
    setIncludeDeactivated,
    setSort,
  };
}
