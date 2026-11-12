export type ClaimState = "pending" | "more_info" | "accepted" | "handover" | "completed" | "declined";
export type ReportStateForClaim = "claim_pending" | "handover" | "returned" | "open";

const transitions: Record<ClaimState, readonly ClaimState[]> = {
  pending: ["more_info", "accepted", "declined"],
  more_info: ["accepted", "declined"],
  accepted: ["handover"],
  handover: ["completed"],
  completed: [],
  declined: [],
};

export function canTransitionClaim(from: string, to: string): to is ClaimState {
  return Object.hasOwn(transitions, from) && transitions[from as ClaimState].includes(to as ClaimState);
}

export function reportStateForClaim(state: ClaimState): ReportStateForClaim {
  if (state === "declined") return "open";
  if (state === "handover") return "handover";
  if (state === "completed") return "returned";
  return "claim_pending";
}

export const handoverLocations = [
  "Central Library - Ground Floor Circulation Desk",
  "Division of Student Welfare (DSW) - Block 30 Desk",
  "Uni Mall - Main Helpdesk & Security Desk",
  "Block 34 - Academic Reception Counter",
  "Main Security Gate 1 - Campus Visitor Helpdesk",
  "Other public campus spot",
] as const;
