"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { ItemCard } from "@/components/item-card";
import { categories, type ItemReport } from "@/lib/types";

type Filters = { query: string; kind: string; category: string; location: string; days: string; sort: string };

export function FindList({
  items: initialItems,
  total: initialTotal,
  page: initialPage,
  pageCount: initialPageCount,
  initialFilters,
  previewOnly = false,
}: {
  items: ItemReport[];
  total: number;
  page: number;
  pageCount: number;
  initialFilters: Filters;
  previewOnly?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [filters, setFilters] = useState(initialFilters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (previewOnly) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), kind: filters.kind, category: filters.category, days: filters.days, sort: filters.sort });
      if (filters.query.trim()) params.set("q", filters.query.trim());
      if (filters.location.trim()) params.set("location", filters.location.trim());
      try {
        const response = await fetch(`/api/reports?${params.toString()}`, { signal: abort.signal });
        const result = await response.json() as { items?: ItemReport[]; total?: number; page?: number; pageCount?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load reports.");
        window.history.replaceState(null, "", `/find?${params.toString()}`);
        setItems(result.items ?? []);
        setTotal(result.total ?? 0);
        setPage(result.page ?? 1);
        setPageCount(result.pageCount ?? 1);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Campus reports are temporarily unavailable.");
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [filters, page, retryKey, previewOnly]);

  const activeFilters = useMemo(() => filters.query.trim() !== "" || filters.kind !== "all" || filters.category !== "all" || filters.location.trim() !== "" || filters.days !== "any" || filters.sort !== "newest", [filters]);

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function resetFilters() {
    setPage(1);
    setFilters({ query: "", kind: "all", category: "all", location: "", days: "any", sort: "newest" });
  }

  return <>
    <div className="filter-bar">
      <label className="search-field">
        <Search size={18} />
        <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Search item, description or place…" aria-label="Search all campus reports" />
        <SlidersHorizontal size={17} aria-hidden="true" />
      </label>
    </div>
    <div className="filter-row" aria-label="Filter campus reports">
      <div className="segmented" role="group" aria-label="Report type">
        {(["all", "lost", "found"] as const).map((value) => <button key={value} type="button" className={filters.kind === value ? "on" : ""} aria-pressed={filters.kind === value} onClick={() => updateFilter("kind", value)}>{value === "all" ? "All reports" : value === "lost" ? "Lost" : "Found"}</button>)}
      </div>
      <label className="sr-only" htmlFor="find-category">Category</label>
      <select id="find-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
        <option value="all">Every category</option>{categories.map((category) => <option key={category}>{category}</option>)}
      </select>
      <label className="sr-only" htmlFor="find-location">Campus location</label>
      <input id="find-location" className="location-filter" value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} placeholder="Campus location" />
      <label className="sr-only" htmlFor="find-date">Date</label>
      <select id="find-date" value={filters.days} onChange={(event) => updateFilter("days", event.target.value)}><option value="any">Any date</option><option value="today">Last 24 hours</option><option value="week">Last 7 days</option></select>
      <label className="sr-only" htmlFor="find-sort">Sort reports</label>
      <select id="find-sort" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}><option value="newest">Newest first</option><option value="relevance">Best match</option></select>
      {activeFilters && <button type="button" className="filter-reset" onClick={resetFilters}><X size={14} />Clear filters</button>}
      <span className="result-count" aria-live="polite">{busy ? <><LoaderCircle size={13} className="spin" /> Searching</> : `${total} ${total === 1 ? "report" : "reports"}`}</span>
    </div>
    {error && <div className="find-error" role="alert"><span>{error}</span><button type="button" className="text-link" onClick={() => setRetryKey((value) => value + 1)}>Try again</button></div>}
    {items.length ? <div className={`item-grid${busy ? " loading-results" : ""}`}>{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : !error && <div className="empty-state"><span className="empty-compass">⌕</span><h2>{activeFilters ? "No reports match those filters." : "The board is quiet for now."}</h2><p>{activeFilters ? "Try a different search or clear a filter." : "New lost and found reports from LPU members will appear here."}</p>{activeFilters && <button className="text-link" type="button" onClick={resetFilters}>Clear all filters <X size={14} /></button>}</div>}
    <nav className="pagination" aria-label="Report pages"><button type="button" disabled={page <= 1 || busy} onClick={() => setPage((value) => Math.max(1, value - 1))}><ArrowLeft size={14} />Newer</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount || busy} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Older<ArrowRight size={14} /></button></nav>
  </>;
}
