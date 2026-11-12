import type { ItemReport, ItemStatus } from "@/lib/types";

export type MatchFactor = {
  name: string;
  matched: boolean;
  score: number;
  maxScore: number;
  detail: string;
};

export type MatchResult = {
  candidate: ItemReport;
  totalScore: number; // 0 to 100
  isStrongMatch: boolean;
  factors: MatchFactor[];
};

export function publicMatchResults(matches: MatchResult[]): MatchResult[] {
  return matches.map(({ candidate, ...match }) => ({
    ...match,
    candidate: {
      id: candidate.id,
      kind: candidate.kind,
      title: candidate.title,
      category: candidate.category,
      description: candidate.description,
      location: candidate.location,
      happened_at: candidate.happened_at,
      state: candidate.state,
      created_at: candidate.created_at,
    },
  }));
}

// Known campus landmarks and hub locations across Lovely Professional University
const CAMPUS_HUBS = [
  { name: "Central Library", keywords: ["library", "central lib", "reading hall", "reference section"] },
  { name: "Block 34 (Academic)", keywords: ["block 34", "b34", "block-34"] },
  { name: "Block 36 (Engineering)", keywords: ["block 36", "b36", "block-36"] },
  { name: "Block 38 (Computer Science)", keywords: ["block 38", "b38", "block-38"] },
  { name: "Block 30 / DSW", keywords: ["block 30", "dsw", "student welfare", "b30"] },
  { name: "Uni Mall", keywords: ["uni mall", "unimall", "mall", "food court uni mall", "subway"] },
  { name: "Food Court / Kiosk", keywords: ["food court", "canteen", "kiosk", "food street", "cafe", "nescafe"] },
  { name: "Boys Hostels", keywords: ["bh-", "bh1", "bh2", "bh3", "bh4", "bh5", "bh6", "bh7", "bh8", "boys hostel"] },
  { name: "Girls Hostels", keywords: ["gh-", "gh1", "gh2", "gh3", "gh4", "gh5", "gh6", "girls hostel"] },
  { name: "Sports Complex / Robopark", keywords: ["sports complex", "indoor stadium", "ground", "robopark", "gym"] },
  { name: "Main Gate / Shanti Devi", keywords: ["main gate", "gate 1", "gate 2", "gate 3", "shanti devi"] },
];

// Distinctive attributes (colors, brands, common items)
const COLOR_KEYWORDS = [
  "black", "blue", "navy", "grey", "gray", "silver", "white", "red", "green", 
  "yellow", "gold", "golden", "pink", "purple", "brown", "orange", "maroon"
];

const BRAND_KEYWORDS = [
  "apple", "iphone", "airpods", "macbook", "ipad", "samsung", "galaxy", "boat", 
  "noise", "realme", "oneplus", "dell", "hp", "lenovo", "acer", "asus", "casio", 
  "fastrack", "titan", "fossil", "wildcraft", "skybags", "american tourister", 
  "puma", "nike", "adidas", "sony", "jbl", "anker", "boult", "zebronics"
];

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is", "was",
  "it", "with", "my", "i", "near", "by", "from", "left", "found", "lost", "please",
  "item", "belonging", "around", "have", "has", "had", "this", "that", "some", "someone"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function findMatchedTokens(tokensA: string[], tokensB: string[]): string[] {
  const setB = new Set(tokensB);
  const matched = new Set<string>();
  for (const token of tokensA) {
    if (setB.has(token)) {
      matched.add(token);
    }
  }
  return Array.from(matched);
}

function extractKeywords(tokens: string[], vocabulary: string[]): string[] {
  const tokenSet = new Set(tokens);
  return vocabulary.filter((word) => tokenSet.has(word));
}

function identifyHub(locationText: string): string | null {
  const lower = locationText.toLowerCase();
  for (const hub of CAMPUS_HUBS) {
    if (hub.keywords.some((kw) => lower.includes(kw))) {
      return hub.name;
    }
  }
  return null;
}

export function scoreReportPair(target: ItemReport, candidate: ItemReport): MatchResult {
  const factors: MatchFactor[] = [];

  // 1. Category Factor (Max 30)
  const isExactCategory = target.category === candidate.category;
  const categoryScore = isExactCategory ? 30 : 0;
  factors.push({
    name: "Category",
    matched: isExactCategory,
    score: categoryScore,
    maxScore: 30,
    detail: isExactCategory ? `Identical category (${target.category})` : "Different category",
  });

  // 2. Title & Keyword Overlap (Max 25)
  const targetTitleTokens = tokenize(target.title);
  const candidateTitleTokens = tokenize(candidate.title);
  const titleOverlap = findMatchedTokens(targetTitleTokens, candidateTitleTokens);
  
  let titleScore = 0;
  if (titleOverlap.length >= 2) {
    titleScore = 25;
  } else if (titleOverlap.length === 1) {
    titleScore = 18;
  }
  factors.push({
    name: "Title match",
    matched: titleOverlap.length > 0,
    score: titleScore,
    maxScore: 25,
    detail: titleOverlap.length > 0 ? `Shared terms: ${titleOverlap.slice(0, 3).join(", ")}` : "No matching title terms",
  });

  // 3. Distinctive Attributes (Brand & Color) (Max 20)
  const targetAllTokens = tokenize(`${target.title} ${target.description}`);
  const candidateAllTokens = tokenize(`${candidate.title} ${candidate.description}`);

  const targetColors = extractKeywords(targetAllTokens, COLOR_KEYWORDS);
  const candidateColors = extractKeywords(candidateAllTokens, COLOR_KEYWORDS);
  const sharedColors = targetColors.filter((c) => candidateColors.includes(c));

  const targetBrands = extractKeywords(targetAllTokens, BRAND_KEYWORDS);
  const candidateBrands = extractKeywords(candidateAllTokens, BRAND_KEYWORDS);
  const sharedBrands = targetBrands.filter((b) => candidateBrands.includes(b));

  let attrScore = 0;
  if (sharedBrands.length > 0) attrScore += 12;
  if (sharedColors.length > 0) attrScore += 8;
  attrScore = Math.min(attrScore, 20);

  const attrMatches: string[] = [];
  if (sharedBrands.length > 0) attrMatches.push(`Brand: ${sharedBrands.join(", ")}`);
  if (sharedColors.length > 0) attrMatches.push(`Colour: ${sharedColors.join(", ")}`);

  factors.push({
    name: "Attributes",
    matched: attrMatches.length > 0,
    score: attrScore,
    maxScore: 20,
    detail: attrMatches.length > 0 ? attrMatches.join(" · ") : "No shared brand or colour cues",
  });

  // 4. Campus Location Proximity (Max 15)
  const targetHub = identifyHub(target.location);
  const candidateHub = identifyHub(candidate.location);
  const targetLocTokens = tokenize(target.location);
  const candidateLocTokens = tokenize(candidate.location);
  const locOverlap = findMatchedTokens(targetLocTokens, candidateLocTokens);

  let locScore = 0;
  let locDetail = "Different reported locations";
  if (targetHub && candidateHub && targetHub === candidateHub) {
    locScore = 15;
    locDetail = `Same campus area (${targetHub})`;
  } else if (locOverlap.length > 0) {
    locScore = 10;
    locDetail = `Shared location term: ${locOverlap[0]}`;
  }
  factors.push({
    name: "Location",
    matched: locScore > 0,
    score: locScore,
    maxScore: 15,
    detail: locDetail,
  });

  // 5. Date Proximity (Max 10)
  const targetDate = new Date(target.happened_at).getTime();
  const candidateDate = new Date(candidate.happened_at).getTime();
  const daysDiff = Math.abs(targetDate - candidateDate) / (1000 * 60 * 60 * 24);

  let dateScore = 0;
  let dateDetail = `Reported ${Math.round(daysDiff)} days apart`;
  if (daysDiff <= 1) {
    dateScore = 10;
    dateDetail = "Within 24 hours of each other";
  } else if (daysDiff <= 4) {
    dateScore = 8;
    dateDetail = `Within ${Math.round(daysDiff)} days`;
  } else if (daysDiff <= 7) {
    dateScore = 5;
    dateDetail = "Within one week";
  } else if (daysDiff <= 14) {
    dateScore = 2;
    dateDetail = "Within two weeks";
  }
  factors.push({
    name: "Date",
    matched: dateScore > 0,
    score: dateScore,
    maxScore: 10,
    detail: dateDetail,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

  return {
    candidate,
    totalScore,
    isStrongMatch: totalScore >= 60,
    factors,
  };
}

/**
 * Score a list of candidate counterpart reports against a target report.
 * Filters out items with totalScore < minScore (default: 35).
 */
export function findMatches(
  target: ItemReport,
  candidates: ItemReport[],
  minScore = 35,
  limit = 4
): MatchResult[] {
  // Candidate must be of the opposite kind (lost <-> found) and not the exact same report
  const oppositeKind: ItemStatus = target.kind === "lost" ? "found" : "lost";

  return candidates
    .filter((c) => c.id !== target.id && (!target.reporter_id || c.reporter_id !== target.reporter_id) && c.kind === oppositeKind && !["closed", "returned", "hidden"].includes(c.state))
    .map((candidate) => scoreReportPair(target, candidate))
    .filter((result) => result.totalScore >= minScore)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

/**
 * Database-backed match finder: queries candidate counterpart reports from MongoDB
 * and scores them using the matching service.
 */
export async function getPotentialMatchesForReport(
  reportId: string,
  minScore = 35
): Promise<MatchResult[]> {
  const {getDb}=await import("@/lib/mongodb");const db=await getDb();
  const targetData=await db.collection("reports").findOne({_id:reportId});
  if (!targetData) return [];
  const target={...targetData,id:String(targetData._id)} as unknown as ItemReport;
  if (["closed", "hidden", "returned"].includes(target.state)) return [];

  // 2. Fetch candidate reports of opposite kind with open/claim_pending/handover state
  const oppositeKind = target.kind === "lost" ? "found" : "lost";
  const candidateData=await db.collection("reports").find({kind:oppositeKind,state:{$in:["open","claim_pending","handover"]}}).sort({created_at:-1}).limit(50).toArray();
  if (!candidateData.length) return [];
  const candidates=candidateData.map(d=>({...d,id:String(d._id)})) as unknown as ItemReport[];

  return findMatches(target, candidates, minScore, 4);
}

/**
 * Deduplicated match notification: sends a notification to the owner of a report
 * only if a notification for this specific matched item hasn't already been delivered.
 */
export async function notifyMatchIfNew(
  recipientId: string,
  matchedItem: ItemReport,
  sourceItem: ItemReport
): Promise<boolean> {
  const {getDb}=await import("@/lib/mongodb");const db=await getDb();
  const targetHref = `/items/${matchedItem.id}`;

  const existing=await db.collection("notifications").findOne({user_id:recipientId,kind:"potential_match",href:targetHref});

  if (existing) {
    return false; // Prevent duplicate notification
  }

  await db.collection("notifications").insertOne({
    _id:crypto.randomUUID(),
    user_id: recipientId,
    kind: "potential_match",
    title: `Possible match for your ${sourceItem.kind} item`,
    body: `A new ${matchedItem.kind} listing "${matchedItem.title}" at ${matchedItem.location} may match your ${sourceItem.title}.`,
    href: targetHref,
    created_at: new Date(),
  });

  return true;
}

export async function notifyOwnersOfPotentialMatches(sourceItem: ItemReport): Promise<void> {
  if (!sourceItem.reporter_id) return;
  const matches = await getPotentialMatchesForReport(sourceItem.id, 35);
  for (const match of matches) {
    const candidate = match.candidate;
    if (!candidate.reporter_id || candidate.reporter_id === sourceItem.reporter_id) continue;
    await Promise.all([
      notifyMatchIfNew(sourceItem.reporter_id, candidate, sourceItem),
      notifyMatchIfNew(candidate.reporter_id, sourceItem, candidate),
    ]);
  }
}
