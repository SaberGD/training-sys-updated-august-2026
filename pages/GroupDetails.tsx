
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Group, Student, Session, User, 
  LectureEvaluation, Attendance, GroupRanking, Penalty, Course, SessionMeta,
  StudentFollowUp, FollowUpComment, FollowUpSuggestionExemption, LabelDefinition, LectureFeedback,
  GraduationProject, GraduationProjectSubmission, StudentCertificateRecord, StudentWeaknessPoint
} from '../types';
import { StudentWeaknessModal } from '../components/StudentWeaknessModal';
import { StudentHistoryModal } from '../components/StudentHistoryModal';
import { 
  subscribeToCollection, 
  addPenalty, removePenalty, 
  getDocument, recalculateStudentRanking, updateSession,
  batchSaveEvaluations, batchSaveProjectScores, batchUpdateSessions,
  saveSessionMeta, saveStudent, deleteStudent,
  saveStudentFollowUpComment,
  requestSupervisorFollowUp,
  updateFollowUpLabels,
  shiftSessionDates,
  checkAndBackfillStudentCredentials,
  updateFeedbackComplaint,
  sendNotification,
  triggerStudentWelcomeEmail,
  getOrCreateGroupTestAccount,
  saveStudentCertificateRecord,
  toggleGroupCertificatesVisibility
} from '../services/firestore';
import { sanitizeCredentials, sanitizeEmail, sanitizePhone } from '../lib/textUtils';
import Layout from '../components/Layout';
import { getApiEndpoint } from '../lib/apiConfig';
import GroupModal from '../components/GroupModal';
import StudentStatusModal from '../components/StudentStatusModal';
import BulkStudentsImportModal from '../components/BulkStudentsImportModal';
import { GroupGraduationProjectsTab } from '../components/GroupGraduationProjectsTab';
import { TrainerBroadcastEmailModal } from '../components/TrainerBroadcastEmailModal';
import { formatTime12h, parseTimeToMinutes, normalizePhoneNumber } from '../utils';
import { useLanguage } from '../contexts/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Edit2, Calendar, X, Save, Clock, UserPlus, Trash2, MessageSquare, Send, ExternalLink, Video, RefreshCw, Loader2, CheckCircle2, CheckCircle, XCircle, Mail, AlertTriangle, Globe, FlaskConical, Copy, Check, Key, Info, Sparkles, Search, BookOpen, ClipboardCheck, ListTodo, Trophy, Star, GraduationCap, Award, Users } from 'lucide-react';

const { where, serverTimestamp } = firestore as any;

const GroupDetails: React.FC<{ user: User }> = ({ user }) => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState('lectures');
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentForStatusChange, setSelectedStudentForStatusChange] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<LectureEvaluation[]>([]);
  const [studentFollowUps, setStudentFollowUps] = useState<StudentFollowUp[]>([]);
  const [suggestionExemptions, setSuggestionExemptions] = useState<FollowUpSuggestionExemption[]>([]);
  const [rankings, setRankings] = useState<GroupRanking[]>([]);
  const [rankingSearchQuery, setRankingSearchQuery] = useState('');
  const [penaltySearchQuery, setPenaltySearchQuery] = useState('');
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [sessionMetas, setSessionMetas] = useState<SessionMeta[]>([]);
  const [feedbacks, setFeedbacks] = useState<LectureFeedback[]>([]);
  const [complaintNotes, setComplaintNotes] = useState<Record<string, string>>({});
  const [complaintStatuses, setComplaintStatuses] = useState<Record<string, 'new' | 'in_progress' | 'solved' | 'closed'>>({});
  
  // Graduation Projects & Certificates State
  const [gradProjects, setGradProjects] = useState<GraduationProject[]>([]);
  const [gradSubmissions, setGradSubmissions] = useState<GraduationProjectSubmission[]>([]);
  const [certificateRecords, setCertificateRecords] = useState<StudentCertificateRecord[]>([]);

  // Certificate Modals State
  const [selectedCertStudent, setSelectedCertStudent] = useState<Student | null>(null);
  const [isCertExceptionModalOpen, setIsCertExceptionModalOpen] = useState(false);
  const [certOverrideType, setCertOverrideType] = useState<'none' | 'exception_granted' | 'blocked'>('none');
  const [certOverrideReason, setCertOverrideReason] = useState('');

  const [isCertLinkModalOpen, setIsCertLinkModalOpen] = useState(false);
  const [certUrlInput, setCertUrlInput] = useState('');
  const [certUneligibilityNote, setCertUneligibilityNote] = useState('');
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certFilterType, setCertFilterType] = useState<'all' | 'eligible' | 'ineligible' | 'exception' | 'blocked'>('all');
  
  const [evaluationMode, setEvaluationMode] = useState<'lecture' | 'project'>('lecture');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = useMemo(() => {
    if (sessions.length === 0) return null;
    if (!selectedSessionId) {
      // Auto-select active session if any, otherwise default to first
      const activeS = sessions.find(s => s.smartAssistantState && s.smartAssistantState !== 'idle');
      return activeS || sessions[0];
    }
    return sessions.find(s => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  const activeSess = selectedSession;
  const [searchParams] = useSearchParams();
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const taskProgressRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    const urlSessionId = searchParams.get('sessionId');
    const urlTab = searchParams.get('tab');
    const urlSessionNum = searchParams.get('sessionNumber');
    const urlStudentId = searchParams.get('studentId');

    if (urlTab) {
      setActiveTab(urlTab);
    }

    if (urlSessionId) {
      setSelectedSessionId(urlSessionId);
    } else if (urlSessionNum && sessions.length > 0) {
      const sFound = sessions.find(s => s.sessionNumber === Number(urlSessionNum));
      if (sFound) {
        setSelectedSessionId(sFound.id);
      }
    }

    if (urlStudentId) {
      // Clear any active filters so the deep-linked student is guaranteed visible
      setTaskSearchQuery('');
      setTaskFilterMissingOnly(false);
      setTaskFilterCompletionThreshold(0);
      setTaskFilterSessionNum('');
      setHighlightedStudentId(urlStudentId);
    }
  }, [searchParams, sessions]);

  const [specialWorkshopModalSession, setSpecialWorkshopModalSession] = useState<{ id: string; targetChecked: boolean } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [elapsedTimeString, setElapsedTimeString] = useState('');

  useEffect(() => {
    if (!selectedSession || !selectedSession.startTimeActual || !selectedSession.smartAssistantState || selectedSession.smartAssistantState === 'idle') {
      setElapsedTimeString('');
      return;
    }

    const updateTimer = () => {
      try {
        const useDateStr = selectedSession.actualStartDate || selectedSession.date;
        if (!useDateStr) return;
        const [hour, min] = selectedSession.startTimeActual.split(':').map(Number);
        const [year, month, day] = useDateStr.split('-').map(Number);

        const startDateLocal = new Date(year, month - 1, day, hour, min, 0, 0);
        
        // Cairo time calculation
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: false
        });
        const cairoParts = formatter.formatToParts(new Date());
        const cairoYear = parseInt(cairoParts.find(p => p.type === 'year')?.value || '0', 10);
        const cairoMonth = parseInt(cairoParts.find(p => p.type === 'month')?.value || '0', 10);
        const cairoDay = parseInt(cairoParts.find(p => p.type === 'day')?.value || '0', 10);
        const cairoHour = parseInt(cairoParts.find(p => p.type === 'hour')?.value || '0', 10);
        const cairoMinute = parseInt(cairoParts.find(p => p.type === 'minute')?.value || '0', 10);
        const cairoSecond = parseInt(cairoParts.find(p => p.type === 'second')?.value || '0', 10);

        const cairoNowLocal = new Date(cairoYear, cairoMonth - 1, cairoDay, cairoHour, cairoMinute, cairoSecond, 0);

        const diffMs = cairoNowLocal.getTime() - startDateLocal.getTime();
        if (diffMs < 0) {
          setElapsedTimeString('00:00:00');
          return;
        }

        const totalSecs = Math.floor(diffMs / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;

        setElapsedTimeString(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        );
      } catch (e) {
        console.error(e);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [selectedSession, sessions]);

  const [isEditingMeetingLink, setIsEditingMeetingLink] = useState(false);
  const [tempMeetingLink, setTempMeetingLink] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (studentId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  useEffect(() => {
    if (selectedSession) {
      setTempMeetingLink(selectedSession.meetingLink || '');
      setIsEditingMeetingLink(false);
    }
  }, [selectedSession?.id]);

  // Date Editing State
  const [editingSessionDate, setEditingSessionDate] = useState<Session | null>(null);
  const [newDateValue, setNewDateValue] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [isShifting, setIsShifting] = useState(false);
  const [evalSearchQuery, setEvalSearchQuery] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [draftSessionStatus, setDraftSessionStatus] = useState<Record<string, 'upcoming' | 'done'>>({});
  const [qrDuration, setQrDuration] = useState<number>(15);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [onboardingStudent, setOnboardingStudent] = useState<any | null>(null);
  const [isBulkStudentsImportOpen, setIsBulkStudentsImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentFormData, setStudentFormData] = useState({ 
    name: '', 
    phone: '', 
    email: '',
    whatsapp: '',
    github: '',
    linkedin: '',
    notes: '',
    tasksLink: ''
  });
  const [penaltyFormData, setPenaltyFormData] = useState({ studentId: '', points: 5, reason: '' });
  const [notesModalStudent, setNotesModalStudent] = useState<{ id: string, name: string } | null>(null);
  const [studentNotesText, setStudentNotesText] = useState<string>('');
  const [studentTaskNoteText, setStudentTaskNoteText] = useState<string>('');
  const [activeNotesTab, setActiveNotesTab] = useState<'lecture' | 'task'>('lecture');
  const [groupWeaknesses, setGroupWeaknesses] = useState<StudentWeaknessPoint[]>([]);
  const [selectedStudentForWeakness, setSelectedStudentForWeakness] = useState<{ id: string, name: string } | null>(null);

  // Task Progress Filters
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskFilterMissingOnly, setTaskFilterMissingOnly] = useState(false);
  const [taskFilterCompletionThreshold, setTaskFilterCompletionThreshold] = useState(0);
  const [taskFilterSessionNum, setTaskFilterSessionNum] = useState<number | ''>('');
  const [taskSortBy, setTaskSortBy] = useState<'name' | 'missing' | 'completion'>('name');
  const [studentSortBy, setStudentSortBy] = useState<'name' | 'points'>('name');
  const [studentLoginFilter, setStudentLoginFilter] = useState<'all' | 'logged_in' | 'not_logged_in'>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [highlightDuplicates, setHighlightDuplicates] = useState(false);

  const [selectedStudentForComment, setSelectedStudentForComment] = useState<Student | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [followUpCommentText, setFollowUpCommentText] = useState('');

  // Follow-up states
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [followUpStudent, setFollowUpStudent] = useState<Student | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDeadline, setFollowUpDeadline] = useState('');
  const [followUpMentionedUser, setFollowUpMentionedUser] = useState('');
  const [followUpLabels, setFollowUpLabels] = useState<string[]>([]);

  // Postponement states
  const [isPostponeStartModalOpen, setIsPostponeStartModalOpen] = useState(false);
  const [postponeStartMinutes, setPostponeStartMinutes] = useState<number>(15);
  const [postponeStartNewTime, setPostponeStartNewTime] = useState<string>('');
  const [isPostponeGeneralModalOpen, setIsPostponeGeneralModalOpen] = useState(false);
  const [postponeGeneralDate, setPostponeGeneralDate] = useState<string>('');

  // Portal Test Account State
  const [testAccountModal, setTestAccountModal] = useState<Student | null>(null);
  const [loadingTestAccount, setLoadingTestAccount] = useState(false);
  const [copiedTestField, setCopiedTestField] = useState<string | null>(null);

  const handleOpenTestAccount = async () => {
    if (!group) return;
    setLoadingTestAccount(true);
    try {
      const testAccount = await getOrCreateGroupTestAccount(group, user);
      setTestAccountModal(testAccount);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إعداد الحساب التجريبي');
    } finally {
      setLoadingTestAccount(false);
    }
  };

  // Google Calendar & Meet Sync state
  const [isTrainerEmailModalOpen, setIsTrainerEmailModalOpen] = useState(false);
  const [isBulkWelcomeModalOpen, setIsBulkWelcomeModalOpen] = useState(false);
  const [bulkWelcomeScope, setBulkWelcomeScope] = useState<'pending_and_failed' | 'all' | 'failed_only'>('pending_and_failed');
  const [includeDeactivatedWelcome, setIncludeDeactivatedWelcome] = useState(true);
  const [sendingWelcomeEmails, setSendingWelcomeEmails] = useState(false);
  const [welcomeEmailProgress, setWelcomeEmailProgress] = useState<{
    sent: number;
    total: number;
    failed: number;
    currentStudentName?: string;
    statusText?: string;
    isFinished?: boolean;
    lastError?: string;
  }>({ sent: 0, total: 0, failed: 0 });

  // Trainees who have registered email address for welcome emails (including deactivated if enabled)
  const groupWelcomeEmailCandidates = useMemo(() => {
    return students.filter(s => {
      if (!includeDeactivatedWelcome && s.deactivated) return false;
      const mail = (s.email || s.attendanceEmail || '').trim();
      return mail !== '';
    });
  }, [students, includeDeactivatedWelcome]);

  const welcomeEmailStats = useMemo(() => {
    const all = groupWelcomeEmailCandidates;
    const sent = all.filter(s => s.welcomeEmailSent || s.welcomeEmailStatus === 'sent');
    const failed = all.filter(s => s.welcomeEmailStatus === 'failed');
    const notAttempted = all.filter(s => !s.welcomeEmailSent && s.welcomeEmailStatus !== 'sent' && s.welcomeEmailStatus !== 'failed');
    const pendingAndFailed = all.filter(s => !s.welcomeEmailSent && s.welcomeEmailStatus !== 'sent');
    const deactivatedWithEmail = all.filter(s => s.deactivated);
    
    return {
      totalCandidates: all.length,
      sentCount: sent.length,
      failedCount: failed.length,
      notAttemptedCount: notAttempted.length,
      pendingAndFailedCount: pendingAndFailed.length,
      deactivatedCount: deactivatedWithEmail.length
    };
  }, [groupWelcomeEmailCandidates]);

  const handleOpenBulkWelcomeModal = () => {
    if (!groupId) return;
    if (students.length === 0) {
      alert(lang === 'ar' ? '⚠️ لا يوجد طلاب مسجلين في هذا الجروب.' : '⚠️ No students in this group.');
      return;
    }
    if (welcomeEmailStats.pendingAndFailedCount > 0) {
      setBulkWelcomeScope('pending_and_failed');
    } else {
      setBulkWelcomeScope('all');
    }
    setWelcomeEmailProgress({ sent: 0, total: 0, failed: 0, isFinished: false });
    setIsBulkWelcomeModalOpen(true);
  };

  const executeBulkSendWelcomeEmails = async () => {
    if (!groupId) return;
    let targetStudents: Student[] = [];

    if (bulkWelcomeScope === 'pending_and_failed') {
      targetStudents = groupWelcomeEmailCandidates.filter(s => !s.welcomeEmailSent && s.welcomeEmailStatus !== 'sent');
    } else if (bulkWelcomeScope === 'failed_only') {
      targetStudents = groupWelcomeEmailCandidates.filter(s => s.welcomeEmailStatus === 'failed');
    } else {
      targetStudents = groupWelcomeEmailCandidates;
    }

    if (targetStudents.length === 0) {
      alert(lang === 'ar' ? '⚠️ لا يوجد طلاب ينطبق عليهم شرط الإرسال المختار.' : '⚠️ No students match the selected sending condition.');
      return;
    }

    setSendingWelcomeEmails(true);
    setWelcomeEmailProgress({
      sent: 0,
      total: targetStudents.length,
      failed: 0,
      currentStudentName: targetStudents[0]?.name || '',
      statusText: `جاري بدء الإرسال لـ (${targetStudents.length}) طالب...`,
      isFinished: false
    });

    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = '';

    for (let i = 0; i < targetStudents.length; i++) {
      const s = targetStudents[i];
      const targetEmail = (s.email || s.attendanceEmail || '').trim();

      setWelcomeEmailProgress({
        sent: successCount,
        total: targetStudents.length,
        failed: failCount,
        currentStudentName: s.name,
        statusText: `جاري إرسال الترحيب إلى: ${s.name} (${i + 1}/${targetStudents.length})...`,
        isFinished: false
      });

      try {
        const res = await triggerStudentWelcomeEmail({
          id: s.id,
          name: s.name,
          email: targetEmail,
          groupId: groupId,
          studentIdNum: s.studentIdNum,
          studentPassword: s.studentPassword
        });

        if (res && res.success) {
          successCount++;
        } else {
          failCount++;
          if (res?.error) lastErrorMessage = res.error;
        }
      } catch (err: any) {
        console.error(`Failed sending welcome email to ${targetEmail}:`, err);
        failCount++;
        lastErrorMessage = err.message || String(err);
      }

      setWelcomeEmailProgress({
        sent: successCount,
        total: targetStudents.length,
        failed: failCount,
        currentStudentName: s.name,
        statusText: `تمت معالجة ${i + 1} من ${targetStudents.length}`,
        isFinished: false,
        lastError: lastErrorMessage
      });
    }

    setSendingWelcomeEmails(false);
    setWelcomeEmailProgress(prev => ({
      ...prev,
      sent: successCount,
      failed: failCount,
      statusText: 'اكتملت عملية الإرسال!',
      isFinished: true,
      lastError: lastErrorMessage
    }));
  };

  const handleSingleSendWelcomeEmail = async (student: Student) => {
    if (!groupId) return;
    const targetEmail = (student.email || student.attendanceEmail || '').trim();
    if (!targetEmail) {
      alert(lang === 'ar' ? '⚠️ هذا الطالب ليس لديه بريد إلكتروني مسجل.' : '⚠️ Student has no registered email.');
      return;
    }

    try {
      const res = await triggerStudentWelcomeEmail({
        id: student.id,
        name: student.name,
        email: targetEmail,
        groupId: groupId,
        studentIdNum: student.studentIdNum,
        studentPassword: student.studentPassword
      });

      if (res && res.success) {
        alert(lang === 'ar' ? `✅ تم إرسال ايميل الترحيب وبيانات الدخول إلى (${targetEmail}) بنجاح!` : `✅ Welcome email sent to ${targetEmail} successfully!`);
      } else {
        alert(lang === 'ar' ? `❌ فشل إرسال الإيميل: ${res?.error || 'خطأ غير معروف'}` : `❌ Failed to send email: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`❌ Error sending welcome email: ${err.message || err}`);
    }
  };
  const [syncingGoogleCalendar, setSyncingGoogleCalendar] = useState(false);
  const [googleSyncMessage, setGoogleSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [missingEmailsList, setMissingEmailsList] = useState<{ id: string; name: string; phone?: string; studentIdNum?: string }[]>([]);
  const [reconnectModalOpen, setReconnectModalOpen] = useState(false);
  const [reconnectErrorDetails, setReconnectErrorDetails] = useState<{ error: string; trainerId?: string; trainerEmail?: string } | null>(null);

  const handleSyncGoogleCalendar = async (forceRetryOnly = false, forceCentral = false) => {
    if (!groupId) return;
    setSyncingGoogleCalendar(true);
    setGoogleSyncMessage(null);
    try {
      const res = await fetch(getApiEndpoint('/api/google/sync-group-calendar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          forceRetryOnly,
          forceCentral,
          currentUserId: user?.uid,
          trainerId: group?.primaryTrainerId || user?.uid
        })
      });
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data: any = {};
      if (contentType.includes('application/json') || text.trim().startsWith('{')) {
        try { data = JSON.parse(text); } catch (e) { data = {}; }
      }
      if (res.ok && data.success) {
        const sourceLabel = forceCentral ? ' (عبر البريد المركزي sabergroup.eg@gmail.com)' : '';
        setGoogleSyncMessage({
          type: 'success',
          text: isAr ? `✅ ${data.message}${sourceLabel}` : `✅ Google Calendar sync completed!${sourceLabel}`
        });
        if (data.missingAttendanceEmails) {
          setMissingEmailsList(data.missingAttendanceEmails);
        }
      } else {
        const isOAuthErr = data.code === 'TRAINER_OAUTH_EXPIRED' ||
                           (data.error && (
                             data.error.includes('TRAINER_OAUTH_EXPIRED') ||
                             data.error.includes('invalid_grant') ||
                             data.error.includes('غير مرتبط') ||
                             data.error.includes('انتهت صلاحية')
                           ));

        if (isOAuthErr && !forceCentral) {
          setReconnectErrorDetails({
            error: data.error || 'تعذر الاتصال بحساب Google الخاص بالمدرب. يرجى إعادة ربط الحساب أو الجدولة بالبريد المركزي.',
            trainerId: data.trainerId || group?.primaryTrainerId || user?.uid,
            trainerEmail: data.trainerEmail || ''
          });
          setReconnectModalOpen(true);
        } else {
          throw new Error(data.error || (text.includes('<!DOCTYPE') ? 'خطأ في الاتصال بالخادم' : text) || 'فشلت المزامنة مع Google Calendar');
        }
      }
    } catch (err: any) {
      setGoogleSyncMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء المزامنة مع Google Calendar' : 'Failed to sync Google Calendar')
      });
    } finally {
      setSyncingGoogleCalendar(false);
    }
  };

  const isAdmin = ['admin', 'coordinator', 'team_leader', 'trainer'].includes(user.role);

  // --- Cairo / Egypt Time and Hours Helper Functions ---
  const getCairoTimeStr = (): string => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(now);
    } catch (e) {
      console.error("Error in getCairoTimeStr, falling back to local time:", e);
      return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  };

  const getCairoDateTimeStr = (): string => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const parts = formatter.formatToParts(now);
      const day = parts.find(p => p.type === 'day')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const year = parts.find(p => p.type === 'year')?.value || '';
      const hour = parts.find(p => p.type === 'hour')?.value || '';
      const minute = parts.find(p => p.type === 'minute')?.value || '';
      const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';
      const periodAr = dayPeriod.toUpperCase() === 'AM' ? 'ص' : 'م';
      return `${day}/${month}/${year} في الساعة ${hour}:${minute} ${periodAr}`;
    } catch {
      return new Date().toLocaleDateString('ar-EG');
    }
  };

  const getCairoDateISO = (): string => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    } catch {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  };

  const addMinutesToTime = (timeStr: string, mins: number): string => {
    try {
      const currentMins = parseTimeToMinutes(timeStr);
      if (currentMins === null) return timeStr;
      let totalMins = (currentMins + mins) % 1440;
      if (totalMins < 0) totalMins += 1440;
      let h = Math.floor(totalMins / 60);
      let m = totalMins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const calculateActualAndApprovedHours = (startStr: string, endStr: string, maxApproved: number) => {
    if (!startStr || !endStr) return { actualHours: 0, approvedHours: 0, durationMinutes: 0 };
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);
    if (startMin === null || endMin === null) return { actualHours: 0, approvedHours: 0, durationMinutes: 0 };
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440; // overnight lecture
    const act = parseFloat((diff / 60).toFixed(1));
    const cap = maxApproved && maxApproved > 0 ? maxApproved : 3;
    const app = parseFloat((Math.min(act, cap)).toFixed(1));
    return { actualHours: act, approvedHours: app, durationMinutes: diff };
  };

  // --- Saber Group Custom states for Lecture Tracking & AI Assistant ---
  const [groupPlan, setGroupPlan] = useState<any | null>(null);
  const [customDomain, setCustomDomain] = useState(() => localStorage.getItem('saberSystemPublicDomain') || window.location.origin);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [practiceInput, setPracticeInput] = useState('');

  // Load Group Execution Plan subscriber
  useEffect(() => {
    if (!groupId) return;
    const { doc, onSnapshot } = firestore as any;
    const unsubPlan = onSnapshot(doc(db, 'groupExecutionPlans', groupId), (snapshot: any) => {
      if (snapshot.exists()) {
        setGroupPlan({ id: snapshot.id, ...snapshot.data() });
      }
    }, (err: any) => {
      console.error("Error subscribing to group execution plan:", err);
    });
    return () => unsubPlan();
  }, [groupId]);

  // --- Saber Group Custom states for Extra / Exception Checklist Items ---
  const [trainerPlan, setTrainerPlan] = useState<any | null>(null);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraDesc, setExtraDesc] = useState('');
  const [extraScope, setExtraScope] = useState<'session_only' | 'trainer_master'>('session_only');
  const [showAddExtraForm, setShowAddExtraForm] = useState(false);
  const [isSavingExtra, setIsSavingExtra] = useState(false);

  // Fetch TrainerPlan to sync and display extra master checklist items
  useEffect(() => {
    if (!group) return;
    const trainerId = group.trainerIds?.[0] || group.primaryTrainerId;
    const courseId = group.courseId;
    if (!trainerId || !courseId) return;

    const { doc: firestoreDoc, getDoc } = firestore as any;
    const fetchTrainerPlan = async () => {
      try {
        const planId = `${trainerId}_${courseId}`;
        const planSnap = await getDoc(firestoreDoc(db, 'trainerPlans', planId));
        if (planSnap.exists()) {
          setTrainerPlan({ id: planSnap.id, ...planSnap.data() });
        }
      } catch (err) {
        console.error("Error fetching trainer plan:", err);
      }
    };
    fetchTrainerPlan();
  }, [group]);

  // Combined checklist items (stored group items + master trainer extra items)
  const combinedItems = useMemo(() => {
    if (!groupPlan) return [];
    const items = [...(groupPlan.items || [])];

    if (trainerPlan && trainerPlan.extraItems) {
      trainerPlan.extraItems.forEach((extra: any) => {
        // Only append if it doesn't already exist in the group checklist
        const exists = items.some((item: any) => item.id === extra.id);
        if (!exists) {
          items.push({
            id: extra.id,
            title: extra.title,
            description: extra.description || '',
            module: extra.module || 'إضافي (خطة المدرب)',
            seq: extra.seq || 999,
            isRequired: false,
            suggestedSession: extra.plannedSession,
            plannedSession: extra.plannedSession,
            status: 'not_started',
            isExtra: true,
            scope: 'trainer_master',
            addedAtDate: extra.addedAtDate,
            addedInSessionNumber: extra.addedInSessionNumber,
            addedByTrainerName: extra.addedByTrainerName
          });
        }
      });
    }

    // Sort items so extra items appear at their planned session or seq order
    return items.sort((a, b) => {
      const sessA = a.suggestedSession || a.plannedSession || a.seq || 1;
      const sessB = b.suggestedSession || b.plannedSession || b.seq || 1;
      if (sessA !== sessB) return sessA - sessB;
      return (a.seq || 0) - (b.seq || 0);
    });
  }, [groupPlan, trainerPlan]);

  // Toggle checklist item status in the group's execution plan
  const handleToggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    if (!groupPlan || !selectedSession) return;
    
    // Find or create item in the update payload
    const existingInPlan = groupPlan.items || [];
    let updatedItems = [...existingInPlan];
    
    const itemIndex = updatedItems.findIndex((item: any) => item.id === itemId);
    if (itemIndex > -1) {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        isCompleted,
        completedInSessionNum: isCompleted ? selectedSession.sessionNumber : null,
        completedAt: isCompleted ? new Date().toISOString() : null,
        completedByTrainerName: isCompleted ? user.name : null
      };
    } else {
      // It must be a trainer_master item that is merged but not yet saved in groupPlan.items
      const extraFromTrainer = trainerPlan?.extraItems?.find((x: any) => x.id === itemId);
      if (extraFromTrainer) {
        updatedItems.push({
          id: extraFromTrainer.id,
          title: extraFromTrainer.title,
          description: extraFromTrainer.description || '',
          module: extraFromTrainer.module || 'إضافي (خطة المدرب)',
          seq: extraFromTrainer.seq || 999,
          isRequired: false,
          suggestedSession: extraFromTrainer.plannedSession,
          plannedSession: extraFromTrainer.plannedSession,
          status: isCompleted ? 'completed' : 'not_started',
          isCompleted,
          completedInSessionNum: isCompleted ? selectedSession.sessionNumber : null,
          completedAt: isCompleted ? new Date().toISOString() : null,
          completedByTrainerName: isCompleted ? user.name : null,
          isExtra: true,
          scope: 'trainer_master',
          addedAtDate: extraFromTrainer.addedAtDate,
          addedInSessionNumber: extraFromTrainer.addedInSessionNumber,
          addedByTrainerName: extraFromTrainer.addedByTrainerName
        });
      }
    }

    try {
      // Save updated plan in firestore
      const { saveGroupExecutionPlan } = await import('../services/firestore');
      await saveGroupExecutionPlan(groupId!, updatedItems, user, `Toggled checkoff for item ID ${itemId} to ${isCompleted ? 'Completed' : 'Planned'}`);
    } catch (err: any) {
      alert("Failed to update checklist item: " + err.message);
    }
  };

  // Toggle ALL planned checklist items for this session as completed
  const handleToggleAllPlannedForSession = async (sessionNum: number, isCompleted: boolean) => {
    if (!groupPlan || !selectedSession) return;

    const updatedItems = combinedItems.map((item: any) => {
      // Find items matched to planned expected session
      const matchedPlannedSession = item.suggestedSession || item.seq || 1;
      if (matchedPlannedSession === sessionNum) {
        return {
          ...item,
          isCompleted,
          completedInSessionNum: isCompleted ? selectedSession.sessionNumber : null,
          completedAt: isCompleted ? new Date().toISOString() : null,
          completedByTrainerName: isCompleted ? user.name : null
        };
      }
      return item;
    });

    try {
      const { saveGroupExecutionPlan } = await import('../services/firestore');
      await saveGroupExecutionPlan(groupId!, updatedItems, user, `Toggled all items for planned session ${sessionNum} to ${isCompleted ? 'Completed' : 'Planned'}`);
    } catch (err: any) {
      alert("Failed to batch update checklist items: " + err.message);
    }
  };

  // Handle adding an extra/exception item during the active lecture
  const handleAddExtraChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraTitle.trim() || !groupPlan || !selectedSession || !group) return;
    setIsSavingExtra(true);
    try {
      const itemId = `extra_${Date.now()}`;
      const dateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
      const newExtraItem: any = {
        id: itemId,
        title: extraTitle.trim(),
        description: extraDesc.trim(),
        module: extraScope === 'session_only' ? 'استثناء محاضرة' : 'إضافي الخطة الأساسية',
        seq: (groupPlan.items?.length || 0) + 1,
        isRequired: false,
        suggestedSession: selectedSession.sessionNumber,
        plannedSession: selectedSession.sessionNumber,
        status: 'not_started',
        isExtra: true,
        scope: extraScope,
        addedAtDate: dateStr,
        addedInSessionNumber: selectedSession.sessionNumber,
        addedByTrainerName: user.name
      };

      const trainerId = group.trainerIds?.[0] || group.primaryTrainerId;
      const courseId = group.courseId;
      
      if (extraScope === 'trainer_master' && trainerId && courseId) {
        const { doc: firestoreDoc, getDoc, setDoc } = firestore as any;
        const planId = `${trainerId}_${courseId}`;
        const planRef = firestoreDoc(db, 'trainerPlans', planId);
        const planSnap = await getDoc(planRef);
        
        let extraItems = [];
        if (planSnap.exists()) {
          extraItems = planSnap.data().extraItems || [];
        }
        
        const newTrainerExtra = {
          id: itemId,
          title: extraTitle.trim(),
          description: extraDesc.trim(),
          addedAtDate: dateStr,
          addedInSessionNumber: selectedSession.sessionNumber,
          addedByTrainerName: user.name,
          plannedSession: selectedSession.sessionNumber
        };
        
        extraItems.push(newTrainerExtra);
        
        await setDoc(planRef, {
          extraItems,
          updatedAt: firestore.serverTimestamp()
        }, { merge: true });
        
        setTrainerPlan((prev: any) => {
          if (!prev) {
            return {
              id: planId,
              trainerId,
              trainerName: user.name,
              courseId,
              courseName: group.courseName,
              expectedSessions: 8,
              allocations: {},
              active: true,
              extraItems: [newTrainerExtra]
            };
          }
          return {
            ...prev,
            extraItems: [...(prev.extraItems || []), newTrainerExtra]
          };
        });
      }

      const updatedItems = [...(groupPlan.items || []), newExtraItem];
      const { saveGroupExecutionPlan } = await import('../services/firestore');
      await saveGroupExecutionPlan(groupId!, updatedItems, user, `Added extra checklist item: "${extraTitle.trim()}" with scope ${extraScope}`);
      
      setExtraTitle('');
      setExtraDesc('');
      setShowAddExtraForm(false);
    } catch (err: any) {
      alert("فشل إضافة الجزء الإضافي: " + err.message);
    } finally {
      setIsSavingExtra(false);
    }
  };

  // Ask Gemini Assistant proxy
  const askGeminiForRecommendations = async () => {
    if (!groupPlan || !selectedSession) return;
    setLoadingAi(true);
    setAiSuggestions("");
    try {
      // Gather current session planned items
      const sessionNum = selectedSession.sessionNumber;
      const plannedItems = (combinedItems || []).filter((item: any) => {
        const matchedPlanned = item.suggestedSession || item.seq || 1;
        return matchedPlanned === sessionNum;
      });

      const response = await fetch(getApiEndpoint("/api/gemini/assist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: courses.find(c => c.id === group?.courseId)?.name || 'مقرر فني',
          sessionNum,
          checklistItems: plannedItems,
          previousNotes: currentMeta?.lectureNotes || ""
        }),
      });

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      setAiSuggestions(result.text);
    } catch (err: any) {
      setAiSuggestions(`⚠️ لم نتمكن من الحصول على توصيات المساعد: ${err.message}`);
    } finally {
      setLoadingAi(false);
    }
  };
  const canEvaluate = useMemo(() => {
    if (isAdmin || user.role === 'trainer') return true;
    return group?.trainerIds?.includes(user.uid);
  }, [isAdmin, group, user.uid, user.role]);

  // The evaluation grid's row ORDER is frozen for the duration of a lecture —
  // giving a student a bonus point mid-lecture changes their rank score, but
  // that must not reshuffle rows while the trainer is actively scoring
  // (otherwise the student they just clicked jumps somewhere else). The order
  // only gets recomputed when a different session is opened, or when this
  // session's status flips to 'done' (the lecture actually ends).
  const [frozenEvalOrderKey, setFrozenEvalOrderKey] = useState<string | null>(null);
  const [frozenEvalOrder, setFrozenEvalOrder] = useState<string[]>([]);

  const computeRankSortedStudentIds = () => {
    const totalSessionsDone = sessions.filter(s => s.status === 'done').length;
    return [...students].sort((a, b) => {
      // 1. Sort by Rank Score (highest first)
      const rankA = rankings.find(r => r.studentId === a.id)?.finalScore || 0;
      const rankB = rankings.find(r => r.studentId === b.id)?.finalScore || 0;
      if (rankB !== rankA) return rankB - rankA;

      // 2. If Rank Score is equal, sort by Attendance % (highest first)
      const evalsA = evaluations.filter(e => e.studentId === a.id && e.attendance === 1 && e.sessionNumber !== undefined);
      const attendedA = new Set(evalsA.map(e => e.sessionNumber)).size;
      const attRateA = totalSessionsDone > 0 ? Math.min(100, Math.round((attendedA / totalSessionsDone) * 100)) : 100;

      const evalsB = evaluations.filter(e => e.studentId === b.id && e.attendance === 1 && e.sessionNumber !== undefined);
      const attendedB = new Set(evalsB.map(e => e.sessionNumber)).size;
      const attRateB = totalSessionsDone > 0 ? Math.min(100, Math.round((attendedB / totalSessionsDone) * 100)) : 100;
      if (attRateB !== attRateA) return attRateB - attRateA;

      // 3. Alphabetical order by name
      return a.name.localeCompare(b.name, 'ar');
    }).map(s => s.id);
  };

  useLayoutEffect(() => {
    if (!selectedSession) return;
    const key = `${selectedSession.id}_${selectedSession.status}`;
    // Already frozen for this exact session+status — leave it alone even if
    // rankings/evaluations keep changing live, unless we never actually got
    // real data yet (e.g. this ran before the students subscription delivered).
    if (key === frozenEvalOrderKey && frozenEvalOrder.length > 0) return;
    if (students.length === 0) return; // wait for student data to actually load
    setFrozenEvalOrder(computeRankSortedStudentIds());
    setFrozenEvalOrderKey(key);
    // students.length/rankings.length (not the arrays themselves) only change
    // on add/remove, never on a live score update — safe to depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id, selectedSession?.status, students.length, rankings.length]);

  const filteredStudentsForEval = useMemo(() => {
    const byId = new Map(students.map(s => [s.id, s]));
    const ordered = frozenEvalOrder.map(id => byId.get(id)).filter((s): s is Student => !!s);
    const orderedIds = new Set(frozenEvalOrder);
    // Any student not yet in the frozen order (e.g. added mid-lecture) is appended at the end
    const unordered = students.filter(s => !orderedIds.has(s.id));
    let list = [...ordered, ...unordered];

    if (evalSearchQuery.trim()) {
      const q = evalSearchQuery.toLowerCase().trim();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }

    return list;
  }, [students, evalSearchQuery, frozenEvalOrder]);

  const studentLoginStats = useMemo(() => {
    const total = students.length;
    const loggedIn = students.filter(s => s.hasLoggedIn || s.lastLoginAt || (s.loginCount && s.loginCount > 0)).length;
    const notLoggedIn = total - loggedIn;
    const percent = total > 0 ? Math.round((loggedIn / total) * 100) : 0;
    return { total, loggedIn, notLoggedIn, percent };
  }, [students]);

  const processedStudents = useMemo(() => {
    let result = [...students].map(s => {
      const ranking = rankings.find(r => r.studentId === s.id);
      return { ...s, totalPoints: ranking?.finalScore || 0 };
    });

    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase().trim();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.phone.includes(q) || 
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.studentIdNum && s.studentIdNum.toLowerCase().includes(q))
      );
    }

    if (studentLoginFilter === 'logged_in') {
      result = result.filter(s => s.hasLoggedIn || s.lastLoginAt || (s.loginCount && s.loginCount > 0));
    } else if (studentLoginFilter === 'not_logged_in') {
      result = result.filter(s => !s.hasLoggedIn && !s.lastLoginAt && (!s.loginCount || s.loginCount === 0));
    }

    if (studentSortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (studentSortBy === 'points') {
      result.sort((a, b) => b.totalPoints - a.totalPoints);
    }

    return result;
  }, [students, rankings, studentSortBy, studentLoginFilter, studentSearchQuery]);

  const duplicateIds = useMemo(() => {
    if (!highlightDuplicates) return new Set<string>();
    const ids = new Set<string>();
    const names = new Map<string, string[]>();
    const phones = new Map<string, string[]>();
    const emails = new Map<string, string[]>();

    students.forEach(s => {
      const name = s.name.trim().toLowerCase();
      const phone = s.phone.trim();
      const email = s.email?.trim().toLowerCase();

      if (name) {
        if (!names.has(name)) names.set(name, []);
        names.get(name)!.push(s.id);
      }
      if (phone) {
        if (!phones.has(phone)) phones.set(phone, []);
        phones.get(phone)!.push(s.id);
      }
      if (email) {
        if (!emails.has(email)) emails.set(email, []);
        emails.get(email)!.push(s.id);
      }
    });

    names.forEach(list => { if (list.length > 1) list.forEach(id => ids.add(id)); });
    phones.forEach(list => { if (list.length > 1) list.forEach(id => ids.add(id)); });
    emails.forEach(list => { if (list.length > 1) list.forEach(id => ids.add(id)); });

    return ids;
  }, [students, highlightDuplicates]);

  const completedCount = useMemo(() => sessions.filter(s => s.status === 'done').length, [sessions]);
  const progressPercent = useMemo(() => {
    if (!group || group.totalSessions === 0) return 0;
    return Math.round((completedCount / group.totalSessions) * 100);
  }, [completedCount, group]);

  const currentMeta = useMemo(() => {
    if (!selectedSession) return null;
    return sessionMetas.find(m => m.sessionId === selectedSession.id) || {
      groupId: groupId!,
      sessionId: selectedSession.id,
      sessionNumber: selectedSession.sessionNumber,
      opsChecklist: { recordingUploaded: false, tasksEvaluated: false, taskSent: false, whatsappConfirmationSent: false },
      opsChecklistCheckedBy: {},
      revision: { revisioned: false }
    } as SessionMeta;
  }, [selectedSession, sessionMetas, groupId]);

  useEffect(() => {
    if (!groupId) return;
    checkAndBackfillStudentCredentials();
    const fetchGroup = async () => {
      try {
        const g = await getDocument<Group>('groups', groupId);
        if (!g) navigate('/groups');
        else setGroup(g);
      } catch (err: any) { setQueryError(`Failed to load group: ${err.message}`); }
    };
    fetchGroup();

    const unsubStudents = subscribeToCollection<Student>('students', setStudents, [where('groupId', '==', groupId)]);
    const unsubSessions = subscribeToCollection<Session>('sessions', (data) => {
      const sorted = [...data].sort((a, b) => a.sessionNumber - b.sessionNumber);
      setSessions(sorted);
    }, [where('groupId', '==', groupId)]);

    const unsubEvals = subscribeToCollection<LectureEvaluation>('lectureEvaluations', (data) => {
      // Deduplicate to prevent duplicate entries from multiple scans/manual creations
      const uniqueEvalsMap = new Map<string, LectureEvaluation>();
      for (const ev of data) {
        if (ev.studentId === undefined || ev.sessionNumber === undefined) continue;
        const key = `${ev.studentId}_${ev.sessionNumber}`;
        const existing = uniqueEvalsMap.get(key);
        if (!existing) {
          uniqueEvalsMap.set(key, ev);
        } else {
          const merged = { ...existing, ...ev };
          if (existing.attendance === 1 || ev.attendance === 1) {
            merged.attendance = 1;
          }
          uniqueEvalsMap.set(key, merged);
        }
      }
      setEvaluations(Array.from(uniqueEvalsMap.values()));
    }, [where('groupId', '==', groupId)]);
    const unsubFollowUps = subscribeToCollection<StudentFollowUp>('studentFollowUps', setStudentFollowUps, [where('groupId', '==', groupId)]);
    const unsubExemptions = subscribeToCollection<FollowUpSuggestionExemption>('followUpSuggestionExemptions', setSuggestionExemptions, [where('groupId', '==', groupId)]);
    const unsubPenalties = subscribeToCollection<Penalty>('penalties', (data) => {
      const sorted = [...data].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
      setPenalties(sorted);
    }, [where('groupId', '==', groupId)]);

    // Optimize: Convert real-time global collection subscriptions to one-time fetches to reduce reads
    const { collection, getDocs } = firestore as any;
    getDocs(collection(db, 'courses')).then((snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Course));
      setCourses(items);
    }).catch((err: any) => console.error("Error loading courses:", err));

    getDocs(collection(db, 'users')).then((snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as User));
      const filtered = items.filter(u => ['trainer', 'team_leader', 'coordinator', 'admin'].includes(u.role) && !u.disabled);
      setTrainers(filtered);
    }).catch((err: any) => console.error("Error loading users:", err));

    const unsubMetas = subscribeToCollection<SessionMeta>('sessionMeta', setSessionMetas, [where('groupId', '==', groupId)]);
    const unsubFeedback = subscribeToCollection<LectureFeedback>('feedback', setFeedbacks, [where('groupId', '==', groupId)]);
    
    const unsubRankings = subscribeToCollection<GroupRanking>('groupRankings', (data) => { 
      const sorted = [...data].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
      setRankings(sorted); 
    }, [where('groupId', '==', groupId)]);

    const unsubGradProjects = subscribeToCollection<GraduationProject>('graduationProjects', (data) => {
      const filtered = data.filter(p => p.groupId === groupId || (p.assignedGroupIds && p.assignedGroupIds.includes(groupId)));
      setGradProjects(filtered);
    });
    const unsubGradSubmissions = subscribeToCollection<GraduationProjectSubmission>('graduationSubmissions', setGradSubmissions, [where('groupId', '==', groupId)]);
    const unsubCerts = subscribeToCollection<StudentCertificateRecord>('studentCertificates', setCertificateRecords, [where('groupId', '==', groupId)]);
    const unsubWeaknesses = subscribeToCollection<StudentWeaknessPoint>('studentWeaknesses', setGroupWeaknesses, [where('groupId', '==', groupId)]);

    return () => { 
      unsubStudents(); 
      unsubSessions(); 
      unsubEvals(); 
      unsubFollowUps();
      unsubExemptions();
      unsubRankings();
      unsubPenalties(); 
      unsubMetas(); 
      unsubFeedback(); 
      unsubGradProjects();
      unsubGradSubmissions();
      unsubCerts();
      unsubWeaknesses();
    };
  }, [groupId, navigate]);

  const handleTabChange = (tab: string) => {
    setEvalSearchQuery('');
    setActiveTab(tab);
  };

  const handleSaveMeta = async (updatedMeta: Partial<SessionMeta>) => {
    if (!canEvaluate) return;
    try { await saveSessionMeta(updatedMeta, user); } catch (err: any) { console.error(err); }
  };

  const handleRealTimeEvalUpdate = async (studentId: string, criteria: keyof LectureEvaluation, value: any) => {
    if (!selectedSession || !groupId || !canEvaluate) return;
    const student = students.find(s => s.id === studentId);
    if (student?.deactivated) return;
    const existingEval = evaluations.find(e => e.studentId === studentId && e.sessionNumber === selectedSession.sessionNumber) || {};
    const updatedEval: any = {
      ...existingEval,
      [criteria]: value,
      groupId,
      studentId,
      sessionNumber: selectedSession.sessionNumber,
      sessionId: selectedSession.id,
      evaluatorId: user.uid,
      updatedAt: serverTimestamp()
    };
    try { await batchSaveEvaluations([updatedEval]); } catch (err: any) { console.error(err); }
  };

  const handleRealTimeProjectUpdate = async (studentId: string, score: number) => {
    if (!groupId || !canEvaluate) return;
    const student = students.find(s => s.id === studentId);
    if (student?.deactivated) return;
    try {
      await batchSaveProjectScores(groupId, [{ studentId, score, note: "" }]);
    } catch (err: any) { console.error(err); }
  };

  const updateTaskPoints = (studentId: string, delta: number) => {
    const existing = evaluations.find(e => e.studentId === studentId && e.sessionNumber === selectedSession?.sessionNumber);
    const currentPoints = existing?.taskDelivered || 0;
    const newPoints = Math.max(0, currentPoints + delta);
    handleRealTimeEvalUpdate(studentId, 'taskDelivered', newPoints);
  };

  const toggleBooleanCriteria = (studentId: string, criteria: keyof LectureEvaluation) => {
    const existing = evaluations.find(e => e.studentId === studentId && e.sessionNumber === selectedSession?.sessionNumber);
    const currentVal = (existing as any)?.[criteria] === 1 ? 0 : 1;
    handleRealTimeEvalUpdate(studentId, criteria, currentVal);
  };

  const toggleTaskNotSubmittedPenalty = async (studentId: string) => {
    if (!selectedSession || !groupId || !canEvaluate) return;
    const existingEval = evaluations.find(e => e.studentId === studentId && e.sessionNumber === selectedSession.sessionNumber) || {};
    const isCurrentlyPenalized = !!existingEval.taskNotSubmittedPenalty;

    const updatedEval: any = {
      ...existingEval,
      taskNotSubmittedPenalty: !isCurrentlyPenalized,
      ...( !isCurrentlyPenalized ? {
        taskDelivered: 0,
        taskOnTime: 0,
        taskQuality: 0,
        taskRedo: 0,
      } : {} ),
      groupId,
      studentId,
      sessionNumber: selectedSession.sessionNumber,
      sessionId: selectedSession.id,
      evaluatorId: user.uid,
      updatedAt: serverTimestamp()
    };

    try {
      await batchSaveEvaluations([updatedEval]);
      
      if (!isCurrentlyPenalized) {
        await sendNotification({
          userId: studentId,
          title: `⚠️ إلغاء تقييم وخصم نقطة لعدم تسليم التاسك`,
          message: `تم إلغاء تقييم المحاضرة رقم ${selectedSession.sessionNumber} وخصم 1 نقطة بسبب عدم تسليم الواجب المطلوب.`,
          type: 'task_status',
          link: `/student-portal?studentId=${studentId}`
        });
      }
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تعديل حالة خصم عدم تسليم التاسك');
    }
  };

  const handlePostpone = async () => {
    if (!editingSessionDate || !newDateValue || !dateChangeReason || !group) return;
    
    setIsShifting(true);
    try {
      await shiftSessionDates(group.id, editingSessionDate.sessionNumber, user, newDateValue, dateChangeReason);
      
      // Notify students of the date shift!
      try {
        for (const student of students) {
          await sendNotification({
            userId: student.id,
            title: `📅 تغيير وتأجيل موعد محاضرة`,
            message: `تم تعديل وتأجيل موعد المحاضرة رقم ${editingSessionDate.sessionNumber} لمجموعتكم ${group.name} إلى يوم: ${newDateValue}. يرجى مراجعة الجدول الجديد.`,
            type: 'task_status',
            link: `/student-portal?studentId=${student.id}`
          });
        }
      } catch (notifErr) {
        console.error("Failed to notify students of shifted dates:", notifErr);
      }

      setEditingSessionDate(null);
      setNewDateValue('');
      setDateChangeReason('');
      alert('تم تعديل التاريخ وترحيل المحاضرات القادمة بنجاح');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تعديل التاريخ');
    } finally {
      setIsShifting(false);
    }
  };

  const handleSaveSessionStatuses = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(draftSessionStatus).map(([id, status]) => ({ id, status: status as 'upcoming' | 'done' }));
      await batchUpdateSessions(updates);
      setDraftSessionStatus({});
    } catch (err: any) { alert(err.message); }
    finally { setIsSaving(false); }
  };

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      await Promise.all(students.map(s => recalculateStudentRanking(groupId!, s.id)));
      alert("Rankings synced.");
    } catch (err: any) { alert(err.message); }
    finally { setIsRecalculating(false); }
  };

  const handleAddPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!penaltyFormData.studentId || !penaltyFormData.reason) return;
    try {
      await addPenalty({ ...penaltyFormData, groupId: groupId! }, user);
      setPenaltyFormData({ studentId: '', points: 5, reason: '' });
    } catch (err: any) { alert(err.message); }
  };

  const handleRequestSupervisorFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpStudent || !followUpNote || !followUpDeadline || !group) return;
    try {
      setIsSaving(true);
      const mentionedUser = trainers.find(t => t.uid === followUpMentionedUser);
      await requestSupervisorFollowUp({
        groupId: group.id,
        groupName: group.name,
        studentId: followUpStudent.id,
        studentName: followUpStudent.name,
        deadline: followUpDeadline,
        note: followUpNote,
        mentionedUserId: followUpMentionedUser || undefined,
        mentionedUserName: mentionedUser?.name || undefined,
        labels: followUpLabels
      }, user);
      setIsSupervisorModalOpen(false);
      setFollowUpStudent(null);
      setFollowUpNote('');
      setFollowUpDeadline('');
      setFollowUpMentionedUser('');
      setFollowUpLabels([]);
      alert("Follow-up order sent.");
    } catch (err: any) { alert(err.message); }
    finally { setIsSaving(false); }
  };

  const exportStudentTaskReport = async (student: Student, type: 'full' | 'missing' | 'missing_trainee') => {
    const studentEvals = evaluations.filter(e => e.studentId === student.id);
    const totalRequired = sessions.filter(s => s.status === 'done').reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
    const totalCompleted = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
    const completionRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100;

    const totalSessionsDone = sessions.filter(s => s.status === 'done').length;
    const uniqueAttendedSessions = new Set(
      studentEvals.filter(e => e.attendance === 1 && e.sessionNumber !== undefined).map(e => e.sessionNumber)
    );
    const totalAttended = Math.min(uniqueAttendedSessions.size, totalSessionsDone);
    const attendanceRate = totalSessionsDone > 0 ? Math.min(100, Math.round((totalAttended / totalSessionsDone) * 100)) : 100;

    const reportSessions = sessions.map(s => {
      const ev = studentEvals.find(e => e.sessionNumber === s.sessionNumber);
      const completed = ev?.taskDelivered || 0;
      const required = s.requiredTasksCount || 0;
      const remaining = Math.max(0, required - completed);
      
      // Only show attendance status if the session is done
      const attendanceStatus = s.status === 'done' 
        ? (ev ? (ev.attendance === 1 ? 'حضور' : 'غياب') : 'غياب')
        : '-';

      return { ...s, completed, required, remaining, attendanceStatus };
    }).filter(s => {
      if (type === 'full') return true;
      // For 'missing' report, only show sessions that are DONE and have remaining tasks
      return s.status === 'done' && s.remaining > 0;
    });

    const missingSessionsCount = reportSessions.filter(s => s.remaining > 0).length;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial, sans-serif'; // Fallback, will use system fonts that support Arabic
    container.dir = 'rtl';
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 10px 0;">تقرير المهام الأكاديمية</h1>
        <h2 style="color: #334155; font-size: 18px; margin: 0;">${type === 'full' ? 'التقرير الشامل' : type === 'missing' ? 'المهام المتأخرة' : 'المهام المتأخرة (للمتدرب)'}</h2>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">اسم الطالب</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">${student.name}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">كود الطالب (ID)</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">${student.studentIdNum || '-'}</p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">المجموعة</p>
          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">${group?.name || '-'}</p>
        </div>
        ${type !== 'missing_trainee' ? `
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">نسبة الحضور</p>
          <p style="margin: 0; color: ${attendanceRate >= 80 ? '#10b981' : attendanceRate >= 50 ? '#f59e0b' : '#ef4444'}; font-size: 16px; font-weight: bold;">${attendanceRate}%</p>
        </div>
        ` : ''}
        <div>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">نسبة الإنجاز (المهام)</p>
          <p style="margin: 0; color: ${completionRate >= 80 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444'}; font-size: 16px; font-weight: bold;">${completionRate}%</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">المحاضرة</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">التاريخ</th>
            ${type !== 'missing_trainee' ? `
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">الحالة</th>
            ` : ''}
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">عنوان المحاضرة</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">المطلوب</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">المنجز</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">المتبقي</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 14px;">الروابط</th>
          </tr>
        </thead>
        <tbody>
          ${reportSessions.map(s => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; color: #0f172a; font-weight: bold;">المحاضرة ${s.sessionNumber}</td>
              <td style="padding: 12px; color: #64748b; font-size: 12px;">${s.date || '-'}</td>
              ${type !== 'missing_trainee' ? `
              <td style="padding: 12px; color: ${s.attendanceStatus === 'حضور' ? '#10b981' : '#ef4444'}; font-weight: bold;">${s.attendanceStatus}</td>
              ` : ''}
              <td style="padding: 12px; color: #334155;">${s.lectureTitle || '-'}</td>
              <td style="padding: 12px; text-align: center; color: #64748b;">${s.required}</td>
              <td style="padding: 12px; text-align: center; color: #10b981; font-weight: bold;">${s.completed}</td>
              <td style="padding: 12px; text-align: center; color: ${s.remaining > 0 ? '#ef4444' : '#64748b'}; font-weight: bold;">${s.remaining}</td>
              <td style="padding: 12px; text-align: center;">
                ${s.lectureRecordingUrl ? `<a href="${s.lectureRecordingUrl}" style="color: #3b82f6; text-decoration: none; margin-left: 8px; display: inline-block;">🎥 تسجيل</a>` : ''}
                ${s.tasksMessageUrl ? `<a href="${s.tasksMessageUrl}" style="color: #3b82f6; text-decoration: none; display: inline-block;">🔗 المهام</a>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${type === 'full' ? `
      <div style="background: ${missingSessionsCount > 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${missingSessionsCount > 0 ? '#fecaca' : '#bbf7d0'}; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0; color: ${missingSessionsCount > 0 ? '#991b1b' : '#166534'}; font-weight: bold; font-size: 16px;">
          ${missingSessionsCount > 0 ? `يوجد مهام متأخرة في ${missingSessionsCount} محاضرات` : 'ممتاز! لا يوجد أي مهام متأخرة'}
        </p>
      </div>
      ` : ''}

      <div style="background: #e0f2fe; border: 1px solid #bae6fd; padding: 16px; border-radius: 12px; text-align: center; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="font-size: 20px;">🔑</span>
        <span style="color: #0369a1; font-weight: bold; font-size: 13px; line-height: 1.6; margin-left: 12px;">
          للحصول على الباسوورد الخاص بك برجاء التواصل مع خدمة العملاء من هنا:
        </span>
        <a href="https://wa.me/201553719496?text=${encodeURIComponent(`مرحباً خدمة العملاء، أريد الحصول على الباسوورد الخاص بي للسيستم.\nالاسم: ${student.name}\nرقم الكود: ${student.studentIdNum || 'غير محدد'}\nاسم المجموعة/الجروب: ${group?.name || '-'}`)}" 
           style="background-color: #25d366; color: white !important; font-weight: 950; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(37,211,102,0.2);"
           target="_blank">
          💬 تواصل عبر واتساب (01553719496)
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

      pdf.save(`تقرير_المهام_${student.name.replace(/\s+/g, '_')}_${type}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      document.body.removeChild(container);
    }
  };

  const taskProgressData = useMemo(() => {
    const activeStudents = students.filter(s => !s.deactivated);
    let data = activeStudents.map(student => {
      const studentEvals = evaluations.filter(e => e.studentId === student.id);
      // Only count required tasks for sessions that are DONE for performance metrics
      const totalRequired = sessions.filter(s => s.status === 'done').reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
      const totalCompleted = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
      const missingCount = sessions.filter(s => {
        if (s.status !== 'done') return false;
        const ev = studentEvals.find(e => e.sessionNumber === s.sessionNumber);
        return (s.requiredTasksCount || 0) > (ev?.taskDelivered || 0);
      }).length;
      const completionRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100;

      const followUp = studentFollowUps.find(f => f.studentId === student.id && f.groupId === groupId);
      const resetSessionNum = followUp?.attendanceResetSessionNumber || 0;

      const sessionsForAtt = sessions.filter(s => s.status === 'done' && s.sessionNumber > resetSessionNum);
      const totalSessionsDone = sessionsForAtt.length;
      const uniqueAttendedSessions = new Set(
        studentEvals.filter(e => e.attendance === 1 && e.sessionNumber > resetSessionNum).map(e => e.sessionNumber)
      );
      const totalAttended = Math.min(uniqueAttendedSessions.size, totalSessionsDone);
      const attendanceRate = totalSessionsDone > 0 ? Math.min(100, Math.round((totalAttended / totalSessionsDone) * 100)) : 100;

      return {
        student,
        totalRequired,
        totalCompleted,
        completionRate,
        attendanceRate,
        missingCount,
        evals: studentEvals
      };
    });

    // Apply Filters
    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.toLowerCase();
      data = data.filter(d => d.student.name.toLowerCase().includes(q));
    }
    if (taskFilterMissingOnly) {
      data = data.filter(d => d.missingCount > 0);
    }
    if (taskFilterCompletionThreshold > 0) {
      data = data.filter(d => d.completionRate < taskFilterCompletionThreshold);
    }
    if (taskFilterSessionNum !== '') {
      data = data.filter(d => {
        const s = sessions.find(sess => sess.sessionNumber === taskFilterSessionNum);
        if (!s) return false;
        const ev = d.evals.find(e => e.sessionNumber === s.sessionNumber);
        return (s.requiredTasksCount || 0) > (ev?.taskDelivered || 0);
      });
    }

    // Apply Sorting
    data.sort((a, b) => {
      if (taskSortBy === 'missing') return b.missingCount - a.missingCount;
      if (taskSortBy === 'completion') return a.completionRate - b.completionRate;
      return a.student.name.localeCompare(b.student.name);
    });

    return data;
  }, [students, evaluations, sessions, taskSearchQuery, taskFilterMissingOnly, taskFilterCompletionThreshold, taskFilterSessionNum, taskSortBy, studentFollowUps, groupId]);

  useEffect(() => {
    if (!highlightedStudentId || activeTab !== 'taskProgress') return;
    const row = taskProgressRowRefs.current[highlightedStudentId];
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timer = setTimeout(() => setHighlightedStudentId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedStudentId, activeTab, taskProgressData]);

  const [labelDefinitions, setLabelDefinitions] = useState<LabelDefinition[]>([]);
  const [selectedStudentForLabel, setSelectedStudentForLabel] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    const { collection, getDocs } = firestore as any;
    getDocs(collection(db, 'labelDefinitions')).then((snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as LabelDefinition));
      setLabelDefinitions(items);
    }).catch((err: any) => console.error("Error loading labelDefinitions:", err));
  }, []);

  // Automated Follow-up Trigger Logic
  useEffect(() => {
    if (!group || !user || !taskProgressData.length) return;
    
    const syncFollowUps = async () => {
      for (const d of taskProgressData) {
        const studentEvals = evaluations.filter(e => e.studentId === d.student.id && e.attendance !== undefined);
        const totalSessionsDoneOverall = sessions.filter(s => s.status === 'done').length;
        
        // Fetch current follow-up to keep existing manual labels
        const currentFollowUp = studentFollowUps.find(f => f.studentId === d.student.id && f.groupId === group.id);
        const existingLabels = currentFollowUp?.labels || [];
        
        const resetSessionNum = currentFollowUp?.attendanceResetSessionNumber || 0;
        const sessionsDoneCountAfterReset = sessions.filter(s => s.status === 'done' && s.sessionNumber > resetSessionNum).length;
        
        // Only absence and tasks are managed automatically based on the 70% threshold
        const automatedLabels = ['absence', 'tasks'];
        const otherLabels = existingLabels.filter(l => !automatedLabels.includes(l));
        
        const newAutoLabels: string[] = [];
        const isExempt = (reason: 'absence' | 'tasks') =>
          suggestionExemptions.some(e => e.studentId === d.student.id && e.groupId === group.id && e.reason === reason);

        // Check attendance warning (skip entirely if the student has a standing exemption for it)
        if (!isExempt('absence')) {
          if (sessionsDoneCountAfterReset >= 2) {
            if (d.attendanceRate < 70) newAutoLabels.push('absence');
          } else if (resetSessionNum === 0 && totalSessionsDoneOverall >= 3) {
            if (d.attendanceRate < 70) newAutoLabels.push('absence');
          }
        }

        // Check tasks warning (skip entirely if the student has a standing exemption for it)
        if (!isExempt('tasks') && totalSessionsDoneOverall >= 3) {
          if (d.completionRate < 70) newAutoLabels.push('tasks');
        }

        const finalLabels = Array.from(new Set([...otherLabels, ...newAutoLabels]));
        
        // Only update if labels changed
        const hasChanged = JSON.stringify(finalLabels.sort()) !== JSON.stringify(existingLabels.sort());
        
        if (hasChanged) {
          try {
             await updateFollowUpLabels(group.id, group.name, d.student.id, d.student.name, finalLabels, { isAutomaticSync: true });
          } catch (err) {
             console.error("Error syncing follow up labels:", err);
          }
        }
      }
    };

    const timer = setTimeout(syncFollowUps, 5000); 
    return () => clearTimeout(timer);
  }, [group?.id, taskProgressData, user, studentFollowUps, suggestionExemptions]);

  const toggleStudentLabel = async (studentId: string, studentName: string, labelName: string) => {
    const currentFollowUp = studentFollowUps.find(f => f.studentId === studentId && f.groupId === group?.id);
    const existingLabels = currentFollowUp?.labels || [];
    let newLabels;
    if (existingLabels.includes(labelName)) {
      newLabels = existingLabels.filter(l => l !== labelName);
    } else {
      newLabels = [...existingLabels, labelName];
    }
    
    try {
      await updateFollowUpLabels(group!.id, group!.name, studentId, studentName, newLabels);
    } catch (err: any) {
      alert(err.message);
    }
  };
  const execSave = async (sessionId: string, payload: any) => {
    const { saveSessionExecution } = await import('../services/firestore');
    let finalPayload = { ...payload };
    if (['trainer', 'team_leader'].includes(user.role)) {
      finalPayload.actualTrainerId = user.uid;
      finalPayload.actualTrainerName = user.name;
    }
    await saveSessionExecution(sessionId, finalPayload, user);
  };

  // Auto-end sessions that have been running for more than 3 hours (180 minutes)
  useEffect(() => {
    if (sessions.length === 0) return;

    const checkAndAutoEndSessions = async () => {
      // Find any running session in the group
      const runningSession = sessions.find(s => s.smartAssistantState && s.smartAssistantState !== 'idle');
      if (!runningSession || !runningSession.startTimeActual) return;

      const isSessionOverTimeLimit = (dateStr: string, startStr: string): boolean => {
        try {
          const totalMins = parseTimeToMinutes(startStr);
          if (totalMins === null) return false;
          const hour = Math.floor(totalMins / 60);
          const min = totalMins % 60;

          const dateParts = dateStr.split('-');
          if (dateParts.length < 3) return false;
          const [year, month, day] = dateParts.map(Number);

          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          });
          const cairoParts = formatter.formatToParts(new Date());
          const cairoYear = parseInt(cairoParts.find(p => p.type === 'year')?.value || '0', 10);
          const cairoMonth = parseInt(cairoParts.find(p => p.type === 'month')?.value || '0', 10);
          const cairoDay = parseInt(cairoParts.find(p => p.type === 'day')?.value || '0', 10);
          const cairoHour = parseInt(cairoParts.find(p => p.type === 'hour')?.value || '0', 10);
          const cairoMinute = parseInt(cairoParts.find(p => p.type === 'minute')?.value || '0', 10);

          const startDateLocal = new Date(year, month - 1, day, hour, min, 0, 0);
          const cairoNowLocal = new Date(cairoYear, cairoMonth - 1, cairoDay, cairoHour, cairoMinute, 0, 0);

          const diffMs = cairoNowLocal.getTime() - startDateLocal.getTime();
          const diffMinutes = diffMs / (1000 * 60);

          return diffMinutes >= 180; // 3 hours = 180 minutes
        } catch (e) {
          console.error("Error in check auto-end calculation:", e);
          return false;
        }
      };

      const useDateStr = runningSession.actualStartDate || runningSession.date;
      if (useDateStr && isSessionOverTimeLimit(useDateStr, runningSession.startTimeActual)) {
        console.log(`Auto-ending session ${runningSession.sessionNumber} because it exceeded limit`);
        const maxCourseLimit = courses.find(c => c.id === group?.courseId)?.maxApprovedHours || 3;
        const endTimeStr = getCairoTimeStr();
        const { actualHours: calcAct, approvedHours: calcApp, durationMinutes } = calculateActualAndApprovedHours(
          runningSession.startTimeActual,
          endTimeStr,
          maxCourseLimit
        );

        try {
          await execSave(runningSession.id, {
            endTimeActual: endTimeStr,
            status: 'done',
            smartAssistantState: 'idle',
            actualHours: calcAct,
            approvedHours: calcApp,
            durationActual: durationMinutes,
            smartEventsLog: [
              ...(runningSession.smartEventsLog || []),
              {
                eventType: 'end',
                timestamp: endTimeStr,
                text: 'تم إنهاء المحاضرة تلقائياً بالسيستم لتجاوزها حد 3.5 ساعات'
              }
            ]
          });
        } catch (err) {
          console.error("Error auto-ending session over time limit:", err);
        }
      }
    };

    // Run check initially
    checkAndAutoEndSessions();

    // Set interval to check every 30 seconds
    const interval = setInterval(checkAndAutoEndSessions, 30000);
    return () => clearInterval(interval);
  }, [sessions]);

  if (!group) return <div className="h-screen flex items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <Layout user={user}>
      {/* Group Header */}
      <div className="mb-6 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="z-10 w-full md:w-auto text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Batch {group.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && <button onClick={() => setIsEditModalOpen(true)} className="bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-full border border-slate-700 text-[9px] font-black uppercase transition-all tracking-wider">Edit Group</button>}
              <button
                type="button"
                onClick={() => setIsTrainerEmailModalOpen(true)}
                className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-3.5 py-1.5 rounded-full border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1.5 font-arabic shadow-sm cursor-pointer"
                title="إرسال إيميل جماعي لجميع طلاب الجروب عبر بريد النظام المركزى"
              >
                <Mail className="w-3.5 h-3.5 text-blue-400 group-hover:text-white" />
                <span>إرسال إيميل جماعي للطلاب 📧</span>
              </button>
              <button
                type="button"
                onClick={handleOpenBulkWelcomeModal}
                disabled={sendingWelcomeEmails}
                className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3.5 py-1.5 rounded-full border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 font-arabic shadow-sm cursor-pointer disabled:opacity-50"
                title="إرسال ايميل الترحيب الرسمي وبيانات الدخول الحالية لجميع طلاب الجروب"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                <span>إرسال ايميلات الترحيب ودخول النظام 🚀</span>
              </button>
            </div>
          </div>
          <p className="text-slate-400 font-medium flex flex-wrap justify-center md:justify-start items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span> {group.courseName} • {formatTime12h(group.sessionTime)}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-all font-arabic cursor-pointer mr-2 shadow-sm"
                title="اضغط لتغيير مسار الكورس الخاص بهذا الجروب وإعادة هيكلة جدول الخطة التعليمية بنفس الطلاب والبيانات"
              >
                <span>🔄 تغيير الكورس وإعادة الهيكلة</span>
              </button>
            )}
          </p>
        </div>
        <div className="flex-1 max-w-md w-full z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[2px]">Progress</span>
            <span className="text-xs font-black text-blue-400">{completedCount} / {group.totalSessions}</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 p-0.5">
            <div className="h-full bg-blue-600 rounded-2xl transition-all duration-700 shadow-[0_0_15px_rgba(37,99,235,0.4)]" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden">
        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-2 px-1">
          أقسام الجروب
        </span>
        <nav className="flex gap-1.5 bg-slate-900 p-1.5 rounded-2xl w-full md:w-fit overflow-x-auto no-scrollbar scroll-smooth shadow-inner border border-slate-800">
          {([
            ['lectures', 'المحاضرات', BookOpen],
            ['evaluation', 'التقييمات', ClipboardCheck],
            ['taskProgress', 'Task Progress', ListTodo],
            ['penalties', 'الجزاءات', AlertTriangle],
            ['ranking', 'الترتيب', Trophy],
            ['students', 'الطلاب', Users],
            ['feedback', 'تقييمات المحاضرات', Star],
            ['graduationProjects', 'مشاريع التخرج', GraduationCap],
            ['certificates', 'الشهادات', Award],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap tracking-wider flex-1 md:flex-none ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'lectures' && (() => {
        // Calculations for Saber Group bento metrics
        const totalItemsCount = groupPlan?.items?.length || 0;
        const completedItemsCount = groupPlan?.items?.filter((i: any) => i.isCompleted).length || 0;
        const checklistPercent = totalItemsCount > 0 ? Math.round((completedItemsCount / totalItemsCount) * 100) : 0;

        const completedLectures = sessions.filter(s => s.status === 'done');
        const actHoursSum = completedLectures.reduce((s, x) => s + (Number(x.actualHours) || 0), 0);
        const appHoursSum = completedLectures.reduce((s, x) => s + (Number(x.approvedHours) || 0), 0);
        
        const maxCourseLimit = courses.find(c => c.id === group?.courseId)?.maxApprovedHours || 3;
        const isLimitViolated = completedLectures.some(x => (Number(x.approvedHours) || 0) > maxCourseLimit);

        return (
          <div className="space-y-6 text-right font-arabic">
            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Checklist progress */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1">نسبة إنجاز بنود المحتوى (Checklist)</span>
                  <p className="text-2xl font-black text-emerald-400 mt-2">{checklistPercent}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">تغطية {completedItemsCount} من أصل {totalItemsCount} مخرج تعليمي</p>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${checklistPercent}%` }}></div>
                </div>
              </div>

              {/* Card 2: Cumulative Actual Hours */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1">مجموع الساعات الفعلية المتراكمة</span>
                  <p className="text-2xl font-black text-slate-200 mt-2">{actHoursSum} <span className="text-xs font-bold text-slate-500">ساعة</span></p>
                  <p className="text-[11px] text-slate-400 mt-1">إجمالي الحضور الزمني للمدرب في الجلسات</p>
                </div>
                <span className="text-[10px] bg-slate-800/60 px-2 py-0.5 rounded text-slate-400 self-start mt-3">سجل الزمن الفعلي</span>
              </div>

              {/* Card 3: Cumulative Approved Hours */}
              <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1 font-arabic">الساعات المعتمدة للراتب (Payroll)</span>
                  <p className="text-2xl font-black text-blue-400 mt-2">{appHoursSum} <span className="text-xs font-bold text-slate-500">ساعة</span></p>
                  <p className="text-[11px] text-slate-400 mt-1">بحد أقصى مسموح {maxCourseLimit} ساعات لكل محاضرة</p>
                </div>
                {isLimitViolated ? (
                  <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-900/40 px-2.5 py-0.5 rounded-full font-black self-start mt-3">
                    ⚠️ تنبيه: تجاوز للحد الأقصى!
                  </span>
                ) : (
                  <span className="text-[9px] bg-green-950/40 text-green-455 border border-green-900/40 px-2.5 py-0.5 rounded-full font-black self-start mt-3">
                    ✔ ساعات معافاة وضمن الحدود
                  </span>
                )}
              </div>

              {/* Card 4: Multi-trainer metrics & Integrity Status */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold block mb-1">الالتزام بالجدول الفني والمحاضرين</span>
                  <div className="text-xs font-extrabold text-slate-300 leading-snug mt-2 space-y-1">
                    <div>المدرب الأساسي: {group?.primaryTrainerId || group?.trainerIds?.[0] ? (trainers.find(t => t.uid === (group?.primaryTrainerId || group?.trainerIds?.[0]))?.name || 'لم يحدد') : 'لم يحدد'}</div>
                    {(group?.secondaryTrainerId || group?.trainerIds?.[1]) && (
                      <div className="text-[11px] text-slate-400 font-medium">المدرب الثانوي: {trainers.find(t => t.uid === (group?.secondaryTrainerId || group?.trainerIds?.[1]))?.name || 'لم يحدد'}</div>
                    )}
                    {(group?.assistantTrainerId || group?.assistantTrainerName) && (
                      <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <span>المدرب المُساعد:</span>
                        <span className="font-bold">{trainers.find(t => t.uid === group?.assistantTrainerId)?.name || group?.assistantTrainerName || 'لم يحدد'}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">المدربون الإجمالين النشطين: {trainers.length} محاضرين بقاعدة البيانات</p>
                </div>
                <div className="text-[10px] bg-sky-950/30 text-sky-400 border border-sky-900/45 px-2.5 py-0.5 rounded self-start mt-3 font-semibold">
                  {completedLectures.length} محاضرات مكتملة بنجاح
                </div>
              </div>
            </div>

            {/* Standard schedule card container */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="p-6 md:p-8 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white tracking-tight">Batch Schedule</h3>
                    {group?.groupType === 'offline' ? (
                      <span className="text-[10px] font-black bg-amber-950/60 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded-full">
                        🏢 أوفلاين (بمقر الأكاديمية)
                      </span>
                    ) : (
                      <span className="text-[10px] font-black bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                        🌐 أونلاين
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Session Status & Google Calendar Sync</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Google Schedule Launch Buttons */}
                  <button
                    onClick={() => handleSyncGoogleCalendar(false)}
                    disabled={syncingGoogleCalendar}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
                  >
                    {syncingGoogleCalendar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                    {isAr ? 'تشغيل مواعيد Google (Launch Schedule)' : 'Launch Google Schedule'}
                  </button>

                  {sessions.some(s => s.googleSyncStatus === 'failed') && (
                    <button
                      onClick={() => handleSyncGoogleCalendar(true)}
                      disabled={syncingGoogleCalendar}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogleCalendar ? 'animate-spin' : ''}`} />
                      {isAr ? 'إعادة محاولة المزامنة الفاشلة' : 'Retry Failed Sync'}
                    </button>
                  )}

                  {Object.keys(draftSessionStatus).length > 0 && canEvaluate && (
                    <button onClick={handleSaveSessionStatuses} disabled={isSaving} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg">
                      {isSaving ? 'Saving...' : 'Save Status'}
                    </button>
                  )}
                </div>
              </div>

              {googleSyncMessage && (
                <div className={`p-4 text-xs font-bold border-b flex items-center justify-between ${
                  googleSyncMessage.type === 'success' 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                    : 'bg-rose-950/40 text-rose-400 border-rose-900/50'
                }`}>
                  <span>{googleSyncMessage.text}</span>
                  <button onClick={() => setGoogleSyncMessage(null)} className="opacity-70 hover:opacity-100">&times;</button>
                </div>
              )}

              {missingEmailsList.length > 0 && (
                <div className="p-4 bg-amber-950/30 border-b border-amber-800/50 font-arabic text-right" dir="rtl">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-black text-xs">⚠️ قائمة مراجعة الطلاب دون Attendance Email ({missingEmailsList.length} طلاب)</span>
                    </div>
                    <button 
                      onClick={() => setMissingEmailsList([])}
                      className="text-[10px] text-amber-300 hover:underline font-bold"
                    >
                      إغلاق القائمة ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">
                    لم تتم إضافة هؤلاء الطلاب إلى دعوة Google Calendar لعدم وجود بريد إلكتروني للحضور (Attendance Email). يرجى إضافته من صفحة إدارة الطلاب:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {missingEmailsList.map(st => (
                      <div key={st.id} className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-200">{st.name}</p>
                          <p className="text-[10px] font-mono text-slate-500">{st.studentIdNum || st.phone || 'بدون ID'}</p>
                        </div>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold">بدون إيميل</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Session</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Lecture Title</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Date</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Google Calendar / Meet</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Tasks Count</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Recording URL</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Status</th>
                      <th className="px-6 py-4 text-right font-black uppercase text-[10px] text-slate-500 tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sessions.map(s => {
                      const draftStatus = draftSessionStatus[s.id] || s.status;
                      return (
                        <tr key={s.id} className={`hover:bg-slate-800/40 transition-colors ${draftSessionStatus[s.id] ? 'bg-amber-950/20' : ''}`}>
                          <td className="px-6 py-4 font-black text-slate-200">Lecture {s.sessionNumber}</td>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              placeholder="Lecture Title"
                              defaultValue={s.lectureTitle || ''}
                              onBlur={(e) => updateSession(s.id, { lectureTitle: e.target.value }, user)}
                              className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="relative group/date">
                                <input 
                                  type="date"
                                  value={s.date || ''}
                                  readOnly
                                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 outline-none cursor-not-allowed"
                                />
                                {s.isPostponed && (
                                  <div className="absolute bottom-full left-0 mb-2 bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl z-50 opacity-0 group-hover/date:opacity-100 transition-all duration-200 translate-y-2 group-hover/date:translate-y-0 min-w-[250px] invisible group-hover/date:visible">
                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                                      <Clock size={14} className="text-amber-500" />
                                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">سجل تعديلات التاريخ</p>
                                    </div>
                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                      {s.dateHistory && s.dateHistory.length > 0 ? (
                                        s.dateHistory.map((h, idx) => (
                                          <div key={idx} className="text-[10px] border-l-2 border-amber-500/30 pl-3 py-1 bg-slate-950/30 rounded-r-lg">
                                            <div className="flex justify-between items-center text-slate-400 font-bold mb-1">
                                              <span className="text-blue-400">{h.oldDate} ← {h.newDate}</span>
                                              <span className="text-[8px] opacity-70">{h.changedAt?.toDate ? h.changedAt.toDate().getTime() : 0}</span>
                                            </div>
                                            <p className="text-slate-200 leading-relaxed font-medium">{h.reason}</p>
                                            <p className="text-[9px] text-slate-500 italic mt-1 flex items-center gap-1">
                                              <UserPlus size={10} /> {h.changedByName}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-[10px] border-l-2 border-amber-500/30 pl-3 py-1 bg-slate-950/30 rounded-r-lg">
                                          <p className="text-slate-200">{s.dateChangeReason}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingSessionDate(s);
                                  setNewDateValue(s.date || '');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-all"
                                title="تعديل التاريخ"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                            {s.isPostponed && (
                              <p className="text-[8px] text-amber-500 font-bold mt-1">تاريخ معدل</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              {s.googleSyncStatus === 'synced' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded-full w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Synced
                                </span>
                              ) : s.googleSyncStatus === 'failed' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-400 bg-rose-950/40 border border-rose-800 px-2 py-0.5 rounded-full w-fit">
                                  ✖ Sync Failed
                                </span>
                              ) : group?.groupType === 'offline' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-full w-fit">
                                  🏢 بمقر الأكاديمية
                                </span>
                              ) : null}

                              {(s.googleMeetUrl || s.meetingLink) && (
                                <a 
                                  href={s.googleMeetUrl || s.meetingLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 font-mono font-extrabold"
                                >
                                  <Video className="w-3 h-3 text-indigo-400 shrink-0" />
                                  Google Meet
                                </a>
                              )}

                              <input 
                                type="text" 
                                placeholder={group?.groupType === 'offline' ? "رابط ميتينج استثنائي (اختياري)" : "رابط Google Meet"}
                                defaultValue={s.googleMeetUrl || s.meetingLink || ''}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  updateSession(s.id, { googleMeetUrl: val, meetingLink: val }, user);
                                }}
                                className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[9px] text-indigo-300 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              type="number" 
                              min="0"
                              defaultValue={s.requiredTasksCount || 0}
                              onBlur={(e) => updateSession(s.id, { requiredTasksCount: parseInt(e.target.value) || 0 }, user)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-blue-400 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <input 
                                type="text" 
                                placeholder="Recording URL"
                                defaultValue={s.lectureRecordingUrl || ''}
                                onBlur={(e) => updateSession(s.id, { lectureRecordingUrl: e.target.value }, user)}
                                className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input 
                                type="text" 
                                placeholder="Tasks Msg URL"
                                defaultValue={s.tasksMessageUrl || ''}
                                onBlur={(e) => updateSession(s.id, { tasksMessageUrl: e.target.value }, user)}
                                className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${draftStatus === 'done' ? 'bg-green-950/30 border-green-900 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                              {draftStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setDraftSessionStatus({...draftSessionStatus, [s.id]: draftStatus === 'done' ? 'upcoming' : 'done' })} disabled={!canEvaluate} className={`text-[9px] font-black px-3 py-1.5 rounded-xl border transition-all uppercase tracking-wider ${draftStatus === 'done' ? 'border-amber-900/50 text-amber-500' : 'border-blue-900/50 text-blue-500'}`}>
                                {draftStatus === 'done' ? 'تراجع' : 'تم'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-sm">
            <h4 className="font-black text-slate-300 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Select Session
            </h4>
            <div className="flex flex-wrap gap-2">
              {sessions.map(s => {
                const isSelected = selectedSession?.id === s.id && evaluationMode === 'lecture';
                return (
                  <button 
                    key={s.id} 
                    onClick={() => { setSelectedSessionId(s.id); setEvaluationMode('lecture'); }} 
                    className={`w-11 h-11 rounded-xl text-xs font-black border transition-all flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white border-blue-500 shadow-xl' : s.status === 'done' ? 'bg-emerald-600/20 text-emerald-500 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                  >
                    {s.sessionNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="animate-fade-in">
            {evaluationMode === 'lecture' && selectedSession && currentMeta && (
              <div className="flex flex-col gap-6 text-right font-arabic">
                {/* Reordered per request: Smart Assistant + Attendance portal first,
                   then the Evaluation Grid, then lecture data + course checklist,
                   then the completed-operations checklist last. */}
                <div className="w-full space-y-6">
                  {(() => {
                    const activeSess = sessions.find(s => s.id === selectedSession.id) || selectedSession;
                    const maxAllowed = courses.find(c => c.id === group?.courseId)?.maxApprovedHours || 3;
                    const isHoursOver = (activeSess.approvedHours || 0) > maxAllowed || (activeSess.actualHours || 0) > maxAllowed;

                    return (
                      <>
                        {/* Row 1: Smart Assistant + Student Attendance Portal */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 text-right font-arabic">
                          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                            <span className="text-[9px] font-black bg-blue-950 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-900/30 font-sans">
                              Smart Assistant
                            </span>
                            <h4 className="font-extrabold text-slate-200 text-xs">المساعد الذكي لإدارة المحاضرة الفنيّة ⏱️</h4>
                          </div>

                          {/* Scheduled Date Display */}
                          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-850/60">
                            <span className="text-xs font-bold font-mono text-indigo-400">
                              {activeSess.date || 'غير محدد'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase font-arabic">التاريخ المجدول للمحاضرة:</span>
                          </div>

                          {/* Live Status Badge */}
                          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-850/60">
                            <div className="flex items-center gap-2">
                              {activeSess.smartAssistantState === 'running' && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 animate-pulse"></span>
                                </span>
                              )}
                              {activeSess.smartAssistantState === 'break' && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                                </span>
                              )}
                              {activeSess.smartAssistantState === 'practice' && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 animate-pulse"></span>
                                </span>
                              )}
                              <span className="text-xs font-black">
                                {activeSess.smartAssistantState === 'running' && 'جارية الشرح 📖'}
                                {activeSess.smartAssistantState === 'break' && 'في فترة استراحة ☕'}
                                {activeSess.smartAssistantState === 'practice' && 'تطبيق عملي نشط 💻'}
                                {(!activeSess.smartAssistantState || activeSess.smartAssistantState === 'idle') && 'خاملة / لم تبدأ 💤'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase">حالة الجلسة الحالية:</span>
                          </div>

                          {/* Live Timer Display */}
                          {elapsedTimeString && (
                            <div className="flex justify-between items-center bg-indigo-950/45 p-3 rounded-2xl border border-indigo-900/30 animate-pulse">
                              <span className="text-xs font-bold font-mono text-indigo-400">
                                {elapsedTimeString}
                              </span>
                              <span className="text-[10px] text-indigo-300 font-extrabold uppercase font-arabic">الوقت المنقضي الفعلي ⏱️:</span>
                            </div>
                          )}

                          {/* Lecture Start/End Buttons with Auto Time */}
                          <div className="space-y-3">
                            {/* Meeting Link / Offline toggle input for trainer */}
                            <div className="space-y-3 text-right font-arabic">
                              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-850/80">
                                <span className="text-[11px] font-bold text-slate-300">🏢 هذه المحاضرة حضوري في مقر الشركة (أوفلاين)</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!activeSess.isOffline}
                                    disabled={!!activeSess.startTimeActual}
                                    onChange={async (e) => {
                                      const checked = e.target.checked;
                                      await execSave(activeSess.id, { 
                                        isOffline: checked,
                                        // If toggled to offline, we can clear the meetingLink or keep it
                                        meetingLink: checked ? '' : (activeSess.meetingLink || '')
                                      });
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                                </label>
                              </div>

                              {!activeSess.isOffline && (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-slate-400 font-bold block">رابط الاجتماع للمحاضرة (Zoom / Teams / Meet) 🔗</label>
                                  
                                  {!activeSess.startTimeActual ? (
                                    // Before lecture starts, editable as normal
                                    <input
                                      type="text"
                                      placeholder="أدخل رابط الاجتماع هنا قبل بدء المحاضرة..."
                                      value={tempMeetingLink}
                                      onChange={async (e) => {
                                        setTempMeetingLink(e.target.value);
                                        await execSave(activeSess.id, { meetingLink: e.target.value });
                                      }}
                                      className="w-full text-right px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                                    />
                                  ) : (
                                    // After lecture starts, standard layout with locked state or modification mode
                                    <div className="space-y-2">
                                      {!isEditingMeetingLink ? (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setIsEditingMeetingLink(true)}
                                            className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 font-bold text-[10px] py-2 px-3 rounded-xl transition-all shrink-0 font-arabic"
                                          >
                                            تغيير الرابط 🛠️
                                          </button>
                                          <div className="flex-1 text-left overflow-x-auto whitespace-nowrap bg-slate-950 border border-slate-850 px-3 py-2 rounded-xl text-[11px] text-slate-500 font-mono scrollbar-thin">
                                            {activeSess.meetingLink || 'لا يوجد رابط مضاف'}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await execSave(activeSess.id, { meetingLink: tempMeetingLink });
                                              setIsEditingMeetingLink(false);
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-2 px-3 rounded-xl transition-all shrink-0 font-arabic"
                                          >
                                            تعديل الرابط 💾
                                          </button>
                                          <input
                                            type="text"
                                            placeholder="أدخل الرابط الجديد..."
                                            value={tempMeetingLink}
                                            onChange={(e) => setTempMeetingLink(e.target.value)}
                                            className="flex-1 text-right px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-arabic"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3 px-1 w-full">
                              <div className="flex gap-2.5">
                                {!activeSess.startTimeActual ? (
                                  /* 1. Start Lecture Button */
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!activeSess.isOffline && (!activeSess.meetingLink || !activeSess.meetingLink.trim())) {
                                        alert('برجاء إدخال رابط الاجتماع أولاً، أو اختيار خيار (المحاضرة في مقر الشركة) قبل بدء المحاضرة!');
                                        return;
                                      }
                                      // Check if there is another session currently active in this group
                                      const runningSess = sessions.find(s => s.id !== activeSess.id && s.smartAssistantState && s.smartAssistantState !== 'idle');
                                      if (runningSess) {
                                        alert(`⚠️ تنبيه: المحاضرة رقم ${runningSess.sessionNumber} (${runningSess.lectureTitle || 'بدون عنوان'}) لا تزال نشطة وجارية الآن! يجب إنهاؤها أولاً قبل بدء محاضرة جديدة.`);
                                        return;
                                      }

                                      // Check for date mismatch
                                      const todayCairo = getCairoDateISO();
                                      if (activeSess.date && activeSess.date !== todayCairo) {
                                        const confirmStart = window.confirm(
                                          `⚠️ تنبيه: تاريخ هذه المحاضرة المجدول هو (${activeSess.date}) وهو يختلف عن تاريخ اليوم في القاهرة (${todayCairo}).\n\nهل تريد حقاً بدء هذه المحاضرة؟ أم أنك بدأتها بالخطأ وتريد محاضرة أخرى؟`
                                        );
                                        if (!confirmStart) {
                                          return;
                                        }
                                      }

                                      const currentTimeStr = getCairoTimeStr();

                                      await execSave(activeSess.id, {
                                        startTimeActual: currentTimeStr,
                                        actualStartDate: todayCairo,
                                        smartAssistantState: 'running',
                                        status: 'upcoming',
                                        smartEventsLog: [
                                          ...(activeSess.smartEventsLog || []),
                                          {
                                            eventType: 'start',
                                            timestamp: currentTimeStr,
                                            text: activeSess.isOffline ? 'بداية المحاضرة حضورياً بمقر الشركة' : 'بداية المحاضرة الفعليّة (أونلاين)'
                                          }
                                        ]
                                      });

                                      // Online lectures jump straight to the meeting link in a new tab;
                                      // offline (in-person) lectures just start the timer, no redirect.
                                      if (!activeSess.isOffline && activeSess.meetingLink) {
                                        window.open(activeSess.meetingLink, '_blank', 'noopener,noreferrer');
                                      }

                                      // Send notifications to all students of this group
                                      try {
                                        for (const student of students) {
                                          await sendNotification({
                                            userId: student.id,
                                            title: activeSess.isOffline ? `🏢 بدأت المحاضرة بمقر الشركة!` : `🔴 بدأت المحاضرة الآن!`,
                                            message: activeSess.isOffline
                                              ? `بدأت المحاضرة رقم ${activeSess.sessionNumber} (${activeSess.lectureTitle || 'موضوع جديد'}) الآن حضورياً في مقر الشركة (أوفلاين). بانتظار حضوركم!`
                                              : `بدأت المحاضرة رقم ${activeSess.sessionNumber} (${activeSess.lectureTitle || 'موضوع جديد'}) الآن لمجموعتكم ${group?.name || ''}. اضغط للانضمام فوراً!`,
                                            type: 'task_status',
                                            link: `/student-portal?studentId=${student.id}`
                                          });
                                        }

                                        // Send confirmation notification to the trainer
                                        await sendNotification({
                                          userId: user.uid,
                                          title: `✅ تم بدء المحاضرة بنجاح`,
                                          message: `تم بدء المحاضرة رقم ${activeSess.sessionNumber} بنجاح وإرسال إشعار الانضمام لعدد ${students.length} طالب.`,
                                          type: 'task_assigned'
                                        });
                                      } catch (notifErr) {
                                        console.error("Failed to trigger session start notifications:", notifErr);
                                      }
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-arabic"
                                  >
                                    ▶️ بدء المحاضرة
                                  </button>
                                ) : activeSess.status === 'done' ? (
                                  /* 3. Resume Lecture Button */
                                  (activeSess.actualHours || 0) > 3 ? (
                                    <div className="w-full bg-slate-950 border border-slate-900 text-slate-500 font-extrabold text-[10px] py-3 px-4 rounded-xl text-center font-arabic">
                                      ⚠️ تجاوزت هذه المحاضرة حاجز الـ 3 ساعات، لذا تم إغلاق خيار الاستكمال نهائياً.
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        // Check if there is another session currently active in this group
                                        const runningSess = sessions.find(s => s.id !== activeSess.id && s.smartAssistantState && s.smartAssistantState !== 'idle');
                                        if (runningSess) {
                                          alert(`⚠️ تنبيه: المحاضرة رقم ${runningSess.sessionNumber} (${runningSess.lectureTitle || 'بدون عنوان'}) لا تزال نشطة وجارية الآن! يجب إنهاؤها أولاً قبل استئناف هذه المحاضرة.`);
                                          return;
                                        }
                                        const currentTimeStr = getCairoTimeStr();
                                        await execSave(activeSess.id, {
                                          endTimeActual: '',
                                          status: 'upcoming',
                                          smartAssistantState: 'running',
                                          smartEventsLog: [
                                            ...(activeSess.smartEventsLog || []),
                                            {
                                              eventType: 'start',
                                              timestamp: currentTimeStr,
                                              text: 'استكمال المحاضرة بعد الإنهاء الفعلي'
                                            }
                                          ]
                                        });

                                        if (!activeSess.isOffline && activeSess.meetingLink) {
                                          window.open(activeSess.meetingLink, '_blank', 'noopener,noreferrer');
                                        }

                                        // Send notifications to all students of this group
                                        try {
                                          for (const student of students) {
                                            await sendNotification({
                                              userId: student.id,
                                              title: `🔄 تم استئناف المحاضرة!`,
                                              message: `تم استئناف المحاضرة رقم ${activeSess.sessionNumber} (${activeSess.lectureTitle || 'موضوع جديد'}) الآن لمجموعتكم. اضغط للانضمام والمتابعة!`,
                                              type: 'task_status',
                                              link: `/student-portal?studentId=${student.id}`
                                            });
                                          }
                                        } catch (notifErr) {
                                          console.error("Failed to trigger session resume notifications:", notifErr);
                                        }
                                      }}
                                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-arabic animate-pulse"
                                    >
                                      🔄 استكمال المحاضرة
                                    </button>
                                  )
                                ) : (
                                  /* 2. End Lecture Button - RED */
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const endTimeStr = getCairoTimeStr();
                                      const { actualHours: calcAct, approvedHours: calcApp } = calculateActualAndApprovedHours(
                                        activeSess.startTimeActual || '',
                                        endTimeStr,
                                        maxAllowed
                                      );

                                      await execSave(activeSess.id, {
                                        endTimeActual: endTimeStr,
                                        actualHours: calcAct,
                                        approvedHours: calcApp,
                                        status: 'done',
                                        smartAssistantState: 'idle',
                                        smartEventsLog: [
                                          ...(activeSess.smartEventsLog || []),
                                          {
                                            eventType: 'end',
                                            timestamp: endTimeStr,
                                            text: `إنهاء المحاضرة الفعليّة (المدة: ${calcAct} ساعة | معتمد: ${calcApp} ساعة)`
                                          }
                                        ]
                                      });
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-arabic"
                                  >
                                    ⏹️ إنهاء المحاضرة
                                  </button>
                                )}

                                {/* Reset Timer Button for admin or supervisor */}
                                {['admin', 'coordinator', 'team_leader', 'trainer'].includes(user.role) && (activeSess.startTimeActual || activeSess.status === 'done') && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (window.confirm('هل تريد عمل reset لعداد الوقت الخاص بالمحاضرة؟')) {
                                        await execSave(activeSess.id, {
                                          startTimeActual: '',
                                          endTimeActual: '',
                                          actualHours: 0,
                                          approvedHours: 0,
                                          smartAssistantState: 'idle',
                                          status: 'upcoming',
                                          actualStartDate: '',
                                          isSpecialWorkshop: false,
                                          workshopDetails: '',
                                          startPostponeMinutes: 0,
                                          startPostponeNewTime: '',
                                          smartEventsLog: [],
                                          practices: [],
                                          breaks: [],
                                          activeSectionStartTime: '',
                                          activePracticeDesc: ''
                                        });
                                      }
                                    }}
                                    className="w-full bg-rose-950/40 text-rose-400 border border-rose-900/30 hover:bg-rose-900/40 font-extrabold text-[10px] py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-arabic mt-2"
                                  >
                                    🔄 إعادة تعيين العداد (Reset Timer)
                                  </button>
                                )}

                                {/* Special Workshop Toggle & Text Field */}
                                <div className="bg-slate-950/60 border border-slate-900/50 rounded-2xl p-4 font-arabic text-right mt-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-300">💡 ورشة عمل خاصة (تصنيف خاص)</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!activeSess.isSpecialWorkshop}
                                        onChange={async (e) => {
                                          const checked = e.target.checked;
                                          if (checked) {
                                            setSpecialWorkshopModalSession({ id: activeSess.id, targetChecked: true });
                                          } else {
                                            await execSave(activeSess.id, {
                                              isSpecialWorkshop: false,
                                              workshopDetails: ''
                                            });
                                          }
                                        }}
                                        className="sr-only peer"
                                      />
                                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 peer-checked:after:bg-white"></div>
                                    </label>
                                  </div>

                                  {activeSess.isSpecialWorkshop && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                      <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">اسم ورشة العمل والمحاضر الذي أعدها 📝</label>
                                        <input
                                          type="text"
                                          placeholder="اكتب هنا اسم الورشة والمدرب المحضر لها..."
                                          value={activeSess.workshopDetails || ''}
                                          onChange={async (e) => {
                                            await execSave(activeSess.id, { workshopDetails: e.target.value });
                                          }}
                                          className="w-full text-right px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white font-semibold text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Postponement options & indicators */}
                              {!activeSess.startTimeActual && (
                                <div className="space-y-2 border-t border-slate-900 pt-3">
                                  {activeSess.startPostponeMinutes ? (
                                    <div className="bg-amber-950/45 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          await execSave(activeSess.id, {
                                            startPostponeMinutes: 0,
                                            startPostponeNewTime: ''
                                          });
                                        }}
                                        className="bg-slate-800 text-slate-400 font-bold hover:text-white text-[10px] px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-700 transition-all shrink-0 order-last sm:order-first self-end sm:self-auto cursor-pointer"
                                      >
                                        ✕ إلغاء التأجيل
                                      </button>
                                      <div className="text-right">
                                        <span className="block text-amber-400 font-extrabold text-[11px] font-arabic">⏰ تم تأجيل موعد بدء المحاضرة!</span>
                                        <span className="block text-[10px] text-amber-200 mt-0.5 font-arabic leading-relaxed">بمقدار {activeSess.startPostponeMinutes} دقيقة. البداية المتوقعة: <span className="font-mono bg-amber-900/60 px-1.5 py-0.5 rounded text-white font-bold">{activeSess.startPostponeNewTime}</span></span>
                                      </div>
                                    </div>
                                  ) : null}

                                  {activeSess.generalPostponeActive ? (
                                    <div className="bg-indigo-950/45 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          await execSave(activeSess.id, {
                                            generalPostponeActive: false,
                                            generalPostponeDate: ''
                                          });
                                        }}
                                        className="bg-slate-800 text-slate-400 font-bold hover:text-white text-[10px] px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-700 transition-all shrink-0 order-last sm:order-first self-end sm:self-auto cursor-pointer"
                                      >
                                        ✕ إلغاء التأجيل
                                      </button>
                                      <div className="text-right">
                                        <span className="block text-indigo-400 font-extrabold text-[11px] font-arabic">📅 تم تأجيل المحاضرة بالكامل!</span>
                                        <span className="block text-[10px] text-indigo-200 mt-0.5 font-arabic leading-relaxed">الموعد الجديد: <span className="underline decoration-indigo-400 font-bold">{activeSess.generalPostponeDate}</span></span>
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPostponeStartMinutes(15);
                                        const defaultTime = addMinutesToTime(activeSess.sessionTime || getCairoTimeStr(), 15);
                                        setPostponeStartNewTime(defaultTime);
                                        setIsPostponeStartModalOpen(true);
                                      }}
                                      className="bg-slate-900 border border-slate-850 hover:bg-slate-800/80 hover:border-slate-800 text-amber-400 font-bold text-[10px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-arabic cursor-pointer select-none"
                                    >
                                      ⏱️ تأجيل موعد البدء
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPostponeGeneralDate('');
                                        setIsPostponeGeneralModalOpen(true);
                                      }}
                                      className="bg-slate-900 border border-slate-850 hover:bg-slate-800/80 hover:border-slate-800 text-indigo-400 font-bold text-[10px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-arabic cursor-pointer select-none"
                                    >
                                      📅 تأجيل بالكامل
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* WhatsApp Notification Button */}
                            {activeSess.startTimeActual && (
                              <button
                                type="button"
                                onClick={() => {
                                  const text = `يلا بينا ! \nالمحاضرة بدأت ، ادخل السيستم واضغط دخول المحاضرة !\nرابط السيستم >> https://training.sabergroupacademy.com/#/student/portal`;
                                  
                                  // Keep silent clipboard copy in the background as a fallback
                                  try {
                                    navigator.clipboard.writeText(text);
                                  } catch (e) {}
                                  
                                  let targetUrl = '';
                                  if (group.whatsappLink && group.whatsappLink !== 'https://web.whatsapp.com/' && group.whatsappLink !== 'https://web.whatsapp.com') {
                                    if (group.whatsappLink.includes('chat.whatsapp.com')) {
                                      // If it is a group invitation link, since WhatsApp doesn't support text query on invite URLs natively,
                                      // we can direct to the WhatsApp send API so they can choose the group/chats and have the text pre-filled.
                                      // We also provide a window notice to let them know
                                      targetUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                                    } else {
                                      // If it's a direct wa.me or custom api/web WhatsApp link, we append the text parameter
                                      const separator = group.whatsappLink.includes('?') ? '&' : '?';
                                      targetUrl = `${group.whatsappLink}${separator}text=${encodeURIComponent(text)}`;
                                    }
                                  } else {
                                    // Default WhatsApp send API with pre-filled text
                                    targetUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                                  }
                                  
                                  window.open(targetUrl, '_blank');
                                }}
                                className="w-full bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 text-emerald-400 font-extrabold text-[10px] py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-arabic"
                              >
                                📢 نشر تنبيه البدء عبر الواتساب للجروب
                              </button>
                            )}

                            {/* Advanced Manual Correction Subcard */}
                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850/60 space-y-3">
                              <span className="text-[9px] font-black text-indigo-400 block border-b border-slate-850 pb-1.5 text-right">⚙️ لوحة ضبط وتصحيح البيانات اليدويّة:</span>
                              
                              {/* Trainer Select */}
                              <div className="space-y-1 text-right">
                                <label className="text-[9px] text-slate-500 font-extrabold block">المدرب الفعلي للمحاضرة:</label>
                                {['trainer', 'team_leader'].includes(user.role) ? (
                                  <div className="bg-slate-900 text-slate-400 font-extrabold text-[10px] p-2.5 rounded-xl border border-slate-800">
                                    {activeSess.actualTrainerId === user.uid ? activeSess.actualTrainerName || user.name : user.name}
                                  </div>
                                ) : (
                                  <select
                                    value={activeSess.actualTrainerId || group?.trainerIds?.[0] || ''}
                                    onChange={async (e) => {
                                      const val = e.target.value;
                                      const matched = trainers.find(t => t.uid === val);
                                      await execSave(activeSess.id, {
                                        actualTrainerId: val,
                                        actualTrainerName: matched ? matched.name : ''
                                      });
                                    }}
                                    className="bg-slate-900 text-slate-300 font-bold text-[10px] p-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 w-full outline-none"
                                  >
                                    <option value="">-- اختر المدرب الفعلي --</option>
                                    {trainers.map(t => (
                                      <option key={t.uid} value={t.uid}>{t.name} ({t.email})</option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              {/* Start and End Times */}
                              <div className="grid grid-cols-2 gap-2 text-right">
                                <div>
                                  <label className="text-[9px] text-slate-500 font-bold block mb-1">وقت النهاية الفعلي:</label>
                                  <input
                                    type="text"
                                    placeholder="مثال: 15:30"
                                    value={activeSess.endTimeActual || ''}
                                    onChange={async (e) => {
                                      const newEnd = e.target.value;
                                      const { actualHours: calcAct, approvedHours: calcApp } = calculateActualAndApprovedHours(
                                        activeSess.startTimeActual || '',
                                        newEnd,
                                        maxAllowed
                                      );
                                      const parseStr = (str: string) => {
                                        const parts = str.split(':');
                                        if (parts.length < 2) return null;
                                        const h = parseInt(parts[0], 10) || 0;
                                        const m = parseInt(parts[1], 10) || 0;
                                        return h * 60 + m;
                                      };
                                      const sMin = parseStr(activeSess.startTimeActual || '');
                                      const eMin = parseStr(newEnd);
                                      let durationMinutes = activeSess.durationActual || 0;
                                      if (sMin !== null && eMin !== null) {
                                        durationMinutes = eMin - sMin;
                                        if (durationMinutes < 0) durationMinutes += 1440;
                                      }
                                      await execSave(activeSess.id, {
                                        endTimeActual: newEnd,
                                        actualHours: calcAct,
                                        approvedHours: calcApp,
                                        durationActual: durationMinutes,
                                        isManualTimingEdit: true
                                      });
                                    }}
                                    className="bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] px-2 py-1.5 rounded-lg w-full outline-none text-center focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-500 font-bold block mb-1">وقت البدء الفعلي:</label>
                                  <input
                                    type="text"
                                    placeholder="مثال: 12:30"
                                    value={activeSess.startTimeActual || ''}
                                    onChange={async (e) => {
                                      const newStart = e.target.value;
                                      const { actualHours: calcAct, approvedHours: calcApp } = calculateActualAndApprovedHours(
                                        newStart,
                                        activeSess.endTimeActual || '',
                                        maxAllowed
                                      );
                                      const parseStr = (str: string) => {
                                        const parts = str.split(':');
                                        if (parts.length < 2) return null;
                                        const h = parseInt(parts[0], 10) || 0;
                                        const m = parseInt(parts[1], 10) || 0;
                                        return h * 60 + m;
                                      };
                                      const sMin = parseStr(newStart);
                                      const eMin = parseStr(activeSess.endTimeActual || '');
                                      let durationMinutes = activeSess.durationActual || 0;
                                      if (sMin !== null && eMin !== null) {
                                        durationMinutes = eMin - sMin;
                                        if (durationMinutes < 0) durationMinutes += 1440;
                                      }
                                      await execSave(activeSess.id, {
                                        startTimeActual: newStart,
                                        actualHours: calcAct,
                                        approvedHours: calcApp,
                                        durationActual: durationMinutes,
                                        isManualTimingEdit: true
                                      });
                                    }}
                                    className="bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] px-2 py-1.5 rounded-lg w-full outline-none text-center focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              {/* Actual and Approved Hours */}
                              <div className="grid grid-cols-2 gap-2 text-right">
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold block mb-1">الساعات المعتمدة للراتب:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="12"
                                    step="0.1"
                                    placeholder="معتمدة"
                                    disabled={user.role !== 'admin'}
                                    value={activeSess.approvedHours !== undefined ? activeSess.approvedHours : ''}
                                    onChange={async (e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      await execSave(activeSess.id, { approvedHours: val });
                                    }}
                                    className={`bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] px-2 py-1.5 rounded-lg w-full outline-none text-center focus:border-indigo-500 ${user.role !== 'admin' ? 'opacity-55 cursor-not-allowed' : ''}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold block mb-1">الساعات الفعلية المحسوبة:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="12"
                                    step="0.1"
                                    placeholder="فعلية"
                                    disabled={user.role !== 'admin'}
                                    value={activeSess.actualHours !== undefined ? activeSess.actualHours : ''}
                                    onChange={async (e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      await execSave(activeSess.id, { actualHours: val });
                                    }}
                                    className={`bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] px-2 py-1.5 rounded-lg w-full outline-none text-center focus:border-indigo-500 ${user.role !== 'admin' ? 'opacity-55 cursor-not-allowed' : ''}`}
                                  />
                                </div>
                              </div>

                              {/* Break and Practice tuning manually */}
                              <div className="grid grid-cols-2 gap-2 text-right">
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold block mb-1">نسبة التطبيق العملي:</label>
                                  <div className="flex gap-1 w-full">
                                    {[25, 50, 75, 100].map(pct => {
                                      const isSelected = activeSess.practicePercentage === pct;
                                      return (
                                        <button
                                          key={pct}
                                          type="button"
                                          disabled={user.role !== 'admin'}
                                          onClick={async () => {
                                            await execSave(activeSess.id, { practicePercentage: pct });
                                          }}
                                          className={`flex-1 py-1 rounded-lg text-[8px] font-black transition-all ${user.role !== 'admin' ? 'opacity-55 cursor-not-allowed' : ''} ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-750'}`}
                                        >
                                          {pct}%
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold block mb-1">الاستراحة (بالدقائق):</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    disabled={user.role !== 'admin'}
                                    value={activeSess.breakDuration !== undefined ? activeSess.breakDuration : ''}
                                    onChange={async (e) => {
                                      const val = parseInt(e.target.value, 10) || 0;
                                      await execSave(activeSess.id, { breakDuration: val });
                                    }}
                                    className={`bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] px-2 py-1.5 rounded-lg w-full outline-none text-center focus:border-indigo-500 ${user.role !== 'admin' ? 'opacity-55 cursor-not-allowed' : ''}`}
                                  />
                                </div>
                              </div>
                              {user.role !== 'admin' && (
                                <p className="text-[8px] text-red-400 font-bold text-center mt-2" dir="rtl">🔒 تعديل الساعات، الاستراحة والعملي مغلق (للمدير فقط بعد مراجعة المشرف)</p>
                              )}
                            </div>
                          </div>

                          {/* Events Trigger Pane */}
                          {activeSess.smartAssistantState && activeSess.smartAssistantState !== 'idle' && (
                            <div className="border-t border-slate-850 pt-4 space-y-3">
                              {/* 1. Practice Control Area */}
                              {activeSess.smartAssistantState === 'practice' ? (
                                <div className="bg-indigo-950/15 border border-indigo-900/30 p-3 rounded-2xl space-y-2 text-right">
                                  <p className="text-[10px] text-indigo-400 font-extrabold font-sans">التطبيق العملي جاري الآن...</p>
                                  <p className="text-xs text-slate-300 font-bold">موضوع التطبيق: {activeSess.activePracticeDesc}</p>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const endTimeStr = getCairoTimeStr();
                                      const startTimeStr = activeSess.activeSectionStartTime || endTimeStr;

                                      const parseLocalTime = (str: string) => {
                                        if (!str) return null;
                                        const parts = str.split(':');
                                        if (parts.length < 2) return null;
                                        const h = parseInt(parts[0], 10) || 0;
                                        const m = parseInt(parts[1], 10) || 0;
                                        return h * 60 + m;
                                      };

                                      let startMin = parseLocalTime(startTimeStr) || 0;
                                      let endMin = parseLocalTime(endTimeStr) || 0;
                                      let duration = endMin - startMin;
                                      if (duration < 0) duration += 1440;

                                      const newPractice = {
                                        description: activeSess.activePracticeDesc || 'تطبيق عملي',
                                        startTime: startTimeStr,
                                        endTime: endTimeStr,
                                        duration: duration > 0 ? duration : 1
                                      };

                                      const updatedPractices = [...(activeSess.practices || []), newPractice];
                                      
                                      // Calculate percentage of class spent on practices
                                      const totalPracticeMinutes = updatedPractices.reduce((acc, p) => acc + (p.duration || 0), 0);
                                      const totalLectureMinutes = (activeSess.actualHours || 3) * 60;
                                      const practicePct = Math.min(100, Math.round((totalPracticeMinutes / totalLectureMinutes) * 100)) || 0;

                                      await execSave(activeSess.id, {
                                        practices: updatedPractices,
                                        smartAssistantState: 'running',
                                        activeSectionStartTime: null,
                                        activePracticeDesc: null,
                                        practicePercentage: practicePct,
                                        smartEventsLog: [
                                          ...(activeSess.smartEventsLog || []),
                                          {
                                            eventType: 'practice_end',
                                            timestamp: endTimeStr,
                                            text: `إنهاء التطبيق: ${activeSess.activePracticeDesc} (${duration} دقيقة)`
                                          }
                                        ]
                                      });
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-2 px-3 rounded-xl transition-all"
                                  >
                                    🛑 إنهاء وقت التطبيق العملي
                                  </button>
                                </div>
                              ) : activeSess.smartAssistantState === 'break' ? (
                                <div className="bg-amber-950/15 border border-amber-900/30 p-3 rounded-2xl space-y-2 text-right">
                                  <p className="text-[10px] text-amber-400 font-extrabold">الاستراحة جارية الآن...</p>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const endTimeStr = getCairoTimeStr();
                                      const startTimeStr = activeSess.activeSectionStartTime || endTimeStr;

                                      const parseLocalTime = (str: string) => {
                                        if (!str) return null;
                                        const parts = str.split(':');
                                        if (parts.length < 2) return null;
                                        const h = parseInt(parts[0], 10) || 0;
                                        const m = parseInt(parts[1], 10) || 0;
                                        return h * 60 + m;
                                      };

                                      let startMin = parseLocalTime(startTimeStr) || 0;
                                      let endMin = parseLocalTime(endTimeStr) || 0;
                                      let duration = endMin - startMin;
                                      if (duration < 0) duration += 1440;

                                      const newBreak = {
                                        startTime: startTimeStr,
                                        endTime: endTimeStr,
                                        duration: duration > 0 ? duration : 1
                                      };

                                      const updatedBreaks = [...(activeSess.breaks || []), newBreak];
                                      const totalBreakMin = updatedBreaks.reduce((acc, b) => acc + (b.duration || 0), 0);

                                      await execSave(activeSess.id, {
                                        breaks: updatedBreaks,
                                        breakDuration: totalBreakMin,
                                        smartAssistantState: 'running',
                                        activeSectionStartTime: null,
                                        smartEventsLog: [
                                          ...(activeSess.smartEventsLog || []),
                                          {
                                            eventType: 'break_end',
                                            timestamp: endTimeStr,
                                            text: `إنهاء فترة الاستراحة (${duration} دقيقة)`
                                          }
                                        ]
                                      });
                                    }}
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] py-2 px-3 rounded-xl transition-all"
                                  >
                                    🛑 إنهاء فترة الاستراحة والعودة للمحاضرة
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3 font-arabic">
                                  {/* Start Break Trigger */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const timeStr = getCairoTimeStr();

                                      await execSave(activeSess.id, {
                                        smartAssistantState: 'break',
                                        activeSectionStartTime: timeStr,
                                        smartEventsLog: [
                                          ...(activeSess.smartEventsLog || []),
                                          {
                                            eventType: 'break_start',
                                            timestamp: timeStr,
                                            text: 'بدء فترة الاستراحة'
                                          }
                                        ]
                                      });
                                    }}
                                    className="w-full bg-slate-900 hover:bg-slate-850 text-amber-500 border border-amber-900/40 font-extrabold text-[10px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                  >
                                    ☕ بدء بريك / استراحة للطلاب
                                  </button>

                                  {/* Start Practice Area with description input */}
                                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850/60 space-y-2 text-right">
                                    <label className="text-[10px] text-slate-400 font-extrabold block">تسجيل حدث لتطبيق عملي للطلاب:</label>
                                    <input
                                      type="text"
                                      placeholder="موضوع التطبيق؟ مثال: حل تحدي الداتا بايندنج"
                                      value={practiceInput}
                                      onChange={(e) => setPracticeInput(e.target.value)}
                                      className="bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] p-2.5 rounded-xl w-full outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!practiceInput.trim()) {
                                          alert('يرجى كتابة موضوع أو عنوان للتطبيق العملي أولاً!');
                                          return;
                                        }
                                        const timeStr = getCairoTimeStr();
                                        const desc = practiceInput;
                                        setPracticeInput('');

                                        await execSave(activeSess.id, {
                                          smartAssistantState: 'practice',
                                          activeSectionStartTime: timeStr,
                                          activePracticeDesc: desc,
                                          smartEventsLog: [
                                            ...(activeSess.smartEventsLog || []),
                                            {
                                              eventType: 'practice_start',
                                              timestamp: timeStr,
                                              text: `بدء تطبيق عملي: ${desc}`
                                            }
                                          ]
                                        });
                                      }}
                                      className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-2 px-3 rounded-xl transition-all"
                                    >
                                      💻 ابدأ التطبيق العملي للطلاب
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Events History Log & Dynamic summaries */}
                          {((activeSess.smartEventsLog && activeSess.smartEventsLog.length > 0) ||
                             (activeSess.practices && activeSess.practices.length > 0) ||
                             (activeSess.breaks && activeSess.breaks.length > 0)) && (
                            <div className="border-t border-slate-850 pt-4 space-y-3">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">الأحداث والأنشطة المسجلة بالحصة:</h5>
                              
                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                                {/* Display logged events */}
                                {activeSess.smartEventsLog?.map((ev, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-950/40 p-2 rounded-lg border border-slate-850 text-right">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const filteredLogs = (activeSess.smartEventsLog || []).filter((_, i) => i !== idx);
                                        await execSave(activeSess.id, { smartEventsLog: filteredLogs });
                                      }}
                                      className="text-slate-600 hover:text-red-400 font-black px-1"
                                      title="حذف السجل"
                                    >
                                      ✕
                                    </button>
                                    <div className="flex-1 pr-2">
                                      <span className="text-slate-300 font-extrabold">{ev.text}</span>
                                      <span className="text-slate-500 font-mono text-[9px] mr-1.5 font-bold">[{ev.timestamp}]</span>
                                    </div>
                                  </div>
                                ))}

                                {/* Display saved exercises */}
                                {activeSess.practices?.map((pr, idx) => (
                                  <div key={`p-${idx}`} className="flex justify-between items-center text-[10px] bg-indigo-950/10 p-2 rounded-lg border border-indigo-950/30 text-right">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const filteredPractices = (activeSess.practices || []).filter((_, i) => i !== idx);
                                        const totalPracticeMinutes = filteredPractices.reduce((acc, p) => acc + (p.duration || 0), 0);
                                        const totalLectureMinutes = (activeSess.actualHours || 3) * 60;
                                        const practicePct = Math.min(100, Math.round((totalPracticeMinutes / totalLectureMinutes) * 100)) || 0;

                                        await execSave(activeSess.id, {
                                          practices: filteredPractices,
                                          practicePercentage: practicePct
                                        });
                                      }}
                                      className="text-slate-600 hover:text-red-400 font-black px-1"
                                      title="حذف التطبيق"
                                    >
                                      ✕
                                    </button>
                                    <div className="flex-1 pr-2">
                                      <span className="text-indigo-400 font-black">💻 تطبيق عملي: </span>
                                      <span className="text-slate-300 font-bold">{pr.description}</span>
                                      <span className="text-slate-500 text-[9px] font-mono mr-1">({formatTime12h(pr.startTime)} - {formatTime12h(pr.endTime)} | {pr.duration} دقيقة)</span>
                                    </div>
                                  </div>
                                ))}

                                {/* Display saved breaks */}
                                {activeSess.breaks?.map((br, idx) => (
                                  <div key={`b-${idx}`} className="flex justify-between items-center text-[10px] bg-amber-950/10 p-2 rounded-lg border border-amber-950/30 text-right">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const filteredBreaks = (activeSess.breaks || []).filter((_, i) => i !== idx);
                                        const totalBreakMin = filteredBreaks.reduce((acc, b) => acc + (b.duration || 0), 0);

                                        await execSave(activeSess.id, {
                                          breaks: filteredBreaks,
                                          breakDuration: totalBreakMin
                                        });
                                      }}
                                      className="text-slate-600 hover:text-red-400 font-black px-1"
                                      title="حذف الاستراحة"
                                    >
                                      ✕
                                    </button>
                                    <div className="flex-1 pr-2">
                                      <span className="text-amber-400 font-black">☕ استراحة: </span>
                                      <span className="text-slate-500 text-[9px] font-mono mr-1">({formatTime12h(br.startTime || '')} - {formatTime12h(br.endTime || '')} | {br.duration} دقيقة)</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="bg-gradient-to-br from-indigo-950/20 to-slate-900 p-6 rounded-3xl border border-indigo-900/30 space-y-4">
                          <div className="flex justify-between items-center border-b border-indigo-950 pb-3">
                            <span className="text-[10px] font-black bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-900/50">
                              Active Direct QR
                            </span>
                            <h4 className="font-extrabold text-indigo-400 text-xs">رابط وبوابة حضور الطلاب</h4>
                          </div>

                          {/* Domain Selector to bypass Safari Cookie / Brave account walls */}
                          <div className="bg-slate-950/45 p-3 rounded-2xl border border-slate-850/50 space-y-2">
                            <label className="text-[9px] text-slate-400 font-bold block">رابط السيستم العام الفعلي (لتجنب قيود المتصفحات):</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customDomain}
                                onChange={(e) => setCustomDomain(e.target.value)}
                                placeholder="مثال: https://saber-group-system.com"
                                className="bg-slate-950 text-slate-300 font-mono text-[10px] p-2 rounded-lg border border-slate-800 focus:border-indigo-500 flex-1 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  let dom = customDomain.trim();
                                  if (dom.endsWith('/')) dom = dom.slice(0, -1);
                                  localStorage.setItem('saberSystemPublicDomain', dom);
                                  setCustomDomain(dom);
                                  alert('تم حفظ نطاق النظام الفعلي للطلاب وتحديث الـ QR بنجاح!');
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 px-3 rounded-lg"
                                title="حفظ النطاق"
                              >
                                حفظ 💾
                              </button>
                            </div>
                            <p className="text-[8px] text-slate-500 leading-relaxed">
                              * يوصى بكتابة الرابط الذي يدخل به الطلاب خارج الـ iframe (e.g. Deployed domain) لمنع قيود ملفات تعريف الارتباط في Safari وجروبات Brave.
                            </p>
                          </div>

                          <div className="text-center space-y-3 pt-2">
                            <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
                              يدخل الطلاب بالـ ID والرقم السري مباشرة لتأكيد حضور المحاضرة
                            </p>

                            {(() => {
                              const attendCode = activeSess.attendanceCode || '';
                              const attendExpiresAt = activeSess.attendanceExpiresAt || '';
                              const hasCode = !!attendCode;
                              
                              let isExpired = false;
                              let remainingMinutes = 0;
                              if (attendExpiresAt) {
                                const expMs = new Date(attendExpiresAt).getTime();
                                isExpired = Date.now() > expMs;
                                remainingMinutes = Math.max(0, Math.round((expMs - Date.now()) / 60000));
                              }

                              const attendanceUrl = `${customDomain}/#/student/portal?groupId=${group.id}&sessionId=${activeSess.id}&sessionNumber=${activeSess.sessionNumber}&attendance=true&qrToken=${attendCode}`;
                              const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=ffffff&bgcolor=0f172a&data=${encodeURIComponent(attendanceUrl)}`;

                              const generateNewQrCode = async () => {
                                const duration = qrDuration || 15;
                                const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
                                const expiresIso = new Date(Date.now() + duration * 60 * 1000).toISOString();
                                try {
                                  await execSave(activeSess.id, {
                                    attendanceCode: randomToken,
                                    attendanceExpiresAt: expiresIso,
                                    attendanceDuration: duration
                                  });
                                  alert('تم توليد كود حضور مؤقت بنجاح وهو صالح لـ ' + duration + ' دقيقة!');
                                } catch (err: any) {
                                  alert('خطأ أثناء حفظ كود الحضور: ' + err.message);
                                }
                              };

                              return (
                                <div className="space-y-4">
                                  {/* Code Duration Controller */}
                                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5 text-right text-xs">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400 font-bold block">مدة صلاحية كود الحضور (بالدقائق):</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={qrDuration}
                                        onChange={(e) => setQrDuration(Math.max(1, parseInt(e.target.value) || 15))}
                                        className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white text-xs"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={generateNewQrCode}
                                      className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-[10px] py-2 px-3 rounded-xl transition-all"
                                    >
                                      {hasCode ? '⚡ إعادة توليد وتمديد كود الحضور' : '⚡ إنشاء وتفعيل كود الحضور لأول مرة'}
                                    </button>
                                  </div>

                                  {hasCode ? (
                                    <div className="flex flex-col items-center gap-3">
                                      {/* Expiration Label */}
                                      <div className="w-full text-center">
                                        {!isExpired ? (
                                          <div className="bg-emerald-950/40 border border-emerald-950 px-3 py-1.5 rounded-xl inline-block">
                                            <p className="text-[11px] font-bold text-emerald-400">
                                              🟢 الكود نشط حالياً وينتهي خلال <span className="font-mono text-xs">{remainingMinutes}</span> دقيقة
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-0.5 text-center">القيمة الرمزية: {attendCode}</p>
                                          </div>
                                        ) : (
                                          <div className="bg-red-950/40 border border-red-950 px-3 py-1.5 rounded-xl inline-block">
                                            <p className="text-[11px] font-bold text-red-400">
                                              🔴 هذا الكود منتهي الصلاحية (اضغط تمديد لتجديده)
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-0.5 text-center">انتهى منذ: {new Date(attendExpiresAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all shadow-inner">
                                        <img
                                          src={qrCodeUrl}
                                          alt="Lecture QR Code"
                                          className="w-40 h-40 object-contain rounded-lg"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>

                                      <div className="flex gap-2 w-full">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(attendanceUrl);
                                            alert('تم نسخ رابط تسجيل الحضور للمحاضرة بنجاح!');
                                          }}
                                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                        >
                                          🔗 نسخ الرابط
                                        </button>
                                        <a
                                          href={qrCodeUrl}
                                          download={`session_${activeSess.sessionNumber}_qr.png`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                                        >
                                          📥 تحميل QR
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 text-center space-y-2">
                                      <p className="text-[11px] text-slate-400 font-bold">
                                        لم يتم توليد أو تفعيل كود الحضور المؤقت لهذه المحاضرة بعد.
                                      </p>
                                      <p className="text-[9px] text-slate-500">
                                        يرجى تحديد مدة الصلاحية والضغط على الزر أعلاه لتوليد كود الحضور ومشاركته مع الطلاب.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        </div>

                        {/* Evaluation Grid */}
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                      <h3 className="font-black text-slate-300 text-sm uppercase">Evaluation Grid</h3>
                      <input type="text" placeholder="Filter..." value={evalSearchQuery} onChange={e => setEvalSearchQuery(e.target.value)} className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold w-48" />
                    </div>
                    {/* Unified horizontal scroll container around header AND rows */}
                    <div className="overflow-x-auto no-scrollbar">
                      <div className="min-w-[760px]">
                        {/* Header Row for Evaluation Grid - 7 Columns including Total */}
                        <div className="grid grid-cols-[320px_repeat(7,60px)] items-center gap-2 px-4 md:px-8 py-3 bg-slate-950 border-b border-slate-800">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('students')}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('attendance').substring(0,3)}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('task')}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('ontime').substring(0,3)}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('quality').substring(0,4)}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('redo')}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('bonus')}</span>
                          <span className="text-[9px] font-black text-white bg-blue-600 px-1 rounded uppercase tracking-widest text-center">TOT</span>
                        </div>
                        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto no-scrollbar">
                          {filteredStudentsForEval.map(student => {
                            const evalData = evaluations.find(e => e.studentId === student.id && e.sessionNumber === selectedSession.sessionNumber) || {} as any;
                            return (
                              <div key={student.id} className="px-4 md:px-8 py-4 grid grid-cols-[320px_repeat(7,60px)] items-center gap-2 hover:bg-slate-800/30 transition-colors">
                                <div className="flex flex-col gap-1.5 py-1 min-w-[320px]">
                              {/* Row 1: Name & Tasks Link */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`font-black text-sm tracking-tight font-arabic ${student.deactivated ? 'text-slate-500 line-through decoration-red-500/40' : 'text-slate-200'}`}>
                                  {student.name}
                                </span>
                                {student.deactivated && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-500/10 text-red-400 border border-red-500/20">
                                    {lang === 'ar' ? '🚫 موقوف' : '🚫 Deactivated'}
                                  </span>
                                )}

                                {/* Tasks Link Button */}
                                {student.tasksLink ? (
                                  <a
                                    href={student.tasksLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 rounded-lg text-[10px] font-black transition-all font-arabic shadow-sm cursor-pointer"
                                    title="انتقل إلى توبيك تسليم التاسكات على تليجرام"
                                  >
                                    <Send size={10} className="transform rotate-45 -translate-y-[1px]" />
                                    <span>لينك التاسكات</span>
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setStudentFormData({
                                        name: student.name,
                                        email: student.email || '',
                                        phone: student.phone || '',
                                        whatsapp: student.whatsapp || '',
                                        github: student.github || '',
                                        linkedin: student.linkedin || '',
                                        notes: student.notes || '',
                                        tasksLink: ''
                                      });
                                      setIsStudentModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800/40 hover:bg-slate-800/80 text-slate-500 hover:text-slate-300 border border-slate-800/80 rounded-lg text-[10px] font-bold transition-all border-dashed font-arabic"
                                    title="إضافة لينك التوبيك لتسليم التاسكات"
                                  >
                                    <span>+ لينك التاسكات</span>
                                  </button>
                                )}
                              </div>

                              {/* Row 2: Follow up Labels */}
                              {(() => {
                                const followUpLabels = studentFollowUps.find(f => f.studentId === student.id && f.groupId === group.id)?.labels;
                                if (!followUpLabels || followUpLabels.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    {followUpLabels.map(l => {
                                      const lDef = labelDefinitions.find(def => def.name === l || def.id === l);
                                      if (lDef && lDef.visibleOnScreen === false) return null;
                                      let labelText = l;
                                      let bgColor = 'bg-slate-800';
                                      let textColor = 'text-slate-400';
                                      
                                      if (l === 'absence') { labelText = 'Absence'; bgColor = 'bg-red-500/20'; textColor = 'text-red-400'; }
                                      else if (l === 'tasks') { labelText = 'Tasks'; bgColor = 'bg-amber-500/20'; textColor = 'text-amber-400'; }
                                      else if (l === 'distinguished') { labelText = 'Distinguished'; bgColor = 'bg-emerald-500/20'; textColor = 'text-emerald-400'; }
                                      else if (l === 'best_achiever') { labelText = 'Best Achiever'; bgColor = 'bg-primary-500/20'; textColor = 'text-primary-400'; }
                                      else if (lDef) { 
                                        return (
                                          <span key={l} className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap border border-current/10" style={{ backgroundColor: `${lDef.color}15`, color: lDef.color }}>
                                            {lDef.name}
                                          </span>
                                        );
                                      }

                                      return (
                                        <span key={l} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap border border-current/10 ${bgColor} ${textColor}`}>
                                          {labelText}
                                        </span>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {/* Row 3: Aesthetic Action Toolbar */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-slate-400 text-[10px]">
                                <button 
                                  onClick={() => {
                                    setNotesModalStudent({ id: student.id, name: student.name });
                                    setStudentNotesText(evalData.trainerNote || '');
                                    setStudentTaskNoteText(evalData.taskNote || '');
                                    setActiveNotesTab('lecture');
                                  }}
                                  className={`flex items-center gap-1 font-black transition-colors ${evalData.trainerNote ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-indigo-400'}`}
                                  title="ملاحظة المحاضرة"
                                >
                                  <span>📝 ملاحظة المحاضرة</span>
                                  {evalData.trainerNote && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                                </button>

                                <span className="text-slate-700">•</span>

                                <button 
                                  onClick={() => {
                                    setNotesModalStudent({ id: student.id, name: student.name });
                                    setStudentNotesText(evalData.trainerNote || '');
                                    setStudentTaskNoteText(evalData.taskNote || '');
                                    setActiveNotesTab('task');
                                  }}
                                  className={`flex items-center gap-1 font-black transition-colors ${evalData.taskNote ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-amber-400'}`}
                                  title="تقييم التاسك"
                                >
                                  <span>📌 تقييم التاسك</span>
                                  {evalData.taskNote && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>}
                                </button>

                                <span className="text-slate-700">•</span>

                                {(() => {
                                  const studentWeaknesses = groupWeaknesses.filter(w => w.studentId === student.id);
                                  const unresolvedCount = studentWeaknesses.filter(w => !w.resolved).length;
                                  return (
                                    <button 
                                      onClick={() => setSelectedStudentForWeakness({ id: student.id, name: student.name })}
                                      className={`flex items-center gap-1 font-black transition-colors ${
                                        unresolvedCount > 0 
                                          ? 'text-amber-400 hover:text-amber-300' 
                                          : studentWeaknesses.length > 0 
                                          ? 'text-emerald-400 hover:text-emerald-300' 
                                          : 'text-slate-400 hover:text-amber-400'
                                      }`}
                                      title="نقاط الضعف والتطوير"
                                    >
                                      <span>🎯 نقاط الضعف</span>
                                      {unresolvedCount > 0 ? (
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          {unresolvedCount}
                                        </span>
                                      ) : studentWeaknesses.length > 0 ? (
                                        <span className="text-[9px] text-emerald-400">✓</span>
                                      ) : null}
                                    </button>
                                  );
                                })()}

                                <span className="text-slate-700">•</span>

                                <button 
                                  onClick={() => setSelectedStudentForLabel({ id: student.id, name: student.name })}
                                  className="flex items-center gap-1 font-black text-slate-400 hover:text-blue-400 transition-colors"
                                  title="Add Label"
                                >
                                  <span>🏷️ التصنيف</span>
                                </button>

                                <span className="text-slate-700">•</span>

                                <button 
                                  onClick={() => { 
                                    setFollowUpStudent(student); 
                                    setFollowUpLabels(['tasks']);
                                    setFollowUpNote(lang === 'ar' 
                                      ? 'اعتذر عن تسليم تاسك السيشن وقدم عذر - متابعة للإنجاز والتسليم' 
                                      : 'Apologized for session task, follow up until delivered.'
                                    );
                                    setIsSupervisorModalOpen(true); 
                                  }}
                                  className="flex items-center gap-1 font-black text-slate-400 hover:text-amber-400 transition-colors"
                                  title={lang === 'ar' ? "طلب متابعة (Follow Up)" : "Request Follow Up"}
                                >
                                  <span>🎯 متابعة</span>
                                </button>

                                <span className="text-slate-700">•</span>

                                <button 
                                  onClick={() => toggleTaskNotSubmittedPenalty(student.id)}
                                  className={`flex items-center gap-1 font-black transition-colors ${
                                    evalData.taskNotSubmittedPenalty ? 'text-red-400 hover:text-red-300 font-black' : 'text-slate-400 hover:text-red-400'
                                  }`}
                                  title="خصم نقطة لعدم تسليم التاسك"
                                >
                                  <span>🚫 {evalData.taskNotSubmittedPenalty ? 'خصم عدم التسليم مفعل (-1)' : 'خصم عدم تسليم التاسك'}</span>
                                </button>

                                <span className="text-slate-700">•</span>

                                <button 
                                  onClick={() => setSelectedStudentForHistory(student)}
                                  className="flex items-center gap-1 font-black text-slate-400 hover:text-indigo-400 transition-colors"
                                  title="سجل وتاريخ الطالب الكامل مع التوقيتات"
                                >
                                  <span>📜 السجل الكامل</span>
                                </button>

                                <span className="text-slate-700">•</span>

                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setStudentFormData({
                                        name: student.name,
                                        email: student.email || '',
                                        phone: student.phone || '',
                                        whatsapp: student.whatsapp || '',
                                        github: student.github || '',
                                        linkedin: student.linkedin || '',
                                        notes: student.notes || '',
                                        tasksLink: student.tasksLink || ''
                                      });
                                      setIsStudentModalOpen(true);
                                    }}
                                    className="text-slate-400 hover:text-blue-400 transition-colors p-0.5"
                                    title="تعديل بيانات الطالب"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm('Are you sure you want to remove this student from the group? This will delete all their data in this group.')) {
                                        try {
                                          await deleteStudent(student.id, user);
                                          setStudents(prev => prev.filter(s => s.id !== student.id));
                                        } catch (err) {
                                          console.error(err);
                                          alert('Failed to delete student.');
                                        }
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                                    title="حذف الطالب"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className={`contents ${student.deactivated ? 'opacity-30 pointer-events-none select-none' : ''}`}>
                              {/* Column 2: Attendance */}
                              <button onClick={() => toggleBooleanCriteria(student.id, 'attendance')} className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto ${evalData.attendance === 1 ? 'bg-white text-black font-bold' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>{evalData.attendance === 1 && '✓'}</button>

                              {/* Columns 3-6: Task evaluation or Task penalty badge */}
                              {evalData.taskNotSubmittedPenalty ? (
                                <div className="col-span-4 flex items-center justify-between bg-red-950/60 border border-red-500/40 rounded-xl px-2.5 py-1 text-red-400 font-black text-[10px] shadow-sm">
                                  <span className="truncate">🚫 لم يسلم التاسك (-1)</span>
                                  <button onClick={() => toggleTaskNotSubmittedPenalty(student.id)} className="text-[9px] text-red-300 hover:text-white underline cursor-pointer shrink-0 mr-1">إلغاء الخصم</button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-center gap-1.5 bg-slate-950 p-1 rounded-full border border-slate-800 w-16 mx-auto">
                                    <button onClick={() => updateTaskPoints(student.id, -1)} className="text-slate-500 hover:text-red-500">-</button>
                                    <span className="text-[11px] font-black text-blue-400">{evalData.taskDelivered || 0}</span>
                                    <button onClick={() => updateTaskPoints(student.id, 1)} className="text-slate-500 hover:text-green-500">+</button>
                                  </div>
                                  <button onClick={() => toggleBooleanCriteria(student.id, 'taskOnTime')} className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto ${evalData.taskOnTime === 1 ? 'bg-white text-black font-bold' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>{evalData.taskOnTime === 1 && '✓'}</button>
                                  <button onClick={() => toggleBooleanCriteria(student.id, 'taskQuality')} className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto ${evalData.taskQuality === 1 ? 'bg-white text-black font-bold' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>{evalData.taskQuality === 1 && '✓'}</button>
                                  <button onClick={() => toggleBooleanCriteria(student.id, 'taskRedo')} className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto ${evalData.taskRedo === 1 ? 'bg-amber-600 text-white border-amber-500 font-bold' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>{evalData.taskRedo === 1 && '!'}</button>
                                </>
                              )}

                              {/* Column 7: Bonus */}
                              <button onClick={() => toggleBooleanCriteria(student.id, 'bonus')} className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto ${evalData.bonus === 1 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>{evalData.bonus === 1 && '✓'}</button>

                              {/* Column 8: Total Score for this lecture */}
                              <div className={`w-8 h-8 rounded-xl bg-slate-950 border flex items-center justify-center mx-auto text-[11px] font-black ${
                                (evalData.total || 0) < 0 ? 'border-red-900/50 text-red-400 bg-red-950/20' : 'border-blue-900/30 text-blue-400'
                              }`}>
                                {evalData.total || 0}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                        </div>
                      </div>
                    </div>
                  </div>

                        {/* Row 2: Lecture Data + Course Checklist */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <span className="text-[10px] font-black bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg border border-slate-700">
                              📅 المحاضرة {activeSess.sessionNumber}
                            </span>
                            <h4 className="font-extrabold text-slate-200 text-xs">تسجيل بيانات المحاضرة الفنية</h4>
                          </div>

                          {/* What was explained textbox */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-extrabold block">ما تم شرحه بالفعل بالتفصيل (محتوى المحاضرة):</label>
                            <textarea
                              value={currentMeta.lectureNotes || ''}
                              onChange={(e) => handleSaveMeta({ ...currentMeta, lectureNotes: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-xs h-32 outline-none focus:border-blue-500 text-right"
                              placeholder="اكتب تفاصيل المحتوى والتقنيات البرمجية التي تم شرحها والبرمجيات التي تم بناؤها اليوم..."
                            />
                            {isHoursOver && (
                              <p className="text-[9px] text-amber-500 font-black mt-1 bg-amber-950/20 p-2 rounded border border-amber-900/35 leading-normal">
                                ⚠️ ملاحظة: تجاوز الوقت الحد الأقصى المعتمد للمقرر ({maxAllowed} ساعات). يمكنك تدوين سبب الإطالة هنا في محتوى المحاضرة.
                              </p>
                            )}
                          </div>

                          {/* Required Tasks */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-extrabold block text-blue-400">التكليفات والمهام المطلوبة من المتدربين (التاسكات):</label>
                            <textarea
                              value={currentMeta.taskInstructions || ''}
                              onChange={(e) => handleSaveMeta({ ...currentMeta, taskInstructions: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-xs h-28 outline-none focus:border-blue-500 border-blue-900/30 text-right"
                              placeholder="أدخل المهام والمشروعات التطبيقية المطلوبة من الطلاب العمل عليها حتى الحصة القادمة..."
                            />
                          </div>

                          {/* Lecture Evaluation Alert & Copy Button */}
                          {(() => {
                            const feedbackSessions = group?.feedbackSessions || [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
                            const needsEvaluation = feedbackSessions.includes(activeSess.sessionNumber);
                            const evaluationUrl = `${window.location.origin}/#/student/portal?groupId=${group?.id}&sessionNumber=${activeSess.sessionNumber}&feedback=true`;
                            
                            if (!needsEvaluation) return null;
                            
                            return (
                              <div className="p-4 rounded-2xl border-2 border-purple-500/30 bg-purple-950/20 text-purple-300 font-bold text-xs space-y-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>📝</span>
                                  <p className="font-black text-purple-400">هذه المحاضرة تحتاج إرسال لينك تقييم للمتدربين.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(evaluationUrl);
                                    alert("تم نسخ لينك التقييم بنجاح!");
                                  }}
                                  className="w-full bg-purple-600 font-black text-white hover:bg-purple-500 py-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 transition-all text-[11px]"
                                >
                                  📋 نسخ لينك التقييم للمحاضرة #{activeSess.sessionNumber}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3 w-full" dir="rtl">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-extrabold text-slate-200 text-xs">مخرجات وبنود الكورس (Course Checklist)</h4>
                              <button
                                type="button"
                                onClick={() => setShowAddExtraForm(!showAddExtraForm)}
                                className={`text-[10px] px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 ${
                                  showAddExtraForm 
                                    ? 'bg-rose-950/45 text-rose-400 border border-rose-900/50 hover:bg-rose-950/80' 
                                    : 'bg-indigo-950/45 text-indigo-400 border border-indigo-900/50 hover:bg-indigo-950/80'
                                }`}
                              >
                                {showAddExtraForm ? '❌ إلغاء الإضافة' : '➕ إضافة جزء إضافي أثناء المحاضرة'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleAllPlannedForSession(activeSess.sessionNumber, true)}
                              className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-2.5 py-1 rounded-lg font-black transition-all hover:bg-emerald-950/80"
                            >
                              ✔️ تحديد كل بنود المحاضرة كمكتمل
                            </button>
                          </div>

                          {showAddExtraForm && (
                            <form onSubmit={handleAddExtraChecklistItem} className="p-4 rounded-2xl bg-slate-950 border border-indigo-950/50 space-y-3 font-sans" dir="rtl">
                              <div className="text-right">
                                <h5 className="text-[11px] font-black text-indigo-400">إضافة بند/جزء جديد تم شرحه أثناء المحاضرة</h5>
                                <p className="text-[9px] text-slate-500">قم بإضافة جزء إضافي لتسجيله، وتحديد ما إذا كان استثناءً لهذه المحاضرة فقط أم جزءاً من الخطة الدائمة للمدرب.</p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">عنوان الجزء الإضافي *</label>
                                <input
                                  type="text"
                                  required
                                  value={extraTitle}
                                  onChange={e => setExtraTitle(e.target.value)}
                                  placeholder="مثال: شرح مكتبة Axios واستدعاء الـ API..."
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-100 outline-none focus:border-indigo-500 transition-all text-right"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">تفاصيل أو وصف إضافي (اختياري)</label>
                                <textarea
                                  value={extraDesc}
                                  onChange={e => setExtraDesc(e.target.value)}
                                  placeholder="تفاصيل إضافية حول البند أو التطبيق العملي..."
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-100 outline-none focus:border-indigo-500 transition-all h-16 resize-none text-right"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 block">نطاق البند وطريقة تأثيره</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:bg-slate-900 transition-all">
                                    <input
                                      type="radio"
                                      name="extraScope"
                                      checked={extraScope === 'session_only'}
                                      onChange={() => setExtraScope('session_only')}
                                      className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 bg-slate-950"
                                    />
                                    <div className="flex-1 pr-1">
                                      <span className="text-[10px] font-black text-slate-200 block">⚠️ استثناء خاص بالمجموعة الحالية</span>
                                      <span className="text-[8px] text-slate-500 block">لا يؤثر على خطة الكورس الأساسية أو المجموعات الأخرى</span>
                                    </div>
                                  </label>

                                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:bg-slate-900 transition-all">
                                    <input
                                      type="radio"
                                      name="extraScope"
                                      checked={extraScope === 'trainer_master'}
                                      onChange={() => setExtraScope('trainer_master')}
                                      className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 bg-slate-950"
                                    />
                                    <div className="flex-1 pr-1">
                                      <span className="text-[10px] font-black text-slate-200 block">🔁 إضافة للخطة الأساسية للمدرب</span>
                                      <span className="text-[8px] text-slate-500 block">يصبح جزءاً دائمًا ويظهر في كل مجموعات هذا الكورس التي يدرسها هذا المدرب</span>
                                    </div>
                                  </label>
                                </div>
                              </div>

                              <button
                                type="submit"
                                disabled={isSavingExtra || !extraTitle.trim()}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white py-2 rounded-xl text-xs font-black tracking-wide transition-all shadow-md active:scale-95"
                              >
                                {isSavingExtra ? 'جاري الإضافة والحفظ...' : '💾 حفظ وإدراج الجزء الإضافي'}
                              </button>
                            </form>
                          )}

                          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                            {combinedItems && combinedItems.length > 0 ? (
                              combinedItems.map((item: any) => {
                                const isCurrentPlanned = (item.suggestedSession || item.seq || 1) === activeSess.sessionNumber;
                                const isDelayed = !item.isCompleted && (item.suggestedSession || item.seq || 1) < activeSess.sessionNumber;
                                const isCompleted = !!item.isCompleted;
                                const isExtra = !!item.isExtra;

                                let bgBorderClass = '';
                                if (isExtra) {
                                  if (isCompleted) {
                                    bgBorderClass = 'bg-teal-950/20 border-teal-600/45 border-dashed';
                                  } else {
                                    bgBorderClass = item.scope === 'trainer_master'
                                      ? 'bg-purple-950/15 border-purple-800/40 border-dashed'
                                      : 'bg-amber-950/15 border-amber-800/40 border-dashed';
                                  }
                                } else {
                                  bgBorderClass = isCompleted 
                                    ? 'bg-emerald-950/15 border-emerald-900/35' 
                                    : isCurrentPlanned 
                                      ? 'bg-blue-950/10 border-blue-900/35' 
                                      : 'bg-slate-950 border-slate-850';
                                }

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-3 rounded-xl border transition-all text-right flex flex-col justify-between gap-2 ${bgBorderClass}`}
                                  >
                                    <div className="flex justify-between items-start gap-4">
                                      <input
                                        type="checkbox"
                                        checked={isCompleted}
                                        onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                                        className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-800 bg-slate-950 cursor-pointer accent-emerald-500 mt-0.5"
                                      />
                                      <div className="flex-1 space-y-1 pr-1">
                                        <p className="text-xs font-black text-slate-200 leading-snug">
                                          {item.title}
                                          {isExtra && (
                                            <span className="mr-1.5 px-1.5 py-0.5 rounded text-[8px] bg-slate-800 text-slate-300 border border-slate-700 font-extrabold inline-block">
                                              {item.scope === 'session_only' ? '✨ استثناء' : '🔁 خطة المدرب'}
                                            </span>
                                          )}
                                        </p>
                                        {item.description && (
                                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{item.description}</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Item status badges */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 border-t border-slate-850 pt-2 text-[9px] text-slate-500">
                                      <span className="font-extrabold bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                                        مستهدف: محاضرة {item.suggestedSession || item.seq || 1}
                                      </span>
                                      
                                      {isDelayed && (
                                        <span className="text-[9px] font-black bg-red-950/40 text-red-400 border border-red-900/40 px-2 py-0.5 rounded-md">
                                          ⚠️ متأخر عن الخطة النموذجية!
                                        </span>
                                      )}

                                      {isCompleted && (
                                        <span className="text-emerald-400 font-bold bg-emerald-950/30 px-2 py-0.5 rounded flex items-center gap-1">
                                          ✔ أُنجز في محاضرة {item.completedInSessionNum} بواسطة {item.completedByTrainerName || 'المدرب'}
                                        </span>
                                      )}

                                      {isExtra && (
                                        <span className="text-slate-400 font-medium bg-slate-800 px-2 py-0.5 rounded">
                                          📅 أُضيف بتاريخ {item.addedAtDate || 'اليوم'} (محاضرة {item.addedInSessionNumber}) {item.addedByTrainerName ? `بواسطة ${item.addedByTrainerName}` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-[10px] text-slate-500 font-semibold text-center py-4">لا توجد بنود وجدول مخرجات لهذا المقرر.</p>
                            )}
                          </div>
                        </div>
                        </div>

                        {/* Completed Operations Checklist */}
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                          <h4 className="font-extrabold text-slate-200 text-xs text-right animate-pulse">قائمة العمليات المنجزة (Ops Checklist)</h4>
                          <div className="space-y-2">
                            {[
                              { key: 'recordingUploaded', label: 'تم رفع تسجيل المحاضرة' },
                              { key: 'tasksEvaluated', label: 'تم تقييم التاسكات' },
                              { key: 'taskSent', label: 'تم ارسال التاسكات الجديدة' },
                              { key: 'whatsappConfirmationSent', label: 'اتبعت رسالة واتس اب للجروب' }
                            ].map(item => {
                              const isChecked = !!(currentMeta.opsChecklist as any)?.[item.key];
                              const checkedDetails = currentMeta.opsChecklistCheckedBy?.[item.key];
                              return (
                                <button
                                  key={item.key}
                                  onClick={() => {
                                    const wasChecked = !isChecked;
                                    const updatedOps = { 
                                      ...(currentMeta.opsChecklist || {}), 
                                      [item.key]: wasChecked 
                                    };
                                    const updatedCheckedBy = { ...(currentMeta.opsChecklistCheckedBy || {}) };
                                    if (wasChecked) {
                                      updatedCheckedBy[item.key] = {
                                        byName: user.name,
                                        atTime: getCairoDateTimeStr()
                                      };
                                    } else {
                                      delete updatedCheckedBy[item.key];
                                    }
                                    handleSaveMeta({ ...currentMeta, opsChecklist: updatedOps, opsChecklistCheckedBy: updatedCheckedBy });
                                  }}
                                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-right ${isChecked ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/30'}`}
                                >
                                  <div className="flex flex-col text-right">
                                    <span className="text-xs font-bold leading-relaxed">{item.label}</span>
                                    {isChecked && checkedDetails && (
                                      <span className="text-[10px] text-emerald-400/80 mt-1 font-arabic">
                                        ✓ تمت بواسطة: <span className="font-extrabold text-emerald-300">{checkedDetails.byName}</span> - {checkedDetails.atTime}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-lg flex items-center justify-center p-1 rounded-lg">
                                    {isChecked ? '💚' : '⚪'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {evaluationMode === 'project' && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h3 className="font-black text-indigo-400 text-sm uppercase tracking-widest">Final Project Scoring</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-black">Changes are saved automatically</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 border-b border-slate-800">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Name</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Project Score</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredStudentsForEval.map(s => {
                        const rank = rankings.find(r => r.studentId === s.id);
                        const currentScore = rank?.projectScore ?? -1;
                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-8 py-5 font-bold text-slate-200 text-xs">{s.name}</td>
                            <td className="px-8 py-5 text-center">
                              <input 
                                type="number" 
                                defaultValue={rank?.projectScore || 0} 
                                onBlur={(e) => handleRealTimeProjectUpdate(s.id, parseInt(e.target.value) || 0)} 
                                className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-black text-indigo-400 text-center focus:ring-2 focus:ring-indigo-500 outline-none" 
                              />
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${currentScore >= 0 ? 'bg-indigo-950 border-indigo-700 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                {currentScore >= 0 ? 'Evaluated' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'graduationProjects' && group && (
        <GroupGraduationProjectsTab
          group={group}
          students={students}
          rankings={rankings}
          user={user}
        />
      )}

      {activeTab === 'certificates' && group && (() => {
        const totalSessionsDone = sessions.filter(s => s.status === 'done').length;
        const totalGradProjectsCount = gradProjects.length;

        // Compute metrics for each student
        const studentMetrics = students.map((s, idx) => {
          // 1. Attendance
          const studentEvals = evaluations.filter(e => e.studentId === s.id);
          const uniqueAttendedSessions = new Set(
            studentEvals.filter(e => e.attendance === 1 && e.sessionNumber !== undefined).map(e => e.sessionNumber)
          );
          const attendedCount = Math.min(uniqueAttendedSessions.size, totalSessionsDone);
          const attendanceRate = totalSessionsDone > 0 ? Math.min(100, Math.round((attendedCount / totalSessionsDone) * 100)) : 100;

          // 2. Tasks
          const totalRequiredTasks = sessions.filter(ses => ses.status === 'done').reduce((sum, ses) => sum + (ses.requiredTasksCount || 0), 0);
          const totalCompletedTasks = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
          const tasksRate = totalRequiredTasks > 0 ? Math.min(100, Math.round((totalCompletedTasks / totalRequiredTasks) * 100)) : 100;

          // 3. Graduation Projects Submitted
          const studentSubmittedProjectsCount = gradSubmissions.filter(
            sub => sub.studentId === s.id && gradProjects.some(gp => gp.id === sub.projectId)
          ).length;
          const projectsRate = totalGradProjectsCount > 0 ? Math.round((studentSubmittedProjectsCount / totalGradProjectsCount) * 100) : 100;

          // 4. Auto Eligibility Check
          const isAttendanceEligible = attendanceRate >= 80;
          const isTasksEligible = tasksRate >= 80;
          const isProjectsEligible = totalGradProjectsCount === 0 || (studentSubmittedProjectsCount / totalGradProjectsCount) >= 0.5;

          const isAutoEligible = isAttendanceEligible && isTasksEligible && isProjectsEligible;

          // 5. Reasons for non-auto eligibility
          const missingReasons: string[] = [];
          if (!isAttendanceEligible) missingReasons.push(`الحضور ${attendanceRate}% (<80%)`);
          if (!isTasksEligible) missingReasons.push(`التاسكات ${tasksRate}% (<80%)`);
          if (!isProjectsEligible) missingReasons.push(`المشاريع ${studentSubmittedProjectsCount}/${totalGradProjectsCount} (<50%)`);

          // 6. Record & Overrides
          const rec = certificateRecords.find(r => r.studentId === s.id);
          let finalStatus: 'eligible' | 'ineligible' = 'ineligible';
          let statusType: 'auto_eligible' | 'exception_eligible' | 'blocked' | 'auto_ineligible' = 'auto_ineligible';

          if (rec?.statusOverride === 'blocked') {
            finalStatus = 'ineligible';
            statusType = 'blocked';
          } else if (rec?.statusOverride === 'exception_granted') {
            finalStatus = 'eligible';
            statusType = 'exception_eligible';
          } else if (isAutoEligible) {
            finalStatus = 'eligible';
            statusType = 'auto_eligible';
          } else {
            finalStatus = 'ineligible';
            statusType = 'auto_ineligible';
          }

          // Rank from rankings state
          const rankIndex = rankings.findIndex(r => r.studentId === s.id);
          const rankNum = rankIndex !== -1 ? rankIndex + 1 : idx + 1;

          return {
            student: s,
            rankNum,
            attendanceRate,
            tasksRate,
            studentSubmittedProjectsCount,
            totalGradProjectsCount,
            projectsRate,
            isAutoEligible,
            missingReasons,
            rec,
            finalStatus,
            statusType
          };
        });

        // Filter students based on search and filter type
        const filteredMetrics = studentMetrics.filter(m => {
          const nameMatch = m.student.name.toLowerCase().includes(certSearchQuery.toLowerCase()) ||
                            (m.student.studentIdNum || '').includes(certSearchQuery);
          if (!nameMatch) return false;

          if (certFilterType === 'eligible') return m.finalStatus === 'eligible';
          if (certFilterType === 'ineligible') return m.finalStatus === 'ineligible';
          if (certFilterType === 'exception') return m.statusType === 'exception_eligible';
          if (certFilterType === 'blocked') return m.statusType === 'blocked';
          return true;
        });

        const totalStudentsCount = students.length;
        const totalEligibleCount = studentMetrics.filter(m => m.finalStatus === 'eligible').length;
        const totalIneligibleCount = studentMetrics.filter(m => m.finalStatus === 'ineligible').length;
        const totalUploadedCertCount = studentMetrics.filter(m => m.rec?.certificateUrl).length;

        return (
          <div className="space-y-6 font-arabic text-right" dir="rtl">
            {/* Top Banner & Group Visibility Toggle */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">📜</span>
                  <h3 className="text-xl font-black text-white">إدارة شهادات التخرج وأهلية الطلاب</h3>
                  {group.certificatesVisibleToStudents ? (
                    <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-xs px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle size={14} /> الشهادات ظاهرة للمتدربين في Portal 👁️
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-400 font-extrabold text-xs px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1">
                      <XCircle size={14} /> الشهادات مخفية عن المتدربين حالياً 🙈
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  يمكنك متابعة الشروط التلقائية لكل طالب، منح استثناءات، إيقاف الشهادات، وإضافة رابط الشهادة. لن تظهر نتائج أيا من الشهادات للطلاب حتى تقوم بضغط زر تفعيل وإظهار الشهادات أدناه.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const nextVal = !group.certificatesVisibleToStudents;
                  try {
                    await toggleGroupCertificatesVisibility(group.id, nextVal, user);
                    setGroup(prev => prev ? { ...prev, certificatesVisibleToStudents: nextVal } : prev);
                  } catch (err: any) {
                    alert('حدث خطأ أثناء تغيير حالة ظهور الشهادات: ' + err.message);
                  }
                }}
                className={`px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-xl flex items-center gap-2 cursor-pointer shrink-0 ${
                  group.certificatesVisibleToStudents
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {group.certificatesVisibleToStudents ? (
                  <>
                    <XCircle size={16} />
                    <span>إخفاء الشهادات عن المتدربين 🙈</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>إظهار الشهادات للمتدربين في الجروب 👁️</span>
                  </>
                )}
              </button>
            </div>

            {/* Rules Criteria Card */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-xs space-y-2">
              <h4 className="font-black text-amber-400 flex items-center gap-2">
                <span>📌 الشروط التلقائية لأهلية الشهادة (Standard Graduation Criteria):</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-slate-300 font-bold">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2">
                  <span className="text-emerald-400 text-base">🟢</span>
                  <span>1. نسبة الحضور: <strong className="text-white">80% أو أكثر</strong></span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2">
                  <span className="text-emerald-400 text-base">🟢</span>
                  <span>2. أداء التاسكات: <strong className="text-white">80% أو أكثر</strong></span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2">
                  <span className="text-emerald-400 text-base">🟢</span>
                  <span>3. مشاريع التخرج: <strong className="text-white">50% على الأقل</strong></span>
                </div>
              </div>
            </div>

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-right">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">إجمالي الطلاب</span>
                <span className="text-2xl font-black text-white mt-1 block">{totalStudentsCount}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-right">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">المؤهلون للشهادة</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">{totalEligibleCount}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-right">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">غير المؤهلين</span>
                <span className="text-2xl font-black text-rose-400 mt-1 block">{totalIneligibleCount}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-right">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">شهادات تم رفعها</span>
                <span className="text-2xl font-black text-sky-400 mt-1 block">{totalUploadedCertCount}</span>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  value={certSearchQuery}
                  onChange={(e) => setCertSearchQuery(e.target.value)}
                  placeholder="بحث باسم الطالب أو الكود..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setCertFilterType('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${certFilterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  الكل ({studentMetrics.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterType('eligible')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${certFilterType === 'eligible' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  المؤهلون ({totalEligibleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterType('ineligible')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${certFilterType === 'ineligible' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  غير المؤهلين ({totalIneligibleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterType('exception')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${certFilterType === 'exception' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  استثناء خاص ({studentMetrics.filter(m => m.statusType === 'exception_eligible').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterType('blocked')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${certFilterType === 'blocked' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  الموقوفون ({studentMetrics.filter(m => m.statusType === 'blocked').length})
                </button>
              </div>
            </div>

            {/* Main Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase">
                    <tr>
                      <th className="px-4 py-4 text-center">الرانك</th>
                      <th className="px-4 py-4">اسم الطالب</th>
                      <th className="px-4 py-4 text-center">نسبة الحضور</th>
                      <th className="px-4 py-4 text-center">أداء التاسكات</th>
                      <th className="px-4 py-4 text-center">مشاريع التخرج</th>
                      <th className="px-4 py-4">حالة الأهلية للشهادة</th>
                      <th className="px-4 py-4 text-center">رابط الشهادة</th>
                      <th className="px-4 py-4 text-center">التحكم والعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredMetrics.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500 font-bold">
                          لا يوجد طلاب يطابقون خيارات البحث أو التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredMetrics.map((m) => {
                        return (
                          <tr key={m.student.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Rank */}
                            <td className="px-4 py-4 text-center font-black text-sm text-slate-300">
                              {m.rankNum === 1 ? '🥇' : m.rankNum === 2 ? '🥈' : m.rankNum === 3 ? '🥉' : `#${m.rankNum}`}
                            </td>

                            {/* Student Info */}
                            <td className="px-4 py-4">
                              <div className="font-black text-white text-sm">{m.student.name}</div>
                              {m.student.studentIdNum && (
                                <div className="text-[10px] text-slate-500 font-mono">كود: {m.student.studentIdNum}</div>
                              )}
                            </td>

                            {/* Attendance % */}
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                m.attendanceRate >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {m.attendanceRate}%
                              </span>
                            </td>

                            {/* Tasks % */}
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                m.tasksRate >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {m.tasksRate}%
                              </span>
                            </td>

                            {/* Graduation Projects */}
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                (m.totalGradProjectsCount === 0 || (m.studentSubmittedProjectsCount / m.totalGradProjectsCount) >= 0.5)
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {m.studentSubmittedProjectsCount} / {m.totalGradProjectsCount} ({m.projectsRate}%)
                              </span>
                            </td>

                            {/* Eligibility Status */}
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                {m.statusType === 'auto_eligible' && (
                                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-black text-[11px] inline-flex items-center gap-1">
                                    <CheckCircle size={13} /> مؤهل (تلقائياً) 🟢
                                  </span>
                                )}
                                {m.statusType === 'exception_eligible' && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-black text-[11px] inline-flex items-center gap-1">
                                    <Sparkles size={13} /> مؤهل (باستثناء خاص) 🌟
                                  </span>
                                )}
                                {m.statusType === 'blocked' && (
                                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full font-black text-[11px] inline-flex items-center gap-1">
                                    <XCircle size={13} /> غير مؤهل (موقف بقرار) ⛔
                                  </span>
                                )}
                                {m.statusType === 'auto_ineligible' && (
                                  <span className="bg-rose-500/15 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full font-black text-[11px] inline-flex items-center gap-1">
                                    <XCircle size={13} /> غير مؤهل 🔴
                                  </span>
                                )}

                                {/* Notes / Reasons */}
                                {m.rec?.overrideReason && (
                                  <p className="text-[10px] text-amber-300 font-bold bg-amber-950/30 p-1.5 rounded-lg border border-amber-500/20">
                                    سبب القرار: {m.rec.overrideReason}
                                  </p>
                                )}
                                {m.missingReasons.length > 0 && m.statusType === 'auto_ineligible' && (
                                  <p className="text-[10px] text-rose-300 leading-tight">
                                    القصور: {m.missingReasons.join(' | ')}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Certificate Link */}
                            <td className="px-4 py-4 text-center">
                              {m.rec?.certificateUrl ? (
                                <a
                                  href={m.rec.certificateUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-[11px] rounded-xl border border-emerald-500/30 inline-flex items-center gap-1 transition-all"
                                >
                                  <ExternalLink size={13} />
                                  <span>عرض الشهادة 📜</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-medium">غير متوفر</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCertStudent(m.student);
                                    setCertOverrideType(m.rec?.statusOverride || 'none');
                                    setCertOverrideReason(m.rec?.overrideReason || '');
                                    setIsCertExceptionModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-[11px] rounded-xl border border-slate-700 transition-all cursor-pointer"
                                >
                                  ⚙️ استثناء/إيقاف
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCertStudent(m.student);
                                    setCertUrlInput(m.rec?.certificateUrl || '');
                                    setCertUneligibilityNote(m.rec?.uneligibilityReason || '');
                                    setIsCertLinkModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-xl shadow-md transition-all cursor-pointer"
                                >
                                  🔗 رابط الشهادة
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EXCEPTION MODAL */}
            {isCertExceptionModalOpen && selectedCertStudent && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
                <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative space-y-5">
                  <button
                    type="button"
                    onClick={() => setIsCertExceptionModalOpen(false)}
                    className="absolute top-5 left-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>

                  <div className="space-y-1 text-right border-b border-slate-800 pb-3">
                    <span className="text-[10px] font-black text-amber-400 uppercase bg-amber-950/60 px-3 py-1 rounded-full border border-amber-900/60">
                      التحكم بالاستثناء الإداري للشهادة
                    </span>
                    <h3 className="text-lg font-black text-white pt-1">الطالب: {selectedCertStudent.name}</h3>
                  </div>

                  <div className="space-y-3 text-right">
                    <label className="text-xs font-black text-slate-300 block">اختر نوع الإجراء الاستثنائي:</label>
                    
                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/50">
                      <input
                        type="radio"
                        name="certOverride"
                        value="exception_granted"
                        checked={certOverrideType === 'exception_granted'}
                        onChange={() => setCertOverrideType('exception_granted')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-amber-300 block">🌟 منح شهادة باستثناء (Qualify by Exception)</span>
                        <span className="text-[11px] text-slate-400">اعتبار الطالب مؤهلاً للحصول على الشهادة رغم عدم استيفاء كامل الشروط التلقائية.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-rose-500/50">
                      <input
                        type="radio"
                        name="certOverride"
                        value="blocked"
                        checked={certOverrideType === 'blocked'}
                        onChange={() => setCertOverrideType('blocked')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-rose-400 block">⛔ إيقاف الشهادة (Stop / Block Certificate)</span>
                        <span className="text-[11px] text-slate-400">حجب وإيقاف إصدار الشهادة لهذا الطالب حتى لو كان مؤهلاً تلقائياً.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-indigo-500/50">
                      <input
                        type="radio"
                        name="certOverride"
                        value="none"
                        checked={certOverrideType === 'none'}
                        onChange={() => setCertOverrideType('none')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-200 block">🔄 إلغاء الاستثناء والعودة للتقييم التلقائي</span>
                        <span className="text-[11px] text-slate-400">الاعتماد المباشر على الحساب التلقائي لشروط الشهادة.</span>
                      </div>
                    </label>
                  </div>

                  {certOverrideType !== 'none' && (
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-black text-rose-300 block">
                        سبب الاستثناء / الإيقاف (مطلوب) <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={certOverrideReason}
                        onChange={(e) => setCertOverrideReason(e.target.value)}
                        placeholder="اكتب سبب منح الاستثناء أو سبب إيقاف الشهادة بوضوح..."
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  )}

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCertExceptionModalOpen(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={isSavingCert || (certOverrideType !== 'none' && !certOverrideReason.trim())}
                      onClick={async () => {
                        if (!user || !selectedCertStudent) return;
                        if (certOverrideType !== 'none' && !certOverrideReason.trim()) {
                          alert('يرجى كتابة سبب الاستثناء أو الإيقاف أولاً.');
                          return;
                        }
                        setIsSavingCert(true);
                        try {
                          await saveStudentCertificateRecord(
                            group.id,
                            selectedCertStudent.id,
                            {
                              studentName: selectedCertStudent.name,
                              statusOverride: certOverrideType,
                              overrideReason: certOverrideReason.trim()
                            },
                            user
                          );
                          setIsCertExceptionModalOpen(false);
                        } catch (err: any) {
                          alert('حدث خطأ أثناء الحفظ: ' + err.message);
                        } finally {
                          setIsSavingCert(false);
                        }
                      }}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-2xl text-xs shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCert ? 'جاري الحفظ...' : 'تأكيد وحفظ 💾'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* LINK MODAL */}
            {isCertLinkModalOpen && selectedCertStudent && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-arabic" dir="rtl">
                <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative space-y-5">
                  <button
                    type="button"
                    onClick={() => setIsCertLinkModalOpen(false)}
                    className="absolute top-5 left-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>

                  <div className="space-y-1 text-right border-b border-slate-800 pb-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-950 px-3 py-1 rounded-full border border-indigo-900">
                      رفع ورصد رابط شهادة التخرج
                    </span>
                    <h3 className="text-lg font-black text-white pt-1">الطالب: {selectedCertStudent.name}</h3>
                  </div>

                  <div className="space-y-4 text-right">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-200 block">
                        رابط ملف الشهادة (Google Drive / PDF / Image):
                      </label>
                      <input
                        type="url"
                        value={certUrlInput}
                        onChange={(e) => setCertUrlInput(e.target.value)}
                        placeholder="https://drive.google.com/file/d/..."
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white font-mono text-left focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-400 block">
                        ملاحظة أو سبب عدم الأهلية (تظهر للطالب إن وجد / اختياري):
                      </label>
                      <textarea
                        rows={2}
                        value={certUneligibilityNote}
                        onChange={(e) => setCertUneligibilityNote(e.target.value)}
                        placeholder="أي ملاحظات إضافية بخصوص شهادة الطالب..."
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCertLinkModalOpen(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={isSavingCert}
                      onClick={async () => {
                        if (!user || !selectedCertStudent) return;
                        setIsSavingCert(true);
                        try {
                          await saveStudentCertificateRecord(
                            group.id,
                            selectedCertStudent.id,
                            {
                              studentName: selectedCertStudent.name,
                              certificateUrl: certUrlInput.trim(),
                              uneligibilityReason: certUneligibilityNote.trim()
                            },
                            user
                          );
                          setIsCertLinkModalOpen(false);
                        } catch (err: any) {
                          alert('حدث خطأ أثناء حفظ رابط الشهادة: ' + err.message);
                        } finally {
                          setIsSavingCert(false);
                        }
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-2xl text-xs shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCert ? 'جاري الحفظ...' : 'حفظ الرابط 💾'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'taskProgress' && (
        <div className="space-y-8">
          {/* Quick Guide / دليل الاستخدام والشرط التلقائي */}
          <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/20 p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {lang === 'ar' ? 'دليل أداء المهام ونظام المتابعات التلقائي' : 'Task Progress Guide & Auto Follow-up Logic'}
                </h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {lang === 'ar' 
                  ? 'إذا انخفض معدل تسليم المهام الكلي للطالب عن 70% يتم صياغة تنبيه تلقائي في الملخص لمتابعة الطالب وحثّه على الإنجاز. عند اتخاذ طلب متابعة "⚠️ Request"، يتم إرسال طلب مباشرة إلى بوابة المتابعات الخارجية لمتابعة حالة الطالب من قبل المشرف والمدرب وتوثيق التواصل بالتفصيل.'
                  : 'If a student\'s overall task completion rate drops below 70%, an alert is highlighted for immediate review. Clicking "⚠️ Request" triggers an automatic follow-up request, transferring the case directly to the Follow-Ups Portal for detailed supervisor and trainer coordination.'
                }
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {lang === 'ar' ? 'أداء ممتاز (>= 70%)' : 'Excellent Performance (>= 70%)'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {lang === 'ar' ? 'متابعة مرشحة (< 70%)' : 'Needs Follow-up Alert (< 70%)'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-primary-450 font-bold">
                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                  {lang === 'ar' ? 'طلب فولو أب نشط في البوابة حالياً' : 'Active Follow-up Portal Request'}
                </div>
              </div>
            </div>
            <div className="self-stretch flex items-center justify-center px-4 bg-blue-500/10 rounded-2xl border border-blue-500/10 shrink-0">
              <div className="text-center py-2">
                <span className="block text-[11px] font-black uppercase text-blue-400 tracking-widest">{lang === 'ar' ? 'الشرط الحرج' : 'Critical Threshold'}</span>
                <span className="block text-2xl font-black text-white">&lt; 70%</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Attendance</p>
              <h4 className="text-2xl font-black text-emerald-500">
                {taskProgressData.length > 0 ? Math.round(taskProgressData.reduce((sum, d) => sum + d.attendanceRate, 0) / taskProgressData.length) : 0}%
              </h4>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Performance</p>
              <h4 className="text-2xl font-black text-blue-500">
                {taskProgressData.length > 0 ? Math.round(taskProgressData.reduce((sum, d) => sum + d.completionRate, 0) / taskProgressData.length) : 0}%
              </h4>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Tasks Done</p>
              <h4 className="text-2xl font-black text-white">
                {taskProgressData.reduce((sum, d) => sum + d.totalCompleted, 0)}
              </h4>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Missing Tasks</p>
              <h4 className="text-2xl font-black text-red-500">
                {taskProgressData.reduce((sum, d) => sum + d.missingCount, 0)}
              </h4>
            </div>
          </div>

          {/* Dashboard Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Task Completion by Session</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessions.map(s => {
                    const sessionEvals = evaluations.filter(e => e.sessionNumber === s.sessionNumber);
                    const totalCompleted = sessionEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
                    const totalRequired = students.length * (s.requiredTasksCount || 0);
                    return {
                      name: `Lec ${s.sessionNumber}`,
                      completed: totalCompleted,
                      required: totalRequired,
                      rate: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0
                    };
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" />
                    <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                    />
                    <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Completed Tasks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Overall Group Progress</h3>
              <div className="h-[250px] flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: taskProgressData.reduce((sum, d) => sum + d.totalCompleted, 0) },
                        { name: 'Remaining', value: taskProgressData.reduce((sum, d) => sum + (d.totalRequired - d.totalCompleted), 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-wrap gap-4 items-end shadow-sm">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Search Student</label>
              <input 
                type="text" 
                value={taskSearchQuery} 
                onChange={e => setTaskSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                placeholder="Search by name..."
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Completion Threshold (%)</label>
              <input 
                type="number" 
                value={taskFilterCompletionThreshold} 
                onChange={e => setTaskFilterCompletionThreshold(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                placeholder="Below %"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Missing Session #</label>
              <input 
                type="number" 
                value={taskFilterSessionNum} 
                onChange={e => setTaskFilterSessionNum(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                placeholder="Session #"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Sort By</label>
              <select 
                value={taskSortBy} 
                onChange={e => setTaskSortBy(e.target.value as any)}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="name">Name (A-Z)</option>
                <option value="missing">Most Missing</option>
                <option value="completion">Lowest Completion %</option>
              </select>
            </div>
            <button 
              onClick={() => setTaskFilterMissingOnly(!taskFilterMissingOnly)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${taskFilterMissingOnly ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              Missing Only
            </button>
          </div>

          {/* Matrix */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <h3 className="font-black text-white text-sm uppercase tracking-widest">Student Task Matrix</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">Missing</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-950 z-10">Student</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance %</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Performance %</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Missing Tasks</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Follow-up</th>
                    {sessions.map(s => (
                      <th key={s.id} className="px-4 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[120px]">
                        Lec {s.sessionNumber}
                        {s.date && <div className="text-[8px] text-slate-500 mt-0.5">{s.date}</div>}
                        <div className="text-[9px] text-blue-400 mt-0.5 truncate max-w-[100px] mx-auto">{s.lectureTitle || 'No Title'}</div>
                        <div className="text-[8px] text-slate-600 mt-1">Req: {s.requiredTasksCount || 0}</div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-center text-[10px] font-black text-white bg-blue-600 uppercase tracking-widest">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {taskProgressData.map(({ student, totalRequired, totalCompleted, completionRate, attendanceRate, missingCount, evals }) => {
                    const followUp = studentFollowUps.find(f => f.studentId === student.id);
                    const lastCommentDate = followUp?.lastUpdatedAt?.toDate ? followUp.lastUpdatedAt.toDate().toLocaleDateString() : 'No follow-up yet';
                    
                    return (
                      <tr
                        key={student.id}
                        ref={(el) => { taskProgressRowRefs.current[student.id] = el; }}
                        className={`hover:bg-slate-800/40 group transition-colors ${student.deactivated ? 'opacity-65' : ''} ${highlightedStudentId === student.id ? 'ring-2 ring-primary-500 bg-primary-500/10' : ''}`}
                      >
                        <td className="px-6 py-4 sticky left-0 bg-slate-900 group-hover:bg-slate-800 z-10 border-r border-slate-800">
                          <div className="flex flex-col">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`font-bold ${student.deactivated ? 'text-red-400 line-through opacity-80' : 'text-slate-200'}`}>{student.name}</span>
                              {student.deactivated && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-500/10 text-red-400 border border-red-500/20">
                                  {lang === 'ar' ? '🚫 موقوف' : '🚫 Deactivated'}
                                </span>
                              )}
                              {followUp && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                  followUp.status === 'active' 
                                    ? 'bg-red-650 text-white animate-pulse' 
                                    : 'bg-slate-700 text-slate-350'
                                }`} title="Has follow-up history">
                                  {lang === 'ar' ? 'له سجل متابعة 📜' : 'Has History 📜'}
                                </span>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {followUp?.labels?.map(l => {
                                  const lDef = labelDefinitions.find(def => def.name === l || def.id === l);
                                  if (lDef && lDef.visibleOnScreen === false) return null;
                                  let labelText = l;
                                  let bgColor = 'bg-slate-800';
                                  let textColor = 'text-slate-400';
                                  
                                  if (l === 'absence') { labelText = 'Absence'; bgColor = 'bg-red-500/20'; textColor = 'text-red-400'; }
                                  else if (l === 'tasks') { labelText = 'Tasks'; bgColor = 'bg-amber-500/20'; textColor = 'text-amber-400'; }
                                  else if (l === 'distinguished') { labelText = 'Distinguished'; bgColor = 'bg-emerald-500/20'; textColor = 'text-emerald-400'; }
                                  else if (l === 'best_achiever') { labelText = 'Best Achiever'; bgColor = 'bg-primary-500/20'; textColor = 'text-primary-400'; }
                                  else if (lDef) { 
                                    return (
                                      <span key={l} className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest" style={{ backgroundColor: `${lDef.color}20`, color: lDef.color }}>
                                        {lDef.name}
                                      </span>
                                    );
                                  }

                                  return (
                                    <span key={l} className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${bgColor} ${textColor}`}>
                                      {labelText}
                                    </span>
                                  );
                                })}
                                {followUp?.status === 'active' && (
                                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse mt-1"></span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button 
                                onClick={() => setSelectedStudentForLabel({ id: student.id, name: student.name })}
                                className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400"
                                title="Add Label"
                              >
                                🏷️ Label
                              </button>
                              <button 
                                onClick={() => setSelectedStudentForComment(student)}
                                className="text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-400"
                                title="Add Comment"
                              >
                                💬 Comment
                              </button>
                              <button 
                                onClick={() => setSelectedStudentForHistory(student)}
                                className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all duration-300 flex items-center gap-1 ${
                                  followUp 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] animate-pulse' 
                                    : 'text-blue-500 hover:text-blue-400'
                                }`}
                                title="View History"
                              >
                                📜 {followUp ? (lang === 'ar' ? 'السجل (يوجد)' : 'History (Exists)') : (lang === 'ar' ? 'السجل' : 'History')}
                              </button>
                              {isAdmin && (
                                <button 
                                  onClick={() => { setFollowUpStudent(student); setIsSupervisorModalOpen(true); }} 
                                  className="text-[9px] font-black text-primary-500 uppercase tracking-widest hover:text-primary-400"
                                  title="Request Supervisor Follow-up"
                                >
                                  ⚠️ Request
                                </button>
                              )}
                              {student.phone && (
                                <a 
                                  href={`https://wa.me/${student.phone.replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-[9px] font-black text-green-500 uppercase tracking-widest hover:text-green-400"
                                  title="WhatsApp"
                                >
                                  🟢 WA
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => exportStudentTaskReport(student, 'full')}
                                className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-400 text-left"
                              >
                                Export Full
                              </button>
                              <button 
                                onClick={() => exportStudentTaskReport(student, 'missing')}
                                className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-400 text-left"
                              >
                                Export Missing (Staff)
                              </button>
                              <button 
                                onClick={() => exportStudentTaskReport(student, 'missing_trainee')}
                                className="text-[9px] font-black text-primary-600 uppercase tracking-widest hover:text-primary-500 text-left"
                              >
                                Export Missing (Student)
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs font-black ${attendanceRate >= 80 ? 'text-emerald-500' : attendanceRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {attendanceRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs font-black ${completionRate >= 80 ? 'text-emerald-500' : completionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {completionRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs font-black ${missingCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {missingCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[10px] font-bold text-slate-400">{lastCommentDate}</span>
                        </td>
                        {sessions.map(s => {
                        const ev = evals.find(e => e.sessionNumber === s.sessionNumber);
                        const completed = ev?.taskDelivered || 0;
                        const required = s.requiredTasksCount || 0;
                        const isMissing = s.status === 'done' && required > completed;
                        const isUpcoming = s.status !== 'done';
                        
                        return (
                          <td key={s.id} className="px-4 py-4 text-center">
                            <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-xl border ${
                              isUpcoming 
                                ? 'bg-slate-800/50 border-slate-700 text-slate-500' 
                                : isMissing 
                                  ? 'bg-red-950/20 border-red-900/50 text-red-500' 
                                  : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-500'
                            }`}>
                              <span className="text-xs font-black">{completed}</span>
                              <span className="text-[8px] opacity-50">/ {required}</span>
                            </div>
                            {(s.lectureRecordingUrl || s.tasksMessageUrl) && (
                              <div className="flex justify-center gap-1 mt-1">
                                {s.lectureRecordingUrl && <a href={s.lectureRecordingUrl} target="_blank" rel="noreferrer" title="Recording" className="text-[10px]">🎥</a>}
                                {s.tasksMessageUrl && <a href={s.tasksMessageUrl} target="_blank" rel="noreferrer" title="Tasks Link" className="text-[10px]">🔗</a>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 bg-slate-950/50">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-black ${completionRate >= 80 ? 'text-emerald-500' : completionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {completionRate}%
                          </span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {totalCompleted}/{totalRequired}
                          </span>
                          {missingCount > 0 && (
                            <span className="text-[8px] font-black text-red-500 uppercase">
                              {missingCount} Missing Lecs
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'penalties' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-slate-900 p-6 rounded-3xl border border-slate-800 h-fit">
            <h3 className="font-black text-white text-sm uppercase tracking-widest mb-6">Add Penalty</h3>
            <form onSubmit={handleAddPenalty} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Student</label>
                <select required value={penaltyFormData.studentId} onChange={e => setPenaltyFormData({ ...penaltyFormData, studentId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Points (Minus)</label>
                <input type="number" required value={penaltyFormData.points} onChange={e => setPenaltyFormData({ ...penaltyFormData, points: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Reason</label>
                <textarea required value={penaltyFormData.reason} onChange={e => setPenaltyFormData({ ...penaltyFormData, reason: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white h-20" placeholder="Why this penalty?" />
              </div>
              <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20">Apply Penalty</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-black text-slate-300 text-sm uppercase tracking-widest">Active Penalties</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  value={penaltySearchQuery}
                  onChange={(e) => setPenaltySearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-200 outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Points</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Reason</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {penalties
                    .filter(p => {
                      if (!penaltySearchQuery.trim()) return true;
                      const q = penaltySearchQuery.trim().toLowerCase();
                      const student = students.find(s => s.id === p.studentId);
                      return (student?.name || '').toLowerCase().includes(q) || (student?.phone || '').includes(penaltySearchQuery.trim());
                    })
                    .map(p => {
                    const student = students.find(s => s.id === p.studentId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="px-6 py-4 font-bold text-slate-200">{student?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-red-500 font-black">-{p.points}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{p.reason}</td>
                        <td className="px-6 py-4 text-right">
                          {isAdmin && <button onClick={async () => { if(confirm("Remove?")) await removePenalty(p.id, p.groupId, p.studentId, user); }} className="text-slate-600 hover:text-red-500">🗑️</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (() => {
        const totalFeedbacks = feedbacks.length;
        const avgGeneral = totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + f.ratingGeneral, 0) / totalFeedbacks).toFixed(1) : '0';
        const avgTrainer = totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + f.ratingTrainerExplanation, 0) / totalFeedbacks).toFixed(1) : '0';
        const avgPractice = totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + f.ratingPracticeUseful, 0) / totalFeedbacks).toFixed(1) : '0';
        const avgContent = totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + f.ratingContentSuitable, 0) / totalFeedbacks).toFixed(1) : '0';
        const avgSupport = totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + f.ratingSupportService, 0) / totalFeedbacks).toFixed(1) : '0';

        // Trend Chart Data
        const chartData = (() => {
          const sessionGroups: Record<number, { count: number, sumGen: number, sumTrainer: number }> = {};
          feedbacks.forEach(f => {
            if (!sessionGroups[f.sessionNumber]) {
              sessionGroups[f.sessionNumber] = { count: 0, sumGen: 0, sumTrainer: 0 };
            }
            sessionGroups[f.sessionNumber].count += 1;
            sessionGroups[f.sessionNumber].sumGen += f.ratingGeneral;
            sessionGroups[f.sessionNumber].sumTrainer += f.ratingTrainerExplanation;
          });
          
          return Object.keys(sessionGroups).map(k => {
            const num = parseInt(k);
            const grp = sessionGroups[num];
            return {
              sessionNumber: `Lec ${num}`,
              'التقييم العام': parseFloat((grp.sumGen / grp.count).toFixed(2)),
              'أداء المدرب': parseFloat((grp.sumTrainer / grp.count).toFixed(2))
            };
          }).sort((a,b) => {
            const numA = parseInt(a.sessionNumber.split(' ')[1]);
            const numB = parseInt(b.sessionNumber.split(' ')[1]);
            return numA - numB;
          });
        })();

        return (
          <div className="space-y-8 animate-fade-in text-right font-arabic">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <div className="text-right">
                <h2 className="text-xl font-black text-white">تقييمات وملاحظات المتدربين للجروب</h2>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Trainee Feedback analysis and operations follow-up</p>
              </div>
              
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const headers = ["Lecture", "Student Name", "Course Satisfaction", "Trainer Satisfaction", "Application Rating", "Content Rating", "Service Rating", "Comments", "Complaint", "Complaint Status", "Staff Note"];
                      const csvRows = feedbacks.map(f => [
                        f.sessionNumber,
                        f.studentName || "Anonymous",
                        f.ratingGeneral,
                        f.ratingTrainerExplanation,
                        f.ratingPracticeUseful,
                        f.ratingContentSuitable,
                        f.ratingSupportService,
                        (f.comments || "").replace(/"/g, '""'),
                        f.hasComplaint ? (f.complaintText || "Yes").replace(/"/g, '""') : "No",
                        f.complaintStatus || "N/A",
                        (f.complaintFollowUpNote || "").replace(/"/g, '""')
                      ]);
                      
                      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
                        + [headers.join(","), ...csvRows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `Trainee_Evaluations_${group?.name || "Group"}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch (err: any) {
                      alert("Failed to export: " + err.message);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow"
                >
                  📥 تصدير Excel (CSV)
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const doc = new jsPDF();
                      doc.text(`Trainee Evaluation Report - Batch ${group?.name || ''}`, 14, 15);
                      const tableRows = feedbacks.map(f => [
                        `Lec ${f.sessionNumber}`,
                        f.studentName || 'Anonymous',
                        f.ratingGeneral,
                        f.ratingTrainerExplanation,
                        f.ratingSupportService,
                        f.comments || '',
                        f.hasComplaint ? `Complaint: ${f.complaintText || ''}` : 'No'
                      ]);
                      autoTable(doc, {
                        head: [['Lec', 'Name', 'General', 'Trainer', 'Support', 'Comment', 'Complaint']],
                        body: tableRows,
                        startY: 25,
                        styles: { fontSize: 8 }
                      });
                      doc.save(`Evaluations_${group?.name || ''}.pdf`);
                    } catch (err: any) {
                      alert("Failed to export PDF: " + err.message);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow"
                >
                  📄 تصدير تقرير PDF
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-right space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">عدد التقييمات المستقبلة</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-indigo-400">{feedbacks.length}</span>
                  <span className="text-xs text-slate-500 font-black">تقييماً</span>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-right space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">متوسط تقييم المحاضرات</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-emerald-400">{avgGeneral} / 5</span>
                  <span className="text-xs text-slate-500 font-black">رضا عام</span>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-right space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">متوسط تقييم المدرب</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-blue-400">{avgTrainer} / 5</span>
                  <span className="text-xs text-slate-500 font-black">وضوح الشرح</span>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-right space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">متوسط رضا الدعم والتنظيم</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-purple-400">{avgSupport} / 5</span>
                  <span className="text-xs text-slate-500 font-black">خدمة العملاء</span>
                </div>
              </div>
            </div>

            {/* More detailed metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-5 rounded-2.5xl border border-slate-800 text-right flex justify-between items-center">
                <div className="text-right">
                  <p className="text-sm font-black text-slate-200">مناسبة المحتوى لمستوى الطلاب</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">هل تناسب صعوبة ونطاق المعرفة في الشرح مستوى المجموعة؟</p>
                </div>
                <span className="text-2xl font-black text-emerald-400 bg-emerald-950/30 px-4 py-2 rounded-xl border border-emerald-900/45">{avgContent} / 5</span>
              </div>
              
              <div className="bg-slate-900 p-5 rounded-2.5xl border border-slate-800 text-right flex justify-between items-center">
                <div className="text-right">
                  <p className="text-sm font-black text-slate-200">وضوح وفائدة التطبيق العملي</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">هل كانت التطبيقات البرمجية والمشروعات واضحة ومثمرة؟</p>
                </div>
                <span className="text-2xl font-black text-blue-400 bg-blue-950/30 px-4 py-2 rounded-xl border border-blue-900/45">{avgPractice} / 5</span>
              </div>
            </div>

            {/* Recharts Analytics Trend line */}
            {chartData.length > 0 && (
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <h3 className="font-black text-white text-sm uppercase mb-6 text-right">📈 منحنى أداء التقييمات عبر المحاضرات</h3>
                <div className="h-72 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="sessionNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={[0, 5]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', textAlign: 'right' }} />
                      <Legend />
                      <Line type="monotone" dataKey="التقييم العام" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="أداء المدرب" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Complaints tracking section */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black border border-red-500/20">
                  {feedbacks.filter(f => f.hasComplaint).length} شكاوى نشطة
                </span>
                <h3 className="font-black text-slate-300 text-sm uppercase">🚨 الشكاوى والمشكلات التي تحتاج متابعة عاجلة</h3>
              </div>
              
              <div className="p-6 space-y-4">
                {feedbacks.filter(f => f.hasComplaint).length === 0 ? (
                  <p className="text-slate-500 text-center italic text-xs py-8">لا توجد أي شكاوى مسجلة بحاجة للمتابعة حالياً.</p>
                ) : (
                  feedbacks.filter(f => f.hasComplaint).map(f => {
                    const sNote = complaintNotes[f.id] ?? f.complaintFollowUpNote ?? '';
                    const sStatus = complaintStatuses[f.id] ?? f.complaintStatus ?? 'new';
                    
                    return (
                      <div key={f.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800/80 hover:border-red-500/25 transition-all text-right space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded border ${sStatus === 'solved' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : sStatus === 'in_progress' ? 'bg-amber-950/30 text-amber-400 border-amber-900/50' : sStatus === 'closed' ? 'bg-slate-850 text-slate-400 border-slate-800' : 'bg-red-950/30 text-red-400 border-red-900/50'}`}>
                              {sStatus === 'new' ? '🚫 شكوى جديدة' : sStatus === 'in_progress' ? '⚡ قيد المتابعة' : sStatus === 'solved' ? '✓ تم الحل' : '📦 أغلقت'}
                            </span>
                            
                            {f.wantsCall && (
                              <span className="text-[10px] font-black bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded border border-amber-500/25 animate-pulse">
                                📞 يرجى التواصل هاتفياً للمتابعة
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs space-y-1 text-right">
                            <h4 className="font-extrabold text-slate-200">الطالب: {f.studentName || 'مجهول الهوية (متدرب)'}</h4>
                            <h5 className="text-[10px] text-slate-500 font-bold">المحاضرة #{f.sessionNumber} • {f.date}</h5>
                          </div>
                        </div>

                        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                          <p className="text-xs text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">{f.complaintText}</p>
                        </div>

                        {f.onlineIssueText && (
                          <div className="text-xs bg-slate-900 p-3 rounded-xl border border-slate-850 leading-relaxed text-right">
                            <span className="text-[9px] uppercase font-black text-slate-500 block mb-1">تفاصيل مشكلة الأونلاين 🌐:</span>
                            <p className="text-slate-300">{f.onlineIssueText}</p>
                          </div>
                        )}
                        
                        {f.offlineVenueFeedback && (
                          <div className="text-xs bg-slate-900 p-3 rounded-xl border border-slate-850 leading-relaxed text-right">
                            <span className="text-[9px] uppercase font-black text-slate-500 block mb-1">تفاصيل تقييم مقر الأكاديمية 🏢:</span>
                            <p className="text-slate-300">{f.offlineVenueFeedback}</p>
                          </div>
                        )}

                        {/* Follow up actions */}
                        <div className="pt-4 border-t border-slate-900/60 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div className="space-y-1.5 md:col-span-2 text-right">
                            <label className="text-[10px] text-slate-500 font-extrabold block">ملاحظات خدمة العملاء والإجراءات المتخذة للمتابعة:</label>
                            <textarea
                              value={sNote}
                              onChange={(e) => setComplaintNotes({...complaintNotes, [f.id]: e.target.value})}
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs outline-none focus:border-red-500 text-right h-16"
                              placeholder="اكتب ملاحظات التواصل والحل مع الطالب..."
                            />
                          </div>

                          <div className="space-y-4 text-right">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-extrabold block">تحديث حالة الشكوى والمتابعة:</label>
                              <select
                                value={sStatus}
                                onChange={(e) => setComplaintStatuses({...complaintStatuses, [f.id]: e.target.value as any})}
                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                              >
                                <option value="new">إشارة جديدة (New) 🚫</option>
                                <option value="in_progress">قيد التواصل والمتابعة (In Progress) ⚡</option>
                                <option value="solved">تم حل المشكلة بالكامل (Solved) ✓</option>
                                <option value="closed">إغلاق الشكوى دون تواصل (Closed) 📦</option>
                              </select>
                            </div>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateFeedbackComplaint(f.id, {
                                    complaintStatus: sStatus,
                                    complaintFollowUpNote: sNote,
                                    complaintUpdatedBy: user.uid,
                                    complaintUpdatedByName: user.name
                                  });
                                  alert("تم تحديث حالة الشكوى بنجاح!");
                                } catch (err: any) {
                                  alert("فشل تحديث الشكوى: " + err.message);
                                }
                              }}
                              className="w-full bg-red-600 text-white hover:bg-red-500 py-2 rounded-xl font-bold uppercase transition-all text-xs"
                            >
                              Save Followup / حفظ المتابعة
                            </button>
                          </div>
                        </div>

                        {f.complaintUpdatedByName && (
                          <p className="text-[9px] text-slate-500 text-left italic">
                            آخر تحديث بواسطة {f.complaintUpdatedByName}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* User comments suggestions */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black border border-blue-500/20">
                  {feedbacks.filter(f => f.comments).length} تعليقات
                </span>
                <h3 className="font-black text-slate-300 text-sm uppercase font-arabic">💬 الاقتراحات والملاحظات المفتوحة للمتدربين</h3>
              </div>
              
              <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                {feedbacks.filter(f => f.comments).length === 0 ? (
                  <p className="text-slate-500 text-center italic text-xs py-8">لا توجد أي مقترحات أو تعليقات مكتوبة بعد.</p>
                ) : (
                  feedbacks.filter(f => f.comments).map(f => (
                    <div key={f.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 hover:border-blue-500/20 transition-all text-right leading-relaxed text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded border border-slate-800">Lec #{f.sessionNumber}</span>
                        <p className="text-slate-300 font-extrabold">{f.studentName || 'متدرب مجهول الهوية'}</p>
                      </div>
                      <p className="text-slate-400 font-medium italic">"{f.comments}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'students' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50">
            <div>
              <h3 className="font-black text-slate-300 text-sm uppercase">Batch Students</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{students.length} Trainees</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setStudentSortBy('name')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${studentSortBy === 'name' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Sort A-Z
                </button>
                <button 
                  onClick={() => setStudentSortBy('points')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${studentSortBy === 'points' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Sort Points
                </button>
              </div>
              <button 
                onClick={() => setHighlightDuplicates(!highlightDuplicates)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${highlightDuplicates ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
              >
                {highlightDuplicates ? 'Hide Duplicates' : 'Show Duplicates'}
              </button>
              
              <button 
                type="button"
                onClick={handleOpenBulkWelcomeModal}
                disabled={sendingWelcomeEmails}
                className="bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="إرسال أو إعادة إرسال ايميلات الترحيب ودخول البورتال لطلاب الجروب"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'ar' ? `إرسال ايميلات الترحيب (${welcomeEmailStats.sentCount}/${welcomeEmailStats.totalCandidates}) 🚀` : `Send Welcome Emails (${welcomeEmailStats.sentCount}/${welcomeEmailStats.totalCandidates}) 🚀`}</span>
              </button>

              <button 
                type="button"
                onClick={handleOpenTestAccount}
                disabled={loadingTestAccount}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="عرض أو إنشاء حساب تجريبي مخصص للمجموعة لتجربة ودخول البورتال"
              >
                <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                <span>{loadingTestAccount ? 'جاري التحضير...' : (lang === 'ar' ? 'حساب تجريبي للبورتال 🧪' : 'Portal Test Account 🧪')}</span>
              </button>

              {isAdmin && (
                <>
                  <button 
                    onClick={() => setIsBulkStudentsImportOpen(true)} 
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5"
                  >
                    <span>{lang === 'ar' ? 'استيراد طلاب دفعة واحدة 📥' : 'Bulk Import Trainees 📥'}</span>
                  </button>
                  <button onClick={() => { setEditingStudent(null); setStudentFormData({ name: '', phone: '', email: '', whatsapp: '', github: '', linkedin: '', notes: '', tasksLink: '' }); setIsStudentModalOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase">{lang === 'ar' ? 'إضافة طالب ➕' : 'Add Student ➕'}</button>
                </>
              )}
            </div>
          </div>

          {/* Login Status Stats & Filter Bar */}
          <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-arabic">حالة تسجيل دخول البورتال:</span>
              <button
                type="button"
                onClick={() => setStudentLoginFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all font-arabic ${studentLoginFilter === 'all' ? 'bg-primary-600 text-white shadow' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}
              >
                الكل ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setStudentLoginFilter('logged_in')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all font-arabic flex items-center gap-1 ${studentLoginFilter === 'logged_in' ? 'bg-emerald-600 text-white shadow' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>🟢 دخلوا السيستم ({studentLoginStats.loggedIn})</span>
              </button>
              <button
                type="button"
                onClick={() => setStudentLoginFilter('not_logged_in')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all font-arabic flex items-center gap-1 ${studentLoginFilter === 'not_logged_in' ? 'bg-amber-600 text-white shadow' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>🟡 لم يدخلوا بعد ({studentLoginStats.notLoggedIn})</span>
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث باسم الطالب أو ID..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500 font-arabic"
                />
                {studentSearchQuery && (
                  <button onClick={() => setStudentSearchQuery('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">✕</button>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-[10px] font-black text-slate-400 font-arabic" title="نسبة الطلاب الذين سجلوا الدخول للسيستم">
                <span>النسبة:</span>
                <span className="text-emerald-400 font-bold">{studentLoginStats.percent}%</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Points</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processedStudents.map(s => (
                  <tr key={s.id} className={`hover:bg-slate-800/40 transition-colors ${(s.isTestAccount || s.studentIdNum?.startsWith('TEST-')) ? 'bg-amber-500/5 border-l-4 border-l-amber-500' : duplicateIds.has(s.id) ? 'bg-red-500/5 border-l-4 border-l-red-500' : ''} ${s.deactivated ? 'opacity-70 bg-slate-950/20' : ''} ${studentFollowUps.find(f => f.studentId === s.id && f.status === 'active')?.status === 'active' ? 'border-r-4 border-r-primary-500' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold ${s.deactivated ? 'text-red-400 line-through' : (s.isTestAccount || s.studentIdNum?.startsWith('TEST-')) ? 'text-amber-300' : 'text-slate-200'}`}>{s.name}</span>
                          {/* Student Portal Login Acknowledgment Indicator */}
                          {(s.hasLoggedIn || s.lastLoginAt || (s.loginCount && s.loginCount > 0)) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-arabic shadow-sm select-none"
                              title={`تم تسجيل الدخول للنظام بنجاح ✅${s.lastLoginAt ? `\nآخر دخول: ${new Date(s.lastLoginAt).toLocaleString('ar-EG')}` : ''}${s.loginCount ? `\nعدد مرات الدخول: ${s.loginCount}` : ''}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"></span>
                              <span>دخل السيستم بنجاح ✓</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 font-arabic shadow-sm select-none"
                              title="لم يقم الطالب بتسجيل الدخول إلى بورتال الطلاب حتى الآن ⏳"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400"></span>
                              <span>لم يدخل السيستم بعد ⏳</span>
                            </span>
                          )}
                          {(s.isTestAccount || s.studentIdNum?.startsWith('TEST-')) && (
                            <button
                              type="button"
                              onClick={() => setTestAccountModal(s)}
                              className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer font-arabic flex items-center gap-1"
                              title="اضغط لمعاينة بيانات الدخول وتجربة البورتال"
                            >
                              <span>🧪 حساب تجريبي للاختبار (اضغط للتجربة)</span>
                            </button>
                          )}
                          {s.deactivated && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-500/15 text-red-500 border border-red-500/25 animate-pulse">
                              موقوف ⚠️
                            </span>
                          )}
                          {(() => {
                            const activeFU = studentFollowUps.find(f => f.studentId === s.id && f.status === 'active');
                            if (!activeFU || !activeFU.labels) return null;
                            return activeFU.labels.map(l => {
                              if (l === 'system_sug') return null;
                              const lDef = labelDefinitions.find(def => def.name === l || def.id === l);
                              if (lDef && lDef.visibleOnScreen === false) return null;

                              let labelText = l;
                              let bgColor = 'bg-slate-800';
                              let textColor = 'text-slate-400';

                              if (l === 'absence') { labelText = 'Absence'; bgColor = 'bg-red-500/20'; textColor = 'text-red-450'; }
                              else if (l === 'tasks') { labelText = 'Tasks'; bgColor = 'bg-amber-500/20'; textColor = 'text-amber-450'; }
                              else if (l === 'distinguished') { labelText = 'Distinguished'; bgColor = 'bg-emerald-500/20'; textColor = 'text-emerald-450'; }
                              else if (l === 'best_achiever') { labelText = 'Best Achiever'; bgColor = 'bg-primary-500/20'; textColor = 'text-primary-450'; }
                              else if (lDef) {
                                return (
                                  <span key={l} className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest" style={{ backgroundColor: `${lDef.color}20`, color: lDef.color }}>
                                    {lDef.name}
                                  </span>
                                );
                              }

                              return (
                                <span key={l} className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${bgColor} ${textColor}`}>
                                  {labelText}
                                </span>
                              );
                            });
                          })()}
                        </div>
                        {s.deactivated && s.deactivationReason && (
                          <span className="text-[10px] text-red-400 font-bold leading-tight mt-0.5 max-w-[250px] truncate" title={s.deactivationReason}>
                            السبب: {s.deactivationReason}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded text-[9px] font-mono">
                            ID: {s.studentIdNum || 'Generating...'}
                          </span>
                          <span 
                            onClick={() => togglePasswordVisibility(s.id)}
                            className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded text-[9px] font-mono font-bold cursor-pointer hover:bg-slate-800 hover:text-white transition-all select-none flex items-center gap-1"
                            title="انقر لإظهار أو إخفاء كلمة المرور"
                          >
                            Pass: {visiblePasswords[s.id] ? (s.studentPassword || 'Generating...') : '••••••••'} 
                            <span className="text-[9px] opacity-70">{visiblePasswords[s.id] ? '🙈' : '👁️'}</span>
                          </span>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {s.tasksLink ? (
                            <a
                              href={s.tasksLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[9px] font-black transition-all cursor-pointer font-arabic"
                              title="انتقل إلى لينك التاسكات المخصص على تليجرام"
                            >
                              <span>🔗 لينك التاسكات</span>
                            </a>
                          ) : (
                            <button
                              onClick={() => { setEditingStudent(s); setStudentFormData({ name: s.name, phone: s.phone, email: s.email || '', whatsapp: s.whatsapp || '', github: s.github || '', linkedin: s.linkedin || '', notes: s.notes || '', tasksLink: '' }); setIsStudentModalOpen(true); }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-[9px] font-black transition-all cursor-pointer font-arabic"
                              title="اضغط لإضافة لينك توبيك التليجرام الخاص بتسليم تاسكات المتدرب"
                            >
                              <span>➕ لينك التاسكات</span>
                            </button>
                          )}
                        </div>

                        {duplicateIds.has(s.id) && <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter mt-0.5">Potential Duplicate</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-primary-400 font-black text-xs">
                        {s.totalPoints}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        {s.phone}
                        {s.phone && (
                          <a 
                            href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-emerald-500 hover:text-emerald-400 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {s.email ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-200 font-mono text-[11px]">{s.email}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(s.welcomeEmailStatus === 'sent' || s.welcomeEmailSent) && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-arabic"
                                title={`تم إرسال إيميل الترحيب بنجاح${s.welcomeEmailSentAt ? ` في: ${new Date(s.welcomeEmailSentAt).toLocaleString('ar-EG')}` : ''}`}
                              >
                                <span>✓ نجح إرسال إيميل الترحيب</span>
                              </span>
                            )}
                            {s.welcomeEmailStatus === 'failed' && (
                              <button
                                type="button"
                                onClick={() => handleSingleSendWelcomeEmail(s)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-arabic cursor-pointer transition-all"
                                title={`فشل إرسال إيميل الترحيب: ${s.welcomeEmailError || 'خطأ غير معروف'}. اضغط لإعادة المحاولة فوراً.`}
                              >
                                <span>✕ فشل الإرسال (إعادة محاولة ↺)</span>
                              </button>
                            )}
                            {(!s.welcomeEmailStatus || s.welcomeEmailStatus === 'not_sent') && !s.welcomeEmailSent && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-800 text-slate-400 border border-slate-700 font-arabic"
                                title="لم يتم إرسال إيميل الترحيب لهذا الطالب بعد"
                              >
                                <span>⚪ لم يُرسل بعد</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-black font-arabic">⚠️ لا يوجد إيميل</span>
                          {s.phone && (
                            <a 
                              href={`https://wa.me/${s.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `السلام عليكم ورحمة الله وبركاته يا ${s.name} 👋\n\nنرجو من حضرتك تزويدنا بالبريد الإلكتروني (Gmail) الخاص بك الذي ستحضر منه المحاضرات التعليمية لتسجيله وتفعيله في السيستم لكي تتمكن من حضور المحاضرات.\n\n⚠️ ملاحظة: هذه رسالة تلقائية من النظام لاستكمال بياناتك.\n\nشكرًا لتعاونك! 💻🎓`
                              )}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1 text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all animate-pulse inline-flex items-center gap-1"
                              title="طلب الإيميل عبر واتساب"
                            >
                              <MessageSquare size={10} />
                              <span className="text-[9px] font-black font-arabic">اطلب الإيميل</span>
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {s.email && (
                        <button 
                          onClick={() => handleSingleSendWelcomeEmail(s)}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs"
                          title="إرسال / إعادة إرسال بيانات الدخول وايميل الترحيب عبر البريد الإلكتروني"
                        >
                          📧
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedStudentForStatusChange(s)}
                        className={`text-xs ${s.deactivated ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'}`}
                        title={s.deactivated ? "إعادة تنشيط" : "إيقاف وتعطيل"}
                      >
                        {s.deactivated ? '⚡' : '🚫'}
                      </button>
                      <button onClick={() => { setEditingStudent(s); setStudentFormData({ name: s.name, phone: s.phone, email: s.email || '', whatsapp: s.whatsapp || '', github: s.github || '', linkedin: s.linkedin || '', notes: s.notes || '', tasksLink: s.tasksLink || '' }); setIsStudentModalOpen(true); }} className="text-slate-500 hover:text-blue-500">✏️</button>
                      {isAdmin && <button onClick={async () => { if(confirm("Delete Student?")) await deleteStudent(s.id, user); }} className="text-slate-500 hover:text-red-500">🗑️</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-slate-900/50">
            <h3 className="text-xl font-black text-white tracking-tight">🏆 Leaderboard</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  value={rankingSearchQuery}
                  onChange={(e) => setRankingSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-200 outline-none"
                />
              </div>
              <button onClick={handleRecalculateAll} disabled={isRecalculating} className="bg-white text-slate-950 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Force Sync</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Rank</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student</th>
                  <th className="text-center text-[9px] font-black text-slate-600 uppercase">Lec Points</th>
                  <th className="text-center text-[9px] font-black text-indigo-400 uppercase">Project</th>
                  <th className="text-center text-[9px] font-black text-red-500 uppercase">Penalties</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-white uppercase tracking-widest">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rankings
                  .map((r, idx) => ({ r, trueRank: idx, s: students.find(st => st.id === r.studentId) }))
                  .filter(({ s }) => {
                    if (!rankingSearchQuery.trim()) return true;
                    const q = rankingSearchQuery.trim().toLowerCase();
                    return (s?.name || '').toLowerCase().includes(q) || (s?.phone || '').includes(rankingSearchQuery.trim());
                  })
                  .map(({ r, trueRank, s }) => {
                    return (
                      <tr key={r.studentId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-8 py-6 font-black text-xl">{trueRank === 0 ? '🥇' : trueRank === 1 ? '🥈' : trueRank === 2 ? '🥉' : trueRank + 1}</td>
                        <td className="px-8 py-6 font-bold text-slate-200">{s?.name || 'Unknown'}</td>
                        <td className="text-center text-blue-400 font-black">{r.lectureTotal}</td>
                        <td className="text-center text-indigo-400 font-black">{r.projectScore}</td>
                        <td className="text-center text-red-500 font-black">-{r.penaltiesTotal}</td>
                        <td className="px-8 py-6 text-right font-black text-xl text-white">{r.finalScore}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-xl font-black text-white">{editingStudent ? 'Edit' : 'Add'} Student</h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={async (e) => { 
              e.preventDefault(); 
              try { 
                const normalizedPhone = sanitizePhone(studentFormData.phone); 
                const normalizedWhatsapp = studentFormData.whatsapp ? sanitizePhone(studentFormData.whatsapp) : ''; 
                const sanitizedMail = studentFormData.email ? sanitizeEmail(studentFormData.email) : '';
                const cleanName = studentFormData.name ? studentFormData.name.trim() : '';
                const saved = await saveStudent(editingStudent?.id || null, {
                  ...studentFormData,
                  name: cleanName,
                  email: sanitizedMail,
                  phone: normalizedPhone,
                  whatsapp: normalizedWhatsapp,
                  groupId: groupId!
                }, user); 
                setIsStudentModalOpen(false); 
                if (!editingStudent && saved) {
                  setOnboardingStudent(saved);
                }
              } catch(err: any){
                alert(err.message);
              } 
            }} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
              <input type="text" placeholder="Full Name" required value={studentFormData.name} onChange={e => setStudentFormData({ ...studentFormData, name: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="tel" placeholder="Phone" required value={studentFormData.phone} onChange={e => setStudentFormData({ ...studentFormData, phone: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="email" placeholder="Email (Optional)" value={studentFormData.email} onChange={e => setStudentFormData({ ...studentFormData, email: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="tel" placeholder="WhatsApp (Optional)" value={studentFormData.whatsapp} onChange={e => setStudentFormData({ ...studentFormData, whatsapp: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="url" placeholder="GitHub Profile (Optional)" value={studentFormData.github} onChange={e => setStudentFormData({ ...studentFormData, github: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="url" placeholder="LinkedIn Profile (Optional)" value={studentFormData.linkedin} onChange={e => setStudentFormData({ ...studentFormData, linkedin: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" />
              <input type="url" placeholder="Tasks Link / لينك التاسكات (Optional)" value={studentFormData.tasksLink} onChange={e => setStudentFormData({ ...studentFormData, tasksLink: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold text-right" dir="ltr" />
              <textarea placeholder="Notes (Optional)" value={studentFormData.notes} onChange={e => setStudentFormData({ ...studentFormData, notes: e.target.value })} className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold h-24" />
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Save Student</button>
            </form>
          </div>
        </div>
      )}

      {/* Onboarding Reminder Modal */}
      {onboardingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md font-arabic text-right" dir="rtl">
          <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full"></div>
            
            <div className="text-center mb-6">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 text-3xl mb-4 border border-indigo-500/20">
                📢
              </span>
              <h3 className="text-2xl font-black text-white">تم إضافة الطالب الجديد بنجاح!</h3>
              <p className="text-slate-400 text-xs font-bold mt-2">تذكير هام بإرسال بيانات الدخول للطالب الجديد</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3 mb-6">
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">اسم الطالب:</span>
                <span className="text-white font-black">{onboardingStudent.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">اسم المستخدم (ID):</span>
                <span className="text-indigo-400 font-black font-mono select-all bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{onboardingStudent.studentIdNum}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">كلمة المرور:</span>
                <span className="text-indigo-400 font-black font-mono select-all bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{onboardingStudent.studentPassword}</span>
              </div>
            </div>

            <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6">
              يرجى نسخ اسم المستخدم وكلمة المرور الموضحة أعلاه وإرسالها للطالب الجديد حتى يتمكن من الدخول إلى بوابة المتدربين الخاصة به ومتابعة محاضرته ومهامه.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setOnboardingStudent(null)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer"
              >
                إغلاق التنبيه ✖
              </button>
              <button 
                onClick={() => {
                  setOnboardingStudent(null);
                  navigate('/students');
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl text-xs font-black shadow-xl transition-all cursor-pointer text-center"
              >
                الذهاب لصفحة الطلاب 👤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trainer Notes & Task Evaluation Modal */}
      {notesModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-arabic text-right" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div>
                <h3 className="font-black text-white text-base">تقييم وملاحظات المحاضر 📝</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  المتدرب: <span className="text-amber-400 font-black">{notesModalStudent.name}</span> {selectedSession?.sessionNumber ? `(سيشن #${selectedSession.sessionNumber})` : ''}
                </p>
              </div>
              <button 
                onClick={() => setNotesModalStudent(null)} 
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/30">
              <button
                type="button"
                onClick={() => setActiveNotesTab('lecture')}
                className={`flex-1 py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeNotesTab === 'lecture'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📝 ملاحظة المحاضرة</span>
                {studentNotesText && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveNotesTab('task')}
                className={`flex-1 py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeNotesTab === 'task'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📌 تقييم التاسك</span>
                {studentTaskNoteText && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
              </button>
            </div>

            <div className="p-6 space-y-4">
              {activeNotesTab === 'lecture' ? (
                <div>
                  <label className="text-xs font-black text-slate-300 block mb-2">
                    📝 ملاحظة المحاضرة العامة (تظهر أسفل فيديو تسجيل المحاضرة):
                  </label>
                  <textarea
                    value={studentNotesText}
                    onChange={(e) => setStudentNotesText(e.target.value)}
                    placeholder="اكتب ملاحظاتك للمتدرب بخصوص استيعابه أو أداؤه في المحاضرة..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold h-36 outline-none focus:border-indigo-500 transition-all text-xs leading-relaxed"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-black text-amber-300 block mb-2">
                    📌 تقييم وملاحظة التاسك (تظهر بجانب حالة تسليم التاسك بصفحة المتدرب):
                  </label>
                  <textarea
                    value={studentTaskNoteText}
                    onChange={(e) => setStudentTaskNoteText(e.target.value)}
                    placeholder="اكتب التقييم الخاص بالتاسك (مثال: ممتاز تم قبول الواجب / أداء ممتاز جداً 10/10 / يحتاج تعديل جزء...)"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold h-36 outline-none focus:border-amber-500 transition-all text-xs leading-relaxed"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNotesModalStudent(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!selectedSession || !groupId) return;
                      const evalData = evaluations.find(e => e.studentId === notesModalStudent.id && e.sessionNumber === selectedSession?.sessionNumber) || {} as any;
                      const prevLectureNote = evalData.trainerNote || '';
                      const prevTaskNote = evalData.taskNote || '';

                      const updatedEval: any = {
                        ...evalData,
                        trainerNote: studentNotesText,
                        taskNote: studentTaskNoteText,
                        groupId,
                        studentId: notesModalStudent.id,
                        sessionNumber: selectedSession.sessionNumber,
                        sessionId: selectedSession.id,
                        evaluatorId: user.uid,
                        updatedAt: serverTimestamp()
                      };

                      await batchSaveEvaluations([updatedEval]);
                      
                      // Notifications if updated
                      if (studentTaskNoteText.trim() && studentTaskNoteText.trim() !== prevTaskNote) {
                        await sendNotification({
                          userId: notesModalStudent.id,
                          title: `📌 تقييم جديد للتاسك من المدرب`,
                          message: `أضاف المدرب تقييمًا وملاحظةً جديدة لتاسك المحاضرة رقم ${selectedSession?.sessionNumber || ''}: "${studentTaskNoteText.trim()}".`,
                          type: 'task_review',
                          link: `/student-portal?studentId=${notesModalStudent.id}`
                        });
                      } else if (studentNotesText.trim() && studentNotesText.trim() !== prevLectureNote) {
                        await sendNotification({
                          userId: notesModalStudent.id,
                          title: `📝 ملاحظة جديدة من المدرب`,
                          message: `ترك لك المدرب ملاحظة بخصوص المحاضرة رقم ${selectedSession?.sessionNumber || ''}. اضغط للمشاهدة والتفاصيل.`,
                          type: 'task_review',
                          link: `/student-portal?studentId=${notesModalStudent.id}`
                        });
                      }
                      
                      setNotesModalStudent(null);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-2xl text-xs font-black shadow-xl transition-all cursor-pointer"
                >
                  حفظ الملاحظة والتقييم 💾
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudentForWeakness && (
        <StudentWeaknessModal
          isOpen={!!selectedStudentForWeakness}
          onClose={() => setSelectedStudentForWeakness(null)}
          studentId={selectedStudentForWeakness.id}
          studentName={selectedStudentForWeakness.name}
          groupId={groupId!}
          groupName={group?.name}
          sessionNumber={selectedSession?.sessionNumber}
          user={user}
        />
      )}

      <GroupModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} user={user} editingGroup={group} courses={courses} trainers={trainers} onSuccess={() => {}} />

      <BulkStudentsImportModal 
        isOpen={isBulkStudentsImportOpen}
        onClose={() => setIsBulkStudentsImportOpen(false)}
        groupId={groupId!}
        groupName={group?.groupName || group?.batchCode || group?.name || ''}
        currentStudents={students}
        user={user}
        onSuccess={() => {
          setIsBulkStudentsImportOpen(false);
        }}
      />
      {/* Modals for Student Follow-ups */}
      {selectedStudentForComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Add Comment</h2>
              <button 
                onClick={() => setSelectedStudentForComment(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Student</label>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{selectedStudentForComment.name}</div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Comment</label>
                <textarea 
                  value={followUpCommentText}
                  onChange={(e) => setFollowUpCommentText(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500 h-32 resize-none"
                  placeholder="Enter follow-up details..."
                />
              </div>
              <button 
                onClick={async () => {
                  if (!followUpCommentText.trim()) return;
                  try {
                    await saveStudentFollowUpComment(groupId!, selectedStudentForComment.id, followUpCommentText, user);
                    setFollowUpCommentText('');
                    setSelectedStudentForComment(null);
                  } catch (err: any) {
                    alert('Failed to save comment: ' + err.message);
                  }
                }}
                disabled={!followUpCommentText.trim()}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSessionDate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">تعديل تاريخ المحاضرة</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">المحاضرة رقم {editingSessionDate.sessionNumber}</p>
              </div>
              <button 
                onClick={() => setEditingSessionDate(null)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">التاريخ الجديد</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="date"
                    value={newDateValue}
                    onChange={(e) => setNewDateValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">سبب التعديل</label>
                <textarea 
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  placeholder="اكتب سبب تعديل التاريخ هنا..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="bg-blue-900/20 border border-blue-900/30 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-blue-400 leading-relaxed">
                  * سيتم ترحيل جميع المحاضرات القادمة تلقائياً بناءً على أيام المحاضرات المحددة للمجموعة.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEditingSessionDate(null)}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handlePostpone}
                  disabled={isShifting || !newDateValue || !dateChangeReason}
                  className="flex-1 py-4 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                >
                  {isShifting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={16} />
                      حفظ وترحيل
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Request Modal */}
      {isSupervisorModalOpen && followUpStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-slate-900 rounded-3xl w-full max-w-md border border-slate-800 overflow-hidden shadow-2xl text-right">
            <div className={`p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 ${lang === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
              <button onClick={() => { setIsSupervisorModalOpen(false); setFollowUpStudent(null); }} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <h3 className="text-xl font-black text-white">
                  {lang === 'ar' ? 'طلب تحويل للمتابعة المستمرة' : 'Follow-up Request'}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  {lang === 'ar' ? `اسم الطالب: ${followUpStudent.name}` : followUpStudent.name}
                </p>
              </div>
            </div>
            <form onSubmit={handleRequestSupervisorFollowUp} className="p-6 space-y-5 text-right font-arabic">
              <div className="grid grid-cols-2 gap-4">
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">
                    {lang === 'ar' ? 'المسؤول عن المتابعة' : 'Mention (Responsible)'}
                  </label>
                  <select 
                    value={followUpMentionedUser} 
                    onChange={e => setFollowUpMentionedUser(e.target.value)} 
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold"
                  >
                    <option value="">{lang === 'ar' ? 'بلا تحديد' : 'None'}</option>
                    {trainers.map(t => <option key={t.uid} value={t.uid}>{t.name} ({t.role})</option>)}
                  </select>
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">
                    {lang === 'ar' ? 'تاريخ الاستحقاق المتوقع' : 'Deadline'}
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={followUpDeadline} 
                    onChange={e => setFollowUpDeadline(e.target.value)} 
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold" 
                  />
                </div>
              </div>
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">
                  {lang === 'ar' ? 'التصنيفات والوسوم الملونة' : 'Labels'}
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 justify-start">
                  {['absence', 'tasks', 'distinguished', 'best_achiever'].map(l => {
                    let labelText = l;
                    if (lang === 'ar') {
                      if (l === 'absence') labelText = 'غياب متكرر';
                      else if (l === 'tasks') labelText = 'متابعة تاسكات';
                      else if (l === 'distinguished') labelText = 'متميز علمياً';
                      else if (l === 'best_achiever') labelText = 'الأفضل إنجازاً';
                    }
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          const newLabels = followUpLabels.includes(l) 
                            ? followUpLabels.filter(x => x !== l) 
                            : [...followUpLabels, l];
                          setFollowUpLabels(newLabels);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${followUpLabels.includes(l) ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700 hover:text-slate-300'}`}
                      >
                        {labelText}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">
                  {lang === 'ar' ? 'التعليمات وسبب المتابعة وتوقيت التسليم المتفق عليه' : 'Instructions'}
                </label>
                <textarea 
                  required 
                  value={followUpNote} 
                  onChange={e => setFollowUpNote(e.target.value)} 
                  placeholder={lang === 'ar' ? 'اكتب تفاصيل الاعتذار أو العذر، متى سيقدم التاسك، وكيف تود متابعة حالته...' : 'What needs to be followed up? (e.g. Call student, check task progress)'}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white font-bold h-32 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsSupervisorModalOpen(false)}
                  className="flex-1 px-4 py-4 rounded-2xl border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-800"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-600/20"
                >
                  {isSaving 
                    ? (lang === 'ar' ? 'جاري التحويل...' : 'Sending...') 
                    : (lang === 'ar' ? 'إرسال لغرفة المتابعة 🚀' : 'Send Order')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedStudentForHistory && (
        <StudentHistoryModal
          isOpen={!!selectedStudentForHistory}
          onClose={() => setSelectedStudentForHistory(null)}
          student={selectedStudentForHistory}
          groupName={group?.name}
          user={user}
        />
      )}
      {/* Labels Assignment Modal */}
      {selectedStudentForLabel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-md border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
               <div>
                 <h2 className="text-xl font-black text-white uppercase tracking-widest">Assign Labels</h2>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{selectedStudentForLabel.name}</p>
               </div>
               <button onClick={() => setSelectedStudentForLabel(null)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-500 hover:bg-slate-700 transition-colors">✕</button>
            </div>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 gap-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Follow-up Status (read-only)</p>
                {['absence', 'tasks'].map(label => {
                  const isAssigned = studentFollowUps.find(f => f.studentId === selectedStudentForLabel.id && f.groupId === group?.id)?.labels.includes(label);
                  if (!isAssigned) return null;
                  return (
                    <div
                      key={label}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border bg-primary-950/50 border-primary-900 text-primary-400/70"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{label.replace('_', ' ')}</span>
                      <span className="text-sm">✓</span>
                    </div>
                  );
                })}
                <p className="text-[9px] font-bold text-slate-600 ml-2 -mt-1 leading-relaxed">
                  متابعة الغياب والتاسكات بتتحدد بس من خلال اعتماد اقتراح في تاب المتابعة — مش من هنا.
                </p>

                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mt-2">Recognition Labels</p>
                {['distinguished', 'best_achiever'].map(label => {
                  const isAssigned = studentFollowUps.find(f => f.studentId === selectedStudentForLabel.id && f.groupId === group?.id)?.labels.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => toggleStudentLabel(selectedStudentForLabel.id, selectedStudentForLabel.name, label)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isAssigned ? 'bg-primary-950 border-primary-800 text-primary-400' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{label.replace('_', ' ')}</span>
                      <span className="text-sm">{isAssigned ? '✓' : ''}</span>
                    </button>
                  );
                })}

                {labelDefinitions.length > 0 && (
                  <>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mt-4">Custom Labels</p>
                    {labelDefinitions.map(label => {
                      const isAssigned = studentFollowUps.find(f => f.studentId === selectedStudentForLabel.id && f.groupId === group?.id)?.labels.includes(label.name);
                      return (
                        <button 
                          key={label.id}
                          onClick={() => toggleStudentLabel(selectedStudentForLabel.id, selectedStudentForLabel.name, label.name)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isAssigned ? 'border-2' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                          style={isAssigned ? { borderColor: label.color, backgroundColor: `${label.color}15`, color: label.color } : {}}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{label.name}</span>
                          <span className="text-sm">{isAssigned ? '✓' : ''}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
            <div className="p-8 border-t border-slate-800 bg-slate-950/50">
              <button 
                onClick={() => setSelectedStudentForLabel(null)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Postpone Start Modal */}
      {isPostponeStartModalOpen && activeSess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 rounded-[2rem] w-full max-w-md border border-slate-800 overflow-hidden shadow-2xl text-right">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 flex-row">
              <button 
                onClick={() => setIsPostponeStartModalOpen(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-500 hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
              <div className="text-right">
                <h3 className="text-xl font-black text-white font-arabic">⏰ تأجيل موعد بدء المحاضرة</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 font-arabic">ضبط توقيت التأخير والبدء الجديد</p>
              </div>
            </div>
            
            <div className="p-6 space-y-5 text-right font-arabic">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">خيارات التأجيل السريع</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setPostponeStartMinutes(mins);
                        setPostponeStartNewTime(addMinutesToTime(activeSess.sessionTime || getCairoTimeStr(), mins));
                      }}
                      className={`py-2 px-1 rounded-xl text-[11px] font-semibold text-center border transition-all ${postponeStartMinutes === mins ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/10' : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'}`}
                    >
                      {mins} دقيقة
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">عدد دقائق التأجيل المخصصة</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={postponeStartMinutes}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPostponeStartMinutes(val);
                    setPostponeStartNewTime(addMinutesToTime(activeSess.sessionTime || getCairoTimeStr(), val));
                  }}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-4 text-xs font-semibold text-white text-right outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">الوقت الجديد المتوقع للبدء</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 09:30"
                  value={postponeStartNewTime}
                  onChange={(e) => setPostponeStartNewTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-4 text-xs font-semibold text-white text-right outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <span className="block text-[10px] text-slate-500 leading-normal">
                  * سيتم إظهار الوقت الجديد مباشرة على بورتال الطلاب ليتابعوا موعد بدء التشغيل.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsPostponeStartModalOpen(false)}
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-850 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-850 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={async () => {
                    await execSave(activeSess.id, {
                      startPostponeMinutes: postponeStartMinutes,
                      startPostponeNewTime: postponeStartNewTime,
                      generalPostponeActive: false
                    });

                    // Notify students!
                    try {
                      for (const student of students) {
                        await sendNotification({
                          userId: student.id,
                          title: `⏱️ تأجيل موعد بدء المحاضرة`,
                          message: `تم تأجيل موعد بدء المحاضرة رقم ${activeSess.sessionNumber} بمقدار ${postponeStartMinutes} دقيقة. ستبدأ رسمياً الساعة ${postponeStartNewTime}.`,
                          type: 'task_status',
                          link: `/student-portal?studentId=${student.id}`
                        });
                      }
                    } catch (err) {
                      console.error("Failed to notify students of start postpone:", err);
                    }

                    setIsPostponeStartModalOpen(false);
                  }}
                  className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] py-3.5 px-4 rounded-2xl transition-all shadow-xl shadow-amber-600/20 text-center"
                >
                  تأجيل موعد البدء ⏱️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Postpone Entire Lecture Modal */}
      {isPostponeGeneralModalOpen && activeSess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 rounded-[2rem] w-full max-w-md border border-slate-800 overflow-hidden shadow-2xl text-right">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 flex-row">
              <button 
                onClick={() => setIsPostponeGeneralModalOpen(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-500 hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
              <div className="text-right">
                <h3 className="text-xl font-black text-white font-arabic">📅 تأجيل المحاضرة بالكامل</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 font-arabic">تأجيل لليوم القادم وإبلاغ الطلاب عبر البورتال</p>
              </div>
            </div>
            
            <div className="p-6 space-y-5 text-right font-arabic">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-arabic">الموعد الجديد المتفق عليه لعقد المحاضرة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الخميس القادم 25 يونيو الساعة 9:00 م"
                  value={postponeGeneralDate}
                  onChange={(e) => setPostponeGeneralDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-4 text-xs font-semibold text-white text-right outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="block text-[10px] text-slate-500 leading-normal">
                  * سيظهر هذا التنبيه بشكل دائم ومميز طوال فترة المحاضرة على لوحة الطلاب لحمايتهم من تشتت الانتظار.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsPostponeGeneralModalOpen(false)}
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-850 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-850 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={async () => {
                    if (!postponeGeneralDate.trim()) {
                      alert('الرجاء إدخال تفاصيل الموعد الجديد لتنبيه المتدربين!');
                      return;
                    }
                    await execSave(activeSess.id, {
                      generalPostponeActive: true,
                      generalPostponeDate: postponeGeneralDate,
                      startPostponeMinutes: 0
                    });

                    // Notify students!
                    try {
                      for (const student of students) {
                        await sendNotification({
                          userId: student.id,
                          title: `📅 تأجيل المحاضرة بالكامل`,
                          message: `تنبيه هام: تم تأجيل المحاضرة رقم ${activeSess.sessionNumber} بالكامل لموعد آخر: ${postponeGeneralDate}. يرجى التجهيز للموعد الجديد!`,
                          type: 'task_status',
                          link: `/student-portal?studentId=${student.id}`
                        });
                      }
                    } catch (err) {
                      console.error("Failed to notify students of general postpone:", err);
                    }

                    setIsPostponeGeneralModalOpen(false);
                  }}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] py-3.5 px-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 text-center"
                >
                  تأجيل المحاضرة بالكامل 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <StudentStatusModal
        isOpen={!!selectedStudentForStatusChange}
        onClose={() => setSelectedStudentForStatusChange(null)}
        student={selectedStudentForStatusChange}
        user={user}
        onSuccess={() => {
          setSelectedStudentForStatusChange(null);
        }}
      />

      <TrainerBroadcastEmailModal
        isOpen={isTrainerEmailModalOpen}
        onClose={() => setIsTrainerEmailModalOpen(false)}
        group={group}
        students={students}
        user={user}
      />

      {/* Reconnect / Fallback Modal for Trainer Google Account */}
      {reconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-start gap-3 border-b border-slate-800/80 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  تعذر جدولة Google Meet بحساب المدرب
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  حساب Google الخاص بالمدرب غير مرتبط أو انتهت صلاحيته (Token Expired).
                </p>
              </div>
            </div>

            {/* Error detail banner */}
            <div className="bg-amber-950/40 border border-amber-800/50 rounded-2xl p-3.5 text-xs text-amber-300 font-medium leading-relaxed">
              {reconnectErrorDetails?.error || 'تعذر استخدام توكن المدرب لجدولة المواعيد. يرجى اختيار إحدى الخيارات التالية لتنفيذ الجدولة.'}
            </div>

            {/* Step by step guide */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
              <p className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                طريقة إعادة ربط حساب المدرب:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pr-1">
                <li>اضغط على زر <strong className="text-indigo-400">"إعادة ربط حساب المدرب"</strong> أدناه للانتقال لصفحة الربط.</li>
                <li>قم بتسجيل الدخول بحساب Google ومنح كافة الإذونات لـ Calendar و Meet.</li>
                <li>بعد إتمام الربط بنجاح، أعد الضغط على زر <strong className="text-indigo-400">"تشغيل مواعيد Google"</strong>.</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setReconnectModalOpen(false);
                  navigate('/trainer-google-connect');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                1. إعادة ربط حساب Google للمدرب (Reconnect Trainer)
              </button>

              <button
                onClick={() => {
                  setReconnectModalOpen(false);
                  handleSyncGoogleCalendar(false, true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                2. الجدولة باستخدام البريد المركزي (sabergroup.eg@gmail.com)
              </button>

              <button
                onClick={() => setReconnectModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-center cursor-pointer"
              >
                إغلاق (إلغاء)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Workshop Warning Modal */}
      {specialWorkshopModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-lg w-full text-right font-arabic shadow-2xl space-y-5 relative">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl shrink-0 border border-amber-500/30">
                ⚠️
              </div>
              <div>
                <h3 className="font-black text-base text-amber-300">إقرار وتأكيد الورشة الخاصة</h3>
                <p className="text-xs text-slate-400">تأكيد تحضير وموافقة شرح الورشة الخاصة</p>
              </div>
            </div>

            {/* Required Text Notice Box */}
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-3 text-amber-100 text-xs font-bold leading-relaxed shadow-inner">
              <p className="flex items-start gap-2">
                <span className="text-base shrink-0">📌</span>
                <span>تأكد انها ورشة خاصة من تحضيرك الخاص وتم الموافقه على شرحها بالفعل</span>
              </p>
              <p className="flex items-start gap-2 text-rose-300">
                <span className="text-base shrink-0">⛔</span>
                <span>تذكر : متضيفش مُحتوى بدون أخذ الإذن المسبق .. وممنوع شرح شئ من كورس المُستوى المتقدم او اي كورس أخر او مواضيعه دون الرجوع ل م. محمد صابر</span>
              </p>
              <p className="flex items-start gap-2 text-emerald-300">
                <span className="text-base shrink-0">🎯</span>
                <span>التزم بالمحتوى المتفق عليه</span>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSpecialWorkshopModalSession(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sessId = specialWorkshopModalSession.id;
                  setSpecialWorkshopModalSession(null);
                  await execSave(sessId, {
                    isSpecialWorkshop: true,
                    workshopDetails: activeSess?.workshopDetails || ''
                  });
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs shadow-lg shadow-amber-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>أقر وأوافق - تفعيل كورشة خاصة</span>
                <span>✓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Account Modal for Group */}
      {testAccountModal && group && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl shadow-amber-950/40 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">حساب تجربة المنصة للمجموعة</h3>
                  <p className="text-[11px] text-amber-400/90 font-bold">{group.batchCode ? `دفعة ${group.batchCode} - ` : ''}{group.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setTestAccountModal(null)} 
                className="text-slate-400 hover:text-white text-xl p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 space-y-2">
              <p className="text-xs text-slate-300 font-bold leading-relaxed">
                💡 هذا الحساب التجريبي مخصص للمدرب والإدارة لاختبار شاشة وبوابة الطلاب <span className="text-amber-300 font-black">(Student Portal)</span> والتأكد من ظهور المحاضرات، التسجيل، والتقييمات الخاصة بهذا الجروب دون التأثير على بيانات الطلاب الحقيقيين.
              </p>
            </div>

            <div className="space-y-3">
              {/* Login ID */}
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">كود الدخول التجريبي (Login ID)</span>
                  <span className="font-mono text-sm font-black text-amber-300 select-all">{testAccountModal.studentIdNum}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(testAccountModal.studentIdNum || '');
                    setCopiedTestField('id');
                    setTimeout(() => setCopiedTestField(null), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedTestField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTestField === 'id' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              {/* Password */}
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">كلمة المرور (Password)</span>
                  <span className="font-mono text-sm font-black text-amber-300 select-all">{testAccountModal.studentPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(testAccountModal.studentPassword || '');
                    setCopiedTestField('pass');
                    setTimeout(() => setCopiedTestField(null), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedTestField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTestField === 'pass' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            {/* Direct Open Portal Button */}
            <div className="pt-2 space-y-2">
              <a
                href={`/portal?loginId=${encodeURIComponent(testAccountModal.studentIdNum || '')}&password=${encodeURIComponent(testAccountModal.studentPassword || '')}&autoLogin=1&groupId=${group.id}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>دخول وتجربة البورتال مباشرة (1-Click Login) 🚀</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setTestAccountModal(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Welcome Email Dispatch Modal */}
      {isBulkWelcomeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-xl w-full p-6 space-y-5 text-right font-arabic shadow-2xl shadow-emerald-950/40 animate-in fade-in zoom-in-95 relative" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">إرسال إيميلات الترحيب ودخول البورتال 🚀</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Batch {group?.name} • {group?.courseName}</p>
                </div>
              </div>
              {!sendingWelcomeEmails && (
                <button
                  type="button"
                  onClick={() => setIsBulkWelcomeModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* If Dispatch is Finished */}
            {welcomeEmailProgress.isFinished ? (
              <div className="space-y-5 py-2">
                <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-2xl">
                    ✓
                  </div>
                  <h4 className="font-black text-base text-white">اكتملت عملية إرسال إيميلات الترحيب!</h4>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-emerald-400 font-bold block">تم الإرسال بنجاح ✅</span>
                      <span className="text-xl font-black text-emerald-300">{welcomeEmailProgress.sent}</span>
                    </div>
                    <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-rose-400 font-bold block">فشل الإرسال ❌</span>
                      <span className="text-xl font-black text-rose-300">{welcomeEmailProgress.failed}</span>
                    </div>
                  </div>

                  {welcomeEmailProgress.failed > 0 && welcomeEmailProgress.lastError && (
                    <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-300 text-right space-y-1 mt-2">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        سبب الفشل المسجل:
                      </p>
                      <p className="text-[11px] text-rose-200 font-mono leading-relaxed">{welcomeEmailProgress.lastError}</p>
                      <p className="text-[10px] text-slate-400 pt-1">
                        💡 إذا كان الخطأ متعلقاً بانتهاء صلاحية توكن Google، يرجى التوجه لصفحة الربط والضغط على Reconnect.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsBulkWelcomeModalOpen(false)}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  إغلاق وتحديث القائمة
                </button>
              </div>
            ) : sendingWelcomeEmails ? (
              /* While Sending is in Progress */
              <div className="space-y-5 py-4">
                <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span className="font-bold text-xs text-slate-200">{welcomeEmailProgress.statusText || 'جاري المعالجة...'}</span>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-400">
                      {welcomeEmailProgress.sent + welcomeEmailProgress.failed} / {welcomeEmailProgress.total}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                      style={{
                        width: `${welcomeEmailProgress.total > 0 ? Math.min(100, Math.round(((welcomeEmailProgress.sent + welcomeEmailProgress.failed) / welcomeEmailProgress.total) * 100)) : 0}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="text-emerald-400 font-bold">✅ نجح: {welcomeEmailProgress.sent}</span>
                    <span className="text-rose-400 font-bold">❌ فشل: {welcomeEmailProgress.failed}</span>
                    <span>المتبقي: {Math.max(0, welcomeEmailProgress.total - (welcomeEmailProgress.sent + welcomeEmailProgress.failed))}</span>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-500 animate-pulse">
                  يرجى الانتظار وعدم إغلاق الصفحة أثناء إرسال الإيميلات وتحديث بيانات الدخول...
                </p>
              </div>
            ) : (
              /* Scope Selection Form */
              <div className="space-y-5">
                {/* Stats Overview Chips */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 font-bold block">إجمالي المؤهلين 👥</span>
                    <span className="text-sm font-black text-slate-200">{welcomeEmailStats.totalCandidates}</span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-2.5">
                    <span className="text-[10px] text-emerald-400 font-bold block">تم الإرسال مسبقاً ✓</span>
                    <span className="text-sm font-black text-emerald-300">{welcomeEmailStats.sentCount}</span>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-2.5">
                    <span className="text-[10px] text-amber-400 font-bold block">لم يستلموا / فشل ⏳</span>
                    <span className="text-sm font-black text-amber-300">{welcomeEmailStats.pendingAndFailedCount}</span>
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 block mb-1">حدد نطاق الإرسال المطلوب:</span>

                  {/* Option 1: Only Pending and Failed */}
                  <label
                    onClick={() => setBulkWelcomeScope('pending_and_failed')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      bulkWelcomeScope === 'pending_and_failed'
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-md shadow-emerald-950/20'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulkWelcomeScope"
                      checked={bulkWelcomeScope === 'pending_and_failed'}
                      onChange={() => setBulkWelcomeScope('pending_and_failed')}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-100">
                          إرسال للطلاب الجدد أو الذين فشل إرسالهم فقط
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                          {welcomeEmailStats.pendingAndFailedCount} طالب (موصى به)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        يمنع تكرار الإرسال لمن استلم بيانات الدخول مسبقاً، ويرسل فقط لمن لم يستلم بعد أو واجه خطأ سابقاً.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: All Group Members */}
                  <label
                    onClick={() => setBulkWelcomeScope('all')}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      bulkWelcomeScope === 'all'
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-md shadow-emerald-950/20'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulkWelcomeScope"
                      checked={bulkWelcomeScope === 'all'}
                      onChange={() => setBulkWelcomeScope('all')}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-100">
                          إعادة الإرسال لجميع متدربي الجروب بالكامل بلا استثناء
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-300">
                          {welcomeEmailStats.totalCandidates} طالب
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        إعادة إرسال إيميل الترحيب مع بيانات الدخول المحدثة لجميع طلاب الجروب لتذكيرهم.
                      </p>
                    </div>
                  </label>

                  {/* Option 3: Failed Only (if any failed) */}
                  {welcomeEmailStats.failedCount > 0 && (
                    <label
                      onClick={() => setBulkWelcomeScope('failed_only')}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        bulkWelcomeScope === 'failed_only'
                          ? 'bg-rose-950/30 border-rose-500/60 shadow-md shadow-rose-950/20'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bulkWelcomeScope"
                        checked={bulkWelcomeScope === 'failed_only'}
                        onChange={() => setBulkWelcomeScope('failed_only')}
                        className="mt-1 accent-rose-500"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-100">
                            إعادة المحاولة لمن فشل إرسالهم فقط
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300">
                            {welcomeEmailStats.failedCount} طالب
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          إعادة إرسال مخصصة للطلاب الذين ظهرت معهم أخطاء أثناء الإرسال الماضي.
                        </p>
                      </div>
                    </label>
                  )}
                </div>

                {/* Include Deactivated Toggle */}
                <div className="bg-slate-950/50 rounded-2xl p-3.5 border border-slate-800/80 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeDeactivatedWelcome}
                      onChange={(e) => setIncludeDeactivatedWelcome(e.target.checked)}
                      className="rounded text-emerald-500 accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>شمل المتدربين الموقوفين / المعطلين (Deactivated) لإرسال بياناتهم ✉️</span>
                  </label>
                  <p className="text-[10px] text-slate-400 pr-6 leading-relaxed">
                    💡 الطالب الموقوف سيتسلم الـ ID وكلمة المرور في بريده، ولكن نظام البورتال سيمنعه تلقائياً من تسجيل الدخول طالما أن حسابه معطل.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkWelcomeModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={executeBulkSendWelcomeEmails}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      بدء الإرسال الآن (
                      {bulkWelcomeScope === 'pending_and_failed'
                        ? welcomeEmailStats.pendingAndFailedCount
                        : bulkWelcomeScope === 'failed_only'
                        ? welcomeEmailStats.failedCount
                        : welcomeEmailStats.totalCandidates}
                      ) 🚀
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GroupDetails;
