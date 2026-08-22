import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Group, Session, LectureEvaluation, Penalty, GroupRanking, SessionMeta, AppNotification, GlobalEvalForm, GraduationProject, GraduationProjectSubmission, GraduationProjectEvaluation, GraduationProjectComment, StudentCertificateRecord } from '../types';
import { markStudentAttendanceSelf, markNotificationRead, saveGraduationProjectSubmission } from '../services/firestore';
import { 
  Award, CheckCircle, CheckCircle2, Calendar, TrendingUp, AlertTriangle, 
  FileText, BookOpen, MessageSquare, Send, Users, LogOut, 
  Lock, User as UserIcon, Copy, Sparkles, Check, Download, ExternalLink,
  Bell, BellOff, Video, Zap, ShieldCheck, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTime12h, parseTimeToMinutes, COUNTRY_CODES, parsePhoneAndDetect, normalizePhoneNumber } from '../utils';
import { sanitizeCredentials, sanitizeEmail, sanitizePhone, stripHiddenChars } from '../lib/textUtils';

import { GemyChatWidget } from '../components/GemyChatWidget';

const { collection, getDocs, getDoc, doc, query, where, addDoc, serverTimestamp, onSnapshot, updateDoc, limit } = firestore as any;

const StudentPortal: React.FC = () => {
  useEffect(() => {
    const manifestLink = document.getElementById('app-manifest') as HTMLLinkElement | null;
    const appleTitleMeta = document.getElementById('apple-title') as HTMLMetaElement | null;
    const prevManifestHref = manifestLink?.getAttribute('href') || '/manifest.json';
    const prevDocTitle = document.title;
    const prevAppleTitle = appleTitleMeta?.getAttribute('content') || 'SG Training';
    if (manifestLink) manifestLink.setAttribute('href', '/manifest-student.json');
    if (appleTitleMeta) appleTitleMeta.setAttribute('content', 'بوابة الطالب');
    document.title = 'بوابة الطالب - SABER GROUP';
    return () => {
      if (manifestLink) manifestLink.setAttribute('href', prevManifestHref);
      if (appleTitleMeta) appleTitleMeta.setAttribute('content', prevAppleTitle);
      document.title = prevDocTitle;
    };
  }, []);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // PARAMS FOR ATTENDANCE QR CODE SCAN
  const qGroupId = searchParams.get('groupId');
  const qSessionId = searchParams.get('sessionId');
  const qSessionNumber = searchParams.get('sessionNumber') ? parseInt(searchParams.get('sessionNumber')!) : null;
  const isAttendanceMode = searchParams.get('attendance') === 'true';

  // AUTH STATE
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [studentGroup, setStudentGroup] = useState<Group | null>(null);

  // MULTI-GROUP & ENROLLED COURSES STATE
  const [allStudentRecords, setAllStudentRecords] = useState<Student[]>([]);
  const [enrolledGroups, setEnrolledGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  
  // DATA STATES FOR LOGGED-IN DASHBOARD
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<LectureEvaluation[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [rankings, setRankings] = useState<GroupRanking[]>([]);
  const [sessionMetas, setSessionMetas] = useState<SessionMeta[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const prevNotifIdsRef = useRef<string[]>([]);
  const isInitialNotifLoadRef = useRef<boolean>(true);

  // GRADUATION PROJECT STATES
  const [graduationProject, setGraduationProject] = useState<GraduationProject | null>(null);
  const [graduationSubmission, setGraduationSubmission] = useState<GraduationProjectSubmission | null>(null);
  const [graduationEvaluation, setGraduationEvaluation] = useState<GraduationProjectEvaluation | null>(null);
  const [graduationComments, setGraduationComments] = useState<GraduationProjectComment[]>([]);

  // STUDENT SUBMISSION MODAL
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [submissionDriveLink, setSubmissionDriveLink] = useState('');
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkEditable, setCheckEditable] = useState(false);
  const [checkRules, setCheckRules] = useState(false);
  const [submissionExtraLinks, setSubmissionExtraLinks] = useState<{ title: string; url: string }[]>([]);
  const [unsubmittedReasonText, setUnsubmittedReasonText] = useState('');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [submissionSuccessMsg, setSubmissionSuccessMsg] = useState<string | null>(null);

  // DETAILS & EVALUATION VIEW MODALS FOR STUDENT
  const [isProjectDetailsModalOpen, setIsProjectDetailsModalOpen] = useState(false);
  const [isProjectEvalViewModalOpen, setIsProjectEvalViewModalOpen] = useState(false);
  
  // COMPONENT LOADING/ERROR
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState <string | null>(null);

  // LOGIN FORM
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ATTENDANCE WORKFLOW (WHEN SCANNING QR UNAUTHENTICATED)
  const [groupStudents, setGroupStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attendingSessionNum, setAttendingSessionNum] = useState<number | null>(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [wasAlreadyRegistered, setWasAlreadyRegistered] = useState(false);
  const [isCheckingQr, setIsCheckingQr] = useState(false);
  const [qrCheckError, setQrCheckError] = useState<string | null>(null);

  // AUTOMATIC ATTENDANCE TRIGGER ON JOINING LECTURES/MEETINGS
  const [joinAttendanceAlert, setJoinAttendanceAlert] = useState<{
    isOpen: boolean;
    status: 'recording' | 'success' | 'already' | 'error';
    sessionNumber: number;
    message: string;
  } | null>(null);

  // EVALUATION WORKFLOW DEFINITIONS & STATES
  const isFeedbackMode = searchParams.get('feedback') === 'true';
  const [evaluatingGroup, setEvaluatingGroup] = useState<Group | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  
  // Rating values
  const [ratingGeneral, setRatingGeneral] = useState(5);
  const [ratingCourse, setRatingCourse] = useState(5);
  const [ratingContent, setRatingContent] = useState(5);
  const [ratingTrainerExplanation, setRatingTrainerExplanation] = useState(5);
  const [ratingTrainer, setRatingTrainer] = useState(5);
  const [trainerNotes, setTrainerNotes] = useState('');
  
  // Other trainer evaluation
  const [hasOtherTrainer, setHasOtherTrainer] = useState(false);
  const [otherTrainerName, setOtherTrainerName] = useState('');
  const [otherTrainerRating, setOtherTrainerRating] = useState(5);
  const [otherTrainerNotes, setOtherTrainerNotes] = useState('');

  // Sales agent evaluation
  const [salesAgentName, setSalesAgentName] = useState('');
  const [ratingSales, setRatingSales] = useState(5);
  const [salesNotes, setSalesNotes] = useState('');

  // Academy evaluation
  const [ratingAcademy, setRatingAcademy] = useState(5);
  const [ratingPracticeUseful, setRatingPracticeUseful] = useState(5);
  const [ratingContentSuitable, setRatingContentSuitable] = useState(5);
  const [ratingSupportService, setRatingSupportService] = useState(5);
  const [comments, setComments] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Inline login for feedback
  const [evalStudentId, setEvalStudentId] = useState('');
  const [evalPassword, setEvalPassword] = useState('');
  const [evalLoginError, setEvalLoginError] = useState('');
  const [evalLoginLoading, setEvalLoginLoading] = useState(false);
  
  // Complaint state
  const [hasComplaint, setHasComplaint] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [onlineIssueText, setOnlineIssueText] = useState('');
  const [offlineVenueFeedback, setOfflineVenueFeedback] = useState('');
  const [wantsCall, setWantsCall] = useState(false);

  // Student selection if unauthenticated
  const [customStudentName, setCustomStudentName] = useState('مجهول الهوية (متدرب)');
  const [customStudentId, setCustomStudentId] = useState('anonymous');

  // Global Evaluation Form State
  const [activeGlobalForms, setActiveGlobalForms] = useState<GlobalEvalForm[]>([]);
  const [selectedGlobalForm, setSelectedGlobalForm] = useState<GlobalEvalForm | null>(null);

  useEffect(() => {
    const fetchGlobalForms = async () => {
      try {
        const qForms = query(collection(db, 'global_eval_forms'), where('isActive', '==', true));
        const snap = await getDocs(qForms);
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as GlobalEvalForm));
        setActiveGlobalForms(list);

        const urlGlobalEvalId = searchParams.get('globalEvalId');
        if (urlGlobalEvalId) {
          const matched = list.find(f => f.id === urlGlobalEvalId);
          if (matched) {
            setSelectedGlobalForm(matched);
          }
        }
      } catch (err) {
        console.error("Error fetching active global forms:", err);
      }
    };
    fetchGlobalForms();
  }, [searchParams]);

  // PROFILE EDIT STATES
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState('+20');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [whatsappCountry, setWhatsappCountry] = useState('+20');
  const [whatsappLocal, setWhatsappLocal] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [showHistoryInModal, setShowHistoryInModal] = useState(false);

  // Certificate State
  const [studentCertificateRecord, setStudentCertificateRecord] = useState<StudentCertificateRecord | null>(null);
  const [allGroupGradProjects, setAllGroupGradProjects] = useState<GraduationProject[]>([]);
  const [allStudentGradSubmissions, setAllStudentGradSubmissions] = useState<GraduationProjectSubmission[]>([]);

  // Initialize fields when modal opens or currentStudent changes
  useEffect(() => {
    if (currentStudent) {
      const parsedPhone = parsePhoneAndDetect(currentStudent.phone || '');
      setPhoneCountry(parsedPhone.countryCode);
      setPhoneLocal(parsedPhone.localNumber);

      const parsedWhatsapp = parsePhoneAndDetect(currentStudent.whatsappLink || '');
      setWhatsappCountry(parsedWhatsapp.countryCode);
      setWhatsappLocal(parsedWhatsapp.localNumber);

      setProfileEmail(currentStudent.email || '');
    }
  }, [currentStudent, isProfileModalOpen]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleaned = val.trim().replace(/[\s\-\(\)\.]/g, '');
    
    const startsWithPlus = cleaned.startsWith('+');
    const startsWithDoubleZero = cleaned.startsWith('00');
    const startsWithCode = COUNTRY_CODES.some(c => {
      const codeDigits = c.code.substring(1);
      return cleaned.startsWith(codeDigits) && cleaned.length >= (codeDigits.length + 7);
    });
    
    if (startsWithPlus || startsWithDoubleZero || startsWithCode) {
      const parsed = parsePhoneAndDetect(val);
      setPhoneCountry(parsed.countryCode);
      setPhoneLocal(parsed.localNumber);
    } else {
      setPhoneLocal(val);
    }
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleaned = val.trim().replace(/[\s\-\(\)\.]/g, '');
    
    const startsWithPlus = cleaned.startsWith('+');
    const startsWithDoubleZero = cleaned.startsWith('00');
    const startsWithCode = COUNTRY_CODES.some(c => {
      const codeDigits = c.code.substring(1);
      return cleaned.startsWith(codeDigits) && cleaned.length >= (codeDigits.length + 7);
    });
    
    if (startsWithPlus || startsWithDoubleZero || startsWithCode) {
      const parsed = parsePhoneAndDetect(val);
      setWhatsappCountry(parsed.countryCode);
      setWhatsappLocal(parsed.localNumber);
    } else {
      setWhatsappLocal(val);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setProfileSaveLoading(true);
    setProfileSaveSuccess(false);

    try {
      const nowStr = new Date().toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });

      const fieldChanges: Array<{ field: string; fieldNameAr: string; oldValue: string; newValue: string; editedAt: string }> = [];
      const updatedFieldsRecord = { ...(currentStudent.profileEditedFields || {}) };

      const checkChange = (fieldKey: string, fieldNameAr: string, oldVal: string, newVal: string) => {
        const trimmedOld = (oldVal || '').trim();
        const trimmedNew = (newVal || '').trim();
        if (trimmedOld !== trimmedNew) {
          fieldChanges.push({
            field: fieldKey,
            fieldNameAr,
            oldValue: trimmedOld,
            newValue: trimmedNew,
            editedAt: nowStr
          });
          updatedFieldsRecord[fieldKey] = {
            editedAt: nowStr,
            previousValue: trimmedOld,
            newValue: trimmedNew
          };
        }
      };

      const finalPhone = `${phoneCountry}${phoneLocal}`.trim();
      const finalWhatsapp = whatsappLocal ? `${whatsappCountry}${whatsappLocal}`.trim() : '';
      const cleanEmail = profileEmail.trim().toLowerCase();

      // Enforce Gmail validation
      if (cleanEmail && !cleanEmail.endsWith('@gmail.com')) {
        alert("عذراً! يجب استخدام بريد إلكتروني ينتهي بـ @gmail.com فقط (حساب Gmail)، وذلك لأن جميع المحاضرات والربط مع Google Meet وتسجيلات الحضور تعتمد حصرياً على الجيميل.");
        setProfileSaveLoading(false);
        return;
      }

      checkChange('phone', 'رقم الهاتف/الموبايل', currentStudent.phone, finalPhone);
      checkChange('whatsappLink', 'رقم الواتساب (WhatsApp)', currentStudent.whatsappLink || '', finalWhatsapp);
      checkChange('email', 'البريد الإلكتروني (Gmail)', currentStudent.email || '', cleanEmail);

      if (fieldChanges.length === 0) {
        setIsProfileModalOpen(false);
        setProfileSaveLoading(false);
        return;
      }

      const existingHistory = currentStudent.profileEditHistory || [];
      const newHistory = [...fieldChanges, ...existingHistory]; // newest first

      // Prepare payload to update Student doc
      const payload: any = {
        phone: finalPhone,
        whatsappLink: finalWhatsapp,
        email: profileEmail.trim(),
        profileEditedFields: updatedFieldsRecord,
        profileEditHistory: newHistory
      };

      const studentDocRef = doc(db, 'students', currentStudent.id);
      await updateDoc(studentDocRef, payload);

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'STUDENT_SELF_PROFILE_UPDATE',
        entityType: 'student',
        entityId: currentStudent.id,
        entityName: currentStudent.name,
        performedByUid: currentStudent.id,
        performedByName: currentStudent.name,
        performedByRole: 'student',
        timestamp: serverTimestamp(),
        details: `قام الطالب بتعديل بياناته الشخصية: ${fieldChanges.map(c => c.fieldNameAr).join(', ')}`
      });

      // Update local state and local storage
      const updatedStudent = {
        ...currentStudent,
        ...payload
      };
      setCurrentStudent(updatedStudent);
      localStorage.setItem('studentSession', JSON.stringify(updatedStudent));

      setProfileSaveSuccess(true);
      setTimeout(() => {
        setProfileSaveSuccess(false);
        setIsProfileModalOpen(false);
      }, 1500);

    } catch (err: any) {
      console.error("Error saving profile changes:", err);
      alert("حدث خطأ أثناء حفظ التعديلات: " + err.message);
    } finally {
      setProfileSaveLoading(false);
    }
  };

  // HELPER TO LOAD STUDENT SESSION, ENROLLED GROUPS & AUTOMATICALLY UNIFY CREDENTIALS
  const loadStudentSessionAndGroups = async (
    primaryStudent: Student, 
    preferredGroupId?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const normP = normalizePhoneNumber(primaryStudent.phone);
      const normE = (primaryStudent.email || primaryStudent.attendanceEmail || '').trim().toLowerCase();
      const sIdNum = (primaryStudent.studentIdNum || '').trim();

      const allStudsSnap = await getDocs(collection(db, 'students'));
      const matchedRecords: Student[] = [];
      const matchedIds = new Set<string>();

      allStudsSnap.docs.forEach((d: any) => {
        const s = { id: d.id, ...d.data() } as Student;
        if (matchedIds.has(s.id)) return;

        const curIdNum = (s.studentIdNum || '').trim();
        const curE = (s.email || s.attendanceEmail || '').trim().toLowerCase();
        const curP = normalizePhoneNumber(s.phone);

        const matchId = sIdNum && curIdNum === sIdNum;
        const matchEmail = normE && curE === normE;
        const matchPhone = normP && curP && (curP === normP || curP.endsWith(normP) || normP.endsWith(curP));

        if (matchId || matchEmail || matchPhone) {
          matchedRecords.push(s);
          matchedIds.add(s.id);
        }
      });

      const studentRecords = matchedRecords.length > 0 ? matchedRecords : [primaryStudent];
      setAllStudentRecords(studentRecords);

      // Unify credentials & record portal login acknowledgment across all records for this student
      const unifiedId = primaryStudent.studentIdNum || studentRecords.find(r => r.studentIdNum)?.studentIdNum || Math.floor(100000 + Math.random() * 900000).toString();
      const unifiedPass = primaryStudent.studentPassword || studentRecords.find(r => r.studentPassword)?.studentPassword || Math.floor(10000 + Math.random() * 90000).toString();
      const currentLoginTime = new Date().toISOString();

      studentRecords.forEach(rec => {
        const needsCredSync = rec.studentIdNum !== unifiedId || rec.studentPassword !== unifiedPass;
        const updates: any = {
          hasLoggedIn: true,
          lastLoginAt: currentLoginTime,
          loginCount: (rec.loginCount || 0) + 1
        };

        if (!rec.firstLoginAt) {
          updates.firstLoginAt = currentLoginTime;
          rec.firstLoginAt = currentLoginTime;
        }

        if (needsCredSync) {
          rec.studentIdNum = unifiedId;
          rec.studentPassword = unifiedPass;
          updates.studentIdNum = unifiedId;
          updates.studentPassword = unifiedPass;
        }

        rec.hasLoggedIn = true;
        rec.lastLoginAt = currentLoginTime;
        rec.loginCount = (rec.loginCount || 0) + 1;

        updateDoc(doc(db, 'students', rec.id), updates).catch(e => console.error("Error updating student doc with login stats:", e));
      });

      // Fetch all Group documents corresponding to these student records
      const groupIds = Array.from(new Set(studentRecords.map(r => r.groupId).filter(Boolean)));
      const fetchedGroups: Group[] = [];

      for (const gid of groupIds) {
        try {
          const gSnap = await getDoc(doc(db, 'groups', gid));
          if (gSnap.exists()) {
            fetchedGroups.push({ id: gSnap.id, ...gSnap.data() } as Group);
          }
        } catch (e) {
          console.error("Error fetching group:", e);
        }
      }

      setEnrolledGroups(fetchedGroups);

      // Separate active vs archived groups
      const activeG = fetchedGroups.filter(g => !g.archived && !(g as any).isArchived && (g as any).status !== 'archived');
      const archivedG = fetchedGroups.filter(g => g.archived || (g as any).isArchived || (g as any).status === 'archived');

      // Determine target group ID
      let targetGId = preferredGroupId || qGroupId || '';

      if (!targetGId || !fetchedGroups.some(g => g.id === targetGId)) {
        if (activeG.length > 0) {
          targetGId = activeG[0].id;
        } else if (archivedG.length > 0) {
          targetGId = archivedG[0].id;
        } else if (studentRecords.length > 0) {
          targetGId = studentRecords[0].groupId;
        }
      }

      setSelectedGroupId(targetGId);

      const targetStudent = studentRecords.find(r => r.groupId === targetGId) || studentRecords[0];
      setCurrentStudent(targetStudent);
      localStorage.setItem('studentSession', JSON.stringify(targetStudent));

      await loadStudentData(targetStudent, targetGId);

    } catch (err: any) {
      console.error("Error loading full student profile:", err);
      setError('حدث خطأ أثناء تحميل بيانات حساب الطالب والمجموعات.');
    } finally {
      setLoading(false);
    }
  };

  // SWITCH ACTIVE GROUP
  const handleSwitchGroup = async (groupId: string) => {
    if (groupId === selectedGroupId && studentGroup?.id === groupId) return;

    const targetRecord = allStudentRecords.find(r => r.groupId === groupId);
    if (!targetRecord) return;

    setSelectedGroupId(groupId);
    setCurrentStudent(targetRecord);
    localStorage.setItem('studentSession', JSON.stringify(targetRecord));

    await loadStudentData(targetRecord, groupId);
  };

  // 1. LOAD STUDENT SESSION ON MOUNT
  useEffect(() => {
    const qLoginId = searchParams.get('loginId') || searchParams.get('id');
    const qPassword = searchParams.get('password') || searchParams.get('pass');
    const qAutoLogin = searchParams.get('autoLogin') === '1' || searchParams.get('testLogin') === '1';

    if (qLoginId) {
      setLoginId(qLoginId);
      if (qPassword) {
        setLoginPassword(qPassword);
      }
    }

    const raw = localStorage.getItem('studentSession');
    if (raw && !qAutoLogin) {
      try {
        const student = JSON.parse(raw) as Student;
        loadStudentSessionAndGroups(student);
      } catch (e) {
        localStorage.removeItem('studentSession');
        setLoading(false);
      }
    } else if (qAutoLogin && qLoginId && qPassword) {
      // Auto authenticate user from query credentials
      const performAutoLogin = async () => {
        setLoading(true);
        try {
          const cleanInput = sanitizeCredentials(qLoginId);
          const cleanPassword = sanitizeCredentials(qPassword);
          const allSnap = await getDocs(collection(db, 'students'));
          const matching = allSnap.docs
            .map((d: any) => ({ id: d.id, ...d.data() } as Student))
            .find((s: Student) => 
              sanitizeCredentials(s.studentIdNum)?.toLowerCase() === cleanInput.toLowerCase() &&
              sanitizeCredentials(s.studentPassword) === cleanPassword
            );

          if (matching) {
            await loadStudentSessionAndGroups(matching, qGroupId || undefined);
          } else {
            setLoading(false);
          }
        } catch (e) {
          console.error("Auto test account login error:", e);
          setLoading(false);
        }
      };
      performAutoLogin();
    } else {
      setLoading(false);
    }
  }, []);

  // Real-time subscription to sessions
  useEffect(() => {
    if (!currentStudent?.groupId) return;

    const qSessions = query(collection(db, 'sessions'), where('groupId', '==', currentStudent.groupId));
    const unsubscribe = onSnapshot(qSessions, (snapshot: any) => {
      const sList = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Session))
        .sort((a, b) => a.sessionNumber - b.sessionNumber);
      setSessions(sList);
    }, (err: any) => {
      console.error("Error subscribing to group sessions in real-time:", err);
    });

    return () => unsubscribe();
  }, [currentStudent?.groupId]);

  // Real-time subscription to Graduation Project for the student's group
  useEffect(() => {
    if (!currentStudent?.groupId) return;

    const qProj = query(collection(db, 'graduationProjects'), where('groupId', '==', currentStudent.groupId));
    const unsubProj = onSnapshot(qProj, (snapshot: any) => {
      const pList = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as GraduationProject));
      setGraduationProject(pList[0] || null);
      setAllGroupGradProjects(pList);
    }, (err: any) => {
      console.error("Error subscribing to graduation project:", err);
    });

    return () => unsubProj();
  }, [currentStudent?.groupId]);

  // Real-time subscription to group document to keep certificatesVisibleToStudents updated
  useEffect(() => {
    if (!studentGroup?.id) return;
    const unsubG = onSnapshot(doc(db, 'groups', studentGroup.id), (snap: any) => {
      if (snap.exists()) {
        setStudentGroup({ id: snap.id, ...snap.data() } as Group);
      }
    });
    return () => unsubG();
  }, [studentGroup?.id]);

  // Real-time subscription to Student's Certificate Record
  useEffect(() => {
    if (!currentStudent?.id || !currentStudent?.groupId) return;
    const docId = `${currentStudent.groupId}_${currentStudent.id}`;
    const unsubCert = onSnapshot(doc(db, 'studentCertificates', docId), (docSnap: any) => {
      if (docSnap.exists()) {
        setStudentCertificateRecord({ id: docSnap.id, ...docSnap.data() } as StudentCertificateRecord);
      } else {
        setStudentCertificateRecord(null);
      }
    });
    return () => unsubCert();
  }, [currentStudent?.id, currentStudent?.groupId]);

  // Real-time subscription to all student submissions for metrics calculation
  useEffect(() => {
    if (!currentStudent?.id || !currentStudent?.groupId) return;
    const qSubs = query(collection(db, 'graduationSubmissions'), where('groupId', '==', currentStudent.groupId), where('studentId', '==', currentStudent.id));
    const unsubSubs = onSnapshot(qSubs, (snap: any) => {
      setAllStudentGradSubmissions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as GraduationProjectSubmission)));
    });
    return () => unsubSubs();
  }, [currentStudent?.id, currentStudent?.groupId]);

  // Real-time subscription to Student's submission, evaluation, and comments for the project
  useEffect(() => {
    if (!currentStudent?.id || !graduationProject?.id) {
      setGraduationSubmission(null);
      setGraduationEvaluation(null);
      setGraduationComments([]);
      return;
    }

    const qSub = query(
      collection(db, 'graduationSubmissions'),
      where('projectId', '==', graduationProject.id),
      where('studentId', '==', currentStudent.id)
    );
    const unsubSub = onSnapshot(qSub, (snapshot: any) => {
      const sList = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as GraduationProjectSubmission));
      const mySub = sList[0] || null;
      setGraduationSubmission(mySub);
      if (mySub) {
        setSubmissionDriveLink(mySub.driveLink || '');
        setCheckOpen(!!mySub.checkConfirmedOpen);
        setCheckEditable(!!mySub.checkUploadedEditableFiles);
        setCheckRules(!!mySub.checkReadRules);
        setSubmissionExtraLinks(mySub.extraLinks || []);
        setUnsubmittedReasonText(mySub.unsubmittedReason || '');
      }
    });

    const qEval = query(
      collection(db, 'graduationEvaluations'),
      where('projectId', '==', graduationProject.id),
      where('studentId', '==', currentStudent.id)
    );
    const unsubEval = onSnapshot(qEval, (snapshot: any) => {
      const eList = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as GraduationProjectEvaluation));
      setGraduationEvaluation(eList[0] || null);
    });

    const qCom = query(
      collection(db, 'graduationComments'),
      where('projectId', '==', graduationProject.id),
      where('studentId', '==', currentStudent.id)
    );
    const unsubCom = onSnapshot(qCom, (snapshot: any) => {
      const cList = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as GraduationProjectComment));
      cList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setGraduationComments(cList);
    });

    return () => {
      unsubSub();
      unsubEval();
      unsubCom();
    };
  }, [currentStudent?.id, graduationProject?.id]);

  // Handle Muted local storage preference initialization
  useEffect(() => {
    if (currentStudent?.id) {
      const val = localStorage.getItem(`muted_student_${currentStudent.id}`) === 'true';
      setIsMuted(val);
    }
  }, [currentStudent]);

  // Real-time notifications subscription
  useEffect(() => {
    if (!currentStudent?.id) return;

    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', currentStudent.id),
      limit(20)
    );

    const unsubscribe = onSnapshot(qNotifs, (snapshot: any) => {
      const list = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as AppNotification));
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      const currentIds = list.map(n => n.id);
      if (isInitialNotifLoadRef.current) {
        prevNotifIdsRef.current = currentIds;
        isInitialNotifLoadRef.current = false;
      } else {
        const unread = list.filter(n => !n.read);
        const newlyAdded = unread.find(n => !prevNotifIdsRef.current.includes(n.id));
        if (newlyAdded && !isMuted) {
          setActiveToast(newlyAdded);

          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
          } catch (e) {
            console.log("Audio notification sound blocked or not supported:", e);
          }

          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newlyAdded.title, {
                body: newlyAdded.message,
                icon: '/favicon.ico'
              });
            }
          } catch (e) {
            console.error("Browser notification failed:", e);
          }

          setTimeout(() => {
            setActiveToast(current => current?.id === newlyAdded.id ? null : current);
          }, 8000);
        }
        prevNotifIdsRef.current = currentIds;
      }

      setNotifications(list);
    }, (err: any) => {
      console.error("Error subscribing to student notifications:", err);
    });

    return () => unsubscribe();
  }, [currentStudent?.id, isMuted]);

  // 2. LOAD ALL DATA PERTAINING TO LOGGED IN STUDENT / GROUP
  const loadStudentData = async (student: Student, overrideGroupId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeGId = overrideGroupId || student.groupId;

      const studentDocRef = doc(db, 'students', student.id);
      const studentSnap = await getDoc(studentDocRef);
      let activeStudent = student;
      if (studentSnap.exists()) {
        activeStudent = { id: studentSnap.id, ...studentSnap.data() } as Student;
        setCurrentStudent(activeStudent);
        localStorage.setItem('studentSession', JSON.stringify(activeStudent));
      }

      if (activeGId) {
        const groupSnap = await getDoc(doc(db, 'groups', activeGId));
        if (groupSnap.exists()) {
          const g = { id: groupSnap.id, ...groupSnap.data() } as Group;
          setStudentGroup(g);
        }
      }

      const qEvals = query(collection(db, 'lectureEvaluations'), where('studentId', '==', activeStudent.id));
      const evSnap = await getDocs(qEvals);
      const rawEvals = evSnap.docs.map((d: any) => d.data() as LectureEvaluation);
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
          uniqueEvalsMap.set(ev.sessionNumber, merged);
        }
      }
      setEvaluations(Array.from(uniqueEvalsMap.values()));

      const qPen = query(collection(db, 'penalties'), where('studentId', '==', activeStudent.id));
      const penSnap = await getDocs(qPen);
      setPenalties(penSnap.docs.map((d: any) => d.data() as Penalty));

      const qRanks = query(collection(db, 'groupRankings'), where('groupId', '==', activeGId));
      const rankSnap = await getDocs(qRanks);
      setRankings(rankSnap.docs.map((d: any) => d.data() as GroupRanking));

      const qMetas = query(collection(db, 'sessionMeta'), where('groupId', '==', activeGId));
      const metaSnap = await getDocs(qMetas);
      setSessionMetas(metaSnap.docs.map((d: any) => d.data() as SessionMeta));

    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ في تحميل البيانات الأكاديمية الخاصة بك.');
    } finally {
      setLoading(false);
    }
  };

  // 3. LOAD GROUP STUDENTS IF IN QR SCAN OR EVALUATION AND MODE REQUIRES SELECTION
  useEffect(() => {
    if ((isAttendanceMode || isFeedbackMode) && qGroupId) {
      const fetchGroupDetailsForAttendance = async () => {
        try {
          const qStuds = query(collection(db, 'students'), where('groupId', '==', qGroupId));
          const snap = await getDocs(qStuds);
          setGroupStudents(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student)));
        } catch (error) {
          console.error(error);
        }
      };
      fetchGroupDetailsForAttendance();
    }
  }, [isAttendanceMode, isFeedbackMode, qGroupId]);

  // LOAD GROUP INFO FOR FEEDBACK META
  useEffect(() => {
    if (isFeedbackMode && qGroupId) {
      const fetchFeedbackGroup = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'groups', qGroupId));
          if (docSnap.exists()) {
            setEvaluatingGroup({ id: docSnap.id, ...docSnap.data() } as Group);
          }
        } catch (error) {
          console.error("Error loading group info for feedback:", error);
        }
      };
      fetchFeedbackGroup();
    }
  }, [isFeedbackMode, qGroupId]);

  // Validate dynamic QR code expiration & token
  useEffect(() => {
    if (isAttendanceMode && qSessionId) {
      const validateAttendanceQr = async () => {
        setIsCheckingQr(true);
        setQrCheckError(null);
        try {
          const sessionDocSnap = await getDoc(doc(db, 'sessions', qSessionId));
          if (!sessionDocSnap.exists()) {
            setQrCheckError('عذراً، لم يتم العثور على بيانات هذه المحاضرة.');
            return;
          }
          const sessionData = sessionDocSnap.data();
          
          const attendCode = sessionData.attendanceCode || '';
          const attendExpiresAt = sessionData.attendanceExpiresAt || '';
          
          if (attendCode) {
            const urlToken = searchParams.get('qrToken') || '';
            if (urlToken !== attendCode) {
              setQrCheckError('هذا الكود غير صالح أو تم تحديثه من قبل المدرب بكود جديد.');
              return;
            }
          } else {
            setQrCheckError('لم يتم تفعيل كود الحضور لهذه المحاضرة بعد من قبل المدرب.');
            return;
          }

          if (attendExpiresAt) {
            const expMs = new Date(attendExpiresAt).getTime();
            if (Date.now() > expMs) {
              setQrCheckError('انتهى وقت تسجيل الحضور لهذه المحاضرة (صلاحية الكود 15 دقيقة بشكل افتراضي وانتهت).');
              return;
            }
          }
        } catch (err: any) {
          console.error("Error validating QR code:", err);
          setQrCheckError('حدث خطأ أثناء التحقق من صلاحية كود الحضور.');
        } finally {
          setIsCheckingQr(false);
        }
      };
      validateAttendanceQr();
    }
  }, [isAttendanceMode, qSessionId, searchParams]);

  // 4. AUTOMATIC ATTENDANCE CHECK-IN IF USER IS ALREADY LOGGED IN
  useEffect(() => {
    if (isAttendanceMode && currentStudent && qGroupId && qSessionId && qSessionNumber && !qrCheckError && !isCheckingQr && !attendanceSuccess) {
      const groupRecord = allStudentRecords.find(r => r.groupId === qGroupId) || (currentStudent.groupId === qGroupId ? currentStudent : null);
      if (groupRecord) {
        if (currentStudent.groupId !== qGroupId) {
          handleSwitchGroup(qGroupId);
        }
        triggerSelfCheckin(groupRecord.id, groupRecord.name);
      } else {
        setError(`عذراً، كود الحضور مخصص لمجموعة أخرى غير المسجل عليها حسابك الحالي.`);
      }
    }
  }, [isAttendanceMode, currentStudent, qGroupId, qSessionId, qSessionNumber, qrCheckError, isCheckingQr, allStudentRecords, attendanceSuccess]);

  // TRIGGER THE ACTUAL SELF CHECK IN DATABASE ACTION
  const triggerSelfCheckin = async (studentId: string, studentName: string) => {
    if (!qGroupId || !qSessionId || !qSessionNumber) return;
    setLoading(true);
    try {
      const res = await markStudentAttendanceSelf(qGroupId, studentId, qSessionNumber, qSessionId);
      setAttendingSessionNum(qSessionNumber);
      setWasAlreadyRegistered(!!(res && (res as any).alreadyRegistered));
      setAttendanceSuccess(true);
      
      if (currentStudent && currentStudent.id === studentId) {
        await loadStudentData(currentStudent, qGroupId);
      }
    } catch (err: any) {
      console.error(err);
      setError('عذراً، حدث خطأ أثناء محاولة تسجيل حضورك تلقائياً.');
    } finally {
      setLoading(false);
    }
  };

  // 5. MANUAL STUDENT LOGIN (BY STUDENT ID, PHONE, OR EMAIL)
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPassword) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const cleanInput = sanitizeCredentials(loginId);
      const cleanInputLower = sanitizeEmail(loginId) || cleanInput.toLowerCase();
      const normInputPhone = normalizePhoneNumber(cleanInput) || sanitizePhone(cleanInput);
      const cleanPassword = sanitizeCredentials(loginPassword);

      const allSnap = await getDocs(collection(db, 'students'));
      const matchingDocs: Student[] = [];

      allSnap.docs.forEach((docSnap: any) => {
        const s = { id: docSnap.id, ...docSnap.data() } as Student;
        const sIdNum = sanitizeCredentials(s.studentIdNum);
        const sEmail = sanitizeEmail(s.email || s.attendanceEmail);
        const sPhoneNorm = normalizePhoneNumber(s.phone) || sanitizePhone(s.phone);

        const matchId = sIdNum && sIdNum.toLowerCase() === cleanInput.toLowerCase();
        const matchEmail = sEmail && sEmail === cleanInputLower;
        const matchPhone = normInputPhone && sPhoneNorm && (sPhoneNorm === normInputPhone || sPhoneNorm.endsWith(normInputPhone) || normInputPhone.endsWith(sPhoneNorm));

        if (matchId || matchEmail || matchPhone) {
          matchingDocs.push(s);
        }
      });

      if (matchingDocs.length === 0) {
        if (cleanInput.includes('@')) {
          throw new Error('تنبيه: لقد قمت بكتابة بريد إلكتروني! تسجيل الدخول في البورتال يتطلب كتابة الرقم التعريفي (Student ID المكون من 6 أرقام) المستلم في إيميل الترحيب وليس الإيميل.');
        }
        throw new Error('الرقم التعريفي (Student ID) أو رقم الموبايل غير مطابق لأي طالب مسجل. يرجى التأكد من كتابة كود الـ ID الخاص بك.');
      }

      const validStudent = matchingDocs.find(s => sanitizeCredentials(s.studentPassword) === cleanPassword);
      if (!validStudent) {
        throw new Error('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      }

      // Validated! Load full profile & enrolled groups
      await loadStudentSessionAndGroups(validStudent, qGroupId || undefined);

      // Handle QR Code Attendance checkin
      if (isAttendanceMode && qGroupId && qSessionId && qSessionNumber) {
        const recordForGroup = matchingDocs.find(s => s.groupId === qGroupId);
        if (recordForGroup) {
          await triggerSelfCheckin(recordForGroup.id, recordForGroup.name);
        } else {
          setLoginError(`تم تسجيل دخولك بنجاح، ولكنك غير مسجل في هذه المجموعة (${qGroupId}).`);
        }
      }

    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // 6. LOG OUT STUDENT SESSION
  const handleLogout = () => {
    localStorage.removeItem('studentSession');
    setCurrentStudent(null);
    setStudentGroup(null);
    setAllStudentRecords([]);
    setEnrolledGroups([]);
    setSelectedGroupId('');
    setSessions([]);
    setEvaluations([]);
    setPenalties([]);
    setRankings([]);
    setSessionMetas([]);
    setAttendanceSuccess(false);
    navigate('/student/portal');
  };

  // SUBMIT LECTURE EVALUATION HANDLER
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGroupId = qGroupId || evaluatingGroup?.id || currentStudent?.groupId || '';
    
    if (!activeGroupId) {
      alert("الرابط غير صحيح أو ناقص بيانات التقييم والمجموعة.");
      return;
    }
    
    setLoading(true);
    try {
      const finalStudentId = isAnonymous ? 'anonymous' : (currentStudent ? currentStudent.id : customStudentId);
      const finalStudentName = isAnonymous ? 'مجهول الهوية' : (currentStudent ? currentStudent.name : customStudentName);
      
      const feedbackPayload = {
        groupId: activeGroupId,
        groupName: evaluatingGroup?.name || currentStudent?.groupId || "Unknown Group",
        courseName: evaluatingGroup?.courseName || "Unknown Course",
        groupType: evaluatingGroup?.groupType || "Online",
        sessionNumber: qSessionNumber || 0,
        date: new Date().toLocaleDateString('ar-EG'),
        trainerName: evaluatingGroup?.trainerName || "Unknown Trainer",
        studentId: finalStudentId,
        studentName: finalStudentName,
        isAnonymous,
        
        globalEvalId: selectedGlobalForm?.id || searchParams.get('globalEvalId') || '',
        globalEvalTitle: selectedGlobalForm?.title || '',
        isMonthlyGlobal: !!(selectedGlobalForm || searchParams.get('globalEvalId')),

        ratingCourse,
        ratingContent,
        ratingGeneral: ratingCourse,
        
        primaryTrainerName: evaluatingGroup?.trainerName || "المدرب الرئيسي",
        trainerId: evaluatingGroup?.trainerIds?.[0] || '',
        ratingTrainer,
        ratingTrainerExplanation: ratingTrainer,
        trainerNotes,
        
        otherTrainerName: hasOtherTrainer ? otherTrainerName : '',
        otherTrainerRating: hasOtherTrainer ? otherTrainerRating : 0,
        otherTrainerNotes: hasOtherTrainer ? otherTrainerNotes : '',
        
        salesAgentName,
        ratingSales,
        salesNotes,
        
        ratingAcademy,
        ratingSupportService: ratingAcademy,
        ratingPracticeUseful,
        ratingContentSuitable: ratingContent,
        
        comments,
        hasComplaint,
        complaintText: hasComplaint ? complaintText : '',
        onlineIssueText: hasComplaint ? onlineIssueText : '',
        offlineVenueFeedback: hasComplaint ? offlineVenueFeedback : '',
        wantsCall: hasComplaint ? wantsCall : false,
        complaintStatus: hasComplaint ? 'new' : 'N/A',
        complaintFollowUpNote: ''
      };
      
      await addDoc(collection(db, 'feedback'), {
        ...feedbackPayload,
        createdAt: serverTimestamp()
      });
      
      setFeedbackSuccess(true);
    } catch (err: any) {
      console.error("Failed to submit feedback:", err);
      alert("حدث خطأ أثناء إرسال التقييم: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER FOR INLINE EVALUATION LOGIN
  const handleEvalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvalLoginError('');
    if (!evalStudentId.trim() || !evalPassword.trim()) {
      setEvalLoginError('يرجى إدخال الرقم التعريفي وكلمة المرور كامليْن.');
      return;
    }
    setEvalLoginLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('studentId', '==', evalStudentId.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('الرقم التعريفي (Student ID) غير مطابق لأي طالب مسجل.');
      }
      const foundDoc = snap.docs[0];
      const student = { id: foundDoc.id, ...foundDoc.data() } as Student;
      if (student.studentPassword !== evalPassword.trim()) {
        throw new Error('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      }
      localStorage.setItem('studentSession', JSON.stringify(student));
      setCurrentStudent(student);
      setCustomStudentId(student.id);
      setCustomStudentName(student.name);
    } catch (err: any) {
      setEvalLoginError(err.message);
    } finally {
      setEvalLoginLoading(false);
    }
  };

  // COPY HELPER
  const handleCopyLink = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // 7. ARITHMETHICS FOR PORTAL METRICS
  const metrics = useMemo(() => {
    if (!currentStudent || sessions.length === 0) return { attendanceRate: 100, attendanceCount: 0, totalPoints: 0, penaltyPoints: 0, totalSessionsTaken: 0, remainingSessions: 0 };
    
    // Done Sessions
    const doneSessions = sessions.filter(s => s.status === 'done' && !s.isPostponed);
    const totalSessions = sessions.filter(s => !s.isPostponed).length;
    const totalSessionsTaken = doneSessions.length;
    const remainingSessions = Math.max(0, totalSessions - totalSessionsTaken);

    // Filter evaluations
    const uniquePresentSessions = new Set(
      evaluations.filter(e => e.attendance === 1 && e.sessionNumber !== undefined).map(e => e.sessionNumber)
    );
    const presentCount = Math.min(uniquePresentSessions.size, totalSessionsTaken);
    const attendanceRate = totalSessionsTaken > 0 ? Math.min(100, Math.round((presentCount / totalSessionsTaken) * 100)) : 100;

    // Points calculations from Evaluations
    const evalLecturePoints = evaluations.reduce((sum, e) => {
      // e.total is the complete score computed per session
      return sum + (e.total || 0);
    }, 0);

    // Project points if any
    const finalProjectScore = 0; // We can load it if user has finalProjects

    // Penalty total
    const penaltyTotal = penalties.reduce((sum, p) => sum + (p.points || 0), 0);
    const netTotalPoints = Math.max(0, evalLecturePoints - penaltyTotal);

    return {
      attendanceRate,
      attendanceCount: presentCount,
      totalPoints: netTotalPoints,
      penaltyPoints: penaltyTotal,
      totalSessionsTaken,
      remainingSessions,
      totalSessions
    };
  }, [currentStudent, sessions, evaluations, penalties]);

  // Live Session / meeting link tracking
  const liveSessionState = useMemo(() => {
    if (sessions.length === 0) return null;
    
    const getCairoParts = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
        const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        return { year, month, day, hour, minute };
      } catch (err) {
        console.error("Error formatting Cairo parts, falling back to local time:", err);
        const now = new Date();
        return {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes()
        };
      }
    };

    const isSessionOverTimeLimit = (dateStr: string, startStr: string): boolean => {
      if (!dateStr || !startStr) return false;
      try {
        const totalMins = parseTimeToMinutes(startStr);
        if (totalMins === null) return false;
        const hour = Math.floor(totalMins / 60);
        const min = totalMins % 60;
        
        const dateParts = dateStr.split('-');
        if (dateParts.length < 3) return false;
        const [year, month, day] = dateParts.map(Number);

        const cairo = getCairoParts();
        const startDateLocal = new Date(year, month - 1, day, hour, min, 0, 0);
        const cairoNowLocal = new Date(cairo.year, cairo.month - 1, cairo.day, cairo.hour, cairo.minute, 0, 0);

        const diffMs = cairoNowLocal.getTime() - startDateLocal.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        return diffMinutes >= 180; // 3 hours = 180 minutes
      } catch (e) {
        console.error("Error in check auto-end condition:", e);
        return false;
      }
    };

    // 1. Is there an active started session on-going? (trainer activated it)
    const activeRunning = sessions.find(s => s.smartAssistantState && s.smartAssistantState !== 'idle');
    if (activeRunning) {
      if (activeRunning.startTimeActual && activeRunning.date && isSessionOverTimeLimit(activeRunning.date, activeRunning.startTimeActual)) {
        // Automatically treat as expired for the student portal if over 3 hours
        return null;
      }
      return {
        session: activeRunning,
        isStarted: true,
        isEndedRecently: false,
        meetingLink: activeRunning.meetingLink || ''
      };
    }

    // 1.5. Is there a session that has status 'done' and ended less than 1 hour (60 minutes) ago?
    const doneSessions = sessions.filter(s => s.status === 'done' && s.endTimeActual && s.date);
    const sortedDone = [...doneSessions].sort((a, b) => b.sessionNumber - a.sessionNumber);
    const lastEndedSession = sortedDone[0];
    if (lastEndedSession) {
      try {
        const totalMins = parseTimeToMinutes(lastEndedSession.endTimeActual);
        if (totalMins !== null) {
          const endH = Math.floor(totalMins / 60);
          const endM = totalMins % 60;
          const dateParts = lastEndedSession.date.split('-');
          if (dateParts.length >= 3) {
            const [y, m, d] = dateParts.map(Number);
            const endDateLocal = new Date(y, m - 1, d, endH, endM, 0, 0);
            const cairo = getCairoParts();
            const cairoNowLocal = new Date(cairo.year, cairo.month - 1, cairo.day, cairo.hour, cairo.minute, 0, 0);
            const diffMinutes = (cairoNowLocal.getTime() - endDateLocal.getTime()) / (1000 * 60);
            // Did it end between 0 and 1 hour ago?
            if (diffMinutes >= 0 && diffMinutes <= 60) {
              return {
                session: lastEndedSession,
                isStarted: false,
                isEndedRecently: true,
                meetingLink: lastEndedSession.meetingLink || ''
              };
            }
          }
        }
      } catch (err) {
        console.error("Error evaluating recently ended session:", err);
      }
    }
    
    // 2. Is there a session scheduled for today whose scheduled lecture time has arrived?
    const nextUpcoming = sessions.find(s => s.status === 'upcoming');
    if (nextUpcoming && nextUpcoming.date) {
      try {
        const cairo = getCairoParts();
        const monthPad = String(cairo.month).padStart(2, '0');
        const dayPad = String(cairo.day).padStart(2, '0');
        const todayStr = `${cairo.year}-${monthPad}-${dayPad}`;
        
        if (nextUpcoming.date === todayStr) {
          const sessionTime = studentGroup?.sessionTime; // format: "18:00"
          if (sessionTime) {
            const [schHour, schMin] = sessionTime.split(':').map(Number);
            
            const currentMins = cairo.hour * 60 + cairo.minute;
            const scheduledMins = schHour * 60 + schMin;
            
            // If current time is within 15 minutes before the start time, up to 3.5 hours after start time
            if (currentMins >= scheduledMins - 15 && currentMins <= scheduledMins + 210) {
              return {
                session: nextUpcoming,
                isStarted: false,
                isEndedRecently: false,
                meetingLink: ''
              };
            }
          }
        }
      } catch (e) {
        console.error("Error evaluating live Cairo time criteria:", e);
      }
    }
    
    return null;
  }, [sessions, studentGroup]);

  const sanitizedMeetingLink = useMemo(() => {
    if (!liveSessionState?.meetingLink) return '';
    const url = liveSessionState.meetingLink.trim();
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  }, [liveSessionState?.meetingLink]);

  // Quietly update student data in background without triggering full-screen loading spinner
  const refreshStudentDataQuietly = async (student: Student, overrideGroupId?: string) => {
    try {
      const activeGId = overrideGroupId || student.groupId;
      if (activeGId) {
        const groupSnap = await getDoc(doc(db, 'groups', activeGId));
        if (groupSnap.exists()) {
          const g = { id: groupSnap.id, ...groupSnap.data() } as Group;
          setStudentGroup(g);
        }
      }

      const qEvals = query(collection(db, 'lectureEvaluations'), where('studentId', '==', student.id));
      const evSnap = await getDocs(qEvals);
      const rawEvals = evSnap.docs.map((d: any) => d.data() as LectureEvaluation);
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
          uniqueEvalsMap.set(ev.sessionNumber, merged);
        }
      }
      setEvaluations(Array.from(uniqueEvalsMap.values()));

      const qRanks = query(collection(db, 'groupRankings'), where('groupId', '==', activeGId));
      const rankSnap = await getDocs(qRanks);
      setRankings(rankSnap.docs.map((d: any) => d.data() as GroupRanking));
    } catch (err) {
      console.error("Error quietly refreshing student data:", err);
    }
  };

  // AUTOMATIC ATTENDANCE TRIGGER ON JOINING LECTURES/MEETINGS
  const handleJoinLiveMeeting = async (session: Session | null | undefined, rawUrl: string) => {
    if (!rawUrl) return;
    const url = rawUrl.trim();
    const validUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    // 1. Immediately open meeting link in a new tab to avoid pop-up blockers
    window.open(validUrl, '_blank', 'noopener,noreferrer');

    // 2. Perform automated attendance registration if logged in
    if (currentStudent && session && session.sessionNumber !== undefined) {
      const groupId = session.groupId || currentStudent.groupId || studentGroup?.id;
      if (!groupId) return;

      try {
        const res = await markStudentAttendanceSelf(
          groupId,
          currentStudent.id,
          session.sessionNumber,
          session.id || ''
        );

        // Optimistically update local evaluations state so stats & tables update instantly
        setEvaluations(prev => {
          const existingIdx = prev.findIndex(e => e.sessionNumber === session.sessionNumber);
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...copy[existingIdx],
              attendance: 1,
              updatedAt: new Date().toISOString()
            };
            return copy;
          } else {
            const newEval: LectureEvaluation = {
              id: `${groupId}_${currentStudent.id}_${session.sessionNumber}`,
              groupId,
              studentId: currentStudent.id,
              sessionNumber: session.sessionNumber,
              attendance: 1,
              taskDelivered: 0,
              taskOnTime: 0,
              taskQuality: 0,
              taskRedo: 0,
              bonus: 0,
              total: 1,
              evaluatorId: 'student_self',
              updatedAt: new Date().toISOString()
            };
            return [...prev, newEval];
          }
        });

        // Sync rankings quietly in background
        refreshStudentDataQuietly(currentStudent, groupId);

      } catch (err) {
        console.error("Silent attendance logging:", err);
      }
    }
  };

  // Trainer name state for Next Session display
  const [trainerName, setTrainerName] = useState<string>('لم يحدد');

  useEffect(() => {
    if (!studentGroup) return;
    const trainerId = studentGroup.primaryTrainerId || studentGroup.trainerIds?.[0];
    if (trainerId) {
      getDoc(doc(db, 'users', trainerId)).then((snap) => {
        if (snap.exists()) {
          setTrainerName(snap.data().name || 'لم يحدد');
        }
      }).catch(console.error);
    }
  }, [studentGroup]);

  // Next Session computation for Stage 5 Student Portal update
  const nextSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    return sessions.find(s => s.status === 'upcoming') || sessions.find(s => s.status !== 'done') || null;
  }, [sessions]);

  const nextCalendarUrl = useMemo(() => {
    if (!nextSession || !nextSession.date) return null;
    const title = `المحاضرة رقم ${nextSession.sessionNumber}: ${nextSession.lectureTitle || studentGroup?.courseName || 'محاضرة'}`;
    const details = `المحاضرة رقم ${nextSession.sessionNumber} - مجموعة: ${studentGroup?.name || ''}\nالمدرب: ${trainerName}`;
    const location = nextSession.googleMeetUrl || 'Google Meet';
    
    const timeStr = studentGroup?.sessionTime || '18:00';
    const [hours, mins] = timeStr.split(':').map(Number);
    const dateParts = nextSession.date.split('-').map(Number);
    
    if (dateParts.length === 3 && !isNaN(hours) && !isNaN(mins)) {
      const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, mins);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      const formatCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
      const startIso = formatCalDate(startDate);
      const endIso = formatCalDate(endDate);
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    }
    return null;
  }, [nextSession, studentGroup, trainerName]);

  const activePostponements = useMemo(() => {
    if (sessions.length === 0) return null;
    
    // Find active postponing state for upcoming and un-started lectures
    const startPostponed = sessions.find(s => s.status !== 'done' && s.startPostponeMinutes && s.startPostponeNewTime);
    const generalPostponed = sessions.find(s => s.status !== 'done' && s.generalPostponeActive && s.generalPostponeDate);
    
    if (!startPostponed && !generalPostponed) return null;
    
    return {
      startPostponed,
      generalPostponed
    };
  }, [sessions]);

  // 8. PDF STUDENT REPORT GENERATION (MISSING TASKS)
  const downloadStudentReport = async () => {
    if (!currentStudent || !studentGroup) return;
    setDownloadingReport(true);
    
    // Calculate values representing missing tasks progress
    const studentEvals = evaluations;
    const totalRequired = sessions.filter(s => s.status === 'done').reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
    const totalCompleted = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
    const completionRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100;
    const finalCompletionRate = Math.min(100, completionRate); // Clamp to 100% max

    // Get report sessions (DONE sessions where remaining > 0)
    const reportSessions = sessions.map(s => {
      const ev = studentEvals.find(e => e.sessionNumber === s.sessionNumber);
      const completed = ev?.taskDelivered || 0;
      const required = s.requiredTasksCount || 0;
      const remaining = Math.max(0, required - completed);
      
      const attendanceStatus = s.status === 'done' 
        ? (ev ? (ev.attendance === 1 ? 'حضور' : 'غياب') : 'غياب')
        : '-';

      return { ...s, completed, required, remaining, attendanceStatus };
    }).filter(s => s.status === 'done' && s.remaining > 0);

    const missingSessionsCount = reportSessions.length;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.dir = 'rtl';
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 10px 0;">SABER GROUP ACADEMY</h1>
        <h2 style="color: #334155; font-size: 18px; margin: 0;">تقرير المهام المتأخرة والواجبات المطلوبة (للمتدرب)</h2>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">اسم المتدرب</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">${currentStudent.name}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">كود المتدرب (ID)</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">${currentStudent.studentIdNum || '-'}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">المجموعة / الجروب</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">Batch ${studentGroup.name || '-'}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">نسبة الإنجاز (المهام)</p>
          <p style="margin: 0; color: ${finalCompletionRate >= 80 ? '#10b981' : finalCompletionRate >= 50 ? '#f59e0b' : '#ef4444'}; font-size: 16px; font-weight: bold;">${finalCompletionRate}%</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">المحاضرة</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">التاريخ</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">عنوان المحاضرة</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">المطلوب</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">المنجز</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">المتبقي</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px; text-shadow: none;">الروابط</th>
          </tr>
        </thead>
        <tbody>
          ${missingSessionsCount === 0 ? `
            <tr>
              <td colspan="7" style="padding: 30px; text-align: center; color: #166534; font-weight: bold; font-size: 14px; background-color: #f0fdf4; border-radius: 8px;">
                🎉 ممتاز ورائع جداً! لقد قمت بتسليم وإنجاز كل المهام المطلوبة بالكامل ولا توجد أي مهام متأخرة متراكمة عليك حالياً. تابع تقدمك المستمر!
              </td>
            </tr>
          ` : reportSessions.map(s => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; color: #0f172a; font-weight: bold;">المحاضرة ${s.sessionNumber}</td>
              <td style="padding: 12px; color: #64748b; font-size: 12px;">${s.date || '-'}</td>
              <td style="padding: 12px; color: #334155;">${s.lectureTitle || '-'}</td>
              <td style="padding: 12px; text-align: center; color: #64748b;">${s.required}</td>
              <td style="padding: 12px; text-align: center; color: #10b981; font-weight: bold;">${s.completed}</td>
              <td style="padding: 12px; text-align: center; color: #ef4444; font-weight: bold;">${s.remaining}</td>
              <td style="padding: 12px; text-align: center;">
                ${s.lectureRecordingUrl ? `<a href="${s.lectureRecordingUrl}" style="color: #3b82f6; text-decoration: none; margin-left: 8px; display: inline-block;">🎥 تسجيل</a>` : ''}
                ${s.tasksMessageUrl ? `<a href="${s.tasksMessageUrl}" style="color: #3b82f6; text-decoration: none; display: inline-block;">🔗 المهام</a>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${missingSessionsCount > 0 ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">
          ⚠️ يوجد مهام متأخرة وبحاجة للتسليم العاجل في عدد ${missingSessionsCount} محاضرات تدريبية.
        </p>
      </div>
      ` : ''}

      <div style="background: #e0f2fe; border: 1px solid #bae6fd; padding: 16px; border-radius: 12px; text-align: center; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="font-size: 20px;">💬</span>
        <span style="color: #0369a1; font-weight: bold; font-size: 13px; line-height: 1.6; margin-left: 12px;">
          إذا واجهتك مشاكل تقنية أو أردت مراجعة المهام والدرجات، يرجى التواصل فوراً مع فريق الدعم الفني وخدمة العملاء:
        </span>
        <a href="https://wa.me/201553719496?text=${encodeURIComponent(`مرحباً خدمة العملاء، أود الاستفسار ومراجعة تقرير المهام المتأخرة بالمسار التعليمي للسيستم.\nالاسم: ${currentStudent.name}\nالكود: ${currentStudent.studentIdNum || 'غير محدد'}\nالمجموعة: Batch ${studentGroup.name || '-'}`)}" 
           style="background-color: #25d366; color: white !important; font-weight: bold; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(37,211,102,0.2);"
           target="_blank">
          تواصل عبر واتساب
        </a>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Add clickable links
      const links = container.querySelectorAll('a');
      const containerRect = container.getBoundingClientRect();

      links.forEach(link => {
        const rect = link.getBoundingClientRect();
        const left = rect.left - containerRect.left;
        const top = rect.top - containerRect.top;
        
        const scaleX = pdfWidth / containerRect.width;
        const scaleY = pdfHeight / containerRect.height;

        const pdfX = left * scaleX;
        const pdfY = top * scaleY;
        const pdfW = rect.width * scaleX;
        const pdfH = rect.height * scaleY;

        pdf.link(pdfX, pdfY, pdfW, pdfH, { url: link.href });
      });

      pdf.save(`تقرير_المهام_المتأخرة_${currentStudent.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء إنشاء ملف PDF لتقرير المهام المتأخرة');
    } finally {
      document.body.removeChild(container);
      setDownloadingReport(false);
    }
  };

  // NEW: Validate QR validation loading state
  if (isAttendanceMode && isCheckingQr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6" dir="rtl">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest leading-relaxed font-arabic">جاري التحقق من صلاحية كود الحضور... يرجى الانتظار</p>
        </div>
      </div>
    );
  }

  // NEW: Expiration / Validation Error Message Screen
  if (isAttendanceMode && qrCheckError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden font-arabic" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-650/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-650/5 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-4xl border border-red-500/20 shadow-2xl p-8 relative z-10 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-red-500/10 text-red-400 border border-red-500/30 rounded-3xl flex items-center justify-center animate-pulse shadow-lg shadow-red-500/10">
            <AlertTriangle size={48} />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase bg-red-950 text-red-500 px-3 py-1 rounded-full border border-red-900/50">
              انتهت صلاحية رابط تسجيل الحضور
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight pt-2">عذراً، كود الحضور غير صالح أو منتهي الصلاحية ⚠️</h1>
            <p className="text-slate-400 font-bold text-xs leading-relaxed px-3 text-center">
              {qrCheckError}
            </p>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3 text-right">
            <div className="flex items-start gap-2 text-xs">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-slate-300 leading-normal">
                تسجيل الحضور في Saber Group مغلق بوقت محدد لحماية التزام الطلاب وضمان العدالة.
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs pt-1.5 border-t border-slate-800/40">
              <span className="text-amber-500 mt-0.5">⚡</span>
              <p className="text-slate-300 leading-normal">
                إذا كنت متأخراً وتستحق تسجيل الحضور، يرجى طلب <strong>كود حضور جديد مؤقت</strong> من المحاضر مباشرة لتتمكن من تسجيل الحضور بالـ QR الجديد.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                navigate('/student/portal');
                window.location.reload();
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all"
            >
              الذهاب إلى الملف الشخصي وملف المتابعة الخاص بي ➔
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDERING COMPONENT LOADER
  if (loading && !loginLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest leading-relaxed">تحميل بوابة الطلاب... يرجى الانتظار</p>
        </div>
      </div>
    );
  }

  // A. ATTENDANCE CONFIRMATION RIPPLE SCREEN (SUCCESS SCREEN)
  if (attendanceSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[125px] rounded-full translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-4xl border border-purple-500/20 shadow-2xl p-8 relative z-10 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-3xl flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/10">
            <CheckCircle size={48} />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 px-3 py-1 rounded-full border border-emerald-900/50">
              {wasAlreadyRegistered ? 'مسجل مسبقاً' : 'تم تسجيل حضورك تلقائياً'}
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight pt-2">أهلاً يا {currentStudent?.name}! 👋</h1>
            <p className="text-slate-400 font-bold text-sm leading-relaxed">
              {wasAlreadyRegistered ? (
                <>تم تسجيل حضورك للمحاضرة دي بنجاح بالفعل (المحاضرة رقم <span className="text-purple-400 font-black text-lg">#{attendingSessionNum}</span>).</>
              ) : (
                <>تم تسجيل حضورك بنجاح في المحاضرة رقم <span className="text-purple-400 font-black text-lg">#{attendingSessionNum}</span>.</>
              )}
            </p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-1.5 text-right">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-black">أكاديمية التدريب:</span>
              <span className="text-slate-200 font-bold">بوابة SABER GROUP</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-800/40">
              <span className="text-slate-500 font-black">المجموعة الحالية:</span>
              <span className="text-purple-400 font-black">Batch {studentGroup?.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-800/40">
              <span className="text-slate-500 font-black">الكورس الحالي:</span>
              <span className="text-slate-200 font-bold">{studentGroup?.courseName}</span>
            </div>
          </div>

          <div className="p-4 bg-purple-950/20 border border-purple-900/40 rounded-2xl space-y-1">
            <p className="text-xs text-purple-300 font-black">✨ واستمتع بالمحاضرة! شكراً لالتزامك المتميز معنا ✨</p>
          </div>

          <button
            onClick={() => {
              setAttendanceSuccess(false);
              // Navigate to normal student portal dashboard
              if (currentStudent) {
                loadStudentData(currentStudent);
              }
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20 hover:scale-[1.02] active:scale-95"
          >
            الانتقال لملف المتابعة الخاص بي ➔
          </button>
        </div>
      </div>
    );
  }

  // C. FEEDBACK SUCCESS STATE SUBMISSION RIPPLE SCREEN
  if (isFeedbackMode && feedbackSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden text-right" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[125px] rounded-full translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-4xl border border-purple-500/20 shadow-2xl p-8 relative z-10 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-3xl flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/10">
            <CheckCircle size={48} />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 px-3 py-1 rounded-full border border-emerald-900/50">
              تم إرسال تقييمك بنجاح
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight pt-2">شُكراً لمساهمتك يا مبدع! ❤️</h1>
            <p className="text-slate-400 font-bold text-sm leading-relaxed text-center font-arabic">
              رأيك الغالي يساعدنا دائماً في تطوير المنهج التدريبي وتقديم أفضل جودة ومقررات تليق بـ <span className="text-purple-400 font-black">Saber Group</span>.
            </p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-1.5 text-right font-arabic">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-black">المجموعة:</span>
              <span className="text-purple-400 font-black">Batch {evaluatingGroup?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-800/40">
              <span className="text-slate-500 font-black">الكورس:</span>
              <span className="text-slate-200 font-bold">{evaluatingGroup?.courseName || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-800/40">
              <span className="text-slate-500 font-black">المحاضرة المقيّمة:</span>
              <span className="text-emerald-400 font-black font-mono">المحاضرة # {qSessionNumber}</span>
            </div>
          </div>

          <p className="text-xs text-purple-300 font-black">✨ تمنياتنا لك بدوام التفوق والنجاح الباهر ✨</p>
        </div>
      </div>
    );
  }

  // D. FEEDBACK / LECTURE EVALUATION FORM
  if (isFeedbackMode) {
    const primaryTrainerName = evaluatingGroup?.trainerName || '';

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex items-center justify-center relative overflow-hidden text-right" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="w-full max-w-2xl bg-slate-900 rounded-3xl border border-slate-800/70 shadow-2xl p-6 md:p-8 relative z-10 space-y-8 font-arabic">
          
          {/* Header */}
          <div className="text-center space-y-2 pb-6 border-b border-slate-800/60">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-600/20">
              <span className="text-2xl font-black text-white">⭐</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">استمارة تقييم أداء الكورس والمدرب والأكاديمية والسيلز</h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              يسعدنا مشاركتك برأيك الصريح لمساعدتنا في قياس وتطوير جودة الخدمات، أداء المدربين، السيلز والمحتوى التدريبي.
            </p>
          </div>

          {/* Group Metadata Info card */}
          {evaluatingGroup && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-purple-500/20 text-right grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed font-bold">
              <div>
                <span className="text-slate-500 font-black block">الكورس والمقرر:</span>
                <span className="text-slate-200">{evaluatingGroup.courseName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-black block">المجموعة:</span>
                <span className="text-purple-400 font-black">Batch {evaluatingGroup.name}</span>
              </div>
              {primaryTrainerName && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 font-black block">المدرب الرئيسي للمجموعة:</span>
                  <span className="text-emerald-400 font-black">{primaryTrainerName}</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleFeedbackSubmit} className="space-y-8">
            
            {/* Student attribution & Anonymous option */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-xs font-black text-purple-400 flex items-center gap-2">
                  <span>👤</span> هوية صاحب التقييم
                </h3>
                
                {/* Anonymous Toggle */}
                <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-750 hover:border-purple-500/40 transition-all">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-slate-950 border-slate-700 rounded focus:ring-purple-500"
                  />
                  <span className="text-[11px] font-black text-slate-200">تقديم التقييم كـ مجهول الهوية (Anonymous) 🕶️</span>
                </label>
              </div>

              {isAnonymous ? (
                <div className="p-3 bg-purple-950/30 border border-purple-900/30 rounded-xl text-xs text-purple-300 font-bold leading-relaxed">
                  🔒 تم تفعيل وضع مجهول الهوية. سيتم تسليم تقييمك دون إظهار اسمك أو بريدك مطلقاً لضمان الخصوصية التامة.
                </div>
              ) : currentStudent ? (
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                  <span className="text-[11px] font-black bg-emerald-950 text-emerald-400 border border-emerald-900/50 px-2.5 py-1 rounded-lg">مسجل دخولك</span>
                  <div className="text-left font-bold text-xs">
                    <p className="text-slate-200">{currentStudent.name}</p>
                    <span className="text-[10px] text-slate-500 dir-ltr">{currentStudent.studentId}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-amber-400 font-bold leading-relaxed">
                    🔑 يرجى إدخال الرقم التعريفي وكلمة المرور الخاصة بك كمتدرب لتسجيل التقييم باسمك، أو اختر اسمك من القائمة:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="الرقم التعريفي Student ID (وليس الإيميل)"
                      value={evalStudentId}
                      onChange={(e) => setEvalStudentId(e.target.value)}
                      className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-500 text-right font-mono"
                    />
                    <input
                      type="password"
                      placeholder="كلمة المرور"
                      value={evalPassword}
                      onChange={(e) => setEvalPassword(e.target.value)}
                      className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-500 text-right"
                    />
                  </div>

                  {evalLoginError && (
                    <div className="p-2.5 bg-red-950/40 border border-red-900/50 rounded-xl text-[11px] font-bold text-red-300">
                      ⚠️ {evalLoginError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleEvalLogin}
                      disabled={evalLoginLoading}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md"
                    >
                      {evalLoginLoading ? 'جاري التوثيق...' : 'تأكيد الدخول كمتدرب'}
                    </button>

                    <select
                      value={customStudentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCustomStudentId(id);
                        if (id === 'anonymous') {
                          setIsAnonymous(true);
                        } else {
                          const s = groupStudents.find(stud => stud.id === id);
                          setCustomStudentName(s ? s.name : 'متدرب');
                        }
                      }}
                      className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-purple-500 text-right"
                    >
                      <option value="anonymous">أو اختر اسمك مباشر من الجروب...</option>
                      {groupStudents.map(s => (
                        <option key={s.id} value={s.id}>🎓 {s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 1: COURSE & CONTENT */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-black text-amber-400 border-r-4 border-amber-500 pr-2 flex items-center gap-2">
                <span>📚</span> 1. تقييم الكورس والمحتوى التدريبي:
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">تقييم الكورس والمادة العلمية بشكل عام:</span>
                    <span className="text-amber-400 font-black">{ratingCourse} / 5 ⭐</span>
                  </div>
                  <div className="flex gap-2 items-center justify-end" dir="ltr">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingCourse(star)}
                        className={`text-2xl transition-all hover:scale-125 ${star <= ratingCourse ? 'text-amber-400' : 'text-slate-700'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">مدى جودة وسهولة فهم محتوى المنهج والتمارين:</span>
                    <span className="text-amber-400 font-black">{ratingContent} / 5 ⭐</span>
                  </div>
                  <div className="flex gap-2 items-center justify-end" dir="ltr">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingContent(star)}
                        className={`text-2xl transition-all hover:scale-125 ${star <= ratingContent ? 'text-amber-400' : 'text-slate-700'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: SALES EVALUATION */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-black text-emerald-400 border-r-4 border-emerald-500 pr-2 flex items-center gap-2">
                <span>💼</span> 2. تقييم مسؤول المبيعات (Sales):
              </h3>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300">اسم مسؤول المبيعات (Sales) الذي تواصل معك وسجلت عن طريقه:</label>
                  <input
                    type="text"
                    value={salesAgentName}
                    onChange={(e) => setSalesAgentName(e.target.value)}
                    placeholder="اكتب اسم مسؤول المبيعات..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-emerald-500 font-arabic"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">تقييم التعامل والمتابعة مع مسؤول المبيعات:</span>
                    <span className="text-emerald-400 font-black">{ratingSales} / 5 ⭐</span>
                  </div>
                  <div className="flex gap-2 items-center justify-end" dir="ltr">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingSales(star)}
                        className={`text-2xl transition-all hover:scale-125 ${star <= ratingSales ? 'text-emerald-400' : 'text-slate-700'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="block text-[11px] font-bold text-slate-400">ملاحظات أو تعليق حول خدمة السيلز (اختياري):</label>
                  <input
                    type="text"
                    value={salesNotes}
                    onChange={(e) => setSalesNotes(e.target.value)}
                    placeholder="أي ملاحظات تخص الشرح المبدئي أو تسجيل الحجز..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-emerald-500 font-arabic"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: TRAINERS EVALUATION */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-black text-indigo-400 border-r-4 border-indigo-500 pr-2 flex items-center gap-2">
                <span>👨‍🏫</span> 3. تقييم المدرب الرئيسي والمدربين الآخرين:
              </h3>

              {/* Primary Trainer Card */}
              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    {primaryTrainerName ? `المُدرب الخاص بمجموعتك: أ/ ${primaryTrainerName}` : 'المُدرب الخاص بمجموعتك'}
                  </span>
                  <span className="text-indigo-400 font-black">{ratingTrainer} / 5 ⭐</span>
                </div>

                <div className="flex gap-2 items-center justify-end" dir="ltr">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingTrainer(star)}
                      className={`text-2xl transition-all hover:scale-125 ${star <= ratingTrainer ? 'text-indigo-400' : 'text-slate-700'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={trainerNotes}
                  onChange={(e) => setTrainerNotes(e.target.value)}
                  placeholder={primaryTrainerName ? `ملاحظاتك أو انطباعك عن أداء المدرب أ/ ${primaryTrainerName}...` : 'ملاحظاتك أو انطباعك عن أداء المدرب...'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 font-arabic"
                />
              </div>

              {/* Optional Other Trainer Option */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                  <input
                    type="checkbox"
                    checked={hasOtherTrainer}
                    onChange={(e) => setHasOtherTrainer(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-black text-indigo-300">هل ترغب في تقييم مدرب آخر أو شخص آخر في الأكاديمية حضر معك؟ 🔁</span>
                </label>

                {hasOtherTrainer && (
                  <div className="mt-3 p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl space-y-3 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-indigo-200">اسم المدرب الآخر أو الشخص المراد تقييمه:</label>
                      <input
                        type="text"
                        value={otherTrainerName}
                        onChange={(e) => setOtherTrainerName(e.target.value)}
                        placeholder="أدخل اسم المدرب الآخر..."
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 font-arabic"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-indigo-200">تقييم أداء هذا المدرب الآخر:</span>
                        <span className="text-indigo-400 font-black">{otherTrainerRating} / 5 ⭐</span>
                      </div>
                      <div className="flex gap-2 items-center justify-end" dir="ltr">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setOtherTrainerRating(star)}
                            className={`text-2xl transition-all hover:scale-125 ${star <= otherTrainerRating ? 'text-indigo-400' : 'text-slate-700'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={otherTrainerNotes}
                      onChange={(e) => setOtherTrainerNotes(e.target.value)}
                      placeholder="ملاحظاتك بخصوص هذا المدرب الآخر..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 font-arabic"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 4: ACADEMY & GENERAL COMMENTS */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-black text-purple-400 border-r-4 border-purple-500 pr-2 flex items-center gap-2">
                <span>🏛️</span> 4. تقييم الأكاديمية والملاحظات العامة:
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">الرضا العام عن تجربة Saber Group والتنظيم والدعم:</span>
                    <span className="text-purple-400 font-black">{ratingAcademy} / 5 ⭐</span>
                  </div>
                  <div className="flex gap-2 items-center justify-end" dir="ltr">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingAcademy(star)}
                        className={`text-2xl transition-all hover:scale-125 ${star <= ratingAcademy ? 'text-purple-400' : 'text-slate-700'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-850">
                  <label className="block text-xs font-black text-slate-300">📝 ملاحظات أو اقتراحات اختيارية لتطوير التجربة:</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs h-24 outline-none focus:border-purple-500 text-right leading-relaxed font-arabic"
                    placeholder="اكتب اقتراحاتك للتحسين أو أي كلمات ودية تود توجيهها للأكاديمية..."
                  />
                </div>
              </div>
            </div>

            {/* Has Complaint Checkbox Toggle */}
            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/30 text-right space-y-4">
              <div className="flex items-center justify-between">
                <input
                  type="checkbox"
                  id="hasComplaintCheck"
                  checked={hasComplaint}
                  onChange={(e) => setHasComplaint(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-slate-950 border-slate-800 rounded focus:ring-red-500"
                />
                <label htmlFor="hasComplaintCheck" className="text-xs font-black text-red-300 select-none cursor-pointer flex gap-1.5 items-center">
                  <span>🚨</span> هل تود تسجيل شكوى أو مشكلة خاصة تحتاج متابعة عاجلة؟
                </label>
              </div>

              {hasComplaint && (
                <div className="space-y-4 pt-3 border-t border-red-900/20 animate-fade-in text-right">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-300">تفاصيل الشكوى بوضوح:</label>
                    <textarea
                      value={complaintText}
                      onChange={(e) => setComplaintText(e.target.value)}
                      required={hasComplaint}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs h-24 outline-none focus:border-red-500 text-right leading-relaxed font-arabic"
                      placeholder="برجاء كتابة تفاصيل المشكلة التي واجهتك حتى يتم المتابعة وحلها فوراً..."
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 p-3 bg-slate-900/60 rounded-xl border border-red-900/15">
                    <label htmlFor="wantsCallCheck" className="text-[11px] font-bold text-amber-500 select-none cursor-pointer">
                      نعم، أرغب في أن يتواصل معي أحد ممثلي خدمة العملاء هاتفياً لحل هذه المشكلة 📞
                    </label>
                    <input
                      type="checkbox"
                      id="wantsCallCheck"
                      checked={wantsCall}
                      onChange={(e) => setWantsCall(e.target.checked)}
                      className="w-4 h-4 text-red-600 bg-slate-950 border-slate-800 rounded focus:ring-red-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-600/10 hover:scale-[1.01] active:scale-95 flex justify-center items-center gap-2"
            >
              {loading ? 'جاري إرسال التقييم...' : '✅ إرسال استمارة التقييم الكاملة'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // B-1. DEACTIVATED / UNPAID 50% STUDENT SCREEN
  if (currentStudent && (currentStudent.deactivated || currentStudent.is50PercentPaid === false)) {
    const category = currentStudent.deactivationReasonCategory || (currentStudent.is50PercentPaid === false ? 'unpaid_50_percent' : 'other');
    let titleAr = 'حسابك موقوف مؤقتاً';
    let subtitleAr = 'تنبيه بشأن حالة الحساب والاشتراك';
    let detailAr = currentStudent.deactivationReason || 'يرجى التواصل مع إدارة الأكاديمية لاستكمال البيانات ومتابعة الاشتراك.';

    if (category === 'unpaid_50_percent') {
      titleAr = 'لم يتم استكمال 50% من رسوم الكورس ⚠️';
      subtitleAr = 'إيقاف مؤقت للوصول للمنصة التعليمية';
      detailAr = 'عذراً، تظهر بياناتك مسجلة بالمنصة ولكن لم يستكمل سداد 50% من سعر الكورس بعد حسب سياسة الحجز. يمكنك تفعيل الحساب فور استكمال المبلغ بالرجوع لخدمة العملاء.';
    } else if (category === 'installment_delinquency') {
      titleAr = 'إيقاف بسبب عدم الانتظام في الأقساط ⚠️';
      subtitleAr = 'تأخر عن سداد القسط المستحق';
      detailAr = 'تم توقيف حسابك مؤقتاً لعدم الانتظام في سداد القسط المالي المستحق. نرجو التواصل مع قسم الحسابات لتصفية القسط وتفعيل الحساب.';
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden font-arabic" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 blur-[130px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-4xl border border-red-500/30 shadow-2xl p-8 relative z-10 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-red-500/10 text-red-400 border border-red-500/30 rounded-3xl flex items-center justify-center shadow-lg shadow-red-500/10">
            <AlertTriangle size={48} />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase bg-red-950 text-red-400 px-3 py-1 rounded-full border border-red-900/50">
              {subtitleAr}
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight pt-2">{titleAr}</h1>
            <p className="text-slate-300 font-medium text-xs leading-relaxed px-2">
              {detailAr}
            </p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 text-right space-y-3">
            <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold">اسم المتدرب:</span>
              <span className="text-white font-black">{currentStudent.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold">كود الطالب (ID):</span>
              <span className="text-purple-400 font-mono font-black">{currentStudent.studentIdNum || 'غير محدد'}</span>
            </div>
            {currentStudent.deactivationReason && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-black">ملاحظات الإدارة:</span>
                <p className="text-xs text-amber-300 font-bold bg-amber-950/30 p-2.5 rounded-xl border border-amber-900/30">
                  {currentStudent.deactivationReason}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href="https://wa.me/201040784390"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              💬 التواصل مع خدمة العملاء للتفعيل (واتساب)
            </a>

            <button
              onClick={() => {
                localStorage.removeItem('studentSession');
                setCurrentStudent(null);
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-2xl text-xs transition-all"
            >
              تسجيل الخروج ➔
            </button>
          </div>
        </div>
      </div>
    );
  }

  // B. STUDENT ENTERING LOGIN SCREEN (IF NO SESSION ACTIVE)
  if (!currentStudent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 relative overflow-hidden" dir="rtl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="mb-10 text-center relative z-10">
          <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-600/40 transform hover:rotate-12 transition-transform">
            <span className="text-4xl font-black text-white">S</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">SABER GROUP ACADEMY</h1>
          <p className="text-slate-500 font-black uppercase tracking-[0.2rem] text-[10px]">Student Workspace & Attendance Portal</p>
        </div>

        <div className="w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl p-8 relative z-10 border border-slate-800">
          <div className="mb-8 text-center space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">بوابة الطلاب والمتدربين</h2>
            <p className="text-xs font-semibold text-slate-400">سجل دخولك لمتابعة حضورك وتقييمك ومحاضرات المجموعة الخاصة بك.</p>
          </div>

          {/* Clarity Alert Banner */}
          <div className="mb-6 p-3.5 bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/30 rounded-2xl text-right space-y-1 shadow-lg shadow-purple-950/30">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-black shrink-0">💡</span>
              <span className="text-xs font-black text-purple-200">تنبيه هام لتسجيل الدخول:</span>
            </div>
            <p className="text-[11px] text-slate-300 font-bold leading-relaxed pr-7">
              يرجى إدخال <span className="text-amber-300 font-extrabold underline decoration-amber-400">الرقم التعريفي (Student ID)</span> المكون من 6 أرقام المستلم في إيميل الترحيب <span className="text-rose-400 font-black">(وليس البريد الإلكتروني ❌)</span>.
            </p>
          </div>

          {isAttendanceMode && qGroupId && (
            <div className="mb-6 p-4 bg-purple-950/40 border border-purple-900/50 rounded-2xl text-center space-y-1">
              <span className="text-[9px] font-black text-purple-400 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-900">تسجيل حضور المحاضرة</span>
              <p className="text-xs font-bold text-slate-300">قم بتسجيل الدخول أولاً لتسجيل حضورك تلقائياً</p>
            </div>
          )}

          {loginError && (
            <div className="mb-6 p-4 bg-red-500/10 text-red-400 text-xs rounded-2xl border border-red-500/20 font-black text-center animate-shake leading-relaxed">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleStudentLogin} className="space-y-5">
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between mr-1 mb-1">
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider">
                  الرقم التعريفي (Student ID) أو الموبايل
                </label>
                <span className="text-[9px] font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  كود الـ ID وليس الإيميل ❌
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  className="w-full pr-12 pl-6 py-4 rounded-xl bg-slate-950 border border-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono font-bold text-sm text-center text-white placeholder:text-slate-600 placeholder:text-xs placeholder:font-sans"
                  placeholder="اكتب كود الـ ID (مثال: 123456) أو رقم الموبايل"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <UserIcon size={18} />
                </div>
              </div>

              {/* Dynamic live warning if student enters an email address */}
              {loginId.trim().includes('@') && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-[11px] text-rose-300 font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>تنبيه: أنت تكتب بريداً إلكترونياً! يرجى كتابة كود الـ ID الخاص بك (6 أرقام) المسجل في إيميل الترحيب.</span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-right">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">كلمة المرور (Password)</label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full pr-12 pl-6 py-4 rounded-xl bg-slate-950 border border-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono font-bold text-sm text-center text-white"
                  placeholder="المستلمة ببداية الكورس (5 أرقام)"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={18} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all shadow-2xl shadow-purple-600/20 disabled:opacity-50 mt-4"
            >
              {loginLoading ? 'جاري التحقق من الهوية الأكاديمية...' : 'تسجيل الدخول الفوري'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 font-extrabold tracking-wider leading-relaxed leading-loose">
              في حال فقدان الكود أو الباسوورد الخاص بك، يرجى مراجعة المدرب/المنسق فوراً في القاعة أو الكورس.
            </p>
          </div>
        </div>

        {/* Beautiful Branded Footer on Login */}
        <footer className="mt-12 pt-6 border-t border-slate-900 w-full max-w-sm text-center flex flex-col items-center gap-3 relative z-10 select-none">
          <p className="font-extrabold uppercase tracking-wide text-[10px] text-slate-500">
            Developed by Eng: <span className="text-purple-400">Mohamed Saber</span>
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            All rights reserved by Saber Group Courses Academy
          </p>
          <div className="flex items-center gap-3 mt-1">
            <a 
              href="https://wa.me/201024689480" 
              target="_blank" 
              rel="noreferrer" 
              className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-emerald-500/20 shadow-sm"
              title="Contact Eng. Mohamed Saber on WhatsApp"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.588 1.45 5.374 1.451 5.4 0 9.791-4.39 9.795-9.792.002-2.618-1.01-5.079-2.859-6.93C17.06 2.03 14.605.992 11.994.992 6.59.992 2.198 5.383 2.193 10.786c-.001 1.905.497 3.766 1.444 5.394L2.656 21.8l5.803-1.522c1.55.845 3.28 1.289 5.011 1.29h.178z"/>
              </svg>
            </a>
            <a 
              href="https://www.facebook.com/MS.GD.FL/" 
              target="_blank" 
              rel="noreferrer" 
              className="w-8 h-8 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-blue-500/20 shadow-sm"
              title="Follow on Facebook"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
              </svg>
            </a>
          </div>
        </footer>
      </div>
    );
  }

  const handleStudentProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent || !graduationProject || !studentGroup) return;

    const projStartDate = graduationProject.startDate || (graduationProject as any).submissionStartDate || '';
    const projEndDate = graduationProject.endDate || (graduationProject as any).submissionEndDate || '';

    const now = new Date();
    const startDT = projStartDate ? new Date(projStartDate) : null;
    const endDT = projEndDate ? new Date(projEndDate) : null;

    const isPastDeadline = endDT ? now > endDT : false;
    const isBeforeStart = startDT ? now < startDT : false;

    if (isBeforeStart) {
      alert(`عذراً، لم يبدأ موعد تسليم مشروع التخرج بعد! موعد البدء: ${projStartDate.replace('T', ' ')}`);
      return;
    }

    if (isPastDeadline) {
      alert(`عذراً! انتهى موعد التسليم النهائي لهذا المشروع (الديدلاين بتاريخ: ${projEndDate.replace('T', ' ')}). وغير مسموح بالتسليم بعد انتهاء المهلة.`);
      return;
    }

    if (!submissionDriveLink.trim()) {
      alert('برجاء إدخال رابط مشروع التخرج (Google Drive / Figma / Behance)!');
      return;
    }
    if (!checkOpen || !checkEditable || !checkRules) {
      alert('برجاء الموافقة وتفعيل الشروط الثلاثة الأساسية لتأكيد التسليم!');
      return;
    }

    setIsSubmittingProject(true);
    setSubmissionSuccessMsg(null);

    try {
      await saveGraduationProjectSubmission({
        projectId: graduationProject.id,
        groupId: studentGroup.id,
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        studentIdNum: currentStudent.studentIdNum || '',
        driveLink: submissionDriveLink.trim(),
        checkConfirmedOpen: checkOpen,
        checkUploadedEditableFiles: checkEditable,
        checkReadRules: checkRules,
        extraLinks: submissionExtraLinks.filter(l => l.title.trim() && l.url.trim()),
        unsubmittedReason: ''
      });

      setSubmissionSuccessMsg('تم تسليم مشروع التخرج بنجاح! 🚀 بالتوفيق يا مبدع');
      setTimeout(() => {
        setSubmissionSuccessMsg(null);
        setIsSubmissionModalOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting graduation project:', err);
      alert('حدث خطأ أثناء التسليم: ' + err.message);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // C. DYNAMIC STUDENT DASHBOARD (LOGGED IN EXPERIENCE!)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16" dir="rtl">
      {/* Premium Header Design */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/20">
              <span className="text-xl font-black text-white">S</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">SABER GROUP Portal</h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">لوحة متابعة المتدربين والتقييم الأكاديمي</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping animate-pulse"></div>
              <span className="text-slate-400 font-bold">المتدرب:</span>
              <span className="text-purple-400 font-black">{currentStudent.name}</span>
              <span className="text-slate-600 font-mono text-[9px] border-r border-slate-800 pr-2 mr-1">ID: #{currentStudent.studentIdNum}</span>
              {studentGroup && (
                <span className="text-blue-400 font-black border-r border-slate-800 pr-2 mr-1">الجروب: {studentGroup.name}</span>
              )}
            </div>

            {/* Notifications Indicator */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 w-9 h-9 rounded-xl flex items-center justify-center transition-all relative cursor-pointer"
                title="الإشعارات"
              >
                {isMuted ? <BellOff size={16} className="text-amber-500" /> : <Bell size={16} className="text-indigo-400" />}
                {!isMuted && notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-900 animate-bounce">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotifOpen && (
                <div className="absolute left-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden text-right font-arabic">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                    <button
                      onClick={() => {
                        const nextMute = !isMuted;
                        setIsMuted(nextMute);
                        localStorage.setItem(`muted_student_${currentStudent.id}`, String(nextMute));
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 cursor-pointer"
                    >
                      {isMuted ? 'تفعيل الصوت 🔊' : 'كتم الإشعارات 🔕'}
                    </button>
                    <h3 className="text-xs font-black text-white">الإشعارات والتنبيهات 🔔</h3>
                  </div>

                  <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-slate-800">
                    {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await Notification.requestPermission();
                            if (res === 'granted') {
                              alert('🎉 تم تفعيل إشعارات المتصفح بنجاح!');
                            }
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="w-full text-center bg-indigo-950/40 hover:bg-indigo-950/70 text-indigo-400 border-b border-indigo-900/30 font-bold text-[10px] py-3.5 px-4 transition-all flex items-center justify-center gap-1 cursor-pointer font-arabic"
                      >
                        🔔 تفعيل إشعارات المتصفح لتنبيهك عند بدء المحاضرات
                      </button>
                    )}

                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs font-semibold">
                        لا توجد إشعارات حالياً ☕
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={async () => {
                            if (!notif.read) {
                              await markNotificationRead(notif.id);
                            }
                            if (notif.link) {
                              window.location.href = notif.link;
                            }
                          }}
                          className={`p-3.5 hover:bg-slate-950/40 transition-all cursor-pointer text-right relative ${!notif.read ? 'bg-indigo-950/10 border-r-2 border-indigo-500' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[9px] text-slate-500 font-bold shrink-0 font-mono">
                              {notif.createdAt?.toDate ? formatTime12h(
                                notif.createdAt.toDate().toLocaleTimeString('en-US', { hour12: false })
                              ) : 'الآن'}
                            </span>
                            <h4 className="text-[11px] font-black text-slate-200">{notif.title}</h4>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold leading-relaxed mt-1">{notif.message}</p>
                          {!notif.read && (
                            <span className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="p-2.5 bg-slate-950/50 border-t border-slate-800 text-center">
                      <button
                        onClick={async () => {
                          const unread = notifications.filter(n => !n.read);
                          for (const n of unread) {
                            await markNotificationRead(n.id);
                          }
                          setIsNotifOpen(false);
                        }}
                        className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
                      >
                        تحديد الكل كمقروء ✔
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8 animate-fade-in">
        {/* ENROLLED GROUPS & COURSES SWITCHER BAR */}
        {enrolledGroups.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 font-arabic" dir="rtl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    الكورسات والمجموعات المسجل بها ({enrolledGroups.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    انقر على أي كورس/مجموعة للانتقال إليها واستعراض التفاصيل والتقارير
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-2 no-scrollbar">
              {enrolledGroups.map((g) => {
                const isArchived = g.archived || (g as any).isArchived || (g as any).status === 'archived';
                const isSelected = studentGroup?.id === g.id;

                return (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchGroup(g.id)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      isSelected
                        ? isArchived
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-lg ring-2 ring-amber-500/30'
                          : 'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border-purple-500 text-purple-200 shadow-lg ring-2 ring-purple-500/30'
                        : isArchived
                          ? 'bg-slate-950/80 border-slate-800/80 text-slate-400 hover:border-slate-700'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${isArchived ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    <div className="flex flex-col items-start text-right">
                      <span className="font-black text-xs">{g.name || g.batchCode || 'المجموعة'}</span>
                      <span className="text-[10px] opacity-75 font-normal">{g.courseName || 'الكورس التدريبي'}</span>
                    </div>
                    {isArchived ? (
                      <span className="mr-1 px-2 py-0.5 rounded-lg text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        أرشيف (قراءة فقط)
                      </span>
                    ) : (
                      <span className="mr-1 px-2 py-0.5 rounded-lg text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        نشط 🟢
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ARCHIVED GROUP READ-ONLY NOTICE BANNER */}
        {studentGroup && (studentGroup.archived || (studentGroup as any).isArchived || (studentGroup as any).status === 'archived') && (
          <div className="bg-amber-950/40 border-2 border-amber-500/40 rounded-3xl p-5 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl font-arabic" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-300 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    📁 كورس / مجموعة مؤرشفة
                  </span>
                  <h4 className="font-black text-amber-300 text-sm">وضع القراءة فقط (Read-Only)</h4>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  هذه المجموعة تم إنهاؤها وأرشفتها. يمكنك تصفح ومراجعة سجل المحاضرات والتقييمات والتكليفات وتسجيلات الفيديو بكل دقة، ولكن إجراءات التسجيل المباشر متوقفة.
                </p>
              </div>
            </div>
            {enrolledGroups.filter(g => !g.archived && !(g as any).isArchived && (g as any).status !== 'archived').length > 0 && (
              <button
                onClick={() => {
                  const activeG = enrolledGroups.find(g => !g.archived && !(g as any).isArchived && (g as any).status !== 'archived');
                  if (activeG) handleSwitchGroup(activeG.id);
                }}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer transition-all shadow-md flex items-center gap-1.5"
              >
                <span>الانتقال للمجموعة النشطة</span>
                <span>➔</span>
              </button>
            )}
          </div>
        )}
        {/* ACTIVE GLOBAL EVALUATION FORMS NOTIFICATION BANNER */}
        {activeGlobalForms.length > 0 && (
          <div className="bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-slate-900 border-2 border-purple-500/40 rounded-4xl p-6 shadow-2xl space-y-4 text-right animate-pulse-border" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="bg-purple-500/20 text-purple-300 font-extrabold text-[10px] px-3 py-1 rounded-full border border-purple-500/30 uppercase tracking-widest flex items-center gap-1.5 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  استمارة تقييم شاملة متاحة الآن 📝
                </span>
                <h3 className="text-xl font-black text-white">{activeGlobalForms[0].title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  {activeGlobalForms[0].description || 'يرجى تسجيل تقييمك الشامل لهذه الفترة لمساعدتنا في تحسين جودة المحاضرات والخدمات وتكريم المدربين المتميزين.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedGlobalForm(activeGlobalForms[0]);
                  setEvaluatingGroup(studentGroup);
                  const url = new URL(window.location.href);
                  url.searchParams.set('feedback', 'true');
                  url.searchParams.set('globalEvalId', activeGlobalForms[0].id);
                  if (studentGroup?.id) url.searchParams.set('groupId', studentGroup.id);
                  window.location.href = url.toString();
                }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-6 py-3.5 rounded-2xl shadow-xl shadow-purple-600/30 flex items-center gap-2 text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                تعبئة فورم التقييم الشامل الآن ➔
              </button>
            </div>
          </div>
        )}
        {/* CERTIFICATE CARD FOR STUDENT */}
        {studentGroup && studentGroup.certificatesVisibleToStudents && (() => {
          // 1. Attendance %
          const totalSessionsDone = sessions.filter(s => s.status === 'done').length;
          const uniqueAttendedSessions = new Set(
            evaluations.filter(e => e.attendance === 1 && e.sessionNumber !== undefined).map(e => e.sessionNumber)
          );
          const attendedCount = Math.min(uniqueAttendedSessions.size, totalSessionsDone);
          const attendanceRate = totalSessionsDone > 0 ? Math.min(100, Math.round((attendedCount / totalSessionsDone) * 100)) : 100;

          // 2. Tasks %
          const totalRequiredTasks = sessions.filter(s => s.status === 'done').reduce((sum, ses) => sum + (ses.requiredTasksCount || 0), 0);
          const totalCompletedTasks = evaluations.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
          const tasksRate = totalRequiredTasks > 0 ? Math.min(100, Math.round((totalCompletedTasks / totalRequiredTasks) * 100)) : 100;

          // 3. Projects Submitted %
          const totalGradProjectsCount = allGroupGradProjects.length;
          const studentSubmittedProjectsCount = allStudentGradSubmissions.length;
          const projectsRate = totalGradProjectsCount > 0 ? Math.round((studentSubmittedProjectsCount / totalGradProjectsCount) * 100) : 100;

          const isAttendanceEligible = attendanceRate >= 80;
          const isTasksEligible = tasksRate >= 80;
          const isProjectsEligible = totalGradProjectsCount === 0 || (studentSubmittedProjectsCount / totalGradProjectsCount) >= 0.5;

          const isAutoEligible = isAttendanceEligible && isTasksEligible && isProjectsEligible;

          const missingReasons: string[] = [];
          if (!isAttendanceEligible) missingReasons.push(`نسبة الحضور: ${attendanceRate}% (المطلوب 80% على الأقل)`);
          if (!isTasksEligible) missingReasons.push(`نسبة أداء التاسكات: ${tasksRate}% (المطلوب 80% على الأقل)`);
          if (!isProjectsEligible) missingReasons.push(`تسليم مشاريع التخرج: ${studentSubmittedProjectsCount}/${totalGradProjectsCount} (المطلوب 50% على الأقل)`);

          const rec = studentCertificateRecord;
          let isEligible = false;
          let certStatusType: 'auto_eligible' | 'exception_eligible' | 'blocked' | 'ineligible' = 'ineligible';

          if (rec?.statusOverride === 'blocked') {
            isEligible = false;
            certStatusType = 'blocked';
          } else if (rec?.statusOverride === 'exception_granted') {
            isEligible = true;
            certStatusType = 'exception_eligible';
          } else if (isAutoEligible) {
            isEligible = true;
            certStatusType = 'auto_eligible';
          } else {
            isEligible = false;
            certStatusType = 'ineligible';
          }

          return (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-indigo-500/40 rounded-4xl p-6 sm:p-8 shadow-2xl relative overflow-hidden font-arabic text-right space-y-6" dir="rtl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <span className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl text-2xl border border-indigo-500/30">📜</span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">شهادة تخرج الكورس - SABER GROUP</h2>
                  <p className="text-xs text-slate-400">حالة الأهلية ورابط شهادة إتمام الدورة التدريبية</p>
                </div>
              </div>

              {isEligible ? (
                <div className="space-y-4">
                  <div className="p-5 bg-emerald-500/15 border border-emerald-500/40 rounded-3xl text-emerald-300 space-y-2">
                    <div className="text-lg font-black text-emerald-400 flex items-center gap-2">
                      <Sparkles size={22} />
                      <span>🎉 ألف مبروك يا مبدع! أنت مؤهل للحصول على شهادة تخرج الكورس</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      تسر إدارة SABER GROUP توجيه التهنئة لك على التزامك وأدائك المتميز طوال فترة الكورس.
                    </p>
                    {rec?.overrideReason && certStatusType === 'exception_eligible' && (
                      <p className="text-xs font-bold text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                        🌟 ملاحظة الاستثناء: {rec.overrideReason}
                      </p>
                    )}
                  </div>

                  {/* Certificate Download/View button */}
                  {rec?.certificateUrl ? (
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-black text-white block">رابط شهادة التخرج الرسمية جاهز للتحميل:</span>
                        <span className="text-[11px] text-slate-400 block">يمكنك استعراض وتحميل شهادتك بدقة عالية عبر الرابط التالي</span>
                      </div>
                      <a
                        href={rec.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2 cursor-pointer shrink-0"
                      >
                        <ExternalLink size={16} />
                        <span>تحميل / عرض شهادة التخرج 📜</span>
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 text-center font-bold">
                      ⏳ تم توثيق أهليتك للشهادة وجاري رفع ورصد رابط الشهادة من قِبل فريق الأكاديمية. يرجى إعادة التحقق قريباً!
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-rose-500/15 border border-rose-500/40 rounded-3xl text-rose-300 space-y-3">
                  <div className="text-base font-black text-rose-400 flex items-center gap-2">
                    <XCircle size={20} />
                    <span>عذراً، أنت غير مؤهل للحصول على شهادة الكورس حالياً ❌</span>
                  </div>
                  
                  <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
                    <p className="font-bold text-rose-200">الشروط المطلوبة للشهادة: (80% حضور، 80% أداء تاسكات، و 50% مشاريع تخرج).</p>
                    
                    {certStatusType === 'blocked' && (
                      <p className="font-bold text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                        ⚠️ سبب عدم الأهلية: {rec?.overrideReason || 'تم توقيف الشهادة بقرار إداري من قِبل المحاضر/المشرف.'}
                      </p>
                    )}

                    {certStatusType === 'ineligible' && missingReasons.length > 0 && (
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5 mt-2">
                        <span className="font-black text-rose-400 block">أسباب عدم استيفاء الشروط:</span>
                        {missingReasons.map((reason, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-rose-200 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {rec?.uneligibilityReason && (
                      <p className="text-xs font-bold text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        توضيح الإدارة: {rec.uneligibilityReason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* GRADUATION PROJECT CARD FOR STUDENT */}
        {graduationProject && graduationProject.status !== 'draft' && (() => {
          const projStartDate = graduationProject.startDate || (graduationProject as any).submissionStartDate || '';
          const projEndDate = graduationProject.endDate || (graduationProject as any).submissionEndDate || '';
          const projTelegramLink = graduationProject.telegramChannelLink || (graduationProject as any).telegramChannelUrl || '';
          const projVideoLink = graduationProject.submissionGuideVideoLink || (graduationProject as any).explanationVideoUrl || '';
          const projRequirements = graduationProject.requirements || (graduationProject as any).deliverablesRequired || '';
          const projRules = graduationProject.rules || (Array.isArray((graduationProject as any).mandatoryRules) ? (graduationProject as any).mandatoryRules.join('\n') : ((graduationProject as any).mandatoryRules || ''));
          const projExtraLinks = graduationProject.extraLinks || [];

          const now = new Date();
          const startDT = projStartDate ? new Date(projStartDate) : null;
          const endDT = projEndDate ? new Date(projEndDate) : null;

          const isPastDeadline = endDT ? now > endDT : false;
          const isBeforeStart = startDT ? now < startDT : false;

          return (
            <div className="bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-900 border-2 border-purple-500/30 rounded-4xl p-6 sm:p-8 shadow-2xl relative overflow-hidden font-arabic text-right space-y-6" dir="rtl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
              
              {/* Header section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-purple-500/20 text-purple-300 font-black text-xs px-3 py-1 rounded-full border border-purple-500/30 flex items-center gap-1.5">
                      🎓 مشروع التخرج النهائي (Final Graduation Project)
                    </span>
                    {graduationProject.brandName && (
                      <span className="bg-amber-500/20 text-amber-300 font-bold text-xs px-3 py-1 rounded-full border border-amber-500/30">
                        البراند المستهدف: {graduationProject.brandName}
                      </span>
                    )}
                    {graduationSubmission ? (
                      <span className="bg-emerald-500/20 text-emerald-400 font-black text-xs px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle size={14} /> تم التسليم 🟢
                      </span>
                    ) : isPastDeadline ? (
                      <span className="bg-rose-500/20 text-rose-300 font-black text-xs px-3 py-1 rounded-full border border-rose-500/30 flex items-center gap-1">
                        <XCircle size={14} /> التسليم مغلق (انتهى الديدلاين) 🔴
                      </span>
                    ) : isBeforeStart ? (
                      <span className="bg-sky-500/20 text-sky-300 font-black text-xs px-3 py-1 rounded-full border border-sky-500/30 flex items-center gap-1">
                        <Clock size={14} /> بانتظار موعد البدء ⏳
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 font-black text-xs px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={14} /> بانتظار التسليم (مفتوح حالياً) 🟡
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                    {graduationProject.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsProjectDetailsModalOpen(true)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <BookOpen size={15} />
                    <span>تفاصيل وقواعد المشروع 📜</span>
                  </button>

                  {projTelegramLink && (
                    <a
                      href={projTelegramLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 font-black text-xs rounded-xl border border-sky-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Send size={15} />
                      <span>قناة التليجرام 📢</span>
                    </a>
                  )}

                  {projVideoLink && (
                    <a
                      href={projVideoLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-black text-xs rounded-xl border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Video size={15} />
                      <span>فيديو الشرح والتسليم 🎥</span>
                    </a>
                  )}
                </div>
              </div>

              {/* DATES & DEADLINE STATUS CARD */}
              <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3 relative z-10">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-purple-400" />
                    <span className="text-xs font-black text-slate-200">مواعيد ومسار تسليم مشروع التخرج:</span>
                  </div>
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1 bg-rose-950/40 px-3 py-1 rounded-lg border border-rose-900/50">
                    <AlertTriangle size={13} />
                    <span>تنبيه: التسليم مغلق تماماً بعد انتهاء الموعد المحدد (الديدلاين)!</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center">
                    <span className="text-slate-400 font-bold">🗓️ تاريخ ووقت بدء التسليم:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {projStartDate ? projStartDate.replace('T', ' ') : 'متاح فوراً'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center">
                    <span className="text-slate-400 font-bold">⏰ موعد نهاية التسليم (الديدلاين):</span>
                    <span className="font-mono font-black text-rose-400">
                      {projEndDate ? projEndDate.replace('T', ' ') : 'غير محدد'}
                    </span>
                  </div>
                </div>

                {isPastDeadline && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-black flex items-center gap-2">
                    <XCircle size={16} className="shrink-0" />
                    <span>انتهى الموعد النهائي المحدد للتسليم (الديدلاين). تم إغلاق استقبال أي تسليمات بعد الموعد.</span>
                  </div>
                )}
                {isBeforeStart && (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-300 font-black flex items-center gap-2">
                    <Clock size={16} className="shrink-0" />
                    <span>لم يبدأ الموعد المخصص للتسليم بعد. سيفُتح التقديم في تاريخ البدء الموضح أعلاه.</span>
                  </div>
                )}
              </div>

              {/* CONCEPT / DESCRIPTION */}
              {graduationProject.description && (
                <div className="space-y-1.5 relative z-10">
                  <h4 className="text-xs font-black text-purple-400 flex items-center gap-1.5">
                    <BookOpen size={15} />
                    <span>فكرة ومفهوم المشروع:</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800 whitespace-pre-line">
                    {graduationProject.description}
                  </p>
                </div>
              )}

              {/* DELIVERABLES REQUIRED */}
              {projRequirements && (
                <div className="space-y-1.5 relative z-10">
                  <h4 className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle size={15} />
                    <span>المطلوب تسليمه من المتدرب (تسليمات المشروع):</span>
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/20 whitespace-pre-line">
                    {projRequirements}
                  </p>
                </div>
              )}

              {/* MANDATORY RULES */}
              {projRules && (
                <div className="space-y-2 relative z-10">
                  <h4 className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    <span>القواعد والتعليمات الأساسية التي لا يجب الخروج عنها:</span>
                  </h4>
                  <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-2xl space-y-1.5">
                    {projRules.split('\n').filter(r => r.trim()).map((rule, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-rose-200">
                        <span className="font-bold text-rose-400">{idx + 1}.</span>
                        <span className="leading-relaxed">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EXTRA LINKS FROM TRAINER */}
              {projExtraLinks.length > 0 && (
                <div className="space-y-2 relative z-10 pt-1">
                  <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <LinkIcon size={15} />
                    <span>الروابط والمصادر الإضافية للمشروع:</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {projExtraLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} />
                        <span>{link.title || link.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* STATUS & ACTION BANNER */}
              <div className="bg-slate-950/80 p-5 sm:p-6 rounded-3xl border border-slate-800 relative z-10 space-y-4">
                {graduationEvaluation ? (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-xs text-emerald-400 font-black uppercase tracking-wider block">
                        🎉 تم تقييم مشروع التخرج الخاص بك من قِبل المحاضر!
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-white">
                          الدرجة الإجمالية: <span className="text-emerald-400">{graduationEvaluation.totalScore}</span> / {graduationProject.criteria?.reduce((s, c) => s + c.maxScore, 0) || 100}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsProjectEvalViewModalOpen(true)}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Award size={16} />
                      <span>عرض تفاصيل التقييم وملاحظات الديزاين 📊</span>
                    </button>
                  </div>
                ) : graduationSubmission ? (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-purple-950/30 border border-purple-500/30 p-4 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-xs text-purple-400 font-black block">
                        ✅ تم استلام رابط المشروع بنجاح، وفي انتظار التقييم من قِبل المحاضر.
                      </span>
                      <p className="text-xs text-slate-300 font-mono overflow-hidden text-ellipsis max-w-xl">
                        الرابط المُسلم: <a href={graduationSubmission.driveLink} target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold">{graduationSubmission.driveLink}</a>
                      </p>
                    </div>
                    {!isPastDeadline && (
                      <button
                        type="button"
                        onClick={() => setIsSubmissionModalOpen(true)}
                        className="px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-black text-xs rounded-xl border border-purple-500/40 transition-all cursor-pointer"
                      >
                        تعديل بيانات التسليم ✏️
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-950/20 border border-amber-500/30 p-4 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-xs text-amber-300 font-black block">
                        {isPastDeadline ? '⛔ انتهى موعد التسليم لمشروع التخرج!' : '⚠️ لم تقم بتسليم مشروع التخرج بعد!'}
                      </span>
                      <p className="text-xs text-slate-400">
                        {isPastDeadline
                          ? 'نأسف، لقد انتهت المهلة المحددة للتسليم من قِبل المدرب. لا يمكن تقديم أي تسليمات جديدة حالياً.'
                          : 'يرجى قراءة القواعد والمطلوب بعناية ثم تسليم رابط مجلد Google Drive / Figma الخاص بمشروعك قبل انتهاء المهلة.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isPastDeadline || isBeforeStart}
                      onClick={() => setIsSubmissionModalOpen(true)}
                      className={`px-6 py-3 font-black text-xs rounded-2xl shadow-xl transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                        isPastDeadline
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : isBeforeStart
                          ? 'bg-slate-800 text-sky-400 border border-sky-900 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
                      }`}
                    >
                      <Send size={15} />
                      <span>
                        {isPastDeadline
                          ? 'التسليم مغلق (انتهى الديدلاين) 🔴'
                          : isBeforeStart
                          ? 'لم يبدأ وقت التسليم بعد ⏳'
                          : 'تسليم مشروع التخرج الآن 🚀'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* NEXT SESSION SECTION (المحاضرة القادمة) */}
        {nextSession && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 rounded-4xl border border-indigo-500/20 shadow-2xl relative overflow-hidden font-arabic text-right" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              <div className="space-y-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/10 text-indigo-400 text-xs font-black px-3 py-1 rounded-full border border-indigo-500/20 uppercase tracking-wider">
                    المحاضرة القادمة (Next Session) 🗓️
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  المحاضرة رقم {nextSession.sessionNumber}: {nextSession.lectureTitle || `المحاضرة #${nextSession.sessionNumber}`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-bold block mb-0.5">التاريخ:</span>
                    <span className="font-mono font-bold text-slate-200">{nextSession.date || 'غير محدد'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-bold block mb-0.5">الوقت:</span>
                    <span className="font-bold text-purple-400">{studentGroup?.sessionTime ? formatTime12h(studentGroup.sessionTime) : 'غير محدد'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-bold block mb-0.5">المدرب:</span>
                    <span className="font-bold text-indigo-300">{trainerName}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
                {/* Join Google Meet Button - Visible ONLY to students in the group */}
                {currentStudent && currentStudent.groupId === studentGroup?.id && (
                  nextSession.googleMeetUrl || nextSession.meetingLink ? (
                    (() => {
                      const isNextSessionAttended = evaluations.some(e => e.sessionNumber === nextSession.sessionNumber && e.attendance === 1);
                      return (
                        <button
                          type="button"
                          onClick={() => handleJoinLiveMeeting(nextSession, nextSession.googleMeetUrl || nextSession.meetingLink || '')}
                          className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
                        >
                          <Video size={16} />
                          <span>الانضمام للمحاضرة 💻</span>
                          <ExternalLink size={14} />
                        </button>
                      );
                    })()
                  ) : (
                    <div className="px-4 py-3 bg-slate-950 border border-slate-800 text-slate-500 font-bold text-xs rounded-2xl text-center">
                      في انتظار إضافة رابط الاجتماع من المدرب
                    </div>
                  )
                )}

                {/* Add To Calendar Button */}
                {nextCalendarUrl && (
                  <a
                    href={nextCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                  >
                    <Calendar size={16} />
                    <span>Add To Calendar</span>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          </div>
        )}
        {/* POSTPONEMENT NOTIFICATIONS */}
        {activePostponements && (
          <div className="space-y-4 font-arabic text-right">
            {activePostponements.startPostponed && (
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/20 p-5 rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 justify-between">
                  <div className="w-full sm:w-auto text-center sm:text-right space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-[10px] uppercase">
                      تأجيل ميعاد البداية ⏰
                    </span>
                    <h4 className="text-sm font-black text-white pt-1">
                      تم تأجيل موعد بدء المحاضرة رقم {activePostponements.startPostponed.sessionNumber}
                    </h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed">
                      أبلغنا المحاضر للتو بتأجيل بداية المحاضرة بمقدار <span className="text-amber-400 font-extrabold">{activePostponements.startPostponed.startPostponeMinutes} دقيقة</span>. ستبدأ المحاضرة رسمياً في تمام الساعة: <span className="font-mono text-white bg-amber-900/40 px-2 py-0.5 rounded font-black">{activePostponements.startPostponed.startPostponeNewTime}</span>. يرجى التجهيز في الموعد الجديد!
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 text-xl">
                    ⏳
                  </div>
                </div>
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-600/10 blur-3xl rounded-full"></div>
              </div>
            )}

            {activePostponements.generalPostponed && (
              <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-5 rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 justify-between">
                  <div className="w-full sm:w-auto text-center sm:text-right space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold text-[10px] uppercase">
                      تأجيل المحاضرة بالكامل 📅
                    </span>
                    <h4 className="text-sm font-black text-white pt-1">
                      تنبيه هام: تأجيل المحاضرة رقم {activePostponements.generalPostponed.sessionNumber}
                    </h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed">
                      نحيطكم علماً بأنه قد تم تأجيل عقد المحاضرة رقم {activePostponements.generalPostponed.sessionNumber} إلى يوم: <span className="text-indigo-400 font-extrabold">{activePostponements.generalPostponed.generalPostponeDate}</span>. برجاء مراجعة جروب الواتساب الخاص بالدفعة لمتابعة كافة التفاصيل الهامة.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 text-xl">
                    📢
                  </div>
                </div>
                <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-600/10 blur-3xl rounded-full"></div>
              </div>
            )}
          </div>
        )}

        {/* LIVE MEETING BROADCAST MODULE */}
        {liveSessionState && (
          <div className={`p-6 rounded-4xl border transition-all duration-300 relative overflow-hidden shadow-xl font-arabic text-right ${
            liveSessionState.isStarted 
              ? 'bg-gradient-to-r from-red-950/40 via-purple-950/40 to-slate-900 border-red-500/20 shadow-red-900/10' 
              : liveSessionState.isEndedRecently
              ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-slate-800 shadow-xl'
              : 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/15 shadow-amber-900/5'
          }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 text-center md:text-right w-full md:w-auto">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  {liveSessionState.isStarted ? (
                    <>
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                      <span className="text-red-400 text-xs font-black uppercase tracking-widest">بث مباشر جاري الآن 🔴</span>
                    </>
                  ) : liveSessionState.isEndedRecently ? (
                    <>
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                      </span>
                      <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">انتهت المحاضرة الجارية 🏁</span>
                    </>
                  ) : (
                    <>
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      <span className="text-amber-400 text-xs font-black uppercase tracking-widest">المحاضرة على وشك البدء ⏳</span>
                    </>
                  )}
                </div>
                <h3 className="text-lg font-black text-white">
                  المحاضرة رقم {liveSessionState.session.sessionNumber}:{' '}
                  <span className="text-purple-300">
                    {liveSessionState.session.lectureTitle || 'عنوان المحاضرة غير محدد بعد'}
                  </span>
                </h3>
                <p className="text-slate-400 text-xs font-bold leading-relaxed max-w-2xl font-arabic">
                  {liveSessionState.isStarted
                    ? (liveSessionState.session.isOffline
                        ? 'المحاضرة بدأت حالياً وهي جارية حضورياً في مقر الشركة (أوفلاين). يرجى التواجد والمشاركة الفعالة بمكتب الشركة.'
                        : 'المحاضرة بدأت حالياً على الهواء مباشرة. انقر على الزر للمشاركة والإنصات لشرح المدرب والتطبيقات العملية.')
                    : liveSessionState.isEndedRecently
                    ? 'لقد انتهت هذه المحاضرة قبل قليل. سيقوم المحاضر برفع تسجيل المحاضرة والتاسكات المطلوبة قريباً، نراكم في المحاضرات القادمة بالتوفيق لكم جميعاً!'
                    : 'حان الآن توقيت المحاضرة المجدول، ولكن المحاضر لم يطلق البث الفعلي للاجتماع بعد. يرجى الانتظار وتحديث الصفحة حتى يظهر رابط الدخول.'}
                </p>

                {/* Join live session button */}
              </div>

              {liveSessionState.isStarted && (
                <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 self-stretch md:self-auto min-w-[245px]">
                  {liveSessionState.session.isOffline ? (
                    <div className="relative overflow-hidden w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black text-sm sm:text-base py-4 px-8 rounded-2xl flex items-center justify-center gap-3 font-arabic border border-amber-500/30 text-center ring-4 ring-amber-500/20 shadow-xl shadow-amber-600/10">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                      </span>
                      <span>محاضرة بمقر الشركة 🏢</span>
                    </div>
                  ) : sanitizedMeetingLink ? (
                    <button
                      type="button"
                      onClick={() => handleJoinLiveMeeting(liveSessionState.session, sanitizedMeetingLink)}
                      className="relative overflow-hidden w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base py-4 px-8 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 hover:scale-[1.03] active:scale-95 duration-150 font-arabic border border-emerald-400/30 text-center ring-4 ring-emerald-500/20 animate-pulse cursor-pointer"
                    >
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                      </span>
                      <span>الانضمام الآن للمحاضرة 💻</span>
                      <ExternalLink size={18} className="translate-y-[1px]" />
                    </button>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 text-slate-500 font-extrabold text-[11px] py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-arabic text-center">
                      <span>في انتظار إضافة رابط الاجتماع من قِبل المُدرب... 🌐</span>
                    </div>
                  )}
                </div>
              )}
              {liveSessionState.isEndedRecently && (
                <div className="bg-slate-900 border border-slate-800 text-slate-400 font-extrabold text-[10px] py-3 px-5 rounded-2xl flex items-center gap-2 shrink-0 self-center md:self-auto font-arabic">
                  <span>🏁 انتهت المحاضرة للتّو</span>
                </div>
              )}
              {!liveSessionState.isStarted && !liveSessionState.isEndedRecently && (
                <div className="bg-slate-950/70 border border-slate-800 text-slate-400 font-extrabold text-[10px] py-3 px-5 rounded-2xl flex items-center gap-2 shrink-0 self-center md:self-auto font-arabic">
                  <span>في انتظار إشارة البدء من المحاضر...</span>
                </div>
              )}
            </div>
            
            {/* Ambient background glows */}
            <div className={`absolute top-0 left-0 w-44 h-44 blur-[80px] rounded-full translate-x-1/2 translate-y-1/2 opacity-30 ${
              liveSessionState.isStarted ? 'bg-red-600' : liveSessionState.isEndedRecently ? 'bg-slate-700' : 'bg-amber-600'
            }`}></div>
          </div>
        )}

        {/* Banner with Motivation */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/30 p-6 sm:p-8 rounded-4xl border border-purple-500/15 relative overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 relative z-10 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-start gap-2 text-purple-400 text-xs font-black">
              <Sparkles size={14} />
              <span>مرحبا بك مجددا يا بطل</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">مسارك التعليمي الحالي</h1>
            <p className="text-slate-400 font-bold text-sm max-w-xl leading-relaxed">
              نحن هنا لمتابعة تطورك الأكاديمي أولاً بأول ومساعدتك على حصد المزيد من النقاط والتفوق في مجال دراستك. التزامك هو وقود نجاحك!
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-black text-xs py-3.5 px-6 rounded-2xl transition-all shadow-xl flex items-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer font-arabic"
            >
              <UserIcon size={14} />
              بياناتي الشخصية (تعديل رقم الهواتف/الواتس)
            </button>
            <button
              onClick={downloadStudentReport}
              disabled={downloadingReport}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs py-3.5 px-6 rounded-2xl uppercase tracking-widest transition-all shadow-xl shadow-purple-600/25 flex items-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {downloadingReport ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                  جاري تجهيز تقرير المهام...
                </>
              ) : (
                <>
                  <Download size={14} />
                  تحميل تقرير المهام المتأخرة (Missing Tasks)
                </>
              )}
            </button>
          </div>

          <div className="absolute top-0 left-0 w-80 h-80 bg-purple-600/10 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2"></div>
        </div>

        {/* Task Submission Banner (Submit task here!) */}
        <div className="bg-gradient-to-r from-sky-950/60 to-blue-950/40 p-6 sm:p-8 rounded-4xl border border-sky-500/20 relative overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 font-arabic text-right" dir="rtl">
          <div className="space-y-3 relative z-10 text-right">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-black">
              <span className="text-base">📮</span>
              <span>تسليم وتصحيح التاسكات (خطة المتابعة الفردية)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">بوابة تسليم التاسكات الخاصة بك 🚀</h2>
            <p className="text-slate-400 font-bold text-xs sm:text-sm max-w-xl leading-relaxed">
              هنا يمكنك تسليم التاسكات والواجبات المطلوبة منك مباشرة في التوبيك المخصص لك على جروب التليجرام لمراجعتها وتصحيحها ومتابعتها مع المدرب وفريق الدعم الفني خطوة بخطوة.
            </p>
          </div>

          <div className="relative z-10 w-full md:w-auto shrink-0">
            {currentStudent.tasksLink ? (
              <a
                href={currentStudent.tasksLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-sky-500/15 transition-all hover:scale-[1.03] active:scale-95 text-center cursor-pointer animate-pulse"
                style={{ animationDuration: '3s' }}
              >
                <span>📬 سلم التاسك من هنا</span>
                <ExternalLink size={16} />
              </a>
            ) : (
              <div className="bg-slate-900/95 border border-slate-800 text-slate-400 font-black text-xs py-4 px-6 rounded-2xl flex flex-col gap-1 text-center max-w-[280px] mx-auto md:mx-0">
                <span className="text-amber-400">⏳ في انتظار لينك التاسكات</span>
                <span className="text-[10px] text-slate-500 font-medium">سيقوم المدرب بتعيين التوبيك المخصص لك قريباً لتسليم مهامك من هنا مباشرة!</span>
              </div>
            )}
          </div>

          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 blur-[80px] rounded-full translate-x-1/3 -translate-y-1/3"></div>
        </div>

        {/* Essential Links Section (Telegram & WhatsApp with detailed explanation) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Telegram Block */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="bg-blue-500/10 text-blue-400 p-3 rounded-2.5xl border border-blue-500/20">
                  <Send size={24} />
                </div>
                <span className="text-[9px] font-black bg-blue-950 text-blue-400 px-3 py-1 rounded-full border border-blue-900/50">تنبيهات فورية للمتدربين</span>
              </div>
              <h3 className="text-lg font-black text-white">قناة التليجرام الأكاديمية للمجموعة</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                هذه القناة مخصصة لنشر الإعلانات الأكاديمية الهامة، وتعديل المواعيد إن وُجدت، ومتابعة تحديث المطلوبات لكل سيشن، إلى جانب النصائح التعليمية الفورية. يرجى تفعيل التنبيهات دائماً!
              </p>
            </div>
            
            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
              {studentGroup?.telegramLink ? (
                <a 
                  href={studentGroup.telegramLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  انضم إلى قناة التليجرام <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-slate-500 text-xs font-bold italic">
                  قناة التليجرام الخاصة بمجموعتك سيقوم المدرب برفع رابطها قريباً.
                </div>
              )}
              {studentGroup?.telegramLink && (
                <button 
                  onClick={() => handleCopyLink(studentGroup.telegramLink!, 'telegram')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                >
                  {copiedLink === 'telegram' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* WhatsApp Block */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2.5xl border border-emerald-500/20">
                  <MessageSquare size={24} />
                </div>
                <span className="text-[9px] font-black bg-emerald-950 text-emerald-400 px-3 py-1 rounded-full border border-emerald-900/50">تواصل مباشر وتكنيكال سيبورت</span>
              </div>
              <h3 className="text-lg font-black text-white">جروب الواتس آب التفاعلي</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                جروب تفاعلي مغلق لطلاب ومحاضري المجموعة، يتم فيه تبادل المناقشات المباشرة، وحل البجات والأخطاء التكنيكال التي تواجهكم في الأكواد والتاسكات، والتنسيق وتلقي المساعدة من منسق المجموعة والـ Support Team.
              </p>
            </div>
            
            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
              {studentGroup?.whatsappLink ? (
                <a 
                  href={studentGroup.whatsappLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  دخول جروب الواتس آب <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-slate-500 text-xs font-bold italic">
                  جروب الواتس آب الخاص بمجموعتك سيقوم المدرب برفع رابطه قريباً.
                </div>
              )}
              {studentGroup?.whatsappLink && (
                <button 
                  onClick={() => handleCopyLink(studentGroup.whatsappLink!, 'whatsapp')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                >
                  {copiedLink === 'whatsapp' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* Telegram Records Block */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="bg-red-500/10 text-red-400 p-3 rounded-2.5xl border border-red-500/20">
                  <Video size={24} />
                </div>
                <span className="text-[9px] font-black bg-red-950 text-red-400 px-3 py-1 rounded-full border border-red-900/50">تسجيلات ريكوردات المحاضرات</span>
              </div>
              <h3 className="text-lg font-black text-white">قناة ريكوردات المحاضرات</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                هذه القناة مخصصة لرفع وتسجيل المحاضرات الأسبوعية والمسجلة مباشرة عقب انتهائها. ستتمكن من مراجعة كل سيشن والوصول إلى الفيديوهات التعليمية المخصصة لمجموعتك في أي وقت للرجوع إليها والاستذكار.
              </p>
            </div>
            
            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
              {studentGroup?.telegramRecordsLink ? (
                <a 
                  href={studentGroup.telegramRecordsLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  فتح قناة الريكوردات <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-slate-500 text-xs font-bold italic">
                  قناة ريكوردات المحاضرات لم يتم رفع رابطها بعد من قبل المدرب.
                </div>
              )}
              {studentGroup?.telegramRecordsLink && (
                <button 
                  onClick={() => handleCopyLink(studentGroup.telegramRecordsLink!, 'telegramRecords')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                >
                  {copiedLink === 'telegramRecords' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* METRICS & OVERALL PERFORMANCE (نقاطه وحضوره وغيابه وهكذا) */}
        <section className="space-y-4">
          <h3 className="text-lg font-black text-white pr-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <span>نظرة عامة على تقييم أداء المتدرب</span>
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Points */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center space-y-2 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                <Award size={20} />
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">مجموع النقاط المحرزة</h4>
              <p className="text-3xl font-black text-white font-mono">{metrics.totalPoints} <span className="text-xs text-purple-400">نقطة</span></p>
              <div className="text-[9px] font-bold text-slate-500">من التقييم المستمر للواجبات والتفاعل</div>
            </div>

            {/* Attendance Rate */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center space-y-2 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle size={20} />
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">نسبة حضور المحاضرات</h4>
              <p className="text-3xl font-black text-white font-mono">{metrics.attendanceRate}%</p>
              <div className="text-[9px] font-bold text-slate-500">تم حضور {metrics.attendanceCount} من أصل {metrics.totalSessionsTaken} سيشن مأخوذة</div>
            </div>

            {/* Total Absent */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center space-y-2 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
                <Calendar size={20} />
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">عدد مرات الغياب</h4>
              <p className="text-3xl font-black text-white font-mono">{Math.max(0, metrics.totalSessionsTaken - metrics.attendanceCount)} <span className="text-xs text-red-400">محاضرات</span></p>
              <div className="text-[9px] font-bold text-slate-500">حاول تجنّب الغياب للحفاظ على نقاطك</div>
            </div>

            {/* Penalties Total */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center space-y-2 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <AlertTriangle size={20} />
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">إجمالي الخصومات</h4>
              <p className="text-3xl font-black text-white font-mono">{metrics.penaltyPoints} <span className="text-xs text-amber-400">نقاط خصم</span></p>
              <div className="text-[9px] font-bold text-slate-500">بسبب تسليم تاسكات متأخرة أو غياب بدون اعتذار</div>
            </div>
          </div>
        </section>

        {/* Group Timeline Tracker && Schedule Details */}
        <section className="bg-slate-900/40 p-6 rounded-4xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-lg font-black text-white">الخطة الجدولية للمجموعة ومعدل الإنجاز</h3>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">
              المجموعة مسجلة في كورس <span className="text-purple-400 font-extrabold">{studentGroup?.courseName}</span> مع بداية الكورس تم إسناد الخطة بـ <span className="text-slate-200 font-bold">{metrics.totalSessions} محاضرة</span>.
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                <span>المحاضرات المنقولة مسبقاً ({metrics.totalSessionsTaken} سيشن)</span>
                <span>باقي للمجموعة ({metrics.remainingSessions} سيشن)</span>
              </div>
              {/* Modern elegant progress bar */}
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, Math.min(100, (metrics.totalSessionsTaken / (metrics.totalSessions || 1)) * 100))}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-3.5 text-right shadow-inner">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">مواعيد جدول المحاضرات الأسبوعي</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-500">أيام الانعقاد:</span>
                <span className="text-slate-300 font-bold">{studentGroup?.daysOfWeek?.join(', ') || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-500">التوقيت الأسبوعي:</span>
                <span className="text-purple-400 font-black">{studentGroup?.sessionTime ? formatTime12h(studentGroup.sessionTime) : '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">تاريخ بدء المنحة:</span>
                <span className="text-slate-300 font-bold">{studentGroup?.startDate || '-'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* LECTURE RECORDINGS & TASK ASSIGNMENTS BREAKDOWN (لينكات المحاضرات اللي اتاخدت بالفعل ولينكات التاسكات) */}
        <section className="space-y-4">
          <h3 className="text-lg font-black text-white pr-1 flex items-center gap-2">
            <BookOpen size={18} className="text-purple-400" />
            <span>تسجيلات المحاضرات والتاسكات المطلوبة لكل محاضرة</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LECTURES LIST WITH RECORDINGS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-4xl space-y-4">
              <h4 className="font-black text-white text-md border-b border-slate-800 pb-3">لينكات المحاضرات المسجلة بالفعل</h4>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {sessions.filter(s => s.status === 'done' && !s.isPostponed).length === 0 ? (
                  <p className="text-slate-500 italic text-xs text-center py-12">لم يتم رفع تسجيلات أي محاضرة حتى الآن.</p>
                ) : (
                  sessions.filter(s => s.status === 'done' && !s.isPostponed).map((s) => {
                    const e = evaluations.find(ev => ev.sessionNumber === s.sessionNumber);
                    const isPresent = e?.attendance === 1;
                    
                    return (
                      <div key={s.id} className="bg-slate-950 p-4 rounded-2.5xl border border-slate-800 hover:border-purple-500/25 transition-all flex flex-col justify-between gap-3">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-950 px-2.5 py-1 rounded-full border border-purple-900/60">سيشن #{s.sessionNumber}</span>
                            <h5 className="font-black text-white text-sm mt-2">{s.lectureTitle || `المحاضرة رقم ${s.sessionNumber}`}</h5>
                            {s.date && <p className="text-[10px] text-slate-500 font-bold mt-1">تاريخ السيشن: {s.date}</p>}
                          </div>

                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${isPresent ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50' : 'bg-red-950/20 text-red-400 border-red-900/50'}`}>
                            {isPresent ? '✓ حضرت' : '✗ غياب'}
                          </span>
                        </div>

                        {s.lectureRecordingUrl ? (
                          <a 
                            href={s.lectureRecordingUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 border border-slate-800 hover:border-purple-500/20 font-black text-xs py-2.5 rounded-xl uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5"
                          >
                            📹 رابط مشاهدة المحاضرة المسجلة ➔
                          </a>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-bold italic text-center py-1.5 border border-slate-850 bg-slate-900/30 rounded-xl">
                            سجل المحاضرة غير متوفر للتحميل حالياً من المدرب.
                          </div>
                        )}

                        {e?.trainerNote && (
                          <div className="mt-1.5 text-right">
                            <details className="group border border-indigo-950/60 bg-indigo-950/15 rounded-xl overflow-hidden transition-all duration-300">
                              <summary className="list-none flex justify-between items-center px-4 py-2.5 cursor-pointer text-xs font-black text-indigo-400 select-none">
                                <span className="flex items-center gap-1.5">📝 ملاحظة المحاضر الخاصة بك</span>
                                <span className="transition-transform duration-300 group-open:rotate-180 text-[10px]">▼</span>
                              </summary>
                              <div className="px-4 pb-3.5 pt-1.5 border-t border-indigo-950/30 text-[11px] text-slate-300 font-bold leading-relaxed whitespace-pre-line bg-slate-950/40">
                                {e.trainerNote}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* LECTURE ASSIGNED TASKS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-4xl space-y-4">
              <h4 className="font-black text-white text-md border-b border-slate-800 pb-3">مطلوبات الواجبات والتاسكات المستحقة</h4>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {sessions.filter(s => s.status === 'done' && !s.isPostponed).length === 0 ? (
                  <p className="text-slate-500 italic text-xs text-center py-12">لا توجد أي واجبات أو مطلوبات معلنة بعد.</p>
                ) : (
                  sessions.filter(s => s.status === 'done' && !s.isPostponed).map((s) => {
                    const meta = sessionMetas.find(m => m.sessionId === s.id);
                    const e = evaluations.find(ev => ev.sessionNumber === s.sessionNumber);
                    
                    return (
                      <div key={s.id} className="bg-slate-950 p-4 rounded-2.5xl border border-slate-800 hover:border-purple-500/25 transition-all space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-900/60">تاسك سيشن #{s.sessionNumber}</span>
                          
                          {e && (
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded ${e.taskDelivered > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {e.taskDelivered > 0 ? `تم تسليمه (نقاط: ${e.taskDelivered})` : 'قيد الانتظار'}
                            </span>
                          )}
                        </div>

                        {/* Task instructions notes */}
                        <div className="text-xs text-slate-300 font-bold border-l-2 border-slate-800 pl-3 leading-relaxed whitespace-pre-wrap">
                          {meta?.taskInstructions ? meta.taskInstructions : 'لم يتم تسجيل ملاحظات أو واجبات تخصصية لهذه المحاضرة.'}
                        </div>

                        {s.tasksMessageUrl && (
                          <div className="pt-2 border-t border-slate-900">
                            <a 
                              href={s.tasksMessageUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold flex items-center justify-end gap-1"
                            >
                              رابط المنشور المرجعي للتاسك 🔗
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
        
        {/* Beautiful Dynamic Branded Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-400 dark:text-slate-500 font-medium px-4 select-none">
          <div className="flex flex-col gap-1 items-center sm:items-start">
            <p className="font-extrabold uppercase tracking-wide text-slate-400">
              Developed by Eng: <span className="text-purple-400">Mohamed Saber</span>
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500/70">
              All rights reserved by Saber Group Courses Academy
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://wa.me/201024689480" 
              target="_blank" 
              rel="noreferrer" 
              className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-emerald-500/20 shadow-sm"
              title="Contact Eng. Mohamed Saber on WhatsApp"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.588 1.45 5.374 1.451 5.4 0 9.791-4.39 9.795-9.792.002-2.618-1.01-5.079-2.859-6.93C17.06 2.03 14.605.992 11.994.992 6.59.992 2.198 5.383 2.193 10.786c-.001 1.905.497 3.766 1.444 5.394L2.656 21.8l5.803-1.522c1.55.845 3.28 1.289 5.011 1.29h.178z"/>
              </svg>
            </a>
            <a 
              href="https://www.facebook.com/MS.GD.FL/" 
              target="_blank" 
              rel="noreferrer" 
              className="w-8 h-8 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-blue-500/20 shadow-sm"
              title="Follow on Facebook"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
              </svg>
            </a>
          </div>
        </footer>
      </main>

      {/* Real-time Floating Notification Toast */}
      {activeToast && (
        <div className="fixed bottom-6 left-6 z-[100] max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 p-5 rounded-[2rem] shadow-2xl shadow-indigo-500/10 font-arabic text-right animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex gap-4 items-start">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setActiveToast(null)} 
                  className="text-slate-500 hover:text-slate-300 transition-colors text-xs p-1"
                >
                  ✕
                </button>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-extrabold text-[9px] uppercase">
                  تنبيه جديد 🔔
                </span>
              </div>
              <h4 className="text-xs font-black text-white">{activeToast.title}</h4>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{activeToast.message}</p>
              <div className="pt-1.5 flex justify-between items-center">
                <button
                  onClick={async () => {
                    await markNotificationRead(activeToast.id);
                    setActiveToast(null);
                  }}
                  className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  تحديد كمقروء ✓
                </button>
                <span className="text-[8px] font-bold text-slate-500">الآن</span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 text-lg">
              📢
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Editing Modal */}
      {isProfileModalOpen && currentStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            <div className="text-right space-y-2 border-b border-slate-800/60 pb-4">
              <div className="flex items-center gap-2 text-purple-400">
                <UserIcon size={18} />
                <h3 className="text-lg font-black text-white">تعديل بياناتي الشخصية</h3>
              </div>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                برجاء التأكد من صحة بيانات الاتصال والروابط المدخلة لكي نتمكن من التواصل معك ومراجعة مهامك بأفضل شكل.
              </p>
            </div>

            {profileSaveSuccess ? (
              <div className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-2xl text-center font-black animate-pulse">
                🎉 تم حفظ تعديلاتك بنجاح وتحديث السيستم!
              </div>
            ) : (
              <form onSubmit={handleProfileSave} className="space-y-4">
                {/* Name & ID (Read-only) */}
                <div className="grid grid-cols-2 gap-3 font-arabic">
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-slate-500 uppercase">اسم الطالب</label>
                    <input
                      type="text"
                      value={currentStudent.name}
                      disabled
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-500 font-bold text-center cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-slate-500 uppercase">الرقم الأكاديمي (ID)</label>
                    <input
                      type="text"
                      value={currentStudent.studentIdNum || ''}
                      disabled
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-500 font-mono font-bold text-center cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Mobile Phone */}
                <div className="space-y-1 text-right font-arabic">
                  <label className="text-[10px] font-black text-slate-400 uppercase">رقم الهاتف/الموبايل (Phone)</label>
                  <div className="flex gap-2" dir="ltr">
                    <select
                      value={phoneCountry}
                      onChange={(e) => setPhoneCountry(e.target.value)}
                      className="w-1/3 px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold outline-none focus:border-purple-500 transition-all cursor-pointer"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneLocal}
                      onChange={handlePhoneChange}
                      required
                      className="flex-1 px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-center outline-none focus:border-purple-500 transition-all font-mono"
                      placeholder="مثال: 51234567"
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal">سيقوم النظام بتحديد الدولة تلقائياً إذا كتبت رمز البلد.</p>
                </div>

                {/* WhatsApp Number */}
                <div className="space-y-1 text-right font-arabic">
                  <label className="text-[10px] font-black text-slate-400 uppercase">رقم الواتساب (WhatsApp)</label>
                  <div className="flex gap-2" dir="ltr">
                    <select
                      value={whatsappCountry}
                      onChange={(e) => setWhatsappCountry(e.target.value)}
                      className="w-1/3 px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold outline-none focus:border-purple-500 transition-all cursor-pointer"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={whatsappLocal}
                      onChange={handleWhatsappChange}
                      className="flex-1 px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-center outline-none focus:border-purple-500 transition-all font-mono"
                      placeholder="مثال: 51234567"
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal">برجاء كتابة رقم الهاتف للواتساب فقط دون روابط، وسيتم تمكين الضغط والمحادثة تلقائياً.</p>
                </div>

                {/* Email */}
                <div className="space-y-1.5 text-right font-arabic">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>📧 البريد الإلكتروني (حساب Gmail فقط)</span>
                    </span>
                    <span className="font-mono text-amber-400 font-bold">@gmail.com</span>
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-center outline-none focus:border-amber-500 transition-all font-mono"
                    placeholder="example@gmail.com"
                  />
                  <p className="text-[10px] text-amber-300 font-bold leading-relaxed bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-xl">
                    ⚠️ <strong>تنبيه مهم:</strong> يجب إدخال حساب بريد ينتهي بـ <span className="font-mono underline text-amber-200">@gmail.com</span> فقط، لأن هذا الحساب هو الذي سيتم استخدامه للانضمام لمحاضرات Google Meet وتأكيد حضورك التلقائي.
                  </p>
                </div>

                {/* Toggle past modifications history */}
                {currentStudent.profileEditHistory && currentStudent.profileEditHistory.length > 0 && (
                  <div className="pt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setShowHistoryInModal(!showHistoryInModal)}
                      className="text-[11px] font-black text-purple-400 hover:text-purple-300 underline cursor-pointer"
                    >
                      {showHistoryInModal ? 'إخفاء سجل التعديلات السابقة' : '📂 عرض سجل التعديلات السابقة الخاصة بك'}
                    </button>
                    
                    {showHistoryInModal && (
                      <div className="mt-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-40 overflow-y-auto space-y-2.5">
                        {currentStudent.profileEditHistory.map((h, i) => (
                          <div key={i} className="text-[10px] leading-relaxed border-b border-slate-900 pb-2 last:border-0 last:pb-0 space-y-1">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-purple-400 font-black">{h.fieldNameAr}</span>
                              <span className="text-slate-500 text-[9px] font-mono">{h.editedAt}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                              <span>القديم: <span className="text-slate-500 font-mono line-through">{h.oldValue || '(فارغ)'}</span></span>
                              <span>الجديد: <span className="text-emerald-400 font-mono">{h.newValue || '(فارغ)'}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaveLoading}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-xl shadow-purple-600/10 disabled:opacity-50 cursor-pointer"
                  >
                    {profileSaveLoading ? 'جاري حفظ البيانات...' : 'حفظ التعديلات ✅'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* GRADUATION PROJECT DETAILS & RULES MODAL */}
      {isProjectDetailsModalOpen && graduationProject && (() => {
        const projStartDate = graduationProject.startDate || (graduationProject as any).submissionStartDate || '';
        const projEndDate = graduationProject.endDate || (graduationProject as any).submissionEndDate || '';
        const projTelegramLink = graduationProject.telegramChannelLink || (graduationProject as any).telegramChannelUrl || '';
        const projVideoLink = graduationProject.submissionGuideVideoLink || (graduationProject as any).explanationVideoUrl || '';
        const projRequirements = graduationProject.requirements || (graduationProject as any).deliverablesRequired || '';
        const projRules = graduationProject.rules || (Array.isArray((graduationProject as any).mandatoryRules) ? (graduationProject as any).mandatoryRules.join('\n') : ((graduationProject as any).mandatoryRules || ''));
        const projExtraLinks = graduationProject.extraLinks || [];

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
            <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsProjectDetailsModalOpen(false)}
                className="absolute top-5 left-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="space-y-2 border-b border-slate-800 pb-4">
                <span className="bg-purple-500/20 text-purple-300 font-black text-[10px] px-3 py-1 rounded-full border border-purple-500/30 uppercase">
                  تفاصيل وقواعد مشروع التخرج
                </span>
                <h3 className="text-2xl font-black text-white">{graduationProject.title}</h3>
                {graduationProject.brandName && (
                  <p className="text-xs text-amber-400 font-bold">البراند المستهدف: {graduationProject.brandName}</p>
                )}
              </div>

              {/* Dates */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold">🗓️ بدء التسليم:</span>
                  <span className="font-mono text-emerald-400 font-bold">{projStartDate ? projStartDate.replace('T', ' ') : 'متاح حالياً'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold">⏰ نهاية التسليم (الديدلاين):</span>
                  <span className="font-mono text-rose-400 font-bold">{projEndDate ? projEndDate.replace('T', ' ') : 'غير محدد'}</span>
                </div>
                <p className="text-[11px] text-rose-400 font-bold border-t border-slate-800 pt-2 text-center">
                  ⚠️ يرجى العلم أنه يمنع منعاً باتاً التسليم بعد انتهاء الديدلاين الموضح أعلاه.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-purple-400">وصف وفكرة المشروع:</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800 whitespace-pre-line">
                  {graduationProject.description || 'لا يوجد وصف تفصيلي للمشروع بعد.'}
                </p>
              </div>

              {/* Deliverables Required */}
              {projRequirements && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-indigo-400">المطلوب من المتدرب للإنهاء والتسليم:</h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800 whitespace-pre-line">
                    {projRequirements}
                  </p>
                </div>
              )}

              {/* Mandatory Rules */}
              {projRules && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    <span>القواعد الأساسية التي لا يجب الخروج عنها (مهم جداً):</span>
                  </h4>
                  <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-2xl space-y-2">
                    {projRules.split('\n').filter(r => r.trim()).map((rule, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-rose-200">
                        <span className="font-bold text-rose-400">{idx + 1}.</span>
                        <span className="leading-relaxed">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External Links */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {projTelegramLink && (
                  <a
                    href={projTelegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Send size={14} />
                    <span>انضم لقناة التليجرام الخاصة بالمشروع 📢</span>
                  </a>
                )}
                {projVideoLink && (
                  <a
                    href={projVideoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Video size={14} />
                    <span>شاهد فيديو الشرح والتسليم 🎥</span>
                  </a>
                )}
                {projExtraLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-black text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    <span>{link.title || link.url}</span>
                  </a>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsProjectDetailsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* GRADUATION PROJECT SUBMISSION FORM MODAL */}
      {isSubmissionModalOpen && graduationProject && (() => {
        const projStartDate = graduationProject.startDate || (graduationProject as any).submissionStartDate || '';
        const projEndDate = graduationProject.endDate || (graduationProject as any).submissionEndDate || '';
        const projRequirements = graduationProject.requirements || (graduationProject as any).deliverablesRequired || '';
        const projRules = graduationProject.rules || (Array.isArray((graduationProject as any).mandatoryRules) ? (graduationProject as any).mandatoryRules.join('\n') : ((graduationProject as any).mandatoryRules || ''));

        const now = new Date();
        const startDT = projStartDate ? new Date(projStartDate) : null;
        const endDT = projEndDate ? new Date(projEndDate) : null;

        const isPastDeadline = endDT ? now > endDT : false;
        const isBeforeStart = startDT ? now < startDT : false;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
            <div className="w-full max-w-xl bg-slate-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsSubmissionModalOpen(false)}
                className="absolute top-5 left-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="space-y-1 text-right border-b border-slate-800 pb-4">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-950 px-3 py-1 rounded-full border border-purple-900/60">
                  استمارة تسليم مشروع التخرج
                </span>
                <h3 className="text-xl font-black text-white pt-2">تسليم: {graduationProject.title}</h3>
                {graduationProject.brandName && (
                  <p className="text-xs text-amber-400 font-bold">براند: {graduationProject.brandName}</p>
                )}
                <p className="text-xs text-slate-400">
                  برجاء رفع وتجهيز مجلد Google Drive / Figma للتسليم وتأكيد كافة شروط وملاحظات الوصول.
                </p>
              </div>

              {/* Deadline Status Alert inside modal */}
              {isPastDeadline ? (
                <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-300 text-xs space-y-2">
                  <div className="font-black text-sm flex items-center gap-2 text-rose-400">
                    <XCircle size={18} />
                    <span>انتهى موعد التسليم النهائي (الديدلاين)!</span>
                  </div>
                  <p>
                    تاريخ انتهاء التسليم كان: <span className="font-mono font-bold text-white">{projEndDate.replace('T', ' ')}</span>.
                  </p>
                  <p className="font-bold text-rose-200">
                    نأسف، لقد تم إغلاق باب التسليم ولا يمكن إرسال أو تعديل أية تسليمات لمشروع التخرج بعد انتهاء المهلة.
                  </p>
                </div>
              ) : isBeforeStart ? (
                <div className="p-4 bg-sky-500/15 border border-sky-500/40 rounded-2xl text-sky-300 text-xs space-y-2">
                  <div className="font-black text-sm flex items-center gap-2 text-sky-400">
                    <Clock size={18} />
                    <span>لم يبدأ وقت التسليم بعد</span>
                  </div>
                  <p>
                    تاريخ بدء التسليم سيكون في: <span className="font-mono font-bold text-white">{projStartDate.replace('T', ' ')}</span>.
                  </p>
                </div>
              ) : null}

              {/* Requirements & Rules Summary */}
              {projRequirements && (
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl text-xs space-y-1">
                  <span className="font-black text-indigo-400 block">📦 تذكير بالمطلوب تسليمه:</span>
                  <p className="text-slate-300 whitespace-pre-line">{projRequirements}</p>
                </div>
              )}

              {projRules && (
                <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-xs space-y-1">
                  <span className="font-black text-rose-400 block">⚠️ القواعد الأساسية الواجب الالتزام بها:</span>
                  <p className="text-slate-300 whitespace-pre-line">{projRules}</p>
                </div>
              )}

              {submissionSuccessMsg ? (
                <div className="p-5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl text-center text-xs font-black animate-pulse">
                  {submissionSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleStudentProjectSubmit} className="space-y-5">
                  {/* Drive Link */}
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-black text-slate-200 block">
                      رابط ملف مشروع التخرج (Google Drive / Figma / Behance) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      disabled={isPastDeadline || isBeforeStart}
                      value={submissionDriveLink}
                      onChange={(e) => setSubmissionDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 font-mono text-left focus:border-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                  </div>

                  {/* Checklist Requirements */}
                  <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-right">
                    <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck size={16} />
                      <span>تأكيد الشروط الأساسية للتسليم (إجباري):</span>
                    </h4>

                    <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        disabled={isPastDeadline || isBeforeStart}
                        checked={checkOpen}
                        onChange={(e) => setCheckOpen(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-purple-600 bg-slate-900 border-slate-700 rounded focus:ring-purple-500 shrink-0"
                      />
                      <span>1. أتأكد أن رابط جوجل درايف / فيجما مفتوح للجميع (Anyone with link can view).</span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        disabled={isPastDeadline || isBeforeStart}
                        checked={checkEditable}
                        onChange={(e) => setCheckEditable(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-purple-600 bg-slate-900 border-slate-700 rounded focus:ring-purple-500 shrink-0"
                      />
                      <span>2. قمت برفع كافة الملفات القابلة للتعديل والملحقات المطلوبة.</span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        disabled={isPastDeadline || isBeforeStart}
                        checked={checkRules}
                        onChange={(e) => setCheckRules(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-purple-600 bg-slate-900 border-slate-700 rounded focus:ring-purple-500 shrink-0"
                      />
                      <span>3. قرأت كافة قواعد وتعليمات مشروع التخرج والتزمت بها بالكامل.</span>
                    </label>
                  </div>

                  {/* Extra Links */}
                  <div className="space-y-3 text-right">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-300">إضافة لينكات إضافية (توضيحية / اختياري):</label>
                      {!isPastDeadline && !isBeforeStart && (
                        <button
                          type="button"
                          onClick={() => setSubmissionExtraLinks([...submissionExtraLinks, { title: '', url: '' }])}
                          className="text-[11px] font-bold text-purple-400 hover:text-purple-300"
                        >
                          + إضافة لينك
                        </button>
                      )}
                    </div>
                    {submissionExtraLinks.map((link, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          disabled={isPastDeadline || isBeforeStart}
                          placeholder="عنوان اللينك (مثلاً: لينك الملحقات)"
                          value={link.title}
                          onChange={(e) => {
                            const updated = [...submissionExtraLinks];
                            updated[i].title = e.target.value;
                            setSubmissionExtraLinks(updated);
                          }}
                          className="w-1/3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 disabled:opacity-50"
                        />
                        <input
                          type="url"
                          disabled={isPastDeadline || isBeforeStart}
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...submissionExtraLinks];
                            updated[i].url = e.target.value;
                            setSubmissionExtraLinks(updated);
                          }}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono text-left disabled:opacity-50"
                        />
                        {!isPastDeadline && !isBeforeStart && (
                          <button
                            type="button"
                            onClick={() => setSubmissionExtraLinks(submissionExtraLinks.filter((_, idx) => idx !== i))}
                            className="text-rose-400 text-xs px-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSubmissionModalOpen(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingProject || isPastDeadline || isBeforeStart}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmittingProject
                        ? 'جاري رفع التسليم...'
                        : isPastDeadline
                        ? 'التسليم مغلق (انتهى الديدلاين)'
                        : isBeforeStart
                        ? 'لم يبدأ الوقت بعد'
                        : 'حفظ وتأكيد التسليم 🚀'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* GRADUATION EVALUATION & COMMENTS VIEW MODAL FOR STUDENT */}
      {isProjectEvalViewModalOpen && graduationEvaluation && graduationProject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
          <div className="w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setIsProjectEvalViewModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="space-y-1 border-b border-slate-800 pb-4 text-right">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-950 px-3 py-1 rounded-full border border-emerald-900/60">
                تقييم المحاضر وملاحظات الديزاين
              </span>
              <h3 className="text-xl font-black text-white pt-2">نتيجة مشروع التخرج النهائي</h3>
              <p className="text-xs text-slate-400">
                مقيّمة بواسطة المحاضر بتاريخ: {graduationEvaluation.evaluatedAt ? new Date(graduationEvaluation.evaluatedAt).toLocaleDateString('ar-EG') : 'حديثاً'}
              </p>
            </div>

            {/* Total score box */}
            <div className="bg-gradient-to-r from-emerald-950/40 to-slate-950 p-5 rounded-2xl border border-emerald-500/30 flex justify-between items-center">
              <span className="text-sm font-black text-white">الدرجة الإجمالية لمشروع التخرج:</span>
              <span className="text-3xl font-black text-emerald-400">
                {graduationEvaluation.totalScore} / {graduationProject.criteria?.reduce((s, c) => s + c.maxScore, 0) || 100}
              </span>
            </div>

            {/* Criteria Scores */}
            {graduationEvaluation.criteriaScores && graduationEvaluation.criteriaScores.length > 0 && (
              <div className="space-y-3 text-right">
                <h4 className="text-xs font-black text-indigo-400">توزيع الدرجات حسب معايير التقييم:</h4>
                <div className="space-y-2">
                  {graduationEvaluation.criteriaScores.map((cs, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-300">{cs.title}</span>
                      <span className="font-black font-mono text-indigo-400">{cs.score} / {cs.maxScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trainer Notes */}
            {graduationEvaluation.generalNotes && (
              <div className="space-y-2 text-right">
                <h4 className="text-xs font-black text-purple-400">ملاحظات المحاضر العامة:</h4>
                <p className="text-xs text-slate-300 bg-slate-950 p-4 rounded-2xl border border-slate-800 leading-relaxed">
                  {graduationEvaluation.generalNotes}
                </p>
              </div>
            )}

            {/* Design Comments / Technical Notes */}
            {graduationComments.length > 0 && (
              <div className="space-y-3 text-right">
                <h4 className="text-xs font-black text-amber-400">ملاحظات وتعليقات التفاصيل الفنية والديزاين:</h4>
                <div className="space-y-2">
                  {graduationComments.map((com) => (
                    <div key={com.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span className="font-black text-purple-400">{com.authorName} ({com.authorRole})</span>
                        <span>{new Date(com.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-arabic leading-relaxed">{com.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsProjectEvalViewModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating MARO AI Assistant Widget */}
      <GemyChatWidget
        currentStudent={currentStudent}
        studentGroup={studentGroup}
        sessions={sessions}
        evaluations={evaluations}
        penalties={penalties}
        rankings={rankings}
      />
    </div>
  );
};

export default StudentPortal;
