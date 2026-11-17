import { getDb } from "@/lib/mongodb";
import type { ItemReport } from "@/lib/types";
import { signedPhotoUrl } from "@/lib/cloudinary";
type ReportDoc = ItemReport & { _id: string; photos?: Array<{ public_id: string }>; created_at: Date | string };
export type ReportFilters = { query?: string; kind?: "lost" | "found" | "all"; category?: string; location?: string; days?: "any" | "today" | "week"; sort?: "newest" | "relevance" };
const active = ["open", "claim_pending", "handover"] as const;
function project(doc: ReportDoc): ItemReport {
  const first = doc.photos?.[0];
  const createdDate = new Date(doc.created_at);
  return {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    location: doc.location,
    happened_at: doc.happened_at,
    state: doc.state,
    created_at: Number.isNaN(createdDate.getTime()) ? new Date(0).toISOString() : createdDate.toISOString(),
    photo_url: first ? signedPhotoUrl(first.public_id) : undefined,
    dropped_off_desk: doc.kind === "found" && typeof doc.dropped_off_desk === "string" && doc.dropped_off_desk.trim()
      ? doc.dropped_off_desk.trim()
      : undefined,
  };
}
function filterFor(f: ReportFilters) { const filter: Record<string,unknown> = { state: { $in: active } }; if (f.kind && f.kind !== "all") filter.kind=f.kind; if (f.category && f.category !== "all") filter.category=f.category; if (f.location && f.location !== "all") filter.location={ $regex: f.location.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), $options:"i" }; if(f.query?.trim()) filter.$text={ $search:f.query.trim().slice(0,120) }; if(f.days!=="any"&&f.days){const since=new Date(Date.now()-(f.days==="today"?1:7)*86400000);filter.happened_at={$gte:since.toISOString()};} return filter; }
export async function getOpenReports(limit=30):Promise<ItemReport[]> { const db=await getDb(); const rows=await db.collection<ReportDoc>("reports").find({state:{$in:active}}).sort({created_at:-1}).limit(limit).toArray(); return rows.map(project); }
export async function getPagedReports(page = 1, pageSize = 24, filters: ReportFilters = {}) {
  const db = await getDb();
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 24;
  const filter = filterFor(filters);
  const useRelevanceSort = filters.sort === "relevance" && Boolean(filters.query?.trim());
  const cursor = db.collection<ReportDoc>("reports").find(filter);
  if (useRelevanceSort) {
    cursor.project({ score: { $meta: "textScore" } });
  }
  const [rows, total] = await Promise.all([
    cursor
      .sort(useRelevanceSort ? { score: { $meta: "textScore" }, created_at: -1 } : { created_at: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .toArray(),
    db.collection("reports").countDocuments(filter),
  ]);
  return { items: rows.map(project), total };
}
