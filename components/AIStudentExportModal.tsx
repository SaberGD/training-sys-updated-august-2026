import React, { useState, useEffect } from 'react';
import { Student, Group } from '../types';
import * as XLSX from 'xlsx';
import { X, Download, Bot, FileSpreadsheet, FileText, CheckCircle2, RefreshCw, Calendar, Users, Sparkles, Filter } from 'lucide-react';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';

const { collection, getDocs, doc, getDoc, setDoc } = firestore as any;

interface AIStudentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allStudents?: Student[];
  filteredStudents?: Student[];
  groups?: Group[];
}

export interface AIExportInfo {
  timestamp: string;
  count: number;
  exportedBy?: string;
}

export const exportStudentsForAI = (
  students: Student[],
  groups: Group[],
  format: 'xlsx' | 'csv',
  headerType: 'english_keys' | 'arabic_headers'
) => {
  const data = students.map(s => {
    const group = groups.find(g => g.id === s.groupId);
    const groupName = group ? group.name : '';
    const studentId = s.studentIdNum || s.id || '';
    const name = s.name || '';
    const password = s.studentPassword || '123456';
    const phone = s.phone || '';
    const email = s.email || '';

    if (headerType === 'arabic_headers') {
      return {
        'كود الطالب': studentId,
        'اسم الطالب': name,
        'كلمة المرور': password,
        'المجموعة': groupName,
        'رقم الهاتف': phone,
        'البريد الإلكتروني': email
      };
    } else {
      return {
        studentId,
        name,
        password,
        groupName,
        phone,
        email
      };
    }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `SABER_GROUP_AI_STUDENTS_${timestamp}.${format}`;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    // Add UTF-8 BOM so Arabic text opens cleanly in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    XLSX.writeFile(wb, filename);
  }
};

const parseStudentCreatedTime = (student: Student): number => {
  if (!student.createdAt) return 0;
  if (typeof student.createdAt === 'string') {
    const t = new Date(student.createdAt).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (typeof student.createdAt === 'number') return student.createdAt;
  if (student.createdAt?.toDate && typeof student.createdAt.toDate === 'function') {
    return student.createdAt.toDate().getTime();
  }
  if (student.createdAt?.seconds) {
    return student.createdAt.seconds * 1000;
  }
  return 0;
};

const AIStudentExportModal: React.FC<AIStudentExportModalProps> = ({
  isOpen,
  onClose,
  allStudents: initialStudents,
  filteredStudents,
  groups: initialGroups
}) => {
  const [dbStudents, setDbStudents] = useState<Student[]>(initialStudents || []);
  const [dbGroups, setDbGroups] = useState<Group[]>(initialGroups || []);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [lastExportInfo, setLastExportInfo] = useState<AIExportInfo | null>(null);

  const [exportScope, setExportScope] = useState<'all_db' | 'group' | 'new_only' | 'filtered'>('all_db');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupSearchTerm, setGroupSearchTerm] = useState<string>('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [headerType, setHeaderType] = useState<'english_keys' | 'arabic_headers'>('english_keys');
  const [downloaded, setDownloaded] = useState<boolean>(false);

  // Fetch all students directly from Firestore when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchAllDataDirectly = async () => {
      setIsLoadingDb(true);
      try {
        // 1. Fetch last export info from localStorage & Firestore
        let savedExportInfo: AIExportInfo | null = null;
        const localSaved = localStorage.getItem('SABER_AI_LAST_EXPORT_INFO');
        if (localSaved) {
          try { savedExportInfo = JSON.parse(localSaved); } catch (e) {}
        }

        try {
          const exportDoc = await getDoc(doc(db, 'systemSettings', 'aiExport'));
          if (exportDoc.exists()) {
            const data = exportDoc.data();
            if (data?.timestamp) {
              savedExportInfo = {
                timestamp: data.timestamp,
                count: data.count || 0,
                exportedBy: data.exportedBy || ''
              };
            }
          }
        } catch (e) {
          console.warn('Failed to fetch systemSettings/aiExport:', e);
        }

        setLastExportInfo(savedExportInfo);

        // 2. Fetch ALL students directly from Firestore (no pagination limits)
        const studentSnap = await getDocs(collection(db, 'students'));
        const fetchedStudents: Student[] = studentSnap.docs.map((d: any) => ({
          id: d.id,
          ...d.data()
        }));

        // 3. Fetch ALL groups directly from Firestore
        const groupSnap = await getDocs(collection(db, 'groups'));
        const fetchedGroups: Group[] = groupSnap.docs.map((d: any) => ({
          id: d.id,
          ...d.data()
        }));

        setDbStudents(fetchedStudents);
        setDbGroups(fetchedGroups);
      } catch (err) {
        console.error("Error fetching all students for AI export:", err);
      } finally {
        setIsLoadingDb(false);
      }
    };

    fetchAllDataDirectly();
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate new students added after last export timestamp
  const lastExportTimeMs = lastExportInfo?.timestamp ? new Date(lastExportInfo.timestamp).getTime() : 0;
  const newStudents = dbStudents.filter(s => {
    if (!lastExportTimeMs) return true;
    const createdMs = parseStudentCreatedTime(s);
    if (createdMs > 0) {
      return createdMs > lastExportTimeMs;
    }
    // If no creation timestamp is available on student, include them to be safe
    return true;
  });

  // Calculate group students
  const selectedGroupObj = dbGroups.find(g => g.id === selectedGroupId);
  const groupStudents = selectedGroupId ? dbStudents.filter(s => s.groupId === selectedGroupId) : [];

  // Determine target students list to export
  let targetStudents = dbStudents;
  if (exportScope === 'group') {
    targetStudents = groupStudents;
  } else if (exportScope === 'new_only' && lastExportTimeMs > 0) {
    targetStudents = newStudents;
  } else if (exportScope === 'filtered' && filteredStudents && filteredStudents.length > 0) {
    targetStudents = filteredStudents;
  }

  const handleExport = async () => {
    exportStudentsForAI(targetStudents, dbGroups, format, headerType);

    // Record last export info
    const nowIso = new Date().toISOString();
    const newExportInfo: AIExportInfo = {
      timestamp: nowIso,
      count: targetStudents.length,
      exportedBy: 'Saber Group Admin'
    };

    setLastExportInfo(newExportInfo);
    localStorage.setItem('SABER_AI_LAST_EXPORT_INFO', JSON.stringify(newExportInfo));

    try {
      await setDoc(doc(db, 'systemSettings', 'aiExport'), newExportInfo, { merge: true });
    } catch (e) {
      console.error("Failed to update systemSettings/aiExport:", e);
    }

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3500);
  };

  const formatExportDate = (isoStr: string) => {
    if (!isoStr) return 'لم يتم التصدير من قبل';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoStr;
    }
  };

  const previewList = targetStudents.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white flex items-center justify-between border-b border-indigo-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
                تصدير بيانات الطلاب للمساعد الذكي
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-bold uppercase">
                  SABER GROUP AI
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                تأكيد جلب 100% من طلاب السيستم وتجهيز الشيت بالتنسيق المطلوب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Database Fetching Status Banner */}
          {isLoadingDb ? (
            <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-black">جاري الاستعلام المباشر من قاعدة البيانات...</p>
                <p className="text-[11px] opacity-80">يتم الآن سحب كافة الطلاب المسجلين بالسيستم من الأول للأخير دون استثناء</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي طلاب الداتا بيز بالسيستم</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{dbStudents.length} طالب مسجل</p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pr-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تاريخ آخر تصدير للذكاء الاصطناعي</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {lastExportInfo ? formatExportDate(lastExportInfo.timestamp) : 'لم يتم التصدير سابقاً'}
                  </p>
                  {lastExportInfo && (
                    <p className="text-[10px] text-slate-400 font-semibold">
                      (تم تصدير {lastExportInfo.count} طالب في آخر عملية)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Export Scope Selector (Full vs Incremental vs Filtered) */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              1. حدد نطاق الطلاب المراد تصديرهم (Export Range)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Option A: Full Database Export */}
              <button
                type="button"
                onClick={() => setExportScope('all_db')}
                className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                  exportScope === 'all_db'
                    ? 'bg-indigo-600/10 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  exportScope === 'all_db' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                }`}>
                  {exportScope === 'all_db' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs">سحب كافة الطلاب بالسيستم (تصدير كامل)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                      {dbStudents.length} طالب
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    استخراج كافة الطلاب من أصل الداتا بيز من أول طالب لأخر طالب.
                  </p>
                </div>
              </button>

              {/* Option B: Filter by Specific Group */}
              <button
                type="button"
                onClick={() => {
                  setExportScope('group');
                  if (!selectedGroupId && dbGroups.length > 0) {
                    setSelectedGroupId(dbGroups[0].id);
                  }
                }}
                className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                  exportScope === 'group'
                    ? 'bg-blue-600/10 border-blue-600 text-blue-950 dark:text-blue-200 shadow-md ring-2 ring-blue-500/30'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  exportScope === 'group' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                }`}>
                  {exportScope === 'group' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-xs">تصدير طلاب جروب / مجموعة محددة 🎯</span>
                    {selectedGroupId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                        {groupStudents.length} طالب
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    فلترة واستخراج متدربي دفعة/جروب معين فقط للذكاء الاصطناعي مارو.
                  </p>
                </div>
              </button>

              {/* Option C: Incremental Export (New Students Only) */}
              <button
                type="button"
                onClick={() => setExportScope('new_only')}
                disabled={!lastExportInfo}
                className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                  !lastExportInfo
                    ? 'opacity-50 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                    : exportScope === 'new_only'
                    ? 'bg-purple-600/10 border-purple-600 text-purple-950 dark:text-purple-200 shadow-md ring-2 ring-purple-500/30'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  exportScope === 'new_only' ? 'border-purple-600 bg-purple-600' : 'border-slate-400'
                }`}>
                  {exportScope === 'new_only' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs">المستجدين فقط بعد آخر تصدير</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold">
                      {newStudents.length} طالب مستجد
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {lastExportInfo 
                      ? `استخراج الطلاب المضافين فقط بعد تاريخ ${formatExportDate(lastExportInfo.timestamp)}`
                      : 'لا توجد عملية تصدير سابقة لاستخراج المستجدين بناءً عليها'}
                  </p>
                </div>
              </button>

              {/* Option D: Filtered Students (if available) */}
              {filteredStudents && filteredStudents.length > 0 && filteredStudents.length !== dbStudents.length && (
                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer col-span-1 md:col-span-2 ${
                    exportScope === 'filtered'
                      ? 'bg-emerald-600/10 border-emerald-600 text-emerald-950 dark:text-emerald-200 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    exportScope === 'filtered' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400'
                  }`}>
                    {exportScope === 'filtered' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs">الطلاب المفلترين بجدول الشاشة الحالية فقط</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                        {filteredStudents.length} طالب
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      تصدير القائمة المعروضة حالياً وفق الفلاتر والبحث في جدول الشاشة.
                    </p>
                  </div>
                </button>
              )}

            </div>

            {/* Group Selector Dropdown when exportScope === 'group' */}
            {exportScope === 'group' && (
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/30 space-y-3 mt-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <span>اختر المجموعة / الجروب المراد تصديره:</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {groupStudents.length} طالب في هذه المجموعة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="🔍 ابحث عن اسم المجموعة أو الكود..."
                      value={groupSearchTerm}
                      onChange={e => setGroupSearchTerm(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={selectedGroupId}
                      onChange={e => setSelectedGroupId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- اختر مجموعة --</option>
                      {dbGroups
                        .filter(g => {
                          if (!groupSearchTerm) return true;
                          const term = groupSearchTerm.toLowerCase();
                          return g.name?.toLowerCase().includes(term) || g.batchCode?.toLowerCase().includes(term);
                        })
                        .map(g => {
                          const count = dbStudents.filter(s => s.groupId === g.id).length;
                          return (
                            <option key={g.id} value={g.id}>
                              {g.name} {g.batchCode ? `(${g.batchCode})` : ''} - [{count} طالب]
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {selectedGroupObj && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between pt-1 border-t border-blue-500/20">
                    <span>المجموعة المختارة: <strong>{selectedGroupObj.name}</strong></span>
                    <span>كود الدفعة: <strong>{selectedGroupObj.batchCode || 'غير محدد'}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options Grid (Format & Header) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Format Option */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-2">
              <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                2. صيغة الملف (File Format)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('xlsx')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    format === 'xlsx'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('csv')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    format === 'csv'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  CSV (.csv)
                </button>
              </div>
            </div>

            {/* Header Language Option */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-2">
              <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                3. أسماء الأعمدة في الصف الأول (Header)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHeaderType('english_keys')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                    headerType === 'english_keys'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span>studentId, name, ...</span>
                  <span className="text-[10px] opacity-80">(Standard AI Keys)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHeaderType('arabic_headers')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                    headerType === 'arabic_headers'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span>كود الطالب، اسم الطالب...</span>
                  <span className="text-[10px] opacity-80">(عناوين عربية)</span>
                </button>
              </div>
            </div>

          </div>

          {/* Table Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                👀 معاينة نموذجية للبيانات المستخرجة ({targetStudents.length} طالب)
              </label>
              <span className="text-[11px] text-slate-400 font-semibold">تعيين 123456 عند غياب الباسوورد تلقائياً</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'studentId' : 'كود الطالب'}
                    </th>
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'name' : 'اسم الطالب'}
                    </th>
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'password' : 'كلمة المرور'}
                    </th>
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'groupName' : 'المجموعة'}
                    </th>
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'phone' : 'رقم الهاتف'}
                    </th>
                    <th className="p-2.5">
                      {headerType === 'english_keys' ? 'email' : 'البريد الإلكتروني'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                  {previewList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                        {isLoadingDb ? 'جاري التحميل من قاعدة البيانات...' : 'لا يوجد طلاب مطابقين للشروط المحددة'}
                      </td>
                    </tr>
                  ) : (
                    previewList.map(s => {
                      const group = dbGroups.find(g => g.id === s.groupId);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                            {s.studentIdNum || s.id}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                            {s.name}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {s.studentPassword || '123456'}
                          </td>
                          <td className="p-2.5">
                            {group ? group.name : '-'}
                          </td>
                          <td className="p-2.5 font-mono">
                            {s.phone || '-'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            {s.email || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs transition-all cursor-pointer"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isLoadingDb || targetStudents.length === 0}
            className={`px-6 py-3 rounded-2xl font-black text-xs text-white shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
              downloaded
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
            } ${isLoadingDb || targetStudents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {downloaded ? (
              <>
                <CheckCircle2 className="w-4 h-4 animate-bounce" />
                <span>تم التحميل وحفظ تاريخ التصدير بنجاح! 🎉</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تنزيل شيت ({targetStudents.length} طالب) ({format.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AIStudentExportModal;
