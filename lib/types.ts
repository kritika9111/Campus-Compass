export type ItemStatus = "lost" | "found";
export type CampusRole = "member" | "student" | "faculty" | "staff" | "admin";
export type ReportState = "open" | "claim_pending" | "handover" | "returned" | "closed" | "hidden";
export type ItemCategory = "ID card" | "Electronics" | "Bags" | "Accessories" | "Books" | "Clothing" | "Keys" | "Other";
export type ItemReport = { id: string; reporter_id?: string; kind: ItemStatus; title: string; category: ItemCategory; description: string; location: string; happened_at: string; state: ReportState; created_at: string; photo_paths?: string[]; photo_url?: string };
export const categories: ItemCategory[] = ["ID card","Electronics","Bags","Accessories","Books","Clothing","Keys","Other"];
export const states: Record<ReportState,string> = { open:"Open", claim_pending:"Claim in review", handover:"Handover arranged", returned:"Returned", closed:"Closed", hidden:"Hidden by moderator" };
