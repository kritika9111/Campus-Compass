import test from "node:test";
import assert from "node:assert/strict";
import { scoreReportPair, findMatches } from "./matching.ts";
import type { ItemReport } from "./types.ts";

function createReport(overrides: Partial<ItemReport>): ItemReport {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    kind: "lost",
    title: "Black Casio Scientific Calculator fx-991EX",
    category: "Electronics",
    description: "Lost black calculator in reading hall. Has formula notes.",
    location: "Central Library, 2nd Floor",
    happened_at: new Date("2026-11-08T10:00:00Z").toISOString(),
    state: "open",
    created_at: new Date("2026-11-08T10:30:00Z").toISOString(),
    ...overrides,
  };
}

test("Matching Engine: High confidence match for matching items", () => {
  const lostItem = createReport({
    id: "lost-1",
    kind: "lost",
    title: "Black Casio Calculator fx-991EX",
    category: "Electronics",
    location: "Central Library, 2nd Floor Study Area",
    happened_at: new Date("2026-11-08T10:00:00Z").toISOString(),
  });

  const foundItem = createReport({
    id: "found-1",
    kind: "found",
    title: "Casio fx-991EX Calculator",
    category: "Electronics",
    location: "Central Library, Circulation Desk",
    happened_at: new Date("2026-11-08T14:00:00Z").toISOString(),
  });

  const result = scoreReportPair(lostItem, foundItem);

  assert.ok(result.totalScore >= 70, `Expected score >= 70, got ${result.totalScore}`);
  assert.equal(result.isStrongMatch, true);
  
  // Verify factor breakdown
  const categoryFactor = result.factors.find((f) => f.name === "Category");
  assert.equal(categoryFactor?.matched, true);
  assert.equal(categoryFactor?.score, 30);

  const locationFactor = result.factors.find((f) => f.name === "Location");
  assert.equal(locationFactor?.matched, true);
  assert.equal(locationFactor?.score, 15); // Both in Central Library hub

  const dateFactor = result.factors.find((f) => f.name === "Date");
  assert.equal(dateFactor?.matched, true);
  assert.equal(dateFactor?.score, 10); // Within 24 hours
});

test("Matching Engine: Low score for non-matching items", () => {
  const lostItem = createReport({
    id: "lost-1",
    kind: "lost",
    title: "Navy Student ID Card Lanyard",
    category: "ID card",
    location: "Block 34, 3rd Floor",
    happened_at: new Date("2026-11-08T10:00:00Z").toISOString(),
  });

  const foundItem = createReport({
    id: "found-2",
    kind: "found",
    title: "Stainless Water Bottle",
    category: "Accessories",
    location: "Uni Mall, Food Court",
    happened_at: new Date("2026-10-20T10:00:00Z").toISOString(),
  });

  const result = scoreReportPair(lostItem, foundItem);
  assert.ok(result.totalScore < 30, `Expected score < 30, got ${result.totalScore}`);
  assert.equal(result.isStrongMatch, false);
});

test("Matching Engine: findMatches filters opposite kind and minimum threshold", () => {
  const targetLost = createReport({
    id: "target-lost",
    kind: "lost",
    title: "Wildcraft Black Backpack",
    category: "Bags",
    location: "Baldev Raj Mittal Unipolis",
  });

  const candidates: ItemReport[] = [
    // Opposite kind, matching category and brand -> should match
    createReport({
      id: "candidate-1",
      kind: "found",
      title: "Wildcraft Backpack Charcoal",
      category: "Bags",
      location: "Baldev Raj Mittal Unipolis",
      state: "open",
    }),
    // Same kind (lost) -> must be ignored
    createReport({
      id: "candidate-2",
      kind: "lost",
      title: "Wildcraft Black Backpack",
      category: "Bags",
      location: "Baldev Raj Mittal Unipolis",
      state: "open",
    }),
    // Opposite kind, but closed -> must be ignored
    createReport({
      id: "candidate-3",
      kind: "found",
      title: "Wildcraft Backpack",
      category: "Bags",
      location: "Baldev Raj Mittal Unipolis",
      state: "closed",
    }),
    // Opposite kind, but completely different -> below minScore
    createReport({
      id: "candidate-4",
      kind: "found",
      title: "Two Motorcycle Keys",
      category: "Keys",
      location: "Gate 1",
      state: "open",
    }),
  ];

  const matches = findMatches(targetLost, candidates, 35);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].candidate.id, "candidate-1");
});
