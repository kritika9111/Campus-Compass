"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Handshake,
  History,
  Info,
  LoaderCircle,
  MapPin,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export type ClaimMessage = {
  id: string;
  isMine: boolean;
  body: string;
  created_at: string;
};

export type ClaimStatusEvent = {
  id: string;
  old_state: string | null;
  new_state: string;
  note: string | null;
  created_at: string;
};

type HandoverPlan = {
  location: string;
  date: string;
  time_window: string;
  note?: string;
  proposed_by_you: boolean;
  proposed_at: string | Date;
  confirmed: boolean;
  confirmed_at?: string | Date | null;
};

const OFFICIAL_HANDOVER_HUBS = [
  "Central Library - Ground Floor Circulation Desk",
  "Division of Student Welfare (DSW) - Block 30 Desk",
  "Uni Mall - Main Helpdesk & Security Desk",
  "Block 34 - Academic Reception Counter",
  "Main Security Gate 1 - Campus Visitor Helpdesk",
  "Other public campus spot",
];

export function ClaimWorkspace({
  claimId,
  isOwner,
  state,
  details,
  handover,
  messages,
  statusHistory = [],
}: {
  claimId: string;
  isOwner: boolean;
  state: string;
  details: string;
  handover?: HandoverPlan;
  messages: ClaimMessage[];
  statusHistory?: ClaimStatusEvent[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successNote, setSuccessNote] = useState("");
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedHub, setSelectedHub] = useState(OFFICIAL_HANDOVER_HUBS[0]);
  const [customLocation, setCustomLocation] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [handoverTime, setHandoverTime] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [additionalEvidence, setAdditionalEvidence] = useState("");

  const router = useRouter();
  const conversationClosed = state === "declined" || state === "completed";

  // Parse evidence category header if formatted
  let evidenceCategory = "Physical Ownership Details";
  let evidenceBody = details;
  if (details.startsWith("[Proof Category: ")) {
    const endIdx = details.indexOf("]");
    if (endIdx > 0) {
      evidenceCategory = details.slice(17, endIdx);
      evidenceBody = details.slice(endIdx + 1).trim();
    }
  }

  async function sendMessage(bodyText: string) {
    const response=await fetch(`/api/claims/${claimId}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"message",body:bodyText})});
    if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||"Message could not be sent.");
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccessNote("");
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    try {
      await sendMessage(body);
      form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdditionalEvidence(e: FormEvent) {
    e.preventDefault();
    if (!additionalEvidence.trim()) return;
    setBusy(true);
    setError("");
    setSuccessNote("");
    try {
      const msg = `[Additional Ownership Evidence Submitted]:\n${additionalEvidence.trim()}`;
      await sendMessage(msg);
      setAdditionalEvidence("");
      setSuccessNote("Additional evidence added to conversation.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post additional evidence.");
    } finally {
      setBusy(false);
    }
  }

  async function changeState(nextState: string) {
    setBusy(true);
    setError("");
    setSuccessNote("");
    try {
      const response=await fetch(`/api/claims/${claimId}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({state:nextState})});
      if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||"Could not update claim.");
      setSuccessNote(`Claim updated to: ${nextState.replace("_", " ")}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the claim.");
    } finally {
      setBusy(false);
    }
  }

  async function submitHandoverProposal(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const finalLocation = selectedHub === "Other public campus spot" ? customLocation.trim() : selectedHub;
    if (!finalLocation) {
      setError("Please specify the campus handover location.");
      setBusy(false);
      return;
    }
    if (!handoverDate || !handoverTime.trim()) {
      setError("Choose a date and time window for the handover.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "handover_proposal",
          location: selectedHub,
          custom_location: selectedHub === "Other public campus spot" ? customLocation.trim() : undefined,
          date: handoverDate,
          time_window: handoverTime.trim(),
          note: handoverNote.trim(),
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Could not propose handover.");

      setShowHandoverModal(false);
      setSuccessNote("Handover plan sent. The other participant must confirm the details.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not propose handover.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmHandover() {
    setBusy(true);
    setError("");
    setSuccessNote("");
    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm_handover" }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Could not confirm handover plan.");
      setSuccessNote("Handover details confirmed. Meet at the agreed public campus location.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm handover plan.");
    } finally {
      setBusy(false);
    }
  }

  const stateLabels: Record<string, string> = {
    pending: "Under review",
    more_info: "More details requested",
    accepted: "Ownership confirmed",
    handover: "Handover coordination",
    completed: "Returned to owner",
    declined: "Claim declined",
  };

  return (
    <div className="claim-workspace">
      {/* 1. Private Ownership Evidence Header */}
      <section className="claim-evidence">
        <div className="evidence-top">
          <span className="eyebrow">
            <ShieldCheck size={14} /> Private Ownership Evidence
          </span>
          <span className="evidence-tag">{evidenceCategory}</span>
        </div>
        <div className="evidence-body-text">
          <p>{evidenceBody}</p>
        </div>
        <div className="claim-participant">
          <ShieldCheck size={14} />
          {isOwner
            ? "Only you and the claimant have access to this verification detail."
            : "Only you and the reporter who posted the listing have access to this detail."}
        </div>

        {/* If claimant needs to provide more info */}
        {!isOwner && state === "more_info" && (
          <div className="more-info-prompt">
            <div className="prompt-header">
              <Info size={16} />
              <b>The reporter has requested additional details to verify ownership.</b>
            </div>
            <p>
              Please provide more identifying information—such as a distinctive mark, purchase invoice, lock screen
              description, or specific contents.
            </p>
            <form onSubmit={submitAdditionalEvidence} className="additional-evidence-form">
              <textarea
                value={additionalEvidence}
                onChange={(e) => setAdditionalEvidence(e.target.value)}
                placeholder="Write additional identifying details here..."
                maxLength={1800}
                rows={3}
                required
              />
              <button className="button button-teal" disabled={busy}>
                Submit additional evidence
              </button>
            </form>
          </div>
        )}
      </section>

      {/* 2. Structured Handover Card (if accepted or handover) */}
      {(state === "accepted" || state === "handover") && (
        <section className="handover-coordination-card">
          <div className="handover-card-header">
            <div>
              <span className="eyebrow">
                <Handshake size={14} /> Campus Handover Coordination
              </span>
              <h2>{state === "handover" ? "Confirm a safe handover" : "Ownership verified — plan handover"}</h2>
            </div>
            <span className={`handover-badge ${state}`}>
              {state === "handover" ? (handover?.confirmed ? "Plan agreed" : "Awaiting confirmation") : "Action required"}
            </span>
          </div>

          <p className="handover-instructions">
            Always choose a busy, staffed university desk. Verify each other’s Lovely Professional University student or
            staff ID card before completing the handover.
          </p>

          {handover && (
            <div className="handover-plan-summary" aria-live="polite">
              <b>Proposed meeting</b>
              <span>{handover.location}</span>
              <span>{new Date(`${handover.date}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })} · {handover.time_window}</span>
              {handover.note && <p>{handover.note}</p>}
              <small>
                {handover.confirmed
                  ? "Both participants agreed to this plan."
                  : handover.proposed_by_you
                    ? "Waiting for the other participant to confirm this plan."
                    : "Review the details, then confirm if this plan works for you."}
              </small>
            </div>
          )}

          <div className="handover-action-row">
            <button
              type="button"
              className="button button-teal"
              onClick={() => setShowHandoverModal(true)}
              disabled={busy}
            >
              <CalendarDays size={15} /> {handover ? "Propose a different time" : "Propose Handover Desk & Time"}
            </button>
            {handover && !handover.confirmed && !handover.proposed_by_you && (
              <button type="button" className="button button-outline" onClick={confirmHandover} disabled={busy}>
                <Check size={15} /> Confirm Handover Plan
              </button>
            )}
            {isOwner && state === "handover" && handover?.confirmed && (
              <button
                type="button"
                className="button button-outline mark-returned-btn"
                onClick={() => changeState("completed")}
                disabled={busy}
              >
                <Check size={15} /> Confirm Handover Completed & Return Item
              </button>
            )}
          </div>
        </section>
      )}

      {/* 3. Handover Proposal Modal */}
      {showHandoverModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowHandoverModal(false);
          }}
        >
          <section className="claim-modal handover-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button
              className="round-button modal-close"
              onClick={() => setShowHandoverModal(false)}
              aria-label="Close"
            >
              <XCircle size={16} />
            </button>
            <span className="eyebrow">
              <MapPin size={14} /> Campus Handover Protocol
            </span>
            <h2 id="modal-title">Arrange safe campus handover</h2>
            <p>
              Coordinate meeting at an official staffed location on the LPU campus. Keep all arrangements within this
              system.
            </p>

            <form onSubmit={submitHandoverProposal}>
              <label className="field">
                Official Campus Staffed Desk
                <select
                  value={selectedHub}
                  onChange={(e) => setSelectedHub(e.target.value)}
                  className="evidence-select"
                >
                  {OFFICIAL_HANDOVER_HUBS.map((hub) => (
                    <option key={hub} value={hub}>
                      {hub}
                    </option>
                  ))}
                </select>
              </label>

              {selectedHub === "Other public campus spot" && (
                <label className="field">
                  Campus spot name & building <span>*</span>
                  <input
                    type="text"
                    required
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="e.g. Block 14 Central Atrium, Uni Cafe entrance"
                  />
                </label>
              )}

              <div className="form-grid">
                <label className="field">
                  Date <span>*</span>
                  <input
                    type="date"
                    required
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </label>

                <label className="field">
                  Preferred Time Window <span>*</span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={80}
                    value={handoverTime}
                    onChange={(e) => setHandoverTime(e.target.value)}
                    placeholder="e.g. 1:30 PM - 2:00 PM"
                  />
                </label>
              </div>

              <label className="field">
                Handover instructions / notes
                <textarea
                  rows={2}
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                  placeholder="e.g. I will wait by the security sign-in desk with the item safely packed."
                />
              </label>

              <div className="safety-checklist">
                <b>
                  <ShieldAlert size={14} /> University Safety Protocol:
                </b>
                <ul>
                  <li>Meet strictly in well-lit, public areas during university working hours.</li>
                  <li>Check student/staff ID card before handing over items.</li>
                  <li>No cash exchanges or reward demands are permitted.</li>
                </ul>
              </div>

              <button className="button button-teal" disabled={busy}>
                {busy ? <LoaderCircle size={16} className="spin" /> : "Post handover proposal to conversation"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 4. Private Conversation & Messaging */}
      <section className="conversation">
        <div className="conversation-heading">
          <div>
            <span className="eyebrow">Private coordination thread</span>
            <h2>Direct conversation</h2>
          </div>
          <span className={`claim-state ${state}`}>{stateLabels[state] ?? state.replace("_", " ")}</span>
        </div>

        <div className="message-list">
          {messages.length ? (
            messages.map((message) => {
              const isMine = message.isMine;
              const isHandoverProposal = message.body.startsWith("📍 [Handover Schedule Proposal]");
              const isExtraEvidence = message.body.startsWith("[Additional Ownership Evidence Submitted]:");

              return (
                <div
                  className={`message ${isMine ? "mine" : "theirs"} ${isHandoverProposal ? "handover-proposal-msg" : ""} ${isExtraEvidence ? "extra-evidence-msg" : ""}`}
                  key={message.id}
                >
                  <p className="message-body">{message.body}</p>
                  <small>
                    {isMine ? "You" : isOwner ? "Claimant" : "Report Owner"} ·{" "}
                    {new Date(message.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
              );
            })
          ) : (
            <div className="conversation-empty">
              No messages yet. Use this channel to coordinate details safely and privately.
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="message-form">
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={2000}
            rows={2}
            disabled={conversationClosed || busy}
            placeholder={
              conversationClosed
                ? "This claim conversation is now closed."
                : "Coordinate with the other member (e.g. timing, desk, clarifications)..."
            }
          />
          <button
            className="button button-teal"
            disabled={busy || conversationClosed}
            aria-label="Send message"
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />}
          </button>
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {successNote && (
          <p className="form-success" role="status">
            {successNote}
          </p>
        )}

        <p className="handover-reminder">
          <ShieldCheck size={14} />
          Keep personal contact details, banking information, and phone numbers private. Use this secure campus thread.
        </p>
      </section>

      {/* 5. Report Owner Review Decision Controls */}
      {isOwner && (
        <section className="claim-review">
          <span className="eyebrow">Reporter Review Decision</span>
          <p>
            Carefully compare the claimant’s evidence with the physical item. Do not confirm until you are satisfied with
            their proof.
          </p>

          <div className="review-actions">
            {state === "pending" && (
              <>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => changeState("more_info")}
                  disabled={busy}
                >
                  <Info size={14} /> Request More Detail
                </button>
                <button
                  type="button"
                  className="button button-outline decline"
                  onClick={() => changeState("declined")}
                  disabled={busy}
                >
                  Decline Claim
                </button>
                <button
                  type="button"
                  className="button button-teal"
                  onClick={() => changeState("accepted")}
                  disabled={busy}
                >
                  Confirm Owner <ArrowUpRight size={14} />
                </button>
              </>
            )}

            {state === "more_info" && (
              <>
                <button
                  type="button"
                  className="button button-outline decline"
                  onClick={() => changeState("declined")}
                  disabled={busy}
                >
                  Decline Claim
                </button>
                <button
                  type="button"
                  className="button button-teal"
                  onClick={() => changeState("accepted")}
                  disabled={busy}
                >
                  Confirm Owner <ArrowUpRight size={14} />
                </button>
              </>
            )}

            {state === "completed" && (
              <span className="decision-completed-chip">
                <Check size={14} /> This item has been returned to the verified owner.
              </span>
            )}

            {state === "declined" && (
              <span className="decision-declined-chip">
                <XCircle size={14} /> This claim was declined. The listing remains open for other members.
              </span>
            )}
          </div>
        </section>
      )}

      {/* 6. Status Audit History Timeline */}
      {statusHistory.length > 0 && (
        <section className="status-history-section">
          <div className="history-heading">
            <History size={16} />
            <h3>Claim Status Audit Trail</h3>
          </div>
          <div className="history-timeline">
            {statusHistory.map((event, idx) => (
              <div key={event.id || idx} className="history-item">
                <div className="history-marker" />
                <div className="history-content">
                  <div className="history-line-top">
                    <b>{stateLabels[event.new_state] ?? event.new_state.replace("_", " ")}</b>
                    <small>
                      {new Date(event.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                  {event.old_state && (
                    <span className="history-transition">
                      Transitioned from <em>{stateLabels[event.old_state] ?? event.old_state.replace("_", " ")}</em>
                    </span>
                  )}
                  {event.note && <p className="history-note">{event.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

