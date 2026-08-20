import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Student, User, Group, StudentFollowUp, Penalty, Complaint, LabelDefinition 
} from '../types';
import { 
  saveStudent, 
  triggerStudentWelcomeEmail,
  submitTrainerFollowUpUpdate,
  requestFollowUp
} from '../services/firestore';
import Layout from '../components/Layout';
import StudentStatusModal from '../components/StudentStatusModal';
import AIStudentExportModal from '../components/AIStudentExportModal';
import { 
  Search, User as UserIcon, Phone, Mail, GraduationCap, Clock, 
  Copy, Check, Send, AlertTriangle, Printer, ExternalLink, MessageSquare, 
  ShieldAlert, RefreshCw, Key, Filter, Tag, CheckCircle2, XCircle, FileText,
  Calendar, Layers, Edit, Sparkles, ChevronRight, Loader2, Database, Bot
} from 'lucide-react';

const { collection, getDocs, getDoc, doc, query, where, limit } = firestore as any;

interface StudentDirectoryProps {
  user: User;
}

const getCleanDigitsOnly = (str?: string) => {
  if (!str) return '';
  return str.replace(/\D/g, '');
};

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || searchParams.get('id') || '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAIExportModalOpen, setIsAIExportModalOpen] = useState(false);

  // Local Cache Stores (Prevents unnecessary database reads)
  const [studentCacheMap, setStudentCacheMap] = useState<Map<string, Student>>(new Map());
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  
  // Per-student lazy cached records
  const [followUpCacheMap, setFollowUpCacheMap] = useState<Map<string, StudentFollowUp[]>>(new Map());
  const [penaltyCacheMap, setPenaltyCacheMap] = useState<Map<string, Penalty[]>>(new Map());
  const [complaintCacheMap, setComplaintCacheMap] = useState<Map<string, Complaint[]>>(new Map());
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Search & Loading Status
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'info' | 'group' | 'followups' | 'penalties' | 'complaints' | 'history'>('info');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);

  const [selectedStudentForStatusChange, setSelectedStudentForStatusChange] = useState<Student | null>(null);
  
  // Quick Add Follow-up Note state
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    attendanceEmail: '',
    groupId: '',
    tasksLink: '',
    whatsappLink: ''
  });

  // Lazy Fetch Groups on Demand (Cached)
  const fetchGroupsIfNeeded = useCallback(async (): Promise<Group[]> => {
    if (groupsLoaded && groups.length > 0) return groups;
    try {
      const snap = await getDocs(collection(db, 'groups'));
      const items: Group[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setGroups(items);
      setGroupsLoaded(true);
      return items;
    } catch (err) {
      console.error("Error fetching groups:", err);
      return [];
    }
  }, [groups, groupsLoaded]);

  // Lazy Fetch Users on Demand (Cached)
  const fetchUsersIfNeeded = useCallback(async () => {
    if (usersLoaded) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      const items: User[] = snap.docs.map((d: any) => ({ uid: d.id, id: d.id, ...d.data() }));
      setAllUsers(items);
      setUsersLoaded(true);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, [usersLoaded]);

  // Execute Targeted Search in Firestore with Cache Saving
  const performSearch = useCallback(async (
    overrideTerm?: string, 
    overrideGroupId?: string, 
    forceRefresh = false
  ) => {
    const term = (overrideTerm !== undefined ? overrideTerm : searchTerm).trim();
    const groupId = overrideGroupId !== undefined ? overrideGroupId : selectedGroupId;

    setHasSearched(true);
    setIsSearching(true);
    setSearchError(null);

    // Ensure groups are loaded for display names
    await fetchGroupsIfNeeded();

    try {
      const fetchedStudents: Student[] = [];

      // If user selected a group, query students in that group
      if (groupId) {
        const qGroup = query(collection(db, 'students'), where('groupId', '==', groupId));
        const snap = await getDocs(qGroup);
        snap.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));
      }
      
      // If term looks like ID / studentIdNum or phone or email
      if (term) {
        const cleanDigits = getCleanDigitsOnly(term);

        // 1. Try studentIdNum match
        const qIdNum = query(collection(db, 'students'), where('studentIdNum', '==', term));
        const snapIdNum = await getDocs(qIdNum);
        snapIdNum.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));

        // 2. Try direct doc ID
        if (fetchedStudents.length === 0 && term.length >= 4) {
          try {
            const docSnap = await getDoc(doc(db, 'students', term));
            if (docSnap.exists()) {
              fetchedStudents.push({ id: docSnap.id, ...docSnap.data() as any });
            }
          } catch (_) {}
        }

        // 3. Try Phone match
        if (fetchedStudents.length === 0 && cleanDigits.length >= 6) {
          const qPhone = query(collection(db, 'students'), where('phone', '==', term));
          const snapPhone = await getDocs(qPhone);
          snapPhone.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));

          if (fetchedStudents.length === 0 && cleanDigits !== term) {
            const qPhoneClean = query(collection(db, 'students'), where('phone', '==', cleanDigits));
            const snapPhoneClean = await getDocs(qPhoneClean);
            snapPhoneClean.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));
          }
        }

        // 4. Try Email match
        if (fetchedStudents.length === 0 && term.includes('@')) {
          const qEmail = query(collection(db, 'students'), where('email', '==', term.toLowerCase()));
          const snapEmail = await getDocs(qEmail);
          snapEmail.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));
        }

        // 5. Fallback: General sample fetch if no exact index match found yet
        if (fetchedStudents.length === 0) {
          const qGen = query(collection(db, 'students'), limit(80));
          const snapGen = await getDocs(qGen);
          snapGen.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));
        }
      } else if (!groupId) {
        // Empty search & no group selected -> load top sample
        const qTop = query(collection(db, 'students'), limit(40));
        const snapTop = await getDocs(qTop);
        snapTop.docs.forEach((d: any) => fetchedStudents.push({ id: d.id, ...d.data() }));
      }

      // Merge into local Cache Map
      setStudentCacheMap(prev => {
        const updated = new Map(prev);
        fetchedStudents.forEach(st => updated.set(st.id, st));
        return updated;
      });

    } catch (err: any) {
      console.error("Error executing search:", err);
      setSearchError("حدث خطأ أثناء الاتصال بقاعدة البيانات. حاول مرة أخرى.");
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, selectedGroupId, fetchGroupsIfNeeded]);

  // Initial load check for query parameter in URL (e.g. ?id=... or ?q=...)
  useEffect(() => {
    const studentIdFromUrl = searchParams.get('id');
    const queryFromUrl = searchParams.get('q');

    if (studentIdFromUrl) {
      setSearchTerm(studentIdFromUrl);
      performSearch(studentIdFromUrl, '', true).then(() => {
        // Find in cache
        setStudentCacheMap(prev => {
          const found = Array.from(prev.values()).find(
            (s: Student) => s.id === studentIdFromUrl || s.studentIdNum === studentIdFromUrl
          );
          if (found) {
            setSelectedStudent(found);
          }
          return prev;
        });
      });
    } else if (queryFromUrl) {
      setSearchTerm(queryFromUrl);
      performSearch(queryFromUrl, '', true);
    }
  }, []);

  // Fetch student-specific records (FollowUps, Penalties, Complaints) on demand
  const loadStudentDetailsOnDemand = useCallback(async (st: Student) => {
    fetchUsersIfNeeded();

    // Fetch Follow-ups if not cached
    if (!followUpCacheMap.has(st.id)) {
      try {
        const qFu = query(collection(db, 'studentFollowUps'), where('studentId', '==', st.id));
        const snap = await getDocs(qFu);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as StudentFollowUp));
        setFollowUpCacheMap(prev => new Map(prev).set(st.id, items));
      } catch (e) {
        console.error("Error loading student follow-ups:", e);
      }
    }

    // Fetch Penalties if not cached
    if (!penaltyCacheMap.has(st.id)) {
      try {
        const qPen = query(collection(db, 'penalties'), where('studentId', '==', st.id));
        const snap = await getDocs(qPen);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Penalty));
        setPenaltyCacheMap(prev => new Map(prev).set(st.id, items));
      } catch (e) {
        console.error("Error loading student penalties:", e);
      }
    }

    // Fetch Complaints if not cached
    if (!complaintCacheMap.has(st.id)) {
      try {
        const qComp = query(collection(db, 'complaints'), where('studentId', '==', st.id));
        const snap = await getDocs(qComp);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Complaint));
        setComplaintCacheMap(prev => new Map(prev).set(st.id, items));
      } catch (e) {
        console.error("Error loading student complaints:", e);
      }
    }
  }, [followUpCacheMap, penaltyCacheMap, complaintCacheMap, fetchUsersIfNeeded]);

  // Select student handler
  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchParams({ id: student.studentIdNum || student.id });
    loadStudentDetailsOnDemand(student);
  };

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Resend Welcome/Credentials Email
  const handleResendCredentialsEmail = async () => {
    if (!selectedStudent || !selectedStudent.email) {
      alert("الطالب ليس لديه إيميل مسجل لإرسال البيانات إليه.");
      return;
    }
    setSendingEmail(true);
    setEmailSuccessMsg(null);
    try {
      await triggerStudentWelcomeEmail(selectedStudent.id);
      setEmailSuccessMsg("تم إرسال بيانات الدخول إلى بريد الطالب بنجاح! 🚀");
    } catch (err: any) {
      alert("خطأ أثناء الإرسال: " + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  // Add quick follow-up note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !newNoteText.trim()) return;
    setAddingNote(true);

    try {
      const groupObj = groups.find(g => g.id === selectedStudent.groupId);
      const groupName = groupObj ? groupObj.name : 'غير محدد';

      const existingFollowUps = followUpCacheMap.get(selectedStudent.id) || [];
      const existing = existingFollowUps.find(f => f.status === 'active' || f.groupId === selectedStudent.groupId);

      if (existing) {
        await submitTrainerFollowUpUpdate(
          existing.groupId || selectedStudent.groupId,
          selectedStudent.id,
          newNoteText.trim(),
          user
        );
      } else {
        await requestFollowUp({
          groupId: selectedStudent.groupId,
          groupName: groupName,
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          deadline: new Date().toISOString().split('T')[0],
          note: newNoteText.trim(),
          labels: ['general']
        }, user);
      }

      setNewNoteText('');
      alert("تمت إضافة الملحوظة بنجاح إلى سجل متابعات الطالب!");

      // Refresh follow-ups for this student in cache
      const qFu = query(collection(db, 'studentFollowUps'), where('studentId', '==', selectedStudent.id));
      const snap = await getDocs(qFu);
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as StudentFollowUp));
      setFollowUpCacheMap(prev => new Map(prev).set(selectedStudent.id, items));

    } catch (err: any) {
      alert("حدث خطأ أثناء إضافة الملحوظة: " + err.message);
    } finally {
      setAddingNote(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = () => {
    if (!selectedStudent) return;
    setEditFormData({
      name: selectedStudent.name,
      phone: selectedStudent.phone,
      email: selectedStudent.email || '',
      attendanceEmail: selectedStudent.attendanceEmail || '',
      groupId: selectedStudent.groupId,
      tasksLink: selectedStudent.tasksLink || '',
      whatsappLink: selectedStudent.whatsappLink || ''
    });
    setIsEditModalOpen(true);
  };

  // Save Edit Student
  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      const updated: Student = {
        ...selectedStudent,
        name: editFormData.name,
        phone: editFormData.phone,
        email: editFormData.email,
        attendanceEmail: editFormData.attendanceEmail,
        groupId: editFormData.groupId,
        tasksLink: editFormData.tasksLink,
        whatsappLink: editFormData.whatsappLink
      };

      await saveStudent(selectedStudent.id, updated, user);
      setSelectedStudent(updated);

      // Update student in local cache Map
      setStudentCacheMap(prev => new Map(prev).set(updated.id, updated));

      setIsEditModalOpen(false);
      alert("تم تحديث بيانات الطالب بنجاح!");
    } catch (err: any) {
      alert("فشل تحديث البيانات: " + err.message);
    }
  };

  // Format Date
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "غير محدد";
    if (dateVal.toDate) return dateVal.toDate().toLocaleDateString('ar-EG');
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString('ar-EG');
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('ar-EG');
    return String(dateVal);
  };

  // Format Time
  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "غير محدد";
    if (dateVal.toDate) return dateVal.toDate().toLocaleString('ar-EG', { hour12: true });
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleString('ar-EG', { hour12: true });
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed.toLocaleString('ar-EG', { hour12: true });
    return String(dateVal);
  };

  // Filter students from cached store
  const cachedStudentsList = useMemo(() => Array.from(studentCacheMap.values()), [studentCacheMap]);

  const filteredStudents = useMemo(() => {
    const queryStr = searchTerm.trim().toLowerCase();
    return cachedStudentsList.filter(student => {
      // Group filter
      if (selectedGroupId && student.groupId !== selectedGroupId) return false;
      
      // Status filter
      if (selectedStatus !== 'all') {
        const studentStatus = student.deactivated ? 'deactivated' : (student.status || 'active');
        if (selectedStatus === 'active' && student.deactivated) return false;
        if (selectedStatus === 'deactivated' && !student.deactivated) return false;
        if (selectedStatus === 'deferred' && studentStatus !== 'deferred') return false;
      }

      if (!queryStr) return true;

      const group = groups.find(g => g.id === student.groupId);
      const groupName = (group?.name || '').toLowerCase();
      const courseName = (group?.courseName || '').toLowerCase();

      return (
        student.name.toLowerCase().includes(queryStr) ||
        (student.studentIdNum || '').toLowerCase().includes(queryStr) ||
        (student.id || '').toLowerCase().includes(queryStr) ||
        student.phone.includes(queryStr) ||
        (student.email || '').toLowerCase().includes(queryStr) ||
        (student.attendanceEmail || '').toLowerCase().includes(queryStr) ||
        (student.whatsappLink || '').includes(queryStr) ||
        groupName.includes(queryStr) ||
        courseName.includes(queryStr)
      );
    });
  }, [cachedStudentsList, groups, searchTerm, selectedGroupId, selectedStatus]);

  // Student specific records from cache
  const currentStudentFollowUps = useMemo(() => {
    if (!selectedStudent) return [];
    return followUpCacheMap.get(selectedStudent.id) || [];
  }, [selectedStudent, followUpCacheMap]);

  const currentStudentPenalties = useMemo(() => {
    if (!selectedStudent) return [];
    return penaltyCacheMap.get(selectedStudent.id) || [];
  }, [selectedStudent, penaltyCacheMap]);

  const currentStudentComplaints = useMemo(() => {
    if (!selectedStudent) return [];
    return complaintCacheMap.get(selectedStudent.id) || [];
  }, [selectedStudent, complaintCacheMap]);

  return (
    <Layout user={user}>
      <div className="p-4 sm:p-8 space-y-8 font-arabic text-right max-w-7xl mx-auto" dir="rtl">
        
        {/* Header Title */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-[35px] text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold mb-3">
                <Search size={14} className="text-amber-400" />
                <span>فهرس ودليل حسابات الطلاب الشامل (البحث الذكي والموجه)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                بوابة الاستعلام وسجلات المتدربين 🎓
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium max-w-2xl">
                ابحث فوراً برقم المعرف (ID)، الاسم، الهاتف، أو الإيميل للوصول إلى الملف التفاعلي والسجل الكامل للطالب دون سحب بيانات زائدة.
              </p>
            </div>

            {/* Action & Cache Info Badge */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsAIExportModalOpen(true)}
                className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 border border-indigo-400/30 transition-all active:scale-95 cursor-pointer"
              >
                <Bot size={16} />
                <span>🤖 تصدير للمساعد الذكي</span>
              </button>

              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-right space-y-0.5">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <Database size={15} />
                  <span>التخزين المؤقت النشط (Cache)</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  الطلاب المخزنين بالجلسة: <strong className="text-white font-mono">{studentCacheMap.size}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filtering Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* Live Search Input */}
            <div className="md:col-span-5 relative">
              <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                🔍 ابحث بالاسم / رقم المعرف (ID) / رقم الهاتف / الإيميل:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      performSearch(searchTerm, selectedGroupId);
                    }
                  }}
                  placeholder="مثال: أحمد محمد أو STU-1024 أو 01012345678 ..."
                  className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                />
                <Search size={18} className="absolute right-4 top-4 text-slate-400" />
                {searchTerm && (
                  <button 
                    onClick={() => { 
                      setSearchTerm(''); 
                      setSearchParams({}); 
                    }}
                    className="absolute left-3 top-3.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-lg font-bold"
                  >
                    تصفير
                  </button>
                )}
              </div>
            </div>

            {/* Group Filter */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                🏢 الدفعة / الجروب:
              </label>
              <select
                value={selectedGroupId}
                onFocus={() => fetchGroupsIfNeeded()}
                onChange={(e) => {
                  const gId = e.target.value;
                  setSelectedGroupId(gId);
                  if (gId) performSearch(searchTerm, gId);
                }}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="">جميع الدفعات والجروبات</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    دفعة {g.name} — {g.courseName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                ⚡ حالة الطالب:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">النشطين فقط</option>
                <option value="deactivated">الموقوفين ⛔</option>
                <option value="deferred">المؤجلين ⏳</option>
              </select>
            </div>

            {/* Search Trigger Button */}
            <div className="md:col-span-2">
              <button
                onClick={() => performSearch(searchTerm, selectedGroupId, true)}
                disabled={isSearching}
                className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-primary-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري البحث...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>ابحث الآن 🔍</span>
                  </>
                )}
              </button>
            </div>

          </div>

          <div className="flex justify-between items-center pt-2 text-xs text-slate-500 font-bold border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
            <span>
              {hasSearched ? (
                <>تم العثور على <strong className="text-primary-600 dark:text-primary-400 font-mono text-sm">{filteredStudents.length}</strong> طالب مطاق لنتائج البحث المحفوظة</>
              ) : (
                <span className="text-slate-400">💡 أدخل كلمة البحث أو اختر الجروب واضغط "ابحث الآن" لبدء الاستعلام</span>
              )}
            </span>
            {selectedStudent && (
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
              >
                <span>عرض قائمة نتائج البحث 📋</span>
              </button>
            )}
          </div>
        </div>

        {searchError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold border border-rose-200">
            {searchError}
          </div>
        )}

        {/* Initial Empty State before Searching */}
        {!hasSearched && !selectedStudent && (
          <div className="bg-white dark:bg-slate-900 rounded-[35px] p-12 text-center border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Search size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">
                ابدأ البحث فوراً في دليل الطلاب
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                تم تحسين هذه الصفحة لعدم استهلاك قراءات تلقائية من قاعدة البيانات. اكتب اسم الطالب، رقم المعرف (ID)، رقم الهاتف، أو اختر الدفعة للبدء.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => performSearch('', '', true)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black rounded-2xl transition-all flex items-center gap-2"
              >
                <span>تصفح آخر الطلاب المسجلين</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Grid Section: Search Results Cards OR Detailed Student Profile Dossier */}
        {selectedStudent ? (
          /* ====================================
             FULL DETAILED STUDENT PROFILE DOSSIER
             ==================================== */
          <div className="space-y-6">
            
            {/* Dossier Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[35px] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-primary-600/20 shrink-0">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                        {selectedStudent.name}
                      </h2>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        🆔 ID: {selectedStudent.studentIdNum || selectedStudent.id}
                      </span>
                      {selectedStudent.deactivated ? (
                        <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-black text-xs px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900">
                          ⛔ موقوف
                        </span>
                      ) : selectedStudent.status === 'deferred' ? (
                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-black text-xs px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-900">
                          ⏳ مؤجل
                        </span>
                      ) : (
                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black text-xs px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900">
                          ✅ مستمر / نشط
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>🏢 الجروب: <strong className="text-slate-800 dark:text-slate-200">{groups.find(g => g.id === selectedStudent.groupId)?.name || 'غير محدد'}</strong></span>
                      <span>•</span>
                      <span>📚 الكورس: <strong className="text-slate-800 dark:text-slate-200">{groups.find(g => g.id === selectedStudent.groupId)?.courseName || 'غير محدد'}</strong></span>
                      <span>•</span>
                      <span>📅 تاريخ التسجيل: <strong className="font-mono">{formatDate(selectedStudent.createdAt)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Quick Profile Actions */}
                <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                  <button
                    onClick={handleOpenEditModal}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Edit size={14} />
                    <span>تعديل البيانات</span>
                  </button>

                  <button
                    onClick={() => setSelectedStudentForStatusChange(selectedStudent)}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-amber-200 dark:border-amber-900/50"
                  >
                    <ShieldAlert size={14} />
                    <span>تغيير الحالة / إيقاف</span>
                  </button>

                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs transition-all"
                  >
                    إغلاق ✕
                  </button>
                </div>
              </div>

              {/* Dossier Tabs Navigation */}
              <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'info'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <UserIcon size={15} />
                  <span>البيانات الأساسية والبوابة</span>
                </button>

                <button
                  onClick={() => setActiveTab('group')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'group'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <GraduationCap size={15} />
                  <span>الدفعة والجروب والمدربين</span>
                </button>

                <button
                  onClick={() => setActiveTab('followups')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'followups'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Clock size={15} />
                  <span>سجل المتابعات والملحوظات ({currentStudentFollowUps.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('penalties')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'penalties'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <AlertTriangle size={15} />
                  <span>الجزاءات والتنبيهات ({currentStudentPenalties.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('complaints')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'complaints'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <MessageSquare size={15} />
                  <span>الشكاوى والاستفسارات ({currentStudentComplaints.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shrink-0 flex items-center gap-2 ${
                    activeTab === 'history'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Layers size={15} />
                  <span>سجل الإيقاف وتعديل البيانات</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: Personal Info & Portal Credentials */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal & Contact Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <UserIcon size={18} className="text-primary-600" />
                    <span>البيانات الشخصية ووسائل التواصل</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-slate-500 font-bold">معرف الطالب (Student ID):</span>
                      <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                        {selectedStudent.studentIdNum || selectedStudent.id}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-slate-500 font-bold">اسم الطالب الثلاثي:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedStudent.name}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-slate-500 font-bold">رقم الهاتف الأساسي:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {selectedStudent.phone}
                        </span>
                        <a
                          href={`tel:${selectedStudent.phone}`}
                          className="text-primary-600 hover:underline text-[10px] bg-primary-50 dark:bg-primary-950/40 px-2 py-1 rounded-lg font-bold"
                        >
                          اتصال 📞
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-slate-500 font-bold">رقم الواتساب (WhatsApp):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {selectedStudent.whatsappLink || selectedStudent.phone}
                        </span>
                        <a
                          href={`https://wa.me/${getCleanDigitsOnly(selectedStudent.whatsappLink || selectedStudent.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] hover:bg-emerald-600 transition-all flex items-center gap-1"
                        >
                          فتح واتساب 💬
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-slate-500 font-bold">البريد الإلكتروني (Gmail):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                        {selectedStudent.email || 'غير مسجل'}
                      </span>
                    </div>

                    {selectedStudent.attendanceEmail && (
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                        <span className="text-slate-500 font-bold">إيميل الحضور (Meet Calendar):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {selectedStudent.attendanceEmail}
                        </span>
                      </div>
                    )}

                    {selectedStudent.tasksLink && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold block mb-1">
                          🔗 رابط التسليمات والمهام (Telegram Topic):
                        </span>
                        <a
                          href={selectedStudent.tasksLink}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-indigo-600 dark:text-indigo-300 hover:underline break-all"
                        >
                          {selectedStudent.tasksLink}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Portal Access & Credentials Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Key size={18} className="text-amber-500" />
                    <span>بيانات ورابط بوابته الشخصية على المنصة</span>
                  </h3>

                  <div className="p-4 bg-slate-950 text-white rounded-2xl space-y-3 font-mono">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-bold font-arabic">اسم المستخدم / المعرف:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-400">{selectedStudent.studentIdNum || selectedStudent.id}</span>
                        <button
                          onClick={() => handleCopy(selectedStudent.studentIdNum || selectedStudent.id, 'id')}
                          className="text-slate-400 hover:text-white p-1"
                          title="نسخ المعرف"
                        >
                          {copiedField === 'id' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-bold font-arabic">كلمة المرور (Password):</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-400">
                          {showPassword ? (selectedStudent.portalPassword || '123456') : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-xs text-slate-400 hover:text-white underline font-arabic"
                        >
                          {showPassword ? 'إخفاء' : 'إظهار'}
                        </button>
                        <button
                          onClick={() => handleCopy(selectedStudent.portalPassword || '123456', 'password')}
                          className="text-slate-400 hover:text-white p-1"
                          title="نسخ كلمة المرور"
                        >
                          {copiedField === 'password' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="text-xs text-slate-400 font-bold block mb-1 font-arabic">رابط بوابته الشخصية المباشر:</span>
                      <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[11px] text-slate-300 truncate">
                          {`${window.location.origin}/#/student/portal?id=${selectedStudent.studentIdNum || selectedStudent.id}`}
                        </span>
                        <button
                          onClick={() => handleCopy(`${window.location.origin}/#/student/portal?id=${selectedStudent.studentIdNum || selectedStudent.id}`, 'portal_url')}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-lg font-bold font-arabic shrink-0"
                        >
                          {copiedField === 'portal_url' ? 'تم النسخ ✓' : 'نسخ الرابط'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Email & Dispatch */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-xs p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <span className="font-bold text-slate-600 dark:text-slate-300">حالة إرسال الإيميل الرسمي:</span>
                      {selectedStudent.credsSent ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} /> تم إرسال البيانات مسبقاً
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <XCircle size={14} /> لم يتم الإرسال بعد
                        </span>
                      )}
                    </div>

                    {emailSuccessMsg && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200">
                        {emailSuccessMsg}
                      </div>
                    )}

                    <button
                      onClick={handleResendCredentialsEmail}
                      disabled={sendingEmail}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send size={15} />
                      <span>{sendingEmail ? 'جاري إرسال الإيميل...' : 'إرسال / إعادة إرسال بيانات الدخول عبر البريد الإلكتروني 🚀'}</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* TAB CONTENT: Group & Academic Details */}
            {activeTab === 'group' && (
              <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <GraduationCap size={18} className="text-primary-600" />
                  <span>تفاصيل الدفعة الملحق بها والمسؤولين عنها</span>
                </h3>

                {(() => {
                  const g = groups.find(group => group.id === selectedStudent.groupId);
                  if (!g) {
                    return <p className="text-slate-500 text-sm">الطالب غير ملحق بأي دفعة حالياً.</p>;
                  }

                  const groupTrainers = allUsers.filter(u => g.trainerIds?.includes(u.uid) || g.assignedTrainerIds?.includes(u.uid));

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      
                      {/* Group Card */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl space-y-3 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">اسم الدفعة / الجروب:</span>
                          <span className="font-black text-sm text-primary-600 dark:text-primary-400">
                            {g.name}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">اسم الكورس التدريبي:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {g.courseName}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">حالة الجروب:</span>
                          <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${g.archived ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {g.archived ? 'مؤرشف / منتهي 📁' : 'نشط وحالي ⚡'}
                          </span>
                        </div>

                        {g.googleMeetLink && (
                          <div className="pt-2">
                            <span className="text-slate-500 font-bold block mb-1">رابط المحاضرات (Google Meet):</span>
                            <a
                              href={g.googleMeetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:underline font-mono text-xs break-all"
                            >
                              {g.googleMeetLink}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Trainers & Supervisors Card */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="text-slate-500 font-bold block mb-2">👤 المدرب المباشر للجروب:</span>
                          {groupTrainers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {groupTrainers.map(tr => (
                                <span key={tr.uid} className="bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-xl font-bold">
                                  👨‍🏫 {tr.name} ({tr.email})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">لم يتم تعيين مدرب محدد</span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-500 font-bold block mb-2">👑 المشرف الكنترول المسؤول:</span>
                          <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-3 py-1 rounded-xl font-bold">
                            {g.supervisorName || 'غير محدد'}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB CONTENT: Follow-ups & Notes Records */}
            {activeTab === 'followups' && (
              <div className="space-y-6">
                
                {/* Quick Add Note Form */}
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <span>✏️ إضافة ملحوظة أو تحديث لمتابعة هذا الطالب</span>
                  </h3>
                  <form onSubmit={handleAddNote} className="space-y-3">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="اكتب الملحوظة أو التحديث هنا (مثال: تم التواصل معه هاتفياً ووعد بتسليم التاسك غداً)..."
                      className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNoteText.trim()}
                      className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs shadow-md shadow-primary-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send size={14} />
                      <span>{addingNote ? 'جاري الحفظ...' : 'حفظ الملحوظة في ملف الطالب'}</span>
                    </button>
                  </form>
                </div>

                {/* Follow-up History List */}
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Clock size={18} className="text-primary-600" />
                    <span>سجل المتابعات والملحوظات السابقة ({currentStudentFollowUps.length})</span>
                  </h3>

                  {currentStudentFollowUps.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-bold text-xs">
                      لا توجد سجلات متابعة مسجلة لهذا الطالب حتى الآن.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentStudentFollowUps.map(f => (
                        <div key={f.id} className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${f.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {f.status === 'active' ? 'متابعة نشطة' : 'مكتملة'}
                              </span>
                              {f.labels?.map(lbl => (
                                <span key={lbl} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
                                  {lbl === 'absence' ? 'غياب' : lbl === 'tasks' ? 'مهام' : lbl}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              آخر تحديث: {formatDateTime(f.lastUpdatedAt)}
                            </span>
                          </div>

                          {/* Comments & Updates inside this follow up case */}
                          <div className="space-y-2 pt-2">
                            {(f.comments || []).map((c) => (
                              <div key={c.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {c.createdByName} <span className="text-[10px] text-slate-400">({c.createdByRole || 'مستخدم'})</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{formatDateTime(c.createdAt)}</span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                  {c.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: Penalties & Warnings */}
            {activeTab === 'penalties' && (
              <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <AlertTriangle size={18} className="text-rose-500" />
                  <span>سجل الجزاءات وخصم النقاط والإنذارات الرسمية</span>
                </h3>

                {currentStudentPenalties.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-bold text-xs">
                    سجل الطالب نظيف الخصومات والجزاءات.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentStudentPenalties.map(p => (
                      <div key={p.id} className="bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/40 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.reason}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">التاريخ: {formatDate(p.createdAt)}</p>
                        </div>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-3 py-1 rounded-xl">
                          -{p.points} نقطة
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Complaints */}
            {activeTab === 'complaints' && (
              <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <MessageSquare size={18} className="text-amber-500" />
                  <span>سجل الشكاوى والاستفسارات المرفوعة</span>
                </h3>

                {currentStudentComplaints.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-bold text-xs">
                    لم تقدم أي شكاوى مسجلة تخص هذا الطالب.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentStudentComplaints.map(c => (
                      <div key={c.id} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-white">{c.subject || 'بدون عنوان'}</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {c.status === 'resolved' ? 'تم الحل' : 'قيد المتابعة'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{c.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: History & Profile Edits */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                
                {/* Deactivation Checklist Log */}
                {selectedStudent.deactivatedChecklistHistory && selectedStudent.deactivatedChecklistHistory.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <ShieldAlert size={16} />
                      <span>سجل خطوات وإجراءات إيقاف الطالب (Deactivation Checklist Logs)</span>
                    </h3>
                    <div className="space-y-2">
                      {selectedStudent.deactivatedChecklistHistory.map((h, idx) => (
                        <div key={idx} className="bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-rose-700 dark:text-rose-300">
                              تم الإيقاف بواسطة: {h.deactivatedByName || 'مسؤول النظام'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{formatDateTime(h.deactivatedAt)}</span>
                          </div>
                          <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 text-[11px] space-y-0.5">
                            {h.checklist?.lms && <li>تم تعطيل حسابه بالمنصة التعليمية</li>}
                            {h.checklist?.whatsappGroup && <li>تم إزالته من جروب الواتساب الرئيسي</li>}
                            {h.checklist?.recordingsGroup && <li>تم إزالته من جروب الريكوردات</li>}
                            {h.checklist?.informed && <li>تم إبلاغه رسمياً بالإيقاف</li>}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile Self-Edits Log */}
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Layers size={16} className="text-purple-600" />
                    <span>سجل تعديل البيانات الشخصية بواسطة الطالب (Profile Edits Log)</span>
                  </h3>

                  {!selectedStudent.profileEditHistory || selectedStudent.profileEditHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">لم يقم الطالب بتعديل بياناته بنفسه حتى الآن.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedStudent.profileEditHistory.map((h, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              تعديل حقل: {h.fieldNameAr}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{h.editedAt}</span>
                          </div>
                          <div className="flex gap-4 text-[11px]">
                            <span className="text-slate-400 line-through font-mono">السابق: {h.oldValue || '(فارغ)'}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">الجديد: {h.newValue || '(فارغ)'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        ) : (
          /* ====================================
             STUDENTS DIRECTORY CARDS GRID
             ==================================== */
          hasSearched && (
            <div className="space-y-4">
              {filteredStudents.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
                  <Search size={36} className="mx-auto text-slate-400" />
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300">
                    لم يتم العثور على طالب يطابق البحث
                  </h3>
                  <p className="text-xs text-slate-500">
                    تأكد من كتابة الاسم، رقم الهاتف، أو رقم المعرف (ID) بشكل صحيح، أو اختر دفعات أخرى.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map(student => {
                    const g = groups.find(group => group.id === student.groupId);
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleSelectStudent(student)}
                        className="bg-white dark:bg-slate-900 rounded-[28px] p-5 border border-slate-200 dark:border-slate-800 hover:border-primary-500/50 hover:shadow-lg transition-all cursor-pointer group space-y-3 relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-lg flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all shrink-0">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all">
                                {student.name}
                              </h4>
                              <span className="text-[11px] font-mono font-bold text-slate-400 block">
                                🆔 {student.studentIdNum || student.id}
                              </span>
                            </div>
                          </div>

                          {student.deactivated ? (
                            <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                              موقوف ⛔
                            </span>
                          ) : student.status === 'deferred' ? (
                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                              مؤجل ⏳
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                              نشط ✅
                            </span>
                          )}
                        </div>

                        <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          <div className="flex justify-between">
                            <span>الجروب:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{g?.name || 'غير محدد'}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>الهاتف:</span>
                            <strong className="font-mono text-slate-800 dark:text-slate-200" dir="ltr">{student.phone}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>الإيميل:</span>
                            <strong className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[160px]" dir="ltr">
                              {student.email || 'غير مسجل'}
                            </strong>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-between items-center text-xs font-bold text-primary-600 dark:text-primary-400">
                          <span>عرض الملف الفهرسي الشامل ➔</span>
                          <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* MODAL: Edit Student Data */}
        {isEditModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تعديل بيانات الطالب</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-2xl text-slate-400">&times;</button>
              </div>
              <form onSubmit={handleSaveEditStudent} className="p-6 space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-500 mb-1">الاسم الكامل:</label>
                  <input
                    type="text" required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">رقم الهاتف:</label>
                  <input
                    type="tel" required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">البريد الإلكتروني (Gmail):</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">إيميل الحضور (Meet Calendar):</label>
                  <input
                    type="email"
                    value={editFormData.attendanceEmail}
                    onChange={(e) => setEditFormData({...editFormData, attendanceEmail: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">الجروب / الدفعة:</label>
                  <select
                    value={editFormData.groupId}
                    onChange={(e) => setEditFormData({...editFormData, groupId: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>دفعة {g.name} - {g.courseName}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary-600 text-white font-black rounded-xl"
                  >
                    حفظ التغييرات
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Status Change Modal */}
        {selectedStudentForStatusChange && (
          <StudentStatusModal
            student={selectedStudentForStatusChange}
            groups={groups}
            currentUser={user}
            onClose={() => setSelectedStudentForStatusChange(null)}
            onSaved={() => {
              // Update student in cache
              if (selectedStudentForStatusChange) {
                setStudentCacheMap(prev => {
                  const updatedMap = new Map(prev);
                  const existing = updatedMap.get(selectedStudentForStatusChange.id) as Student | undefined;
                  if (existing) {
                    updatedMap.set(existing.id, { ...existing });
                  }
                  return updatedMap;
                });
              }
              setSelectedStudentForStatusChange(null);
            }}
          />
        )}

        <AIStudentExportModal
          isOpen={isAIExportModalOpen}
          onClose={() => setIsAIExportModalOpen(false)}
          allStudents={cachedStudentsList}
          filteredStudents={filteredStudents}
          groups={groups}
        />

      </div>
    </Layout>
  );
};

export default StudentDirectory;
