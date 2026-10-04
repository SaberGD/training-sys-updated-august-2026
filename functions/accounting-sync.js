"use strict";

/**
 * Accounting -> Training access sync.
 *
 * The accounting system (Firebase project crm---acounting-sg) POSTs the
 * access-relevant state of its bookings here. Every training `students` doc
 * carries the `sourceBookingId` it was exported from, so each booking state
 * is mapped to the matching student docs and their portal access is updated:
 *
 *   booking ACTIVE and paid >= 50%         -> unblock (if the block was a payment block)
 *   booking ACTIVE and paid <  50%         -> block as unpaid_50_percent
 *   booking DEACTIVATED/REFUNDED/DELETED   -> block, showing the accounting reason
 *
 * Requests are signed with HMAC-SHA256 over `${timestamp}.${rawBody}` using the
 * ACCOUNTING_SYNC_KEY secret shared by both projects.
 *
 * Safety rules (never fight a human decision):
 * - permanentDeactivation is never touched.
 * - Only payment blocks (category unpaid_50_percent) or blocks this sync made
 *   are lifted; a trainer's block for any other reason stays.
 * - A trainer's manual reactivation of an unpaid student is kept as an exception.
 * - The daily reconcile only reports differences unless settings/accountingSync
 *   has reconcileMode: "apply", and it skips students whose accounting state has
 *   not changed since the sync last wrote them (so manual edits made after a
 *   sync are respected).
 * - settings/accountingSync { enabled: false } turns the whole sync off.
 */

const crypto = require("crypto");

const SYNC_UID = "accounting-sync";
const SYNC_NAME = "نظام الحسابات (مزامنة تلقائية)";
const MAX_SKEW_MS = 5 * 60 * 1000;
const MAX_BOOKINGS_PER_REQUEST = 500;
const UNPAID_REASON = "موقوف لعدم استكمال 50% من سعر الكورس";
const BLOCKED_STATUSES = new Set(["DEACTIVATED", "REFUNDED", "DELETED"]);
const DEFAULT_ACCOUNTING_REASONS = {
  DEACTIVATED: "تم إيقاف الحجز من الحسابات",
  REFUNDED: "تم استرداد قيمة الحجز",
  DELETED: "تم إلغاء الحجز من الحسابات",
};

function verifySignature(req, key) {
  if (!key) return false;
  const timestamp = String(req.get("x-sg-timestamp") || "");
  const signature = String(req.get("x-sg-signature") || "");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const raw = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", key).update(`${timestamp}.${raw}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

function cleanState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const bookingId = typeof raw.bookingId === "string" ? raw.bookingId.trim() : "";
  if (!bookingId || bookingId.length > 128 || bookingId.includes("/")) return null;
  const status = String(raw.status || "").toUpperCase();
  if (status !== "ACTIVE" && !BLOCKED_STATUSES.has(status)) return null;
  return {
    bookingId,
    status,
    eligible: raw.eligible === true,
    paidPercentage: Number.isFinite(raw.paidPercentage) ? raw.paidPercentage : null,
    reason: typeof raw.reason === "string" ? raw.reason.trim().slice(0, 500) : "",
    totalPrice: money(raw.totalPrice),
    paidTotal: money(raw.paidTotal),
  };
}

function money(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v * 100) / 100 : null;
}

// Stable fingerprint of what accounting says, stored on the student when the
// sync writes it. The reconcile skips students whose fingerprint is unchanged.
function stateHash(state) {
  const desired = desiredOf(state);
  const key = desired === "blocked_accounting" ? `${desired}|${state.status}|${state.reason}` : desired;
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
}

function desiredOf(state) {
  if (BLOCKED_STATUSES.has(state.status)) return "blocked_accounting";
  return state.eligible ? "active" : "blocked_unpaid";
}

function accountingReason(state) {
  const base = state.reason || DEFAULT_ACCOUNTING_REASONS[state.status] || DEFAULT_ACCOUNTING_REASONS.DEACTIVATED;
  return `موقوف من الحسابات - ${base}`;
}

function isBlocked(s) {
  return s.deactivated === true || s.is50PercentPaid === false;
}

function isPaymentOrSyncBlock(s) {
  return (
    s.deactivatedByUid === SYNC_UID ||
    s.deactivationReasonCategory === "unpaid_50_percent" ||
    (!s.deactivationReasonCategory && s.is50PercentPaid === false)
  );
}

function lastHistoryEntry(s) {
  const h = Array.isArray(s.deactivationHistory) ? s.deactivationHistory : [];
  return h.length ? h[h.length - 1] : null;
}

/**
 * Returns { action: "activate"|"deactivate", category, reason } or { skip }.
 */
function decide(student, state) {
  if (student.permanentDeactivation === true) return { skip: "permanent" };
  const desired = desiredOf(state);

  if (desired === "active") {
    if (!isBlocked(student)) return { skip: "already_active" };
    if (!isPaymentOrSyncBlock(student)) return { skip: "manual_block" };
    return { action: "activate" };
  }

  if (desired === "blocked_accounting") {
    const reason = accountingReason(state);
    if (student.deactivated === true && student.deactivatedByUid === SYNC_UID &&
        student.deactivationReason === reason) {
      return { skip: "already_blocked" };
    }
    return { action: "deactivate", category: "other", reason, source: "accounting_status" };
  }

  // blocked_unpaid
  if (isBlocked(student)) {
    // Booking restored to ACTIVE but still under 50%: swap the accounting reason
    // for the payment reason. Any other existing block stays as it is.
    if (student.deactivatedByUid === SYNC_UID && student.deactivationReasonCategory !== "unpaid_50_percent") {
      return { action: "deactivate", category: "unpaid_50_percent", reason: UNPAID_REASON, source: "accounting_payment" };
    }
    return { skip: "already_blocked" };
  }
  const last = lastHistoryEntry(student);
  if (last && last.type === "reactivate" && last.performedByUid !== SYNC_UID) {
    return { skip: "manual_exception" };
  }
  return { action: "deactivate", category: "unpaid_50_percent", reason: UNPAID_REASON, source: "accounting_payment" };
}

function buildUpdate(admin, decision, state, now) {
  const FieldValue = admin.firestore.FieldValue;
  const syncMeta = {
    stateHash: stateHash(state),
    bookingStatus: state.status,
    paidPercentage: state.paidPercentage,
    syncedAt: now,
  };
  if (decision.action === "activate") {
    return {
      deactivated: false,
      is50PercentPaid: true,
      deactivatedAt: null,
      deactivatedByUid: null,
      deactivatedByName: null,
      deactivationReason: null,
      deactivationReasonCategory: null,
      deactivationChecklist: null,
      accountingSync: syncMeta,
      deactivationHistory: FieldValue.arrayUnion({
        type: "reactivate",
        reason: "تم التفعيل تلقائياً بعد استكمال 50% من سعر الكورس في الحسابات",
        timestamp: now,
        performedByUid: SYNC_UID,
        performedByName: SYNC_NAME,
      }),
    };
  }
  return {
    deactivated: true,
    is50PercentPaid: decision.category === "unpaid_50_percent" ? false : true,
    deactivatedAt: now,
    deactivatedByUid: SYNC_UID,
    deactivatedByName: SYNC_NAME,
    deactivationReasonCategory: decision.category,
    deactivationReason: decision.reason,
    accountingSync: syncMeta,
    deactivationHistory: FieldValue.arrayUnion({
      type: "deactivate",
      reasonCategory: decision.category,
      reason: decision.reason,
      timestamp: now,
      performedByUid: SYNC_UID,
      performedByName: SYNC_NAME,
    }),
  };
}

async function loadSettings(db) {
  try {
    const snap = await db.doc("settings/accountingSync").get();
    const data = snap.exists ? snap.data() : {};
    return {
      enabled: data.enabled !== false,
      reconcileMode: data.reconcileMode === "apply" ? "apply" : "report",
    };
  } catch (err) {
    console.error("accountingSync: failed to read settings, using defaults", err);
    return { enabled: true, reconcileMode: "report" };
  }
}

async function findStudents(db, bookingIds) {
  const byBooking = new Map();
  for (let i = 0; i < bookingIds.length; i += 30) {
    const chunk = bookingIds.slice(i, i + 30);
    const snap = await db.collection("students").where("sourceBookingId", "in", chunk).get();
    snap.docs.forEach((d) => {
      const id = d.get("sourceBookingId");
      if (!byBooking.has(id)) byBooking.set(id, []);
      byBooking.get(id).push(d);
    });
  }
  return byBooking;
}

/**
 * Price / paid amounts per student, kept in `studentFinancials/{studentDocId}`
 * (staff-only, never in the publicly readable `students` docs). Written in both
 * event and reconcile mode since it does not change access; only changed docs
 * are written.
 */
async function syncFinancials(admin, db, states, byBooking) {
  const targets = [];
  for (const state of states) {
    if (state.totalPrice === null || state.paidTotal === null) continue;
    for (const docSnap of byBooking.get(state.bookingId) || []) {
      targets.push({ ref: db.collection("studentFinancials").doc(docSnap.id), student: docSnap, state });
    }
  }
  if (!targets.length) return 0;

  const existing = new Map();
  for (let i = 0; i < targets.length; i += 300) {
    const snaps = await db.getAll(...targets.slice(i, i + 300).map((t) => t.ref));
    snaps.forEach((snap) => existing.set(snap.id, snap.exists ? snap.data() : null));
  }

  let written = 0;
  let batch = db.batch();
  let pending = 0;
  for (const t of targets) {
    const prev = existing.get(t.ref.id);
    const remaining = Math.max(0, Math.round((t.state.totalPrice - t.state.paidTotal) * 100) / 100);
    const data = {
      studentId: t.student.id,
      groupId: t.student.get("groupId") || null,
      sourceBookingId: t.state.bookingId,
      totalPrice: t.state.totalPrice,
      paidTotal: t.state.paidTotal,
      remaining,
      paidPercentage: t.state.paidPercentage,
      bookingStatus: t.state.status,
    };
    if (prev && Object.keys(data).every((k) => prev[k] === data[k])) continue;
    batch.set(t.ref, { ...data, currency: "EGP", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    written++;
    if (++pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  return written;
}

async function processStates(admin, db, states, mode, settings) {
  const now = new Date().toISOString();
  const applyChanges = mode === "event" || settings.reconcileMode === "apply";
  const byBooking = await findStudents(db, states.map((s) => s.bookingId));
  const result = { bookings: states.length, matchedStudents: 0, changed: 0, skipped: {}, changes: [] };
  try {
    result.financialsWritten = await syncFinancials(admin, db, states, byBooking);
  } catch (err) {
    // Display-only data: never let it block the access sync.
    console.error("accountingSync: financials sync failed", err);
    result.financialsWritten = 0;
  }
  const writes = [];

  for (const state of states) {
    const docs = byBooking.get(state.bookingId) || [];
    for (const docSnap of docs) {
      result.matchedStudents++;
      const student = docSnap.data();
      if (mode === "reconcile" && student.accountingSync?.stateHash === stateHash(state)) {
        result.skipped.unchanged_since_last_sync = (result.skipped.unchanged_since_last_sync || 0) + 1;
        continue;
      }
      const decision = decide(student, state);
      if (decision.skip) {
        result.skipped[decision.skip] = (result.skipped[decision.skip] || 0) + 1;
        continue;
      }
      result.changed++;
      if (result.changes.length < 300) {
        result.changes.push({
          studentId: docSnap.id,
          name: student.name || "",
          studentIdNum: student.studentIdNum || "",
          bookingId: state.bookingId,
          bookingStatus: state.status,
          paidPercentage: state.paidPercentage,
          action: decision.action,
          reason: decision.reason || "",
        });
      }
      if (applyChanges) writes.push({ ref: docSnap.ref, student, decision, state });
    }
  }

  for (let i = 0; i < writes.length; i += 200) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 200)) {
      batch.update(w.ref, buildUpdate(admin, w.decision, w.state, now));
      batch.set(db.collection("activityLogs").doc(), {
        action: w.decision.action === "activate" ? "STUDENT_ACCOUNTING_ACTIVATE" : "STUDENT_ACCOUNTING_DEACTIVATE",
        entityType: "student",
        entityId: w.ref.id,
        entityName: w.student.name || "",
        performedByUid: SYNC_UID,
        performedByName: SYNC_NAME,
        performedByRole: "system",
        details: {
          sourceBookingId: w.state.bookingId,
          bookingStatus: w.state.status,
          paidPercentage: w.state.paidPercentage,
          reason: w.decision.reason || null,
          mode,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  result.applied = applyChanges;
  return result;
}

async function handler(req, res, { admin, db, syncKey }) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!verifySignature(req, syncKey)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const body = req.body || {};
  const mode = body.mode === "reconcile" ? "reconcile" : "event";
  const rawList = Array.isArray(body.bookings) ? body.bookings : [];
  if (rawList.length > MAX_BOOKINGS_PER_REQUEST) {
    res.status(413).json({ error: "too_many_bookings" });
    return;
  }
  const states = rawList.map(cleanState).filter(Boolean);

  const settings = await loadSettings(db);
  if (!settings.enabled) {
    res.json({ ok: true, disabled: true });
    return;
  }
  if (!states.length) {
    res.json({ ok: true, bookings: 0 });
    return;
  }

  try {
    const result = await processStates(admin, db, states, mode, settings);

    if (mode === "reconcile" && body.runId && typeof body.runId === "string" && result.changed > 0) {
      // Accumulate the reconcile report so admins can review it before
      // switching settings/accountingSync.reconcileMode to "apply".
      const runId = body.runId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      if (runId) {
        const reportRef = db.doc(`accountingSyncReports/${runId}`);
        await reportRef.set({
          runId,
          applied: result.applied,
          updatedAt: new Date().toISOString(),
          changed: admin.firestore.FieldValue.increment(result.changed),
          changes: admin.firestore.FieldValue.arrayUnion(...result.changes.slice(0, 100)),
        }, { merge: true });
      }
    }

    console.log("accountingSync", JSON.stringify({
      mode, bookings: result.bookings, matched: result.matchedStudents,
      changed: result.changed, applied: result.applied, skipped: result.skipped,
      financialsWritten: result.financialsWritten,
    }));
    const { changes, ...summary } = result;
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error("accountingSync failed", err);
    res.status(500).json({ error: "sync_failed" });
  }
}

module.exports = { handler, decide, desiredOf, stateHash, cleanState, verifySignature, SYNC_UID };
