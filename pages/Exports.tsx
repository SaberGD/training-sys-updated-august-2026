
import React, { useState, useRef, useEffect } from 'react';
import { User, Student, Group } from '../types';
import Layout from '../components/Layout';
import { useLanguage } from '../contexts/LanguageContext';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import AIStudentExportModal from '../components/AIStudentExportModal';
import { Bot, Download } from 'lucide-react';

const { collection, getDocs, doc, writeBatch } = firestore as any;

const Exports: React.FC<{ user: User }> = ({ user }) => {
  const { t, lang } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const loadData = async () => {
      try {
        const studentDocs = await fetchCollection('students');
        const groupDocs = await fetchCollection('groups');
        setStudents(studentDocs);
        setGroups(groupDocs);
      } catch (e) {
        console.error("Failed to load export collections:", e);
      }
    };
    loadData();
  }, []);

  const fetchCollection = async (collName: string) => {
    const snap = await getDocs(collection(db, collName));
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  };

  const generateExcelBuffer = (data: any[], sheetName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return excelBuffer;
  };

  const handleFullPackup = async () => {
    setIsProcessing(true);
    setStatus(lang === 'ar' ? 'جاري تجهيز البيانات...' : 'Preparing data...');
    
    try {
      const zip = new JSZip();
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
      
      const collections = [
        { name: 'groups', label: 'Groups' },
        { name: 'students', label: 'Students' },
        { name: 'courses', label: 'Courses' },
        { name: 'users', label: 'Users' },
        { name: 'lectureEvaluations', label: 'LectureEvaluations' },
        { name: 'penalties', label: 'Penalties' },
        { name: 'groupRankings', label: 'Rankings' },
        { name: 'studentFollowUps', label: 'StudentFollowUps' },
        { name: 'labelDefinitions', label: 'LabelDefinitions' },
        { name: 'complaints', label: 'Complaints' },
        { name: 'activityLogs', label: 'ActivityLogs' },
        { name: 'weeks', label: 'Weeks' },
        { name: 'weekDays', label: 'WeekDays' },
        { name: 'scheduleItems', label: 'ScheduleItems' },
        { name: 'sessionMeta', label: 'SessionMeta' }
      ];

      const masterBackup: Record<string, any[]> = {};

      for (const coll of collections) {
        setStatus(lang === 'ar' ? `جاري استخراج: ${coll.label}` : `Exporting: ${coll.label}`);
        const data = await fetchCollection(coll.name);
        masterBackup[coll.name] = data;
        
        const cleanData = data.map(item => {
          const newItem: any = { ...item };
          Object.keys(newItem).forEach(key => {
            if (newItem[key]?.toDate) {
              newItem[key] = newItem[key].toDate().toLocaleString();
            } else if (typeof newItem[key] === 'object' && newItem[key] !== null) {
              newItem[key] = JSON.stringify(newItem[key]);
            }
          });
          return newItem;
        });

        const buffer = generateExcelBuffer(cleanData, coll.label);
        zip.file(`reports/${coll.label}_Report.xlsx`, buffer);
      }

      zip.file('system_restore_data.json', JSON.stringify({
        version: '4.0',
        timestamp: now.toISOString(),
        backup: masterBackup
      }));

      setStatus(lang === 'ar' ? 'جاري ضغط الملف...' : 'Compressing ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SABER_TMS_PACKUP_${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setStatus(lang === 'ar' ? 'تم التحميل بنجاح!' : 'Download complete!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      alert("Packup failed: " + err.message);
      setStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(t('restoreWarning'))) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setStatus(lang === 'ar' ? 'جاري قراءة ملف الاستعادة...' : 'Reading restore file...');

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const restoreFile = contents.file('system_restore_data.json');

      if (!restoreFile) throw new Error(lang === 'ar' ? 'ملف الاستعادة غير موجود.' : 'Restore JSON not found.');

      const jsonStr = await restoreFile.async('string');
      const { backup } = JSON.parse(jsonStr);

      for (const [collName, docs] of Object.entries(backup)) {
        setStatus(lang === 'ar' ? `جاري استعادة: ${collName}` : `Restoring: ${collName}`);
        const dataArray = docs as any[];
        const chunkSize = 400;
        for (let i = 0; i < dataArray.length; i += chunkSize) {
          const chunk = dataArray.slice(i, i + chunkSize);
          const chunkBatch = writeBatch(db);
          chunk.forEach(d => {
            const { id, ...data } = d;
            Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
            const docRef = doc(db, collName, id);
            chunkBatch.set(docRef, data, { merge: true });
          });
          await chunkBatch.commit();
        }
      }

      setStatus(t('restoreSuccess'));
      alert(t('restoreSuccess'));
      window.location.reload();
    } catch (err: any) {
      setStatus(t('restoreError'));
      alert(t('restoreError') + ": " + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Layout user={user}>
      <div className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">{t('exports')}</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Archive system state or restore from previous backup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* AI Assistant Student Exporter Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-10 rounded-4xl border border-indigo-500/30 shadow-xl flex flex-col items-center text-center text-white relative overflow-hidden group transition-all hover:border-indigo-400">
          <div className="w-20 h-20 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-3xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
            🤖
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3">
            SABER GROUP AI
          </div>
          <h2 className="text-xl font-black mb-3">تصدير الطلاب للمساعد الذكي</h2>
          <p className="text-xs text-slate-300 mb-8 leading-relaxed">
            استخراج ملف Excel (.xlsx) أو CSV بأسماء وأكواد وكلمات مرور المتدربين جاهزة للتغذية المباشرة.
          </p>
          <button 
            onClick={() => setIsAIModalOpen(true)}
            className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-auto"
          >
            <Download size={16} />
            <span>تصدير الشيت الآن ({students.length} طالب)</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-10 rounded-4xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center group transition-all hover:shadow-xl">
          <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-3xl flex items-center justify-center text-4xl mb-8 group-hover:scale-110 transition-transform">📦</div>
          <h2 className="text-2xl font-black mb-4">{t('fullPackup')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xs leading-relaxed">{lang === 'ar' ? 'تحميل كافة بيانات النظام في ملف مضغوط واحد.' : 'Download all system data in a single compressed ZIP file.'}</p>
          <button onClick={handleFullPackup} disabled={isProcessing} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 mt-auto ${isProcessing ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
            {isProcessing && status.includes('Exporting') ? status : t('fullPackup')}
          </button>
        </div>

        {isAdmin && (
          <div className="bg-slate-950 rounded-4xl p-10 text-white relative overflow-hidden border border-white/5 flex flex-col justify-center">
            <div className="relative z-10 flex flex-col h-full items-center text-center justify-between">
              <div className="w-20 h-20 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center text-4xl mb-6">
                🛡️
              </div>
              <div>
                <div className="inline-block px-4 py-1.5 rounded-full bg-amber-600/20 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-4">Administrative</div>
                <h3 className="text-xl font-black mb-3">{t('importBackup')}</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-8">Restore the entire system using a previously downloaded Packup ZIP file.</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip" />
              <button onClick={handleImportClick} disabled={isProcessing} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all active:scale-95 mt-auto ${isProcessing ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
                {isProcessing && status.includes('Restoring') ? status : t('importBackup')}
              </button>
            </div>
          </div>
        )}
      </div>

      <AIStudentExportModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        allStudents={students}
        groups={groups}
      />

      {status && isProcessing && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex items-center gap-4">
           <div className="w-3 h-3 bg-primary-600 rounded-full animate-ping"></div>
           <span className="text-xs font-black text-white uppercase tracking-widest">{status}</span>
        </div>
      )}
    </Layout>
  );
};

export default Exports;
