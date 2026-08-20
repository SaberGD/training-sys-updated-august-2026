import React, { useState, useEffect } from 'react';
import { Course, User, CourseChecklistItemTemplate, TrainerPlan } from '../types';
import { subscribeToCollection, logActivity, saveCourseChecklistAndSettings, getTrainerPlan, saveTrainerPlan } from '../services/firestore';
import Layout from '../components/Layout';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Clock, ListChecks, Plus, Trash2, Save, X, Edit, Layers, ClipboardList, HelpCircle, AlignJustify, ArrowLeftRight } from 'lucide-react';

const Courses: React.FC<{ user: User }> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // General Checklist Template Editor State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [checklistItems, setChecklistItems] = useState<CourseChecklistItemTemplate[]>([]);
  const [maxHours, setMaxHours] = useState<number>(3);
  
  // Single Item Template Editor State
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<Partial<CourseChecklistItemTemplate>>({
    id: '', title: '', description: '', module: '', seq: 1, isRequired: true, suggestedSession: 1
  });

  // Checklist template sync dialogue
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncScope, setSyncScope] = useState<'all' | 'active_upcoming' | 'new' | 'template_only'>('active_upcoming');
  const [savingLoading, setSavingLoading] = useState(false);

  // --- TRAINER COURSE PLAN STATE ---
  const [trainerPlanCourse, setTrainerPlanCourse] = useState<Course | null>(null);
  const [planTrainerId, setPlanTrainerId] = useState<string>('');
  const [trainersList, setTrainersList] = useState<User[]>([]);
  const [expectedSessions, setExpectedSessions] = useState<number>(8);
  const [planAllocations, setPlanAllocations] = useState<Record<string, number>>({}); // itemId -> sessionNum (1-indexed)
  const [planNotes, setPlanNotes] = useState<string>('');
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [savingPlanLoading, setSavingPlanLoading] = useState<boolean>(false);

  const isStaff = ['admin', 'coordinator', 'team_leader'].includes(user.role);

  useEffect(() => {
    const unsub = subscribeToCollection<Course>('courses', setCourses);
    return () => unsub();
  }, []);

  // Fetch trainers for dropdown (if staff)
  useEffect(() => {
    if (isStaff) {
      const getTrainers = async () => {
        const trainersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'trainer')));
        const tList = trainersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setTrainersList(tList);
      };
      getTrainers().catch(console.error);
    }
  }, [isStaff]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name) {
      setIsProcessing(true);
      try {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        const docRef = await addDoc(collection(db as any, 'courses'), {
          name,
          description: desc,
          maxApprovedHours: 3,
          checklist: [],
          createdAt: serverTimestamp()
        });
        
        await logActivity({
          action: 'COURSE_CREATE',
          entityType: 'course',
          entityId: docRef.id,
          entityName: name,
          performedByUid: user.uid,
          performedByName: user.name,
          performedByRole: user.role
        });

        setName('');
        setDesc('');
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    setIsProcessing(true);
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db as any, 'courses', courseToDelete.id));
      await logActivity({
        action: 'COURSE_DELETE',
        entityType: 'course',
        entityId: courseToDelete.id,
        entityName: courseToDelete.name,
        performedByUid: user.uid,
        performedByName: user.name,
        performedByRole: user.role
      });
      setCourseToDelete(null);
    } catch (err: any) {
      alert("Failed to delete course: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open general course checklist settings editor
  const openChecklistEditor = (course: Course) => {
    setSelectedCourse(course);
    setChecklistItems(course.checklist || []);
    setMaxHours(course.maxApprovedHours || 3);
    setEditingItemIdx(null);
  };

  const handleAddChecklistItem = () => {
    const nextSeq = checklistItems.length > 0 ? Math.max(...checklistItems.map(i => i.seq)) + 1 : 1;
    const newItem: CourseChecklistItemTemplate = {
      id: 'item_' + Math.random().toString(36).substr(2, 9),
      title: 'بند جديد',
      description: '',
      module: 'عام',
      seq: nextSeq,
      isRequired: true,
      suggestedSession: nextSeq
    };
    const updated = [...checklistItems, newItem];
    setChecklistItems(updated.sort((a,b) => a.seq - b.seq));
    editItemDetails(updated.length - 1, newItem);
  };

  const editItemDetails = (index: number, item: CourseChecklistItemTemplate) => {
    setEditingItemIdx(index);
    setItemDraft({ ...item });
  };

  const saveItemDraft = () => {
    if (editingItemIdx === null) return;
    const updated = [...checklistItems];
    updated[editingItemIdx] = {
      ...updated[editingItemIdx],
      ...itemDraft
    } as CourseChecklistItemTemplate;
    setChecklistItems(updated.sort((a,b) => a.seq - b.seq));
    setEditingItemIdx(null);
  };

  const deleteChecklistItem = (idx: number) => {
    if (confirm("هل أنت متأكد من حذف هذا البند من قالب الكورس؟")) {
      const updated = checklistItems.filter((_, i) => i !== idx);
      setChecklistItems(updated);
      setEditingItemIdx(null);
    }
  };

  const handleSaveChecklist = async () => {
    if (!selectedCourse) return;
    setSavingLoading(true);
    try {
      await saveCourseChecklistAndSettings(
        selectedCourse.id,
        maxHours,
        checklistItems,
        syncScope,
        user
      );
      setShowSyncDialog(false);
      setSelectedCourse(null);
    } catch (err: any) {
      alert("فشلت عملية الحفظ: " + err.message);
    } finally {
      setSavingLoading(false);
    }
  };


  // --- TRAINER PLAN ACTIONS ---
  const openTrainerPlanEditor = async (course: Course) => {
    setTrainerPlanCourse(course);
    const initialTrainerId = isStaff ? (trainersList[0]?.uid || '') : user.uid;
    setPlanTrainerId(initialTrainerId);
    setExpectedSessions(8);
    setPlanAllocations({});
    setPlanNotes('');
    
    if (initialTrainerId) {
      await loadTrainerPlanTemplate(course.id, initialTrainerId);
    }
  };

  const handleTrainerChangeInPlan = async (trainerId: string) => {
    setPlanTrainerId(trainerId);
    if (trainerPlanCourse) {
      await loadTrainerPlanTemplate(trainerPlanCourse.id, trainerId);
    }
  };

  const loadTrainerPlanTemplate = async (courseId: string, trainerId: string) => {
    setLoadingPlan(true);
    try {
      const plan = await getTrainerPlan(trainerId, courseId);
      if (plan) {
        setExpectedSessions(plan.expectedSessions || 8);
        setPlanAllocations(plan.allocations || {});
        setPlanNotes(plan.notes || '');
      } else {
        // Default allocation: assign each item to its suggested session
        const defaultAllocations: Record<string, number> = {};
        const suggestions = (trainerPlanCourse?.checklist || []).reduce((acc, curr) => {
          acc[curr.id] = curr.suggestedSession || curr.seq || 1;
          return acc;
        }, {} as Record<string, number>);
        setPlanAllocations(suggestions);
        setExpectedSessions(8);
        setPlanNotes('');
      }
    } catch (err) {
      console.error("Error loading trainer plan:", err);
    } finally {
      setLoadingPlan(false);
    }
  };

  const allocateItemToSession = (itemId: string, sessionNum: number) => {
    setPlanAllocations(prev => ({
      ...prev,
      [itemId]: sessionNum
    }));
  };

  const deallocateItem = (itemId: string) => {
    setPlanAllocations(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  const handleSaveTrainerPlan = async () => {
    if (!trainerPlanCourse || !planTrainerId) return;
    setSavingPlanLoading(true);
    try {
      const trainerObj = isStaff ? trainersList.find(t => t.uid === planTrainerId) : user;
      const trainerName = trainerObj?.name || 'مجهول';
      
      await saveTrainerPlan({
        trainerId: planTrainerId,
        trainerName,
        courseId: trainerPlanCourse.id,
        courseName: trainerPlanCourse.name,
        expectedSessions,
        allocations: planAllocations,
        notes: planNotes,
        active: true
      }, user);

      alert("تم حفظ خطة المقررات للمحاضر النموذجية بنجاح!");
      setTrainerPlanCourse(null);
    } catch (err: any) {
      alert("فشل في حفظ خطة المحاضر: " + err.message);
    } finally {
      setSavingPlanLoading(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-right font-arabic">
        {/* Course Creation Form (Admin Only) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
            <h3 className="font-black text-slate-800 dark:text-white mb-4 text-base tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-600" />
              إضافة كورس تدريبي جديد
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">اسم الكورس / المسار العلمي</label>
                <input 
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                  placeholder="مثال: دبلومة البرمجة الكاملة"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">وصف المحتوى والمخرجات</label>
                <textarea 
                  value={desc} onChange={e => setDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all text-xs min-h-[100px]"
                  placeholder="الملخص العام والمواضيع..."
                />
              </div>
              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-600/25 active:scale-95 transition-all text-center"
              >
                {isProcessing ? 'جاري الحفظ...' : 'حفظ ونشر الكورس'}
              </button>
            </form>
          </div>
        </div>
        
        {/* Course Cards Catalog */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 italic">لا توجد مسارات دراسية حالية.</div>
            ) : (
              courses.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex justify-between items-start gap-2 border-b border-slate-50 dark:border-slate-800 pb-3 mb-4">
                      <h4 className="font-extrabold text-slate-800 dark:text-white text-lg leading-snug">{c.name}</h4>
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 px-3 py-1 rounded-full font-extrabold">
                        {(c.checklist || []).length} مخرجات / بند
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{c.description || 'لا يوجد وصف مضاف.'}</p>
                    
                    <div className="text-xs text-slate-500 flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>الحد الأقصى لساعات المحاضرة:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{c.maxApprovedHours || 3} س</strong>
                    </div>
                  </div>
                  
                  {/* Action buttons inside each Course Card */}
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2 w-full">
                      {/* Course General Checklist Templates (Admin/Staff only) */}
                      <button 
                        onClick={() => openChecklistEditor(c)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2.5 rounded-xl font-bold transition-all"
                      >
                        <ClipboardList className="w-4 h-4 text-primary-500" />
                        الـ Template الرئيسي
                      </button>

                      {/* Customize Personal Trainer Sequence Plan (Trainer & Staff) */}
                      <button 
                        onClick={() => openTrainerPlanEditor(c)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/20 dark:hover:bg-primary-950 text-primary-700 dark:text-primary-300 px-3 py-2.5 rounded-xl font-bold border border-primary-100/40 dark:border-primary-900/55 transition-all"
                      >
                        <Layers className="w-4 h-4 text-emerald-500" />
                        خطة المحاضر النموذجية
                      </button>
                    </div>

                    {user.role === 'admin' && (
                      <button 
                        onClick={() => setCourseToDelete(c)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 py-1.5 rounded-lg text-xs font-black transition-all text-center self-end w-20"
                      >
                        حذف الكورس
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Course General Checklist & Settings Manager (Admin/Staff) */}
      {selectedCourse && !showSyncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden flex flex-col p-6 shadow-2xl h-[90vh] relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase text-primary-500 tracking-wider">إعداد وتخصيص Checklist كقالب عام لـ</span>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1">{selectedCourse.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedCourse(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="max-w-md">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  الحد الأقصى لساعات المحاضرة المعتمدة (maxApprovedHours)
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  يضبط الحد الأقصى لساعات العمل التي يمكن اعتمادها للمحاضر في كل محاضرة.
                </p>
              </div>
              <input
                type="number"
                step="0.5"
                min="1"
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-black w-24 text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                <ListChecks className="w-5 h-5 text-emerald-500" />
                قائمة مخرجات وبنود الكورس الفنية
              </div>
              <button
                onClick={handleAddChecklistItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-emerald-500/10 transition-all"
              >
                <Plus className="w-4 h-4" />
                إضافة بند للـ Checklist
              </button>
            </div>

            <div className="flex-1 space-y-4 mb-20 overflow-y-auto no-scrollbar">
              {checklistItems.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center rounded-2xl text-slate-400 text-xs">
                  لا توجد أي بنود أو مخرجات مدخلة في هذا الكورس بعد.
                </div>
              ) : (
                checklistItems.map((item, idx) => (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-2xl border transition-all ${
                      editingItemIdx === idx 
                        ? 'border-primary-500 bg-primary-50/10 dark:bg-primary-950/20' 
                        : 'border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {editingItemIdx === idx ? (
                      /* Item Editor Inline form */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">اسم المخرجة / الدرس المخطط شرحه</label>
                            <input
                              type="text"
                              value={itemDraft.title || ''}
                              onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })}
                              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">القسم الفني / الموديول</label>
                            <input
                              type="text"
                              value={itemDraft.module || ''}
                              onChange={(e) => setItemDraft({ ...itemDraft, module: e.target.value })}
                              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">الترتيب في المسار</label>
                            <input
                              type="number"
                              value={itemDraft.seq || 1}
                              onChange={(e) => setItemDraft({ ...itemDraft, seq: Number(e.target.value) })}
                              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center text-slate-800 dark:text-white font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">رقم المحاضرة المقترح</label>
                            <input
                              type="number"
                              value={itemDraft.suggestedSession || 1}
                              onChange={(e) => setItemDraft({ ...itemDraft, suggestedSession: Number(e.target.value) })}
                              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center text-slate-800 dark:text-white font-bold"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <input
                              type="checkbox"
                              id={`req-check-${idx}`}
                              checked={itemDraft.isRequired !== false}
                              onChange={(e) => setItemDraft({ ...itemDraft, isRequired: e.target.checked })}
                              className="accent-primary-600 rounded"
                            />
                            <label htmlFor={`req-check-${idx}`} className="text-xs font-bold text-slate-500">بند إجباري للتخرج</label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">وصف المهارة والواجبات المطلوبة</label>
                          <textarea
                            value={itemDraft.description || ''}
                            onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                            className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            placeholder="تفاصيل الشرح للمدربين..."
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-850">
                          <button
                            type="button"
                            onClick={() => setEditingItemIdx(null)}
                            className="text-xs text-slate-500 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850"
                          >
                            تراجع
                          </button>
                          <button
                            type="button"
                            onClick={saveItemDraft}
                            className="text-xs bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-1.5 rounded-xl shadow transition-all"
                          >
                            موافق
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Item Display Card */
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                              #{item.seq}
                            </span>
                            <h5 className="font-extrabold text-slate-800 dark:text-white text-sm">{item.title}</h5>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                              item.isRequired 
                                ? 'bg-red-50 text-red-500 dark:bg-red-950/20' 
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-805'
                            }`}>
                              {item.isRequired ? 'إجباري' : 'اختياري'}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                          )}
                          <div className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1.5">
                            <span>المحاضرة المقترحة:</span>
                            <span className="text-primary-600 dark:text-primary-450 font-black">المحاضرة {item.suggestedSession || item.seq}</span>
                          </div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => editItemDetails(idx, item)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteChecklistItem(idx)}
                            className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex justify-between">
              <button
                onClick={() => setSelectedCourse(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                إلغاء الإعدادات
              </button>
              <button
                onClick={() => setShowSyncDialog(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-6 py-3 rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary-600/20 transition-all"
              >
                <Save className="w-4 h-4" />
                حفظ ونشر القالب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Personal Trainer Course Plan Template Editor (Personal Lecture Plan) */}
      {trainerPlanCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden flex flex-col p-6 shadow-2xl h-[90vh] relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">لوحة تخصيص خطة ومفرد الشرح للمحاضر الفردي لـ</span>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{trainerPlanCourse.name}</h3>
              </div>
              <button 
                onClick={() => setTrainerPlanCourse(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trainer Selection + Lecture Count Setup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-6 shrink-0 mt-4">
              {/* Trainer Dropdown (Staff edits, or Trainer is locked) */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase">المدرب المستهدف</label>
                {isStaff ? (
                  <select
                    value={planTrainerId}
                    onChange={(e) => handleTrainerChangeInPlan(e.target.value)}
                    className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- اختر مدربًا --</option>
                    {trainersList.map(t => (
                      <option key={t.uid} value={t.uid}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-150 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
                    {user.name}
                  </div>
                )}
              </div>

              {/* Expected sessions number */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase">عدد المحاضرات الكلي المتوقع</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={expectedSessions}
                  onChange={(e) => setExpectedSessions(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none text-center font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase">ملاحظات خطة الشرح الخاصة بك</label>
                <input
                  type="text"
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none"
                  placeholder="ملاحظات توجيهية عن طريقة شرحك..."
                />
              </div>
            </div>

            {loadingPlan ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : !planTrainerId ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                يرجى اختيار مدرب فني لتهيئة خطته التدريبية النموذجية للكورس.
              </div>
            ) : (
              /* Drag Assignment Simulator Workspace */
              <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden mb-16">
                {/* Left Side: Unallocated items list */}
                <div className="w-full md:w-80 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-850/50 min-h-0 overflow-y-auto">
                  <h4 className="font-extrabold text-slate-700 dark:text-slate-200 text-xs border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 flex items-center justify-between">
                    <span>البنود غير الموزعة بعد</span>
                    <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[9px] text-slate-600 dark:text-slate-300">
                      {(trainerPlanCourse.checklist || []).filter(item => !planAllocations[item.id]).length} بند
                    </span>
                  </h4>
                  
                  <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                    {(trainerPlanCourse.checklist || [])
                      .filter(item => !planAllocations[item.id])
                      .map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3 rounded-xl shadow-xs">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 font-bold px-1 rounded text-slate-400 mb-1">
                              #{item.seq}
                            </span>
                            <span className={`text-[8px] px-1 rounded font-black ${item.isRequired ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400'}`}>
                              {item.isRequired ? 'إجباري' : 'اختياري'}
                            </span>
                          </div>
                          <h5 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{item.title}</h5>
                          {item.description && <p className="text-[10px] text-slate-400 outline-none mt-1 leading-snug">{item.description}</p>}
                          
                          {/* Easy Allocation dropdown selector triggers allocations manually */}
                          <div className="mt-3 pt-2.5 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between gap-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  allocateItemToSession(item.id, Number(e.target.value));
                                }
                              }}
                              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded px-2 py-1 text-[10px] font-bold outline-none"
                            >
                              <option value="">توجيه إلى...</option>
                              {Array.from({ length: expectedSessions }).map((_, i) => (
                                <option key={i} value={i + 1}>المحاضرة {i + 1}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                    {(trainerPlanCourse.checklist || []).length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-8">
                        الـ Checklist الرئيسي فارغ. يرجى تهيئته أولاً لتستطيع تخصيص الخطة.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Grid of target Sessions */}
                <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900/60 min-h-0 overflow-y-auto">
                  <h4 className="font-extrabold text-slate-800 dark:text-white text-xs mb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span>الهيكل العام للمحاضرات المخطط تدريسها ({expectedSessions} محاضرات)</span>
                    <span className="text-[10px] text-amber-500 font-bold">يرجى توزيع كل بنود الـ Checklist على المحاضرات</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1">
                    {Array.from({ length: expectedSessions }).map((_, i) => {
                      const sessionNum = i + 1;
                      const allocatedItems = (trainerPlanCourse.checklist || []).filter(item => planAllocations[item.id] === sessionNum);

                      return (
                        <div key={sessionNum} className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-150 dark:border-slate-800/80 min-h-[140px] flex flex-col">
                          <div className="flex justify-between items-center mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                            <span className="text-xs font-black text-slate-850 dark:text-slate-100">المحاضرة {sessionNum}</span>
                            <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-350 px-2 py-0.5 rounded-full font-black">
                              {allocatedItems.length} بنود
                            </span>
                          </div>

                          <div className="flex-1 space-y-1.5">
                            {allocatedItems.map(item => (
                              <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-shadow shadow-xs group">
                                <span className="font-bold text-slate-700 dark:text-slate-300 lines-clamp-1 flex-1">{item.title}</span>
                                <button 
                                  onClick={() => deallocateItem(item.id)}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20"
                                  title="إلغاء توزيع هذا البند"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            {allocatedItems.length === 0 && (
                              <div className="text-center text-[10px] text-slate-400 italic py-6">
                                محاضرة فارغة
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Footer triggers Personal Plan templates saver */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex justify-between shrink-0">
              <button
                onClick={() => setTrainerPlanCourse(null)}
                className="px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                رجوع للكورسات
              </button>
              <button
                onClick={handleSaveTrainerPlan}
                disabled={savingPlanLoading || !planTrainerId}
                className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-6 py-3 rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingPlanLoading ? 'جاري حفظ خطتي...' : 'حفظ خطة الشرح الفردية للجروبات المقررة!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Strategy Dialog */}
      {showSyncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-right font-arabic">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200 scrollbar-thin">
            {/* Header with Close Button */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
              <h4 className="text-base md:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Layers className="text-primary-600 w-5 h-5 text-primary-500" />
                تحديد نطاق تطبيق التعديل على الجروبات
              </h4>
              <button 
                onClick={() => setShowSyncDialog(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="إغلاق التنبيه"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 font-medium leading-relaxed">
              كيف تريد تطبيق تعديلات الـ Checklist لهذا الكورس على الجروبات الحالية؟ يرجى اختيار الإستراتيجية المناسبة:
            </p>

            <div className="space-y-2.5 mb-6 overflow-y-auto pr-1">
              {[
                {
                  id: 'all',
                  title: 'تطبيق التعديل على كل الجروبات',
                  desc: 'الجروبات التي انتهت، والجروبات الجارية، والجروبات القادمة.'
                },
                {
                  id: 'active_upcoming',
                  title: 'تطبيق التعديل على الجروبات الجارية والقادمة فقط',
                  desc: 'لن يؤثر على الجروبات التي تم أرشفتها أو انتهت بالكامل.'
                },
                {
                  id: 'new',
                  title: 'تطبيق التعديل على الجروبات الجديدة فقط',
                  desc: 'الجروبات التي لم يتم شرح أي محاضرة فيها إطلاقًا.'
                },
                {
                  id: 'template_only',
                  title: 'حفظ كقالب للمستقبل فقط دون التأثير',
                  desc: 'الجروبات الحالية لن تتأثر وتستمر على خطتها القديمة.'
                },
              ].map(opt => (
                <label 
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    syncScope === opt.id 
                      ? 'bg-primary-50/15 border-primary-500 dark:bg-primary-950/20' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="syncScope"
                    checked={syncScope === opt.id}
                    onChange={() => setSyncScope(opt.id as any)}
                    className="accent-primary-600 mt-1"
                  />
                  <div>
                    <strong className="text-xs font-black text-slate-800 dark:text-slate-200 block">{opt.title}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block leading-normal">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
              <button
                onClick={() => setShowSyncDialog(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                تراجع
              </button>
              <button
                onClick={handleSaveChecklist}
                disabled={savingLoading}
                className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-6 py-2.5 rounded-xl flex items-center gap-1 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-55"
              >
                {savingLoading ? 'جاري الحفظ...' : 'حفظ ونشر التعديل!'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={!!courseToDelete}
        onCancel={() => setCourseToDelete(null)}
        onConfirm={confirmDelete}
        entityName={courseToDelete?.name || ''}
        entityType="Course"
        isProcessing={isProcessing}
      />
    </Layout>
  );
};

export default Courses;
