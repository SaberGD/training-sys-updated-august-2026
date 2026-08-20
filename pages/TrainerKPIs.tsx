import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { User, Session, Group, Course, LectureFeedback, GlobalEvalForm } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Award, Clock, FileCheck, CheckCircle, Calendar, Filter, Download, ArrowLeft, ChevronRight, UserCheck, Star, MessageSquare, Search, User as UserIcon, Building, Briefcase, DollarSign, Copy, Printer, Check, Plus, ToggleLeft, ToggleRight, Trash2, Globe, LayoutGrid, CheckSquare, Layers, Eye, Users, AlertCircle, ExternalLink, X, Loader2, Save } from 'lucide-react';
import { formatTime12h, formatTime12hArabic, parseTimeToMinutes, timeTo12hParts, partsTo24hString, partsTo12hString } from '../utils';


const parseTimeStr = (str: string | undefined | null): number | null => {
  return parseTimeToMinutes(str);
};

const calculateSessionMetrics = (session: any, group: any, course: any) => {
  const maxApproved = course?.maxApprovedHours || 3;

  // 1. Calculate Actual Duration in Minutes
  let actualMins = 0;
  if (session.startTimeActual && session.endTimeActual) {
    const sMin = parseTimeStr(session.startTimeActual);
    const eMin = parseTimeStr(session.endTimeActual);
    if (sMin !== null && eMin !== null) {
      let diff = eMin - sMin;
      if (diff < 0) diff += 1440; // Overnight
      actualMins = diff;
    }
  }

  // Fallbacks if startTimeActual / endTimeActual are not set
  if (actualMins === 0) {
    if (session.durationActual && session.durationActual > 0) {
      actualMins = session.durationActual;
    } else if (session.actualHours && session.actualHours > 0) {
      actualMins = Math.round(session.actualHours * 60);
    } else if (session.startTime && session.endTime) {
      const sMin = parseTimeStr(session.startTime);
      const eMin = parseTimeStr(session.endTime);
      if (sMin !== null && eMin !== null) {
        let diff = eMin - sMin;
        if (diff < 0) diff += 1440;
        actualMins = diff;
      }
    }
  }

  const sessionActualHours = parseFloat((actualMins / 60).toFixed(2));

  // 2. Approved Hours: Take session.approvedHours or sessionActualHours, but STRICTLY cap at maxApproved
  let rawApproved = (session.approvedHours !== undefined && session.approvedHours !== null && session.approvedHours > 0)
    ? session.approvedHours
    : sessionActualHours;

  const sessionApprovedHours = Math.min(rawApproved, maxApproved);

  const isOvertime = sessionActualHours > maxApproved || (session.approvedHours && session.approvedHours > maxApproved);

  return {
    actualMins,
    sessionActualHours,
    sessionApprovedHours,
    maxApproved,
    isOvertime
  };
};

interface TrainerKPIsProps {
  user: User;
}

const TrainerKPIs: React.FC<TrainerKPIsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpis' | 'evaluations'>('kpis');
  
  const [trainers, setTrainers] = useState<User[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [hourlyRate, setHourlyRate] = useState<number>(150);
  const [workshopHourlyRate, setWorkshopHourlyRate] = useState<number>(200);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  useEffect(() => {
    if (selectedTrainerId) {
      const savedRate = localStorage.getItem(`trainer_rate_${selectedTrainerId}`);
      if (savedRate) {
        setHourlyRate(parseFloat(savedRate) || 150);
      } else {
        setHourlyRate(150);
      }

      const savedWorkshopRate = localStorage.getItem(`trainer_workshop_rate_${selectedTrainerId}`);
      if (savedWorkshopRate) {
        setWorkshopHourlyRate(parseFloat(savedWorkshopRate) || 200);
      } else {
        setWorkshopHourlyRate(200);
      }
    }
  }, [selectedTrainerId]);

  const handleHourlyRateChange = (val: number) => {
    setHourlyRate(val);
    if (selectedTrainerId) {
      localStorage.setItem(`trainer_rate_${selectedTrainerId}`, val.toString());
    }
  };

  const handleWorkshopHourlyRateChange = (val: number) => {
    setWorkshopHourlyRate(val);
    if (selectedTrainerId) {
      localStorage.setItem(`trainer_workshop_rate_${selectedTrainerId}`, val.toString());
    }
  };
  
  // Data State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<LectureFeedback[]>([]);
  
  // Evaluation Filter State
  const [evalSearchTerm, setEvalSearchTerm] = useState('');
  const [evalSalesFilter, setEvalSalesFilter] = useState('all');

  // Global Evaluation Forms State & View Options
  const [globalEvalForms, setGlobalEvalForms] = useState<GlobalEvalForm[]>([]);
  const [evaluationViewMode, setEvaluationViewMode] = useState<'individual' | 'collective'>('individual');
  const [selectedGlobalFormFilter, setSelectedGlobalFormFilter] = useState<string>('all');

  // Create Global Form Modal State
  const [showCreateFormModal, setShowCreateFormModal] = useState<boolean>(false);
  const [newFormTitle, setNewFormTitle] = useState<string>('');
  const [newFormDesc, setNewFormDesc] = useState<string>('');
  const [newFormMonth, setNewFormMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [newFormTargetOption, setNewFormTargetOption] = useState<string>('all');
  const [newFormIsActive, setNewFormIsActive] = useState<boolean>(true);
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [linkCopiedFormId, setLinkCopiedFormId] = useState<string | null>(null);

  // Form Preview Modal State
  const [previewFormModal, setPreviewFormModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    month: string;
    targetGroupName: string;
    isActive?: boolean;
    fromCreationModal?: boolean;
  } | null>(null);

  // Supervisor Audit Modal & Filter State
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'checked' | 'under_review' | 'issue_flagged' | 'unreviewed'>('all');
  const [auditModalSession, setAuditModalSession] = useState<Session | null>(null);
  const [auditStatusState, setAuditStatusState] = useState<'checked' | 'under_review' | 'issue_flagged' | 'unreviewed'>('checked');
  const [auditCommentState, setAuditCommentState] = useState<string>('');
  const [auditSaving, setAuditSaving] = useState<boolean>(false);

  const openAuditModal = (session: Session) => {
    setAuditModalSession(session);
    setAuditStatusState(session.auditStatus || 'checked');
    setAuditCommentState(session.auditComment || '');
  };

  const handleSaveAudit = async () => {
    if (!auditModalSession) return;
    if ((auditStatusState === 'under_review' || auditStatusState === 'issue_flagged') && !auditCommentState.trim()) {
      alert('يرجى كتابة سبب التعطيل أو تفاصيل المشكلة في خانة الملاحظات.');
      return;
    }

    setAuditSaving(true);
    try {
      const nowFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }) + 
        ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      const newEntry = {
        status: auditStatusState,
        comment: auditCommentState.trim(),
        checkedByUid: user.uid,
        checkedByName: user.name || user.email || 'سوبرفايزر',
        checkedAt: nowFormatted
      };

      const existingHistory = auditModalSession.auditHistory || [];

      const updateData: Partial<Session> = {
        auditStatus: auditStatusState,
        auditComment: auditCommentState.trim(),
        auditCheckedByUid: user.uid,
        auditCheckedByName: user.name || user.email || 'سوبرفايزر',
        auditCheckedAt: nowFormatted,
        auditHistory: [newEntry, ...existingHistory]
      };

      await updateDoc(doc(db, 'sessions', auditModalSession.id), updateData);

      setSessions(prev => prev.map(s => s.id === auditModalSession.id ? { ...s, ...updateData } : s));
      setAuditModalSession(null);
    } catch (err) {
      console.error("Error saving session audit:", err);
      alert('حدث خطأ أثناء حفظ مراجعة المحاضرة.');
    } finally {
      setAuditSaving(false);
    }
  };

  // Supervisor Time Override Modal State (Only Supervisor / Admin / Manager / Team Leader)
  const canEditSessionTime = user.role !== 'trainer';
  const [editTimeModalSession, setEditTimeModalSession] = useState<Session | null>(null);
  const [editStartHour, setEditStartHour] = useState<string>('06');
  const [editStartMin, setEditStartMin] = useState<string>('00');
  const [editStartPeriod, setEditStartPeriod] = useState<'AM' | 'PM'>('PM');

  const [editEndHour, setEditEndHour] = useState<string>('08');
  const [editEndMin, setEditEndMin] = useState<string>('30');
  const [editEndPeriod, setEditEndPeriod] = useState<'AM' | 'PM'>('PM');

  const [editTimeReasonState, setEditTimeReasonState] = useState<string>('');
  const [editTimeSaving, setEditTimeSaving] = useState<boolean>(false);

  const openEditTimeModal = (session: Session) => {
    setEditTimeModalSession(session);
    const startParts = timeTo12hParts(session.startTimeActual, 1080); // default 06:00 PM
    const endParts = timeTo12hParts(session.endTimeActual, 1200);   // default 08:00 PM

    setEditStartHour(startParts.hour);
    setEditStartMin(startParts.minute);
    setEditStartPeriod(startParts.period);

    setEditEndHour(endParts.hour);
    setEditEndMin(endParts.minute);
    setEditEndPeriod(endParts.period);

    setEditTimeReasonState(session.timeModifiedReason || '');
  };

  const handleSaveTimeOverride = async () => {
    if (!editTimeModalSession) return;
    if (!editTimeReasonState.trim()) {
      alert('يرجى كتابة سبب تعديل الوقت لضمان الشفافية والتوثيق بالسجل.');
      return;
    }

    setEditTimeSaving(true);
    try {
      const startTime24 = partsTo24hString(editStartHour, editStartMin, editStartPeriod);
      const endTime24 = partsTo24hString(editEndHour, editEndMin, editEndPeriod);

      const sMin = parseTimeToMinutes(startTime24);
      const eMin = parseTimeToMinutes(endTime24);
      let durationMins = 0;
      if (sMin !== null && eMin !== null) {
        let diff = eMin - sMin;
        if (diff < 0) diff += 1440;
        durationMins = diff;
      }

      const grp = groups.find(g => g.id === editTimeModalSession.groupId);
      const crs = grp ? courses.find(c => c.id === grp.courseId) : null;
      const maxApproved = crs?.maxApprovedHours || 3;
      const actualHoursNum = parseFloat((durationMins / 60).toFixed(2));
      const approvedHoursNum = Math.min(actualHoursNum, maxApproved);

      const nowFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }) + 
        ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      const updateData: Partial<Session> = {
        startTimeActual: startTime24,
        endTimeActual: endTime24,
        durationActual: durationMins,
        actualHours: actualHoursNum,
        approvedHours: approvedHoursNum,
        timeModifiedByUid: user.uid,
        timeModifiedByName: user.name || user.email || 'سوبرفايزر',
        timeModifiedAt: nowFormatted,
        timeModifiedReason: editTimeReasonState.trim(),
        originalStartTimeActual: editTimeModalSession.originalStartTimeActual || editTimeModalSession.startTimeActual || '',
        originalEndTimeActual: editTimeModalSession.originalEndTimeActual || editTimeModalSession.endTimeActual || ''
      };

      await updateDoc(doc(db, 'sessions', editTimeModalSession.id), updateData);

      setSessions(prev => prev.map(s => s.id === editTimeModalSession.id ? { ...s, ...updateData } : s));
      setEditTimeModalSession(null);
    } catch (err) {
      console.error("Error updating session time override:", err);
      alert('حدث خطأ أثناء حفظ تعديل توقيت المحاضرة.');
    } finally {
      setEditTimeSaving(false);
    }
  };

  const previewTimeMetrics = useMemo(() => {
    if (!editTimeModalSession) return null;
    const startTime24 = partsTo24hString(editStartHour, editStartMin, editStartPeriod);
    const endTime24 = partsTo24hString(editEndHour, editEndMin, editEndPeriod);

    const sMin = parseTimeToMinutes(startTime24);
    const eMin = parseTimeToMinutes(endTime24);
    let durationMins = 0;
    if (sMin !== null && eMin !== null) {
      let diff = eMin - sMin;
      if (diff < 0) diff += 1440;
      durationMins = diff;
    }
    const actualHours = parseFloat((durationMins / 60).toFixed(2));
    const grp = groups.find(g => g.id === editTimeModalSession.groupId);
    const crs = grp ? courses.find(c => c.id === grp.courseId) : null;
    const maxApproved = crs?.maxApprovedHours || 3;
    const approvedHours = Math.min(actualHours, maxApproved);

    return { 
      startTime24,
      endTime24,
      startTimeArabic: formatTime12hArabic(startTime24),
      endTimeArabic: formatTime12hArabic(endTime24),
      durationMins, 
      actualHours, 
      approvedHours, 
      maxApproved 
    };
  }, [editTimeModalSession, editStartHour, editStartMin, editStartPeriod, editEndHour, editEndMin, editEndPeriod, groups, courses]);

  const auditCounts = useMemo(() => {
    let checked = 0;
    let underReview = 0;
    let issueFlagged = 0;
    let unreviewed = 0;

    filteredSessions.forEach(s => {
      const st = s.auditStatus || 'unreviewed';
      if (st === 'checked') checked++;
      else if (st === 'under_review') underReview++;
      else if (st === 'issue_flagged') issueFlagged++;
      else unreviewed++;
    });

    return { checked, underReview, issueFlagged, unreviewed, total: filteredSessions.length };
  }, [filteredSessions]);

  const displayedSessions = useMemo(() => {
    if (auditStatusFilter === 'all') return filteredSessions;
    return filteredSessions.filter(session => {
      const st = session.auditStatus || 'unreviewed';
      if (auditStatusFilter === 'unreviewed') {
        return !session.auditStatus || session.auditStatus === 'unreviewed';
      }
      return st === auditStatusFilter;
    });
  }, [filteredSessions, auditStatusFilter]);

  const handleCreateGlobalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormTitle.trim()) {
      alert("يرجى إدخال عنوان استمارة التقييم.");
      return;
    }
    setFormSaving(true);
    try {
      let targetGroupNames: string[] = [];
      if (newFormTargetOption === 'all') {
        targetGroupNames = ['جميع الجروبات النشطة'];
      } else {
        const found = groups.find(g => g.id === newFormTargetOption);
        if (found) targetGroupNames = [found.name];
      }

      const targetGroupsVal: string[] | 'all' = newFormTargetOption === 'all' ? 'all' : [newFormTargetOption];

      const formPayload = {
        title: newFormTitle.trim(),
        description: newFormDesc.trim(),
        month: newFormMonth,
        targetGroups: targetGroupsVal,
        targetGroupNames,
        isActive: newFormIsActive,
        formType: 'monthly' as const,
        createdBy: user.name || user.email || 'إدارة النظام',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'global_eval_forms'), formPayload);
      const createdObj: GlobalEvalForm = {
        id: docRef.id,
        title: formPayload.title,
        description: formPayload.description,
        month: formPayload.month,
        targetGroups: targetGroupsVal,
        targetGroupNames,
        isActive: formPayload.isActive,
        formType: formPayload.formType,
        createdBy: formPayload.createdBy,
        createdAt: new Date()
      };

      setGlobalEvalForms(prev => [createdObj, ...prev]);
      setShowCreateFormModal(false);
      setNewFormTitle('');
      setNewFormDesc('');
      alert("تمت إتاحة استمارة التقييم الشاملة لجميع الجروبات المستهدفة بنجاح! 🎉");
    } catch (err: any) {
      console.error("Error creating global form:", err);
      alert("حدث خطأ أثناء حفظ الاستمارة: " + err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleFormStatus = async (formId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'global_eval_forms', formId), {
        isActive: !currentStatus
      });
      setGlobalEvalForms(prev => prev.map(f => f.id === formId ? { ...f, isActive: !currentStatus } : f));
    } catch (err: any) {
      console.error("Error toggling form status:", err);
      alert("حدث خطأ في تغيير حالة الاستمارة: " + err.message);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm("هل أنت تأكد من حذف استمارة التقييم هذه؟")) return;
    try {
      await deleteDoc(doc(db, 'global_eval_forms', formId));
      setGlobalEvalForms(prev => prev.filter(f => f.id !== formId));
    } catch (err: any) {
      console.error("Error deleting form:", err);
      alert("حدث خطأ أثناء الحذف: " + err.message);
    }
  };

  const getFormLink = (formId: string) => {
    const origin = window.location.origin;
    return `${origin}/#/student/portal?feedback=true&globalEvalId=${formId}`;
  };

  const copyFormLink = (formId: string) => {
    const link = getFormLink(formId);
    navigator.clipboard.writeText(link);
    setLinkCopiedFormId(formId);
    setTimeout(() => setLinkCopiedFormId(null), 3000);
  };

  const openFormLink = (formId: string) => {
    const link = getFormLink(formId);
    window.open(link, '_blank');
  };

  // KPI Calculations
  const [kpis, setKpis] = useState({
    totalSessions: 0,
    totalActualHours: 0,
    totalApprovedHours: 0,
    overtimeCount: 0,
    averagePunctuality: 100, // percentage of sessions with no late start or exact logs
    totalBreaksCount: 0,
    totalBreaksDuration: 0,
    totalPracticesCount: 0,
    checklistCompletionRate: 0,
    substituteSessionsCount: 0
  });

  const isStaff = ['admin', 'coordinator'].includes(user.role);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch Trainers if staff, else lock to current user
        if (isStaff) {
          const trainersSnap = await getDocs(collection(db, 'users'));
          const uList = trainersSnap.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as User))
            .filter(u => ['trainer', 'team_leader', 'coordinator', 'admin'].includes(u.role) && !u.disabled);
          setTrainers(uList);
          if (uList.length > 0) {
            const firstUid = uList.find(t => t.uid === user.uid)?.uid || uList[0].uid;
            setSelectedTrainerId(firstUid);
          } else {
            setSelectedTrainerId('');
          }
        } else {
          setSelectedTrainerId(user.uid);
        }

        // Fetch Groups
        const groupsSnap = await getDocs(collection(db, 'groups'));
        const gList = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setGroups(gList);

        // Fetch Courses
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const cList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        setCourses(cList);

        // Fetch All Sessions (Filter done statuses only)
        const sessionsSnap = await getDocs(collection(db, 'sessions'));
        const sList = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(sList);

        // Fetch All Feedback Evaluations
        const feedbackSnap = await getDocs(collection(db, 'feedback'));
        const fList = feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LectureFeedback));
        setAllFeedbacks(fList);

        // Fetch Global Eval Forms
        try {
          const globalFormsSnap = await getDocs(collection(db, 'global_eval_forms'));
          const formsList = globalFormsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalEvalForm));
          formsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setGlobalEvalForms(formsList);
        } catch (fErr) {
          console.error("Error loading global_eval_forms:", fErr);
        }

        // Set default date range to last 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setDateFrom(start.toISOString().split('T')[0]);
        setDateTo(end.toISOString().split('T')[0]);

      } catch (err) {
        console.error("Error loading Trainer KPIs data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid, user.role]);

  // Recalculate KPIs when trainer, group, dates, or database changes
  useEffect(() => {
    if (!selectedTrainerId) {
      setFilteredSessions([]);
      return;
    }

    // Filter Done Sessions taught by selected trainer
    let result = sessions.filter(session => {
      const matchTrainer = session.actualTrainerId === selectedTrainerId;
      if (!matchTrainer) return false;

      const groupOfSession = groups.find(g => g.id === session.groupId);
      if (!groupOfSession) return false;

      // Group Filter
      if (selectedGroupId !== 'all' && session.groupId !== selectedGroupId) {
        return false;
      }

      // Date Filters
      if (dateFrom && session.date < dateFrom) return false;
      if (dateTo && session.date > dateTo) return false;

      return true;
    });

    // Sort by date descending
    result.sort((a, b) => b.date.localeCompare(a.date));
    setFilteredSessions(result);

    // Calculate details
    let totalSessions = result.length;
    let totalActualMinutes = 0;
    let totalApprovedHours = 0;
    let overtimeCount = 0;
    let totalBreaksCount = 0;
    let totalBreaksDuration = 0;
    let totalPracticesCount = 0;
    let substituteSessionsCount = 0;
    let punctualCount = 0;

    result.forEach(session => {
      const group = groups.find(g => g.id === session.groupId);
      const course = group ? courses.find(c => c.id === group.courseId) : null;
      const isSub = group ? (group.trainerIds && group.trainerIds[0] !== selectedTrainerId) : false;
      if (isSub) substituteSessionsCount++;

      const { actualMins, sessionApprovedHours, isOvertime } = calculateSessionMetrics(session, group, course);

      totalActualMinutes += actualMins;
      totalApprovedHours += sessionApprovedHours;

      if (isOvertime) {
        overtimeCount++;
      }

      // Breaks & Practices
      if (session.breaks) {
        totalBreaksCount += session.breaks.length;
        totalBreaksDuration += session.breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      }
      if (session.practices) {
        totalPracticesCount += session.practices.length;
      }

      punctualCount++;
    });

    const averagePunctuality = totalSessions > 0 ? Math.round((punctualCount / totalSessions) * 100) : 100;
    const totalActualHours = Math.round((totalActualMinutes / 60) * 10) / 10;

    setKpis({
      totalSessions,
      totalActualHours,
      totalApprovedHours: Math.round(totalApprovedHours * 10) / 10,
      overtimeCount,
      averagePunctuality,
      totalBreaksCount,
      totalBreaksDuration,
      totalPracticesCount,
      checklistCompletionRate: 0, // calculated from group execution plans loaded on demand
      substituteSessionsCount
    });

  }, [selectedTrainerId, selectedGroupId, dateFrom, dateTo, sessions, groups, courses]);


  // Payroll and Detailed Hours Summary Calculation
  const payrollSummary = useMemo(() => {
    if (!selectedTrainerId) return null;

    const currentTrainer = trainers.find(t => t.uid === selectedTrainerId);

    // 1. Groups where selectedTrainerId is the primary trainer
    const primaryGroups = groups.filter(g => {
      const isPrimary = g.primaryTrainerId === selectedTrainerId || (!g.primaryTrainerId && g.trainerIds && g.trainerIds[0] === selectedTrainerId);
      if (selectedGroupId !== 'all' && g.id !== selectedGroupId) return false;
      return isPrimary;
    });

    const primaryGroupIds = new Set(primaryGroups.map(g => g.id));

    // 2. All sessions belonging to primary groups in date range
    const assignedSessions = sessions.filter(s => {
      if (!primaryGroupIds.has(s.groupId)) return false;
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });

    let totalAllocatedHours = 0;
    assignedSessions.forEach(s => {
      const grp = groups.find(g => g.id === s.groupId);
      const crs = grp ? courses.find(c => c.id === grp.courseId) : null;
      const maxApproved = crs?.maxApprovedHours || 3;
      totalAllocatedHours += maxApproved;
    });

    // 3. Execution of assigned sessions (own taught vs transferred out)
    let ownRegularHours = 0;
    let ownWorkshopHours = 0;
    let ownTaughtSessionsCount = 0;
    let ownTaughtWorkshopCount = 0;

    let transferredOutHours = 0;
    const transferredOutSessions: Array<{
      session: Session;
      groupName: string;
      actualTrainerName: string;
      approvedHours: number;
      maxApproved: number;
      isSpecialWorkshop?: boolean;
    }> = [];

    assignedSessions.forEach(s => {
      const grp = groups.find(g => g.id === s.groupId);
      const crs = grp ? courses.find(c => c.id === grp.courseId) : null;
      if (s.status === 'done') {
        const { sessionApprovedHours, maxApproved } = calculateSessionMetrics(s, grp, crs);
        const isSelf = (!s.actualTrainerId || s.actualTrainerId === selectedTrainerId);

        if (isSelf) {
          if (s.isSpecialWorkshop) {
            ownWorkshopHours += sessionApprovedHours;
            ownTaughtWorkshopCount++;
          } else {
            ownRegularHours += sessionApprovedHours;
          }
          ownTaughtSessionsCount++;
        } else {
          const otherTrainer = trainers.find(t => t.uid === s.actualTrainerId);
          const actualName = s.actualTrainerName || otherTrainer?.name || 'مدرب آخر';
          transferredOutHours += sessionApprovedHours;
          transferredOutSessions.push({
            session: s,
            groupName: grp?.name || 'مجموعة',
            actualTrainerName: actualName,
            approvedHours: sessionApprovedHours,
            maxApproved,
            isSpecialWorkshop: !!s.isSpecialWorkshop
          });
        }
      }
    });

    // 4. Substitute Sessions EARNED from other primary trainers
    const substituteEarnedSessions: Array<{
      session: Session;
      groupName: string;
      primaryTrainerName: string;
      approvedHours: number;
      maxApproved: number;
      isSpecialWorkshop?: boolean;
    }> = [];

    let substituteRegularHours = 0;
    let substituteWorkshopHours = 0;

    sessions.forEach(s => {
      if (s.status !== 'done') return;
      if (s.actualTrainerId !== selectedTrainerId) return;

      if (dateFrom && s.date < dateFrom) return;
      if (dateTo && s.date > dateTo) return;
      if (selectedGroupId !== 'all' && s.groupId !== selectedGroupId) return;

      const grp = groups.find(g => g.id === s.groupId);
      if (!grp) return;

      const isPrimary = grp.primaryTrainerId === selectedTrainerId || (!grp.primaryTrainerId && grp.trainerIds && grp.trainerIds[0] === selectedTrainerId);
      if (!isPrimary) {
        const primaryUid = grp.primaryTrainerId || (grp.trainerIds && grp.trainerIds[0]);
        const primaryTrainerObj = trainers.find(t => t.uid === primaryUid);
        const primaryName = primaryTrainerObj?.name || 'المدرب الأصلي';
        const crs = courses.find(c => c.id === grp.courseId);
        const { sessionApprovedHours, maxApproved } = calculateSessionMetrics(s, grp, crs);

        if (s.isSpecialWorkshop) {
          substituteWorkshopHours += sessionApprovedHours;
        } else {
          substituteRegularHours += sessionApprovedHours;
        }

        substituteEarnedSessions.push({
          session: s,
          groupName: grp.name || 'مجموعة',
          primaryTrainerName: primaryName,
          approvedHours: sessionApprovedHours,
          maxApproved,
          isSpecialWorkshop: !!s.isSpecialWorkshop
        });
      }
    });

    const netRegularHours = parseFloat((ownRegularHours + substituteRegularHours).toFixed(2));
    const netWorkshopHours = parseFloat((ownWorkshopHours + substituteWorkshopHours).toFixed(2));
    const netPayableHours = parseFloat((netRegularHours + netWorkshopHours).toFixed(2));

    const regularPay = parseFloat((netRegularHours * hourlyRate).toFixed(2));
    const workshopPay = parseFloat((netWorkshopHours * workshopHourlyRate).toFixed(2));
    const netSalary = parseFloat((regularPay + workshopPay).toFixed(2));

    return {
      trainerName: currentTrainer?.name || 'المدرب',
      totalAllocatedHours: parseFloat(totalAllocatedHours.toFixed(2)),
      totalAssignedSessionsCount: assignedSessions.length,
      ownTaughtHoursOnPrimary: parseFloat((ownRegularHours + ownWorkshopHours).toFixed(2)),
      ownRegularHours: parseFloat(ownRegularHours.toFixed(2)),
      ownWorkshopHours: parseFloat(ownWorkshopHours.toFixed(2)),
      ownTaughtSessionsCount,
      ownTaughtWorkshopCount,
      transferredOutHours: parseFloat(transferredOutHours.toFixed(2)),
      transferredOutSessions,
      substituteEarnedHours: parseFloat((substituteRegularHours + substituteWorkshopHours).toFixed(2)),
      substituteRegularHours: parseFloat(substituteRegularHours.toFixed(2)),
      substituteWorkshopHours: parseFloat(substituteWorkshopHours.toFixed(2)),
      substituteEarnedSessions,
      netRegularHours,
      netWorkshopHours,
      netPayableHours,
      regularPay,
      workshopPay,
      netSalary
    };
  }, [selectedTrainerId, dateFrom, dateTo, selectedGroupId, sessions, groups, courses, trainers, hourlyRate, workshopHourlyRate]);

  const copyPayrollSummaryText = () => {
    if (!payrollSummary) return;
    let text = `📋 *كشف حساب الراتب وساعات العمل - ${payrollSummary.trainerName}*
`;
    text += `📅 *الفترة:* ${dateFrom || 'الكل'} إلى ${dateTo || 'الكل'}
`;
    text += `-----------------------------------
`;
    text += `🎯 *إجمالي الساعات الموكلة (Assigned):* ${payrollSummary.totalAllocatedHours} ساعة (${payrollSummary.totalAssignedSessionsCount} محاضرة)
`;
    text += `✅ *ساعات المحاضرات العادية:* ${payrollSummary.netRegularHours} ساعة (${hourlyRate} ج.م/س = ${payrollSummary.regularPay.toLocaleString('ar-EG')} ج.م)
`;
    text += `🛠️ *ساعات الورش الخاصة:* ${payrollSummary.netWorkshopHours} ساعة (${workshopHourlyRate} ج.م/س = ${payrollSummary.workshopPay.toLocaleString('ar-EG')} ج.م)
`;
    text += `🔄 *ساعات موجهة/محولة لمدربين آخرين:* ${payrollSummary.transferredOutHours} ساعة (${payrollSummary.transferredOutSessions.length} محاضرة)
`;
    text += `🌟 *ساعات بديل مكتسبة عند مدربين آخرين:* ${payrollSummary.substituteEarnedHours} ساعة (${payrollSummary.substituteEarnedSessions.length} محاضرة)
`;
    text += `-----------------------------------
`;
    text += `📊 *إجمالي الساعات المستحقة للراتب:* ${payrollSummary.netPayableHours} ساعة
`;
    text += `💰 *إجمالي المُرتب المستحق:* ${payrollSummary.netSalary.toLocaleString('ar-EG')} ج.م
`;
    text += `-----------------------------------
`;

    if (payrollSummary.substituteEarnedSessions.length > 0) {
      text += `
🌟 *تفاصيل ساعات البديل المكتسبة:*
`;
      payrollSummary.substituteEarnedSessions.forEach(item => {
        text += `- محاضرة ${item.session.sessionNumber} (${item.groupName}${item.isSpecialWorkshop ? ' - ورشة خاصة 🛠️' : ''} - مدرب أصلي: ${item.primaryTrainerName}) 👈 ${item.approvedHours} س (${item.session.date})
`;
      });
    }

    if (payrollSummary.transferredOutSessions.length > 0) {
      text += `
🔄 *تفاصيل المحاضرات المحولة لمدربين آخرين:*
`;
      payrollSummary.transferredOutSessions.forEach(item => {
        text += `- محاضرة ${item.session.sessionNumber} (${item.groupName}${item.isSpecialWorkshop ? ' - ورشة خاصة 🛠️' : ''} - حضرها: ${item.actualTrainerName}) 👈 ${item.approvedHours} س (${item.session.date})
`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const printPayrollStatement = () => {
    if (!payrollSummary) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب الراتب - ${payrollSummary.trainerName}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 30px; direction: rtl; text-align: right; color: #1e293b; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; }
          .card-label { font-size: 12px; color: #64748b; font-weight: bold; }
          .card-value { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; }
          th { background: #f1f5f9; font-weight: bold; }
          .total-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; text-align: center; margin-top: 25px; border-radius: 12px; }
          .total-amount { font-size: 28px; font-weight: 900; color: #047857; margin-top: 5px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">كشف حساب المُرتب وساعات العمل الشهري</div>
          <div class="subtitle">المدرب: <strong>${payrollSummary.trainerName}</strong> | الفترة: <strong>${dateFrom || 'الكل'} إلى ${dateTo || 'الكل'}</strong></div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">الساعات الموكلة (Target)</div>
            <div class="card-value">${payrollSummary.totalAllocatedHours} ساعة (${payrollSummary.totalAssignedSessionsCount} محاضرة)</div>
          </div>
          <div class="card">
            <div class="card-label">ساعات المحاضرات العادية</div>
            <div class="card-value">${payrollSummary.netRegularHours} ساعة (${payrollSummary.regularPay.toLocaleString('ar-EG')} ج.م)</div>
          </div>
          <div class="card">
            <div class="card-label">ساعات الورش الخاصة 🛠️</div>
            <div class="card-value">${payrollSummary.netWorkshopHours} ساعة (${payrollSummary.workshopPay.toLocaleString('ar-EG')} ج.م)</div>
          </div>
          <div class="card">
            <div class="card-label">ساعات بديل مكتسبة / محولة</div>
            <div class="card-value">+${payrollSummary.substituteEarnedHours} س مكتسب | -${payrollSummary.transferredOutHours} س محول</div>
          </div>
        </div>

        ${payrollSummary.substituteEarnedSessions.length > 0 ? `
          <h3>🌟 تفاصيل ساعات البديل المكتسبة (المستحقة):</h3>
          <table>
            <thead>
              <tr>
                <th>المجموعة</th>
                <th>رقم المحاضرة</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المدرب الأصلي</th>
                <th>الساعات المعتمدة</th>
              </tr>
            </thead>
            <tbody>
              ${payrollSummary.substituteEarnedSessions.map(item => `
                <tr>
                  <td>${item.groupName}</td>
                  <td>المحاضرة ${item.session.sessionNumber}</td>
                  <td>${item.session.date}</td>
                  <td>${item.isSpecialWorkshop ? 'ورشة خاصة 🛠️' : 'عادية'}</td>
                  <td>${item.primaryTrainerName}</td>
                  <td>${item.approvedHours} ساعة</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${payrollSummary.transferredOutSessions.length > 0 ? `
          <h3>🔄 تفاصيل المحاضرات المحولة لمدربين آخرين:</h3>
          <table>
            <thead>
              <tr>
                <th>المجموعة</th>
                <th>رقم المحاضرة</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المدرب البديل (حضر بدلها)</th>
                <th>الساعات المحولة</th>
              </tr>
            </thead>
            <tbody>
              ${payrollSummary.transferredOutSessions.map(item => `
                <tr>
                  <td>${item.groupName}</td>
                  <td>المحاضرة ${item.session.sessionNumber}</td>
                  <td>${item.session.date}</td>
                  <td>${item.isSpecialWorkshop ? 'ورشة خاصة 🛠️' : 'عادية'}</td>
                  <td>${item.actualTrainerName}</td>
                  <td>${item.approvedHours} ساعة</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="total-box">
          <div style="font-size: 13px; color: #065f46; font-weight: bold; margin-bottom: 4px;">
            المحاضرات العادية: ${payrollSummary.netRegularHours} ساعة × ${hourlyRate} ج.م = ${payrollSummary.regularPay.toLocaleString('ar-EG')} ج.م
          </div>
          <div style="font-size: 13px; color: #92400e; font-weight: bold; margin-bottom: 8px;">
            الورش الخاصة: ${payrollSummary.netWorkshopHours} ساعة × ${workshopHourlyRate} ج.م = ${payrollSummary.workshopPay.toLocaleString('ar-EG')} ج.م
          </div>
          <div class="total-amount">${payrollSummary.netSalary.toLocaleString('ar-EG')} جنيه مصري</div>
        </div>

        <div class="footer">
          تم استخراج هذا الكشف آلياً بواسطة نظام إدارة التدريب والمجموعات - Saber Group Management System
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Memoized Filtered Feedbacks and Analytics
  const feedbackAnalytics = useMemo(() => {
    let list = allFeedbacks.filter(f => {
      // Group filter
      if (selectedGroupId !== 'all' && f.groupId !== selectedGroupId) return false;

      // Trainer filter
      if (selectedTrainerId && isStaff) {
        const targetTrainer = trainers.find(t => t.uid === selectedTrainerId);
        const targetName = targetTrainer?.name || '';
        const isTrainerMatch = 
          f.trainerId === selectedTrainerId ||
          (f.primaryTrainerName && targetName && f.primaryTrainerName.includes(targetName)) ||
          (f.trainerName && targetName && f.trainerName.includes(targetName)) ||
          (f.otherTrainerName && targetName && f.otherTrainerName.includes(targetName));
        if (!isTrainerMatch) return false;
      }

      // Sales filter
      if (evalSalesFilter !== 'all' && f.salesAgentName !== evalSalesFilter) return false;

      // Search term
      if (evalSearchTerm.trim()) {
        const term = evalSearchTerm.toLowerCase();
        const matchStudent = (f.studentName || '').toLowerCase().includes(term);
        const matchGroup = (f.groupName || '').toLowerCase().includes(term);
        const matchTrainer = (f.primaryTrainerName || f.trainerName || '').toLowerCase().includes(term);
        const matchSales = (f.salesAgentName || '').toLowerCase().includes(term);
        const matchComment = (f.comments || '').toLowerCase().includes(term);
        if (!matchStudent && !matchGroup && !matchTrainer && !matchSales && !matchComment) return false;
      }

      return true;
    });

    // Counts & averages
    const totalCount = list.length;
    const anonymousCount = list.filter(f => f.isAnonymous || f.studentId === 'anonymous').length;

    const courseRatings = list.map(f => f.ratingCourse || f.ratingGeneral || 0).filter(r => r > 0);
    const avgCourse = courseRatings.length > 0 ? (courseRatings.reduce((a, b) => a + b, 0) / courseRatings.length).toFixed(1) : '0';

    const contentRatings = list.map(f => f.ratingContent || f.ratingContentSuitable || 0).filter(r => r > 0);
    const avgContent = contentRatings.length > 0 ? (contentRatings.reduce((a, b) => a + b, 0) / contentRatings.length).toFixed(1) : '0';

    const trainerRatings = list.map(f => f.ratingTrainer || f.ratingTrainerExplanation || 0).filter(r => r > 0);
    const avgTrainer = trainerRatings.length > 0 ? (trainerRatings.reduce((a, b) => a + b, 0) / trainerRatings.length).toFixed(1) : '0';

    const salesRatings = list.map(f => f.ratingSales || 0).filter(r => r > 0);
    const avgSales = salesRatings.length > 0 ? (salesRatings.reduce((a, b) => a + b, 0) / salesRatings.length).toFixed(1) : '0';

    const academyRatings = list.map(f => f.ratingAcademy || f.ratingSupportService || 0).filter(r => r > 0);
    const avgAcademy = academyRatings.length > 0 ? (academyRatings.reduce((a, b) => a + b, 0) / academyRatings.length).toFixed(1) : '0';

    // Sales breakdown
    const salesMap: Record<string, { count: number; totalScore: number; notes: string[] }> = {};
    list.forEach(f => {
      if (f.salesAgentName && f.salesAgentName.trim()) {
        const sName = f.salesAgentName.trim();
        if (!salesMap[sName]) {
          salesMap[sName] = { count: 0, totalScore: 0, notes: [] };
        }
        salesMap[sName].count += 1;
        salesMap[sName].totalScore += (f.ratingSales || 5);
        if (f.salesNotes && f.salesNotes.trim()) {
          salesMap[sName].notes.push(f.salesNotes);
        }
      }
    });

    const salesSummary = Object.keys(salesMap).map(sName => ({
      name: sName,
      count: salesMap[sName].count,
      avg: (salesMap[sName].totalScore / salesMap[sName].count).toFixed(1),
      notes: salesMap[sName].notes
    }));

    return {
      filteredList: list,
      totalCount,
      anonymousCount,
      avgCourse,
      avgContent,
      avgTrainer,
      avgSales,
      avgAcademy,
      salesSummary
    };
  }, [allFeedbacks, selectedGroupId, selectedTrainerId, evalSalesFilter, evalSearchTerm, trainers, isStaff]);

  // Collective analytics across all groups and trainers for global evaluations
  const collectiveAnalytics = useMemo(() => {
    let targetFeedbacks = allFeedbacks;
    if (selectedGlobalFormFilter !== 'all') {
      targetFeedbacks = allFeedbacks.filter(f => f.globalEvalId === selectedGlobalFormFilter);
    }

    const groupMap = new Map<string, {
      group: Group;
      submissions: LectureFeedback[];
    }>();

    groups.forEach(g => {
      groupMap.set(g.id, { group: g, submissions: [] });
    });

    targetFeedbacks.forEach(f => {
      if (f.groupId && groupMap.has(f.groupId)) {
        groupMap.get(f.groupId)!.submissions.push(f);
      }
    });

    const groupRows = Array.from(groupMap.values()).map(({ group, submissions }) => {
      const count = submissions.length;
      const courseRatings = submissions.map(s => s.ratingCourse || s.ratingGeneral || 0).filter(r => r > 0);
      const avgCourse = courseRatings.length ? +(courseRatings.reduce((a, b) => a + b, 0) / courseRatings.length).toFixed(1) : 0;

      const trainerRatings = submissions.map(s => s.ratingTrainer || s.ratingTrainerExplanation || 0).filter(r => r > 0);
      const avgTrainer = trainerRatings.length ? +(trainerRatings.reduce((a, b) => a + b, 0) / trainerRatings.length).toFixed(1) : 0;

      const salesRatings = submissions.map(s => s.ratingSales || 0).filter(r => r > 0);
      const avgSales = salesRatings.length ? +(salesRatings.reduce((a, b) => a + b, 0) / salesRatings.length).toFixed(1) : 0;

      const academyRatings = submissions.map(s => s.ratingAcademy || s.ratingSupportService || 0).filter(r => r > 0);
      const avgAcademy = academyRatings.length ? +(academyRatings.reduce((a, b) => a + b, 0) / academyRatings.length).toFixed(1) : 0;

      const overallAvg = count > 0 ? +((avgCourse + avgTrainer + avgAcademy) / 3).toFixed(1) : 0;

      const trainerName = (group as any).trainerName || (trainers.find(t => t.uid === (group as any).primaryTrainerId || (group.trainerIds && group.trainerIds[0] === t.uid))?.name) || 'غير محدد';

      return {
        groupId: group.id,
        groupName: group.name,
        courseName: group.courseName,
        trainerName,
        count,
        avgCourse,
        avgTrainer,
        avgSales,
        avgAcademy,
        overallAvg
      };
    });

    const trainerMap = new Map<string, {
      trainerName: string;
      submissions: LectureFeedback[];
      groupsCount: Set<string>;
    }>();

    targetFeedbacks.forEach(f => {
      const name = f.primaryTrainerName || f.trainerName || 'غير محدد';
      if (!trainerMap.has(name)) {
        trainerMap.set(name, {
          trainerName: name,
          submissions: [],
          groupsCount: new Set<string>()
        });
      }
      const entry = trainerMap.get(name)!;
      entry.submissions.push(f);
      if (f.groupId) entry.groupsCount.add(f.groupId);
    });

    const trainerRows = Array.from(trainerMap.values()).map(entry => {
      const count = entry.submissions.length;
      const ratings = entry.submissions.map(s => s.ratingTrainer || s.ratingTrainerExplanation || 0).filter(r => r > 0);
      const avgRating = ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
      const complaints = entry.submissions.filter(s => s.hasComplaint).length;

      return {
        trainerName: entry.trainerName,
        groupsCount: entry.groupsCount.size,
        totalSubmissions: count,
        avgRating,
        complaints
      };
    });

    trainerRows.sort((a, b) => b.avgRating - a.avgRating);

    const totalSubmissionsAll = targetFeedbacks.length;
    const allTrainerRatings = targetFeedbacks.map(f => f.ratingTrainer || f.ratingTrainerExplanation || 0).filter(r => r > 0);
    const overallAvgTrainer = allTrainerRatings.length ? +(allTrainerRatings.reduce((a, b) => a + b, 0) / allTrainerRatings.length).toFixed(1) : 0;
    const topTrainer = trainerRows.length > 0 ? trainerRows[0] : null;

    const sortedGroups = [...groupRows].filter(g => g.count > 0).sort((a, b) => b.overallAvg - a.overallAvg);
    const topGroup = sortedGroups.length > 0 ? sortedGroups[0] : null;

    return {
      totalSubmissionsAll,
      overallAvgTrainer,
      topTrainer,
      topGroup,
      groupRows,
      trainerRows
    };
  }, [allFeedbacks, groups, trainers, selectedGlobalFormFilter]);

  // Export Feedback Evaluations to CSV
  const exportEvaluationsCSV = () => {
    if (feedbackAnalytics.filteredList.length === 0) return;
    const headers = [
      "Group",
      "Course",
      "Student Name",
      "Is Anonymous?",
      "Course Rating",
      "Content Rating",
      "Primary Trainer",
      "Trainer Rating",
      "Other Trainer",
      "Other Trainer Rating",
      "Sales Agent",
      "Sales Rating",
      "Academy Rating",
      "Comments & Notes",
      "Date"
    ];

    const rows = feedbackAnalytics.filteredList.map(f => [
      f.groupName || 'N/A',
      f.courseName || 'N/A',
      f.studentName || 'مجهول الهوية',
      f.isAnonymous ? "Yes" : "No",
      f.ratingCourse || f.ratingGeneral || 0,
      f.ratingContent || f.ratingContentSuitable || 0,
      f.primaryTrainerName || f.trainerName || 'N/A',
      f.ratingTrainer || f.ratingTrainerExplanation || 0,
      f.otherTrainerName || 'N/A',
      f.otherTrainerRating || 0,
      f.salesAgentName || 'N/A',
      f.ratingSales || 0,
      f.ratingAcademy || f.ratingSupportService || 0,
      (f.comments || '').replace(/"/g, '""'),
      f.date || 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(item => `"${item}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trainee_Evaluations_${selectedGroupId}_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (filteredSessions.length === 0) return;
    const headers = ["Group", "Course", "Session #", "Date", "Actual Start", "Actual End", "Duration (Hrs)", "Approved Hrs", "Sub Trainer?", "Breaks", "Practices", "Manual Edit?"];
    const rows = filteredSessions.map(s => {
      const g = groups.find(group => group.id === s.groupId);
      const isSub = g ? (g.trainerIds && g.trainerIds[0] !== selectedTrainerId ? "Yes" : "No") : "No";
      const totalBreakMinutes = s.breaks?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0;
      return [
        g?.name || 'N/A',
        g?.courseName || 'N/A',
        s.sessionNumber,
        s.date,
        s.startTimeActual || '',
        s.endTimeActual || '',
        s.durationActual ? (s.durationActual / 60).toFixed(2) : '0',
        s.approvedHours || '0',
        isSub,
        `${s.breaks?.length || 0} (${totalBreakMinutes} mins)`,
        s.practices?.length || 0,
        s.isManualTimingEdit ? "Yes" : "No"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(item => `"${item}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trainer_KPI_${selectedTrainerId}_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8" id="trainer-kpis-container">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-amber-500 text-white rounded-2xl text-xl">🏆</span>
              تقييم أداء المحاضرات وتقارير الـ KPIs والتقييمات
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              متابعة دقيقة لساعات عمل المدربين، استبيانات المتدربين، وتقييم السيلز والكورسات والأكاديمية.
            </p>
          </div>
          <button
            onClick={activeTab === 'kpis' ? exportToCSV : exportEvaluationsCSV}
            disabled={activeTab === 'kpis' ? filteredSessions.length === 0 : feedbackAnalytics.filteredList.length === 0}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-5 py-3 rounded-2xl transition-all shadow-lg shadow-primary-600/30 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {activeTab === 'kpis' ? 'تصدير تقرير الساعات (CSV)' : 'تصدير تقرير التقييمات (CSV)'}
          </button>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('kpis')}
            className={`pb-3 px-3 font-black text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'kpis'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            ساعات أداء وسجل المحاضرات (KPIs)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evaluations')}
            className={`pb-3 px-3 font-black text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'evaluations'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            تحليلات واستبيانات التقييم ({feedbackAnalytics.totalCount})
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md">
          <div className="flex items-center gap-2 mb-4 text-emerald-600 font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
            <Filter className="w-5 h-5" />
            فلترة تفصيلية
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Trainer Selection */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                المدرب المستهدف
              </label>
              {isStaff ? (
                <select
                  value={selectedTrainerId}
                  onChange={(e) => setSelectedTrainerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">كل المدربين</option>
                  {trainers.map(t => (
                    <option key={t.uid} value={t.uid}>
                      {t.name} ({t.role === 'team_leader' ? 'Team Leader' : t.role === 'coordinator' ? 'Coordinator' : t.role === 'admin' ? 'Admin' : 'Trainer'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                  {user.name}
                </div>
              )}
            </div>

            {/* Group Selection */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                الجروب
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                <option value="all">كل الجروبات</option>
                {groups
                  .filter(g => !selectedTrainerId || g.trainerIds?.includes(selectedTrainerId) || sessions.some(s => s.groupId === g.id && s.actualTrainerId === selectedTrainerId))
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                التاريخ من
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                التاريخ إلى
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'kpis' && (
              <>
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1: Total Lectures */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">المحاضرات المنفذة</div>
                      <div className="text-4xl font-extrabold mt-1">{kpis.totalSessions}</div>
                      <div className="text-xs text-rose-300 mt-2 flex items-center gap-1 font-semibold">
                        <span>منها</span>
                        <strong className="bg-red-950 px-1.5 py-0.5 rounded">{kpis.substituteSessionsCount}</strong>
                        <span>محاضرات كبديل</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">👩‍🏫</div>
                  </div>

                  {/* Card 2: Actual vs Approved Hours */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">ساعات العمل (فعلية / معتمدة)</div>
                      <div className="text-3xl font-extrabold mt-1 text-slate-800 dark:text-white flex items-baseline gap-2">
                        <span>{kpis.totalActualHours} ساعة</span>
                        <span className="text-sm font-medium text-slate-500">فعلية</span>
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2">
                        المعتمدة للراتب: {kpis.totalApprovedHours} ساعة
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 3: Limit Exceeding (KPI Penalty) */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">تجاوزات الحد الأقصى للمحاضرة</div>
                      <div className={`text-4xl font-extrabold mt-1 ${kpis.overtimeCount > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                        {kpis.overtimeCount}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        محاضرات تجاوزت مدتها الساعات المعتمدة في الكورس.
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpis.overtimeCount > 0 ? 'bg-red-50 text-red-500 dark:bg-red-950/20' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}>
                      ⚠️
                    </div>
                  </div>

                  {/* Card 4: Action Items */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">الأنشطة المكملة للمتدربين</div>
                      <div className="text-3xl font-extrabold mt-1 text-emerald-500">{kpis.totalPracticesCount} تطبيق عملي</div>
                      <div className="text-xs text-slate-400 mt-2">
                         مع {kpis.totalBreaksCount} استراحات مسجلة لمخ المعرفة.
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/20 text-purple-500 flex items-center justify-center">
                      <Award className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Monthly Payroll & Hours Calculation Summary Dashboard */}
                {payrollSummary && (
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-700/80 space-y-6">
                    {/* Header bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/70 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl font-black shadow-inner">
                          💰
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white flex items-center gap-2">
                            كشف المُرتب وملخص الساعات الشهرية للمدرب:
                            <span className="text-emerald-400 underline decoration-emerald-500/50">{payrollSummary.trainerName}</span>
                          </h2>
                          <p className="text-xs text-slate-300 mt-1">
                            حساب دقيق للمستحقات: الساعات الموكلة، الساعات المنفذة بنفسها، الساعات المحولة لمدربين آخرين، وساعات البديل المكتسبة.
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={copyPayrollSummaryText}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md text-xs"
                        >
                          {copySuccess ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                          {copySuccess ? 'تم النسخ!' : 'نسخ كشف الحساب لـ WhatsApp'}
                        </button>

                        <button
                          type="button"
                          onClick={printPayrollStatement}
                          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md text-xs border border-slate-600"
                        >
                          <Printer className="w-4 h-4" />
                          طباعة كشف الحساب
                        </button>
                      </div>
                    </div>

                    {/* Hourly Rate & Workshop Rate Input Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Standard Lecture Hourly Rate */}
                      <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl text-lg font-bold">
                            💵
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-300">
                              سعر ساعة المحاضرات العادية (ج.م / ساعة):
                            </label>
                            <span className="text-[11px] text-slate-400">
                              {isStaff ? 'سعر ساعة المحاضرات القياسية' : 'سعر الساعة المسجل للمحاضرات'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={hourlyRate}
                            disabled={!isStaff}
                            onChange={(e) => handleHourlyRateChange(parseFloat(e.target.value) || 0)}
                            className="w-28 bg-slate-900 border border-emerald-500/50 text-emerald-400 font-black text-center text-lg rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-80"
                          />
                          <span className="text-xs font-bold text-slate-300">ج.م / س</span>
                        </div>
                      </div>

                      {/* Special Workshop Hourly Rate */}
                      <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl text-lg font-bold">
                            🛠️
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-amber-300">
                              سعر ساعة الورش الخاصة (ج.م / ساعة):
                            </label>
                            <span className="text-[11px] text-slate-400">
                              {isStaff ? 'سعر خاص ومختلف للورش المستقلة' : 'سعر الساعة المحدد للورش الخاصة'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={workshopHourlyRate}
                            disabled={!isStaff}
                            onChange={(e) => handleWorkshopHourlyRateChange(parseFloat(e.target.value) || 0)}
                            className="w-28 bg-slate-900 border border-amber-500/50 text-amber-400 font-black text-center text-lg rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-80"
                          />
                          <span className="text-xs font-bold text-slate-300">ج.م / س</span>
                        </div>
                      </div>
                    </div>

                    {/* Stat Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {/* 1. Target Allocated Hours */}
                      <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
                        <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">🎯 الساعات الموكلة (Assigned)</div>
                        <div className="text-2xl font-black mt-1 text-white">{payrollSummary.totalAllocatedHours} س</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          حسب سقف {payrollSummary.totalAssignedSessionsCount} محاضرة مخصصة
                        </div>
                      </div>

                      {/* 2. Regular Hours */}
                      <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
                        <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">✅ المحاضرات العادية</div>
                        <div className="text-2xl font-black mt-1 text-emerald-300">{payrollSummary.netRegularHours} س</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          مستحق: {payrollSummary.regularPay.toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>

                      {/* 3. Special Workshop Hours */}
                      <div className="bg-slate-800/60 p-4 rounded-2xl border border-amber-500/30">
                        <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">🛠️ الورش الخاصة</div>
                        <div className="text-2xl font-black mt-1 text-amber-300">{payrollSummary.netWorkshopHours} س</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          مستحق: {payrollSummary.workshopPay.toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>

                      {/* 4. Substitute Hours Earned */}
                      <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
                        <div className="text-[10px] font-black uppercase text-purple-400 tracking-wider">🌟 بديل مكتسب / محول</div>
                        <div className="text-xl font-black mt-1 text-purple-300">+{payrollSummary.substituteEarnedHours} س / -{payrollSummary.transferredOutHours} س</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          بدلاء ومشاركات خارجية
                        </div>
                      </div>

                      {/* 5. Net Payable Hours */}
                      <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40">
                        <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">📊 إجمالي الساعات</div>
                        <div className="text-2xl font-black mt-1 text-emerald-300">{payrollSummary.netPayableHours} س</div>
                        <div className="text-[11px] text-emerald-400/80 mt-1 font-semibold">
                          ({payrollSummary.netRegularHours} عادية + {payrollSummary.netWorkshopHours} ورشة)
                        </div>
                      </div>

                      {/* 6. Total Net Salary */}
                      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 rounded-2xl shadow-lg border border-emerald-400/50 flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">💰 صافي المُرتب المستحق</div>
                        <div className="text-2xl font-black mt-1 text-white dir-ltr text-right">
                          {payrollSummary.netSalary.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
                        </div>
                        <div className="text-[10px] text-emerald-100/80 mt-1 font-bold">
                          عادية: {payrollSummary.regularPay.toLocaleString('ar-EG')} | ورش: {payrollSummary.workshopPay.toLocaleString('ar-EG')}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Breakdowns for Transfers & Substitutes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* Transferred Out List */}
                      <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                        <h4 className="text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <span>🔄</span>
                          محاضرات تم توجيهها/تحويلها لمدربين آخرين ({payrollSummary.transferredOutSessions.length})
                        </h4>
                        {payrollSummary.transferredOutSessions.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">لا توجد محاضرات تم تحويلها لمدربين آخرين في هذه الفترة.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {payrollSummary.transferredOutSessions.map((item, idx) => (
                              <div key={idx} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/70 text-xs flex justify-between items-center gap-2">
                                <div>
                                  <span className="font-bold text-white">محاضرة {item.session.sessionNumber} ({item.groupName})</span>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    تغطية م. <strong className="text-rose-300">{item.actualTrainerName}</strong> • {item.session.date}
                                  </div>
                                </div>
                                <span className="bg-rose-950 text-rose-300 font-bold px-2 py-1 rounded-lg text-[11px] whitespace-nowrap">
                                  -{item.approvedHours} ساعة
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Substitute Earned List */}
                      <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                        <h4 className="text-xs font-black text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <span>🌟</span>
                          محاضرات مكتسبة كـ بديل لمدربين آخرين ({payrollSummary.substituteEarnedSessions.length})
                        </h4>
                        {payrollSummary.substituteEarnedSessions.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">لا توجد محاضرات كبديل تم إنجازها في هذه الفترة.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {payrollSummary.substituteEarnedSessions.map((item, idx) => (
                              <div key={idx} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/70 text-xs flex justify-between items-center gap-2">
                                <div>
                                  <span className="font-bold text-white">محاضرة {item.session.sessionNumber} ({item.groupName})</span>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    بدلاً من م. <strong className="text-purple-300">{item.primaryTrainerName}</strong> • {item.session.date}
                                  </div>
                                </div>
                                <span className="bg-purple-950 text-purple-300 font-bold px-2 py-1 rounded-lg text-[11px] whitespace-nowrap">
                                  +{item.approvedHours} ساعة
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sessions Taught Details Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">
                        سجل المحاضرات المفصل للمدرب المختار خلال الفترة ({displayedSessions.length} من {filteredSessions.length} محاضرة)
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        يمكنك الانتقال لصفحة تقييم المحاضرة مباشرة أو توثيق المراجعة بالسوبرفايزر
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <Filter className="w-3.5 h-3.5 text-purple-500" />
                        <span className="font-bold text-slate-600 dark:text-slate-300">حالة المراجعة:</span>
                        <select
                          value={auditStatusFilter}
                          onChange={(e) => setAuditStatusFilter(e.target.value as any)}
                          className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                        >
                          <option value="all">الكل ({auditCounts.total})</option>
                          <option value="checked">✅ تمت المراجعة ({auditCounts.checked})</option>
                          <option value="under_review">⏳ تحت المراجعة ({auditCounts.underReview})</option>
                          <option value="issue_flagged">⚠️ بيانات غير مضبوطة ({auditCounts.issueFlagged})</option>
                          <option value="unreviewed">🔘 لم تُراجع بعد ({auditCounts.unreviewed})</option>
                        </select>
                      </div>
                      <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-3 py-1 rounded-full">
                        السقف المقارن معتمد
                      </span>
                    </div>
                  </div>

                  {displayedSessions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                      ⚠️ لا توجد محاضرات مطابقة لفلتر المراجعة المختار في الفترة المحددة.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/40 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                            <th className="p-4">اسم الجروب والمسار</th>
                            <th className="p-4">رقم المحاضرة والرابط</th>
                            <th className="p-4">وقت الحضور الفعلي</th>
                            <th className="p-4">مدة المحاضرة الفعلية</th>
                            <th className="p-4">الساعات المعتمدة للراتب</th>
                            <th className="p-4">الأنشطة والبريكات</th>
                            <th className="p-4">البنود المشروحة من الـ Checklist</th>
                            <th className="p-4">مراجعة وتوثيق السوبرفايزر 👨‍🏫</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {displayedSessions.map((session) => {
                            const grp = groups.find(g => g.id === session.groupId);
                            const course = grp ? courses.find(c => c.id === grp.courseId) : null;
                            const isAlternative = grp ? (grp.trainerIds && grp.trainerIds[0] !== selectedTrainerId) : false;
                            const totalBreakMin = session.breaks?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0;
                            const { actualMins, sessionActualHours, sessionApprovedHours, maxApproved, isOvertime } = calculateSessionMetrics(session, grp, course);

                            return (
                              <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-4 font-bold">
                                  <div className="text-slate-800 dark:text-slate-100">{grp?.name || 'N/A'}</div>
                                  <div className="text-xs text-slate-400 font-normal">{grp?.courseName || 'N/A'}</div>
                                </td>
                                <td className="p-4 text-slate-700 dark:text-slate-300">
                                  <div className="font-bold">المحاضرة {session.sessionNumber}</div>
                                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-3 h-3" />
                                    {session.date}
                                  </div>
                                  <a
                                    href={`/#/groups/${session.groupId}?sessionId=${session.id}&tab=lectures`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all shadow-xs"
                                    title="فتح صفحة هذه المحاضرة والتقييم في الجروب بتبويب جديد"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>صفحة المحاضرة والتقييم 🔗</span>
                                  </a>
                                </td>
                                <td className="p-4 min-w-[190px]">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {session.startTimeActual ? formatTime12hArabic(session.startTimeActual) : '--'} - {session.endTimeActual ? formatTime12hArabic(session.endTimeActual) : '--'}
                                  </div>

                                  {session.timeModifiedByName && (
                                    <div className="text-[11px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 p-2 rounded-xl border border-purple-200 dark:border-purple-800/80 mt-1.5 font-normal leading-tight">
                                      <div className="font-bold flex items-center gap-1">
                                        <span>✍️ معدلة بالسوبرفايزر:</span>
                                        <span>{session.timeModifiedByName}</span>
                                      </div>
                                      <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">{session.timeModifiedAt}</div>
                                      {session.timeModifiedReason && (
                                        <div className="text-[10px] text-slate-700 dark:text-slate-200 font-medium mt-1 bg-white/80 dark:bg-slate-900/80 p-1.5 rounded-lg border border-purple-100 dark:border-purple-900/60">
                                          💬 {session.timeModifiedReason}
                                        </div>
                                      )}
                                      {session.originalStartTimeActual && session.originalEndTimeActual && (
                                        <div className="text-[9px] text-slate-400 line-through mt-0.5">
                                          قبل التعديل: {formatTime12hArabic(session.originalStartTimeActual)} - {formatTime12hArabic(session.originalEndTimeActual)}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="text-xs text-slate-400 space-y-1 mt-1">
                                    {isAlternative && (
                                      <span className="text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded font-black block w-fit">
                                        مدرب بديل 🔁
                                      </span>
                                    )}
                                  </div>

                                  {canEditSessionTime ? (
                                    <button
                                      type="button"
                                      onClick={() => openEditTimeModal(session)}
                                      className="mt-2 text-[11px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                      title="تعديل توقيت المحاضرة وساعاتها للحماية من تلاعب الأوقات"
                                    >
                                      <Clock className="w-3 h-3 text-indigo-500" />
                                      <span>تعديل التوقيت ⏱️</span>
                                    </button>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 mt-1 italic">
                                      🔒 التعديل متاح للمشرفين والمديرين فقط
                                    </div>
                                  )}
                                </td>
                                <td className="p-4">
                                   <div className="font-black text-slate-800 dark:text-slate-100">
                                     {actualMins > 0 ? `${sessionActualHours} ساعة` : '--'}
                                   </div>
                                   <div className="text-xs text-slate-400">
                                     {actualMins > 0 ? `(${actualMins} دقيقة)` : ''}
                                   </div>
                                 </td>
                                 <td className="p-4">
                                   <div className="font-black text-emerald-600 dark:text-emerald-400">
                                     {sessionApprovedHours} ساعة
                                   </div>
                                   {isOvertime && (
                                     <div className="text-[10px] text-amber-500 font-bold">
                                       ⚠️ السقف الأقصى ({maxApproved} س)
                                     </div>
                                   )}
                                 </td>
                                <td className="p-4 text-xs">
                                  <div>{session.practices?.length || 0} تطبيقات عملية</div>
                                  <div className="text-slate-400 mt-0.5">
                                    {session.breaks?.length || 0} استراحات ({totalBreakMin} دقيقة)
                                  </div>
                                </td>
                                <td className="p-4 max-w-sm">
                                  {session.explainedItems && session.explainedItems.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {session.explainedItems.map((itemId, i) => {
                                        return (
                                          <span key={itemId} className="bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-primary-100 dark:border-primary-900/50">
                                            بند {i + 1}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs">لم يتم شرح بنود جديدة</span>
                                  )}
                                </td>

                                {/* Supervisor Audit Column */}
                                <td className="p-4 min-w-[210px]">
                                  {(!session.auditStatus || session.auditStatus === 'unreviewed') && (
                                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-xl text-xs font-bold">
                                      🔘 لم تُراجع بعد
                                    </span>
                                  )}
                                  {session.auditStatus === 'checked' && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-xl text-xs font-black">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      ✅ موثقة ومراجعة
                                    </span>
                                  )}
                                  {session.auditStatus === 'under_review' && (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-xl text-xs font-black">
                                      <Clock className="w-3.5 h-3.5" />
                                      ⏳ تحت المراجعة
                                    </span>
                                  )}
                                  {session.auditStatus === 'issue_flagged' && (
                                    <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 px-2.5 py-1 rounded-xl text-xs font-black">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      ⚠️ بيانات يحتاج تعديل
                                    </span>
                                  )}

                                  {session.auditCheckedByName && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                      المراجع: <strong className="text-slate-700 dark:text-slate-200">{session.auditCheckedByName}</strong>
                                      {session.auditCheckedAt && <span className="block text-[9px] text-slate-400">{session.auditCheckedAt}</span>}
                                    </div>
                                  )}

                                  {session.auditComment && (
                                    <div className="text-[11px] bg-slate-100 dark:bg-slate-800/90 p-2 rounded-lg border border-slate-200 dark:border-slate-700 mt-1.5 text-slate-700 dark:text-slate-200 font-medium leading-tight">
                                      💬 {session.auditComment}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => openAuditModal(session)}
                                    className="mt-2 text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                  >
                                    <span>تحديث التوثيق ✍️</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'evaluations' && (
              <div className="space-y-8">
                {/* Global Evaluation Forms Trigger & Management Banner */}
                <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-500/20 pb-5">
                    <div>
                      <div className="flex items-center gap-2 text-purple-400 font-extrabold text-xs uppercase tracking-wider mb-1">
                        <Globe className="w-4 h-4 text-purple-400" />
                        استمارات التقييم الشاملة لجميع الجروبات (Global Evaluations)
                      </div>
                      <h2 className="text-2xl font-black text-white">إتاحة فورم تقييم شامل (نهاية الشهر / التقييمات الدورية)</h2>
                      <p className="text-slate-300 text-xs mt-1">أنشئ فورم تقييم ينشر فوراً لجميع الطلاب والجروبات المسجلة لتتبع أداء المدربين والكورسات والخدمة الشاملة.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateFormModal(true)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-6 py-3.5 rounded-2xl shadow-lg shadow-purple-600/30 flex items-center gap-2 text-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-5 h-5" />
                      إنشاء فورم تقييم شامل جديد 📝
                    </button>
                  </div>

                  {/* Active Global Forms List */}
                  <div>
                    <h3 className="text-xs font-black text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      استمارات التقييم المفعلة والسابقة ({globalEvalForms.length})
                    </h3>

                    {globalEvalForms.length === 0 ? (
                      <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                        لم يتم إنشاء استمارة تقييم شاملة بعد. اضغط على زر "إنشاء فورم تقييم شامل جديد" لإطلاق أول فورم لجميع الطلاب.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {globalEvalForms.map(form => (
                          <div key={form.id} className={`p-4 rounded-2xl border transition-all ${form.isActive ? 'bg-purple-950/20 border-purple-500/40' : 'bg-slate-900/60 border-slate-800 opacity-75'}`}>
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${form.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                  {form.isActive ? 'متاحة للطلاب الآن 🟢' : 'غير مفعلة 🔴'}
                                </span>
                                {form.month && (
                                  <span className="mr-2 text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                                    🗓️ {form.month}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFormStatus(form.id, form.isActive)}
                                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                                  title={form.isActive ? 'إيقاف الاستمارة' : 'تفعيل الاستمارة'}
                                >
                                  {form.isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteForm(form.id)}
                                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                                  title="حذف الاستمارة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <h4 className="font-bold text-white text-sm mb-1">{form.title}</h4>
                            {form.description && <p className="text-xs text-slate-300 line-clamp-2 mb-3">{form.description}</p>}

                            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                              <span className="text-slate-400 text-[10px]">المستهدف: {form.targetGroupNames?.[0] || 'جميع الجروبات'}</span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFormModal({
                                    isOpen: true,
                                    title: form.title,
                                    description: form.description || '',
                                    month: form.month || '',
                                    targetGroupName: form.targetGroupNames?.[0] || 'جميع الجروبات النشطة',
                                    isActive: form.isActive,
                                    fromCreationModal: false
                                  })}
                                  className="bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl border border-indigo-500/30 flex items-center gap-1 text-[11px] transition-all cursor-pointer"
                                  title="معاينة شكل الاستمارة كما تظهر للطلاب"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                  معاينة 👁️
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openFormLink(form.id)}
                                  className="bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 font-bold px-2.5 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1 text-[11px] transition-all cursor-pointer"
                                  title="فتح وتجربة الاستمارة في تبويب جديد"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                                  فتح الفورم 🔗
                                </button>

                                <button
                                  type="button"
                                  onClick={() => copyFormLink(form.id)}
                                  className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 font-bold px-3 py-1.5 rounded-xl border border-purple-700/50 flex items-center gap-1 text-[11px] transition-all cursor-pointer"
                                >
                                  {linkCopiedFormId === form.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      تم النسخ!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      نسخ الرابط
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* View Switcher Controls Header */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">طريقة العرض:</span>
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex gap-1 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => setEvaluationViewMode('individual')}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${evaluationViewMode === 'individual' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                      >
                        <UserIcon className="w-4 h-4" />
                        النتائج والتقييمات الفردية
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvaluationViewMode('collective')}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${evaluationViewMode === 'collective' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        النتيجة الجماعية ومقارنة الجروبات (Collective View)
                      </button>
                    </div>
                  </div>

                  {/* Filter by Global Form */}
                  {globalEvalForms.length > 0 && (
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">تصفية باستمارة معينة:</span>
                      <select
                        value={selectedGlobalFormFilter}
                        onChange={(e) => setSelectedGlobalFormFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      >
                        <option value="all">كل التقييمات والاستشارات</option>
                        {globalEvalForms.map(f => (
                          <option key={f.id} value={f.id}>{f.title} ({f.month})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* COLLECTIVE VIEW DISPLAY */}
                {evaluationViewMode === 'collective' ? (
                  <div className="space-y-8">
                    {/* Collective High Level Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">إجمالي الطلاب المشاركين</div>
                        <div className="text-3xl font-extrabold mt-1 text-purple-600 dark:text-purple-400 flex items-center gap-2">
                          <Users className="w-6 h-6" />
                          <span>{collectiveAnalytics.totalSubmissionsAll} متدرب</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">عبر جميع الجروبات والمجموعات</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">متوسط تقييم المدربين الكلي</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-500 flex items-center gap-1">
                          <span>{collectiveAnalytics.overallAvgTrainer}</span>
                          <Star className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">من إجمالي 5 درجات</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">المدرب الأعلى تقييماً 🏆</div>
                        <div className="text-lg font-black mt-1 text-slate-900 dark:text-white truncate">
                          {collectiveAnalytics.topTrainer ? collectiveAnalytics.topTrainer.trainerName : 'لا يوجد بيانات'}
                        </div>
                        <div className="text-xs text-emerald-500 font-bold mt-1">
                          {collectiveAnalytics.topTrainer ? `⭐ ${collectiveAnalytics.topTrainer.avgRating} / 5 (${collectiveAnalytics.topTrainer.totalSubmissions} تقييم)` : '--'}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">الجروب الأعلى تفاعلاً وأداءً 🌟</div>
                        <div className="text-lg font-black mt-1 text-slate-900 dark:text-white truncate">
                          {collectiveAnalytics.topGroup ? collectiveAnalytics.topGroup.groupName : 'لا يوجد بيانات'}
                        </div>
                        <div className="text-xs text-purple-500 font-bold mt-1">
                          {collectiveAnalytics.topGroup ? `متوسط التقييم: ⭐ ${collectiveAnalytics.topGroup.overallAvg} / 5` : '--'}
                        </div>
                      </div>
                    </div>

                    {/* Group Collective Breakdown Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Building className="w-4 h-4 text-purple-500" />
                          نتيجة التقييم الشامل لكل جروب ومقارنة الأداء
                        </h3>
                        <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 font-bold px-3 py-1 rounded-full">
                          مجموع الجروبات: {collectiveAnalytics.groupRows.length}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/40 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                              <th className="p-4">اسم الجروب والمسار</th>
                              <th className="p-4">المدرب المسؤول</th>
                              <th className="p-4">عدد التقييمات</th>
                              <th className="p-4">الكورس والمحتوى</th>
                              <th className="p-4">شرح وتفاعل المدرب</th>
                              <th className="p-4">المبيعات</th>
                              <th className="p-4">الأكاديمية والخدمات</th>
                              <th className="p-4">التقييم الإجمالي العام</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {collectiveAnalytics.groupRows.map(row => (
                              <tr key={row.groupId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-4 font-bold">
                                  <div className="text-slate-900 dark:text-white">{row.groupName}</div>
                                  <div className="text-xs text-slate-400 font-normal">{row.courseName}</div>
                                </td>
                                <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                                  {row.trainerName}
                                </td>
                                <td className="p-4">
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg font-bold text-xs">
                                    {row.count} طالب
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-amber-500">
                                  ⭐ {row.avgCourse} / 5
                                </td>
                                <td className="p-4 font-bold text-emerald-500">
                                  ⭐ {row.avgTrainer} / 5
                                </td>
                                <td className="p-4 font-bold text-blue-500">
                                  ⭐ {row.avgSales} / 5
                                </td>
                                <td className="p-4 font-bold text-purple-500">
                                  ⭐ {row.avgAcademy} / 5
                                </td>
                                <td className="p-4">
                                  <span className="bg-purple-600 text-white font-black px-3 py-1 rounded-xl text-xs shadow-sm">
                                    ⭐ {row.overallAvg} / 5
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Trainer Performance Matrix */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-500" />
                          ترتيب وتقييم أداء المدربين من واقع نتائج الطلاب
                        </h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/40 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                              <th className="p-4">اسم المدرب</th>
                              <th className="p-4">عدد الجروبات المنسوبة</th>
                              <th className="p-4">إجمالي ردود الطلاب</th>
                              <th className="p-4">متوسط تقييم الشرح والتفاعل</th>
                              <th className="p-4">عدد الملاحظات / الشكاوى</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {collectiveAnalytics.trainerRows.map((t, idx) => (
                              <tr key={t.trainerName} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-4 font-bold flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                    {idx + 1}
                                  </span>
                                  <span className="text-slate-900 dark:text-white">{t.trainerName}</span>
                                </td>
                                <td className="p-4 text-slate-600 dark:text-slate-400 font-semibold">
                                  {t.groupsCount} جروب
                                </td>
                                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                  {t.totalSubmissions} تقييم
                                </td>
                                <td className="p-4 font-black text-emerald-500">
                                  ⭐ {t.avgRating} / 5
                                </td>
                                <td className="p-4">
                                  {t.complaints > 0 ? (
                                    <span className="bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full font-bold text-xs">
                                      ⚠️ {t.complaints} ملاحظة
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">لا يوجد</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Evaluation Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">تقييم الكورس والمحتوى</div>
                        <div className="text-3xl font-extrabold mt-1 text-amber-500 flex items-center gap-1">
                          <span>{feedbackAnalytics.avgCourse}</span>
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">المحتوى: {feedbackAnalytics.avgContent} / 5</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">تقييم المدربين</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-500 flex items-center gap-1">
                          <span>{feedbackAnalytics.avgTrainer}</span>
                          <Star className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">شرح المدرب وتفاعله</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">تقييم المبيعات (Sales)</div>
                        <div className="text-3xl font-extrabold mt-1 text-blue-500 flex items-center gap-1">
                          <span>{feedbackAnalytics.avgSales}</span>
                          <Star className="w-5 h-5 fill-blue-400 text-blue-400" />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">دقة وتفاعل موظف المبيعات</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">تقييم الأكاديمية</div>
                        <div className="text-3xl font-extrabold mt-1 text-purple-500 flex items-center gap-1">
                          <span>{feedbackAnalytics.avgAcademy}</span>
                          <Star className="w-5 h-5 fill-purple-400 text-purple-400" />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">الخدمات والدعم</div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400">إجمالي الردود الاستبيانية</div>
                        <div className="text-3xl font-extrabold mt-1 text-slate-800 dark:text-white">
                          {feedbackAnalytics.totalCount}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {feedbackAnalytics.anonymousCount} منها مجهول الهوية 🕶️
                        </div>
                      </div>
                    </div>

                {/* Sales Performance Summary */}
                {feedbackAnalytics.salesSummary.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-6 space-y-4">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-blue-500" />
                      تقييم أداء موظفي المبيعات (Sales KPI Analysis)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {feedbackAnalytics.salesSummary.map(sales => (
                        <div key={sales.name} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 dark:text-white">{sales.name}</span>
                            <span className="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-extrabold px-2.5 py-1 rounded-full text-xs flex items-center gap-1">
                              ⭐ {sales.avg} / 5
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">عدد التقييمات: {sales.count}</p>
                          {sales.notes.length > 0 && (
                            <div className="text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 italic">
                              "{sales.notes[sales.notes.length - 1]}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search & Action Bar */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="بحث بأسماء الطلاب، المدربين، السيلز، أو التعليقات..."
                      value={evalSearchTerm}
                      onChange={(e) => setEvalSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={exportEvaluationsCSV}
                    disabled={feedbackAnalytics.filteredList.length === 0}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    تصدير التقييمات (CSV)
                  </button>
                </div>

                {/* Detailed Feedback Submissions Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <div className="text-sm font-black text-slate-800 dark:text-slate-200">
                      استبيانات وتقييمات المتدربين المسجلة ({feedbackAnalytics.filteredList.length})
                    </div>
                  </div>

                  {feedbackAnalytics.filteredList.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                      لا توجد استبيانات تقييم مطابقة للفلترة المحددة.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/40 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                            <th className="p-4">المتدرب / الجروب</th>
                            <th className="p-4">تقييم الكورس والمحتوى</th>
                            <th className="p-4">تقييم المدرب الأساسي / آخر</th>
                            <th className="p-4">تقييم السيلز الأكاديمي</th>
                            <th className="p-4">تقييم الأكاديمية</th>
                            <th className="p-4">الملاحظات والاقتراحات</th>
                            <th className="p-4">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {feedbackAnalytics.filteredList.map((f, index) => (
                            <tr key={f.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-bold">
                                <div className="text-slate-900 dark:text-white flex items-center gap-2">
                                  {f.isAnonymous || f.studentId === 'anonymous' ? (
                                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                                      🕶️ مجهول الهوية
                                    </span>
                                  ) : (
                                    <span>{f.studentName || 'متدرب'}</span>
                                  )}
                                </div>
                                <div className="text-xs text-primary-600 dark:text-primary-400 font-normal mt-0.5">
                                  {f.groupName || 'جروب غير محدد'} ({f.courseName || ''})
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-amber-500 flex items-center gap-1">
                                  ⭐ {f.ratingCourse || f.ratingGeneral || 0} / 5
                                </div>
                                <div className="text-xs text-slate-400">
                                  المحتوى: {f.ratingContent || f.ratingContentSuitable || 0} / 5
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {f.primaryTrainerName || f.trainerName || 'المدرب'}: ⭐ {f.ratingTrainer || f.ratingTrainerExplanation || 0}
                                </div>
                                {f.otherTrainerName && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    مدرب آخر ({f.otherTrainerName}): ⭐ {f.otherTrainerRating || 0}
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                {f.salesAgentName ? (
                                  <div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{f.salesAgentName}</span>
                                    <div className="text-xs text-blue-500 font-bold">⭐ {f.ratingSales || 0} / 5</div>
                                    {f.salesNotes && <div className="text-[11px] text-slate-400 italic mt-0.5">"{f.salesNotes}"</div>}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">غير محدد</span>
                                )}
                              </td>
                              <td className="p-4 font-bold text-purple-600 dark:text-purple-400">
                                ⭐ {f.ratingAcademy || f.ratingSupportService || 0} / 5
                              </td>
                              <td className="p-4 max-w-xs">
                                {f.comments ? (
                                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                    "{f.comments}"
                                  </p>
                                ) : (
                                  <span className="text-slate-400 text-xs">لا توجد ملاحظات مدونة</span>
                                )}
                              </td>
                              <td className="p-4 text-xs text-slate-400 dir-ltr text-right">
                                {f.date || 'اليوم'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* CREATE GLOBAL EVALUATION FORM MODAL */}
        {showCreateFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Globe className="w-5 h-5 text-purple-400" />
                  إنشاء استمارة تقييم شاملة جديدة
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateFormModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateGlobalForm} className="p-6 space-y-4 text-right">
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-300">عنوان الاستمارة *</label>
                  <input
                    type="text"
                    required
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="مثال: استمارة تقييم نهاية شهر يوليو الشاملة 📝"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-300">وصف وملاحظات الاستمارة (اختياري)</label>
                  <textarea
                    rows={2}
                    value={newFormDesc}
                    onChange={(e) => setNewFormDesc(e.target.value)}
                    placeholder="اكتب رسالة توجيهية للطلاب عند فتح الاستمارة..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-300">شهر التقييم</label>
                    <input
                      type="month"
                      value={newFormMonth}
                      onChange={(e) => setNewFormMonth(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-300">نطاق الاستمارة</label>
                    <select
                      value={newFormTargetOption}
                      onChange={(e) => setNewFormTargetOption(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none"
                    >
                      <option value="all">كل الجروبات والمجموعات 🌐</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.courseName})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="newFormActiveCheck"
                    checked={newFormIsActive}
                    onChange={(e) => setNewFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="newFormActiveCheck" className="text-xs font-bold text-slate-300 cursor-pointer">
                    تفعيل ونشر الاستمارة فوراً بجميع المجموعات وبوابة الطلاب
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newFormTitle.trim()) {
                        alert("يرجى إدخال عنوان الاستمارة أولاً للمعاينة.");
                        return;
                      }
                      const targetGroupObj = groups.find(g => g.id === newFormTargetOption);
                      setPreviewFormModal({
                        isOpen: true,
                        title: newFormTitle.trim(),
                        description: newFormDesc.trim(),
                        month: newFormMonth,
                        targetGroupName: newFormTargetOption === 'all' ? 'جميع الجروبات والمجموعات' : (targetGroupObj ? `${targetGroupObj.name} (${targetGroupObj.courseName})` : 'جروب محدد'),
                        isActive: newFormIsActive,
                        fromCreationModal: true
                      });
                    }}
                    className="bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 font-bold px-4 py-2.5 rounded-xl text-xs border border-indigo-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-indigo-300" />
                    معاينة الاستمارة 👁️
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateFormModal(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={formSaving}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2"
                    >
                      {formSaving ? 'جاري الحفظ...' : 'حفظ ونشر الاستمارة 🎉'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* FORM PREVIEW MODAL */}
        {previewFormModal && previewFormModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto" dir="rtl">
            <div className="bg-slate-900 border border-purple-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
              {/* Preview Header Banner */}
              <div className="p-4 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border-b border-purple-500/20 flex justify-between items-center">
                <div className="flex items-center gap-2 text-purple-300 font-extrabold text-xs">
                  <Eye className="w-4 h-4 text-purple-400 animate-pulse" />
                  معاينة تجريبية لا شكل الاستمارة كما تظهر للطلاب في البوابة 👁️
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFormModal(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-all cursor-pointer text-xs font-bold"
                >
                  ✕ إغلاق المعاينة
                </button>
              </div>

              {/* Student Portal View Preview Container */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Form Header Card */}
                <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 border border-purple-500/30 rounded-2xl p-5 space-y-2 text-right">
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-purple-500/20 text-purple-300 font-bold text-[10px] px-3 py-1 rounded-full border border-purple-500/30">
                      استمارة تقييم شاملة 📝
                    </span>
                    {previewFormModal.month && (
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                        🗓️ {previewFormModal.month}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-white">{previewFormModal.title || 'عنوان الاستمارة'}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {previewFormModal.description || 'يسعدنا مشاركتك رأيك الشفاف والتقييم الشامل لمساعدتنا في تطوير المحتوى وتكريم الكوادر المتميزة.'}
                  </p>
                </div>

                {/* Simulated Student Evaluation Form Inputs */}
                <div className="space-y-4 text-right">
                  {/* Category 1: Course & Content */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-black text-white">1️⃣ تقييم الكورس والمحتوى التعليمي والتطبيقات 📚</label>
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="text-amber-400 text-lg hover:scale-125 transition-transform cursor-pointer"
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs text-amber-400 font-bold mr-2">(4.8 / 5)</span>
                    </div>
                  </div>

                  {/* Category 2: Trainer Performance */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-black text-white">2️⃣ المُدرب الخاص بمجموعتك 👨‍🏫</label>
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="text-amber-400 text-lg hover:scale-125 transition-transform cursor-pointer"
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs text-amber-400 font-bold mr-2">(5.0 / 5)</span>
                    </div>
                  </div>

                  {/* Category 3: Sales Performance */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-black text-white">3️⃣ سرعة ومصداقية ومتابعة مسؤول المبيعات (Sales) 💼</label>
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="text-amber-400 text-lg hover:scale-125 transition-transform cursor-pointer"
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs text-amber-400 font-bold mr-2">(4.5 / 5)</span>
                    </div>
                  </div>

                  {/* Category 4: Academy Support */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-black text-white">4️⃣ خدمات الأكاديمية والمتابعة والدعم الفني 🏫</label>
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="text-amber-400 text-lg hover:scale-125 transition-transform cursor-pointer"
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs text-amber-400 font-bold mr-2">(4.7 / 5)</span>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-black text-white">5️⃣ اقتراحات أو شكاوى أو ملاحظات إضافية (اختياري) 💬</label>
                    <textarea
                      disabled
                      rows={2}
                      placeholder="هنا يستطيع الطالب كتابة انطباعاته بالتفصيل..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Anonymous Checkbox Mock */}
                  <div className="flex items-center gap-2 bg-purple-950/30 p-3 rounded-xl border border-purple-500/20 text-xs font-bold text-slate-300">
                    <input type="checkbox" defaultChecked disabled className="w-4 h-4 text-purple-600 rounded" />
                    <span>إرسال التقييم بسرية تامة دون إظهار الاسم للمدربين 🕶️</span>
                  </div>

                  {/* Submit Mock Button */}
                  <button
                    disabled
                    type="button"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black py-3.5 rounded-xl text-xs shadow-lg opacity-70 cursor-not-allowed"
                  >
                    إرسال التقييم الشامل (معاينة تجريبية)
                  </button>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  ℹ️ المعاينة توضح التنسيق الذي سيظهر للطالب عند فتح الرابط.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewFormModal(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    إغلاق المعاينة
                  </button>
                  {previewFormModal.fromCreationModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        setPreviewFormModal(null);
                        handleCreateGlobalForm(e as any);
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-2 rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      متابعة نشر الاستمارة الآن 🚀
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Supervisor Audit Modal */}
        {auditModalSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                    مراجعة وتدقيق السوبرفايزر للمحاضرة 👨‍🏫
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    محاضرة {auditModalSession.sessionNumber} - {groups.find(g => g.id === auditModalSession.groupId)?.name || 'الجروب'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    تاريخ المحاضرة: {auditModalSession.date} | المدرب: {auditModalSession.actualTrainerName || 'غير محدد'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditModalSession(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Options */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  حدد حالة توثيق ومراجعة المحاضرة:
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAuditStatusState('checked')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      auditStatusState === 'checked'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <span>✅</span>
                        <span>تم التوثيق والمراجعة (Checked & Verified)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        المحاضرة موثقة بالكامل والتوقيتات والساعات مسجلة بدقة.
                      </div>
                    </div>
                    {auditStatusState === 'checked' && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditStatusState('under_review')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      auditStatusState === 'under_review'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <span>⏳</span>
                        <span>تحت المراجعة والانتظار (Under Review)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        توجد مسألة معطلة للمراجعة حالياً (في انتظار تسليم تسجيل، تأكيد حضور، الخ).
                      </div>
                    </div>
                    {auditStatusState === 'under_review' && <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditStatusState('issue_flagged')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      auditStatusState === 'issue_flagged'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>بيانات غير مضبوطة / محتاجة تعديل (Data Issue)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        توجد خطأ بالبيانات أو الساعات المسجلة من المدرب ويستدعي التعديل.
                      </div>
                    </div>
                    {auditStatusState === 'issue_flagged' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Comment / Reason Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ملاحظات أو أسباب التعطيل / تعديل البيانات { (auditStatusState === 'under_review' || auditStatusState === 'issue_flagged') && <span className="text-rose-500">* (مطلوب)</span> }:
                </label>
                <textarea
                  rows={3}
                  value={auditCommentState}
                  onChange={(e) => setAuditCommentState(e.target.value)}
                  placeholder="اكتب أسباب التعطيل أو توضيح الخطأ ببيانات المحاضرة هنا..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-slate-400">
                  💡 التوضيحات والتعليقات المكتوبة هنا تظل مدونة بسجل المراجعة دائماً لضمان المتابعة والشفافية.
                </p>
              </div>

              {/* History section if exists */}
              {auditModalSession.auditHistory && auditModalSession.auditHistory.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">سجل المراجعات السابقة لهذه المحاضرة:</div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {auditModalSession.auditHistory.map((h, idx) => (
                      <div key={idx} className="text-[11px] bg-slate-100 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                          <span>
                            {h.status === 'checked' ? '✅ تم التوثيق' : h.status === 'under_review' ? '⏳ تحت المراجعة' : '⚠️ بيانات محتاجة تعديل'} 
                            {' '}بواسطة: {h.checkedByName}
                          </span>
                          <span className="text-[9px] text-slate-400">{h.checkedAt}</span>
                        </div>
                        {h.comment && <div className="text-slate-600 dark:text-slate-300 mt-1">💬 {h.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAuditModalSession(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveAudit}
                  disabled={auditSaving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {auditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>حفظ توثيق السوبرفايزر</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Supervisor Edit Time Modal */}
        {editTimeModalSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    تعديل توقيت المحاضرة وساعاتها للسوبرفايزر ⏱️
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    محاضرة {editTimeModalSession.sessionNumber} - {groups.find(g => g.id === editTimeModalSession.groupId)?.name || 'الجروب'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    تاريخ المحاضرة: {editTimeModalSession.date} | المدرب: {editTimeModalSession.actualTrainerName || 'غير محدد'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTimeModalSession(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 12-Hour Time Inputs Grid */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                
                {/* Start Time Control */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      ⏰ بداية المحاضرة (نظام 12 ساعة):
                    </label>
                    <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      {previewTimeMetrics ? previewTimeMetrics.startTimeArabic : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 dir-ltr">
                    {/* Hour */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الساعة</span>
                      <select
                        value={editStartHour}
                        onChange={(e) => setEditStartHour(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                      >
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    {/* Minute */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الدقيقة</span>
                      <select
                        value={editStartMin}
                        onChange={(e) => setEditStartMin(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                      >
                        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    {/* Period Toggle */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الفترة</span>
                      <div className="grid grid-cols-2 gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl h-[38px] items-center">
                        <button
                          type="button"
                          onClick={() => setEditStartPeriod('PM')}
                          className={`h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                            editStartPeriod === 'PM'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          مساءً
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditStartPeriod('AM')}
                          className={`h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                            editStartPeriod === 'AM'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          صباحاً
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* End Time Control */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🏁 نهاية المحاضرة (نظام 12 ساعة):
                    </label>
                    <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      {previewTimeMetrics ? previewTimeMetrics.endTimeArabic : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 dir-ltr">
                    {/* Hour */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الساعة</span>
                      <select
                        value={editEndHour}
                        onChange={(e) => setEditEndHour(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                      >
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    {/* Minute */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الدقيقة</span>
                      <select
                        value={editEndMin}
                        onChange={(e) => setEditEndMin(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                      >
                        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    {/* Period Toggle */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 mb-0.5 dir-rtl">الفترة</span>
                      <div className="grid grid-cols-2 gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl h-[38px] items-center">
                        <button
                          type="button"
                          onClick={() => setEditEndPeriod('PM')}
                          className={`h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                            editEndPeriod === 'PM'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          مساءً
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditEndPeriod('AM')}
                          className={`h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                            editEndPeriod === 'AM'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          صباحاً
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Live Preview Box */}
              {previewTimeMetrics && (
                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold border-b border-indigo-200/50 dark:border-indigo-800/50 pb-2">
                    <span>⏱️ النطاق الزمني للمحاضرة:</span>
                    <span className="text-indigo-900 dark:text-indigo-200 font-black">
                      من {previewTimeMetrics.startTimeArabic} إلى {previewTimeMetrics.endTimeArabic}
                    </span>
                  </div>
                  <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                    <span>⏱️ المدة الفعلية المحسوبة:</span>
                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                      {previewTimeMetrics.actualHours} ساعة ({previewTimeMetrics.durationMins} دقيقة)
                    </span>
                  </div>
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between border-t border-indigo-200/60 dark:border-indigo-800/60 pt-2">
                    <span>💰 الساعات المعتمدة للراتب (مع السقف):</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {previewTimeMetrics.approvedHours} ساعة معتمدة
                    </span>
                  </div>
                  {hourlyRate > 0 && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 text-left dir-ltr font-mono">
                      مستحق المحاضرة = {previewTimeMetrics.approvedHours} ساعة × {hourlyRate} ج.م = {(previewTimeMetrics.approvedHours * hourlyRate).toFixed(0)} ج.م
                    </div>
                  )}
                </div>
              )}

              {/* Reason / Note Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  سبب تعديل الوقت والملاحظات <span className="text-rose-500">* (مطلوب للشفافية والتدقيق)</span>:
                </label>
                <textarea
                  rows={3}
                  value={editTimeReasonState}
                  onChange={(e) => setEditTimeReasonState(e.target.value)}
                  placeholder="مثال: تصحيح وقت الحضور الفعلي للمدرب ومنع التلاعب بالساعات المسجلة يدوياً..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400">
                  💡 سيتم حفظ اسم السوبرفايزر والتاريخ والوقت تلقائياً مع السبب لضمان مرجعية عملية التعديل.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditTimeModalSession(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveTimeOverride}
                  disabled={editTimeSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {editTimeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>حفظ وتطبيق التوقيت الجديد 💾</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TrainerKPIs;
