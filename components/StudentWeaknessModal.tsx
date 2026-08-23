import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, Plus, Trash2, 
  X, Check, User, Calendar, ShieldAlert, Sparkles, Filter,
  Eye, EyeOff, Lock
} from 'lucide-react';
import { StudentWeaknessPoint } from '../types';
import { 
  subscribeToCollection, 
  addStudentWeaknessPoint, 
  toggleStudentWeaknessPointResolved, 
  deleteStudentWeaknessPoint,
  updateStudentWeaknessPointVisibility
} from '../services/firestore';
import { useSensitiveData } from '../contexts/SensitiveDataContext';
import * as firestore from 'firebase/firestore';

interface StudentWeaknessModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  groupId?: string;
  groupName?: string;
  sessionNumber?: number;
  user: { uid: string; name: string; role: string };
}

export const StudentWeaknessModal: React.FC<StudentWeaknessModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  groupId,
  groupName,
  sessionNumber,
  user
}) => {
  const { showSensitiveData, toggleShowSensitiveData } = useSensitiveData();
  const [weaknesses, setWeaknesses] = useState<StudentWeaknessPoint[]>([]);
  const [newDescription, setNewDescription] = useState('');
  const [visibleToStudent, setVisibleToStudent] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  useEffect(() => {
    if (!isOpen || !studentId) return;

    const unsub = subscribeToCollection<StudentWeaknessPoint>(
      'studentWeaknesses',
      (data) => {
        // Filter by studentId
        const studentData = data.filter(w => w.studentId === studentId);
        // Sort: unresolved first, then created at desc
        studentData.sort((a, b) => {
          if (a.resolved === b.resolved) {
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          }
          return a.resolved ? 1 : -1;
        });
        setWeaknesses(studentData);
      },
      [firestore.where('studentId', '==', studentId)]
    );

    return () => unsub();
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const handleAddWeakness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await addStudentWeaknessPoint({
        studentId,
        studentName,
        groupId,
        groupName,
        description: newDescription,
        sessionNumber,
        visibleToStudent
      }, user);
      setNewDescription('');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة نقطة الضعف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolved = async (weakness: StudentWeaknessPoint) => {
    try {
      await toggleStudentWeaknessPointResolved(
        weakness.id,
        !weakness.resolved,
        user,
        studentId,
        weakness.description
      );
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تغيير الحالة');
    }
  };

  const handleToggleVisibility = async (weakness: StudentWeaknessPoint) => {
    const nextState = weakness.visibleToStudent === false; // toggle to true if false
    try {
      await updateStudentWeaknessPointVisibility(weakness.id, nextState, user);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تغيير ظهور النقطة للمتدرب');
    }
  };

  const handleDelete = async (weaknessId: string) => {
    if (!window.confirm('هل أنت تأكد من رغبتك في حذف نقطة الضعف هذه؟')) return;
    try {
      await deleteStudentWeaknessPoint(weaknessId, user);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  // Sensitive vs Public breakdown
  const sensitiveCount = weaknesses.filter(w => w.visibleToStudent === false).length;

  // Filter based on activeFilter ('all'|'unresolved'|'resolved') and showSensitiveData flag
  const displayableWeaknesses = weaknesses.filter(w => {
    // If item is sensitive (visibleToStudent === false) and showSensitiveData is false, hide from list
    if (w.visibleToStudent === false && !showSensitiveData) {
      return false;
    }
    if (activeFilter === 'unresolved') return !w.resolved;
    if (activeFilter === 'resolved') return w.resolved;
    return true;
  });

  const unresolvedCount = displayableWeaknesses.filter(w => !w.resolved).length;
  const resolvedCount = displayableWeaknesses.filter(w => w.resolved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-arabic text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>سجل نقاط الضعف ومواضع التطوير</span>
                {unresolvedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {unresolvedCount} قيد المعالجة
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                المتدرب: <span className="text-indigo-400 font-black">{studentName}</span>
                {groupName && <span className="text-slate-500 mr-2">({groupName})</span>}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar">
          
          {/* Sensitive Data Global Filter Toggle Banner */}
          {sensitiveCount > 0 && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
              showSensitiveData 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <Lock size={15} className={showSensitiveData ? 'text-amber-400' : 'text-slate-500'} />
                <span>
                  توجد <strong>{sensitiveCount}</strong> نقطة ضعف مصنفة كـ <strong>بيانات حساسة (مخفية عن المتدرب)</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={toggleShowSensitiveData}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSensitiveData
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {showSensitiveData ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showSensitiveData ? 'إخفاء البيانات الحساسة' : 'إظهار البيانات الحساسة'}</span>
              </button>
            </div>
          )}

          {/* Add New Weakness Form */}
          <form onSubmit={handleAddWeakness} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <label className="block text-xs font-black text-slate-300">
              إضافة نقطة ضعف أو جانب يحتاج تطوير عند المتدرب 🎯
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="مثال: صعوبة في فهم الدوال (Functions) - يحتاج إعادة تطبيق..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white font-bold text-xs focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newDescription.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-lg shadow-amber-500/10"
              >
                <Plus size={16} />
                <span>إضافة</span>
              </button>
            </div>

            {/* Visibility Option Toggle for Student */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleToStudent}
                  onChange={(e) => setVisibleToStudent(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                {visibleToStudent ? (
                  <span className="text-emerald-400 font-black flex items-center gap-1">
                    <Eye size={14} /> إظهار هذه النقطة للمتدرب في بوابته (تظهر له بالبوابة)
                  </span>
                ) : (
                  <span className="text-amber-400 font-black flex items-center gap-1">
                    <Lock size={14} /> إخفاء عن المتدرب (خاصة بالتدريب فقط - بيانات حساسة 🔒)
                  </span>
                )}
              </label>

              {sessionNumber && (
                <span className="text-[10px] text-slate-500 font-bold">
                  مرتبطة بالمحاضرة #{sessionNumber}
                </span>
              )}
            </div>
          </form>

          {/* Filters & Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">تصفية النقاط:</span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeFilter === 'all' ? 'bg-slate-800 text-white font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  الكل ({displayableWeaknesses.length})
                </button>
                <button
                  onClick={() => setActiveFilter('unresolved')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeFilter === 'unresolved' ? 'bg-amber-500/20 text-amber-400 font-black border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                >
                  قيد المعالجة ({unresolvedCount})
                </button>
                <button
                  onClick={() => setActiveFilter('resolved')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeFilter === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
                >
                  تم حلها ({resolvedCount})
                </button>
              </div>
            </div>
          </div>

          {/* Weakness Points List */}
          {displayableWeaknesses.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-2">
              <Sparkles className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
              <p className="text-sm font-black text-slate-300">
                {activeFilter === 'resolved' 
                  ? 'لا توجد نقاط ضعف معالجة معروضة حالياً' 
                  : activeFilter === 'unresolved'
                  ? 'لا توجد نقاط ضعف قيد المعالجة (ممتاز!)'
                  : 'لا توجد أي نقاط ضعف معروضة'
                }
              </p>
              {!showSensitiveData && sensitiveCount > 0 && (
                <p className="text-xs text-amber-400 font-bold">
                  ملاحظة: هناك {sensitiveCount} نقاط حساسة مخفية. اضغط على "إظهار البيانات الحساسة" بالأعلى لعرضها.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayableWeaknesses.map((item) => {
                const isSensitive = item.visibleToStudent === false;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 relative group ${
                      item.resolved
                        ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40'
                        : isSensitive
                        ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
                    }`}
                  >
                    {/* Resolve Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleResolved(item)}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        item.resolved
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'border-slate-700 bg-slate-900 hover:border-amber-500 text-transparent hover:text-amber-400'
                      }`}
                      title={item.resolved ? 'إلغاء التحديد' : 'تحديد كـ تم حلها / معالجتها'}
                    >
                      <Check size={14} className="stroke-[3]" />
                    </button>

                    {/* Body Content */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-xs font-bold leading-relaxed ${
                          item.resolved ? 'line-through text-slate-400' : 'text-slate-100 font-black'
                        }`}>
                          {item.description}
                        </p>

                        {/* Status Tag */}
                        {item.resolved ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            <span>تم معالجة النقطة</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            <span>تتطلب عمل ومتابعة</span>
                          </span>
                        )}

                        {/* Sensitive Badge */}
                        {isSensitive ? (
                          <span 
                            onClick={() => handleToggleVisibility(item)}
                            className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition-all"
                            title="بيانات حساسة مخفية عن الطالب (اضغط للتحويل إلى معروضة)"
                          >
                            <Lock size={10} />
                            <span>مخفية عن الطالب (حساسة 🔒)</span>
                          </span>
                        ) : (
                          <span 
                            onClick={() => handleToggleVisibility(item)}
                            className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 cursor-pointer hover:bg-blue-500/30 transition-all"
                            title="معروضة للمتدرب بالبوابة (اضغط لإخفائها وتحويلها لحساسة)"
                          >
                            <Eye size={10} />
                            <span>معروضة للمتدرب 👁️</span>
                          </span>
                        )}

                        {item.sessionNumber && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            سيشن #{item.sessionNumber}
                          </span>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-bold pt-1 border-t border-slate-800/40">
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          أضافها: {item.createdByName || 'المدرب'}
                        </span>

                        {item.resolved && item.resolvedByName && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 size={10} />
                            تم الحل بواسطة: {item.resolvedByName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete Action */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
                      title="حذف نقطة الضعف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center text-xs font-bold text-slate-400">
          <span>إجمالي النقاط: <strong className="text-white">{displayableWeaknesses.length}</strong></span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
