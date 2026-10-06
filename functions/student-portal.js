"use strict";

/**
 * Student portal login, done on the server.
 *
 * Until now the portal downloaded every `students` doc (passwords included)
 * into the browser to check a login. This endpoint does the same matching
 * with the Admin SDK and returns only the logged-in student's own records,
 * without passwords, plus a Firebase custom token for the portal's own
 * Firebase app (used by the stricter Firestore rules of the next phase).
 *
 * Matching and normalisation mirror pages/StudentPortal.tsx and
 * lib/textUtils.ts exactly, so who can log in does not change.
 *
 * Actions (POST JSON):
 *   { action: "login", loginId, password, exact? }  -> { records, primaryId, token }
 *   { action: "roster", groupId }                    -> { students: [{ id, name }] }
 */

const crypto = require("crypto");

const MAX_FAILURES = 30;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const SELECT_FIELDS = [
  "studentIdNum", "studentPassword", "email", "attendanceEmail", "phone", "name",
  "groupId", "loginCount", "firstLoginAt",
];

// ---- lib/textUtils.ts ------------------------------------------------------
const DIGIT_MAP = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
function normalizeDigits(input) {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[٠-٩۰-۹]/g, (c) => DIGIT_MAP[c] || c);
}
function stripHiddenChars(input) {
  if (!input) return "";
  return String(input)
    .normalize("NFKC")
    .replace(/[​-‍﻿⁠­]/g, "")
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/[   -   　]/g, " ");
}
function sanitizeEmail(email) {
  if (!email) return "";
  let c = normalizeDigits(stripHiddenChars(email));
  c = c.replace(/[＠﹫]/g, "@").replace(/[．。۔]/g, ".").replace(/[‐-―−]/g, "-");
  return c.replace(/\s+/g, "").toLowerCase().trim();
}
function sanitizePhone(phone) {
  if (!phone) return "";
  return normalizeDigits(stripHiddenChars(phone)).replace(/[^\d+]/g, "").trim();
}
function sanitizeCredentials(value) {
  if (!value) return "";
  return normalizeDigits(stripHiddenChars(value)).trim();
}

// ---- utils.ts normalizePhoneNumber -----------------------------------------
function normalizePhoneNumber(raw) {
  if (!raw) return "";
  let cleaned = String(raw).trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.substring(2);
  if (cleaned.startsWith("+")) return cleaned;
  if (/^01[0125]\d{8}$/.test(cleaned)) return `+20${cleaned.substring(1)}`;
  if (/^1[0125]\d{8}$/.test(cleaned)) return `+20${cleaned}`;
  if (cleaned.startsWith("20") && cleaned.length >= 11 && cleaned.length <= 13) return `+${cleaned}`;
  if (/^[3-9]\d{9,14}$/.test(cleaned)) return `+${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("0")) return `+20${cleaned.substring(1)}`;
  if (cleaned.length === 10) return `+20${cleaned}`;
  return cleaned;
}
// -----------------------------------------------------------------------------

function publicRecord(doc) {
  const { studentPassword, ...rest } = doc.data();
  return { id: doc.id, ...rest };
}

function clientIp(req) {
  const fwd = String(req.get("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || req.ip || "unknown";
}

async function tooManyFailures(db, ipKey) {
  const snap = await db.doc(`portalLoginThrottle/${ipKey}`).get();
  if (!snap.exists) return false;
  const { count = 0, windowStart = 0 } = snap.data();
  return Date.now() - windowStart < FAILURE_WINDOW_MS && count >= MAX_FAILURES;
}

async function recordFailure(db, ipKey) {
  const ref = db.doc(`portalLoginThrottle/${ipKey}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    if (!data || now - (data.windowStart || 0) >= FAILURE_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
    } else {
      tx.update(ref, { count: (data.count || 0) + 1 });
    }
  });
}

/** Same rule as handleStudentLogin: by Student ID, email, or phone. */
function matchesLoginInput(s, input) {
  const sIdNum = sanitizeCredentials(s.studentIdNum);
  const sEmail = sanitizeEmail(s.email || s.attendanceEmail);
  const sPhone = normalizePhoneNumber(s.phone) || sanitizePhone(s.phone);
  const matchId = sIdNum && sIdNum.toLowerCase() === input.cleanInput.toLowerCase();
  const matchEmail = sEmail && sEmail === input.cleanInputLower;
  const matchPhone = input.normInputPhone && sPhone &&
    (sPhone === input.normInputPhone || sPhone.endsWith(input.normInputPhone) || input.normInputPhone.endsWith(sPhone));
  return Boolean(matchId || matchEmail || matchPhone);
}

/** Same rule as loadStudentSessionAndGroups: records of the same person. */
function samePerson(primary, s) {
  const normP = normalizePhoneNumber(primary.phone);
  const normE = String(primary.email || primary.attendanceEmail || "").trim().toLowerCase();
  const sIdNum = String(primary.studentIdNum || "").trim();
  const curIdNum = String(s.studentIdNum || "").trim();
  const curE = String(s.email || s.attendanceEmail || "").trim().toLowerCase();
  const curP = normalizePhoneNumber(s.phone);
  return Boolean(
    (sIdNum && curIdNum === sIdNum) ||
    (normE && curE === normE) ||
    (normP && curP && (curP === normP || curP.endsWith(normP) || normP.endsWith(curP)))
  );
}

async function login(req, res, { admin, db }) {
  const body = req.body || {};
  const loginId = typeof body.loginId === "string" ? body.loginId.slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!loginId || !password) {
    res.status(400).json({ error: "missing_credentials" });
    return;
  }

  const ipKey = crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 32);
  if (await tooManyFailures(db, ipKey)) {
    res.status(429).json({ error: "too_many_attempts" });
    return;
  }

  const cleanInput = sanitizeCredentials(loginId);
  const input = {
    cleanInput,
    cleanInputLower: sanitizeEmail(loginId) || cleanInput.toLowerCase(),
    normInputPhone: normalizePhoneNumber(cleanInput) || sanitizePhone(cleanInput),
  };
  const cleanPassword = sanitizeCredentials(password);

  // Same cost as the old client-side scan, but only the needed fields and
  // nothing leaves the server except the matched student's own records.
  const all = await db.collection("students").select(...SELECT_FIELDS).get();
  const docs = all.docs;

  let primaryDoc;
  if (body.exact === true) {
    // Auto/test login from a link: exact Student ID + password only.
    primaryDoc = docs.find((d) => {
      const s = d.data();
      return sanitizeCredentials(s.studentIdNum).toLowerCase() === cleanInput.toLowerCase() &&
        sanitizeCredentials(s.studentPassword) === cleanPassword;
    });
    if (!primaryDoc) {
      await recordFailure(db, ipKey);
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
  } else {
    const matching = docs.filter((d) => matchesLoginInput(d.data(), input));
    if (!matching.length) {
      await recordFailure(db, ipKey);
      res.status(401).json({ error: cleanInput.includes("@") ? "email_used_instead_of_id" : "unknown_student" });
      return;
    }
    primaryDoc = matching.find((d) => sanitizeCredentials(d.get("studentPassword")) === cleanPassword);
    if (!primaryDoc) {
      await recordFailure(db, ipKey);
      res.status(401).json({ error: "wrong_password" });
      return;
    }
  }

  const primary = primaryDoc.data();
  const related = docs.filter((d) => samePerson(primary, d.data()));
  const records = related.length ? related : [primaryDoc];

  // Unify credentials and record the login, as the portal did client-side.
  const unifiedId = primary.studentIdNum || records.map((d) => d.get("studentIdNum")).find(Boolean) ||
    String(Math.floor(100000 + Math.random() * 900000));
  const unifiedPass = primary.studentPassword || records.map((d) => d.get("studentPassword")).find(Boolean) ||
    String(Math.floor(10000 + Math.random() * 90000));
  const now = new Date().toISOString();
  const batch = db.batch();
  const out = [];
  for (const d of records) {
    const s = d.data();
    const updates = { hasLoggedIn: true, lastLoginAt: now, loginCount: (s.loginCount || 0) + 1 };
    if (!s.firstLoginAt) updates.firstLoginAt = now;
    if (s.studentIdNum !== unifiedId || s.studentPassword !== unifiedPass) {
      updates.studentIdNum = unifiedId;
      updates.studentPassword = unifiedPass;
    }
    batch.update(d.ref, updates);
    out.push(d.ref);
  }
  await batch.commit();

  // Full docs (minus password) for the portal UI.
  const fresh = await db.getAll(...out);
  const publicRecords = fresh.filter((d) => d.exists).map(publicRecord);

  // Custom token for the portal's own Firebase app. Firestore rules let it
  // read/update only students docs whose studentIdNum equals `sidn` (all of
  // this student's records were just unified to it).
  let token = null;
  try {
    token = await admin.auth().createCustomToken(`student_${primaryDoc.id}`.slice(0, 128), {
      portal: "student",
      sidn: String(unifiedId),
    });
  } catch (err) {
    console.error("studentPortal: custom token failed", err.message || err);
    res.status(500).json({ error: "token_failed" });
    return;
  }

  res.json({ ok: true, primaryId: primaryDoc.id, records: publicRecords, token });
}

async function roster(req, res, { db }) {
  const groupId = typeof req.body?.groupId === "string" ? req.body.groupId.trim() : "";
  if (!groupId || groupId.length > 128 || groupId.includes("/")) {
    res.status(400).json({ error: "missing_group" });
    return;
  }
  const snap = await db.collection("students").where("groupId", "==", groupId).select("name").get();
  res.json({ ok: true, students: snap.docs.map((d) => ({ id: d.id, name: d.get("name") || "" })) });
}

async function handler(req, res, ctx) {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const action = req.body?.action;
    if (action === "login") return await login(req, res, ctx);
    if (action === "roster") return await roster(req, res, ctx);
    res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.error("studentPortal failed", err);
    res.status(500).json({ error: "server_error" });
  }
}

module.exports = { handler, matchesLoginInput, samePerson, normalizePhoneNumber, sanitizeEmail };
