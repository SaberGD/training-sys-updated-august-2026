
import React, { useState, useEffect } from 'react';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { Group, User, Course } from '../types';
import { updateGroup, generateGroupSessions, regenerateUpcomingSessions, logActivity, initializeGroupExecutionPlan } from '../services/firestore';

const { collection, addDoc, serverTimestamp } = firestore as any;

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  editingGroup?: Group | null;
  courses: Course[];
  trainers: User[];
  onSuccess: () => void;
}

const GroupModal: React.FC<GroupModalProps> = ({ 
  isOpen, onClose, user, editingGroup, courses, trainers, onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    courseId: '',
    startDate: '',
    daysOfWeek: [] as string[],
    totalSessions: 22,
    sessionTime: '19:00',
    primaryTrainerId: '',
    secondaryTrainerId: '',
    assistantTrainerId: '',
    supervisorId: '',
    regenerateSessions: false,
    telegramLink: '',
    telegramRecordsLink: '',
    whatsappLink: '',
    groupType: 'online' as 'online' | 'offline',
    feedbackSessionsStr: '1, 4, 7, 10, 13, 16, 19, 22',
    calendarInvitationMode: '24h_before' as 'all_at_creation' | '24h_before'
  });

  useEffect(() => {
    if (editingGroup) {
      setFormData({
        name: editingGroup.name,
        courseId: editingGroup.courseId,
        startDate: editingGroup.startDate,
        daysOfWeek: editingGroup.daysOfWeek,
        totalSessions: editingGroup.totalSessions,
        sessionTime: editingGroup.sessionTime,
        primaryTrainerId: editingGroup.primaryTrainerId || editingGroup.trainerIds?.[0] || '',
        secondaryTrainerId: editingGroup.secondaryTrainerId || editingGroup.trainerIds?.[1] || '',
        assistantTrainerId: editingGroup.assistantTrainerId || '',
        supervisorId: editingGroup.supervisorId || '',
        regenerateSessions: false,
        telegramLink: editingGroup.telegramLink || '',
        telegramRecordsLink: editingGroup.telegramRecordsLink || '',
        whatsappLink: editingGroup.whatsappLink || '',
        groupType: editingGroup.groupType || 'online',
        feedbackSessionsStr: editingGroup.feedbackSessions?.join(', ') || '1, 4, 7, 10, 13, 16, 19, 22',
        calendarInvitationMode: editingGroup.calendarInvitationMode || '24h_before'
      });
    } else {
      setFormData({
        name: '',
        courseId: '',
        startDate: '',
        daysOfWeek: [],
        totalSessions: 22,
        sessionTime: '19:00',
        primaryTrainerId: '',
        secondaryTrainerId: '',
        assistantTrainerId: '',
        supervisorId: '',
        regenerateSessions: false,
        telegramLink: '',
        telegramRecordsLink: '',
        whatsappLink: '',
        groupType: 'online',
        feedbackSessionsStr: '1, 4, 7, 10, 13, 16, 19, 22',
        calendarInvitationMode: '24h_before'
      });
    }
    setShowAdvanced(false);
  }, [editingGroup, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedCourse = courses.find(c => c.id === formData.courseId);
      const selectedSupervisor = trainers.find(t => t.uid === formData.supervisorId);
      const selectedAssistantTrainer = trainers.find(t => t.uid === formData.assistantTrainerId);
      
      const parsedFeedbackSessions = formData.feedbackSessionsStr
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));

      const computedTrainerIds = Array.from(new Set([formData.primaryTrainerId, formData.secondaryTrainerId, formData.assistantTrainerId].filter(Boolean)));

      if (editingGroup) {
        // Edit Mode
        const hasCourseChanged = formData.courseId && formData.courseId !== editingGroup.courseId;

        const updatedFields: any = {
          name: formData.name,
          startDate: formData.startDate,
          daysOfWeek: formData.daysOfWeek,
          totalSessions: formData.totalSessions,
          sessionTime: formData.sessionTime,
          trainerIds: computedTrainerIds,
          primaryTrainerId: formData.primaryTrainerId,
          secondaryTrainerId: formData.secondaryTrainerId || null,
          assistantTrainerId: formData.assistantTrainerId || null,
          assistantTrainerName: selectedAssistantTrainer?.name || null,
          supervisorId: formData.supervisorId || null,
          supervisorName: selectedSupervisor?.name || null,
          telegramLink: formData.telegramLink,
          telegramRecordsLink: formData.telegramRecordsLink,
          whatsappLink: formData.whatsappLink,
          groupType: formData.groupType,
          feedbackSessions: parsedFeedbackSessions,
          calendarInvitationMode: formData.calendarInvitationMode
        };

        if (hasCourseChanged) {
          updatedFields.courseId = formData.courseId;
          updatedFields.courseName = selectedCourse?.name || '';
        }

        await updateGroup(editingGroup.id, updatedFields, user);

        if (hasCourseChanged) {
          // Re-initialize execution plan with new course checklist & trainer allocations
          await initializeGroupExecutionPlan(editingGroup.id, formData.courseId, computedTrainerIds[0], user);

          // Update courseName on all student records for this group
          try {
            const { query, where, getDocs, updateDoc, doc } = firestore as any;
            const qSts = query(collection(db, 'students'), where('groupId', '==', editingGroup.id));
            const stsSnap = await getDocs(qSts);
            stsSnap.docs.forEach((sDoc: any) => {
              updateDoc(doc(db, 'students', sDoc.id), { courseName: selectedCourse?.name || '' })
                .catch((err: any) => console.error("Error updating student courseName:", err));
            });
          } catch (stErr) {
            console.error("Error batch updating student courseName:", stErr);
          }

          // Log course change activity
          await logActivity({
            action: 'GROUP_COURSE_CHANGE',
            entityType: 'group',
            entityId: editingGroup.id,
            entityName: formData.name,
            performedByUid: user.uid,
            performedByName: user.name,
            performedByRole: user.role,
            details: {
              oldCourseId: editingGroup.courseId,
              oldCourseName: editingGroup.courseName,
              newCourseId: formData.courseId,
              newCourseName: selectedCourse?.name || ''
            }
          });
        }

        if (formData.regenerateSessions || hasCourseChanged) {
          const fullUpdatedGroup = { ...editingGroup, ...updatedFields } as Group;
          await regenerateUpcomingSessions(editingGroup.id, fullUpdatedGroup);
        }
      } else {
        // Create Mode
        const groupData = {
          name: formData.name,
          courseId: formData.courseId,
          courseName: selectedCourse?.name || '',
          startDate: formData.startDate,
          daysOfWeek: formData.daysOfWeek,
          totalSessions: formData.totalSessions,
          sessionTime: formData.sessionTime,
          trainerIds: computedTrainerIds,
          primaryTrainerId: formData.primaryTrainerId,
          secondaryTrainerId: formData.secondaryTrainerId || null,
          assistantTrainerId: formData.assistantTrainerId || null,
          assistantTrainerName: selectedAssistantTrainer?.name || null,
          supervisorId: formData.supervisorId || null,
          supervisorName: selectedSupervisor?.name || null,
          telegramLink: formData.telegramLink,
          telegramRecordsLink: formData.telegramRecordsLink,
          whatsappLink: formData.whatsappLink,
          groupType: formData.groupType,
          feedbackSessions: parsedFeedbackSessions,
          calendarInvitationMode: formData.calendarInvitationMode,
          createdAt: serverTimestamp()
        };
        
        const groupDocRef = await addDoc(collection(db, 'groups'), groupData);
        
        await logActivity({
          action: 'GROUP_CREATE',
          entityType: 'group',
          entityId: groupDocRef.id,
          entityName: formData.name,
          performedByUid: user.uid,
          performedByName: user.name,
          performedByRole: user.role,
          details: { courseId: formData.courseId }
        });

        await generateGroupSessions({ id: groupDocRef.id, ...groupData } as Group);
        
        await initializeGroupExecutionPlan(groupDocRef.id, formData.courseId, computedTrainerIds[0], user);
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {editingGroup ? 'Edit Training Batch' : 'Create New Group'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Group Name / Code</label>
              <input
                type="text" required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 2601"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Course / المسار الفني للكورس</label>
              <select
                required
                value={formData.courseId}
                onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-xs"
              >
                <option value="">Choose a course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {editingGroup && formData.courseId !== editingGroup.courseId && (
                <div className="mt-2.5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 font-arabic text-right text-[11px] leading-relaxed space-y-1 shadow-sm">
                  <div className="flex items-center gap-1.5 font-black text-amber-800">
                    <span>🔄 تغيير نوع الكورس وإعادة هيكلة الجروب:</span>
                  </div>
                  <p>
                    سيتم تحويل الجروب إلى كورس <strong>"{courses.find(c => c.id === formData.courseId)?.name}"</strong> وإعادة رسم جدول المحاضرات والخطة التعليمية تلقائياً.
                  </p>
                  <p className="text-[10px] text-amber-700 font-bold">
                    ✅ تنبيه: سيتم الاحتفاظ بجميع بيانات الطلاب الحالية، وأرقام الـ ID، وكلمات المرور، ونقاط الحضور والتاسكات كما هي تماماً دون تغيير.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Start Date</label>
              <input
                type="date" required
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Session Time</label>
              <input
                type="time" required
                value={formData.sessionTime}
                onChange={(e) => setFormData({...formData, sessionTime: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Total Sessions</label>
              <input
                type="number" required min="1"
                value={formData.totalSessions}
                onChange={(e) => setFormData({...formData, totalSessions: parseInt(e.target.value)})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div className="col-span-2">
            <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Group Supervisor (Optional)</label>
            <select
              value={formData.supervisorId}
              onChange={(e) => setFormData({...formData, supervisorId: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">No Supervisor</option>
              {trainers.filter(t => ['admin', 'coordinator', 'team_leader'].includes(t.role)).map(t => (
                <option key={t.uid} value={t.uid}>{t.name} ({t.role.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 tracking-wider">Group Type / نوع الجروب</label>
              <select
                value={formData.groupType}
                onChange={(e) => setFormData({...formData, groupType: e.target.value as 'online' | 'offline'})}
                className="w-full px-4 py-2 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
              >
                <option value="online">Online 🌐 (أونلاين)</option>
                <option value="offline">Offline 🏢 (مقر الأكاديمية)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 tracking-wider">Evaluation Timing / محاضرات التقييم</label>
              <input
                type="text" required
                value={formData.feedbackSessionsStr}
                onChange={(e) => setFormData({...formData, feedbackSessionsStr: e.target.value})}
                className="w-full px-4 py-2 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                placeholder="e.g. 1, 4, 7, 10, 13, 16"
              />
            </div>
            <p className="col-span-2 text-[10px] text-slate-500 leading-normal font-medium">
              * سيطلب النظام تقييم الطلاب للمحاضرة بعد المحاضرات المحددة أعلاه (افتراضياً: الأولى ورقم 4 ورقم 7 ثم كل 3 محاضرات).
            </p>

            <div className="col-span-2 pt-3 border-t border-slate-200/80 font-arabic text-right" dir="rtl">
              <label className="block text-xs font-black text-indigo-900 uppercase mb-1 tracking-wider">
                📅 Calendar Invitation Mode / نظام إرسال دعوات التقويم للطلاب
              </label>
              <p className="text-[10px] text-slate-500 font-bold mb-2.5">
                تحديد كيفية وتوقيت إرسال دعوات تقويم Google للحسابات وتأكيدات الحضور
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  formData.calendarInvitationMode === '24h_before'
                    ? 'bg-white border-indigo-600 shadow-sm text-indigo-950 font-black'
                    : 'bg-slate-100/70 border-slate-200 text-slate-600 font-bold'
                }`}>
                  <input
                    type="radio"
                    name="calendarInvitationMode"
                    value="24h_before"
                    checked={formData.calendarInvitationMode === '24h_before'}
                    onChange={() => setFormData({ ...formData, calendarInvitationMode: '24h_before' })}
                    className="w-4 h-4 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs">إرسال الدعوة قبل المحاضرة بـ 24 ساعة (افتراضي) ⏰</span>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  formData.calendarInvitationMode === 'all_at_creation'
                    ? 'bg-white border-indigo-600 shadow-sm text-indigo-950 font-black'
                    : 'bg-slate-100/70 border-slate-200 text-slate-600 font-bold'
                }`}>
                  <input
                    type="radio"
                    name="calendarInvitationMode"
                    value="all_at_creation"
                    checked={formData.calendarInvitationMode === 'all_at_creation'}
                    onChange={() => setFormData({ ...formData, calendarInvitationMode: 'all_at_creation' })}
                    className="w-4 h-4 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs">إرسال كل الدعوات عند إنشاء الجروب 🚀</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 col-span-2">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Telegram Group Link</label>
              <input
                type="url"
                value={formData.telegramLink}
                onChange={(e) => setFormData({...formData, telegramLink: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                placeholder="https://t.me/join..."
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">WhatsApp Group Link</label>
              <input
                type="url"
                value={formData.whatsappLink}
                onChange={(e) => setFormData({...formData, whatsappLink: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Telegram Records Link</label>
              <input
                type="url"
                value={formData.telegramRecordsLink}
                onChange={(e) => setFormData({...formData, telegramRecordsLink: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                placeholder="https://t.me/..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Days of Week</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <button
                  key={day} type="button"
                  onClick={() => {
                    const days = formData.daysOfWeek.includes(day) 
                      ? formData.daysOfWeek.filter(d => d !== day)
                      : [...formData.daysOfWeek, day];
                    setFormData({...formData, daysOfWeek: days});
                  }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border transition-all ${
                    formData.daysOfWeek.includes(day)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200/50 font-arabic text-right" dir="rtl">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">المدربون المسؤولون وطاقم التدريب 👨‍🏫</label>
              <p className="text-[10px] text-slate-400 font-bold mb-3">يمكن اختيار المدرب الأساسي، وكذلك تعيين مدرب ثانوي أو مدرب مُساعد للجروب (اختياري).</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 tracking-wider">المدرب الأساسي *</label>
                <select
                  required
                  value={formData.primaryTrainerId}
                  onChange={(e) => setFormData({...formData, primaryTrainerId: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                >
                  <option value="">اختر المدرب الأساسي...</option>
                  {trainers.filter(t => ['trainer', 'team_leader', 'admin'].includes(t.role)).map(t => (
                    <option key={t.uid} value={t.uid}>{t.name} ({t.role === 'admin' ? 'مدير' : t.role === 'team_leader' ? 'تيم ليدر' : 'مدرب'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 tracking-wider">المدرب الثانوي (اختياري)</label>
                <select
                  value={formData.secondaryTrainerId}
                  onChange={(e) => setFormData({...formData, secondaryTrainerId: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                >
                  <option value="">لا يوجد مدرب ثانوي</option>
                  {trainers.filter(t => ['trainer', 'team_leader', 'admin'].includes(t.role) && t.uid !== formData.primaryTrainerId && t.uid !== formData.assistantTrainerId).map(t => (
                    <option key={t.uid} value={t.uid}>{t.name} ({t.role === 'admin' ? 'مدير' : t.role === 'team_leader' ? 'تيم ليدر' : 'مدرب'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-emerald-700 uppercase mb-1.5 tracking-wider flex items-center gap-1">
                  <span>المدرب المُساعد (اختياري)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black">Co-Trainer</span>
                </label>
                <select
                  value={formData.assistantTrainerId}
                  onChange={(e) => setFormData({...formData, assistantTrainerId: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xs"
                >
                  <option value="">لا يوجد مدرب مساعد</option>
                  {trainers.filter(t => ['trainer', 'team_leader', 'admin', 'coordinator'].includes(t.role) && t.uid !== formData.primaryTrainerId && t.uid !== formData.secondaryTrainerId).map(t => (
                    <option key={t.uid} value={t.uid}>{t.name} ({t.role === 'admin' ? 'مدير' : t.role === 'team_leader' ? 'تيم ليدر' : t.role === 'coordinator' ? 'منسق' : 'مدرب'})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {editingGroup && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                {showAdvanced ? '▼ hide advanced settings' : '▶ show advanced settings'}
              </button>
              
              {showAdvanced && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="regenSessions"
                      checked={formData.regenerateSessions}
                      onChange={(e) => setFormData({...formData, regenerateSessions: e.target.checked})}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="regenSessions" className="text-xs font-bold text-amber-800 cursor-pointer">
                      Regenerate Future Sessions
                    </label>
                  </div>
                  <p className="text-[10px] text-amber-600 leading-relaxed font-medium">
                    Warning: This will delete all "Upcoming" sessions and create new ones based on the updated days and start date. "Done" sessions and their evaluations will NOT be affected.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? 'Processing...' : editingGroup ? 'Update Batch' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupModal;
