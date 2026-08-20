import React, { useState, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, User, Group } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { X, AlertTriangle, UserCheck, Check, Ban, Clock, ArrowRightLeft } from 'lucide-react';
import { transferStudentToGroup } from '../services/firestore';

interface StudentStatusModalProps {
  isOpen?: boolean;
  onClose: () => void;
  student: Student | null;
  groups?: Group[];
  user?: User;
  currentUser?: User;
  initialActionType?: ActionType;
  onSuccess?: () => void;
  onSaved?: () => void;
}

const CHECKLIST_ITEMS_AR = [
  { key: 'warned', label: 'تم تنبيهه أكتر من مرة' },
  { key: 'telegramTopic', label: 'تم إيقاف التوبيك الخاص به تليجرام' },
  { key: 'telegramGroup', label: 'تم إزالته من جروب تليجرام' },
  { key: 'whatsappGroup', label: 'تم إزالته من جروب الواتس أب' },
  { key: 'recordingsGroup', label: 'تم إزالته من جروب الريكوردات' },
  { key: 'informed', label: 'تم التواصل معه مباشرةً وإبلاغه' }
];

const CHECKLIST_ITEMS_EN = [
  { key: 'warned', label: 'Warned multiple times' },
  { key: 'telegramTopic', label: 'Telegram topic turned off / muted' },
  { key: 'telegramGroup', label: 'Removed from Telegram group' },
  { key: 'whatsappGroup', label: 'Removed from WhatsApp group' },
  { key: 'recordingsGroup', label: 'Removed from recordings group' },
  { key: 'informed', label: 'Directly reached out & informed' }
];

export type ActionType = 'reactivate' | 'suspend_temp' | 'suspend_permanent' | 'transfer';

const StudentStatusModal: React.FC<StudentStatusModalProps> = ({
  isOpen = true,
  onClose,
  student,
  groups,
  user,
  currentUser,
  initialActionType,
  onSuccess,
  onSaved
}) => {
  const activeUser = user || currentUser || { uid: 'system', name: 'إدارة النظام', role: 'admin' } as User;
  const triggerSuccess = onSuccess || onSaved || (() => {});
  const { lang } = useLanguage();
  const [actionType, setActionType] = useState<ActionType>('suspend_temp');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState<'unpaid_50_percent' | 'installment_delinquency' | 'other'>('unpaid_50_percent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Transfer States
  const [availableGroups, setAvailableGroups] = useState<Group[]>(groups || []);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('');
  const [autoReactivateOnTransfer, setAutoReactivateOnTransfer] = useState(true);

  // Deactivation Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    warned: false,
    telegramTopic: false,
    telegramGroup: false,
    whatsappGroup: false,
    recordingsGroup: false,
    informed: false
  });

  // Fetch groups if not provided as prop
  useEffect(() => {
    if (isOpen) {
      if (groups && groups.length > 0) {
        setAvailableGroups(groups);
      } else {
        getDocs(collection(db, 'groups')).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
          setAvailableGroups(list);
        }).catch(err => console.error("Error fetching groups for modal:", err));
      }
    }
  }, [isOpen, groups]);

  useEffect(() => {
    if (isOpen && student) {
      setReason('');
      setErrorMsg(null);
      setSelectedTargetGroupId('');

      if (initialActionType) {
        setActionType(initialActionType);
      } else if (!student.deactivated) {
        setActionType('suspend_temp');
        setReasonCategory('unpaid_50_percent');
      } else if (student.deactivationReasonCategory === 'permanent_suspension' || student.permanentDeactivation) {
        setActionType('suspend_permanent');
        setReasonCategory('other');
      } else {
        setActionType('reactivate');
        setReasonCategory(student.deactivationReasonCategory as any || 'unpaid_50_percent');
      }

      setChecklist({
        warned: false,
        telegramTopic: false,
        telegramGroup: false,
        whatsappGroup: false,
        recordingsGroup: false,
        informed: false
      });
    }
  }, [isOpen, student, initialActionType]);

  if (!isOpen || !student) return null;

  const itemsList = lang === 'ar' ? CHECKLIST_ITEMS_AR : CHECKLIST_ITEMS_EN;

  const handleCheckboxChange = (key: string) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (actionType === 'transfer') {
      if (!selectedTargetGroupId) {
        setErrorMsg(lang === 'ar' ? 'يرجى اختيار المجموعة الجديدة المراد تحويل الطالب إليها.' : 'Please select a destination group.');
        return;
      }
      if (selectedTargetGroupId === student.groupId) {
        setErrorMsg(lang === 'ar' ? 'الطالب مسجل بالفعل في هذه المجموعة. اختر مجموعة مختلفة.' : 'Student is already in this group.');
        return;
      }
    } else if (actionType !== 'reactivate' && !reason.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى كتابة سبب الإيقاف بالتفصيل.' : 'Please enter a detailed reason for deactivation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const studentRef = doc(db, 'students', student.id);
      const timestamp = new Date().toISOString();

      if (actionType === 'transfer') {
        await transferStudentToGroup(
          student.id,
          selectedTargetGroupId,
          autoReactivateOnTransfer,
          reason.trim(),
          activeUser
        );
      } else if (actionType === 'reactivate') {
        // Prepare history entry for reactivation
        const historyEntry = {
          type: 'reactivate' as const,
          reason: reason.trim() || 'تم إعادة التفعيل واستكمال البيانات من قبل الإدارة',
          timestamp,
          performedByUid: activeUser.uid,
          performedByName: activeUser.name
        };

        await updateDoc(studentRef, {
          deactivated: false,
          permanentDeactivation: false,
          is50PercentPaid: true,
          deactivatedAt: null,
          deactivatedByUid: null,
          deactivatedByName: null,
          deactivationReason: null,
          deactivationReasonCategory: null,
          deactivationChecklist: null,
          deactivationHistory: arrayUnion(historyEntry)
        });
      } else if (actionType === 'suspend_temp') {
        let categoryTitle = 'موقوف لعدم استكمال 50% من سعر الكورس';
        if (reasonCategory === 'installment_delinquency') {
          categoryTitle = 'موقوف لعدم الانتظام في الأقساط';
        } else if (reasonCategory === 'other') {
          categoryTitle = 'موقوف مؤقتاً / مجمد (أسباب أخرى)';
        }

        const fullFormattedReason = `${categoryTitle} - ${reason.trim()}`;

        const historyEntry = {
          type: 'deactivate' as const,
          reasonCategory,
          reason: fullFormattedReason,
          timestamp,
          performedByUid: activeUser.uid,
          performedByName: activeUser.name,
          checklist
        };

        await updateDoc(studentRef, {
          deactivated: true,
          permanentDeactivation: false,
          is50PercentPaid: reasonCategory !== 'unpaid_50_percent',
          deactivatedAt: timestamp,
          deactivatedByUid: activeUser.uid,
          deactivatedByName: activeUser.name,
          deactivationReasonCategory: reasonCategory,
          deactivationReason: fullFormattedReason,
          deactivationChecklist: checklist,
          deactivationHistory: arrayUnion(historyEntry)
        });
      } else if (actionType === 'suspend_permanent') {
        const categoryTitle = 'إيقاف نهائي (طرد / استبعاد من الأكاديمية)';
        const fullFormattedReason = `${categoryTitle} - ${reason.trim()}`;

        const historyEntry = {
          type: 'deactivate' as const,
          reasonCategory: 'permanent_suspension' as const,
          reason: fullFormattedReason,
          timestamp,
          performedByUid: activeUser.uid,
          performedByName: activeUser.name,
          checklist
        };

        await updateDoc(studentRef, {
          deactivated: true,
          permanentDeactivation: true,
          is50PercentPaid: false,
          deactivatedAt: timestamp,
          deactivatedByUid: activeUser.uid,
          deactivatedByName: activeUser.name,
          deactivationReasonCategory: 'permanent_suspension',
          deactivationReason: fullFormattedReason,
          deactivationChecklist: checklist,
          deactivationHistory: arrayUnion(historyEntry)
        });
      }

      triggerSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Firestore update action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              actionType === 'transfer'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : actionType === 'reactivate'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : actionType === 'suspend_temp'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}>
              {actionType === 'transfer' && <ArrowRightLeft className="w-6 h-6" />}
              {actionType === 'reactivate' && <UserCheck className="w-6 h-6" />}
              {actionType === 'suspend_temp' && <Clock className="w-6 h-6" />}
              {actionType === 'suspend_permanent' && <Ban className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {lang === 'ar' ? 'إدارة حالة ونقل الطالب' : 'Manage & Transfer Student'}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5 flex items-center gap-2">
                <span>🎓 {student.name}</span>
                {student.deactivated && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    student.deactivationReasonCategory === 'permanent_suspension' || student.permanentDeactivation
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {student.deactivationReasonCategory === 'permanent_suspension' || student.permanentDeactivation
                      ? '🚫 موقوف نهائياً'
                      : '⏳ موقوف مؤقتاً / مجمد'
                    }
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Type Selector Buttons */}
        <div className="p-4 bg-slate-950/30 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActionType('transfer')}
            className={`py-3 px-2 rounded-2xl border font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              actionType === 'transfer'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>تحويل لمجموعة 🔄</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('reactivate')}
            className={`py-3 px-2 rounded-2xl border font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              actionType === 'reactivate'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>إعادة التفعيل 🟢</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('suspend_temp')}
            className={`py-3 px-2 rounded-2xl border font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              actionType === 'suspend_temp'
                ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>إيقاف مؤقت ⏳</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('suspend_permanent')}
            className={`py-3 px-2 rounded-2xl border font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              actionType === 'suspend_permanent'
                ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-lg shadow-rose-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>إيقاف نهائي 🚫</span>
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleAction} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-center text-xs font-bold flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TRANSFER GROUP SECTION */}
          {actionType === 'transfer' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-right">
                <p className="text-xs font-bold text-purple-300 leading-relaxed">
                  🔄 سيتم تحويل الطالب من مجموعته الحالية إلى المجموعة الجديدة المحددة أدناه.
                </p>
              </div>

              <div className="space-y-2 text-right">
                <label className="block text-xs font-black text-slate-300">
                  اختر المجموعة الجديدة 🎯
                </label>
                <select
                  required
                  value={selectedTargetGroupId}
                  onChange={(e) => setSelectedTargetGroupId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- اختر المجموعة الجديدة --</option>
                  {availableGroups.map((g) => {
                    const isCurrent = g.id === student.groupId;
                    const isArchived = g.archived || (g as any).isArchived || (g as any).status === 'archived';
                    return (
                      <option key={g.id} value={g.id} disabled={isCurrent}>
                        {g.name || g.batchCode} ({g.courseName || 'كورس'}) {isCurrent ? '👈 [المجموعة الحالية]' : ''} {isArchived ? '📁 [أرشيف]' : '🟢 [نشطة]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-slate-950/60 p-3.5 border border-slate-800 rounded-2xl flex items-center justify-between text-right cursor-pointer" onClick={() => setAutoReactivateOnTransfer(!autoReactivateOnTransfer)}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoReactivateOnTransfer}
                    onChange={(e) => setAutoReactivateOnTransfer(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-xs font-black text-white block">إعادة تفعيل الطالب تلقائياً 🟢</span>
                    <span className="text-[10px] text-slate-400">إلغاء الإيقاف أو التجميد ليصبح الطالب نشطاً ومستقراً في المجموعة الجديدة</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Banner Notice per action */}
          {actionType === 'reactivate' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-right">
              <p className="text-xs font-bold text-emerald-300 leading-relaxed">
                ✨ سيؤدي هذا الإجراء إلى إلغاء أي إيقاف مفروض على الطالب وإعادة تفعيل حسابه لتمكينه من حضور المحاضرات والتفاعل من جديد.
              </p>
            </div>
          )}

          {actionType === 'suspend_temp' && (
            <div className="space-y-3">
              <label className="block text-[11px] font-black uppercase text-amber-400 tracking-wider">
                {lang === 'ar' ? 'سبب الإيقاف المؤقت / التجميد 📌' : 'Temporary Suspension Reason Category 📌'}
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setReasonCategory('unpaid_50_percent')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    reasonCategory === 'unpaid_50_percent'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black">موقوف لعدم استكمال 50% من سعر الكورس</span>
                    <span className="text-[10px] text-slate-400">منع من الحضور لحين سداد الحد الأدنى للمبلغ</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reasonCategory === 'unpaid_50_percent' ? 'border-amber-500 bg-amber-500' : 'border-slate-700'}`}>
                    {reasonCategory === 'unpaid_50_percent' && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReasonCategory('installment_delinquency')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    reasonCategory === 'installment_delinquency'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black">موقوف لعدم الانتظام في الأقساط</span>
                    <span className="text-[10px] text-slate-400">تأخر عن سداد القسط المستحق في الموعد المحدد</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reasonCategory === 'installment_delinquency' ? 'border-rose-500 bg-rose-500' : 'border-slate-700'}`}>
                    {reasonCategory === 'installment_delinquency' && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReasonCategory('other')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    reasonCategory === 'other'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black">موقوف / مجمد لسبب آخر</span>
                    <span className="text-[10px] text-slate-400">طلب تجميد مؤقت، غياب، أو ظروف شخصية</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reasonCategory === 'other' ? 'border-purple-500 bg-purple-500' : 'border-slate-700'}`}>
                    {reasonCategory === 'other' && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                  </div>
                </button>
              </div>
            </div>
          )}

          {actionType === 'suspend_permanent' && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-right space-y-1">
              <span className="text-xs font-black text-rose-400 block">⚠️ تنبيه إيقاف نهائي (طرد / استبعاد):</span>
              <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                سيتسبب هذا الإجراء في إدراج الطالب نهائياً ضمن **قائمة الإيقاف النهائي** المستقلة واستبعاده من كافة المجموعات والنشاطات.
              </p>
            </div>
          )}

          {/* Deactivation Checklist for Temp & Permanent */}
          {(actionType === 'suspend_temp' || actionType === 'suspend_permanent') && (
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                {lang === 'ar' ? 'قائمة مراجعة الإجراءات التنفيذية 📝' : 'Deactivation Checklist 📝'}
              </label>
              
              <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                {itemsList.map(item => (
                  <div 
                    key={item.key} 
                    onClick={() => handleCheckboxChange(item.key)}
                    className="flex items-center gap-3 cursor-pointer group select-none text-right"
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      checklist[item.key] 
                        ? 'bg-rose-600 border-rose-500 text-white' 
                        : 'border-slate-700 bg-slate-900 group-hover:border-slate-500'
                    }`}>
                      {checklist[item.key] && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className={`text-xs font-semibold ${checklist[item.key] ? 'text-slate-100 font-bold' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Textarea Reason / Notes */}
          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase text-slate-300 tracking-wider">
              {actionType === 'transfer'
                ? (lang === 'ar' ? 'ملاحظات التحويل (اختياري) 📝' : 'Transfer Notes (Optional) 📝')
                : actionType === 'reactivate' 
                ? (lang === 'ar' ? 'سبب أو ملاحظات إعادة التفعيل ✨' : 'Reactivation Reason & Notes ✨')
                : actionType === 'suspend_permanent'
                ? (lang === 'ar' ? 'سبب الإيقاف النهائي بالتفصيل (إجباري) 🚫' : 'Detailed Permanent Suspension Reason (Required) 🚫')
                : (lang === 'ar' ? 'سبب الإيقاف بالتفصيل ⚠️' : 'Detailed Suspension Reason ⚠️')
              }
            </label>
            <textarea
              required={actionType === 'suspend_temp' || actionType === 'suspend_permanent'}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionType === 'transfer'
                  ? (lang === 'ar' ? 'أدخل ملاحظات النقل أو تاريخ العودة إن وجدت...' : 'Transfer notes...')
                  : actionType === 'reactivate'
                  ? (lang === 'ar' ? 'أدخل تفاصيل إعادة التفعيل إن وجدت...' : 'Reactivation notes...')
                  : actionType === 'suspend_permanent'
                  ? (lang === 'ar' ? 'يرجى كتابة سبب الإيقاف النهائي بالتفصيل...' : 'Reason for permanent termination...')
                  : (lang === 'ar' ? 'يرجى كتابة سبب الإيقاف بالتفصيل...' : 'Reason for temporary suspension...')
              }
              className="w-full text-xs font-semibold text-slate-100 bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Submits */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all cursor-pointer ${
                isSubmitting 
                  ? 'opacity-50 cursor-not-allowed'
                  : actionType === 'transfer'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                    : actionType === 'reactivate'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : actionType === 'suspend_temp'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
              }`}
            >
              {isSubmitting 
                ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                : actionType === 'transfer'
                ? (lang === 'ar' ? 'تأكيد نقل الطالب للمجموعة 🔄' : 'Transfer Student')
                : actionType === 'reactivate'
                ? (lang === 'ar' ? 'حفظ وإعادة التفعيل 🟢' : 'Reactivate')
                : actionType === 'suspend_temp'
                ? (lang === 'ar' ? 'حفظ الإيقاف المؤقت ⏳' : 'Suspend Temporarily')
                : (lang === 'ar' ? 'تأكيد الإيقاف النهائي 🚫' : 'Confirm Permanent Deactivation')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentStatusModal;
