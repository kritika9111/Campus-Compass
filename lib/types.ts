export type ItemStatus = "lost" | "found";
export type CampusRole = "member" | "student" | "faculty" | "staff" | "admin";
export type UserAuthStatus = "approved" | "suspended";
export type ReportState = "open" | "claim_pending" | "handover" | "returned" | "closed" | "hidden";
export type ItemCategory = "ID card" | "Electronics" | "Bags" | "Accessories" | "Books" | "Clothing" | "Keys" | "Other";
export type ItemReport = { id: string; reporter_id?: string; kind: ItemStatus; title: string; category: ItemCategory; description: string; location: string; happened_at: string; state: ReportState; created_at: string; photo_paths?: string[]; photo_url?: string; dropped_off_desk?: string };
export const campusRoles: CampusRole[] = ["member", "student", "faculty", "staff", "admin"];
export const campusDesks = [
  "Central Library - Ground Floor Circulation Desk",
  "Division of Student Welfare (DSW) - Block 30 Desk",
  "Uni Mall - Main Helpdesk & Security Desk",
  "Block 34 - Academic Reception Counter",
  "Main Security Gate 1 - Campus Visitor Helpdesk",
] as const;
export const categories: ItemCategory[] = ["ID card","Electronics","Bags","Accessories","Books","Clothing","Keys","Other"];
export const states: Record<ReportState,string> = { open:"Open", claim_pending:"Claim in review", handover:"Handover arranged", returned:"Returned", closed:"Closed", hidden:"Hidden by moderator" };
