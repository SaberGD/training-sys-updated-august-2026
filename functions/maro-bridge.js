"use strict";

const crypto = require("crypto");

const STAFF_ROLES = new Set(["admin", "supervisor", "coordinator", "team_leader", "trainer"]);
const DEFAULT_SYNC_URL = "https://ai.sabergroupacademy.com/api/training-sync.php";
const DEFAULT_RECONCILE_URL = "https://ai.sabergroupacademy.com/api/account-source-reconcile.php";
const OWNER_EMAIL = "saber.gd.fl@gmail.com";

function translateDigits(value) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabic.indexOf(digit);
    return String(arabicIndex >= 0 ? arabicIndex : persian.indexOf(digit));
  });
}

function normalizeIdentifier(value) {
  return translateDigits(value).trim().toLowerCase();
}

function normalizePhone(value) {
  const digits = translateDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0020")) return `0${digits.slice(4)}`;
  if (digits.startsWith("20")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function stableHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function uniqueDocuments(documents) {
  const map = new Map();
  documents.forEach((doc) => {
    if (doc && doc.id) map.set(doc.id, doc);
  });
  return Array.from(map.values());
}

async function queryStudents(db, identifier) {
  const normalized = normalizeIdentifier(identifier);
  const phone = normalizePhone(identifier);
  const snapshots = [];

  const addQuery = async (field, value) => {
    if (!value) return;
    const snap = await db.collection("students").where(field, "==", value).limit(50).get();
    snapshots.push(...snap.docs);
  };

  await Promise.all([
    addQuery("studentIdNum", String(identifier || "").trim()),
    addQuery("studentIdNum", normalized),
    normalized.includes("@") ? addQuery("email", normalized) : Promise.resolve(),
    normalized.includes("@") ? addQuery("attendanceEmail", normalized) : Promise.resolve(),
    phone ? addQuery("phone", phone) : Promise.resolve(),
    phone ? addQuery("whatsapp", phone) : Promise.resolve(),
  ]);

  if (snapshots.length === 0) {
    const fallback = await db.collection("students").limit(5000).get();
    fallback.docs.forEach((doc) => {
      const data = doc.data();
      const id = normalizeIdentifier(data.studentIdNum || "");
      const email = normalizeIdentifier(data.email || data.attendanceEmail || "");
      const studentPhone = normalizePhone(data.phone || data.whatsapp || "");
      if (
        (id && id === normalized) ||
        (email && email === normalized) ||
        (phone && studentPhone && studentPhone === phone)
      ) snapshots.push(doc);
    });
  }

  return uniqueDocuments(snapshots);
}

async function findSiblingStudents(db, primaryDocs) {
  const docs = [...primaryDocs];
  const values = new Map();

  primaryDocs.forEach((doc) => {
    const data = doc.data();
    const id = String(data.studentIdNum || "").trim();
    const email = normalizeIdentifier(data.email || data.attendanceEmail || "");
    const phone = normalizePhone(data.phone || data.whatsapp || "");
    if (id) values.set(`studentIdNum:${id}`, ["studentIdNum", id]);
    if (email) {
      values.set(`email:${email}`, ["email", email]);
      values.set(`attendanceEmail:${email}`, ["attendanceEmail", email]);
    }
    if (phone) {
      values.set(`phone:${phone}`, ["phone", phone]);
      values.set(`whatsapp:${phone}`, ["whatsapp", phone]);
    }
  });

  await Promise.all(Array.from(values.values()).map(async ([field, value]) => {
    const snap = await db.collection("students").where(field, "==", value).limit(50).get();
    docs.push(...snap.docs);
  }));

  return uniqueDocuments(docs);
}

async function loadGroups(db, groupIds) {
  const ids = Array.from(new Set(groupIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const refs = ids.map((id) => db.collection("groups").doc(id));
  const snapshots = await db.getAll(...refs);
  return snapshots.filter((snap) => snap.exists).map((snap) => ({ id: snap.id, ...snap.data() }));
}

function isArchivedGroup(group) {
  return group.archived === true || group.isArchived === true || group.status === "archived";
}

function studentEntitlements(stage) {
  if (stage === "current_student") {
    return ["chat", "trainer_maro", "technical_help", "creative_block", "design_review"];
  }
  if (stage === "alumni") return ["chat", "technical_help", "creative_block"];
  return [];
}

function staffEntitlements() {
  return [
    "chat", "trainer_maro", "technical_help", "creative_block", "design_review",
    "prompt_studio", "image_to_prompt", "learn_from_design", "generate_brief",
  ];
}

async function buildStudentProfile(db, initialDocs) {
  const docs = await findSiblingStudents(db, initialDocs);
  if (docs.length === 0) return null;

  const records = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const isPortalEligible = (record) => (
    record.deactivated !== true &&
    record.permanentDeactivation !== true &&
    record.is50PercentPaid !== false
  );
  const primary = records.find(isPortalEligible) || records.find((record) => !record.deactivated) || records[0];
  const groupIds = records.map((record) => record.groupId).filter(Boolean);
  const groups = await loadGroups(db, groupIds);
  const hasPortalEligibleRecord = records.some(isPortalEligible);
  const hasActiveGroup = groups.some((group) => !isArchivedGroup(group));

  let lifecycleStage = "alumni";
  if (!hasPortalEligibleRecord) lifecycleStage = "suspended";
  else if (hasActiveGroup) lifecycleStage = "current_student";

  const loginId = String(primary.studentIdNum || "").trim();
  const identitySeed = loginId || normalizeIdentifier(primary.email || "") || normalizePhone(primary.phone || "") || primary.id;

  return {
    schemaVersion: 1,
    identityId: `training-student-${stableHash(identitySeed)}`,
    sourceSystem: "training",
    sourceType: "student",
    sourceId: primary.id,
    sourceRole: "student",
    loginId: loginId || normalizePhone(primary.phone || "") || normalizeIdentifier(primary.email || ""),
    name: String(primary.name || "متدرب صابر جروب"),
    email: normalizeIdentifier(primary.email || primary.attendanceEmail || ""),
    phone: normalizePhone(primary.phone || primary.whatsapp || ""),
    lifecycleStage,
    accessTier: lifecycleStage === "current_student" ? "student_current" : "student_alumni",
    active: lifecycleStage !== "suspended",
    groupIds: Array.from(new Set(groupIds)),
    groupNames: Array.from(new Set(groups.map((group) => group.name || group.batchCode).filter(Boolean))),
    courseIds: Array.from(new Set(groups.map((group) => group.courseId).filter(Boolean))),
    courseNames: Array.from(new Set(groups.map((group) => group.courseName).filter(Boolean))),
    entitlements: studentEntitlements(lifecycleStage),
    syncedAt: new Date().toISOString(),
  };
}

function buildStaffProfile(doc, authUser) {
  const data = doc.data();
  const email = normalizeIdentifier(data.email || authUser?.email || "");
  if (email === OWNER_EMAIL) return null;
  const sourceRole = STAFF_ROLES.has(data.role) ? data.role : "trainer";
  const accessTier = ["admin", "supervisor", "coordinator"].includes(sourceRole) ? "team_plus" : "team";
  return {
    schemaVersion: 1,
    identityId: `training-staff-${doc.id}`,
    sourceSystem: "training",
    sourceType: "staff",
    sourceId: doc.id,
    sourceRole,
    loginId: email,
    name: String(data.name || authUser?.displayName || "فريق صابر جروب"),
    email,
    phone: normalizePhone(data.phone || authUser?.phoneNumber || ""),
    lifecycleStage: data.disabled || authUser?.disabled ? "suspended" : "staff_active",
    accessTier,
    active: !(data.disabled || authUser?.disabled),
    groupIds: [],
    groupNames: [],
    courseIds: [],
    courseNames: [],
    entitlements: staffEntitlements(),
    syncedAt: new Date().toISOString(),
  };
}

async function verifyStaffPassword(admin, webApiKey, email, password) {
  if (!webApiKey || !email.includes("@")) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) return null;
  const result = await response.json();
  return admin.auth().getUser(result.localId);
}

async function enforceAuthRateLimit(db, req, identifier) {
  const forwarded = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const id = stableHash(`${forwarded}|${normalizeIdentifier(identifier)}|${bucket}`);
  const ref = db.collection("maro_auth_limits").doc(id);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const count = snap.exists ? Number(snap.data().count || 0) : 0;
    if (count >= 12) return false;
    transaction.set(ref, {
      count: count + 1,
      expiresAt: new Date((bucket + 2) * 10 * 60 * 1000),
      updatedAt: new Date(),
    }, { merge: true });
    return true;
  });
}

async function authenticate(req, res, context) {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const suppliedKey = req.get("x-maro-bridge-key") || "";
  if (!safeEqual(suppliedKey, context.bridgeKey)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!identifier || !password || identifier.length > 160 || password.length > 160) {
    return res.status(400).json({ error: "INVALID_CREDENTIALS" });
  }

  if (!(await enforceAuthRateLimit(context.db, req, identifier))) {
    return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });
  }

  const normalized = normalizeIdentifier(identifier);

  if (normalized.includes("@")) {
    const authUser = await verifyStaffPassword(context.admin, context.webApiKey, normalized, password);
    if (authUser) {
      const userDoc = await context.db.collection("users").doc(authUser.uid).get();
      if (userDoc.exists && STAFF_ROLES.has(userDoc.data().role)) {
        const profile = buildStaffProfile(userDoc, authUser);
        if (!profile) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
        if (!profile.active) return res.status(403).json({ error: "ACCOUNT_SUSPENDED" });
        await queueAndDeliverProfile(context.db, profile, context.bridgeKey);
        return res.json({ profile });
      }
    }
  }

  const students = await queryStudents(context.db, identifier);
  const validStudent = students.find((doc) => safeEqual(String(doc.data().studentPassword || "").trim(), password));
  if (!validStudent) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const profile = await buildStudentProfile(context.db, students);
  if (!profile) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  if (!profile.active) return res.status(403).json({ error: "ACCOUNT_SUSPENDED" });

  await queueAndDeliverProfile(context.db, profile, context.bridgeKey);
  return res.json({ profile });
}

async function deliverProfile(profile, bridgeKey) {
  if (!bridgeKey) return { delivered: false, status: 0 };
  const response = await fetch(process.env.MARO_SYNC_URL || DEFAULT_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Maro-Bridge-Key": bridgeKey,
    },
    body: JSON.stringify({ profile }),
  });
  return { delivered: response.ok, status: response.status };
}

async function reconcileMaroAccounts(profiles, bridgeKey, action = "preview") {
  if (!bridgeKey) throw new Error("MARO_BRIDGE_KEY is missing");
  const allowedIdentityIds = Array.from(new Set(
    profiles
      .filter((profile) => profile?.active && String(profile.identityId || "").startsWith("training-"))
      .map((profile) => profile.identityId),
  ));
  if (allowedIdentityIds.length === 0) throw new Error("Training allowlist is empty");

  const apply = action === "apply";
  const response = await fetch(process.env.MARO_RECONCILE_URL || DEFAULT_RECONCILE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Maro-Bridge-Key": bridgeKey,
    },
    body: JSON.stringify({
      action: apply ? "apply" : "preview",
      confirm: apply ? "DELETE_NON_TRAINING_ACCOUNTS" : undefined,
      allowedIdentityIds,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Maro account reconciliation failed (${response.status})`);
  }
  return payload;
}

async function queueAndDeliverProfile(db, profile, bridgeKey) {
  const ref = db.collection("maro_sync_outbox").doc(profile.identityId);
  await ref.set({
    profile,
    status: "pending",
    attempts: 0,
    updatedAt: new Date(),
  }, { merge: true });

  try {
    const result = await deliverProfile(profile, bridgeKey);
    await ref.set({
      status: result.delivered ? "delivered" : "pending",
      attempts: 1,
      lastHttpStatus: result.status,
      lastAttemptAt: new Date(),
      deliveredAt: result.delivered ? new Date() : null,
    }, { merge: true });
  } catch (error) {
    await ref.set({
      status: "pending",
      attempts: 1,
      lastError: String(error?.message || error).slice(0, 300),
      lastAttemptAt: new Date(),
    }, { merge: true });
  }
  return profile;
}

async function syncStudentById(db, studentId, bridgeKey) {
  const snap = await db.collection("students").doc(studentId).get();
  if (!snap.exists) return null;
  const profile = await buildStudentProfile(db, [snap]);
  return profile ? queueAndDeliverProfile(db, profile, bridgeKey) : null;
}

async function syncStaffById(admin, db, userId, bridgeKey) {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists || !STAFF_ROLES.has(snap.data().role)) return null;
  let authUser = null;
  try { authUser = await admin.auth().getUser(userId); } catch (_) {}
  const profile = buildStaffProfile(snap, authUser);
  return profile ? queueAndDeliverProfile(db, profile, bridgeKey) : null;
}

async function syncGroupStudents(db, groupId, bridgeKey) {
  const students = await db.collection("students").where("groupId", "==", groupId).get();
  const seen = new Set();
  for (const doc of students.docs) {
    const profile = await buildStudentProfile(db, [doc]);
    if (!profile || seen.has(profile.identityId)) continue;
    seen.add(profile.identityId);
    await queueAndDeliverProfile(db, profile, bridgeKey);
  }
  return seen.size;
}

async function reconcile(db, bridgeKey) {
  const pending = await db.collection("maro_sync_outbox").where("status", "==", "pending").limit(200).get();
  for (const doc of pending.docs) {
    const data = doc.data();
    if (!data.profile) continue;
    try {
      const result = await deliverProfile(data.profile, bridgeKey);
      await doc.ref.set({
        status: result.delivered ? "delivered" : "pending",
        attempts: Number(data.attempts || 0) + 1,
        lastHttpStatus: result.status,
        lastAttemptAt: new Date(),
        deliveredAt: result.delivered ? new Date() : null,
      }, { merge: true });
    } catch (error) {
      await doc.ref.set({
        attempts: Number(data.attempts || 0) + 1,
        lastError: String(error?.message || error).slice(0, 300),
        lastAttemptAt: new Date(),
      }, { merge: true });
    }
  }
  return pending.size;
}

function buildStudentClusters(studentDocs) {
  const parent = new Map();
  const owner = new Map();
  const find = (id) => {
    const current = parent.get(id);
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };

  studentDocs.forEach((doc) => parent.set(doc.id, doc.id));
  studentDocs.forEach((doc) => {
    const data = doc.data();
    const tokens = [
      String(data.studentIdNum || "").trim() ? `id:${normalizeIdentifier(data.studentIdNum)}` : "",
      normalizeIdentifier(data.email || data.attendanceEmail || "") ? `email:${normalizeIdentifier(data.email || data.attendanceEmail)}` : "",
      normalizePhone(data.phone || data.whatsapp || "") ? `phone:${normalizePhone(data.phone || data.whatsapp)}` : "",
    ].filter(Boolean);
    tokens.forEach((token) => {
      if (owner.has(token)) union(doc.id, owner.get(token));
      else owner.set(token, doc.id);
    });
  });

  const clusters = new Map();
  studentDocs.forEach((doc) => {
    const root = find(doc.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(doc);
  });
  return Array.from(clusters.values());
}

async function runMigration(db, admin, bridgeKey, { deliver = false, accountReconciliation = "none" } = {}) {
  const startedAt = new Date();
  const runId = `migration_${startedAt.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  const [studentSnapshot, staffSnapshot] = await Promise.all([
    db.collection("students").get(),
    db.collection("users").get(),
  ]);
  const clusters = buildStudentClusters(studentSnapshot.docs);
  const duplicateStudentClusters = clusters
    .filter((cluster) => cluster.length > 1)
    .map((cluster) => cluster.map((doc) => doc.id));
  const invalidStudents = [];
  const profiles = [];
  const seenProfiles = new Set();

  for (let index = 0; index < clusters.length; index += 8) {
    await Promise.all(clusters.slice(index, index + 8).map(async (cluster) => {
      const data = cluster[0].data();
      const hasIdentity = Boolean(
        String(data.studentIdNum || "").trim() ||
        normalizeIdentifier(data.email || data.attendanceEmail || "") ||
        normalizePhone(data.phone || data.whatsapp || ""),
      );
      if (!hasIdentity) {
        invalidStudents.push(cluster.map((doc) => doc.id));
        return;
      }
      const profile = await buildStudentProfile(db, cluster);
      if (profile && !seenProfiles.has(profile.identityId)) {
        seenProfiles.add(profile.identityId);
        profiles.push(profile);
      }
    }));
  }

  const staffProfiles = [];
  const skippedStaff = [];
  for (const doc of staffSnapshot.docs) {
    if (!STAFF_ROLES.has(doc.data().role)) continue;
    const profile = buildStaffProfile(doc, null);
    if (!profile) {
      skippedStaff.push({ id: doc.id, reason: "protected_owner" });
      continue;
    }
    if (!profile.email) {
      skippedStaff.push({ id: doc.id, reason: "missing_email" });
      continue;
    }
    staffProfiles.push(profile);
  }

  const allProfiles = [...profiles, ...staffProfiles];
  const activeProfiles = allProfiles.filter((profile) => profile.active);
  const delivery = { requested: deliver, delivered: 0, pending: 0 };
  if (deliver) {
    const deliveryProfiles = accountReconciliation === "apply" ? activeProfiles : allProfiles;
    for (let index = 0; index < deliveryProfiles.length; index += 5) {
      await Promise.all(deliveryProfiles.slice(index, index + 5).map(async (profile) => {
        await queueAndDeliverProfile(db, profile, bridgeKey);
        const outbox = await db.collection("maro_sync_outbox").doc(profile.identityId).get();
        if (outbox.data()?.status === "delivered") delivery.delivered += 1;
        else delivery.pending += 1;
      }));
    }
  }
  if (accountReconciliation === "apply" && delivery.pending > 0) {
    throw new Error(`Refusing cleanup because ${delivery.pending} Training profiles were not delivered`);
  }

  let accountCleanup = null;
  if (accountReconciliation !== "none") {
    accountCleanup = await reconcileMaroAccounts(activeProfiles, bridgeKey, accountReconciliation);
  }

  const report = {
    runId,
    mode: accountReconciliation !== "none" ? `reconcile_${accountReconciliation}` : (deliver ? "migrate" : "audit"),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    students: {
      recordsScanned: studentSnapshot.size,
      accountsPrepared: profiles.length,
      duplicateRecordClusters: duplicateStudentClusters,
      invalidIdentityClusters: invalidStudents,
    },
    staff: {
      recordsScanned: staffSnapshot.size,
      accountsPrepared: staffProfiles.length,
      skipped: skippedStaff,
    },
    delivery,
    accountCleanup,
  };
  await db.collection("maro_migration_runs").doc(runId).set(report);
  return report;
}

async function migrationHandler(req, res, context) {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!safeEqual(req.get("x-maro-bridge-key") || "", context.bridgeKey)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  const requestedAction = String(req.body?.action || "audit");
  const action = ["audit", "migrate", "reconcile_preview", "reconcile_apply"].includes(requestedAction)
    ? requestedAction
    : "audit";
  try {
    const report = await runMigration(context.db, context.admin, context.bridgeKey, {
      deliver: action === "migrate" || action === "reconcile_apply",
      accountReconciliation: action === "reconcile_apply" ? "apply" : (action === "reconcile_preview" ? "preview" : "none"),
    });
    return res.json({ ok: true, report });
  } catch (error) {
    console.error("Maro migration failed", error);
    return res.status(500).json({ error: "MIGRATION_FAILED" });
  }
}

module.exports = {
  authenticate,
  migrationHandler,
  reconcile,
  reconcileMaroAccounts,
  runMigration,
  syncGroupStudents,
  syncStaffById,
  syncStudentById,
};
