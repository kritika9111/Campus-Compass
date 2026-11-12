import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getMember } from "@/lib/access";
import { MemberGate } from "@/components/member-gate";
import { FlowVideo } from "@/components/flow-video";
import { FindList } from "@/components/find-list";
import { getPagedReports } from "@/lib/queries";
import { categories } from "@/lib/types";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  kind?: string | string[];
  category?: string | string[];
  location?: string | string[];
  days?: string | string[];
  sort?: string | string[];
  created?: string | string[];
  photos?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = Boolean(process.env.MONGODB_URI && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const { approved } = configured ? await getMember() : { approved: false };
  if (configured && !approved)
    return (
      <MemberGate message="Sign in with a confirmed Gmail account to browse campus reports." />
    );

  const params = await searchParams;
  const pageParam = firstParam(params.page);
  const queryParam = firstParam(params.q) ?? "";
  const kindParam = firstParam(params.kind);
  const categoryParam = firstParam(params.category);
  const locationParam = firstParam(params.location) ?? "";
  const daysParam = firstParam(params.days);
  const sortParam = firstParam(params.sort);
  const createdParam = firstParam(params.created);
  const photosParam = firstParam(params.photos);
  const parsedPage = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsedPage)
    ? Math.min(10_000, Math.max(1, parsedPage))
    : 1;
  const filters = {
    query: queryParam.slice(0, 120),
    kind: kindParam === "lost" || kindParam === "found" ? kindParam : "all",
    category:
      categoryParam &&
      categories.includes(categoryParam as (typeof categories)[number])
        ? categoryParam
        : "all",
    location: locationParam.slice(0, 160),
    days: daysParam === "today" || daysParam === "week" ? daysParam : "any",
    sort: sortParam === "relevance" ? "relevance" : "newest",
  } as const;
  const { items, total } = configured
    ? await getPagedReports(page, 24, filters)
    : { items: [], total: 0 };
  const pageCount = Math.max(1, Math.ceil(total / 24));

  return (
    <main className="page-wrap">
      <FlowVideo />
      <div className="page-topline">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} />
          Campus Compass
        </Link>
        <span className="privacy-tag">LPU members · private board</span>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">The campus board</span>
          <h1>Find lost &amp; found items</h1>
          <p>Search reports from around Lovely Professional University.</p>
        </div>
        <Link href="/report" className="button button-teal">
          <Plus size={17} />
          Report an item
        </Link>
      </div>
      {createdParam === "1" && (
        <div className="success-banner" role="status">
          Your {filters.kind === "found" ? "found" : "lost"} item is saved and now appears on the campus board.
          {photosParam === "unavailable" && " The report was saved, but its photo could not be uploaded."}
        </div>
      )}
      <FindList
        items={items}
        total={total}
        page={page}
        pageCount={pageCount}
        initialFilters={filters}
        previewOnly={!configured}
      />
    </main>
  );
}
