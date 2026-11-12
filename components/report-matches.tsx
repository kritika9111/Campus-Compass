"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, MapPin, CalendarDays, CheckCircle2 } from "lucide-react";
import type { MatchResult } from "@/lib/matching";
import { states } from "@/lib/types";

export function ReportMatches({ matches, targetKind }: { matches: MatchResult[]; targetKind: "lost" | "found" }) {
  if (!matches || matches.length === 0) return null;

  const counterpartLabel = targetKind === "lost" ? "found report" : "lost report";

  return (
    <section className="report-matches-section" aria-labelledby="matches-heading">
      <div className="matches-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} className="sparkle-icon" /> Possible Campus Matches
          </span>
          <h2 id="matches-heading">
            {matches.length === 1 ? `1 potential ${counterpartLabel} found` : `${matches.length} potential ${counterpartLabel}s found`}
          </h2>
        </div>
        <span className="matches-badge">Automated match assistance</span>
      </div>

      <p className="matches-notice">
        <ShieldCheck size={14} />
        Campus Compass compares category, campus landmarks, dates, and attributes. Sensitive details stay private and ownership is verified strictly through private claim evidence.
      </p>

      <div className="matches-grid">
        {matches.map(({ candidate, totalScore, isStrongMatch, factors }) => {
          const matchedFactors = factors.filter((f) => f.matched && f.score > 0);

          return (
            <article key={candidate.id} className={`match-card ${isStrongMatch ? "strong-match" : ""}`}>
              <div className="match-card-top">
                <span className={`match-score-pill ${isStrongMatch ? "high" : "med"}`}>
                  <Sparkles size={11} /> {totalScore}% Match
                </span>
                <span className="match-kind-tag">
                  {candidate.kind === "lost" ? "Reported lost" : "Reported found"} · {states[candidate.state as keyof typeof states]}
                </span>
              </div>

              <div className="match-card-body">
                <h3 className="match-title">{candidate.title}</h3>
                <div className="match-meta">
                  <span>
                    <MapPin size={13} /> {candidate.location}
                  </span>
                  <span>
                    <CalendarDays size={13} /> {new Date(candidate.happened_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>

                <div className="match-factors-list">
                  {matchedFactors.map((f) => (
                    <span key={f.name} className="factor-pill">
                      <CheckCircle2 size={11} /> {f.detail}
                    </span>
                  ))}
                </div>
              </div>

              <div className="match-card-footer">
                <Link href={`/items/${candidate.id}`} className="button button-outline match-action-btn">
                  Inspect this listing <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
