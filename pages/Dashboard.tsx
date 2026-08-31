import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Group, Student, Course, StudentFollowUp, LectureEvaluation, Session, FollowUpMention } from '../types';
import { subscribeToCollection, submitTrainerFollowUpUpdate, markFollowUpMentionDone } from '../services/firestore';
import Layout from '../components/Layout';
import StudentStatusModal from '../components/StudentStatusModal';
import { formatTime12h } from '../utils';
import { 
  Award, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Send, 
  UserCheck, 
  Activity, 
  Users, 
  BookOpen,
  Check, 
  Loader2,
  TrendingUp,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  Search,
  UserX,
  Sparkles
} from 'lucide-react';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    groups: 0,
    students: 0,
    courses: 0
  });

  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allFollowUps, setAllFollowUps] = useState<StudentFollowUp[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<LectureEvaluation[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [allMentions, setAllMentions] = useState<FollowUpMention[]>([]);
  const [weekPivot, setWeekPivot] = useState<Date>(() => new Date());
  
  // States of loading / UI interaction
  const [quickNotes, setQuickNotes] = useState<{ [followUpId: string]: string }>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Deactivated students section states
  const [deactivatedTab, setDeactivatedTab] = useState<'all' | 'unpaid_50_percent' | 'installment_delinquency' | 'permanent_suspension' | 'other'>('all');
  const [deactivatedSearch, setDeactivatedSearch] = useState('');
  const [selectedStudentForStatusModal, setSelectedStudentForStatusModal] = useState<Student | null>(null);

  useEffect(() => {
    const unsubGStats = subscribeToCollection<Group>('groups', (data) => {
      setAllGroups(data);
      setStats(s => ({ ...s, groups: data.filter(g => !g.archived).length }));
    });
    const unsubSStats = subscribeToCollection<Student>('students', (data) => {
      setAllStudents(data);
      setStats(s => ({ ...s, students: data.length }));
    });
    const unsubCStats = subscribeToCollection<Course>('courses', (data) => {
      setStats(s => ({ ...s, courses: data.length }));
    });
    const unsubFollowUps = subscribeToCollection<StudentFollowUp>('studentFollowUps', (data) => {
      setAllFollowUps(data);
    });
    const unsubEvals = subscribeToCollection<LectureEvaluation>('lectureEvaluations', (data) => {
      setAllEvaluations(data);
    });
    const unsubUsers = subscribeToCollection<any>('users', (data) => {
      setAllUsers(data);
    });
    const unsubSessions = subscribeToCollection<Session>('sessions', (data) => {
      setAllSessions(data);
    });
    const unsubMentions = subscribeToCollection<FollowUpMention>('followUpMentions', (data) => {
      setAllMentions(data);
    });

    return () => {
      unsubGStats();
      unsubSStats();
      unsubCStats();
      unsubFollowUps();
      unsubEvals();
      unsubUsers();
      unsubSessions();
      unsubMentions();
    };
  }, []);

  // My pending follow-up tasks — driven by the independent per-person mentions
  // collection, not a single overwritable mentionedUserId field. A deactivated
  // student's follow-up is frozen and excluded here.
  const todayStr = new Date().toISOString().split('T')[0];
  const myPendingMentions = useMemo(() => {
    return allMentions.filter(m => {
      if (m.mentionedUserId !== user.uid) return false;
      if (m.status !== 'pending') return false;
      if (m.snoozedUntil && m.snoozedUntil > todayStr) return false;
      const student = allStudents.find(s => s.id === m.studentId);
      if (student?.deactivated) return false;
      return true;
    });
  }, [allMentions, allStudents, user.uid, todayStr]);

  const myPendingFollowUps = useMemo(() => {
    return myPendingMentions
      .map(m => allFollowUps.find(f => f.id === m.followUpId))
      .filter((f): f is StudentFollowUp => !!f && f.status === 'active');
  }, [myPendingMentions, allFollowUps]);

  const handleMarkMentionDoneFromDashboard = async (followUpId: string) => {
    const mention = myPendingMentions.find(m => m.followUpId === followUpId);
    if (mention) {
      await markFollowUpMentionDone(mention.id, user);
    }
  };

  // Handle submitting a quick update/note
  const handleQuickUpdateSubmit = async (f: StudentFollowUp, customNote?: string) => {
    const noteText = customNote || quickNotes[f.id]?.trim();
    if (!noteText) return;

    setSubmittingId(f.id);
    try {
      await submitTrainerFollowUpUpdate(f.groupId, f.studentId, noteText, user);
      await handleMarkMentionDoneFromDashboard(f.id);
      // Clear local text state
      setQuickNotes(prev => {
        const copy = { ...prev };
        delete copy[f.id];
        return copy;
      });
    } catch (err: any) {
      alert("حدث خطأ أثناء إرسال التحديث: " + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  // Calculate detailed group health status index
  const groupPerformanceList = useMemo(() => {
    return allGroups
      .filter(g => !g.archived)
      .map(group => {
        const groupStudents = allStudents.filter(s => s.groupId === group.id);
        const groupEvals = allEvaluations.filter(e => e.groupId === group.id);
        
        // Attendance
        const totalEvaluationsCount = groupEvals.filter(e => e.attendance !== undefined).length;
        const totalPresent = groupEvals.filter(e => e.attendance === 1).length;
        const attendancePercentage = totalEvaluationsCount > 0 
          ? Math.round((totalPresent / totalEvaluationsCount) * 100) 
          : 100;

        // Tasks
        const totalTasksDelivered = groupEvals.filter(e => e.taskDelivered > 0).length;
        const taskCompletionPercentage = totalEvaluationsCount > 0
          ? Math.round((totalTasksDelivered / totalEvaluationsCount) * 100)
          : 100;

        // Active Follow-ups count in this group
        const groupActiveFollowUpsCount = allFollowUps.filter(f => f.groupId === group.id && f.status === 'active').length;

        // Cumulative health score
        // Base score is avg of attendance & task delivery, depleted slightly by unresolved issues count
        const baseScore = Math.round((attendancePercentage + taskCompletionPercentage) / 2);
        const penalty = groupActiveFollowUpsCount * 6; // each unresolved followup reduces group score by 6%
        const healthScore = Math.max(15, Math.min(100, baseScore - penalty));

        let statusText = 'أداء ممتاز 🟢';
        let statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        let barColor = 'bg-emerald-500 shadow-emerald-500/20';

        if (healthScore < 60) {
          statusText = 'أداء يحتاج رعاية عاجلة 🔴';
          statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
          barColor = 'bg-rose-500 shadow-rose-500/20';
        } else if (healthScore < 85) {
          statusText = 'مستوى جيد / رعاية متوسطة 🟡';
          statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
          barColor = 'bg-amber-500 shadow-amber-500/20';
        }

        const activeCount = groupStudents.filter(s => !s.deactivated && s.is50PercentPaid !== false).length;
        const deactivatedCount = groupStudents.filter(s => s.deactivated || s.is50PercentPaid === false).length;

        return {
          ...group,
          studentCount: groupStudents.length,
          activeCount,
          deactivatedCount,
          attendanceRate: attendancePercentage,
          taskRate: taskCompletionPercentage,
          activeIssues: groupActiveFollowUpsCount,
          healthScore,
          statusText,
          statusColor,
          barColor
        };
      })
      .sort((a, b) => a.healthScore - b.healthScore);
  }, [allGroups, allStudents, allEvaluations, allFollowUps]);

  const deactivatedStudentsList = useMemo(() => {
    return allStudents.filter(s => s.deactivated || s.is50PercentPaid === false);
  }, [allStudents]);

  const permanentSuspensionList = useMemo(() => {
    return deactivatedStudentsList.filter(s => s.deactivationReasonCategory === 'permanent_suspension' || s.permanentDeactivation === true);
  }, [deactivatedStudentsList]);

  const unpaid50List = useMemo(() => {
    return deactivatedStudentsList.filter(s => 
      !s.permanentDeactivation && 
      s.deactivationReasonCategory !== 'permanent_suspension' &&
      (s.deactivationReasonCategory === 'unpaid_50_percent' || (s.is50PercentPaid === false && !s.deactivationReasonCategory))
    );
  }, [deactivatedStudentsList]);

  const installmentList = useMemo(() => {
    return deactivatedStudentsList.filter(s => 
      !s.permanentDeactivation && 
      s.deactivationReasonCategory === 'installment_delinquency'
    );
  }, [deactivatedStudentsList]);

  const otherDeactivatedList = useMemo(() => {
    return deactivatedStudentsList.filter(s => 
      !s.permanentDeactivation && 
      s.deactivationReasonCategory !== 'permanent_suspension' &&
      (s.deactivationReasonCategory === 'other' || (!s.deactivationReasonCategory && s.is50PercentPaid !== false))
    );
  }, [deactivatedStudentsList]);

  const filteredDeactivatedStudents = useMemo(() => {
    let list = deactivatedStudentsList;
    if (deactivatedTab === 'unpaid_50_percent') list = unpaid50List;
    else if (deactivatedTab === 'installment_delinquency') list = installmentList;
    else if (deactivatedTab === 'permanent_suspension') list = permanentSuspensionList;
    else if (deactivatedTab === 'other') list = otherDeactivatedList;

    if (!deactivatedSearch.trim()) return list;

    const q = deactivatedSearch.trim().toLowerCase();
    return list.filter(s => {
      const matchName = s.name?.toLowerCase().includes(q);
      const matchPhone = s.phone?.includes(q);
      const matchId = s.studentIdNum?.toLowerCase().includes(q);
      return matchName || matchPhone || matchId;
    });
  }, [deactivatedStudentsList, unpaid50List, installmentList, permanentSuspensionList, otherDeactivatedList, deactivatedTab, deactivatedSearch]);

  const isDashboardAdmin = ['admin', 'coordinator', 'supervisor'].includes(user.role);

  const getCairoDate = (date: Date) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric', month: 'numeric', day: 'numeric'
      });
      const parts = formatter.formatToParts(date);
      const y = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
      const m = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
      const d = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
      return new Date(y, m - 1, d);
    } catch {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
  };

  const getFridayOfChosenWeek = (pivot: Date) => {
    const date = getCairoDate(pivot);
    const day = date.getDay(); // 0 Sunday, 5 Friday, 6 Saturday
    const diff = day >= 5 ? 5 - day : -2 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  const weekDays = useMemo(() => {
    const friday = getFridayOfChosenWeek(weekPivot);
    const days = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(friday);
      d.setDate(friday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekPivot]);

  const formatDateISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getArabicDayName = (d: Date) => {
    const names = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return names[d.getDay()];
  };

  const weekRangeText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    return `الأسبوع من: ${start.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric', year: 'numeric' })} إلى: ${end.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }, [weekDays]);

  const activeGroupsNow = useMemo(() => {
    return allGroups.filter(g => {
      if (g.archived) return false;
      const runningSession = allSessions.find(s => s.groupId === g.id && s.smartAssistantState && s.smartAssistantState !== 'idle');
      return !!runningSession;
    }).map(g => {
      const runningSession = allSessions.find(s => s.groupId === g.id && s.smartAssistantState && s.smartAssistantState !== 'idle')!;
      const trainerId = runningSession.actualTrainerId || g.trainerId;
      const trainer = allUsers.find(u => u.uid === trainerId);
      return {
        group: g,
        session: runningSession,
        trainerName: trainer?.name || g.trainerName || 'غير حدد'
      };
    });
  }, [allGroups, allSessions, allUsers]);

  const calendarSessionsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    weekDays.forEach(day => {
      const dateStr = formatDateISO(day);
      map[dateStr] = [];
    });

    allSessions.forEach(session => {
      if (!map[session.date]) return; // Not in this week's range
      const group = allGroups.find(g => g.id === session.groupId);
      if (!group || group.archived) return; // Group is deleted or archived
      
      const trainerId = session.actualTrainerId || group.trainerId;
      const trainer = allUsers.find(u => u.uid === trainerId);
      if (trainer && trainer.deactivated) return; // Exclude deactivated users!

      map[session.date].push({
        session,
        group,
        trainer: trainer || { name: group.trainerName || 'غير محدد' }
      });
    });

    // Sort sessions in each day by their group's sessionTime
    Object.keys(map).forEach(dateStr => {
      map[dateStr].sort((a, b) => {
        const timeA = a.group.sessionTime || '';
        const timeB = b.group.sessionTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [weekDays, allSessions, allGroups, allUsers]);

  const handlePrevWeek = () => {
    setWeekPivot(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekPivot(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setWeekPivot(new Date());
  };

  return (
    <Layout user={user}>
      <div dir="rtl" className="space-y-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6" dir="rtl">
          <div className="text-right">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2 flex items-center justify-start gap-3">
              <span>لوحة التحكم والمتابعة الرئيسية</span>
              <span className="text-xs bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 font-bold px-3 py-1 rounded-full border border-indigo-500/20">Saber Academy System</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">متابعة المحاضرات الجارية، جدول الأسبوع، إحصائيات المجموعات، وإدارة الطلاب الموقوفين والمجمدين.</p>
          </div>
        </div>

        {/* Main Stats Counters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" dir="rtl">
          {[
            { icon: '🏢', value: stats.groups, label: 'مجموعات نشطة حالياً', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/15 dark:text-indigo-400 dark:border-indigo-900/30' },
            { icon: '🎓', value: stats.students, label: 'إجمالي الطلاب المسجلين', color: 'bg-primary-50 text-primary-600 border-primary-100 dark:bg-primary-900/15 dark:text-primary-400 dark:border-primary-900/30' },
            { icon: '🟢', value: allStudents.filter(s => !s.deactivated && s.is50PercentPaid !== false).length, label: 'الطلاب النشطين', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/15 dark:text-emerald-400 dark:border-emerald-900/30' },
            { icon: '🔴', value: deactivatedStudentsList.length, label: 'الطلاب الموقوفين / المجمدين', color: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/15 dark:text-rose-400 dark:border-rose-900/30' }
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-200 dark:border-slate-850 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
              <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-xl mb-3 border transition-transform group-hover:scale-105 duration-300`}>
                {stat.icon}
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tighter font-sans">{stat.value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-black">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* 1. Summary of currently active groups */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-[2.5rem] shadow-sm font-arabic text-right">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-start gap-2 mb-6">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            <span>المحاضرات الجارية والنشطة حالياً ⏱️</span>
            <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-bold">متابعة حية</span>
          </h2>

          {activeGroupsNow.length === 0 ? (
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 p-6 rounded-[2rem] text-center">
              <p className="text-xs text-slate-400 font-bold italic">لا توجد أي محاضرات جارية في هذه اللحظة. ☕</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGroupsNow.map(({ group, session, trainerName }) => (
                <div 
                  key={group.id} 
                  onClick={() => navigate(`/groups/${group.id}?sessionId=${session.id}`)}
                  className="bg-slate-950 border border-red-500/20 p-5 rounded-[2rem] shadow-xl hover:border-red-500/40 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse">
                      ● جارية الآن
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">محاضرة #{session.sessionNumber}</span>
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-red-400 transition-colors">🏫 {group.name}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">الكورس: {group.courseName}</p>
                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-300 font-bold">
                    <span>المدرب: {trainerName}</span>
                    <span>البدء: {session.startTimeActual ? formatTime12h(session.startTimeActual) : 'غير محدد'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Calendar View */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2.5rem] p-6 shadow-sm font-arabic text-right">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📅 جدول المحاضرات الأسبوعي</span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-black px-2.5 py-0.5 rounded-full">من الجمعة إلى الجمعة</span>
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">{weekRangeText}</p>
            </div>

            <div className="flex items-center gap-2" dir="ltr">
              <button 
                onClick={handlePrevWeek}
                className="bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                ◀ الأسبوع السابق
              </button>
              <button 
                onClick={handleCurrentWeek}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                الأسبوع الحالي 📅
              </button>
              <button 
                onClick={handleNextWeek}
                className="bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                الأسبوع التالي ▶
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {weekDays.map(day => {
              const dateStr = formatDateISO(day);
              const daySessions = calendarSessionsByDay[dateStr] || [];
              const dayName = getArabicDayName(day);
              const isToday = formatDateISO(new Date()) === dateStr;

              return (
                <div 
                  key={dateStr}
                  className={`p-5 rounded-[2rem] border transition-all ${
                    isToday 
                      ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                      : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-150 dark:border-slate-850'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                    <span className="font-black text-slate-900 dark:text-white text-sm">{dayName}</span>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">{day.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })}</span>
                  </div>

                  <div className="space-y-3 min-h-[120px] max-h-[300px] overflow-y-auto no-scrollbar">
                    {daySessions.length === 0 ? (
                      <div className="flex items-center justify-center h-[120px]">
                        <span className="text-[11px] text-slate-400 italic font-medium">لا توجد محاضرات ☕</span>
                      </div>
                    ) : (
                      daySessions.map(({ session, group, trainer }) => {
                        const isSessionRunning = session.smartAssistantState && session.smartAssistantState !== 'idle';
                        const isSessionDone = session.status === 'done';

                        let cardBg = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
                        let badgeStyle = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                        let badgeText = 'قادمة 📅';

                        if (isSessionRunning) {
                          cardBg = 'bg-red-500/5 border-red-500/30 shadow-md shadow-red-500/5 hover:border-red-400';
                          badgeStyle = 'bg-red-500 text-white border-red-400 animate-pulse';
                          badgeText = 'جارية 🔴';
                        } else if (isSessionDone) {
                          cardBg = 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40';
                          badgeStyle = 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/20';
                          badgeText = 'مكتملة ✓';
                        } else {
                          cardBg = 'bg-indigo-500/5 border-indigo-500/15 hover:border-indigo-500/35';
                          badgeStyle = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                        }

                        return (
                          <div 
                            key={session.id}
                            onClick={() => navigate(`/groups/${group.id}?sessionId=${session.id}`)}
                            className={`p-3 rounded-2xl border ${cardBg} transition-all cursor-pointer group text-right flex flex-col gap-1`}
                          >
                            <div className="flex justify-between items-center">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                                {badgeText}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold">محاضرة #{session.sessionNumber}</span>
                            </div>

                            <h4 className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors mt-1">
                              🏫 {group.name}
                            </h4>

                            <p className="text-[10px] text-slate-400 font-bold truncate">الكورس: {group.courseName}</p>

                            <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-extrabold border-t border-slate-100 dark:border-slate-800/50 pt-1.5 mt-1">
                              <span>المدرب: {trainer.name}</span>
                              <span className="font-mono">{formatTime12h(group.sessionTime)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Welcome Hero Banner */}
          <div className="bg-slate-950 rounded-[35px] p-10 text-white relative overflow-hidden shadow-2xl mb-12" dir="rtl">
            <div className="relative z-10 text-right">
              <div className="inline-block px-3.5 py-1 rounded-full bg-primary-600/30 border border-primary-500/40 text-[10px] font-black uppercase tracking-widest text-primary-400 mb-4 font-sans">
                SYSTEM ONLINE • Realtime Connected
              </div>
              <h2 className="text-3xl font-black tracking-tighter mb-3">مرحباً بك مجدداً، أستاذ {user.name}! 👋</h2>
              <p className="text-slate-400 max-w-xl mb-8 text-base leading-relaxed font-bold">
                أنت مسجل حالياً بصلاحية <span className="text-primary-400 font-black capitalize">[{user.role === 'admin' ? 'مدير عام / أدمن' : user.role === 'coordinator' ? 'منسق عام' : 'مُدرّب مادة'}]</span>. 
                يرجى مراجعة المجموعات ومتابعة الطلاب المعلقين والرد على الإشارات الموجهة إليك لتسريع مستوى الخدمة الأكاديمية بالأكاديمية.
              </p>
            </div>
            {/* Background visual shapes */}
            <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-indigo-600/15 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary-600/10 blur-[80px] rounded-full translate-x-1/4 translate-y-1/4"></div>
          </div>

          {/* Interactive Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12" dir="rtl">
            
            {/* RIGHT COLUMN: Trainer Pending Follow-Ups Check List */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center justify-between pb-1 text-right">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🔔 متابعاتي المعلقة والنشطة</span>
                    {myPendingFollowUps.length > 0 && (
                      <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full font-sans animate-pulse">
                        {myPendingFollowUps.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">المتابعات الموجهة إليك شخصياً بالمنشن والتي تتطلب منك إجراء تحديث فوري وسريع للتواصل.</p>
                </div>
              </div>

              {myPendingFollowUps.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] p-10 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center text-3xl font-bold">
                    ✓
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-200">الطلاب بأمان وبخير بالكامل! 🎉</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400 max-w-sm font-bold leading-relaxed">
                    لا توجد أي متابعات أو مشاكل معلقة موجهة إليك بشكل خاص في الوقت الحالي. سيظهر الإشعار والتفاصيل فور حدوث أي غياب أو طلب متابعة مخصص.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myPendingFollowUps.map(f => {
                    const isItemSubmitting = submittingId === f.id;
                    return (
                      <div 
                        key={f.id} 
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 text-right duration-250 hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        {/* Header info */}
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <span className="text-[10px] font-black tracking-widest bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 px-2.5 py-1 rounded-lg">
                              🏫 {f.groupName}
                            </span>
                            <h4 className="text-base font-black text-slate-900 dark:text-white mt-2 leading-tight">
                              👤 {f.studentName}
                            </h4>
                          </div>

                          {/* Urgency Color Status Indicator */}
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                            f.colorStatus === 'red' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            f.colorStatus === 'yellow' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            f.colorStatus === 'purple' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {f.colorStatus === 'red' ? '⚠️ حالة خطرة/عاجلة' : f.colorStatus === 'yellow' ? '⚠️ تنبيه متوسط' : f.colorStatus === 'purple' ? '🕒 في انتظار التأكيد' : 'متابعة عادية'}
                          </span>
                        </div>

                        {/* Active labels */}
                        {f.labels && f.labels.filter(l => l !== 'system_sug').length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {f.labels.filter(l => l !== 'system_sug').map((lbl, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800 px-2 py-0.5 rounded-lg text-[9px] font-extrabold font-sans uppercase tracking-wider"
                              >
                                #{lbl === 'absence' ? 'غياب متكرر 🛑' : lbl === 'tasks' ? 'تأخر بالمهام 📝' : lbl}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Deadline or Supervisor Order note */}
                        {f.supervisorOrder && (
                          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 text-xs">
                            <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400 font-bold">
                              <span>بأمر من المشرف المنسق: {f.supervisorOrder.requestedByName}</span>
                              <span>الموعد النهائي: {f.supervisorOrder.deadline}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-350 font-semibold leading-relaxed">
                              📌 {f.supervisorOrder.note}
                            </p>
                          </div>
                        )}

                        {/* Latest comments from administrators */}
                        {f.comments && f.comments.length > 0 && (
                          <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-850 pt-3">
                            <span className="text-[10px] text-slate-400 font-black block">آخر التعليقات والملاحظات:</span>
                            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-h-16 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100/30">
                              {f.comments.slice(-2).map((comment, idx) => (
                                <div key={idx} className="pb-1 border-b border-dashed border-slate-100 dark:border-slate-850/50 last:border-0 last:pb-0">
                                  <span className="font-extrabold text-slate-500 dark:text-slate-300">{comment.createdByName} [{comment.createdByRole}]:</span> {comment.text}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* QUICK ACTION PANEL TO REMOVE FROM DASHBOARD SHORTCUT */}
                        <div className="border-t border-slate-150 dark:border-slate-800 pt-4 space-y-3">
                          <span className="text-[10px] font-black text-slate-400 mt-1 block">⚡ تحديث فوري للمتابعة (أضف تحديثاً وسيتم إخفائها من لوحة التحكم فوراً):</span>
                          
                          {/* Short cut fast buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isItemSubmitting}
                              onClick={() => handleQuickUpdateSubmit(f, "📞 تم الاتصال الهاتفي بالطالب ووليد أمره لحل العقبة وتنبيهه لحضور الجلسات القادمة وتسليم المهام المتبقية.")}
                              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold text-[10.5px] rounded-xl flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                              <span>تم الإتصال تليفونياً 📞</span>
                            </button>
                            <button
                              type="button"
                              disabled={isItemSubmitting}
                              onClick={() => handleQuickUpdateSubmit(f, "💬 تم إرسال رسالة تحذيرية وتوفير الدعم المناسب للطالب على واتساب لسرعة تلافي غيابه وتقصيره.")}
                              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold text-[10.5px] rounded-xl flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                              <span>تم التواصل واتساب 💬</span>
                            </button>
                          </div>

                          {/* Custom update note input */}
                          <div className="flex gap-2">
                            <textarea
                              rows={1}
                              disabled={isItemSubmitting}
                              value={quickNotes[f.id] || ''}
                              onChange={(e) => setQuickNotes(prev => ({ ...prev, [f.id]: e.target.value }))}
                              placeholder="اكتب ملاحظة تحديث المتابعة اليدوية هنا..."
                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200"
                            />
                            <button
                              type="button"
                              disabled={isItemSubmitting || !quickNotes[f.id]?.trim()}
                              onClick={() => handleQuickUpdateSubmit(f)}
                              className="bg-indigo-600 text-white hover:bg-indigo-700 font-black text-xs px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="حفظ التحديث وإنهاء المهمة"
                            >
                              {isItemSubmitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Send size={12} stopColor='white' />
                                  <span>حفظ 💾</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* LEFT COLUMN: Groups Performance Statistics */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center justify-between pb-1 text-right">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📈 أداء ومستويات تفاعل المجموعات</span>
                    <TrendingUp size={18} className="text-emerald-500" />
                  </h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">ترتيب وإحصائيات أداء المجموعات النشطة تلقائياً حسب حضور الطلاب وتسليم التكليفات المفروضة.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[35px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                
                <div className="space-y-4">
                  {groupPerformanceList.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-6">لا توجد دفعات أو مجموعات نشطة لعرض إحصائياتها حالياً.</p>
                  ) : (
                    groupPerformanceList.map((g) => (
                      <div 
                        key={g.id} 
                        className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-right"
                      >
                        {/* Header: title, course and status */}
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                              🏫 {g.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">المنسق / كورس مادة: {g.courseName}</span>
                          </div>

                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${g.statusColor}`}>
                            {g.statusText}
                          </span>
                        </div>

                        {/* Progress Bar Metrics */}
                        <div className="space-y-1 mt-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pb-1">
                            <span>مؤشر السلامة ومستوى التفاعل العام:</span>
                            <span className="font-extrabold font-sans text-indigo-500">{g.healthScore}%</span>
                          </div>
                          <div className="w-full bg-slate-250 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 shadow-sm ${g.barColor}`} 
                              style={{ width: `${g.healthScore}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Mini Pills Metrics Detail */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-850/65">
                          {/* Students Count */}
                          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-1 rounded-xl flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-extrabold">
                            <Users size={11} className="text-indigo-500" />
                            <span>الطلاب: {g.studentCount}</span>
                            <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">🟢 {g.activeCount} نشط</span>
                            {g.deactivatedCount > 0 && (
                              <span className="text-[9px] text-rose-500 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">🔴 {g.deactivatedCount} موقوف</span>
                            )}
                          </div>

                          {/* Attendance Rate */}
                          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-1 rounded-xl flex items-center gap-1.5 text-[10px] font-extrabold">
                            <UserCheck size={11} className="text-emerald-500" />
                            <span className="text-slate-500 dark:text-slate-400">الحضور: </span>
                            <span className={g.attendanceRate >= 80 ? 'text-emerald-500' : g.attendanceRate >= 50 ? 'text-amber-500' : 'text-rose-500'}>
                              {g.attendanceRate}%
                            </span>
                          </div>

                          {/* Tasks Delivery Rate */}
                          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-1 rounded-xl flex items-center gap-1.5 text-[10px] font-extrabold">
                            <BookOpen size={11} className="text-primary-500" />
                            <span className="text-slate-500 dark:text-slate-400">المهام: </span>
                            <span className={g.taskRate >= 80 ? 'text-emerald-500' : g.taskRate >= 50 ? 'text-amber-500' : 'text-rose-500'}>
                              {g.taskRate}%
                            </span>
                          </div>

                          {/* Active problems count */}
                          <div className={`px-3 py-1 rounded-xl flex items-center gap-1.5 text-[10px] font-extrabold border ${
                            g.activeIssues > 0 
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse' 
                              : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            <AlertTriangle size={11} />
                            <span>متابعات حرجة: {g.activeIssues}</span>
                          </div>
                        </div>

                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* 4. Deactivated Students & Suspension Category Management Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[35px] p-6 shadow-sm space-y-6 text-right font-arabic">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-start gap-2">
                  <ShieldAlert className="w-6 h-6 text-rose-500" />
                  <span>لوحة إدارة الطلاب الموقوفين والمجمدين 🛑</span>
                  <span className="text-[10px] bg-rose-500/10 text-rose-500 font-bold px-2.5 py-0.5 rounded-full border border-rose-500/20">
                    {deactivatedStudentsList.length} طالب موقوف
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-bold mt-1">تتبع الطلاب الموقوفين وتصنيف الأسباب وإمكانية إعادة التفعيل المباشر فور استكمال الشروط.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  value={deactivatedSearch}
                  onChange={(e) => setDeactivatedSearch(e.target.value)}
                  placeholder="بحث باسم الطالب أو ID أو الهاتف..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 pl-9 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Classification Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDeactivatedTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  deactivatedTab === 'all'
                    ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                }`}
              >
                الكل ({deactivatedStudentsList.length})
              </button>

              <button
                onClick={() => setDeactivatedTab('unpaid_50_percent')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  deactivatedTab === 'unpaid_50_percent'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                }`}
              >
                ⚠️ لعدم استكمال 50% ({unpaid50List.length})
              </button>

              <button
                onClick={() => setDeactivatedTab('installment_delinquency')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  deactivatedTab === 'installment_delinquency'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                }`}
              >
                💳 عدم الانتظام بالأقساط ({installmentList.length})
              </button>

              <button
                onClick={() => setDeactivatedTab('permanent_suspension')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  deactivatedTab === 'permanent_suspension'
                    ? 'bg-red-700 text-white shadow-lg shadow-red-700/30'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                }`}
              >
                🚫 إيقاف نهائي ({permanentSuspensionList.length})
              </button>

              <button
                onClick={() => setDeactivatedTab('other')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  deactivatedTab === 'other'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                }`}
              >
                📌 أسباب أخرى ({otherDeactivatedList.length})
              </button>
            </div>

            {/* Students List Grid */}
            {filteredDeactivatedStudents.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center">
                <p className="text-xs text-slate-400 font-bold italic">لا يوجد أي طلاب موقوفين ينطبق عليهم هذا التصنيف حالياً. 🎉</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDeactivatedStudents.map(student => {
                  const studentGroup = allGroups.find(g => g.id === student.groupId);
                  const isPerm = student.deactivationReasonCategory === 'permanent_suspension' || student.permanentDeactivation;
                  const cat = student.deactivationReasonCategory || (student.is50PercentPaid === false ? 'unpaid_50_percent' : 'other');

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-2xl transition-all flex flex-col justify-between space-y-3 border ${
                        isPerm
                          ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                          : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">
                              🎓 {student.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                              ID: {student.studentIdNum || 'غير محدد'} • 📱 {student.phone}
                            </span>
                          </div>

                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${
                            isPerm
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : cat === 'unpaid_50_percent'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : cat === 'installment_delinquency'
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                              : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                          }`}>
                            {isPerm ? '🚫 إيقاف نهائي' : cat === 'unpaid_50_percent' ? 'لم يستكمل 50%' : cat === 'installment_delinquency' ? 'تعثر أقساط' : 'سبب آخر'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                          <span className="text-slate-400 block text-[9px]">المجموعة:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-black">{studentGroup?.name || 'غير محددة'} ({studentGroup?.courseName || 'كورس'})</span>
                        </div>

                        {student.deactivationReason && (
                          <p className="text-[10px] text-rose-400 font-bold bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 line-clamp-2">
                            📝 {student.deactivationReason}
                          </p>
                        )}
                      </div>

                      {/* Reactivate Button */}
                      <button
                        onClick={() => setSelectedStudentForStatusModal(student)}
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>إعادة تفعيل الحساب / تغيير الحالة</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Student Status Modal inside Dashboard */}
          {selectedStudentForStatusModal && (
            <StudentStatusModal
              isOpen={!!selectedStudentForStatusModal}
              onClose={() => setSelectedStudentForStatusModal(null)}
              student={selectedStudentForStatusModal}
              user={user}
              onSuccess={() => {
                setSelectedStudentForStatusModal(null);
              }}
            />
          )}

        </div>
    </Layout>
  );
};

export default Dashboard;
