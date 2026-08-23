import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Student, LectureEvaluation, StudentWeaknessPoint, Penalty, StudentFollowUp } from '../types';
import { Clock, FileText, Target, AlertTriangle, MessageSquare, CheckCircle, XCircle, User, Calendar, X, Award, Search, Sparkles } from 'lucide-react';

interface StudentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  groupName?: string;
}

interface CombinedHistoryEvent {
  id: string;
  type: 'lecture_note' | 'task_note' | 'task_penalty' | 'weakness' | 'penalty' | 'followup' | 'evaluation';
  title: string;
  description: string;
  timestamp: Date;
  formattedTimestamp: string;
  sessionNumber?: number;
  authorName?: string;
  badgeColor: string;
  badgeBg: string;
  meta?: any;
}

export const StudentHistoryModal: React.FC<StudentHistoryModalProps> = ({
  isOpen,
  onClose,
  student,
  groupName
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'weaknesses' | 'penalties' | 'followups'>('all');
  const [evaluations, setEvaluations] = useState<LectureEvaluation[]>([]);
  const [weaknesses, setWeaknesses] = useState<StudentWeaknessPoint[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [followUps, setFollowUps] = useState<StudentFollowUp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !student?.id) return;
    setLoading(true);

    const qEvals = query(collection(db, 'lectureEvaluations'), where('studentId', '==', student.id));
    const unsubEvals = onSnapshot(qEvals, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LectureEvaluation));
      setEvaluations(list);
    }, (err) => console.error("Error loading evaluations history:", err));

    const qWeak = query(collection(db, 'studentWeaknesses'), where('studentId', '==', student.id));
    const unsubWeak = onSnapshot(qWeak, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentWeaknessPoint));
      setWeaknesses(list);
    }, (err) => console.error("Error loading weaknesses history:", err));

    const qPen = query(collection(db, 'penalties'), where('studentId', '==', student.id));
    const unsubPen = onSnapshot(qPen, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Penalty));
      setPenalties(list);
    }, (err) => console.error("Error loading penalties history:", err));

    const qFollow = query(collection(db, 'studentFollowUps'), where('studentId', '==', student.id));
    const unsubFollow = onSnapshot(qFollow, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentFollowUp));
      setFollowUps(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading followups history:", err);
      setLoading(false);
    });

    return () => {
      unsubEvals();
      unsubWeak();
      unsubPen();
      unsubFollow();
    };
  }, [isOpen, student?.id]);

  if (!isOpen || !student) return null;

  const parseTimestamp = (ts: any): Date => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return new Date(0);
  };

  const formatExactDateTime = (date: Date): string => {
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) return 'تاريخ غير مسجل';
    return date.toLocaleString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Build combined history timeline
  const combinedHistory: CombinedHistoryEvent[] = [];

  // 1. Lecture Notes & Task Notes & Penalties from Evaluations
  evaluations.forEach(e => {
    const ts = parseTimestamp(e.updatedAt);
    const timeStr = formatExactDateTime(ts);

    if (e.trainerNote && e.trainerNote.trim()) {
      combinedHistory.push({
        id: `eval_trainerNote_${e.id || `${e.sessionNumber}_${e.studentId}`}`,
        type: 'lecture_note',
        title: `📝 ملاحظة المحاضرة - سيشن #${e.sessionNumber}`,
        description: e.trainerNote,
        timestamp: ts,
        formattedTimestamp: timeStr,
        sessionNumber: e.sessionNumber,
        badgeColor: 'text-indigo-400 border-indigo-500/30',
        badgeBg: 'bg-indigo-950/40'
      });
    }

    if (e.taskNote && e.taskNote.trim()) {
      combinedHistory.push({
        id: `eval_taskNote_${e.id || `${e.sessionNumber}_${e.studentId}`}`,
        type: 'task_note',
        title: `📌 تقييم وملاحظة التاسك - سيشن #${e.sessionNumber}`,
        description: e.taskNote,
        timestamp: ts,
        formattedTimestamp: timeStr,
        sessionNumber: e.sessionNumber,
        badgeColor: 'text-amber-400 border-amber-500/30',
        badgeBg: 'bg-amber-950/40'
      });
    }

    if (e.taskNotSubmittedPenalty) {
      combinedHistory.push({
        id: `eval_taskPenalty_${e.id || `${e.sessionNumber}_${e.studentId}`}`,
        type: 'task_penalty',
        title: `🚫 إلغاء تقييم وخصم نقطة لعدم تسليم التاسك - سيشن #${e.sessionNumber}`,
        description: `تم إلغاء تقييم هذه المحاضرة وخصم 1 نقطة بسبب عدم تسليم التاسك المطلوبة.`,
        timestamp: ts,
        formattedTimestamp: timeStr,
        sessionNumber: e.sessionNumber,
        badgeColor: 'text-red-400 border-red-500/30',
        badgeBg: 'bg-red-950/40'
      });
    }

    if (!e.trainerNote && !e.taskNote && !e.taskNotSubmittedPenalty && e.total !== undefined) {
      combinedHistory.push({
        id: `eval_score_${e.id || `${e.sessionNumber}_${e.studentId}`}`,
        type: 'evaluation',
        title: `📊 تقييم درجات المحاضرة - سيشن #${e.sessionNumber}`,
        description: `حضور: ${e.attendance ? 'نعم' : 'لا'} | نقاط التاسك: ${e.taskDelivered || 0} | تسليم في الموعد: ${e.taskOnTime ? 'نعم' : 'لا'} | الجودة: ${e.taskQuality ? 'ممتازة' : 'عادية'} | بونص: ${e.bonus || 0} (الإجمالي: ${e.total} نقطة)`,
        timestamp: ts,
        formattedTimestamp: timeStr,
        sessionNumber: e.sessionNumber,
        badgeColor: 'text-blue-400 border-blue-500/30',
        badgeBg: 'bg-blue-950/40'
      });
    }
  });

  // 2. Student Weakness Points
  weaknesses.forEach(w => {
    const createdTs = parseTimestamp(w.createdAt);
    const createdStr = formatExactDateTime(createdTs);

    let descText = w.description;
    if (w.notes) descText += `\nتفاصيل إضافية: ${w.notes}`;

    combinedHistory.push({
      id: `weakness_${w.id}`,
      type: 'weakness',
      title: `🎯 نقطة ضعف وتطوير: ${w.resolved ? '🟢 (تمت المعالجة)' : '🔴 (قيد المتابعة)'}`,
      description: descText,
      timestamp: createdTs,
      formattedTimestamp: createdStr,
      sessionNumber: w.sessionNumber,
      authorName: w.createdByName || 'المشرف/المدرب',
      badgeColor: w.resolved ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30',
      badgeBg: w.resolved ? 'bg-emerald-950/40' : 'bg-amber-950/40',
      meta: {
        resolved: w.resolved,
        resolvedByName: w.resolvedByName,
        resolvedAt: w.resolvedAt ? formatExactDateTime(parseTimestamp(w.resolvedAt)) : null
      }
    });
  });

  // 3. Penalties
  penalties.forEach(p => {
    const ts = parseTimestamp(p.createdAt || p.date);
    const timeStr = formatExactDateTime(ts);

    combinedHistory.push({
      id: `penalty_${p.id}`,
      type: 'penalty',
      title: `⚠️ جزاء وخصم نقاط: (${p.points} نقطة)`,
      description: p.reason || 'خصم إداري',
      timestamp: ts,
      formattedTimestamp: timeStr,
      badgeColor: 'text-rose-400 border-rose-500/30',
      badgeBg: 'bg-rose-950/40'
    });
  });

  // 4. Follow Up Records
  followUps.forEach(f => {
    const ts = parseTimestamp(f.createdAt || f.updatedAt);
    const timeStr = formatExactDateTime(ts);

    if (f.comments && f.comments.length > 0) {
      f.comments.forEach((c, idx) => {
        const cTs = parseTimestamp(c.createdAt);
        combinedHistory.push({
          id: `followup_comment_${f.id}_${idx}`,
          type: 'followup',
          title: `💬 تعليق في غرفة المتابعة`,
          description: c.text,
          timestamp: cTs,
          formattedTimestamp: formatExactDateTime(cTs),
          authorName: c.createdByName || c.createdByRole,
          badgeColor: 'text-cyan-400 border-cyan-500/30',
          badgeBg: 'bg-cyan-950/40'
        });
      });
    } else if (f.note) {
      combinedHistory.push({
        id: `followup_${f.id}`,
        type: 'followup',
        title: `🔄 طلب متابعة إدارية (${f.status === 'resolved' ? 'تم الحل' : 'نشط'})`,
        description: f.note,
        timestamp: ts,
        formattedTimestamp: timeStr,
        authorName: f.createdByName,
        badgeColor: 'text-purple-400 border-purple-500/30',
        badgeBg: 'bg-purple-950/40'
      });
    }
  });

  // Sort history chronologically (newest first)
  combinedHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Filter by Tab
  const filteredHistory = combinedHistory.filter(item => {
    if (activeTab === 'notes' && !['lecture_note', 'task_note', 'evaluation', 'task_penalty'].includes(item.type)) return false;
    if (activeTab === 'weaknesses' && item.type !== 'weakness') return false;
    if (activeTab === 'penalties' && !['penalty', 'task_penalty'].includes(item.type)) return false;
    if (activeTab === 'followups' && item.type !== 'followup') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchAuthor = item.authorName?.toLowerCase().includes(q);
      const matchTime = item.formattedTimestamp.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchAuthor || matchTime;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-arabic text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-black">
              📜
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-lg">{student.name}</h3>
                {student.studentIdNum && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                    #{student.studentIdNum}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                سجل وتاريخ الطالب الكامل والتوقيتات الزمنيّة {groupName || student.groupId ? `• المجموعة: ${groupName || student.groupId}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Search & Filters Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌟 سجل الكل ({combinedHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'notes' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📝 الملاحظات والتقييمات ({combinedHistory.filter(i => ['lecture_note', 'task_note', 'evaluation', 'task_penalty'].includes(i.type)).length})
              </button>
              <button
                onClick={() => setActiveTab('weaknesses')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'weaknesses' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 نقاط الضعف ({combinedHistory.filter(i => i.type === 'weakness').length})
              </button>
              <button
                onClick={() => setActiveTab('penalties')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'penalties' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚠️ الخصومات والجزاءات ({combinedHistory.filter(i => ['penalty', 'task_penalty'].includes(i.type)).length})
              </button>
              <button
                onClick={() => setActiveTab('followups')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'followups' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔄 المتابعات ({combinedHistory.filter(i => i.type === 'followup').length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث بالتاريخ، الكلمة، أو الكاتب..."
                className="w-full pr-9 pl-4 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* History Timeline Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-400 text-xs font-bold">جاري تحميل السجل الكامل وتاريخ الطالب...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-slate-400 font-bold text-xs">لا يوجد أي سجل أو ملاحظات مسجلة ضمن هذه التصفية حتى الآن.</p>
            </div>
          ) : (
            <div className="relative border-r-2 border-slate-800 pr-6 space-y-6">
              {filteredHistory.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -right-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-indigo-500 group-hover:scale-125 transition-transform"></div>

                  {/* Card Container */}
                  <div className="bg-slate-950 p-4 rounded-2.5xl border border-slate-800/80 hover:border-indigo-500/30 transition-all space-y-2.5 shadow-sm">
                    {/* Event Header */}
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className={`text-[11px] font-black px-3 py-1 rounded-full border ${item.badgeBg} ${item.badgeColor} flex items-center gap-1.5`}>
                        {item.title}
                      </span>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                        <span className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                          <Clock size={12} className="text-indigo-400" />
                          {item.formattedTimestamp}
                        </span>
                        {item.authorName && (
                          <span className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-slate-400">
                            <User size={11} className="text-amber-400" />
                            {item.authorName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description Content */}
                    <p className="text-slate-200 text-xs font-bold leading-relaxed whitespace-pre-line pr-1">
                      {item.description}
                    </p>

                    {/* Additional Metadata for Weakness points resolution */}
                    {item.meta?.resolved && (
                      <div className="pt-2 border-t border-slate-900/80 text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle size={12} />
                        <span>تمت معالجة نقطة الضعف بنجاح بواسطة: {item.meta.resolvedByName || 'المشرف'}</span>
                        {item.meta.resolvedAt && <span>• ({item.meta.resolvedAt})</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-center">
          <p className="text-[10px] text-slate-500 font-bold">
            💡 يتم تسجيل وتوثيق كافّة الملاحظات، والتقييمات، ونقاط الضعف تلقائياً بالتاريخ والوقت لضمان الدقة والرجوع إليها دائماً.
          </p>
        </div>

      </div>
    </div>
  );
};
