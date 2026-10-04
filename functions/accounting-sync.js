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
    // Used only to link students imported without a sourceBookingId.
    customerId: typeof raw.customerId === "string" ? raw.customerId.slice(0, 128) : null,
    groupId: typeof raw.groupId === "string" ? raw.groupId.slice(0, 128) : null,
    phones: Array.isArray(raw.phones)
      ? [...new Set(raw.phones.filter((p) => typeof p === "string" && /^\+?\d{8,15}$/.test(p)))].slice(0, 12)
      : [],
    customerBookingCount: Number.isInteger(raw.customerBookingCount) ? raw.customerBookingCount : null,
  };
}

/** Same variants the accounting side sends ("01…", "+201…", "201…", "+intl"). */
function phoneVariants(raw) {
  if (raw === null || raw === undefined) return [];
  let d = String(raw)
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  const eg = d.match(/^(?:20|0)?(1[0125]\d{8})$/);
  if (eg) return ["0" + eg[1], "+20" + eg[1], "20" + eg[1]];
  return d.length >= 8 ? ["+" + d, d] : [];
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

/**
 * Links students that were imported without a sourceBookingId to their
 * booking, by WhatsApp/phone. A link is made only when it is unambiguous:
 *  1. phone + group: the student's training group came from the booking's
 *     accounting group (groups.sourceGroupId) and exactly one such student;
 *  2. phone only: when no group matches, only if the customer has a single
 *     live booking, exactly one unlinked student has that phone, and that
 *     student's group is not tied to another accounting group.
 * A student claimed by two bookings is never linked. Nothing about access
 * changes in the request that creates the link (reported as newly_linked).
 */
async function linkByPhone(admin, db, states, byBooking) {
  const out = { linked: 0, ambiguous: 0, noMatch: 0, newlyLinked: new Set(), samples: [] };
  const pending = states.filter((st) =>
    st.status !== "DELETED" && st.phones.length && !(byBooking.get(st.bookingId) || []).length);
  if (!pending.length) return out;

  // Unlinked students whose phone or WhatsApp matches any of the phones.
  const allPhones = [...new Set(pending.flatMap((st) => st.phones))];
  const candidates = new Map();
  for (let i = 0; i < allPhones.length; i += 30) {
    const chunk = allPhones.slice(i, i + 30);
    for (const field of ["phone", "whatsapp"]) {
      const snap = await db.collection("students").where(field, "in", chunk).get();
      snap.docs.forEach((d) => {
        if (!d.get("sourceBookingId")) candidates.set(d.id, d);
      });
    }
  }
  if (!candidates.size) {
    out.noMatch = pending.length;
    return out;
  }

  const byPhone = new Map();
  for (const [id, d] of candidates) {
    for (const v of [...phoneVariants(d.get("phone")), ...phoneVariants(d.get("whatsapp"))]) {
      if (!byPhone.has(v)) byPhone.set(v, new Set());
      byPhone.get(v).add(id);
    }
  }

  const groupIds = [...new Set([...candidates.values()].map((d) => d.get("groupId")).filter(Boolean))];
  const sourceGroupOf = new Map();
  for (let i = 0; i < groupIds.length; i += 300) {
    const snaps = await db.getAll(...groupIds.slice(i, i + 300).map((g) => db.collection("groups").doc(g)));
    snaps.forEach((g) => sourceGroupOf.set(g.id, (g.exists && g.get("sourceGroupId")) || ""));
  }
  const srcGroup = (studentId) => sourceGroupOf.get(candidates.get(studentId).get("groupId")) || "";

  const claims = new Map(); // studentId -> [{ state, method }]
  for (const st of pending) {
    const ids = new Set();
    st.phones.forEach((p) => (byPhone.get(p) || []).forEach((id) => ids.add(id)));
    if (!ids.size) {
      out.noMatch++;
      continue;
    }
    const list = [...ids];
    const sameGroup = st.groupId ? list.filter((id) => srcGroup(id) === st.groupId) : [];
    let pick = null;
    let method = null;
    if (sameGroup.length === 1) {
      pick = sameGroup[0];
      method = "phone_group";
    } else if (sameGroup.length === 0 && list.length === 1 && st.customerBookingCount === 1 && !srcGroup(list[0])) {
      pick = list[0];
      method = "phone_only";
    }
    if (!pick) {
      out.ambiguous++;
      if (out.samples.length < 50) out.samples.push({ bookingId: st.bookingId, candidates: list.slice(0, 5) });
      continue;
    }
    if (!claims.has(pick)) claims.set(pick, []);
    claims.get(pick).push({ st, method });
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const [studentId, list] of claims) {
    if (list.length !== 1) {
      out.ambiguous += list.length;
      continue;
    }
    const { st, method } = list[0];
    const snap = candidates.get(studentId);
    const update = {
      sourceBookingId: st.bookingId,
      accountingLink: { method, bookingId: st.bookingId, linkedAt: now },
    };
    if (st.customerId && !snap.get("sourceCustomerId")) update.sourceCustomerId = st.customerId;
    batch.update(snap.ref, update);
    byBooking.set(st.bookingId, [snap]);
    out.newlyLinked.add(studentId);
    out.linked++;
  }
  if (out.linked) await batch.commit();
  return out;
}

async function processStates(admin, db, states, mode, settings) {
  const now = new Date().toISOString();
  const applyChanges = mode === "event" || settings.reconcileMode === "apply";
  const byBooking = await findStudents(db, states.map((s) => s.bookingId));
  const result = { bookings: states.length, matchedStudents: 0, changed: 0, skipped: {}, changes: [] };
  let newlyLinked = new Set();
  try {
    const link = await linkByPhone(admin, db, states, byBooking);
    newlyLinked = link.newlyLinked;
    result.phoneLink = { linked: link.linked, ambiguous: link.ambiguous, noMatch: link.noMatch, samples: link.samples };
  } catch (err) {
    console.error("accountingSync: phone linking failed", err);
  }
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
      if (newlyLinked.has(docSnap.id)) {
        result.skipped.newly_linked = (result.skipped.newly_linked || 0) + 1;
        continue;
      }
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

    const linkStats = result.phoneLink || {};
    if (mode === "reconcile" && body.runId && typeof body.runId === "string" &&
        (result.changed > 0 || linkStats.linked > 0 || linkStats.ambiguous > 0)) {
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
          ...(result.changes.length ? { changes: admin.firestore.FieldValue.arrayUnion(...result.changes.slice(0, 100)) } : {}),
          phoneLinked: admin.firestore.FieldValue.increment(linkStats.linked || 0),
          phoneAmbiguous: admin.firestore.FieldValue.increment(linkStats.ambiguous || 0),
          ...(linkStats.samples?.length ? { phoneAmbiguousSamples: admin.firestore.FieldValue.arrayUnion(...linkStats.samples.slice(0, 50)) } : {}),
        }, { merge: true });
      }
    }

    console.log("accountingSync", JSON.stringify({
      mode, bookings: result.bookings, matched: result.matchedStudents,
      changed: result.changed, applied: result.applied, skipped: result.skipped,
      financialsWritten: result.financialsWritten,
      phoneLink: result.phoneLink && { linked: result.phoneLink.linked, ambiguous: result.phoneLink.ambiguous, noMatch: result.phoneLink.noMatch },
    }));
    const { changes, ...summary } = result;
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error("accountingSync failed", err);
    res.status(500).json({ error: "sync_failed" });
  }
}

module.exports = { handler, decide, desiredOf, stateHash, cleanState, verifySignature, SYNC_UID };
