
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
const { collection, doc, getDoc, getDocs, query, where, orderBy, limit } = firestore as any;
import { Student, User, Group, StudentFollowUp, Penalty, LabelDefinition } from '../types';
import { 
  subscribeToCollection, 
  saveStudent, 
  deleteStudent, 
  checkAndBackfillStudentCredentials,
  getGlobalStudentTemplate,
  saveGlobalStudentTemplate,
  updateStudentCredsSentStatus,
  triggerStudentWelcomeEmail,
  sendManualAbsenceWarningEmail
} from '../services/firestore';
import Layout from '../components/Layout';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import StudentStatusModal from '../components/StudentStatusModal';
import AIStudentExportModal from '../components/AIStudentExportModal';
import { StudentWeaknessModal } from '../components/StudentWeaknessModal';
import { StudentHistoryModal } from '../components/StudentHistoryModal';
import { TrainerBroadcastEmailModal } from '../components/TrainerBroadcastEmailModal';
import { Clock, Trash2, MessageSquare, Share2, Send, Copy, Check, RotateCcw, Smartphone, Settings, Bot, Mail } from 'lucide-react';
import { normalizePhoneNumber, getCleanDigitsOnly, COUNTRY_CODES, parsePhoneAndDetect } from '../utils';

const ABSOLUTE_DEFAULT_TEMPLATE = `مرحباً {name}، 👋

إليك بيانات تسجيل دخولك الخاصة بالمنصة التعليمية لـ Saber Group Academy:

👤 معرّف الطالب (ID): {id}
🔑 كلمة المرور (Password): {password}

🌐 رابط الدخول المباشر للمنصة:
{portal_url}

تمنياتنا لك بالتوفيق والنجاح المستمر! 🎓✨`;

const normalizeArabicText = (text: string = '') => {
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .trim();
};

const Students: React.FC<{ user: User }> = ({ user }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentFollowUps, setStudentFollowUps] = useState<StudentFollowUp[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [labelDefinitions, setLabelDefinitions] = useState<LabelDefinition[]>([]);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [selectedStudentForStatusChange, setSelectedStudentForStatusChange] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterCredsSent, setFilterCredsSent] = useState('all'); // 'all' | 'sent' | 'not_sent'
  const [filterGroupStatus, setFilterGroupStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIExportModalOpen, setIsAIExportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(25);
  const [hasMore, setHasMore] = useState(true);

  const togglePasswordVisibility = (studentId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };
  
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Bulk Broadcast & Credentials Dispatch States
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isEmailBroadcastModalOpen, setIsEmailBroadcastModalOpen] = useState(false);
  const [isTemplateSettingsOpen, setIsTemplateSettingsOpen] = useState(false);
  const [globalTemplate, setGlobalTemplate] = useState(ABSOLUTE_DEFAULT_TEMPLATE);
  const [customDomain] = useState(() => localStorage.getItem('saberSystemPublicDomain') || window.location.origin);
  const [broadcastTemplate, setBroadcastTemplate] = useState(() => {
    return localStorage.getItem('saberStudentBroadcastTemplate') || ABSOLUTE_DEFAULT_TEMPLATE;
  });
  
  // Track sent status in localStorage to survive reloads
  const [sentTracking, setSentTracking] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('saberSentTrackingData');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateSentStatus = (studentId: string, isSent: boolean) => {
    const updated = { ...sentTracking, [studentId]: isSent };
    setSentTracking(updated);
    localStorage.setItem('saberSentTrackingData', JSON.stringify(updated));
  };

  const clearSentTracking = () => {
    if (window.confirm('هل أنت متأكد من تصفير وإعادة تعيين حالة الإرسال لجميع الطلاب؟')) {
      setSentTracking({});
      localStorage.removeItem('saberSentTrackingData');
    }
  };

  const saveBroadcastTemplate = (newVal: string) => {
    setBroadcastTemplate(newVal);
    localStorage.setItem('saberStudentBroadcastTemplate', newVal);
    localStorage.setItem('saberStudentBroadcastTemplate_isCustom', 'true');
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    attendanceEmail: '',
    groupId: '',
    tasksLink: '',
    whatsappLink: '',
    telegramLink: ''
  });

  const [phoneCountry, setPhoneCountry] = useState('+20');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [whatsappCountry, setWhatsappCountry] = useState('+20');
  const [whatsappLocal, setWhatsappLocal] = useState('');
  const [selectedStudentForWeakness, setSelectedStudentForWeakness] = useState<{ id: string, name: string, groupId?: string } | null>(null);

  // Allowed to delete: admin, coordinator, team_leader
  const canDelete = ['admin', 'coordinator', 'team_leader'].includes(user.role);
  // Allowed to add/edit: Everyone (including trainers)
  const canManage = true; 

  useEffect(() => {
    checkAndBackfillStudentCredentials();
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    const unsubFollowUps = subscribeToCollection<StudentFollowUp>('studentFollowUps', setStudentFollowUps);
    const unsubPenalties = subscribeToCollection<Penalty>('penalties', setPenalties, [limit(50)]);
    const unsubUsers = subscribeToCollection<User>('users', setAllUsers);
    const unsubLabels = subscribeToCollection<LabelDefinition>('labelDefinitions', setLabelDefinitions);
    
    // Fetch global master template
    getGlobalStudentTemplate().then(txt => {
      if (txt) {
        setGlobalTemplate(txt);
        const isCustom = localStorage.getItem('saberStudentBroadcastTemplate_isCustom') === 'true';
        if (!isCustom) {
          setBroadcastTemplate(txt);
        }
      }
    });

    return () => {
      unsubGroups();
      unsubFollowUps();
      unsubPenalties();
      unsubUsers();
      unsubLabels();
    };
  }, []);

  useEffect(() => {
    // Reset pageSize to 25 when filters change
    setPageSize(25);
  }, [filterGroupId, filterCredsSent, filterGroupStatus]);

  useEffect(() => {
    setIsProcessing(true);
    const term = searchTerm.trim();

    // 1. NO SEARCH TERM -> Real-time paginated view (Minimal reads: 25)
    if (!term) {
      let qConstraints: any[] = [];

      if (filterGroupId) {
        qConstraints.push(where('groupId', '==', filterGroupId));
      }

      if (filterCredsSent === 'sent') {
        qConstraints.push(where('credsSent', '==', true));
      } else if (filterCredsSent === 'not_sent') {
        qConstraints.push(where('credsSent', '==', false));
      }

      qConstraints.push(limit(pageSize));

      if (!filterGroupId) {
        qConstraints.push(orderBy('createdAt', 'desc'));
      }

      const unsub = subscribeToCollection<Student>('students', (data) => {
        let processed = [...data];

        processed.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                    (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                    (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        setStudents(processed);
        setHasMore(data.length === pageSize);
        setIsProcessing(false);
      }, qConstraints, (err) => {
        console.warn("Query failed, falling back without order:", err);
        const fallbackConstraints = qConstraints.filter(c => !c.toString().includes('orderBy'));
        const fallbackUnsub = subscribeToCollection<Student>('students', (data) => {
          let processed = [...data];
          processed.sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                      (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                      (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return tB - tA;
          });

          setStudents(processed);
          setHasMore(data.length === pageSize);
          setIsProcessing(false);
        }, fallbackConstraints);
        return fallbackUnsub;
      });

      return () => unsub();
    }

    // 2. SEARCH TERM PROVIDED -> Targeted direct Firebase Search (Minimal reads: ~5 to 150 reads)
    let isCancelled = false;
    const performDirectFirebaseSearch = async () => {
      try {
        const cleanDigits = getCleanDigitsOnly(term);
        const upperTerm = term.charAt(0).toUpperCase() + term.slice(1);
        const fetchedMap = new Map<string, Student>();

        const addDocsToMap = (snapshot: any) => {
          if (!snapshot) return;
          snapshot.docs.forEach((docSnap: any) => {
            if (!fetchedMap.has(docSnap.id)) {
              fetchedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Student);
            }
          });
        };

        const queryPromises: Promise<any>[] = [];

        // 1) studentIdNum match
        queryPromises.push(getDocs(query(collection(db, 'students'), where('studentIdNum', '==', term), limit(25))).catch(() => null));

        // 2) phone match
        queryPromises.push(getDocs(query(collection(db, 'students'), where('phone', '==', term), limit(25))).catch(() => null));
        if (cleanDigits.length >= 3 && cleanDigits !== term) {
          queryPromises.push(getDocs(query(collection(db, 'students'), where('phone', '==', cleanDigits), limit(25))).catch(() => null));
        }

        // 3) email match
        if (term.includes('@')) {
          queryPromises.push(getDocs(query(collection(db, 'students'), where('email', '==', term.toLowerCase()), limit(25))).catch(() => null));
        }

        // 4) Name prefix match (original case & capitalized)
        queryPromises.push(getDocs(query(collection(db, 'students'), where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(30))).catch(() => null));
        if (upperTerm !== term) {
          queryPromises.push(getDocs(query(collection(db, 'students'), where('name', '>=', upperTerm), where('name', '<=', upperTerm + '\uf8ff'), limit(30))).catch(() => null));
        }

        // 5) Direct doc ID lookup
        if (term.length >= 4) {
          try {
            const docSnap = await getDoc(doc(db, 'students', term));
            if (docSnap.exists()) {
              fetchedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Student);
            }
          } catch (_) {}
        }

        const snapshots = await Promise.all(queryPromises);
        snapshots.forEach(addDocsToMap);

        // 6) Fallback sample (150 docs max) if targeted queries yield fewer than 10 results
        if (fetchedMap.size < 10) {
          try {
            const fallbackSnap = await getDocs(query(collection(db, 'students'), limit(150), orderBy('createdAt', 'desc')));
            addDocsToMap(fallbackSnap);
          } catch (_) {
            try {
              const fallbackSnap2 = await getDocs(query(collection(db, 'students'), limit(150)));
              addDocsToMap(fallbackSnap2);
            } catch (_) {}
          }
        }

        if (isCancelled) return;

        const results = Array.from(fetchedMap.values());
        results.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                    (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                    (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        setStudents(results);
        setHasMore(false);
      } catch (err) {
        console.error("Direct Firebase search error:", err);
      } finally {
        if (!isCancelled) setIsProcessing(false);
      }
    };

    performDirectFirebaseSearch();

    return () => {
      isCancelled = true;
    };
  }, [filterGroupId, filterCredsSent, searchTerm, pageSize, filterGroupStatus]);

  const handleOpenModal = (student: Student | null = null) => {
    if (student) {
      setEditingStudent(student);
      const parsedPhone = parsePhoneAndDetect(student.phone || '');
      setPhoneCountry(parsedPhone.countryCode);
      setPhoneLocal(parsedPhone.localNumber);

      const parsedWhatsapp = parsePhoneAndDetect(student.whatsappLink || '');
      setWhatsappCountry(parsedWhatsapp.countryCode);
      setWhatsappLocal(parsedWhatsapp.localNumber);

      setFormData({
        name: student.name,
        phone: student.phone,
        email: student.email || '',
        attendanceEmail: student.attendanceEmail || '',
        groupId: student.groupId,
        tasksLink: student.tasksLink || '',
        whatsappLink: student.whatsappLink || '',
        telegramLink: ''
      });
    } else {
      setEditingStudent(null);
      setPhoneCountry('+20');
      setPhoneLocal('');
      setWhatsappCountry('+20');
      setWhatsappLocal('');
      setFormData({
        name: '',
        phone: '',
        email: '',
        attendanceEmail: '',
        groupId: '',
        tasksLink: '',
        whatsappLink: '',
        telegramLink: ''
      });
    }
    setIsModalOpen(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleaned = val.trim().replace(/[\s\-\(\)\.]/g, '');
    
    const startsWithPlus = cleaned.startsWith('+');
    const startsWithDoubleZero = cleaned.startsWith('00');
    const startsWithCode = COUNTRY_CODES.some(c => {
      const codeDigits = c.code.substring(1);
      return cleaned.startsWith(codeDigits) && cleaned.length >= (codeDigits.length + 7);
    });
    
    if (startsWithPlus || startsWithDoubleZero || startsWithCode) {
      const parsed = parsePhoneAndDetect(val);
      setPhoneCountry(parsed.countryCode);
      setPhoneLocal(parsed.localNumber);
    } else {
      setPhoneLocal(val);
    }
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleaned = val.trim().replace(/[\s\-\(\)\.]/g, '');
    
    const startsWithPlus = cleaned.startsWith('+');
    const startsWithDoubleZero = cleaned.startsWith('00');
    const startsWithCode = COUNTRY_CODES.some(c => {
      const codeDigits = c.code.substring(1);
      return cleaned.startsWith(codeDigits) && cleaned.length >= (codeDigits.length + 7);
    });
    
    if (startsWithPlus || startsWithDoubleZero || startsWithCode) {
      const parsed = parsePhoneAndDetect(val);
      setWhatsappCountry(parsed.countryCode);
      setWhatsappLocal(parsed.localNumber);
    } else {
      setWhatsappLocal(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !phoneLocal || !formData.groupId) {
      alert("Name, Phone, and Group are required.");
      return;
    }

    const finalPhone = `${phoneCountry}${phoneLocal}`.trim();
    const finalWhatsapp = whatsappLocal ? `${whatsappCountry}${whatsappLocal}`.trim() : '';
    const normalizedPhone = normalizePhoneNumber(finalPhone);

    // Validate email must be @gmail.com if provided
    if (formData.email && formData.email.trim()) {
      const cleanEmail = formData.email.trim().toLowerCase();
      if (!cleanEmail.endsWith('@gmail.com')) {
        alert("عذراً! يجب إدخال بريد إلكتروني ينتهي بـ @gmail.com فقط (حساب Gmail)، لأن المحاضرات وتسجيلات الحضور و Google Meet مرتبطة بحسابات الجيميل.");
        return;
      }
    }

    if (formData.attendanceEmail && formData.attendanceEmail.trim()) {
      const cleanAttEmail = formData.attendanceEmail.trim().toLowerCase();
      if (!cleanAttEmail.endsWith('@gmail.com')) {
        alert("عذراً! إيميل الحضور يجب أن يكون حساب Gmail ينتهي بـ @gmail.com فقط.");
        return;
      }
    }

    const updatedFormData = {
      ...formData,
      email: formData.email ? formData.email.trim() : '',
      attendanceEmail: formData.attendanceEmail ? formData.attendanceEmail.trim() : '',
      phone: normalizedPhone,
      whatsappLink: finalWhatsapp,
      telegramLink: ''
    };

    try {
      await saveStudent(editingStudent?.id || null, updatedFormData, user);
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error saving student: " + err.message);
    }
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setIsProcessing(true);
    try {
      await deleteStudent(studentToDelete.id, user);
      setStudentToDelete(null);
    } catch (err: any) {
      alert("Error deleting student: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkCleanPhoneNumbers = async () => {
    const targetStudents = filtered;
    if (targetStudents.length === 0) {
      alert('لا توجد أسماء طلاب في الدفعة/الجدول الحالي لتنظيف هواتفهم!');
      return;
    }
    const confirmNormalizing = window.confirm(`هل تريد فحص وتصحيح أرقام هواتف ${targetStudents.length} طالب بالدفعة المحددة حالياً تلقائياً؟ \n\nسيقوم هذا النظام الذكي بمسح المسافات، الأقواس، الرموز، وإضافة كود مصر (+20) أينما فُقِد لضمان دقة التواصل والربط بـ WhatsApp بنسبة 100%.`);
    if (!confirmNormalizing) return;

    setIsProcessing(true);
    let updatedCount = 0;
    try {
      for (const std of targetStudents) {
        const normalized = normalizePhoneNumber(std.phone);
        if (normalized && normalized !== std.phone) {
          await saveStudent(std.id, { phone: normalized }, user);
          updatedCount++;
        }
      }
      alert(`تم بنجاح فحص وتصحيح وتنسيق هواتف ${updatedCount} طالب بالصيغة الدولية الذكية 🎯`);
    } catch (err: any) {
      alert("حدث خطأ أثناء التحديث الجماعي للهواتف: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter logic
  const filtered = useMemo(() => {
    const term = searchTerm.trim();
    const normTerm = normalizeArabicText(term);
    const cleanDigitsTerm = term.replace(/\D/g, '');

    return students.filter(s => {
      // 1. Group status filter ('active' | 'archived' | 'all')
      const g = groups.find(gp => gp.id === s.groupId);
      if (filterGroupStatus === 'active') {
        if (g && g.archived) return false;
      } else if (filterGroupStatus === 'archived') {
        if (!g || !g.archived) return false;
      }

      // 2. Search term matching
      if (term) {
        const normName = normalizeArabicText(s.name || '');
        const normPhoneDigits = (s.phone || '').replace(/\D/g, '');
        const rawPhone = (s.phone || '').toLowerCase();
        const emailStr = (s.email || '').toLowerCase();
        const idStr = (s.studentIdNum || '').toLowerCase();

        const nameMatch = normName.includes(normTerm);
        const phoneMatch = cleanDigitsTerm.length >= 3 
          ? normPhoneDigits.includes(cleanDigitsTerm) || rawPhone.includes(term.toLowerCase())
          : rawPhone.includes(term.toLowerCase());
        const emailMatch = emailStr.includes(term.toLowerCase());
        const idMatch = idStr.includes(term.toLowerCase());

        if (!nameMatch && !phoneMatch && !emailMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [students, groups, filterGroupStatus, searchTerm]);

  // Excel Export Logic
  const handleExportExcel = () => {
    if (filtered.length === 0) {
      alert("No students to export based on your current filters.");
      return;
    }

    const dataToExport = filtered.map(s => {
      const group = groups.find(g => g.id === s.groupId);
      return {
        'Full Name': s.name,
        'Phone Number': s.phone,
        'Email Address': s.email || 'N/A',
        'Batch': group ? group.name : 'Unassigned',
        'Course': group ? group.courseName : 'N/A',
        'Student ID': s.studentIdNum || 'N/A',
        'Portal Password': s.studentPassword || 'N/A',
        'Portal Direct Link': `${customDomain}/#/student/portal`,
        'Joined At': s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered_Students");
    
    const fileName = `Students_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Layout user={user}>
      <div className="flex flex-col gap-6 mb-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Row 1: Actions & Titles */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex flex-col text-right font-sans" dir="rtl">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-wider">قائمة الطلاب والتحكم</h2>
            <p className="text-xs text-slate-400 mt-1">إدارة المتدربين والتحقق وتصدير التقارير والإرسال الجماعي</p>
          </div>
          
          <div className="flex flex-wrap gap-2.5 w-full lg:w-auto items-center justify-end">
            <Link 
              to="/student-directory" 
              className="flex-1 lg:flex-none bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-[10.5px] uppercase tracking-widest shadow-lg shadow-indigo-600/25 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 border border-purple-400/30"
            >
              🔍 فهرس وبوابة الطلاب
            </Link>
            <a 
              href="https://mails.sabergroupacademy.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 lg:flex-none bg-red-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📺 youtube bulk adder
            </a>
            <button 
              onClick={() => setIsBroadcastModalOpen(true)}
              className="flex-1 lg:flex-none bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📲 الإرسال الجماعي للأكواد
            </button>
            <button 
              onClick={() => setIsEmailBroadcastModalOpen(true)}
              className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="إرسال إيميل جماعي لجميع الطلاب المسجلين بالمنصة"
            >
              <Mail size={14} />
              <span>📧 إيميل جماعي للطلاب</span>
            </button>
            <button 
              onClick={() => setIsTemplateSettingsOpen(true)}
              className="flex-1 lg:flex-none bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white px-5 py-3 rounded-2xl font-black text-[10.5px] uppercase tracking-widest transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 border-0 active:scale-95 cursor-pointer"
              title="إعدادات القالب الرئيسي للرسائل الافتراضية"
            >
              <Settings size={14} />
              <span>⚙️ قالب واتساب</span>
            </button>
            <button 
              onClick={() => setIsAIExportModalOpen(true)}
              className="flex-1 lg:flex-none bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/25 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2 border border-indigo-400/30 cursor-pointer"
              title="تصدير شيت بأسماء وأكواد الطلاب لتغذية نظام المساعد الذكي (.xlsx / .csv)"
            >
              <Bot size={15} />
              <span>🤖 تصدير للمساعد الذكي</span>
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex-1 lg:flex-none bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📊 Export Excel
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="flex-1 lg:flex-none bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl leading-none">+</span> Add Student
            </button>
          </div>
        </div>

        {/* Row 2: Prominent Filters & Search Input */}
        <div className="flex flex-col md:flex-row gap-4 w-full items-stretch">
          {/* Text Search - Significantly enlarged and prominently styled */}
          <div className="relative flex-[2] w-full">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
            <input 
              type="text"
              placeholder="البحث بالاسم، رقم الموبايل، أو الإيميل... (Search by name or phone)"
              className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-slate-800 dark:text-slate-100 text-base md:text-lg tracking-wide placeholder-slate-400 shadow-inner"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Group Filter */}
          <div className="w-full md:w-80 flex items-center">
            <select
              value={filterGroupId}
              onChange={e => setFilterGroupId(e.target.value)}
              className="w-full h-full px-5 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-sm appearance-none cursor-pointer"
            >
              <option value="">All Groups (Filter) 👥</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>Batch {g.name} ({g.courseName}){g.archived ? ' [مؤرشفة 📦]' : ''}</option>
              ))}
            </select>
          </div>

          {/* Group Status Filter */}
          <div className="w-full md:w-80 flex items-center" dir="rtl">
            <select
              value={filterGroupStatus}
              onChange={e => setFilterGroupStatus(e.target.value as any)}
              className="w-full h-full px-5 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-sm appearance-none text-right font-sans cursor-pointer"
            >
              <option value="active">الجروبات الشغالة حالياً فقط ⚡</option>
              <option value="archived">الجروبات المؤرشفة (Archived) 📦</option>
              <option value="all">كل الجروبات (الكل) 🌐</option>
            </select>
          </div>

          {/* WhatsApp Sent Status Filter */}
          <div className="w-full md:w-80 flex items-center" dir="rtl">
            <select
              value={filterCredsSent}
              onChange={e => setFilterCredsSent(e.target.value)}
              className="w-full h-full px-5 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-sm appearance-none text-right font-sans cursor-pointer"
            >
              <option value="all">كل الحالات (تصفية واتساب) 🌐</option>
              <option value="sent">تم تسليم الكود والحساب ✅</option>
              <option value="not_sent">لم يتم الإرسال بعد ⬜</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Student Information</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Contact Info</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Email Address</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Batch Assignment</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest text-right" dir="rtl">تسليم الحساب والتحقق (WhatsApp)</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                    {searchTerm || filterGroupId ? "No students match your active filters." : "No students registered yet."}
                  </td>
                </tr>
              ) : (
                filtered.map(s => {
                  const group = groups.find(g => g.id === s.groupId);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs uppercase border border-blue-100 dark:border-blue-900/50">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold transition-all ${s.deactivated ? 'text-red-500/85 dark:text-red-400/85 line-through decoration-red-500/60' : 'text-slate-800 dark:text-slate-200'}`}>{s.name}</span>
                              {s.deactivated && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-500/15 text-red-500 border border-red-500/25 animate-pulse">
                                  موقوف ⚠️
                                </span>
                              )}
                              {(() => {
                                const activeFU = studentFollowUps.find(f => f.studentId === s.id && f.status === 'active');
                                if (!activeFU || !activeFU.labels) return null;
                                return activeFU.labels.map(l => {
                                  const lDef = labelDefinitions.find(def => def.name === l || def.id === l);
                                  if (lDef && lDef.visibleOnScreen === false) return null;

                                  let labelText = l;
                                  let bgColor = 'bg-slate-800';
                                  let textColor = 'text-slate-400';

                                  if (l === 'absence') { labelText = 'Absence'; bgColor = 'bg-red-500/20'; textColor = 'text-red-500'; }
                                  else if (l === 'tasks') { labelText = 'Tasks'; bgColor = 'bg-amber-500/20'; textColor = 'text-amber-500'; }
                                  else if (l === 'distinguished') { labelText = 'Distinguished'; bgColor = 'bg-emerald-500/20'; textColor = 'text-emerald-500'; }
                                  else if (l === 'best_achiever') { labelText = 'Best Achiever'; bgColor = 'bg-primary-500/20'; textColor = 'text-primary-500'; }
                                  else if (lDef) {
                                    return (
                                      <span key={l} className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest" style={{ backgroundColor: `${lDef.color}20`, color: lDef.color }}>
                                        {lDef.name}
                                      </span>
                                    );
                                  }

                                  return (
                                    <span key={l} className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${bgColor} ${textColor}`}>
                                      {labelText}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                            {s.deactivated && s.deactivationReason && (
                              <span className="text-[10px] text-red-400 font-bold leading-tight mt-0.5 max-w-[250px] truncate" title={s.deactivationReason}>
                                السبب: {s.deactivationReason}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono">
                                ID: {s.studentIdNum || 'Generating...'}
                              </span>
                              <span 
                                onClick={() => togglePasswordVisibility(s.id)}
                                className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all select-none flex items-center gap-1"
                                title="انقر لإظهار أو إخفاء كلمة المرور"
                              >
                                Pass: {visiblePasswords[s.id] ? (s.studentPassword || 'Generating...') : '••••••••'} 
                                <span className="text-[9px] opacity-70">{visiblePasswords[s.id] ? '🙈' : '👁️'}</span>
                              </span>
                            </div>
                            
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              {s.tasksLink ? (
                                <a
                                  href={s.tasksLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 rounded-xl text-[10px] font-black transition-all cursor-pointer font-arabic"
                                  title="انتقل إلى لينك التاسكات المخصص على تليجرام"
                                >
                                  <span>🔗 لينك التاسكات</span>
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleOpenModal(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black transition-all cursor-pointer font-arabic"
                                  title="اضغط لإضافة لينك توبيك التليجرام الخاص بتسليم تاسكات المتدرب"
                                >
                                  <span>➕ لينك التاسكات</span>
                                </button>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-400 font-medium mt-1">Joined {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-400">
                            <span className="text-xs">📞</span>
                            {s.phone}
                            {s.phone && (
                              <a 
                                href={`https://wa.me/${getCleanDigitsOnly(s.phone)}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-emerald-500 hover:text-emerald-400 transition-colors"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </a>
                            )}
                          </div>
                          {s.profileEditedFields?.phone && (
                            <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 font-arabic bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-950/30 w-fit mt-1 select-none">
                              🔄 عدّله الطالب يوم {s.profileEditedFields.phone.editedAt}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {!s.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-black font-arabic">⚠️ لا يوجد إيميل</span>
                            {s.phone && (
                              <a 
                                href={`https://wa.me/${getCleanDigitsOnly(s.phone)}?text=${encodeURIComponent(
                                  `السلام عليكم ورحمة الله وبركاته يا ${s.name} 👋\n\nنرجو من حضرتك تزويدنا بالبريد الإلكتروني (Gmail) الخاص بك الذي ستحضر منه المحاضرات التعليمية لتسجيله وتفعيله في السيستم لكي تتمكن من حضور المحاضرات.\n\n⚠️ ملاحظة: هذه رسالة تلقائية من النظام لاستكمال بياناتك.\n\nشكرًا لتعاونك! 💻🎓`
                                )}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1.5 text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-all animate-pulse inline-flex items-center gap-1"
                                title="طلب الإيميل عبر واتساب"
                              >
                                <MessageSquare size={12} />
                                <span className="text-[9px] font-black font-arabic">اطلب الإيميل</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-xl w-fit">
                              <span>✉️</span>
                              <span className="truncate max-w-[200px]">{s.email}</span>
                            </div>
                            {s.profileEditedFields?.email && (
                              <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 font-arabic bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-950/30 w-fit select-none">
                                🔄 عدّله الطالب يوم {s.profileEditedFields.email.editedAt}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group ? (
                          <div className="flex flex-col">
                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-blue-100 dark:border-blue-900/30 tracking-wider w-fit">
                              Batch {group.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold mt-1 ml-1">{group.courseName}</span>
                          </div>
                        ) : (
                          <span className="text-red-400 italic text-[10px] font-medium tracking-tight">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {s.phone ? (
                            <a
                              href={`https://wa.me/${getCleanDigitsOnly(s.phone)}?text=${encodeURIComponent(
                                broadcastTemplate
                                  .replace(/{name}/g, s.name || '')
                                  .replace(/{id}/g, s.studentIdNum || 'N/A')
                                  .replace(/{password}/g, s.studentPassword || 'N/A')
                                  .replace(/{portal_url}/g, `${customDomain}/#/student/portal`)
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-500/10 w-fit cursor-pointer"
                              title="إرسال بيانات الدخول مباشر على واتساب"
                            >
                              <MessageSquare size={13} />
                              <span>إرسال الـ ID والباسوورد (واتساب)</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-red-400 italic">بدون رقم هاتف</span>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={async () => {
                                const newStatus = !s.credsSent;
                                if (!newStatus) {
                                  const confirmUndo = window.confirm(`هل أنت متأكد من إلغاء علامة إرسال الكود لـ ${s.name}؟`);
                                  if (!confirmUndo) return;
                                }
                                try {
                                  await updateStudentCredsSentStatus(s.id, newStatus, user);
                                } catch (err: any) {
                                  alert('خطأ أثناء تحديث الحالة: ' + err.message);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                                s.credsSent
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                              }`}
                              title={s.credsSent ? 'اضغط لإلغاء العلامة' : 'اضغط للتعليم كـ تم الإرسال'}
                            >
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                s.credsSent ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-700'
                              }`}>
                                {s.credsSent && '✓'}
                              </span>
                              <span>{s.credsSent ? 'تم التسليم والوصول ✅' : 'لم يرسل بعد ⬜'}</span>
                            </button>

                            {s.credsSent && s.credsSentByName && (
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={`المسؤول: ${s.credsSentByName}`}>
                                👤 {s.credsSentByName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-60 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              if (!s.groupId) return alert('الطالب غير مسند لجروب');
                              try {
                                await triggerStudentWelcomeEmail(s);
                                alert('تم إرسال إيميل الترحيب وبيانات الدخول بنجاح! ✉️');
                              } catch (err: any) {
                                alert('فشل الإرسال: ' + err.message);
                              }
                            }}
                            className="p-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                            title="إعادة إرسال إيميل الترحيب والـ ID"
                          >
                            📧
                          </button>
                          <button
                            onClick={async () => {
                              if (!s.groupId) return alert('الطالب غير مسند لجروب');
                              if (!confirm(`هل تريد إرسال إيميل تحذير الغياب للطالب ${s.name}؟`)) return;
                              try {
                                await sendManualAbsenceWarningEmail(s.groupId, s.id);
                                alert('تم إرسال إيميل تحذير الغياب بنجاح! ⚠️');
                              } catch (err: any) {
                                alert('فشل الإرسال: ' + err.message);
                              }
                            }}
                            className="p-2.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                            title="إرسال إيميل تحذير غياب يدوي"
                          >
                            ⚠️
                          </button>
                          <button 
                            onClick={() => setSelectedStudentForStatusChange(s)}
                            className={`p-2 rounded-xl transition-all ${
                              s.deactivated 
                                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' 
                                : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                            title={s.deactivated ? "إعادة التنشيط (Reactivate)" : "تعطيل وإيقاف (Deactivate)"}
                          >
                            {s.deactivated ? '⚡' : '🚫'}
                          </button>
                          <button 
                            onClick={() => setSelectedStudentForHistory(s)}
                            className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                            title="View History"
                          >
                            📜
                          </button>
                          <button 
                            onClick={() => setSelectedStudentForWeakness({ id: s.id, name: s.name, groupId: s.groupId })}
                            className="p-2.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                            title="سجل نقاط الضعف ومواضع التطوير"
                          >
                            🎯
                          </button>
                          <button 
                            onClick={() => handleOpenModal(s)}
                            className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                            title="Edit Student"
                          >
                            ✏️
                          </button>
                          {canDelete && (
                            <button 
                              onClick={() => setStudentToDelete(s)}
                              className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              title="Delete Student"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {hasMore && !searchTerm && (
          <div className="flex justify-center py-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-800/5">
            <button
              onClick={() => setPageSize(prev => prev + 25)}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 active:scale-95 transition-all shadow-md flex items-center gap-2"
            >
              {isProcessing ? 'جاري التحميل...' : 'عرض المزيد (Load More) ⏬'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDeleteModal 
        isOpen={!!studentToDelete}
        onCancel={() => setStudentToDelete(null)}
        onConfirm={confirmDelete}
        entityName={studentToDelete?.name || ''}
        entityType="Student Record"
        isProcessing={isProcessing}
      />

      <StudentStatusModal
        isOpen={!!selectedStudentForStatusChange}
        onClose={() => setSelectedStudentForStatusChange(null)}
        student={selectedStudentForStatusChange}
        groups={groups}
        user={user}
        onSuccess={() => {
          // Firebase listener handles state updates automatically
          setSelectedStudentForStatusChange(null);
        }}
      />

      {/* history modal */}
      {selectedStudentForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm md:pl-72">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Student History</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{selectedStudentForHistory.name}</p>
              </div>
              <button 
                onClick={() => setSelectedStudentForHistory(null)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth no-scrollbar">
              {/* Deactivation & Reactivation History */}
              {selectedStudentForHistory.deactivationHistory && selectedStudentForHistory.deactivationHistory.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-red-550 dark:text-red-400 text-sm">⚠️</span> سجل إيقاف وتفعيل الحساب (Status Trail)
                  </h3>
                  <div className="space-y-3">
                    {selectedStudentForHistory.deactivationHistory.slice().reverse().map((h, hIdx) => (
                      <div key={hIdx} className={`p-4 rounded-xl border ${
                        h.type === 'deactivate' 
                          ? 'bg-red-500/5 dark:bg-red-950/10 border-red-500/20 text-red-650 dark:text-red-400' 
                          : 'bg-emerald-500/5 dark:bg-emerald-950/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-450'
                      }`}>
                        <div className="flex justify-between items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-black">
                            {h.type === 'deactivate' ? '❌ إيقاف وتعطيل حساب المتدرب' : '⚡ إعادة تنشيط وتفعيل الحساب'}
                          </span>
                          <span className="text-[9px] text-slate-450 dark:text-slate-400 font-mono">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-extrabold mb-2" dir="auto">
                          المنفذ: {h.performedByName}
                        </div>
                        <p className="text-xs text-slate-705 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed mb-2" dir="auto">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">السبب المذكور:</span>
                          {h.reason}
                        </p>
                        {h.checklist && Object.values(h.checklist).some(Boolean) && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                            <span className="text-[10px] font-black text-slate-500 block mb-1">الإجراءات والتحققات المكتملة:</span>
                            <ul className="list-disc list-inside text-[10px] text-slate-650 dark:text-slate-400 space-y-0.5">
                              {h.checklist.warned && <li>تم تنبيهه اكتر من مره</li>}
                              {h.checklist.telegramTopic && <li>تم ايقاف التوبيك الخاص به تليجرام</li>}
                              {h.checklist.telegramGroup && <li>تم ازالته من جروب تليجرام</li>}
                              {h.checklist.whatsappGroup && <li>تم ازالته من جروب الواتس أب</li>}
                              {h.checklist.recordingsGroup && <li>تم ازالته من جروب الريكوردات</li>}
                              {h.checklist.informed && <li>تم التواصل معه انه سيتم ايقافه</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Cases */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} /> Follow-up Records
                </h3>
                {studentFollowUps.filter(f => f.studentId === selectedStudentForHistory.id).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No follow-up records found.</p>
                ) : (
                  <div className="space-y-4">
                    {studentFollowUps.filter(f => f.studentId === selectedStudentForHistory.id).map(f => (
                      <div key={f.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${f.status === 'active' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                              {f.status}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {f.labels?.map(label => {
                                let text = label;
                                let color = 'bg-slate-500/20 text-slate-500';
                                if (label === 'absence') { text = 'غياب'; color = 'bg-red-500/10 text-red-500'; }
                                else if (label === 'tasks') { text = 'مهام'; color = 'bg-amber-500/10 text-amber-500'; }
                                else if (label === 'distinguished') { text = 'متميز'; color = 'bg-emerald-500/10 text-emerald-500'; }
                                else if (label === 'best_achiever') { text = 'أفضل إنجاز'; color = 'bg-primary-500/10 text-primary-550'; }
                                else if (label === 'online') { text = 'أونلاين 🌐'; color = 'bg-sky-500/10 text-sky-500 border border-sky-500/20'; }
                                else if (label === 'offline') { text = 'أوفلاين 🏢'; color = 'bg-teal-500/10 text-teal-500 border border-teal-500/20'; }
                                return (
                                  <span key={label} className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${color}`}>
                                    {text}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">Updated: {f.lastUpdatedAt?.toDate ? f.lastUpdatedAt.toDate().toLocaleString() : 'Recent'}</span>
                        </div>

                        {/* Action Figures: Group, Trainer, Supervisor, and Mentions */}
                        {(() => {
                          const g = groups.find(group => group.id === f.groupId);
                          const groupTrainers = allUsers.filter(u => g?.trainerIds?.includes(u.uid) || g?.assignedTrainerIds?.includes(u.uid)).map(u => u.name);
                          return (
                            <div className="flex flex-wrap gap-1.5 mb-4 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[8px] font-bold flex items-center gap-1">
                                🏫 {g?.name || f.groupName}
                              </span>
                              {groupTrainers.length > 0 && (
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-violet-100 dark:border-violet-950/30">
                                  👤 المدرب: {groupTrainers.join(', ')}
                                </span>
                              )}
                              {(g?.supervisorName || g?.supervisorId) && (
                                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-450 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-sky-100 dark:border-sky-950/30">
                                  👑 المشرف: {g?.supervisorName || 'معيّن'}
                                </span>
                              )}
                              {(g?.assistantTrainerName || (g?.assistantTrainerId && allUsers.find(u => u.uid === g.assistantTrainerId))) && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-emerald-100 dark:border-emerald-950/30">
                                  🤝 المساعد: {g?.assistantTrainerName || allUsers.find(u => u.uid === g?.assistantTrainerId)?.name}
                                </span>
                              )}
                              {f.mentionedUserName && (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-rose-100 dark:border-rose-950/30">
                                  🔔 منشن: {f.mentionedUserName}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        <div className="space-y-4">
                          {(() => {
                            const comments = f.comments || [];
                            const updates = f.updates || [];
                            
                            const parseHistoryDateLocal = (dateVal: any): number => {
                              if (!dateVal) return 0;
                              if (typeof dateVal === 'string') return new Date(dateVal).getTime();
                              if (dateVal.seconds) return dateVal.seconds * 1000;
                              if (dateVal.toDate) return dateVal.toDate().getTime();
                              return new Date(dateVal).getTime() || 0;
                            };

                            const formatHistoryDateLocal = (dateVal: any): string => {
                              if (!dateVal) return "-";
                              if (dateVal.toDate) return dateVal.toDate().toLocaleString('en-US', { hour12: true });
                              if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleString('en-US', { hour12: true });
                              const parsed = new Date(dateVal);
                              if (!isNaN(parsed.getTime())) return parsed.toLocaleString('en-US', { hour12: true });
                              return String(dateVal);
                            };

                            const combinedList = [
                              ...comments.map(c => ({
                                id: c.id,
                                text: c.text,
                                createdByUid: c.createdByUid,
                                createdByName: c.createdByName,
                                createdByRole: c.createdByRole || (c.createdByUid === 'system' ? 'النظام تلقائياً' : 'مستخدم'),
                                createdAt: c.createdAt,
                                type: c.createdByUid === 'system' ? 'system' : 'comment',
                              })),
                              ...updates.map(u => ({
                                id: u.id,
                                text: u.text,
                                createdByUid: u.createdByUid,
                                createdByName: u.createdByName,
                                createdByRole: 'متابع المتابعة',
                                createdAt: u.createdAt,
                                type: 'update',
                              }))
                            ].sort((a, b) => parseHistoryDateLocal(b.createdAt) - parseHistoryDateLocal(a.createdAt));

                            if (combinedList.length === 0) {
                              return <p className="text-xs text-slate-500 italic">No entries in this follow-up records.</p>;
                            }

                            return (
                              <div className="space-y-3">
                                {combinedList.map((item) => {
                                  const isSystem = item.type === 'system';
                                  const isUpdate = item.type === 'update';
                                  
                                  let cardBg = "bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800";
                                  let badgeColor = "text-primary-500 bg-primary-100/50 dark:bg-primary-950/40";
                                  let badgeText = "Comment • تعليق";
                                  
                                  if (isSystem) {
                                    cardBg = "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100/50 dark:border-indigo-950/40";
                                    badgeColor = "text-indigo-600 dark:text-indigo-400 bg-indigo-100/55 dark:bg-indigo-950/45";
                                    badgeText = "Notification / System • نظام وتنبيه";
                                  } else if (isUpdate) {
                                    cardBg = "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100/55 dark:border-emerald-950/35";
                                    badgeColor = "text-emerald-600 dark:text-emerald-400 bg-emerald-100/55 dark:bg-emerald-950/45";
                                    badgeText = "Progress Update • تحديث متابعة";
                                  }
                                  
                                  return (
                                    <div key={item.id} className={`p-4 rounded-xl border ${cardBg} shadow-sm`}>
                                      <div className="flex justify-between items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                                          {item.createdByName} {isSystem ? '' : `(${item.createdByRole})`}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-mono">{formatHistoryDateLocal(item.createdAt)}</span>
                                      </div>
                                      <div className="mb-2">
                                        <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeColor}`}>
                                          {badgeText}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed" dir="auto">
                                        {item.text}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

               {/* Penalties */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Trash2 size={14} className="text-red-500" /> Penalties
                </h3>
                {penalties.filter(p => p.studentId === selectedStudentForHistory.id).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No penalties found.</p>
                ) : (
                  <div className="space-y-3">
                    {penalties.filter(p => p.studentId === selectedStudentForHistory.id).map(p => (
                      <div key={p.id} className="bg-red-50/50 dark:bg-red-950/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.reason}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : 'Recent'}</p>
                        </div>
                        <span className="text-sm font-black text-red-600">-{p.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile Edits History */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-sm">📂</span> سجل تعديل البيانات الشخصية بواسطة الطالب (Profile Changes)
                </h3>
                {!selectedStudentForHistory.profileEditHistory || selectedStudentForHistory.profileEditHistory.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">لم يقم الطالب بإجراء أي تعديلات على بياناته بعد.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedStudentForHistory.profileEditHistory.map((h, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 font-arabic" dir="rtl">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                            تعديل حقل: {h.fieldNameAr}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {h.editedAt}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px] font-bold">القيمة السابقة:</span>
                            <span className="text-slate-500 line-through font-mono">{h.oldValue || '(فارغ)'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-450 block text-[10px] font-bold">القيمة الجديدة:</span>
                            <span className="text-emerald-500 dark:text-emerald-400 font-mono font-black">{h.newValue || '(فارغ)'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm md:pl-72">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {editingStudent ? 'Update Trainee' : 'Register Trainee'}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Student Profile Management</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-3xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Full Name *</label>
                  <input
                    type="text" required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                    placeholder="e.g. John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Phone Number *</label>
                  <div className="flex gap-2" dir="ltr">
                    <select
                      value={phoneCountry}
                      onChange={(e) => setPhoneCountry(e.target.value)}
                      className="w-1/3 px-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-xs cursor-pointer"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneLocal}
                      onChange={handlePhoneChange}
                      required
                      className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm text-center font-mono"
                      placeholder="e.g. 1012345678"
                    />
                  </div>
                  {editingStudent?.profileEditedFields?.phone && (
                    <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-1 font-arabic" dir="rtl">
                      🔄 عدّله الطالب يوم {editingStudent.profileEditedFields.phone.editedAt} (السابق: {editingStudent.profileEditedFields.phone.previousValue || '(فارغ)'})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest flex items-center justify-between">
                    <span>البريد الإلكتروني (Gmail فقط)</span>
                    <span className="text-[9px] text-amber-500 font-bold font-arabic">@gmail.com</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm font-mono"
                    placeholder="example@gmail.com"
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 font-arabic" dir="rtl">
                    ⚠️ يجب استخدام بريد إلكتروني ينتهي بـ @gmail.com فقط، لأن حضور المحاضرات ورابط Google Meet مرتبط بحساب الجيميل.
                  </p>
                  {editingStudent?.profileEditedFields?.email && (
                    <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-1 font-arabic" dir="rtl">
                      🔄 عدّله الطالب يوم {editingStudent.profileEditedFields.email.editedAt} (السابق: {editingStudent.profileEditedFields.email.previousValue || '(فارغ)'})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest flex items-center justify-between">
                    <span>Attendance Email (Gmail - Google Calendar)</span>
                    <span className="text-[9px] text-amber-500 font-bold font-arabic">@gmail.com</span>
                  </label>
                  <input
                    type="email"
                    value={formData.attendanceEmail}
                    onChange={(e) => setFormData({...formData, attendanceEmail: e.target.value})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm font-mono"
                    placeholder="attendance@gmail.com"
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 font-arabic" dir="rtl">
                    ⚠️ إيميل الجيميل المخصص لدعوات Google Calendar وحضور المحاضرات.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">WhatsApp Number</label>
                  <div className="flex gap-2" dir="ltr">
                    <select
                      value={whatsappCountry}
                      onChange={(e) => setWhatsappCountry(e.target.value)}
                      className="w-1/3 px-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-xs cursor-pointer"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={whatsappLocal}
                      onChange={handleWhatsappChange}
                      className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm text-center font-mono"
                      placeholder="e.g. 1012345678"
                    />
                  </div>
                  {editingStudent?.profileEditedFields?.whatsappLink && (
                    <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-1 font-arabic" dir="rtl">
                      🔄 عدّله الطالب يوم {editingStudent.profileEditedFields.whatsappLink.editedAt} (السابق: {editingStudent.profileEditedFields.whatsappLink.previousValue || '(فارغ)'})
                    </p>
                  )}
                </div>


                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Assign to Group *</label>
                  <select
                    required
                    value={formData.groupId}
                    onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                  >
                    <option value="">Select a batch...</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>Batch {g.name} - {g.courseName}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2" dir="rtl">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest text-right">لينك التاسكات (Telegram Topic URL)</label>
                  <input
                    type="url"
                    value={formData.tasksLink}
                    onChange={(e) => setFormData({...formData, tasksLink: e.target.value})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm text-left"
                    placeholder="https://t.me/c/..."
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-450 mt-1.5 text-right">لينك التوبيك الخاص بالمتدرب في جروب التليجرام لتسليم ومراجعة مهامه مباشرة من السيستم وبوابته الشخصية.</p>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all border border-slate-100 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                >
                  {editingStudent ? 'Save Changes' : 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Interactive Bulk Broadcast Center */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-[30px] w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[95vh] md:h-[92vh] max-h-[98vh] border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📲 مساعد الإرسال والـ Broadcast للطلاب</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-black font-mono">
                    {filtered.length} طالب
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">توليد رسائل مخصصة مع أرقام ID وحسابات المنصة للطلاب لتوزيعها بسرعة</p>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100 dark:divide-slate-800">
              
              {/* Right Column: Template Configuration and Preview (Size 5/12) */}
              <div className="col-span-1 lg:col-span-5 p-4 sm:p-6 overflow-y-auto space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-50 dark:[&::-webkit-scrollbar-track]:bg-slate-900/30 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                
                {/* Notice */}
                {!filterGroupId && (
                  <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-2xl text-[11px] leading-relaxed font-bold">
                    💡 <strong>تنبيه تنظيم العمل:</strong> يفضّل استخدام فلتر المجموعات في الجدول الرئيسي بالخلف لتحديد دفعة معينة قبل فتح مساعد الإرسال، وذلك ليسهل تتبع إرسال الأكواد دون تكرار.
                  </div>
                )}

                {/* Template Editor */}
                <div className="space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">✍️ قالب نص الرسالة المخصصة</label>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          saveBroadcastTemplate(`أهلاً بك يا {name} 👋

ندعوك لتجربة المساعد الذكي الجديد MARO AI الخاص بأكاديمية Saber Group!
🌐 رابط المساعد الذكي: https://ai.sabergroupacademy.com/

🔑 بيانات دخولك:
• ID: {id}
• Password: {password}

📌 الشروط والتعليمات:
1️⃣ إذا كنت في جروب شغال حالياً ومُلتزم بالحضور:
- يرجى عمل شير لبوست الفيسبوك التالي:
https://www.facebook.com/photo/?fbid=1014941958047609&set=a.149461877928959
- وإرسال سكرين شوت من الشير وسكرين شوت تثبت تواجدك بالجروب الشغال حالياً.

2️⃣ إذا كنت في جروب أنهى الكورس:
- يجب أن تكون حاصلاً على الشهادة الخاصة بالكورس وإرسال سكرين شوت منها (أو من الجروب الشغال حالياً).

تمنياتنا لك بالتوفيق! 🤖✨`);
                        }}
                        className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                      >
                        🤖 قالب المساعد MARO AI
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('هل تريد استعادة القالب الافتراضي المنسق؟')) {
                            saveBroadcastTemplate(`مرحباً {name}، 👋

إليك بيانات تسجيل دخولك الخاصة بالمنصة التعليمية لـ Saber Group Academy:

👤 معرّف الطالب (ID): {id}
🔑 كلمة المرور (Password): {password}

🌐 رابط الدخول المباشر للمنصة:
{portal_url}

تمنياتنا لك بالتوفيق والنجاح المستمر! 🎓✨`);
                          }
                        }}
                        className="text-[10px] text-slate-500 hover:text-indigo-500 font-bold hover:underline"
                      >
                        الافتراضي
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={broadcastTemplate}
                    onChange={(e) => saveBroadcastTemplate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200"
                    placeholder="اكتب رسالتك لجميع الطلاب هنا..."
                  />
                  
                  {/* Variables badges */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold block">الرموز المتوفرة تلقائياً في النص:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono">{"{name}"} : الاسم</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono">{"{id}"} : المعرّف</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono">{"{password}"} : كلمة المرور</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono">{"{portal_url}"} : الرابط</span>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                {filtered.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center bg-transparent">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">👁️ معاينة شكل الرسالة لأول طالب</label>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">بث مباشر للرسالة</span>
                    </div>
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-right">
                      {(() => {
                        const sampleStudent = filtered[0];
                        return sampleStudent ? (
                          broadcastTemplate
                            .replace(/{name}/g, sampleStudent.name || '')
                            .replace(/{id}/g, sampleStudent.studentIdNum || 'SG-26034')
                            .replace(/{password}/g, sampleStudent.studentPassword || 'Pass8832')
                            .replace(/{portal_url}/g, `${customDomain}/#/student/portal`)
                        ) : 'لا توجد بيانات حالياً';
                      })()}
                    </div>
                  </div>
                )}

                {/* Bulk tools */}
                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">🛠️ أدوات إضافية مساعدة</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (filtered.length === 0) {
                          alert('لا يوجد طلاب لتوليد الجدول لهم!');
                          return;
                        }
                        let text = "جدول بيانات دخول الطلاب Saber Group Academy:\n\n";
                        filtered.forEach((std) => {
                          text += `• الاسم: ${std.name}\n  المعرف (ID): ${std.studentIdNum || 'معلق'}\n  كلمة المرور: ${std.studentPassword || 'معلق'}\n  الرابط: ${customDomain}/#/student/portal\n\n`;
                        });
                        navigator.clipboard.writeText(text);
                        alert(`تم نسخ بيانات ${filtered.length} طالب بكامل تفاصيلهم بنجاح كقائمة للحافظة!`);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 p-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 w-full"
                    >
                      📋 نسخ جدول البيانات للكل
                    </button>

                    <button
                      type="button"
                      onClick={clearSentTracking}
                      className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 p-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 w-full border border-red-100/30"
                    >
                      <RotateCcw size={12} /> تصفير حالات الإرسال
                    </button>

                    <button
                      type="button"
                      onClick={bulkCleanPhoneNumbers}
                      className="col-span-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white p-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 w-full shadow-sm"
                    >
                      ⚡ تصحيح وضبط هواتف الجدول بالكامل (+20)
                    </button>
                  </div>
                </div>

              </div>

              {/* Left Column: Trainees Action List (Size 7/12) */}
              <div className="col-span-1 lg:col-span-7 flex flex-col h-[550px] lg:h-full bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden">
                {/* Statistics Counter */}
                <div className="p-4 bg-white dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">حالة إرسال الـ QR والأكواد بالدفعة الحالية:</span>
                  <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-black">
                    تم إرسال {filtered.filter(s => sentTracking[s.id]).length} من {filtered.length} طالب
                  </div>
                </div>

                {/* Scalable List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 p-4 space-y-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-50 dark:[&::-webkit-scrollbar-track]:bg-slate-900/30 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 italic text-xs">
                      لا توجد أسماء طلاب في هذه المجموعة لمراسلتهم حالياً. يرجى تعديل الفلتر بالخلفية للبحث.
                    </div>
                  ) : (
                    filtered.map((std) => {
                      const isSent = !!sentTracking[std.id];
                      const compiledText = broadcastTemplate
                        .replace(/{name}/g, std.name || '')
                        .replace(/{id}/g, std.studentIdNum || 'N/A')
                        .replace(/{password}/g, std.studentPassword || 'N/A')
                        .replace(/{portal_url}/g, `${customDomain}/#/student/portal`);

                      const waUrl = `https://wa.me/${getCleanDigitsOnly(std.phone)}?text=${encodeURIComponent(compiledText)}`;

                      return (
                        <div 
                          key={std.id} 
                          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSent 
                              ? 'border-emerald-500/20 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.02]' 
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Student Details */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateSentStatus(std.id, !isSent)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                                isSent 
                                  ? 'bg-emerald-500 border-emerald-600 text-white' 
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-855 text-transparent hover:border-indigo-500'
                              }`}
                              title={isSent ? "إلغاء تعيين كتم إرساله" : "تعيين كتم إرساله يدوياً"}
                            >
                              <Check size={14} className={isSent ? "opacity-100" : "opacity-0"} />
                            </button>
                            
                            <div className="text-right">
                              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 block">{std.name}</span>
                              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                                <span className="text-[10px] text-slate-500 font-bold font-sans">{std.phone}</span>
                                <span className="text-slate-300 dark:text-slate-800 text-[10px]">|</span>
                                <span className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 font-bold">ID: {std.studentIdNum || 'معلق'}</span>
                                <span className="text-slate-300 dark:text-slate-800 text-[10px]">|</span>
                                <span 
                                  onClick={() => togglePasswordVisibility(std.id)}
                                  className="text-[10px] font-mono text-slate-400 font-bold cursor-pointer hover:text-indigo-500 transition-colors select-none"
                                  title="انقر لإظهار أو إخفاء كلمة المرور"
                                >
                                  Pass: {visiblePasswords[std.id] ? (std.studentPassword || 'معلق') : '••••••••'} 👁️
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Send Triggers */}
                          <div className="flex items-center gap-1.5 justify-end">
                            {/* Copy Message Text */}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(compiledText);
                                updateSentStatus(std.id, true);
                              }}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black transition-all flex items-center gap-1"
                              title="نسخ نص الرسالة الخاص بهذا الطالب تلقائياً للـ clipboard وتعليمه كمكتمل"
                            >
                              <Copy size={12} />
                              <span>نسخ الرسالة</span>
                            </button>

                            {/* Dispatch via WA */}
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => updateSentStatus(std.id, true)}
                              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[10px] font-black transition-all flex items-center gap-1 shadow-sm hover:shadow-emerald-500/10"
                              title="فتح محادثة واتساب مباشر مجهزة بهذا النص الرائع وتعليمه كمكتمل الإرسال"
                            >
                              <Send size={12} className="transform -rotate-45" />
                              <span>إرسال واتساب 🟢</span>
                            </a>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footnote */}
                <div className="p-4 bg-white dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                  <span>💡 بمجرد النقر على "إرسال واتساب" أو "نسخ الرسالة"، سيتم تظليل الطالب تلقائياً باللون الأخضر لحفظ تقدم الإرسال وتجنب الإرسال المكرر للطالب. يمكنك التصفير في أي وقت.</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL: Template Settings */}
      {isTemplateSettingsOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-[30px] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>⚙️ إعدادات قالب رسائل وبيانات الدخول للطلاب</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-bold mt-1">تعديل وتخصيص نص الرسالة التي يتم تحويلها تلقائياً على واتساب</p>
              </div>
              <button 
                onClick={() => setIsTemplateSettingsOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-right">
              {/* Editor */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 dark:text-slate-400 block pb-1">✍️ مسودة القالب الحالية (تُطبق تلقائياً على أزرار واتساب الفردية وبث الدفعات):</label>
                <textarea
                  rows={8}
                  value={broadcastTemplate}
                  onChange={(e) => saveBroadcastTemplate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 font-mono"
                  placeholder="مرحباً {name}..."
                />
              </div>

              {/* Variable tips */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-black text-slate-400 block">💡 الرموز التلقائية المدعومة:</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono text-indigo-500 font-bold">{"{name}"}</span>
                    <span className="text-[9px] text-slate-400 font-bold">اسم الطالب كاملاً</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono text-indigo-500 font-bold">{"{id}"}</span>
                    <span className="text-[9px] text-slate-400 font-bold font-sans">معرف/أكواد ID الطالب</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono text-indigo-500 font-bold">{"{password}"}</span>
                    <span className="text-[9px] text-slate-400 font-bold">كلمة المرور التلقائية</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono text-indigo-500 font-bold">{"{portal_url}"}</span>
                    <span className="text-[9px] text-slate-400 font-bold">رابط تسجيل المنصة</span>
                  </div>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* Back to System Default */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل تريد تجاهل التعديلات والعودة للقالب الافتراضي الرئيسي للنظام؟\n\n(سيقوم هذا بالإلغاء والرجوع للقالب الافتراضي المعتمد من الإدارة مباشرة)')) {
                      setBroadcastTemplate(globalTemplate);
                      localStorage.setItem('saberStudentBroadcastTemplate', globalTemplate);
                      localStorage.setItem('saberStudentBroadcastTemplate_isCustom', 'false');
                    }
                  }}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-black p-3.5 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 w-full"
                >
                  العودة للtemplate الافتراضية للسيستم 🔄
                </button>

                {/* Save Master Default (Admin Only) */}
                {user.role === 'admin' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('هل أنت متأكد من رغبتك في حفظ هذا القالب ليكون القالب الافتراضي الرئيسي للسيستم عند جميع المستخدمين والمنسقين والمدربين؟')) {
                        try {
                          await saveGlobalStudentTemplate(broadcastTemplate, user);
                          setGlobalTemplate(broadcastTemplate);
                          localStorage.setItem('saberStudentBroadcastTemplate_isCustom', 'false');
                          alert('تم اعتماد القالب كقالب افتراضي لجميع المدراء والمنسقين بنجاح! 🎉');
                        } catch (err: any) {
                          alert('خطأ أثناء حفظ القالب: ' + err.message);
                        }
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black p-3.5 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all w-full"
                  >
                    حفظ كـ template أساسية للسيستم (أدمن فقط) 💾
                  </button>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-3 flex items-center justify-center text-center text-[10px] text-slate-400 font-bold">
                    🛡️ زر اعتماد قالب السيستم متاح لمدير النظام (Admin) فقط. تعديلاتك الحالية تُحفظ بمتصفحك فقط.
                  </div>
                )}

                {/* Absolute reset completely */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من تصفير القالب بالكامل واستعادة النص الأصلي الافتراضي للبرنامج ككل؟ (تجاهل مسودة المتصفح وقالب السيستم)')) {
                      setBroadcastTemplate(ABSOLUTE_DEFAULT_TEMPLATE);
                      localStorage.setItem('saberStudentBroadcastTemplate', ABSOLUTE_DEFAULT_TEMPLATE);
                      localStorage.setItem('saberStudentBroadcastTemplate_isCustom', 'false');
                    }
                  }}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-black p-3.5 rounded-2xl transition-all border border-red-500/20 w-full"
                >
                  إعادة تعيين لمصنع البرنامج ⚠️
                </button>
              </div>

              {/* Sample Live Preview */}
              {filtered.length > 0 && (
                <div className="space-y-2 border-t border-slate-150 dark:border-slate-800 pt-4">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 block text-right">👁️ معاينة فورية للرسالة (للطالب: {filtered[0].name}):</span>
                  <div className="bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] border border-emerald-500/15 rounded-2xl p-5 text-xs text-slate-700 dark:text-slate-350 leading-relaxed whitespace-pre-wrap text-right font-sans max-h-48 overflow-y-auto w-full">
                    {broadcastTemplate
                      .replace(/{name}/g, filtered[0].name || '')
                      .replace(/{id}/g, filtered[0].studentIdNum || '676626')
                      .replace(/{password}/g, filtered[0].studentPassword || '61833')
                      .replace(/{portal_url}/g, `${customDomain}/#/student/portal`)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AIStudentExportModal
        isOpen={isAIExportModalOpen}
        onClose={() => setIsAIExportModalOpen(false)}
        allStudents={students}
        filteredStudents={filtered}
        groups={groups}
      />

      <TrainerBroadcastEmailModal
        isOpen={isEmailBroadcastModalOpen}
        onClose={() => setIsEmailBroadcastModalOpen(false)}
        group={groups.find(g => g.id === filterGroupId) || null}
        students={filtered}
        user={user}
        trainers={allUsers.filter(u => u.role === 'trainer' || u.role === 'admin')}
      />

      {selectedStudentForWeakness && (
        <StudentWeaknessModal
          isOpen={!!selectedStudentForWeakness}
          onClose={() => setSelectedStudentForWeakness(null)}
          studentId={selectedStudentForWeakness.id}
          studentName={selectedStudentForWeakness.name}
          groupId={selectedStudentForWeakness.groupId}
          groupName={groups.find(g => g.id === selectedStudentForWeakness.groupId)?.name}
          user={user}
        />
      )}

      {selectedStudentForHistory && (
        <StudentHistoryModal
          isOpen={!!selectedStudentForHistory}
          onClose={() => setSelectedStudentForHistory(null)}
          student={selectedStudentForHistory}
          groupName={groups.find(g => g.id === selectedStudentForHistory.groupId)?.name}
          user={user}
        />
      )}
    </Layout>
  );
};

export default Students;
