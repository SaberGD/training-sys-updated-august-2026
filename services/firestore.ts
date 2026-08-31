
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { getApiEndpoint } from '../lib/apiConfig';
import { normalizePhoneNumber } from '../utils';
import { 
  User, UserRole, Group, Course, Student, Session, 
  LectureEvaluation, FinalProject, Penalty, GroupRanking, Attendance, ActivityLog,
  ScheduleItem, DailyTrainerOps, SessionMeta, Week, WeekDay,
  MarketingCategory, MarketingResource, MarketingSectionTemplate,
  AssignedTask, RecurringTaskTemplate, TrainerDailyReport,
  RolePermissions, PerformanceDailyReport, PerformanceWeeklyReport,
  AppNotification, TaskStatus, TaskPriority, SubTask, TaskFile, TaskComment,
  StudentFollowUp, FollowUpComment, FollowUpUpdate, FollowUpMention, FollowUpEscalation, FollowUpEventType,
  FollowUpSuggestionRejection, FollowUpSuggestionExemption, SuggestionEscalation,
  Complaint, ComplaintStatus, LabelDefinition,
  CourseChecklistItemTemplate, TrainerPlan, GroupChecklistItem, GroupExecutionPlan,
  LectureFeedback, GraduationProject, GraduationProjectSubmission, GraduationProjectEvaluation, GraduationProjectComment,
  StudentWeaknessPoint
} from '../types';

const { 
  collection, doc, setDoc, getDoc, getDocs, query, where, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, 
  onSnapshot, orderBy, limit, arrayUnion, arrayRemove 
} = firestore as any;

export const logActivity = async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      ...log,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

export const subscribeToCollection = <T,>(
  collName: string, 
  callback: (data: T[]) => void, 
  qParams?: any[],
  onError?: (error: any) => void
) => {
  try {
    const q = query(collection(db, collName), ...(qParams || []));
    return onSnapshot(q, 
      (snapshot: any) => {
        const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
        callback(items);
      },
      (error: any) => {
        console.error(`[Firestore Subscription Error] ${collName}:`, error);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    console.error(`[Firestore Query Build Error] ${collName}:`, error);
    if (onError) onError(error);
    return () => {};
  }
};

export const getDocument = async <T,>(collName: string, docId: string): Promise<T | null> => {
  const docRef = doc(db, collName, docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as T;
  return null;
};

const ADMIN_EMAILS = [
  'saber.gd.fl@gmail.com',
  'sabergroup.eg@gmail.com'
];

export const getOrCreateUser = async (uid: string, email: string, name: string): Promise<User> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail);

  const existing = await getDocument<User>('users', uid);
  if (existing) {
    if (isDefaultAdmin && existing.role !== 'admin') {
      try {
        await updateDoc(doc(db, 'users', uid), {
          role: 'admin',
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to auto-promote admin in firestore:", err);
      }
      existing.role = 'admin';
    }
    return existing;
  }
  
  const newUser: Partial<User> = {
    uid,
    name,
    email,
    role: isDefaultAdmin ? 'admin' : 'trainer',
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, 'users', uid), newUser, { merge: true });

  await logActivity({
    action: 'USER_CREATE',
    entityType: 'user',
    entityId: uid,
    entityName: name,
    performedByUid: 'system',
    performedByName: 'System',
    performedByRole: 'admin'
  });

  return { ...newUser, role: newUser.role } as User;
};

export const saveWeek = async (week: Partial<Week>, performedBy: User) => {
  const isNew = !week.id;
  const batch = writeBatch(db);
  
  let weekId = week.id;
  if (!weekId) {
    const weekRef = doc(collection(db, 'weeks'));
    weekId = weekRef.id;
  }

  const startDate = new Date(week.startDate!);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const endDateStr = endDate.toISOString().split('T')[0];

  const weekPayload: any = {
    ...week,
    endDate: endDateStr,
    status: week.status || 'active',
    updatedAt: serverTimestamp(),
  };

  if (isNew) {
    weekPayload.createdAt = serverTimestamp();
    weekPayload.createdByUid = performedBy.uid;
    weekPayload.createdByName = performedBy.name;
    weekPayload.createdByRole = performedBy.role;
  }

  batch.set(doc(db, 'weeks', weekId), weekPayload, { merge: true });

  const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = DAYS_OF_WEEK[d.getDay()];
    const dayId = `${weekId}_${dateStr}`;
    
    const dayPayload: any = {
      weekId,
      date: dateStr,
      dayOfWeek: dayName,
      status: 'active',
      updatedAt: serverTimestamp()
    };
    if (isNew) {
      dayPayload.createdAt = serverTimestamp();
    }
    batch.set(doc(db, 'weekDays', dayId), dayPayload, { merge: true });
  }

  await batch.commit();

  await logActivity({
    action: isNew ? 'WEEK_CREATE' : 'WEEK_UPDATE',
    entityType: 'week',
    entityId: weekId,
    entityName: week.title,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });

  return weekId;
};

export const archiveWeek = async (weekId: string, performedBy: User) => {
  await updateDoc(doc(db, 'weeks', weekId), { 
    status: 'archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await logActivity({
    action: 'WEEK_ARCHIVE',
    entityType: 'week',
    entityId: weekId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });
};

export const restoreWeek = async (weekId: string, performedBy: User) => {
  await updateDoc(doc(db, 'weeks', weekId), { 
    status: 'active',
    restoredAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await logActivity({
    action: 'WEEK_RESTORE',
    entityType: 'week',
    entityId: weekId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });
};

export const deleteWeekPermanently = async (weekId: string, performedBy: User) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'weeks', weekId));
  const daysSnap = await getDocs(query(collection(db, 'weekDays'), where('weekId', '==', weekId)));
  daysSnap.docs.forEach((d: any) => batch.delete(d.ref));
  const itemsSnap = await getDocs(query(collection(db, 'scheduleItems'), where('weekId', '==', weekId)));
  itemsSnap.docs.forEach((d: any) => batch.delete(d.ref));
  await batch.commit();
  await logActivity({
    action: 'WEEK_PERMANENT_DELETE',
    entityType: 'week',
    entityId: weekId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });
};

export const runScheduleWeekMigration = async (performedBy: User) => {
  const metaRef = doc(db, 'meta', 'migrations');
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists() && metaSnap.data().scheduleWeekMigration) return;
  const itemsSnap = await getDocs(collection(db, 'scheduleItems'));
  const items = itemsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ScheduleItem));
  const legacyItems = items.filter(i => !i.weekId);
  if (legacyItems.length === 0) {
    await setDoc(metaRef, { scheduleWeekMigration: true, completedAt: serverTimestamp() }, { merge: true });
    return;
  }
  const groups: Record<string, ScheduleItem[]> = {};
  legacyItems.forEach(i => {
    if (!groups[i.weekStartDate]) groups[i.weekStartDate] = [];
    groups[i.weekStartDate].push(i);
  });
  for (const [startDate, groupItems] of Object.entries(groups)) {
    const weekId = await saveWeek({ title: `Migrated Week ${startDate}`, startDate: startDate, status: 'active' }, performedBy);
    const batch = writeBatch(db);
    const DAYS_MAP: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
    groupItems.forEach(item => {
      const dayOffset = DAYS_MAP[item.dayOfWeek];
      const actualDate = new Date(startDate);
      actualDate.setDate(actualDate.getDate() + dayOffset);
      const dateStr = actualDate.toISOString().split('T')[0];
      batch.update(doc(db, 'scheduleItems', item.id), { weekId, date: dateStr, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
  await setDoc(metaRef, { scheduleWeekMigration: true, completedAt: serverTimestamp() }, { merge: true });
};

export const saveScheduleItem = async (item: Partial<ScheduleItem>, performedBy: User) => {
  const isNew = !item.id;
  const docId = item.id || (item.type === 'groupSession' && item.trainerId && item.sessionId ? `${item.trainerId}_${item.sessionId}` : undefined);
  const payload: any = { ...item, updatedAt: serverTimestamp() };
  if (isNew) payload.createdAt = serverTimestamp();
  if (docId) await setDoc(doc(db, 'scheduleItems', docId), payload, { merge: true });
  else {
    const docRef = await addDoc(collection(db, 'scheduleItems'), payload);
    item.id = docRef.id;
  }
  await logActivity({
    action: isNew ? 'SCHEDULE_ITEM_CREATE' : 'SCHEDULE_ITEM_UPDATE',
    entityType: 'scheduleItem',
    entityId: item.id || docId || 'unknown',
    entityName: item.title,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { type: item.type, trainerId: item.trainerId }
  });
};

export const deleteScheduleItem = async (itemId: string, performedBy: User) => {
  await deleteDoc(doc(db, 'scheduleItems', itemId));
  await logActivity({
    action: 'SCHEDULE_ITEM_DELETE',
    entityType: 'scheduleItem',
    entityId: itemId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });
};

export const markScheduleItemDone = async (itemId: string, note: string, performedBy: User) => {
  await updateDoc(doc(db, 'scheduleItems', itemId), {
    status: 'done',
    trainerNote: note,
    doneAt: serverTimestamp(),
    doneByUid: performedBy.uid,
    doneByName: performedBy.name,
    updatedAt: serverTimestamp()
  });
  await logActivity({ action: 'SCHEDULE_ITEM_DONE', entityType: 'scheduleItem', entityId: itemId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const saveDailyOps = async (ops: Partial<DailyTrainerOps>, performedBy: User) => {
  const docId = `${ops.trainerId}_${ops.date}`;
  await setDoc(doc(db, 'dailyTrainerOps', docId), { ...ops, updatedAt: serverTimestamp(), updatedByUid: performedBy.uid, updatedByName: performedBy.name }, { merge: true });
  await logActivity({ action: 'DAILY_OPS_SAVE', entityType: 'dailyOps', entityId: docId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role, details: { date: ops.date } });
};

export const saveSessionMeta = async (meta: Partial<SessionMeta>, performedBy: User) => {
  const docId = `${meta.groupId}_${meta.sessionId}`;
  await setDoc(doc(db, 'sessionMeta', docId), { ...meta, lastUpdatedAt: serverTimestamp(), lastUpdatedByUid: performedBy.uid, lastUpdatedByName: performedBy.name, lastUpdatedByRole: performedBy.role }, { merge: true });
  await logActivity({ action: 'SESSION_META_SAVE', entityType: 'sessionMeta', entityId: docId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });

  // Automatically trigger notifications to group students when task specifications are set/updated
  if (meta.groupId && meta.taskInstructions) {
    try {
      const studentsSnap = await getDocs(query(collection(db, 'students'), where('groupId', '==', meta.groupId)));
      const students = studentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      for (const student of students) {
        if (student.deactivated) continue;
        await sendNotification({
          userId: student.id,
          title: `📝 تحديث مطلوبات المحاضرة`,
          message: `تم رفع أو تحديث مطلوبات الواجبات والتاسكات للمحاضرة في مجموعتكم. يرجى المراجعة والتنفيذ!`,
          type: 'task_assigned',
          link: `/student-portal?studentId=${student.id}`
        });
      }
    } catch (err) {
      console.error("Failed to notify students of session meta update:", err);
    }
  }
};

export const saveSessionRevision = async (groupId: string, sessionId: string, note: string, performedBy: User) => {
  const docId = `${groupId}_${sessionId}`;
  await setDoc(doc(db, 'sessionMeta', docId), {
    revision: { revisioned: true, revisionedAt: serverTimestamp(), revisionedByUid: performedBy.uid, revisionedByName: performedBy.name, revisionNote: note },
    lastUpdatedAt: serverTimestamp(), lastUpdatedByUid: performedBy.uid, lastUpdatedByName: performedBy.name, lastUpdatedByRole: performedBy.role
  }, { merge: true });
  await logActivity({ action: 'SESSION_REVISION_SAVE', entityType: 'sessionMeta', entityId: docId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

const generateStudentIdNum = async () => {
  let isUnique = false;
  let id = '';
  let attempts = 0;
  while (!isUnique && attempts < 15) {
    id = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const qSnap = await getDocs(query(collection(db, 'students'), where('studentIdNum', '==', id)));
    if (qSnap.empty) {
      isUnique = true;
    }
    attempts++;
  }
  return id;
};

const generateStudentPassword = () => {
  const chars = '0123456789';
  let res = '';
  for (let i = 0; i < 5; i++) {
    res += chars[Math.floor(Math.random() * chars.length)]; // 5 numeric characters
  }
  return res;
};

export const consolidateAllStudentCredentials = async () => {
  try {
    const qSnap = await getDocs(collection(db, 'students'));
    if (qSnap.empty) return;

    const phoneGroups = new Map<string, any[]>();
    const emailGroups = new Map<string, any[]>();

    qSnap.docs.forEach((d: any) => {
      const s = { id: d.id, ...d.data() } as Student;
      const normPhone = normalizePhoneNumber(s.phone);
      if (normPhone) {
        if (!phoneGroups.has(normPhone)) phoneGroups.set(normPhone, []);
        phoneGroups.get(normPhone)!.push(s);
      }
      const normEmail = (s.email || s.attendanceEmail || '').trim().toLowerCase();
      if (normEmail) {
        if (!emailGroups.has(normEmail)) emailGroups.set(normEmail, []);
        emailGroups.get(normEmail)!.push(s);
      }
    });

    const studentSetsToUnify: any[][] = [];

    const processMap = (map: Map<string, any[]>) => {
      map.forEach(list => {
        if (list.length > 1) {
          studentSetsToUnify.push(list);
        }
      });
    };

    processMap(phoneGroups);
    processMap(emailGroups);

    const batch = writeBatch(db);
    let updateCount = 0;
    const updatedMap = new Map<string, { studentIdNum: string; studentPassword: string }>();

    for (const list of studentSetsToUnify) {
      let primaryIdNum = '';
      let primaryPassword = '';

      for (const s of list) {
        if (s.studentIdNum && !primaryIdNum) primaryIdNum = s.studentIdNum;
        if (s.studentPassword && !primaryPassword) primaryPassword = s.studentPassword;
      }

      if (!primaryIdNum) {
        primaryIdNum = Math.floor(100000 + Math.random() * 900000).toString();
      }
      if (!primaryPassword) {
        primaryPassword = Math.floor(10000 + Math.random() * 90000).toString();
      }

      for (const s of list) {
        const cached = updatedMap.get(s.id);
        const curIdNum = cached ? cached.studentIdNum : s.studentIdNum;
        const curPass = cached ? cached.studentPassword : s.studentPassword;

        if (curIdNum !== primaryIdNum || curPass !== primaryPassword) {
          updatedMap.set(s.id, { studentIdNum: primaryIdNum, studentPassword: primaryPassword });
          batch.update(doc(db, 'students', s.id), {
            studentIdNum: primaryIdNum,
            studentPassword: primaryPassword
          });
          updateCount++;
        }
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Consolidated credentials for ${updateCount} student records across groups.`);
    }
  } catch (err) {
    console.error("Error consolidating student credentials:", err);
  }
};

export const checkAndBackfillStudentCredentials = async () => {
  try {
    const qSnap = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let changed = false;
    
    // We keep a local set of already used student IDs during this run to prevent collisions
    const usedIds = new Set<string>();
    qSnap.docs.forEach((docSnap: any) => {
      const s = docSnap.data() as Student;
      if (s.studentIdNum) usedIds.add(s.studentIdNum);
    });

    for (const studentDoc of qSnap.docs) {
      const s = studentDoc.data() as Student;
      if (!s.studentIdNum || !s.studentPassword) {
        let uniqueId = s.studentIdNum;
        if (!uniqueId) {
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 20) {
            uniqueId = Math.floor(100000 + Math.random() * 900000).toString();
            if (!usedIds.has(uniqueId)) {
              isUnique = true;
              usedIds.add(uniqueId);
            }
            attempts++;
          }
        }
        const pass = s.studentPassword || Math.floor(10000 + Math.random() * 90000).toString();
        batch.update(studentDoc.ref, {
          studentIdNum: uniqueId,
          studentPassword: pass
        });
        changed = true;
      }
    }
    if (changed) {
      await batch.commit();
    }

    // Always unify duplicate student records across groups
    await consolidateAllStudentCredentials();
  } catch (error) {
    console.error('Error backfilling credentials:', error);
  }
};

export const triggerStudentWelcomeEmail = async (studentInput: {
  id?: string;
  name?: string;
  email?: string;
  attendanceEmail?: string;
  groupId?: string;
  studentIdNum?: string;
  studentPassword?: string;
} | string) => {
  try {
    let studentId = typeof studentInput === 'string' ? studentInput : studentInput.id;
    let name = typeof studentInput === 'string' ? '' : (studentInput.name || '');
    let email = typeof studentInput === 'string' ? '' : (studentInput.email || '');
    let attendanceEmail = typeof studentInput === 'string' ? '' : (studentInput.attendanceEmail || '');
    let groupId = typeof studentInput === 'string' ? '' : (studentInput.groupId || '');
    let studentIdNum = typeof studentInput === 'string' ? '' : (studentInput.studentIdNum || '');
    let studentPassword = typeof studentInput === 'string' ? '' : (studentInput.studentPassword || '');

    if (studentId) {
      try {
        const sSnap = await getDoc(doc(db, 'students', studentId));
        if (sSnap.exists()) {
          const sData = sSnap.data();
          if (!name) name = sData.name || '';
          if (!email) email = sData.email || '';
          if (!attendanceEmail) attendanceEmail = sData.attendanceEmail || '';
          if (!groupId) groupId = sData.groupId || '';
          if (!studentIdNum) studentIdNum = sData.studentIdNum || '';
          if (!studentPassword) studentPassword = sData.studentPassword || '';
        }
      } catch (e) {
        console.warn("Could not fetch student doc for credentials:", e);
      }
    }

    const targetEmail = (email || attendanceEmail || '').trim();
    if (!targetEmail) {
      console.warn("Welcome email skipped: Student has no email address.", name || studentId);
      return { success: false, error: 'لا يوجد بريد إلكتروني مسجل للطالب' };
    }
    if (!groupId) {
      console.warn("Welcome email skipped: Student has no groupId.", name || studentId);
      return { success: false, error: 'غير محدد المجموعة (groupId)' };
    }

    if (!studentIdNum) {
      studentIdNum = Math.floor(100000 + Math.random() * 900000).toString();
    }
    if (!studentPassword) {
      studentPassword = Math.floor(10000 + Math.random() * 90000).toString();
    }

    if (studentId) {
      updateDoc(doc(db, 'students', studentId), { studentIdNum, studentPassword }).catch(() => {});
    }

    let groupName = 'الجروب التدريبي';
    let courseName = 'الكورس التدريبي';
    let batchCode = '';
    let trainerName = 'م. صابر عبد الدايم';

    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data();
      groupName = gData.name || gData.batchCode || groupName;
      courseName = gData.courseName || courseName;
      batchCode = gData.batchCode || gData.name || '';

      const primaryTrainerId = gData.primaryTrainerId || (gData.trainerIds && gData.trainerIds[0]);
      if (primaryTrainerId) {
        try {
          const trainerDoc = await getDoc(doc(db, 'users', primaryTrainerId));
          if (trainerDoc.exists()) {
            const tData = trainerDoc.data();
            let tName = tData.name || tData.fullName || '';
            if (tName) {
              if (!tName.startsWith('م.') && !tName.startsWith('د.')) {
                tName = `م. ${tName}`;
              }
              trainerName = tName;
            }
          }
        } catch (e) {}
      }
    }

    const endpoint = getApiEndpoint('/api/google/send-email');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: targetEmail,
        template: 'welcome',
        studentName: name,
        groupCode: groupName,
        courseName: courseName,
        batchCode: batchCode || groupName,
        trainerName: trainerName,
        studentIdNum: studentIdNum || '',
        studentPassword: studentPassword || '',
        studentPortalUrl: 'https://training.sabergroupacademy.com/#/student/portal'
      })
    });

    const resData = await response.json().catch(() => ({}));
    if (!response.ok || !resData.success) {
      const errDetail = resData.error || response.statusText || 'فشل إرسال الإيميل';
      console.error("Welcome email failed to dispatch:", errDetail);
      if (studentId) {
        await updateDoc(doc(db, 'students', studentId), {
          studentIdNum,
          studentPassword,
          welcomeEmailSent: false,
          welcomeEmailStatus: 'failed',
          welcomeEmailError: errDetail,
          welcomeEmailFailedAt: new Date().toISOString()
        }).catch(() => {});
      }
      return { success: false, error: errDetail };
    } else {
      console.log(`Welcome email successfully sent to ${targetEmail} (${name})`);
      if (studentId) {
        await updateDoc(doc(db, 'students', studentId), {
          studentIdNum,
          studentPassword,
          welcomeEmailSent: true,
          welcomeEmailSentAt: new Date().toISOString(),
          welcomeEmailStatus: 'sent',
          welcomeEmailError: '',
          credsSent: true,
          credsSentAt: new Date().toISOString()
        }).catch(() => {});
      }
      return { success: true, message: resData.message };
    }
  } catch (err: any) {
    console.warn("Could not dispatch welcome email to student:", err);
    const errDetail = err.message || 'خطأ غير متوقع أثناء إرسال الإيميل';
    let studentId = typeof studentInput === 'string' ? studentInput : studentInput.id;
    if (studentId) {
      await updateDoc(doc(db, 'students', studentId), {
        welcomeEmailSent: false,
        welcomeEmailStatus: 'failed',
        welcomeEmailError: errDetail,
        welcomeEmailFailedAt: new Date().toISOString()
      }).catch(() => {});
    }
    return { success: false, error: errDetail };
  }
};

export const sendManualAbsenceWarningEmail = async (groupId: string, studentId: string) => {
  const studentDoc = await getDoc(doc(db, 'students', studentId));
  if (!studentDoc.exists()) throw new Error("الطالب غير موجود");
  const st = studentDoc.data() as Student;
  const stEmail = (st.email || st.attendanceEmail || '').trim();
  if (!stEmail) throw new Error("لا يوجد بريد إلكتروني مسجل للطالب إطلاقاً");

  let groupName = 'الجروب التدريبي';
  let courseName = 'الكورس التدريبي';
  const groupSnap = await getDoc(doc(db, 'groups', groupId));
  if (groupSnap.exists()) {
    const gData = groupSnap.data();
    groupName = gData.name || gData.batchCode || groupName;
    courseName = gData.courseName || courseName;
  }

  const res = await fetch(getApiEndpoint('/api/google/send-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientEmail: stEmail,
      template: 'absence_alert',
      studentName: st.name,
      groupCode: groupName,
      courseName: courseName,
      sessionNumber: 1,
      sessionDate: new Date().toLocaleDateString('ar-EG'),
      studentPortalUrl: 'https://training.sabergroupacademy.com/#/student/portal'
    })
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "فشل إرسال الإيميل عبر خادم المركز");
  }

  const followUpRef = doc(db, 'studentFollowUps', `${groupId}_${studentId}`);
  await setDoc(followUpRef, {
    absenceWarningEmailSentAt: new Date().toISOString(),
    lastManualAbsenceWarningBy: 'manual'
  }, { merge: true });

  return true;
};

export const saveStudent = async (studentId: string | null, data: Partial<Student>, performedBy: User) => {
  // Check for duplicates in the same group
  if (!studentId && data.groupId) {
    const q = query(
      collection(db, 'students'),
      where('groupId', '==', data.groupId)
    );
    const snap = await getDocs(q);
    const existingStudents = snap.docs.map(d => d.data() as Student);
    
    const duplicate = existingStudents.find(s => 
      (data.name && s.name.toLowerCase() === data.name.toLowerCase()) ||
      (data.email && s.email && s.email.toLowerCase() === data.email.toLowerCase()) ||
      (data.phone && s.phone === data.phone)
    );

    if (duplicate) {
      let field = 'الاسم';
      if (data.email && duplicate.email && duplicate.email.toLowerCase() === data.email.toLowerCase()) field = 'البريد الإلكتروني';
      if (data.phone && duplicate.phone === data.phone) field = 'رقم الهاتف';
      throw new Error(`هذا الطالب مسجل بالفعل في هذه المجموعة بنفس ${field}`);
    }
  }

  // Pre-populate credentials if they are missing
  const payload = { ...data };
  if (!studentId) {
    if (!payload.studentIdNum) {
      payload.studentIdNum = await generateStudentIdNum();
    }
    if (!payload.studentPassword) {
      payload.studentPassword = generateStudentPassword();
    }
  }

  let finalStudentObj: Student;

  if (studentId) {
    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, payload);
    await logActivity({ action: 'STUDENT_UPDATE', entityType: 'student', entityId: studentId, entityName: data.name, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    const snap = await getDoc(studentRef);
    finalStudentObj = { id: studentId, ...(snap.exists() ? snap.data() : payload) } as Student;
    if (data.groupId) {
      triggerStudentWelcomeEmail(finalStudentObj);
    }
    return finalStudentObj;
  } else {
    const docRef = await addDoc(collection(db, 'students'), { ...payload, createdAt: serverTimestamp() });
    await logActivity({ action: 'STUDENT_CREATE', entityType: 'student', entityId: docRef.id, entityName: data.name, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    finalStudentObj = { id: docRef.id, ...payload } as Student;
    if (finalStudentObj.groupId) {
      triggerStudentWelcomeEmail(finalStudentObj);
    }
    return finalStudentObj;
  }
};

export const getOrCreateGroupTestAccount = async (group: Group, performedBy: User): Promise<Student> => {
  if (!group || !group.id) throw new Error('بيانات المجموعة غير مكتملة');

  // Check if a test account already exists for this group
  const q = query(
    collection(db, 'students'),
    where('groupId', '==', group.id)
  );
  const snap = await getDocs(q);
  const existingStudents = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));
  
  const existingTest = existingStudents.find((s: Student) => 
    s.isTestAccount || 
    s.studentIdNum?.startsWith('TEST-') || 
    s.name.includes('[حساب تجريبي]') || 
    s.name.includes('[Test Account]')
  );

  if (existingTest) {
    return existingTest;
  }

  // Generate clean readable ID and Password based on batch / group
  const rawBatch = (group.batchCode || group.name || group.id.slice(0, 5)).replace(/[^a-zA-Z0-9]/g, '');
  const testIdNum = `TEST-${rawBatch.toUpperCase().slice(0, 8) || 'GRP'}`;
  const testPass = `test${rawBatch.toLowerCase().slice(0, 4) || '123'}`;

  const newTestStudentData: Partial<Student> = {
    name: `[حساب تجريبي] ${group.batchCode ? 'Batch ' + group.batchCode : group.name}`,
    phone: '01000000000',
    email: `test.${group.id.slice(0, 6)}@saber.local`,
    groupId: group.id,
    studentIdNum: testIdNum,
    studentPassword: testPass,
    isTestAccount: true,
    notes: 'حساب تجريبي تم إنشاؤه مخصصاً لتجربة وفحص بوابة الطلاب لهذه المجموعة.',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'students'), newTestStudentData);
  await logActivity({
    action: 'STUDENT_CREATE',
    entityType: 'student',
    entityId: docRef.id,
    entityName: newTestStudentData.name,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });

  return { id: docRef.id, ...newTestStudentData } as Student;
};

export const deleteStudent = async (studentId: string, performedBy: User) => {
  const student = await getDocument<Student>('students', studentId);
  await deleteDoc(doc(db, 'students', studentId));
  await logActivity({ action: 'STUDENT_DELETE', entityType: 'student', entityId: studentId, entityName: student?.name || 'Unknown Student', performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const transferStudentToGroup = async (
  studentId: string,
  targetGroupId: string,
  reactivate: boolean = true,
  notes: string = '',
  performedBy: User
) => {
  const studentRef = doc(db, 'students', studentId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) {
    throw new Error('الطالب غير موجود في النظام.');
  }
  const oldStudent = { id: studentSnap.id, ...studentSnap.data() } as Student;
  const oldGroupId = oldStudent.groupId;

  if (oldGroupId === targetGroupId) {
    throw new Error('الطالب مسجل بالفعل في هذه المجموعة المفعلة.');
  }

  // Fetch old group name & new group name for clean log
  let oldGroupName = oldGroupId || 'غير محدد';
  let newGroupName = targetGroupId;
  try {
    if (oldGroupId) {
      const oldGDoc = await getDoc(doc(db, 'groups', oldGroupId));
      if (oldGDoc.exists()) oldGroupName = (oldGDoc.data() as Group).name || oldGroupId;
    }
    const newGDoc = await getDoc(doc(db, 'groups', targetGroupId));
    if (newGDoc.exists()) newGroupName = (newGDoc.data() as Group).name || targetGroupId;
  } catch (e) {
    console.error("Error fetching group names for transfer log:", e);
  }

  const timestamp = new Date().toISOString();
  const transferReason = `تم تحويل الطالب من مجموعة (${oldGroupName}) إلى مجموعة جديدة (${newGroupName})${notes ? ` - ملاحظات: ${notes}` : ''}`;

  const historyEntry = {
    type: 'transfer' as const,
    reason: transferReason,
    oldGroupId,
    oldGroupName,
    newGroupId: targetGroupId,
    newGroupName,
    timestamp,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name
  };

  const updates: any = {
    groupId: targetGroupId,
    deactivationHistory: arrayUnion(historyEntry)
  };

  if (reactivate) {
    updates.deactivated = false;
    updates.permanentDeactivation = false;
    updates.deactivatedAt = null;
    updates.deactivatedByUid = null;
    updates.deactivatedByName = null;
    updates.deactivationReason = null;
    updates.deactivationReasonCategory = null;
    updates.deactivationChecklist = null;
  }

  await updateDoc(studentRef, updates);

  // Transfer follow-up tracking record if it exists
  if (oldGroupId) {
    const oldFollowUpId = `${oldGroupId}_${studentId}`;
    const newFollowUpId = `${targetGroupId}_${studentId}`;
    try {
      const oldFUSnap = await getDoc(doc(db, 'studentFollowUps', oldFollowUpId));
      if (oldFUSnap.exists()) {
        const fuData = oldFUSnap.data();
        await setDoc(doc(db, 'studentFollowUps', newFollowUpId), {
          ...fuData,
          id: newFollowUpId,
          groupId: targetGroupId,
          groupName: newGroupName,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.error("Error updating follow-up doc on transfer:", e);
    }
  }

  await logActivity({
    action: 'STUDENT_TRANSFER',
    entityType: 'student',
    entityId: studentId,
    entityName: oldStudent.name,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { oldGroupId, oldGroupName, targetGroupId, newGroupName, notes }
  });

  return { success: true, oldGroupName, newGroupName };
};

export const updateGroup = async (groupId: string, data: Partial<Group>, performedBy: User) => {
  const groupRef = doc(db, 'groups', groupId);
  await setDoc(groupRef, data, { merge: true });
  await logActivity({ action: 'GROUP_UPDATE', entityType: 'group', entityId: groupId, entityName: data.name || 'Group Details', performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role, details: data });
};

export const recalculateStudentRanking = async (groupId: string, studentId: string) => {
  try {
    const [evalSnap, projectDoc, penaltySnap] = await Promise.all([
      getDocs(query(collection(db, 'lectureEvaluations'), where('groupId', '==', groupId), where('studentId', '==', studentId))),
      getDocument<FinalProject>('finalProjects', `${groupId}_${studentId}`),
      getDocs(query(collection(db, 'penalties'), where('groupId', '==', groupId), where('studentId', '==', studentId)))
    ]);
    
    const rawEvals = evalSnap.docs.map((d: any) => d.data() as LectureEvaluation);
    const uniqueEvalsMap = new Map<number, LectureEvaluation>();
    for (const ev of rawEvals) {
      if (ev.sessionNumber === undefined || ev.sessionNumber === null) continue;
      const existing = uniqueEvalsMap.get(ev.sessionNumber);
      if (!existing) {
        uniqueEvalsMap.set(ev.sessionNumber, ev);
      } else {
        const merged = { ...existing, ...ev };
        if (existing.attendance === 1 || ev.attendance === 1) {
          merged.attendance = 1;
        }
        merged.total = Math.max(existing.total || 0, ev.total || 0);
        uniqueEvalsMap.set(ev.sessionNumber, merged);
      }
    }
    
    const lectureTotal = Array.from(uniqueEvalsMap.values()).reduce((sum: number, ev: any) => sum + (ev.total || 0), 0);
    const projectScore = projectDoc?.score || 0;
    const penaltiesTotal = penaltySnap.docs.reduce((sum: number, d: any) => sum + (d.data().points || 0), 0);
    const finalScore = lectureTotal + projectScore - penaltiesTotal;
    const rankingData: Partial<GroupRanking> = { groupId, studentId, lectureTotal, projectScore, penaltiesTotal, finalScore, updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'groupRankings', `${groupId}_${studentId}`), rankingData);
    return true;
  } catch (err) {
    console.error(`[Ranking Error] Student ${studentId}:`, err);
    throw err;
  }
};

export const batchSaveEvaluations = async (evals: Partial<LectureEvaluation>[]) => {
  const batch = writeBatch(db);
  const studentIds = new Set<string>();
  const groupId = evals[0]?.groupId;

  for (const ev of evals) {
    if (!ev.groupId || !ev.studentId || !ev.sessionNumber) throw new Error("Missing metadata.");
    const docId = (ev as any).sessionId 
      ? `${ev.groupId}_${(ev as any).sessionId}_${ev.studentId}`
      : `${ev.groupId}_session_${ev.sessionNumber}_${ev.studentId}`;
    
    const total = (ev.attendance || 0) + (ev.bonus || 0) + (
      ev.taskNotSubmittedPenalty 
        ? -1 
        : ((ev.taskDelivered || 0) + (ev.taskOnTime || 0) + (ev.taskQuality || 0) + (ev.taskRedo || 0))
    );
    const ref = doc(db, 'lectureEvaluations', docId);
    batch.set(ref, { ...ev, total, updatedAt: serverTimestamp() }, { merge: true });
    studentIds.add(ev.studentId!);
  }
  await batch.commit();
  if (groupId) {
    await Promise.all(Array.from(studentIds).map(sid => recalculateStudentRanking(groupId, sid)));
    await Promise.all(Array.from(studentIds).map(sid => updateFollowUpStatsInDb(groupId, sid)));
  }
};

export const batchSaveAttendance = async (attendance: Partial<Attendance>) => {
  const docId = `${attendance.groupId}_${attendance.sessionId}`;
  await setDoc(doc(db, 'attendance', docId), { ...attendance, updatedAt: serverTimestamp() }, { merge: true });
};

export const batchSaveProjectScores = async (groupId: string, scores: { studentId: string, score: number, note: string }[]) => {
  const batch = writeBatch(db);
  scores.forEach(s => {
    const docId = `${groupId}_${s.studentId}`;
    const ref = doc(db, 'finalProjects', docId);
    batch.set(ref, { ...s, groupId, updatedAt: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
  await Promise.all(scores.map(s => recalculateStudentRanking(groupId, s.studentId)));
};

export const batchUpdateSessions = async (sessionUpdates: { id: string, status?: 'upcoming' | 'done', requiredTasksCount?: number, lectureRecordingUrl?: string, tasksMessageUrl?: string }[]) => {
  const batch = writeBatch(db);
  sessionUpdates.forEach(s => {
    const ref = doc(db, 'sessions', s.id);
    const { id, ...data } = s;
    batch.update(ref, data);
  });
  await batch.commit();
};

export const updateSession = async (sessionId: string, data: Partial<Session>, performedBy: User) => {
  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, data);
  await logActivity({ action: 'SESSION_UPDATE', entityType: 'session', entityId: sessionId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role, details: data });

  // Recalculate follow up stats for the group in real-time
  try {
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      const groupId = snap.data()?.groupId;
      if (groupId) {
        await updateGroupFollowUpsStatsInDb(groupId);
      }
    }
  } catch (err) {
    console.error("Error updating group follow ups stats after updateSession:", err);
  }

  // If a lecture recording URL is uploaded/updated, automatically notify students
  if (data.lectureRecordingUrl) {
    try {
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        const sData = snap.data();
        const groupId = sData?.groupId;
        const sNum = sData?.sessionNumber;
        if (groupId) {
          const studentsSnap = await getDocs(query(collection(db, 'students'), where('groupId', '==', groupId)));
          const students = studentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          for (const student of students) {
            if (student.deactivated) continue;
            await sendNotification({
              userId: student.id,
              title: `🎥 تم رفع تسجيل المحاضرة`,
              message: `تم رفع تسجيل المحاضرة رقم ${sNum || ''} الآن. يمكنك مشاهدتها وتطبيق العملي بداخل البورتال الخاص بك. بالتوفيق!`,
              type: 'task_status',
              link: `/student-portal?studentId=${student.id}`
                });
          }
        }
      }
    } catch (err) {
      console.error("Failed to notify students of lecture recording upload:", err);
    }
  }
};

export const addPenalty = async (data: Partial<Penalty>, performedBy: User) => {
  const docRef = await addDoc(collection(db, 'penalties'), { ...data, createdAt: serverTimestamp() });
  await recalculateStudentRanking(data.groupId!, data.studentId!);
  const student = await getDocument<Student>('students', data.studentId!);
  await logActivity({ 
    action: 'PENALTY_CREATE', 
    entityType: 'penalty', 
    entityId: docRef.id, 
    entityName: `Penalty for ${student?.name || data.studentId}`, 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role, 
    details: `Added penalty: ${data.points} points. Reason: ${data.reason}. Student: ${student?.name || data.studentId}` 
  });
};

export const removePenalty = async (penaltyId: string, groupId: string, studentId: string, performedBy: User) => {
  const penalty = await getDocument<Penalty>('penalties', penaltyId);
  const student = await getDocument<Student>('students', studentId);
  await deleteDoc(doc(db, 'penalties', penaltyId));
  await recalculateStudentRanking(groupId, studentId);
  await logActivity({ action: 'PENALTY_DELETE', entityType: 'penalty', entityId: penaltyId, entityName: `Penalty for ${student?.name || studentId}`, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role, details: { points: penalty?.points, reason: penalty?.reason } });
};

export const generateGroupSessions = async (group: Group) => {
  const batch = writeBatch(db);
  const dayMap: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
  const targetDays = group.daysOfWeek.map(d => dayMap[d]);
  let sessionsCreated = 0;
  let currentDate = new Date(group.startDate);
  if (targetDays.length === 0) throw new Error("No days selected.");
  while (sessionsCreated < group.totalSessions) {
    if (targetDays.includes(currentDate.getDay())) {
      sessionsCreated++;
      const sessionRef = doc(collection(db, 'sessions'));
      batch.set(sessionRef, { groupId: group.id, sessionNumber: sessionsCreated, date: currentDate.toISOString().split('T')[0], status: 'upcoming', createdAt: serverTimestamp() });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  await batch.commit();
};

export const regenerateUpcomingSessions = async (groupId: string, updatedGroup: Group) => {
  const batch = writeBatch(db);
  const q = query(collection(db, 'sessions'), where('groupId', '==', groupId), where('status', '==', 'upcoming'));
  const snap = await getDocs(q);
  snap.docs.forEach((d: any) => batch.delete(d.ref));
  const doneQ = query(collection(db, 'sessions'), where('groupId', '==', groupId), where('status', '==', 'done'), orderBy('sessionNumber', 'desc'), limit(1));
  const doneSnap = await getDocs(doneQ);
  let lastNum = 0;
  let startDate = new Date(updatedGroup.startDate);
  if (!doneSnap.empty) {
    const lastDone = doneSnap.docs[0].data();
    lastNum = lastDone.sessionNumber;
    startDate = new Date(lastDone.date);
    startDate.setDate(startDate.getDate() + 1);
  }
  const dayMap: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
  const targetDays = updatedGroup.daysOfWeek.map(d => dayMap[d]);
  let count = lastNum;
  let current = startDate;
  if (lastNum === 0 && current < new Date(updatedGroup.startDate)) current = new Date(updatedGroup.startDate);
  while (count < updatedGroup.totalSessions) {
    if (targetDays.includes(current.getDay())) {
      count++;
      const sessionRef = doc(collection(db, 'sessions'));
      batch.set(sessionRef, { groupId, sessionNumber: count, date: current.toISOString().split('T')[0], status: 'upcoming', createdAt: serverTimestamp() });
    }
    current.setDate(current.getDate() + 1);
    if (current.getTime() > new Date().getTime() + 63072000000) break;
  }
  await batch.commit();
};

export const deleteGroupCascading = async (groupId: string, performedBy: User, onProgress?: (current: number, total: number) => void) => {
  const group = await getDocument<Group>('groups', groupId);

  // Automatically delete Google Calendar events for this group
  try {
    await fetch(getApiEndpoint('/api/google/delete-group-calendar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
  } catch (err) {
    console.error("Error cleaning up group calendar events on deletion:", err);
  }

  const collectionsToClear = ['sessions', 'students', 'lectureEvaluations', 'finalProjects', 'penalties', 'groupRankings', 'attendance'];
  const allRefs: any[] = [doc(db, 'groups', groupId)];
  for (const collName of collectionsToClear) {
    const snap = await getDocs(query(collection(db, collName), where('groupId', '==', groupId)));
    snap.docs.forEach((d: any) => allRefs.push(d.ref));
  }
  const total = allRefs.length;
  let processed = 0;
  for (let i = 0; i < allRefs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = allRefs.slice(i, i + 450);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
    processed += chunk.length;
    if (onProgress) onProgress(processed, total);
  }
  await logActivity({ action: 'GROUP_DELETE', entityType: 'group', entityId: groupId, entityName: group?.name || 'Unknown', performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const archiveGroup = async (groupId: string, performedBy: User) => {
  const group = await getDocument<Group>('groups', groupId);

  // Automatically delete Google Calendar events when group is archived/cancelled
  try {
    await fetch(getApiEndpoint('/api/google/delete-group-calendar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
  } catch (err) {
    console.error("Error cleaning up group calendar events on archival:", err);
  }

  await updateDoc(doc(db, 'groups', groupId), { 
    archived: true,
    updatedAt: serverTimestamp()
  });
  await logActivity({ 
    action: 'GROUP_ARCHIVE', 
    entityType: 'group', 
    entityId: groupId, 
    entityName: group?.name || 'Unknown', 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role 
  });
};

export const unarchiveGroup = async (groupId: string, performedBy: User) => {
  const group = await getDocument<Group>('groups', groupId);
  await updateDoc(doc(db, 'groups', groupId), { 
    archived: false,
    updatedAt: serverTimestamp()
  });
  await logActivity({ 
    action: 'GROUP_UNARCHIVE', 
    entityType: 'group', 
    entityId: groupId, 
    entityName: group?.name || 'Unknown', 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role 
  });
};

export const saveCustomEmailTemplate = async (templateData: any, performedBy: User) => {
  const templateId = templateData.id || `custom_${Date.now()}`;
  const docRef = doc(db, 'email_templates', templateId);
  const payload = {
    ...templateData,
    id: templateId,
    updatedAt: serverTimestamp()
  };
  await setDoc(docRef, payload, { merge: true });
  await logActivity({ action: 'EMAIL_TEMPLATE_SAVE', entityType: 'email_template', entityId: templateId, entityName: templateData.nameAr || templateData.name || 'Email Template', performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
  return templateId;
};

export const deleteCustomEmailTemplate = async (templateId: string, performedBy: User) => {
  await deleteDoc(doc(db, 'email_templates', templateId));
  await logActivity({ action: 'EMAIL_TEMPLATE_DELETE', entityType: 'email_template', entityId: templateId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

// Marketing Resources Services
export const saveMarketingCategory = async (category: Partial<MarketingCategory>, performedBy: User) => {
  const isNew = !category.id;
  const payload: any = {
    ...category
  };
  
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = performedBy.uid;
  }
  
  if (isNew) {
    const docRef = await addDoc(collection(db, 'marketingCategories'), payload);
    await logActivity({ action: 'MARKETING_CATEGORY_CREATE', entityType: 'marketingCategory', entityId: docRef.id, entityName: category.name, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return docRef.id;
  } else {
    await setDoc(doc(db, 'marketingCategories', category.id!), payload, { merge: true });
    await logActivity({ action: 'MARKETING_CATEGORY_UPDATE', entityType: 'marketingCategory', entityId: category.id!, entityName: category.name, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return category.id;
  }
};

export const deleteMarketingCategory = async (id: string, name: string, performedBy: User) => {
  await deleteDoc(doc(db, 'marketingCategories', id));
  await logActivity({ action: 'MARKETING_CATEGORY_DELETE', entityType: 'marketingCategory', entityId: id, entityName: name, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const saveMarketingResource = async (resource: Partial<MarketingResource>, performedBy: User) => {
  const isNew = !resource.id;
  const payload: any = {
    ...resource,
    updatedAt: serverTimestamp()
  };
  
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = performedBy.uid;
  }
  
  if (isNew) {
    const docRef = await addDoc(collection(db, 'marketingResources'), payload);
    await logActivity({ action: 'MARKETING_RESOURCE_CREATE', entityType: 'marketingResource', entityId: docRef.id, entityName: resource.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return docRef.id;
  } else {
    await setDoc(doc(db, 'marketingResources', resource.id!), payload, { merge: true });
    await logActivity({ action: 'MARKETING_RESOURCE_UPDATE', entityType: 'marketingResource', entityId: resource.id!, entityName: resource.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return resource.id;
  }
};

export const deleteMarketingResource = async (id: string, title: string, performedBy: User) => {
  await deleteDoc(doc(db, 'marketingResources', id));
  await logActivity({ action: 'MARKETING_RESOURCE_DELETE', entityType: 'marketingResource', entityId: id, entityName: title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const saveSectionTemplate = async (template: Partial<MarketingSectionTemplate>, performedBy: User) => {
  const docId = template.id!;
  const payload = {
    ...template,
    updatedAt: serverTimestamp(),
    updatedBy: performedBy.uid
  };
  await setDoc(doc(db, 'marketingSectionTemplates', docId), payload, { merge: true });
  await logActivity({ action: 'MARKETING_SECTION_TEMPLATE_UPDATE', entityType: 'sectionTemplate', entityId: docId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const sendNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notif,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
};

export const markNotificationRead = async (notifId: string) => {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
};

// Tasks & Daily Reports Services
export const saveAssignedTask = async (task: Partial<AssignedTask>, performedBy: User) => {
  const isNew = !task.id;
  const payload: any = {
    ...task,
    updatedAt: serverTimestamp()
  };
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.status = payload.status || 'assigned';
    payload.subtasks = payload.subtasks || [];
    payload.files = payload.files || [];
    payload.comments = payload.comments || [];
  }
  
  let taskId = task.id;
  if (isNew) {
    const docRef = await addDoc(collection(db, 'assignedTasks'), payload);
    taskId = docRef.id;
    await logActivity({ action: 'TASK_CREATE', entityType: 'assignedTask', entityId: taskId, entityName: task.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    
    // Notify assignee
    if (task.assignedTo) {
      await sendNotification({
        userId: task.assignedTo,
        title: 'مهمة جديدة',
        message: `تم إسناد مهمة جديدة لك: ${task.title}`,
        type: 'task_assigned',
        link: `/tasks?id=${taskId}`
      });
    }
  } else {
    await setDoc(doc(db, 'assignedTasks', taskId!), payload, { merge: true });
    await logActivity({ action: 'TASK_UPDATE', entityType: 'assignedTask', entityId: taskId!, entityName: task.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
  }
  return taskId;
};

export const updateTaskStatus = async (taskId: string, status: TaskStatus, performedBy: User) => {
  const task = await getDocument<AssignedTask>('assignedTasks', taskId);
  if (!task) return;

  await updateDoc(doc(db, 'assignedTasks', taskId), { 
    status, 
    updatedAt: serverTimestamp(),
    completedAt: status === 'completed' ? serverTimestamp() : task.completedAt
  });

  await logActivity({ 
    action: 'TASK_STATUS_UPDATE', 
    entityType: 'assignedTask', 
    entityId: taskId, 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role,
    details: { oldStatus: task.status, newStatus: status }
  });

  // Notify creator or assignee depending on status
  if (status === 'delivered' || status === 'under_review') {
    await sendNotification({
      userId: task.assignedBy,
      title: 'تسليم مهمة',
      message: `قام ${performedBy.name} بتسليم المهمة: ${task.title}`,
      type: 'task_review',
      link: `/tasks?id=${taskId}`
    });
  } else if (status === 'approved' || status === 'rejected' || status === 'completed') {
    await sendNotification({
      userId: task.assignedTo,
      title: 'تحديث حالة المهمة',
      message: `تم تغيير حالة المهمة "${task.title}" إلى: ${status}`,
      type: 'task_status',
      link: `/tasks?id=${taskId}`
    });
  }
};

export const addTaskComment = async (taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>, performedBy: User) => {
  const task = await getDocument<AssignedTask>('assignedTasks', taskId);
  if (!task) return;

  const newComment = {
    ...comment,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString() // Using string for sub-objects usually easier or use arrayUnion
  };

  await updateDoc(doc(db, 'assignedTasks', taskId), {
    comments: firestore.arrayUnion(newComment),
    updatedAt: serverTimestamp()
  });

  // Notify relevant party
  const notifyId = performedBy.uid === task.assignedTo ? task.assignedBy : task.assignedTo;
  await sendNotification({
    userId: notifyId,
    title: 'تعليق جديد',
    message: `تعليق جديد من ${performedBy.name} على المهمة: ${task.title}`,
    type: 'task_status',
    link: `/tasks?id=${taskId}`
  });
};

export const updateSubTasks = async (taskId: string, subtasks: SubTask[], performedBy: User) => {
  await updateDoc(doc(db, 'assignedTasks', taskId), {
    subtasks,
    updatedAt: serverTimestamp()
  });
};

export const addTaskFile = async (taskId: string, file: Omit<TaskFile, 'id' | 'uploadedAt'>, performedBy: User) => {
  const newFile = {
    ...file,
    id: Math.random().toString(36).substr(2, 9),
    uploadedAt: new Date().toISOString()
  };
  await updateDoc(doc(db, 'assignedTasks', taskId), {
    files: firestore.arrayUnion(newFile),
    updatedAt: serverTimestamp()
  });
};

export const deleteTask = async (taskId: string, performedBy: User) => {
  await deleteDoc(doc(db, 'assignedTasks', taskId));
  await logActivity({ action: 'TASK_DELETE', entityType: 'assignedTask', entityId: taskId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const saveRecurringTemplate = async (template: Partial<RecurringTaskTemplate>, performedBy: User) => {
  const isNew = !template.id;
  const payload: any = {
    ...template
  };
  
  if (isNew) {
    payload.createdAt = serverTimestamp();
  }
  
  if (isNew) {
    const docRef = await addDoc(collection(db, 'recurringDailyTemplates'), payload);
    await logActivity({ action: 'RECURRING_TEMPLATE_CREATE', entityType: 'recurringTemplate', entityId: docRef.id, entityName: template.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return docRef.id;
  } else {
    await setDoc(doc(db, 'recurringDailyTemplates', template.id!), payload, { merge: true });
    await logActivity({ action: 'RECURRING_TEMPLATE_UPDATE', entityType: 'recurringTemplate', entityId: template.id!, entityName: template.title, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return template.id;
  }
};

export const deleteRecurringTemplate = async (templateId: string, performedBy: User) => {
  await deleteDoc(doc(db, 'recurringDailyTemplates', templateId));
  await logActivity({ action: 'RECURRING_TEMPLATE_DELETE', entityType: 'recurringTemplate', entityId: templateId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const submitDailyReport = async (report: Partial<TrainerDailyReport>, performedBy: User) => {
  const docId = `${report.trainerId}_${report.date}`;
  const payload = {
    ...report,
    submittedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'trainerDailyReports', docId), payload, { merge: true });
  await logActivity({ action: 'DAILY_REPORT_SUBMIT', entityType: 'dailyReport', entityId: docId, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const saveRolePermissions = async (role: string, permissions: any, performedBy: User) => {
  await setDoc(doc(db, 'rolePermissions', role), { role, permissions, updatedAt: serverTimestamp() }, { merge: true });
  await logActivity({ action: 'ROLE_PERMISSIONS_UPDATE', entityType: 'rolePermissions', entityId: role, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

export const getRolePermissions = async (role: string): Promise<RolePermissions | null> => {
  return getDocument<RolePermissions>('rolePermissions', role);
};

export const updateUserName = async (uid: string, oldName: string, newName: string, performedBy: User) => {
  await updateDoc(doc(db, 'users', uid), { name: newName });
  await logActivity({
    action: 'USER_NAME_UPDATE',
    entityType: 'user',
    entityId: uid,
    entityName: newName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { oldName, newName }
  });
};

export const updateUserRole = async (uid: string, userName: string, newRole: UserRole, performedBy: User) => {
  await updateDoc(doc(db, 'users', uid), { role: newRole });
  await logActivity({
    action: 'USER_ROLE_UPDATE',
    entityType: 'user',
    entityId: uid,
    entityName: userName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { newRole }
  });
};

export const toggleUserDisabled = async (uid: string, userName: string, currentState: boolean, performedBy: User) => {
  await updateDoc(doc(db, 'users', uid), { disabled: !currentState });
  await logActivity({
    action: currentState ? 'USER_ENABLE' : 'USER_DISABLE',
    entityType: 'user',
    entityId: uid,
    entityName: userName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role
  });
};

// Performance Reports Services
export const savePerformanceDailyReport = async (report: Partial<PerformanceDailyReport>, performedBy: User) => {
  const docId = report.id || `${report.trainerId}_${report.date}`;
  const isNew = !report.id;
  const payload: any = {
    ...report,
    id: docId,
    lastUpdatedAt: serverTimestamp()
  };
  if (isNew) {
    payload.submittedAt = serverTimestamp();
  }
  await setDoc(doc(db, 'dailyReports', docId), payload, { merge: true });
  await logActivity({ 
    action: isNew ? 'PERFORMANCE_DAILY_SUBMIT' : 'PERFORMANCE_DAILY_UPDATE', 
    entityType: 'performanceDailyReport', 
    entityId: docId, 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role 
  });
};

export const savePerformanceWeeklyReport = async (report: Partial<PerformanceWeeklyReport>, performedBy: User) => {
  const docId = report.id || `${report.trainerId}_${report.weekStart}`;
  const isNew = !report.id;
  const payload = {
    ...report,
    id: docId,
    submittedAt: isNew ? serverTimestamp() : report.submittedAt
  };
  await setDoc(doc(db, 'weeklyReports', docId), payload, { merge: true });
  await logActivity({ 
    action: isNew ? 'PERFORMANCE_WEEKLY_SUBMIT' : 'PERFORMANCE_WEEKLY_UPDATE', 
    entityType: 'performanceWeeklyReport', 
    entityId: docId, 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role 
  });
};

// A deactivated student's follow-ups are frozen — no updates, mentions, resolves,
// schedules or escalations may be written against them until reactivated.
const assertStudentActiveForFollowUp = async (studentId: string) => {
  const studentSnap = await getDoc(doc(db, 'students', studentId));
  if (studentSnap.exists()) {
    const st = studentSnap.data() as Student;
    if (st.deactivated) {
      throw new Error('لا يمكن التعديل على متابعة هذا الطالب — الطالب موقوف حالياً. أعد تفعيله أولاً.');
    }
  }
};

export const saveStudentFollowUpComment = async (
  groupId: string,
  studentId: string,
  text: string,
  performedBy: User,
  mentionUserId?: string,
  mentionUserName?: string
) => {
  await assertStudentActiveForFollowUp(studentId);

  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const existingSnap = await getDoc(followUpRef);
  const existingStudentName = existingSnap.exists() ? (existingSnap.data() as StudentFollowUp).studentName : studentId;

  const nowStr = new Date().toISOString();
  const newComment: FollowUpComment = {
    id: Math.random().toString(36).substring(2, 11),
    text,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdByRole: performedBy.role,
    createdAt: nowStr
  };

  const updatesPayload: any = {
    groupId,
    studentId,
    lastUpdatedAt: serverTimestamp()
  };

  const extraComments: any[] = [newComment];

  if (mentionUserId && mentionUserName) {
    updatesPayload.mentionedUserId = mentionUserId;
    updatesPayload.mentionedUserName = mentionUserName;
    updatesPayload.mutedUserIds = arrayRemove(mentionUserId);

    extraComments.push({
      id: Math.random().toString(36).substring(2, 11),
      text: `🔔 قامت ${performedBy.name} بمنشن وتوجيه المتابعة إلى ${mentionUserName}.`,
      createdByUid: 'system',
      createdByName: 'النظام تلقائياً',
      createdByRole: 'مساعد ذكي',
      createdAt: nowStr
    });
  }

  updatesPayload.comments = arrayUnion(...extraComments);

  await setDoc(followUpRef, updatesPayload, { merge: true });

  // Recalculate stats inside saveStudentFollowUpComment
  await updateFollowUpStatsInDb(groupId, studentId);

  await logActivity({
    action: 'FOLLOWUP_COMMENT_ADD',
    entityType: 'follow_up',
    entityId: docId,
    entityName: `Follow-up for Student ${studentId}`,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Added a comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
  });

  if (mentionUserId && mentionUserName) {
    await createFollowUpMention({
      followUpId: docId,
      groupId,
      studentId,
      studentName: existingStudentName,
      mentionedUserId: mentionUserId,
      mentionedUserName: mentionUserName,
      mentionedByUid: performedBy.uid,
      mentionedByName: performedBy.name,
      note: text
    });
  }
};

export const calculateStudentAcademicStats = async (groupId: string, studentId: string) => {
  const evalsSnap = await getDocs(
    query(
      collection(db, 'lectureEvaluations'),
      where('groupId', '==', groupId),
      where('studentId', '==', studentId)
    )
  );
  const studentEvals = evalsSnap.docs.map((d: any) => d.data() as LectureEvaluation);

  const sessionsSnap = await getDocs(
    query(
      collection(db, 'sessions'),
      where('groupId', '==', groupId),
      where('status', '==', 'done')
    )
  );
  const groupSessions = sessionsSnap.docs.map((d: any) => d.data() as Session);

  const totalRequired = groupSessions.reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
  const totalCompleted = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);

  return {
    studentEvals,
    groupSessions,
    totalRequired,
    totalCompleted
  };
};

export const updateFollowUpStatsInDb = async (groupId: string, studentId: string) => {
  try {
    const docId = `${groupId}_${studentId}`;
    const followUpRef = doc(db, 'studentFollowUps', docId);
    const followUpSnap = await getDoc(followUpRef);
    if (!followUpSnap.exists()) return;

    const followUpData = followUpSnap.data() as StudentFollowUp;
    const resetSessionNum = followUpData.attendanceResetSessionNumber || 0;

    const { studentEvals, groupSessions, totalRequired, totalCompleted } = 
      await calculateStudentAcademicStats(groupId, studentId);

    const groupSessionsFiltered = groupSessions.filter(s => s.sessionNumber > resetSessionNum);
    const studentEvalsFiltered = studentEvals.filter(e => e.sessionNumber > resetSessionNum);

    const totalAttended = studentEvalsFiltered.filter(e => e.attendance === 1).length;
    const totalSessions = groupSessionsFiltered.length;
    const totalAbsent = totalSessions - totalAttended;

    // Automatic Absence Warning Email: If student's absence exceeds 20% after the first 4 lectures
    if (totalSessions >= 4 && (totalAbsent / totalSessions) > 0.20) {
      const lastWarnAt = (followUpData as any).absenceWarningEmailSentAt;
      const nowMs = Date.now();
      if (!lastWarnAt || (nowMs - new Date(lastWarnAt).getTime() > 3 * 24 * 3600 * 1000)) {
        try {
          const studentDoc = await getDoc(doc(db, 'students', studentId));
          if (studentDoc.exists()) {
            const st = studentDoc.data() as Student;
            const stEmail = (st.email || st.attendanceEmail || '').trim();
            if (stEmail) {
              let groupName = 'الجروب التدريبي';
              let courseName = 'الكورس التدريبي';
              const groupSnap = await getDoc(doc(db, 'groups', groupId));
              if (groupSnap.exists()) {
                const gData = groupSnap.data();
                groupName = gData.name || gData.batchCode || groupName;
                courseName = gData.courseName || courseName;
              }
              fetch(getApiEndpoint('/api/google/send-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipientEmail: stEmail,
                  template: 'absence_alert',
                  studentName: st.name,
                  groupCode: groupName,
                  courseName: courseName,
                  sessionNumber: totalSessions,
                  sessionDate: new Date().toLocaleDateString('ar-EG'),
                  studentPortalUrl: 'https://training.sabergroupacademy.com/#/student/portal'
                })
              }).catch(e => console.warn("Auto absence alert email failed:", e));

              await updateDoc(followUpRef, {
                absenceWarningEmailSentAt: new Date().toISOString()
              });
            }
          }
        } catch (eErr) {
          console.warn("Could not process auto absence warning email:", eErr);
        }
      }
    }

    await updateDoc(followUpRef, {
      tasksDone: totalCompleted,
      totalTasks: totalRequired,
      attendanceCount: totalAttended,
      totalSessions: totalSessions,
      lastUpdatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error updating follow up stats in DB:", err);
  }
};

export const updateGroupFollowUpsStatsInDb = async (groupId: string) => {
  try {
    const followUpsSnap = await getDocs(
      query(
        collection(db, 'studentFollowUps'),
        where('groupId', '==', groupId)
      )
    );
    for (const d of followUpsSnap.docs) {
      const fu = d.data() as StudentFollowUp;
      await updateFollowUpStatsInDb(groupId, fu.studentId);
    }
  } catch (err) {
    console.error("Error updating group follow up stats:", err);
  }
};

export const requestFollowUp = async (data: { 
  groupId: string, 
  groupName: string, 
  studentId: string, 
  studentName: string, 
  deadline: string, 
  note: string,
  mentionedUserId?: string,
  mentionedUserName?: string,
  labels?: string[]
}, performedBy: User) => {
  await assertStudentActiveForFollowUp(data.studentId);

  const docId = `${data.groupId}_${data.studentId}`;

  let finalLabels = data.labels || [];
  try {
    const groupDoc = await getDoc(doc(db, 'groups', data.groupId));
    if (groupDoc.exists()) {
      const gData = groupDoc.data();
      const gType = gData?.groupType || 'online';
      if (gType === 'online') {
        if (!finalLabels.includes('online')) finalLabels.push('online');
        finalLabels = finalLabels.filter(l => l !== 'offline');
      } else if (gType === 'offline') {
        if (!finalLabels.includes('offline')) finalLabels.push('offline');
        finalLabels = finalLabels.filter(l => l !== 'online');
      }
    }
  } catch (err) {
    console.error("Error setting online/offline label inside requestFollowUp", err);
  }

  const updates: any = {
    groupId: data.groupId,
    groupName: data.groupName,
    studentId: data.studentId,
    studentName: data.studentName,
    status: 'active',
    colorStatus: 'yellow',
    labels: finalLabels,
    mentionedUserId: data.mentionedUserId || null,
    mentionedUserName: data.mentionedUserName || null,
    supervisorOrder: {
      orderDate: serverTimestamp(),
      deadline: data.deadline,
      requestedByUid: performedBy.uid,
      requestedByName: performedBy.name,
      note: data.note
    },
    lastUpdatedAt: serverTimestamp()
  };

  // Pre-calculate stats at creation
  try {
    const { studentEvals, groupSessions, totalRequired, totalCompleted } = 
      await calculateStudentAcademicStats(data.groupId, data.studentId);

    const groupSessionsFiltered = groupSessions.filter(s => s.sessionNumber > 0);
    const studentEvalsFiltered = studentEvals.filter(e => e.sessionNumber > 0);

    const totalAttended = studentEvalsFiltered.filter(e => e.attendance === 1).length;
    const totalSessions = groupSessionsFiltered.length;

    updates.tasksDone = totalCompleted;
    updates.totalTasks = totalRequired;
    updates.attendanceCount = totalAttended;
    updates.totalSessions = totalSessions;
  } catch (err) {
    console.error("Error calculating stats in requestFollowUp:", err);
  }

  await setDoc(doc(db, 'studentFollowUps', docId), updates, { merge: true });

  await logActivity({
    action: 'FOLLOWUP_REQUEST',
    entityType: 'follow_up',
    entityId: docId,
    entityName: data.studentName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Follow-up requested for ${data.studentName}. Responsible: ${data.mentionedUserName || 'Not specified'}. Deadline: ${data.deadline}. Note: ${data.note}`
  });

  if (data.mentionedUserId && data.mentionedUserName) {
    await createFollowUpMention({
      followUpId: docId,
      groupId: data.groupId,
      studentId: data.studentId,
      studentName: data.studentName,
      mentionedUserId: data.mentionedUserId,
      mentionedUserName: data.mentionedUserName,
      mentionedByUid: performedBy.uid,
      mentionedByName: performedBy.name,
      note: data.note
    });
  }
};

export const scheduleFollowUp = async (groupId: string, studentId: string, scheduledDate: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);
  const docId = `${groupId}_${studentId}`;
  await updateDoc(doc(db, 'studentFollowUps', docId), {
    status: 'scheduled',
    scheduledAt: scheduledDate,
    lastUpdatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'FOLLOWUP_SCHEDULE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Follow-up scheduled for student ${studentId} on ${scheduledDate}`
  });
};

export const autoActivateScheduledFollowUps = async () => {
  const today = new Date().toISOString().split('T')[0];
  const qSnap = await getDocs(query(
    collection(db, 'studentFollowUps'),
    where('status', '==', 'scheduled'),
    where('scheduledAt', '<=', today)
  ));

  if (qSnap.empty) return;

  const batch = writeBatch(db);
  qSnap.docs.forEach((doc: any) => {
    batch.update(doc.ref, {
      status: 'active',
      colorStatus: 'yellow',
      lastUpdatedAt: serverTimestamp()
    });
  });
  await batch.commit();
};

export const requestSupervisorFollowUp = requestFollowUp;

export const submitTrainerFollowUpUpdate = async (
  groupId: string, 
  studentId: string, 
  note: string, 
  performedBy: User,
  mentionUserId?: string,
  mentionUserName?: string,
  nextFollowUpDate?: string,
  resetAttendanceOnSession?: number | null,
  replyToUpdateId?: string
) => {
  await assertStudentActiveForFollowUp(studentId);

  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const snap = await getDoc(followUpRef);
  const existingData = snap.exists() ? (snap.data() as StudentFollowUp) : null;
  const nowStr = new Date().toISOString();

  const updateEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(7),
    text: note,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: nowStr,
    eventType: replyToUpdateId ? 'reply' : (nextFollowUpDate ? 'schedule_next' : 'note'),
    // Firestore rejects `undefined` field values inside arrayUnion() entries —
    // only include this key at all when there's an actual value.
    ...(replyToUpdateId ? { replyToUpdateId } : {})
  };

  const updatesPayload: any = {
    updates: arrayUnion(updateEntry),
    colorStatus: 'green',
    lastUpdatedAt: serverTimestamp()
  };

  if (existingData && existingData.status === 'scheduled') {
    updatesPayload.status = 'active';
  }

  // If next follow-up date is specified, flag it as pending supervisor approval
  if (nextFollowUpDate) {
    updatesPayload.pendingNextFollowUpDate = nextFollowUpDate;
    updatesPayload.pendingNextFollowUpNote = note;
    updatesPayload.approvalStatus = 'pending';
    updatesPayload.colorStatus = 'purple'; // Distinct color highlight for pending approval
  }

  // If canceling absence alert, save the reset session and remove the label
  if (resetAttendanceOnSession !== undefined && resetAttendanceOnSession !== null) {
    updatesPayload.attendanceResetSessionNumber = resetAttendanceOnSession;
    
    const labelComment = {
      id: Math.random().toString(36).substring(2, 11),
      text: `⚙️ تم إلغاء تنبيه الغياب والبدء بحساب نسبة الغياب من جديد بدءاً من المحاضرات التالية للمحاضرة رقم ${resetAttendanceOnSession}.`,
      createdByUid: 'system',
      createdByName: 'النظام تلقائياً',
      createdByRole: 'مساعد ذكي',
      createdAt: nowStr
    };

    if (existingData && existingData.labels) {
      const updatedLabels = existingData.labels.filter(l => l !== 'absence');
      updatesPayload.labels = updatedLabels;
    }
    
    updatesPayload.comments = arrayUnion(labelComment);
  }

  const extraComments: any[] = [];

  if (mentionUserId && mentionUserName) {
    updatesPayload.mentionedUserId = mentionUserId;
    updatesPayload.mentionedUserName = mentionUserName;
    updatesPayload.mutedUserIds = arrayRemove(mentionUserId);

    extraComments.push({
      id: Math.random().toString(36).substring(2, 11),
      text: `🔔 قامت ${performedBy.name} بمنشن وتوجيه المتابعة إلى ${mentionUserName}.`,
      createdByUid: 'system',
      createdByName: 'النظام تلقائياً',
      createdByRole: 'مساعد ذكي',
      createdAt: nowStr
    });
  }

  if (extraComments.length > 0) {
    if (updatesPayload.comments) {
      updatesPayload.comments = arrayUnion(...extraComments, ...updatesPayload.comments.newValue);
    } else {
      updatesPayload.comments = arrayUnion(...extraComments);
    }
  }

  // Use set with merge if document might not exist (though it should), otherwise update
  if (!snap.exists()) {
    updatesPayload.groupId = groupId;
    updatesPayload.studentId = studentId;
    updatesPayload.studentName = `Student ${studentId}`;
    updatesPayload.groupName = `Group ${groupId}`;
    updatesPayload.status = 'active';
    await setDoc(followUpRef, updatesPayload, { merge: true });
  } else {
    await updateDoc(followUpRef, updatesPayload);
  }

  // Recalculate stats inside submitTrainerFollowUpUpdate
  await updateFollowUpStatsInDb(groupId, studentId);

  await logActivity({
    action: 'FOLLOWUP_TRAINER_UPDATE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Trainer updated student progress. Note: ${note.substring(0, 60)}${note.length > 60 ? '...' : ''}`
  });

  const followUpStudentName = existingData?.studentName || studentId;

  if (mentionUserId && mentionUserName) {
    await createFollowUpMention({
      followUpId: docId,
      groupId,
      studentId,
      studentName: followUpStudentName,
      mentionedUserId: mentionUserId,
      mentionedUserName: mentionUserName,
      mentionedByUid: performedBy.uid,
      mentionedByName: performedBy.name,
      note
    });
  }

  // A reply to a specific earlier update re-opens a task for whoever wrote it —
  // even if they aren't the follow-up's current mentionedUserId.
  if (replyToUpdateId && existingData?.updates) {
    const originalUpdate = existingData.updates.find(u => u.id === replyToUpdateId);
    if (originalUpdate && originalUpdate.createdByUid !== performedBy.uid) {
      await createFollowUpMention({
        followUpId: docId,
        groupId,
        studentId,
        studentName: followUpStudentName,
        mentionedUserId: originalUpdate.createdByUid,
        mentionedUserName: originalUpdate.createdByName,
        mentionedByUid: performedBy.uid,
        mentionedByName: performedBy.name,
        sourceUpdateId: updateEntry.id,
        note: `رد على تحديثك: ${note}`
      });
    }
  }

  // Posting a progress update satisfies any pending task the author had on
  // this follow-up — they don't get pinged again unless someone mentions them
  // (or replies to one of their updates) afterwards.
  await closeOwnPendingMentions(docId, performedBy.uid);
};

export const approveNextFollowUpDate = async (groupId: string, studentId: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);
  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const snap = await getDoc(followUpRef);
  if (!snap.exists()) throw new Error('Follow-up record not found');
  
  const data = snap.data();
  const dateToSchedule = data.pendingNextFollowUpDate;
  if (!dateToSchedule) throw new Error('No pending next follow-up date to approve');
  
  const nowStr = new Date().toISOString();
  
  const logComment = {
    id: Math.random().toString(36).substring(2, 11),
    text: `✅ وافق المشرف ${performedBy.name} على تأجيل المتابعة إلى ${dateToSchedule}. تم نقل الطالب إلى المتابعات المجدولة (Marked as Done).`,
    createdByUid: 'system',
    createdByName: 'النظام تلقائياً',
    createdByRole: 'مساعد ذكي',
    createdAt: nowStr
  };
  
  await updateDoc(followUpRef, {
    status: 'scheduled',
    scheduledAt: dateToSchedule,
    approvalStatus: 'approved',
    pendingNextFollowUpDate: null,
    pendingNextFollowUpNote: null,
    colorStatus: 'default',
    comments: arrayUnion(logComment),
    lastUpdatedAt: serverTimestamp()
  });
  
  await logActivity({
    action: 'FOLLOWUP_APPROVE_DELAY',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor approved next follow-up date ${dateToSchedule} for student ${studentId}`
  });
};

export const rejectNextFollowUpDate = async (groupId: string, studentId: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);
  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const snap = await getDoc(followUpRef);
  if (!snap.exists()) throw new Error('Follow-up record not found');
  
  const nowStr = new Date().toISOString();
  
  const logComment = {
    id: Math.random().toString(36).substring(2, 11),
    text: `❌ رفض المشرف ${performedBy.name} تأجيل المتابعة المقترح. تظل المتابعة نشطة للمراجعة.`,
    createdByUid: 'system',
    createdByName: 'النظام تلقائياً',
    createdByRole: 'مساعد ذكي',
    createdAt: nowStr
  };
  
  await updateDoc(followUpRef, {
    approvalStatus: 'rejected',
    pendingNextFollowUpDate: null,
    pendingNextFollowUpNote: null,
    colorStatus: 'yellow',
    comments: arrayUnion(logComment),
    lastUpdatedAt: serverTimestamp()
  });
  
  await logActivity({
    action: 'FOLLOWUP_REJECT_DELAY',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor rejected next follow-up date for student ${studentId}`
  });
};

export const reopenStudentFollowUp = async (groupId: string, studentId: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);
  const docId = `${groupId}_${studentId}`;
  await updateDoc(doc(db, 'studentFollowUps', docId), {
    status: 'active',
    colorStatus: 'yellow',
    lastUpdatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'FOLLOWUP_REOPEN',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor reopened follow-up for student ${studentId}`
  });
};

export const reactivateScheduledFollowUp = async (groupId: string, studentId: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);
  const docId = `${groupId}_${studentId}`;
  await updateDoc(doc(db, 'studentFollowUps', docId), {
    status: 'active',
    lastUpdatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'FOLLOWUP_REACTIVATE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Trainer reactivated scheduled follow-up for student ${studentId}`
  });
};

export const resolveStudentFollowUp = async (groupId: string, studentId: string, performedBy: User) => {
  await assertStudentActiveForFollowUp(studentId);

  const docId = `${groupId}_${studentId}`;
  const doneEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(2, 11),
    text: `✅ قام ${performedBy.name} بإغلاق المتابعة نهائياً.`,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: new Date().toISOString(),
    eventType: 'mark_done'
  };
  await updateDoc(doc(db, 'studentFollowUps', docId), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedByUid: performedBy.uid,
    resolvedByName: performedBy.name,
    colorStatus: 'default',
    escalation: null,
    updates: arrayUnion(doneEntry),
    lastUpdatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'FOLLOWUP_RESOLVE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Follow-up resolved for student ${studentId}`
  });
};

// Bulk-closes every non-resolved follow-up (and every still-pending mention
// task) in one shot, so the system can be started fresh. Admin-only — this is
// a blunt, whole-system action, not a per-student one.
export const resetAllFollowUps = async (performedBy: User): Promise<number> => {
  const followUpsSnap = await getDocs(query(
    collection(db, 'studentFollowUps'),
    where('status', 'in', ['active', 'scheduled'])
  ));

  const nowStr = new Date().toISOString();
  const resetEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(2, 11),
    text: `🔄 قام ${performedBy.name} بإعادة تصفير كل المتابعات وإغلاقها دفعة واحدة للبدء من جديد.`,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: nowStr,
    eventType: 'mark_done'
  };

  const followUpDocs = followUpsSnap.docs;
  for (let i = 0; i < followUpDocs.length; i += 400) {
    const chunk = followUpDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((d: any) => {
      batch.update(d.ref, {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedByUid: performedBy.uid,
        resolvedByName: performedBy.name,
        colorStatus: 'default',
        escalation: null,
        updates: arrayUnion(resetEntry),
        lastUpdatedAt: serverTimestamp()
      });
    });
    await batch.commit();
  }

  // Also clear every still-pending mention task, whether or not it belonged
  // to one of the follow-ups just closed above — a full reset shouldn't leave
  // anyone with a dangling task pointing at now-closed tracking.
  const mentionsSnap = await getDocs(query(
    collection(db, 'followUpMentions'),
    where('status', '==', 'pending')
  ));
  const mentionDocs = mentionsSnap.docs;
  for (let i = 0; i < mentionDocs.length; i += 400) {
    const chunk = mentionDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((d: any) => {
      batch.update(d.ref, { status: 'done', doneAt: serverTimestamp(), doneByUid: performedBy.uid });
    });
    await batch.commit();
  }

  await logActivity({
    action: 'FOLLOWUP_RESET_ALL',
    entityType: 'follow_up',
    entityId: 'all',
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Bulk-reset ${followUpDocs.length} follow-up(s) and ${mentionDocs.length} pending mention(s) to start fresh`
  });

  return followUpDocs.length;
};

// ── Follow-up mentions (per-person task tracking) ──────────────────────────
// Each mention is its own independent row: when Sami is mentioned and Alaa is
// mentioned in the same update, each gets their own pending mention that they
// close individually — replying or marking done never affects the other's.

export const createFollowUpMention = async (params: {
  followUpId: string;
  groupId: string;
  studentId: string;
  studentName: string;
  mentionedUserId: string;
  mentionedUserName: string;
  mentionedByUid: string;
  mentionedByName: string;
  sourceUpdateId?: string;
  note?: string;
}) => {
  // Firestore rejects `undefined` field values — only include these optional
  // keys when there's an actual value.
  const payload: Omit<FollowUpMention, 'id'> = {
    followUpId: params.followUpId,
    groupId: params.groupId,
    studentId: params.studentId,
    studentName: params.studentName,
    mentionedUserId: params.mentionedUserId,
    mentionedUserName: params.mentionedUserName,
    mentionedByUid: params.mentionedByUid,
    mentionedByName: params.mentionedByName,
    createdAt: serverTimestamp(),
    status: 'pending',
    snoozedUntil: null,
    ...(params.sourceUpdateId ? { sourceUpdateId: params.sourceUpdateId } : {}),
    ...(params.note ? { note: params.note } : {})
  };
  await addDoc(collection(db, 'followUpMentions'), payload);

  await sendNotification({
    userId: params.mentionedUserId,
    title: 'مهمة متابعة جديدة 🔔',
    message: `${params.mentionedByName} أشار إليك بخصوص متابعة الطالب ${params.studentName}${params.note ? `: ${params.note}` : ''}`,
    type: 'followup_mention',
    link: `/follow-ups`
  });
};

export const markFollowUpMentionDone = async (mentionId: string, performedBy: User) => {
  await updateDoc(doc(db, 'followUpMentions', mentionId), {
    status: 'done',
    doneAt: serverTimestamp(),
    doneByUid: performedBy.uid
  });
};

export const snoozeFollowUpMention = async (mentionId: string, snoozedUntil: string) => {
  await updateDoc(doc(db, 'followUpMentions', mentionId), { snoozedUntil });
};

// Closes every pending mention a given user has on a given follow-up — used
// whenever they post a progress update, since that satisfies whatever they
// were pinged for (mirrors markFollowUpMentionDone but resolves the mention
// id(s) automatically instead of requiring the caller to know it).
const closeOwnPendingMentions = async (followUpId: string, userId: string) => {
  const snap = await getDocs(query(
    collection(db, 'followUpMentions'),
    where('followUpId', '==', followUpId),
    where('mentionedUserId', '==', userId),
    where('status', '==', 'pending')
  ));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d: any) => {
    batch.update(d.ref, { status: 'done', doneAt: serverTimestamp(), doneByUid: userId });
  });
  await batch.commit();
};

// ── Follow-up suggestions (replaces automatic transfer) ─────────────────────
// A suggestion is never written to Firestore on its own (see
// services/followUpSuggestions.ts for the live, unsaved computation). Only
// once a supervisor explicitly approves one does a real StudentFollowUp doc
// get created here.
export const approveFollowUpSuggestion = async (
  groupId: string,
  groupName: string,
  studentId: string,
  studentName: string,
  reason: 'absence' | 'tasks',
  performedBy: User,
  mentionUserId?: string,
  mentionUserName?: string
) => {
  await assertStudentActiveForFollowUp(studentId);

  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const nowStr = new Date().toISOString();

  let finalLabels: string[] = [reason];
  try {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists()) {
      const gType = groupDoc.data()?.groupType || 'online';
      finalLabels.push(gType === 'offline' ? 'offline' : 'online');
    }
  } catch (err) {
    console.error('Error setting online/offline label inside approveFollowUpSuggestion', err);
  }

  const systemEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(2, 11),
    text: `⚠️ اعتمد ${performedBy.name} اقتراح النظام وحوّله لمتابعة فعلية (السبب: ${reason === 'absence' ? 'نسبة الحضور' : 'نسبة تسليم التاسكات'}).`,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: nowStr,
    eventType: 'system'
  };

  const payload: any = {
    id: docId,
    groupId,
    groupName,
    studentId,
    studentName,
    status: 'active',
    colorStatus: 'red',
    labels: finalLabels,
    updates: arrayUnion(systemEntry),
    mentionedUserId: mentionUserId || null,
    mentionedUserName: mentionUserName || null,
    lastUpdatedAt: serverTimestamp()
  };

  try {
    const { studentEvals, groupSessions, totalRequired, totalCompleted } =
      await calculateStudentAcademicStats(groupId, studentId);
    const totalAttended = studentEvals.filter((e) => e.attendance === 1).length;
    payload.tasksDone = totalCompleted;
    payload.totalTasks = totalRequired;
    payload.attendanceCount = totalAttended;
    payload.totalSessions = groupSessions.length;
  } catch (err) {
    console.error('Error computing stats in approveFollowUpSuggestion:', err);
  }

  await setDoc(followUpRef, payload, { merge: true });

  await logActivity({
    action: 'FOLLOWUP_SUGGESTION_APPROVED',
    entityType: 'follow_up',
    entityId: docId,
    entityName: studentName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor approved an automatic follow-up suggestion for ${studentName} (reason: ${reason})`
  });

  if (mentionUserId && mentionUserName) {
    await createFollowUpMention({
      followUpId: docId,
      groupId,
      studentId,
      studentName,
      mentionedUserId: mentionUserId,
      mentionedUserName: mentionUserName,
      mentionedByUid: performedBy.uid,
      mentionedByName: performedBy.name,
      note: `متابعة جديدة (${reason === 'absence' ? 'الحضور' : 'التاسكات'})`
    });
  }
};

const SUGGESTION_REJECTION_COOLDOWN_DAYS = 7;

export const rejectFollowUpSuggestion = async (
  groupId: string,
  groupName: string,
  studentId: string,
  studentName: string,
  reason: 'absence' | 'tasks',
  rejectionReason: string,
  performedBy: User
) => {
  const id = `${groupId}_${studentId}_${reason}`;
  const reappearDate = new Date();
  reappearDate.setDate(reappearDate.getDate() + SUGGESTION_REJECTION_COOLDOWN_DAYS);
  const reappearAt = reappearDate.toISOString().slice(0, 10);

  const payload: Omit<FollowUpSuggestionRejection, 'id'> = {
    groupId,
    groupName,
    studentId,
    studentName,
    reason,
    rejectedByUid: performedBy.uid,
    rejectedByName: performedBy.name,
    rejectedAt: serverTimestamp(),
    rejectionReason,
    reappearAt
  };

  await setDoc(doc(db, 'followUpSuggestionRejections', id), payload);

  await logActivity({
    action: 'FOLLOWUP_SUGGESTION_REJECTED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    entityName: studentName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor rejected an automatic follow-up suggestion for ${studentName} (reason: ${reason}). Won't reappear before ${reappearAt}. Note: ${rejectionReason}`
  });
};

// ── Permanent, reason-scoped suggestion exemptions ───────────────────────────
// A standing exception (e.g. an approved excused-absence arrangement) — unlike
// rejectFollowUpSuggestion's 7-day cooldown, this never expires on its own.
export const exemptStudentFromSuggestions = async (
  groupId: string,
  groupName: string,
  studentId: string,
  studentName: string,
  reason: 'absence' | 'tasks',
  exemptionReason: string,
  performedBy: User
) => {
  const id = `${groupId}_${studentId}_${reason}`;
  const payload: Omit<FollowUpSuggestionExemption, 'id'> = {
    groupId,
    groupName,
    studentId,
    studentName,
    reason,
    exemptionReason,
    exemptedByUid: performedBy.uid,
    exemptedByName: performedBy.name,
    exemptedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'followUpSuggestionExemptions', id), payload);

  await logActivity({
    action: 'FOLLOWUP_SUGGESTION_EXEMPTION_ADDED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    entityName: studentName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Exempted ${studentName} from automatic follow-up suggestions (reason: ${reason}). Note: ${exemptionReason}`
  });
};

export const removeSuggestionExemption = async (id: string, performedBy: User) => {
  await deleteDoc(doc(db, 'followUpSuggestionExemptions', id));

  await logActivity({
    action: 'FOLLOWUP_SUGGESTION_EXEMPTION_REMOVED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Removed a suggestion exemption`
  });
};

// ── Suggestion escalations (decision needed beyond approve/reject, e.g. the
// student may need removing from the system entirely) ──────────────────────
// This only tracks the decision loop — pending → approved → done — it never
// performs the proposed action itself; that stays a manual step the
// supervisor does elsewhere in the app, confirmed here once actually done.
export const escalateSuggestionToAdmin = async (
  groupId: string,
  groupName: string,
  studentId: string,
  studentName: string,
  reason: 'absence' | 'tasks',
  proposedAction: string,
  performedBy: User,
  adminUsers: User[]
) => {
  const payload: Omit<SuggestionEscalation, 'id'> = {
    groupId,
    groupName,
    studentId,
    studentName,
    reason,
    proposedAction,
    escalatedByUid: performedBy.uid,
    escalatedByName: performedBy.name,
    escalatedAt: serverTimestamp(),
    status: 'pending'
  };
  const docRef = await addDoc(collection(db, 'suggestionEscalations'), payload);

  await logActivity({
    action: 'SUGGESTION_ESCALATED',
    entityType: 'follow_up_suggestion',
    entityId: docRef.id,
    entityName: studentName,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Escalated suggestion for ${studentName} to admin for a decision. Proposed action: ${proposedAction}`
  });

  await Promise.all(
    adminUsers.map((admin) =>
      sendNotification({
        userId: admin.uid,
        title: 'قرار مطلوب بخصوص اقتراح متابعة 🏛️',
        message: `${performedBy.name} صعّد اقتراح متابعة الطالب ${studentName} يحتاج قرارك. الإجراء المقترح: ${proposedAction}`,
        type: 'followup_escalation',
        link: `/follow-ups`
      })
    )
  );
};

export const approveSuggestionEscalation = async (id: string, adminNote: string, performedBy: User) => {
  await updateDoc(doc(db, 'suggestionEscalations', id), {
    status: 'approved',
    adminUid: performedBy.uid,
    adminName: performedBy.name,
    adminRespondedAt: serverTimestamp(),
    ...(adminNote ? { adminNote } : {})
  });

  await logActivity({
    action: 'SUGGESTION_ESCALATION_APPROVED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Admin approved the proposed action for suggestion escalation ${id}`
  });
};

export const markSuggestionEscalationDone = async (id: string, performedBy: User) => {
  await updateDoc(doc(db, 'suggestionEscalations', id), {
    status: 'done',
    executedByUid: performedBy.uid,
    executedAt: serverTimestamp()
  });

  await logActivity({
    action: 'SUGGESTION_ESCALATION_DONE',
    entityType: 'follow_up_suggestion',
    entityId: id,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Supervisor confirmed the approved action was executed for suggestion escalation ${id}`
  });
};

// Undoes exactly one step: done → approved, approved → pending.
export const revertSuggestionEscalation = async (id: string, currentStatus: 'approved' | 'done', performedBy: User) => {
  const previousStatus = currentStatus === 'done' ? 'approved' : 'pending';
  await updateDoc(doc(db, 'suggestionEscalations', id), { status: previousStatus });

  await logActivity({
    action: 'SUGGESTION_ESCALATION_REVERTED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Reverted suggestion escalation ${id} from ${currentStatus} back to ${previousStatus}`
  });
};

export const cancelSuggestionEscalation = async (id: string, performedBy: User) => {
  await deleteDoc(doc(db, 'suggestionEscalations', id));

  await logActivity({
    action: 'SUGGESTION_ESCALATION_CANCELLED',
    entityType: 'follow_up_suggestion',
    entityId: id,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Cancelled a pending suggestion escalation`
  });
};

// ── Escalation to admin ─────────────────────────────────────────────────────
export const escalateFollowUp = async (
  groupId: string,
  studentId: string,
  proposedAction: string,
  performedBy: User,
  adminUsers: User[]
) => {
  await assertStudentActiveForFollowUp(studentId);

  const docId = `${groupId}_${studentId}`;
  const nowStr = new Date().toISOString();

  const escalation: FollowUpEscalation = {
    status: 'pending',
    proposedAction,
    escalatedByUid: performedBy.uid,
    escalatedByName: performedBy.name,
    escalatedAt: serverTimestamp()
  };

  const timelineEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(2, 11),
    text: `🔺 صعّد ${performedBy.name} هذه المتابعة للإدارة. الإجراء المقترح: ${proposedAction}`,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: nowStr,
    eventType: 'escalate'
  };

  await updateDoc(doc(db, 'studentFollowUps', docId), {
    escalation,
    updates: arrayUnion(timelineEntry),
    lastUpdatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'FOLLOWUP_ESCALATE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Escalated to admin. Proposed action: ${proposedAction}`
  });

  await Promise.all(
    adminUsers.map((admin) =>
      sendNotification({
        userId: admin.uid,
        title: 'تصعيد متابعة عاجل 🔺',
        message: `${performedBy.name} صعّد متابعة طالب للإدارة. الإجراء المقترح: ${proposedAction}`,
        type: 'followup_escalation',
        link: `/follow-ups`
      })
    )
  );
};

export const respondToEscalation = async (
  groupId: string,
  studentId: string,
  status: 'approved' | 'on_hold' | 'resolved',
  adminNote: string,
  performedBy: User
) => {
  const docId = `${groupId}_${studentId}`;
  const followUpRef = doc(db, 'studentFollowUps', docId);
  const snap = await getDoc(followUpRef);
  if (!snap.exists()) throw new Error('Follow-up record not found');

  const nowStr = new Date().toISOString();
  const statusLabel = status === 'approved' ? 'بالموافقة' : status === 'on_hold' ? 'بالتعليق مؤقتاً' : 'بالإغلاق';

  const timelineEntry: FollowUpUpdate = {
    id: Math.random().toString(36).substring(2, 11),
    text: `🛡️ رد الأدمن ${performedBy.name} على التصعيد ${statusLabel}.${adminNote ? ` ملحوظة: ${adminNote}` : ''}`,
    createdByUid: performedBy.uid,
    createdByName: performedBy.name,
    createdAt: nowStr,
    eventType: 'escalate'
  };

  const updatePayload: any = {
    updates: arrayUnion(timelineEntry),
    lastUpdatedAt: serverTimestamp()
  };

  if (status === 'resolved') {
    // Escalation fully clears — the follow-up drops back to a normal internal
    // item between staff, and the admin mention disappears from the UI.
    updatePayload.escalation = null;
  } else {
    updatePayload.escalation = {
      ...(snap.data() as StudentFollowUp).escalation,
      status,
      adminUid: performedBy.uid,
      adminName: performedBy.name,
      adminNote: adminNote || null,
      resolvedAt: status === 'approved' || status === 'on_hold' ? null : serverTimestamp()
    };
  }

  await updateDoc(followUpRef, updatePayload);

  await logActivity({
    action: 'FOLLOWUP_ESCALATION_RESPONSE',
    entityType: 'follow_up',
    entityId: docId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Admin responded to escalation with status: ${status}`
  });
};

export const saveLabelDefinition = async (label: Partial<LabelDefinition>, performedBy: User) => {
  const isNew = !label.id;
  const payload: any = {
    ...label
  };
  
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = performedBy.uid;
  }
  
  if (isNew) {
    const docRef = await addDoc(collection(db, 'labelDefinitions'), payload);
    await logActivity({
      action: 'LABEL_CREATE',
      entityType: 'label',
      entityId: docRef.id,
      entityName: label.name,
      performedByUid: performedBy.uid,
      performedByName: performedBy.name,
      performedByRole: performedBy.role,
      details: `Created new label definition: ${label.name}`
    });
    return docRef.id;
  } else {
    await setDoc(doc(db, 'labelDefinitions', label.id!), payload, { merge: true });
    await logActivity({
      action: 'LABEL_UPDATE',
      entityType: 'label',
      entityId: label.id!,
      entityName: label.name,
      performedByUid: performedBy.uid,
      performedByName: performedBy.name,
      performedByRole: performedBy.role,
      details: `Updated label definition: ${label.name}`
    });
    return label.id;
  }
};

export const deleteLabelDefinitionWithLog = async (id: string, name: string, performedBy: User) => {
  await deleteDoc(doc(db, 'labelDefinitions', id));
  await logActivity({
    action: 'LABEL_DELETE',
    entityType: 'label',
    entityId: id,
    entityName: name,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Deleted label definition: ${name}`
  });
};

export const deleteLabelDefinition = async (id: string) => {
  await deleteDoc(doc(db, 'labelDefinitions', id));
};

export const updateFollowUpLabels = async (groupId: string, groupName: string, studentId: string, studentName: string, labels: string[], options?: { isAutomaticSync?: boolean }) => {
  const isAutomaticSync = options?.isAutomaticSync === true;
  const docId = `${groupId}_${studentId}`;
  const docRef = doc(db, 'studentFollowUps', docId);
  const snap = await getDoc(docRef);
  
  const nowStr = new Date().toISOString();
  let oldLabels: string[] = [];
  if (snap.exists()) {
    const data = snap.data() as StudentFollowUp;
    oldLabels = data.labels || [];
  }

  // Force 'online' or 'offline' automatically based on the group connection type
  let finalLabels = [...labels];
  try {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists()) {
      const gData = groupDoc.data();
      const gType = gData?.groupType || 'online';
      if (gType === 'online') {
        if (!finalLabels.includes('online')) finalLabels.push('online');
        finalLabels = finalLabels.filter(l => l !== 'offline');
      } else if (gType === 'offline') {
        if (!finalLabels.includes('offline')) finalLabels.push('offline');
        finalLabels = finalLabels.filter(l => l !== 'online');
      }
    }
  } catch (err) {
    console.error("Error reinforcing online/offline label inside updateFollowUpLabels", err);
  }

  const added = finalLabels.filter(l => !oldLabels.includes(l));
  const removed = oldLabels.filter(l => !finalLabels.includes(l));
  
  const newComments: any[] = [];
  
  added.forEach(l => {
    if (l === 'absence') {
      newComments.push({
        id: Math.random().toString(36).substring(2, 11),
        text: "⚙️ تحديث تلقائي من النظام: تم تفعيل متابعة الغياب لتراجع نسبة الحضور لأقل من 70% (نظام المتابعة التلقائي).",
        createdByUid: "system",
        createdByName: "النظام تلقائياً",
        createdByRole: "مساعد ذكي",
        createdAt: nowStr
      });
    }
    if (l === 'tasks') {
      newComments.push({
        id: Math.random().toString(36).substring(2, 11),
        text: "⚙️ تحديث تلقائي من النظام: تم تفعيل متابعة المهام لتراجع نسبة تسليم التاسكات لأقل من 70% (نظام المتابعة التلقائي).",
        createdByUid: "system",
        createdByName: "النظام تلقائياً",
        createdByRole: "مساعد ذكي",
        createdAt: nowStr
      });
    }
  });

  removed.forEach(l => {
    if (l === 'absence') {
      newComments.push({
        id: Math.random().toString(36).substring(2, 11),
        text: "⚙️ تحديث تلقائي من النظام: تم رفع متابعة الغياب تلقائياً لتحسن نسبة الحضور إلى 70% فأكثر.",
        createdByUid: "system",
        createdByName: "النظام تلقائياً",
        createdByRole: "مساعد ذكي",
        createdAt: nowStr
      });
    }
    if (l === 'tasks') {
      newComments.push({
        id: Math.random().toString(36).substring(2, 11),
        text: "⚙️ تحديث تلقائي من النظام: تم رفع كارت متابعة المهام التلقائي لتحسن نسبة تسليم التاسكات إلى 70% فأكثر.",
        createdByUid: "system",
        createdByName: "النظام تلقائياً",
        createdByRole: "مساعد ذكي",
        createdAt: nowStr
      });
    }
  });

  if (snap.exists()) {
    const data = snap.data() as StudentFollowUp;

    // Automatic threshold sync must never silently reactivate a resolved follow-up —
    // that would recreate the old "auto-transfer" behavior. A resolved follow-up only
    // comes back via an explicit human suggestion approval or reopen action, so the
    // automatic sync does nothing at all here (it's surfaced as a live suggestion instead).
    if (isAutomaticSync && data.status === 'resolved') {
      return;
    }

    const updateData: any = {
      labels: finalLabels,
      lastUpdatedAt: serverTimestamp(),
      studentName,
      groupName
    };

    if (data.status === 'resolved' && finalLabels.length > 0) {
      updateData.status = 'active';
      updateData.colorStatus = 'red';
    }

    if (newComments.length > 0) {
      updateData.comments = arrayUnion(...newComments);
    }

    try {
      const resetSessionNum = data.attendanceResetSessionNumber || 0;
      const { studentEvals, groupSessions, totalRequired, totalCompleted } = 
        await calculateStudentAcademicStats(groupId, studentId);

      const groupSessionsFiltered = groupSessions.filter(s => s.sessionNumber > resetSessionNum);
      const studentEvalsFiltered = studentEvals.filter(e => e.sessionNumber > resetSessionNum);

      const totalAttended = studentEvalsFiltered.filter(e => e.attendance === 1).length;
      const totalSessions = groupSessionsFiltered.length;

      updateData.tasksDone = totalCompleted;
      updateData.totalTasks = totalRequired;
      updateData.attendanceCount = totalAttended;
      updateData.totalSessions = totalSessions;
    } catch (err) {
      console.error("Error computing academic stats in updateFollowUpLabels (exists):", err);
    }
    
    await updateDoc(docRef, updateData);
  } else if (finalLabels.length > 0 && !isAutomaticSync) {
    // A brand-new follow-up is only ever created by an explicit human action
    // (manual label toggle, or approveFollowUpSuggestion). Automatic threshold
    // detection with no existing doc is surfaced only as a live suggestion —
    // see computeFollowUpSuggestions in services/followUpSuggestions.ts.
    const insertData: any = {
      id: docId,
      groupId,
      groupName,
      studentId,
      studentName,
      status: 'active',
      colorStatus: 'red',
      labels: finalLabels,
      comments: newComments,
      lastUpdatedAt: serverTimestamp()
    };

    try {
      const { studentEvals, groupSessions, totalRequired, totalCompleted } = 
        await calculateStudentAcademicStats(groupId, studentId);

      const groupSessionsFiltered = groupSessions.filter(s => s.sessionNumber > 0);
      const studentEvalsFiltered = studentEvals.filter(e => e.sessionNumber > 0);

      const totalAttended = studentEvalsFiltered.filter(e => e.attendance === 1).length;
      const totalSessions = groupSessionsFiltered.length;

      insertData.tasksDone = totalCompleted;
      insertData.totalTasks = totalRequired;
      insertData.attendanceCount = totalAttended;
      insertData.totalSessions = totalSessions;
    } catch (err) {
      console.error("Error computing academic stats in updateFollowUpLabels (new):", err);
    }

    await setDoc(docRef, insertData);
  }
};

// Complaints Services
export const saveComplaint = async (complaint: Partial<Complaint>, performedBy: User) => {
  const isNew = !complaint.id;
  const payload: any = {
    ...complaint,
    updatedAt: serverTimestamp()
  };
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.status = payload.status || 'active';
    payload.createdBy = performedBy.uid;
    payload.createdByName = performedBy.name;
  }

  if (isNew) {
    const docRef = await addDoc(collection(db, 'complaints'), payload);
    await logActivity({ action: 'COMPLAINT_CREATE', entityType: 'complaint', entityId: docRef.id, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return docRef.id;
  } else {
    await setDoc(doc(db, 'complaints', complaint.id!), payload, { merge: true });
    await logActivity({ action: 'COMPLAINT_UPDATE', entityType: 'complaint', entityId: complaint.id!, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
    return complaint.id;
  }
};

export const deleteComplaint = async (id: string, performedBy: User) => {
  await deleteDoc(doc(db, 'complaints', id));
  await logActivity({ action: 'COMPLAINT_DELETE', entityType: 'complaint', entityId: id, performedByUid: performedBy.uid, performedByName: performedBy.name, performedByRole: performedBy.role });
};

// Session Date Shifting Logic
export const shiftSessionDates = async (groupId: string, fromSessionNumber: number, performedBy: User, manualFirstDate?: string, reason?: string) => {
  console.log('Shifting sessions from:', fromSessionNumber, 'for group:', groupId, 'Manual Date:', manualFirstDate);
  const group = await getDocument<Group>('groups', groupId);
  if (!group) {
    console.error('Group not found:', groupId);
    return;
  }

  const q = query(collection(db, 'sessions'), where('groupId', '==', groupId), orderBy('sessionNumber', 'asc'));
  const snap = await getDocs(q);
  const sessions = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Session));
  
  const sessionsToShift = sessions.filter(s => s.sessionNumber >= fromSessionNumber);
  console.log('Sessions to shift:', sessionsToShift.length);
  if (sessionsToShift.length === 0) return;

  const dayMap: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
  const targetDays = group.daysOfWeek.map(d => dayMap[d]).filter(d => d !== undefined);
  if (targetDays.length === 0) return;

  const batch = writeBatch(db);
  
  const getNextDate = (date: Date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (!targetDays.includes(next.getDay())) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  let currentDate = manualFirstDate ? new Date(manualFirstDate) : new Date(sessionsToShift[0].date || new Date());
  if (isNaN(currentDate.getTime())) currentDate = new Date();
  
  const rescheduleLogPromises: Promise<any>[] = [];

  for (let i = 0; i < sessionsToShift.length; i++) {
    const session = sessionsToShift[i];
    let dateToSet;
    
    if (i === 0 && manualFirstDate) {
      dateToSet = currentDate;
    } else {
      dateToSet = getNextDate(currentDate);
    }
    
    const dateStr = `${dateToSet.getFullYear()}-${String(dateToSet.getMonth() + 1).padStart(2, '0')}-${String(dateToSet.getDate()).padStart(2, '0')}`;
    const oldDateStr = session.date || '';

    const entryReason = (i === 0 && reason) ? reason : 'تم ترحيل المحاضرة تلقائياً بناءً على ترحيل جدول الجروب';
    const historyEntry = {
      oldDate: oldDateStr,
      newDate: dateStr,
      reason: entryReason,
      changedBy: performedBy.name || 'Admin',
      changedAt: new Date().toISOString()
    };

    const updateData: any = { 
      date: dateStr, 
      currentScheduledDate: dateStr,
      originalDate: session.originalDate || oldDateStr || dateStr,
      googleSyncStatus: 'pending',
      updatedAt: serverTimestamp(),
      rescheduleHistory: firestore.arrayUnion(historyEntry)
    };

    if (i === 0 && manualFirstDate) {
      updateData.isPostponed = true;
      if (reason) {
        updateData.dateChangeReason = reason;
        updateData.dateHistory = firestore.arrayUnion({
          oldDate: oldDateStr,
          newDate: dateStr,
          reason: reason,
          changedByUid: performedBy.uid,
          changedByName: performedBy.name,
          changedAt: new Date().toISOString()
        });
      }
    }

    batch.update(doc(db, 'sessions', session.id), updateData);

    // Record entry in rescheduleLogs collection
    rescheduleLogPromises.push(
      addDoc(collection(db, 'rescheduleLogs'), {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        groupId: groupId,
        groupName: group.name || '',
        oldDate: oldDateStr,
        newDate: dateStr,
        reason: entryReason,
        changedBy: performedBy.name || 'Admin',
        changedAt: new Date().toISOString(),
        googleSyncStatus: 'pending'
      })
    );

    currentDate = dateToSet;
  }

  await batch.commit();
  await Promise.all(rescheduleLogPromises);

  await logActivity({ 
    action: manualFirstDate ? 'SESSION_POSTPONE' : 'SESSIONS_SHIFT', 
    entityType: 'group', 
    entityId: groupId, 
    performedByUid: performedBy.uid, 
    performedByName: performedBy.name, 
    performedByRole: performedBy.role, 
    details: { fromSessionNumber, manualFirstDate, reason } 
  });

  // Send email & in-app notifications to all active students in the group about rescheduled lecture
  try {
    const primarySession = sessionsToShift[0];
    if (primarySession) {
      const studentsSnap = await getDocs(query(collection(db, 'students'), where('groupId', '==', groupId)));
      const students = studentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));

      // Fetch course name
      let courseName = group.courseId || group.name || '';
      if (group.courseId) {
        try {
          const cDoc = await getDoc(doc(db, 'courses', group.courseId));
          if (cDoc.exists()) {
            courseName = cDoc.data()?.title || cDoc.data()?.name || courseName;
          }
        } catch (e) {
          console.warn("Could not fetch course doc:", e);
        }
      }

      // Fetch trainer name
      let trainerName = 'م. صابر عبد الدايم';
      const trainerId = group.primaryTrainerId || (group.trainerIds && group.trainerIds[0]);
      if (trainerId) {
        try {
          const tDoc = await getDoc(doc(db, 'trainers', trainerId));
          if (tDoc.exists()) {
            trainerName = tDoc.data()?.name || trainerName;
          }
        } catch (e) {
          console.warn("Could not fetch trainer doc:", e);
        }
      }

      const firstShiftedDate = manualFirstDate 
        ? manualFirstDate 
        : (sessionsToShift[0]?.date || new Date().toISOString().split('T')[0]);
      const firstOldDate = primarySession.date || '';
      const sessionNum = primarySession.sessionNumber;
      const changeReason = reason || 'تم تحديث جدول المحاضرات المعتمد للجروب';

      for (const student of students) {
        if (student.deactivated) continue;

        // In-app notification
        try {
          await sendNotification({
            userId: student.id,
            title: `📅 تعديل موعد المحاضرة رقم ${sessionNum}`,
            message: `تم تعديل/ترحيل موعد المحاضرة رقم ${sessionNum} لجروب ${group.name}. الموعد الجديد: ${firstShiftedDate}.`,
            type: 'task_status',
            link: `/student-portal?studentId=${student.id}`
          });
        } catch (e) {
          console.error("Failed to send in-app notification for reschedule:", e);
        }

        // Email notification
        if (student.email) {
          fetch(getApiEndpoint('/api/google/send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: student.email,
              studentName: student.name,
              groupId: groupId,
              groupCode: group.name,
              courseName: courseName,
              batchCode: group.batchCode || group.name || '',
              trainerName: trainerName,
              sessionNumber: sessionNum,
              oldDate: firstOldDate,
              newDate: firstShiftedDate,
              date: firstShiftedDate,
              time: primarySession.time || group.sessionTime || '18:00',
              reason: changeReason,
              template: 'session_changed'
            })
          }).catch(err => console.error(`Error sending reschedule email to ${student.email}:`, err));
        }
      }
    }
  } catch (notifyErr) {
    console.error("Failed sending reschedule notifications to students:", notifyErr);
  }

  // Automatically trigger Google Calendar event updates for online groups
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (groupSnap.exists() && groupSnap.data()?.groupType === 'offline') {
      console.log("Offline group - skipping auto Google Calendar sync after reschedule.");
      return;
    }

    const res = await fetch(getApiEndpoint('/api/google/sync-group-calendar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        operatorName: performedBy.name,
        operatorEmail: performedBy.email
      })
    });
    const result = await res.json();
    console.log("Google Calendar auto-sync after reschedule result:", result);
  } catch (err) {
    console.error("Failed to trigger Google Calendar auto-sync after reschedule:", err);
  }
};

export const markStudentAttendanceSelf = async (groupId: string, studentId: string, sessionNumber: number, sessionId: string) => {
  // Let's find if there is an existing lecture evaluation for this student, group, and sessionNumber
  const q = query(
    collection(db, 'lectureEvaluations'),
    where('groupId', '==', groupId),
    where('studentId', '==', studentId),
    where('sessionNumber', '==', sessionNumber)
  );
  const qSnap = await getDocs(q);
  const existingEval = !qSnap.empty ? { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as any : null;
  
  if (existingEval && existingEval.attendance === 1) {
    return { alreadyRegistered: true };
  }

  const updatedEval: any = {
    ...existingEval,
    attendance: 1, // Present
    groupId,
    studentId,
    sessionNumber,
    sessionId,
    evaluatorId: 'student_self', // student self-marked
    updatedAt: serverTimestamp()
  };

  const targetId = existingEval?.id || (sessionId 
    ? `${groupId}_${sessionId}_${studentId}`
    : `${groupId}_session_${sessionNumber}_${studentId}`);

  await setDoc(doc(db, 'lectureEvaluations', targetId), updatedEval, { merge: true });

  // Also auto-recalculate student ranking after self marking attendance
  await recalculateStudentRanking(groupId, studentId);

  return { alreadyRegistered: false };
};

export const saveCourseChecklistAndSettings = async (
  courseId: string,
  maxApprovedHours: number,
  checklist: CourseChecklistItemTemplate[],
  syncScope: 'all' | 'active_upcoming' | 'new' | 'template_only',
  performedBy: User
) => {
  // Update Course itself first
  await updateDoc(doc(db, 'courses', courseId), {
    maxApprovedHours,
    checklist,
    updatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'COURSE_CHECKLIST_UPDATE',
    entityType: 'course',
    entityId: courseId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Updated course checklist and max approved hours (${maxApprovedHours}). Scope: ${syncScope}`
  });

  if (syncScope === 'template_only') return;

  // Find all groups for this course
  const groupsSnap = await getDocs(query(collection(db, 'groups'), where('courseId', '==', courseId)));
  const groups = groupsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Group));

  for (const group of groups) {
    // Determine group sessions
    const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('groupId', '==', group.id)));
    const sList = sessionsSnap.docs.map((d: any) => d.data());
    
    const totalSessionsDone = sList.filter((s: any) => s.status === 'done').length;
    const isNew = totalSessionsDone === 0;
    const isArchived = group.archived === true || sList.every((s: any) => s.status === 'done');
    const isOngoing = !isNew && !isArchived;

    let shouldSync = false;
    if (syncScope === 'all') {
      shouldSync = true;
    } else if (syncScope === 'active_upcoming') {
      shouldSync = isOngoing || isNew;
    } else if (syncScope === 'new') {
      shouldSync = isNew;
    }

    if (shouldSync) {
      // Fetch current GroupExecutionPlan
      const planRef = doc(db, 'groupExecutionPlans', group.id);
      const planSnap = await getDoc(planRef);
      let currentItems: GroupChecklistItem[] = [];

      if (planSnap.exists()) {
        const data = planSnap.data() as any;
        currentItems = data.items || [];
      }

      const mergedItems: GroupChecklistItem[] = [];

      // Add/Update items from the template
      for (const tempItem of checklist) {
        const existingItem = currentItems.find(i => i.id === tempItem.id);
        if (existingItem) {
          mergedItems.push({
            ...existingItem,
            title: tempItem.title,
            description: tempItem.description || '',
            module: tempItem.module || '',
            seq: tempItem.seq,
            isRequired: tempItem.isRequired,
            suggestedSession: tempItem.suggestedSession || 1
          });
        } else {
          mergedItems.push({
            id: tempItem.id,
            title: tempItem.title,
            description: tempItem.description || '',
            module: tempItem.module || '',
            seq: tempItem.seq,
            isRequired: tempItem.isRequired,
            suggestedSession: tempItem.suggestedSession || 1,
            plannedSession: tempItem.suggestedSession || 1,
            status: 'not_started'
          });
        }
      }

      // Handle archive for items no longer in course template
      for (const existingItem of currentItems) {
        const stillInTemplate = checklist.some(t => t.id === existingItem.id);
        if (!stillInTemplate) {
          if (existingItem.status === 'completed' || existingItem.status === 'partially_completed') {
            mergedItems.push({
              ...existingItem,
              title: `${existingItem.title} (محذوف من القالب)`
            });
          }
        }
      }

      await setDoc(planRef, {
        id: group.id,
        groupId: group.id,
        items: mergedItems,
        updatedAt: serverTimestamp(),
        updatedByUid: performedBy.uid,
        updatedByName: performedBy.name
      }, { merge: true });

      await logActivity({
        action: 'GROUP_EXECUTION_PLAN_SYNC',
        entityType: 'group',
        entityId: group.id,
        performedByUid: performedBy.uid,
        performedByName: performedBy.name,
        performedByRole: performedBy.role,
        details: `Synced execution plan with updated Course Checklist: ${courseId}`
      });
    }
  }
};

export const saveTrainerPlan = async (plan: Partial<TrainerPlan>, performedBy: User) => {
  const planId = `${plan.trainerId}_${plan.courseId}`;
  const planRef = doc(db, 'trainerPlans', planId);
  
  const payload = {
    ...plan,
    id: planId,
    active: plan.active !== false,
    updatedAt: serverTimestamp()
  };
  
  await setDoc(planRef, payload, { merge: true });

  await logActivity({
    action: 'TRAINER_PLAN_SAVE',
    entityType: 'trainerPlan',
    entityId: planId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Saved TrainerPlan for trainer ${plan.trainerName} and course ${plan.courseName}`
  });
};

export const getTrainerPlan = async (trainerId: string, courseId: string): Promise<TrainerPlan | null> => {
  const planId = `${trainerId}_${courseId}`;
  return getDocument<TrainerPlan>('trainerPlans', planId);
};

export const saveGroupExecutionPlan = async (groupId: string, items: GroupChecklistItem[], performedBy: User, logMsg?: string) => {
  const planRef = doc(db, 'groupExecutionPlans', groupId);
  await setDoc(planRef, {
    id: groupId,
    groupId,
    items,
    updatedAt: serverTimestamp(),
    updatedByUid: performedBy.uid,
    updatedByName: performedBy.name
  }, { merge: true });

  await logActivity({
    action: 'GROUP_EXECUTION_PLAN_UPDATE',
    entityType: 'group',
    entityId: groupId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: logMsg || `Updated manual changes on Group Execution Plan`
  });
};

export const getGroupExecutionPlan = async (groupId: string): Promise<GroupExecutionPlan | null> => {
  return getDocument<GroupExecutionPlan>('groupExecutionPlans', groupId);
};

export const initializeGroupExecutionPlan = async (groupId: string, courseId: string, trainerId: string, performedBy: User) => {
  const course = await getDocument<Course>('courses', courseId);
  if (!course) return;

  const trainerPlan = await getTrainerPlan(trainerId, courseId);
  const checklistItems = course.checklist || [];

  const executionItems: GroupChecklistItem[] = checklistItems.map(item => {
    const plannedSession = (trainerPlan?.active && trainerPlan.allocations?.[item.id]) 
      ? trainerPlan.allocations[item.id] 
      : (item.suggestedSession || 1);

    return {
      id: item.id,
      title: item.title,
      description: item.description || '',
      module: item.module || '',
      seq: item.seq,
      isRequired: item.isRequired,
      suggestedSession: item.suggestedSession || 1,
      plannedSession,
      status: 'not_started'
    };
  });

  await saveGroupExecutionPlan(groupId, executionItems, performedBy, `Automatically initialized Group Execution Plan using ${trainerPlan ? 'Trainer Course Plan Template' : 'General Course Checklist'}`);
};

export const saveSessionExecution = async (sessionId: string, data: Partial<Session>, performedBy: User) => {
  await updateDoc(doc(db, 'sessions', sessionId), {
    ...data,
    updatedAt: serverTimestamp()
  });

  await logActivity({
    action: 'SESSION_EXECUTION_SAVE',
    entityType: 'session',
    entityId: sessionId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: `Updated session execution log and tracking fields for session number ${data.sessionNumber || ''}`
  });
};

export const saveLectureFeedback = async (feedback: Omit<LectureFeedback, 'id' | 'createdAt'>) => {
  return addDoc(collection(db, 'feedback'), {
    ...feedback,
    createdAt: serverTimestamp()
  });
};

export const updateFeedbackComplaint = async (feedbackId: string, updates: Partial<LectureFeedback>) => {
  const docRef = doc(db, 'feedback', feedbackId);
  return updateDoc(docRef, {
    ...updates,
    complaintUpdatedAt: serverTimestamp()
  });
};

export const getGlobalStudentTemplate = async (): Promise<string | null> => {
  try {
    const docRef = doc(db, 'settings', 'student_template');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().template || null;
    }
  } catch (error) {
    console.error("Error getting global student template:", error);
  }
  return null;
};

export const saveGlobalStudentTemplate = async (templateText: string, performedBy: User) => {
  const docRef = doc(db, 'settings', 'student_template');
  await setDoc(docRef, {
    template: templateText,
    updatedAt: serverTimestamp(),
    updatedByUid: performedBy.uid,
    updatedByName: performedBy.name
  }, { merge: true });

  await logActivity({
    action: 'SETTINGS_UPDATE_TEMPLATE',
    entityType: 'settings',
    entityId: 'student_template',
    entityName: 'WhatsApp Student Template',
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { templateSnippet: templateText.substring(0, 50) }
  });
};

export const updateStudentCredsSentStatus = async (
  studentId: string, 
  credsSent: boolean, 
  user: User
) => {
  const studentRef = doc(db, 'students', studentId);
  const updateData = credsSent ? {
    credsSent: true,
    credsSentByName: user.name,
    credsSentByUid: user.uid,
    credsSentAt: new Date().toISOString()
  } : {
    credsSent: false,
    credsSentByName: null,
    credsSentByUid: null,
    credsSentAt: null
  };
  await updateDoc(studentRef, updateData);
  
  await logActivity({
    action: credsSent ? 'STUDENT_CREDS_SENT' : 'STUDENT_CREDS_RECALL',
    entityType: 'student',
    entityId: studentId,
    performedByUid: user.uid,
    performedByName: user.name,
    performedByRole: user.role
  });
};

export const saveGraduationProject = async (project: Partial<GraduationProject>, performedBy: User) => {
  const projectId = project.id || doc(collection(db, 'graduationProjects')).id;
  const projectData = {
    ...project,
    id: projectId,
    updatedAt: serverTimestamp(),
    createdAt: project.createdAt || serverTimestamp(),
    createdByUid: project.createdByUid || performedBy.uid,
    createdByName: project.createdByName || performedBy.name
  };
  await setDoc(doc(db, 'graduationProjects', projectId), projectData, { merge: true });
  await logActivity({
    action: project.id ? 'GRADUATION_PROJECT_UPDATE' : 'GRADUATION_PROJECT_CREATE',
    entityType: 'graduationProject',
    entityId: projectId,
    entityName: project.title || 'Graduation Project',
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { groupId: project.groupId, title: project.title }
  });
  return projectId;
};

export const saveGraduationProjectSubmission = async (submission: Partial<GraduationProjectSubmission>) => {
  if (!submission.projectId || !submission.studentId) throw new Error("Missing project ID or student ID.");
  const subId = submission.id || `${submission.projectId}_${submission.studentId}`;
  const subData = {
    ...submission,
    id: subId,
    updatedAt: serverTimestamp(),
    submittedAt: submission.submittedAt || new Date().toISOString()
  };
  await setDoc(doc(db, 'graduationSubmissions', subId), subData, { merge: true });
  return subId;
};

export const saveGraduationProjectEvaluation = async (evaluation: Partial<GraduationProjectEvaluation>, performedBy: User) => {
  if (!evaluation.projectId || !evaluation.studentId || !evaluation.groupId) throw new Error("Missing evaluation parameters.");
  const evalId = `${evaluation.projectId}_${evaluation.studentId}`;
  const evalData = {
    ...evaluation,
    id: evalId,
    updatedAt: serverTimestamp(),
    evaluatedByUid: performedBy.uid,
    evaluatedByName: performedBy.name
  };
  await setDoc(doc(db, 'graduationEvaluations', evalId), evalData, { merge: true });

  // Sync to finalProjects collection for ranking calculations
  const finalProjectData: Partial<FinalProject> = {
    id: `${evaluation.groupId}_${evaluation.studentId}`,
    groupId: evaluation.groupId,
    studentId: evaluation.studentId,
    score: evaluation.totalScore || 0,
    note: evaluation.rejectionReason || 'تقييم مشروع التخرج',
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'finalProjects', `${evaluation.groupId}_${evaluation.studentId}`), finalProjectData, { merge: true });

  // Recalculate rank
  await recalculateStudentRanking(evaluation.groupId, evaluation.studentId);

  await logActivity({
    action: 'GRADUATION_PROJECT_EVALUATE',
    entityType: 'graduationProjectEvaluation',
    entityId: evalId,
    entityName: evaluation.studentName || 'Student Evaluation',
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { score: evaluation.totalScore, isRejected: evaluation.isRejected }
  });
};

export const saveGraduationProjectComment = async (comment: Partial<GraduationProjectComment>, performedBy: User) => {
  const commentId = comment.id || doc(collection(db, 'graduationComments')).id;
  const commentData = {
    ...comment,
    id: commentId,
    createdAt: comment.createdAt || serverTimestamp(),
    createdByUid: comment.createdByUid || performedBy.uid,
    createdByName: comment.createdByName || performedBy.name
  };
  await setDoc(doc(db, 'graduationComments', commentId), commentData, { merge: true });
  return commentId;
};

export const deleteGraduationProjectComment = async (commentId: string) => {
  await deleteDoc(doc(db, 'graduationComments', commentId));
};

export const importGraduationProjectToGroups = async (
  sourceProject: GraduationProject,
  targetGroups: { id: string; name: string }[],
  performedBy: User
) => {
  for (const tg of targetGroups) {
    if (tg.id === sourceProject.groupId) continue; // Skip source group
    const newProjectId = doc(collection(db, 'graduationProjects')).id;
    const importedProject: Partial<GraduationProject> = {
      id: newProjectId,
      groupId: tg.id,
      groupName: tg.name,
      courseName: sourceProject.courseName || '',
      title: sourceProject.title,
      brandName: sourceProject.brandName,
      description: sourceProject.description,
      requirements: sourceProject.requirements,
      telegramChannelLink: sourceProject.telegramChannelLink,
      submissionGuideVideoLink: sourceProject.submissionGuideVideoLink || '',
      extraLinks: sourceProject.extraLinks || [],
      startDate: sourceProject.startDate,
      endDate: sourceProject.endDate,
      rules: sourceProject.rules,
      templateId: sourceProject.id,
      createdAt: serverTimestamp(),
      createdByUid: performedBy.uid,
      createdByName: performedBy.name
    };
    await setDoc(doc(db, 'graduationProjects', newProjectId), importedProject);

    // Update source project assignedGroupIds & assignedGroupNames
    const updatedAssignedIds = Array.from(new Set([...(sourceProject.assignedGroupIds || []), tg.id]));
    const updatedAssignedNames = Array.from(new Set([...(sourceProject.assignedGroupNames || []), tg.name]));
    await updateDoc(doc(db, 'graduationProjects', sourceProject.id), {
      assignedGroupIds: updatedAssignedIds,
      assignedGroupNames: updatedAssignedNames
    });
  }

  await logActivity({
    action: 'GRADUATION_PROJECT_IMPORT',
    entityType: 'graduationProject',
    entityId: sourceProject.id,
    entityName: sourceProject.title,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { importedToCount: targetGroups.length }
  });
};

export const saveStudentCertificateRecord = async (
  groupId: string,
  studentId: string,
  record: {
    studentName?: string;
    statusOverride?: 'none' | 'exception_granted' | 'blocked';
    overrideReason?: string;
    certificateUrl?: string;
    uneligibilityReason?: string;
  },
  performedBy: { uid: string; name: string; role: string }
) => {
  const docId = `${groupId}_${studentId}`;
  const ref = doc(db, 'studentCertificates', docId);
  const dataToSave = {
    ...record,
    groupId,
    studentId,
    updatedAt: serverTimestamp(),
    updatedByUid: performedBy.uid,
    updatedByName: performedBy.name
  };
  await setDoc(ref, dataToSave, { merge: true });

  await logActivity({
    action: 'STUDENT_CERTIFICATE_UPDATE',
    entityType: 'studentCertificate',
    entityId: docId,
    entityName: record.studentName || studentId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: record
  });
};

export const toggleGroupCertificatesVisibility = async (
  groupId: string,
  visible: boolean,
  performedBy: { uid: string; name: string; role: string }
) => {
  const ref = doc(db, 'groups', groupId);
  await updateDoc(ref, {
    certificatesVisibleToStudents: visible,
    certificatesVisibilityUpdatedAt: serverTimestamp(),
    certificatesVisibilityUpdatedByUid: performedBy.uid,
    certificatesVisibilityUpdatedByName: performedBy.name
  });

  await logActivity({
    action: 'TOGGLE_CERTIFICATES_VISIBILITY',
    entityType: 'group',
    entityId: groupId,
    entityName: groupId,
    performedByUid: performedBy.uid,
    performedByName: performedBy.name,
    performedByRole: performedBy.role,
    details: { visible }
  });
};

export const addStudentWeaknessPoint = async (
  data: {
    studentId: string;
    studentName?: string;
    groupId?: string;
    groupName?: string;
    description: string;
    notes?: string;
    sessionNumber?: number;
    visibleToStudent?: boolean;
  },
  user: { uid: string; name: string; role: string }
) => {
  if (!data.studentId || !data.description.trim()) {
    throw new Error('بيانات نقطة الضعف غير مكتملة');
  }

  const weaknessRef = doc(collection(db, 'studentWeaknesses'));
  const isVisible = data.visibleToStudent !== undefined ? data.visibleToStudent : true;

  const weaknessData: StudentWeaknessPoint = {
    id: weaknessRef.id,
    studentId: data.studentId,
    studentName: data.studentName || '',
    groupId: data.groupId || '',
    groupName: data.groupName || '',
    description: data.description.trim(),
    notes: data.notes || '',
    sessionNumber: data.sessionNumber || undefined,
    visibleToStudent: isVisible,
    resolved: false,
    createdAt: serverTimestamp(),
    createdByUid: user.uid,
    createdByName: user.name
  };

  await setDoc(weaknessRef, weaknessData);

  // Send notification to the student ONLY if visibleToStudent is true
  if (isVisible) {
    try {
      await sendNotification({
        userId: data.studentId,
        title: `🎯 تم إضافة نقطة ضعف تحتاج لتطوير`,
        message: `تم إضافة نقطة ضعف في ملفك التقييمي: "${data.description.trim()}". اضغط لمتابعة التفاصيل والعمل على معالجتها.`,
        type: 'task_review',
        link: `/student-portal?studentId=${data.studentId}`
      });
    } catch (err) {
      console.error('Failed to notify student about weakness point:', err);
    }
  }

  await logActivity({
    action: 'ADD_STUDENT_WEAKNESS',
    entityType: 'student',
    entityId: data.studentId,
    entityName: data.studentName || data.studentId,
    performedByUid: user.uid,
    performedByName: user.name,
    performedByRole: user.role,
    details: { description: data.description, groupId: data.groupId, visibleToStudent: isVisible }
  });

  return weaknessRef.id;
};

export const updateStudentWeaknessPointVisibility = async (
  weaknessId: string,
  visibleToStudent: boolean,
  user: { uid: string; name: string; role: string }
) => {
  const ref = doc(db, 'studentWeaknesses', weaknessId);
  await updateDoc(ref, { visibleToStudent });

  await logActivity({
    action: 'UPDATE_STUDENT_WEAKNESS_VISIBILITY',
    entityType: 'studentWeakness',
    entityId: weaknessId,
    performedByUid: user.uid,
    performedByName: user.name,
    performedByRole: user.role,
    details: { visibleToStudent }
  });
};

export const toggleStudentWeaknessPointResolved = async (
  weaknessId: string,
  resolved: boolean,
  user: { uid: string; name: string; role: string },
  studentId?: string,
  description?: string
) => {
  const ref = doc(db, 'studentWeaknesses', weaknessId);
  const updatePayload: any = {
    resolved,
    resolvedAt: resolved ? serverTimestamp() : null,
    resolvedByUid: resolved ? user.uid : null,
    resolvedByName: resolved ? user.name : null
  };

  await updateDoc(ref, updatePayload);

  if (studentId) {
    try {
      if (resolved) {
        await sendNotification({
          userId: studentId,
          title: `✅ تم تأكيد معالجة نقطة الضعف`,
          message: `تهانينا! أكد المدرب معالجة نقطة الضعف الخاصة بك (${description || ''}). استمر في التطور الممتاز!`,
          type: 'task_status',
          link: `/student-portal?studentId=${studentId}`
        });
      }
    } catch (err) {
      console.error('Failed to notify student about weakness point resolution:', err);
    }
  }

  await logActivity({
    action: 'TOGGLE_STUDENT_WEAKNESS_RESOLVED',
    entityType: 'studentWeakness',
    entityId: weaknessId,
    entityName: description || weaknessId,
    performedByUid: user.uid,
    performedByName: user.name,
    performedByRole: user.role,
    details: { resolved }
  });
};

export const deleteStudentWeaknessPoint = async (
  weaknessId: string,
  user: { uid: string; name: string; role: string }
) => {
  const ref = doc(db, 'studentWeaknesses', weaknessId);
  await deleteDoc(ref);

  await logActivity({
    action: 'DELETE_STUDENT_WEAKNESS',
    entityType: 'studentWeakness',
    entityId: weaknessId,
    entityName: weaknessId,
    performedByUid: user.uid,
    performedByName: user.name,
    performedByRole: user.role
  });
};

