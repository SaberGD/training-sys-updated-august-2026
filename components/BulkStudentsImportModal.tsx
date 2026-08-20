import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Student } from '../types';
import { logActivity, triggerStudentWelcomeEmail } from '../services/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Upload, 
  Check, 
  X, 
  AlertTriangle, 
  Users, 
  Info, 
  FileJson, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { normalizeEgyptPhone, checkIs50PercentPaid } from './AccountingImportModal';

interface BulkStudentsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currentStudents: Student[];
  user: User;
  onSuccess: () => void;
}

interface StudentBulkPreview {
  id: string; // temp unique ID for list rendering
  fullName: string;
  phone: string;
  normalizedPhone: string;
  whatsapp: string;
  email: string;
  githubProfile: string;
  linkedinProfile: string;
  paymentStatus: string;
  is50PercentPaid: boolean;
  salesName: string;
  notes: string;
  sourceBookingId: string;
  sourceCustomerId: string;
  status: 'new' | 'existing_in_db' | 'already_in_group' | 'duplicate_in_file' | 'invalid';
  reasonAr: string;
  reasonEn: string;
  existingStudentRef?: Student; // Reference to existing student in system to reuse credentials
  shouldImport: boolean;
}

const BulkStudentsImportModal: React.FC<BulkStudentsImportModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  currentStudents,
  user,
  onSuccess
}) => {
  const { lang } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1); // 1: Upload & File parsing, 2: Preview & Selection, 3: Completed Result
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importedJson, setImportedJson] = useState<any>(null);

  // Preview List
  const [studentsPreview, setStudentsPreview] = useState<StudentBulkPreview[]>([]);
  
  // Inline editing state for fixing phone / name / email
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentData, setEditingStudentData] = useState<Partial<StudentBulkPreview>>({});

  // Db Students for cross-system checking
  const [dbStudents, setDbStudents] = useState<Student[]>([]);

  // Import operation stats
  const [resultStats, setResultStats] = useState<{
    totalProcessed: number;
    createdCount: number;
    linkedCount: number;
    skippedCount: number;
  } | null>(null);

  const startEditingStudent = (s: StudentBulkPreview, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStudentId(s.id);
    setEditingStudentData({
      fullName: s.fullName,
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email
    });
  };

  const cancelEditingStudent = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStudentId(null);
    setEditingStudentData({});
  };

  const saveStudentChanges = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setStudentsPreview(prev => prev.map(s => {
      if (s.id === id) {
        const updatedName = (editingStudentData.fullName !== undefined ? editingStudentData.fullName : s.fullName || '').trim();
        
        let rawPhone = String(editingStudentData.phone !== undefined ? editingStudentData.phone : s.phone || '').trim();
        if (/^\d{10}$/.test(rawPhone)) {
          rawPhone = "0" + rawPhone;
        }
        const phoneStr = rawPhone;

        let rawWhatsapp = String(editingStudentData.whatsapp !== undefined ? editingStudentData.whatsapp : s.whatsapp || '').trim();
        if (/^\d{10}$/.test(rawWhatsapp)) {
          rawWhatsapp = "0" + rawWhatsapp;
        }
        const whatsappStr = rawWhatsapp || phoneStr;

        const normalizedPhone = normalizeEgyptPhone(phoneStr) || phoneStr;
        const normalizedWhatsapp = normalizeEgyptPhone(whatsappStr) || whatsappStr;
        const email = String(editingStudentData.email !== undefined ? editingStudentData.email : s.email || '').trim().toLowerCase();

        let status: StudentBulkPreview['status'] = 'new';
        let reasonAr = 'تم تعديل وتصحيح البيانات بنجاح';
        let reasonEn = 'Details corrected successfully';
        let existingStudentRef: Student | undefined = undefined;

        if (!updatedName) {
          status = 'invalid';
          reasonAr = 'الاسم الكامل مفقود';
          reasonEn = 'Full name is missing';
        } else if (!phoneStr) {
          status = 'invalid';
          reasonAr = 'رقم الهاتف مفقود';
          reasonEn = 'Phone number is missing';
        } else {
          // Check if already in current group
          const alreadyInGroup = currentStudents.find(curS => 
            normalizeEgyptPhone(curS.phone) === normalizedPhone || 
            curS.phone === normalizedPhone ||
            (curS.email && email && curS.email.toLowerCase() === email) ||
            curS.name.toLowerCase() === updatedName.toLowerCase()
          );

          if (alreadyInGroup) {
            status = 'already_in_group';
            reasonAr = 'موجود بالفعل في هذا الجروب';
            reasonEn = 'Already enrolled in this group';
          } else {
            // Check if student exists in database (under another group) to re-use credentials
            const matchedDbStudent = dbStudents.find(dbS => 
              normalizeEgyptPhone(dbS.phone) === normalizedPhone || 
              dbS.phone === normalizedPhone ||
              (dbS.email && email && dbS.email.toLowerCase() === email)
            );

            if (matchedDbStudent) {
              status = 'existing_in_db';
              existingStudentRef = matchedDbStudent;
              reasonAr = !s.is50PercentPaid 
                ? 'مسجل بالنظام من قبل (غير مستكمل المبلغ - سيستورد موقوفاً)'
                : 'مسجل بالنظام من قبل (سيتم ربطه بالجروب)';
              reasonEn = !s.is50PercentPaid 
                ? 'Registered previously (Incomplete payment - will import deactivated)'
                : 'Registered in system previously (will link)';
            }
          }
        }

        if (!s.is50PercentPaid && status === 'new') {
          reasonAr = 'طالب غير مستكمل المبلغ (سيتم استيراده بحالة موقوف)';
          reasonEn = 'Incomplete payment student (will be imported as deactivated)';
        }

        const shouldImport = status === 'new' || status === 'existing_in_db';

        return {
          ...s,
          fullName: updatedName,
          phone: normalizedPhone || phoneStr,
          normalizedPhone,
          whatsapp: normalizedWhatsapp || normalizedPhone || phoneStr,
          email,
          status,
          reasonAr,
          reasonEn,
          existingStudentRef,
          shouldImport
        };
      }
      return s;
    }));

    setEditingStudentId(null);
    setEditingStudentData({});
  };

  // Fetch db students once opened to determine if they exist in other groups
  useEffect(() => {
    if (isOpen) {
      const fetchDbStudents = async () => {
        try {
          const qSnap = await getDocs(collection(db, 'students'));
          const list = qSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student);
          setDbStudents(list);
        } catch (err) {
          console.error("Failed to load db students for linkage matching:", err);
        }
      };
      fetchDbStudents();
      
      // Reset State
      setStep(1);
      setErrorMsg(null);
      setImportedJson(null);
      setStudentsPreview([]);
      setIsSubmitting(false);
      setResultStats(null);
    }
  }, [isOpen]);

  const handleJsonData = (parsed: any) => {
    try {
      if (!parsed.students || !Array.isArray(parsed.students)) {
        throw new Error(
          lang === 'ar' 
            ? "بنية الملف غير صالحة. يجب أن يحتوي الملف على مصفوفة 'students' بالطلاب." 
            : "Invalid file structure. Must contain a 'students' array."
        );
      }

      setImportedJson(parsed);

      const fileStudents = parsed.students;
      const seenPhonesInFile = new Set<string>();

      const listPreviews: StudentBulkPreview[] = fileStudents.map((s: any, idx: number) => {
        const rawPhone = s.phone || s.phoneNumber || s.mobile || s.customerPhone || "";
        let phoneNo = String(rawPhone || "").trim();
        
        const rawWhatsapp = s.whatsapp || s.whatsApp || s.whatsappNumber || "";
        let whatsappNo = String(rawWhatsapp || "").trim();

        // Fall back to Whatsapp if phone number is missing
        if (!phoneNo && whatsappNo) {
          phoneNo = whatsappNo;
        }

        let phoneStr = phoneNo;
        if (/^\d{10}$/.test(phoneStr)) {
          phoneStr = "0" + phoneStr;
        }

        let whatsappStr = whatsappNo || phoneStr;
        if (/^\d{10}$/.test(whatsappStr)) {
          whatsappStr = "0" + whatsappStr;
        }

        let normalizedPhone = normalizeEgyptPhone(phoneStr) || phoneStr; // Bypass constraint, fall back to phoneStr
        let normalizedWhatsapp = normalizeEgyptPhone(whatsappStr) || whatsappStr;

        const rawEmail = s.email || s.customerEmail || s.emailAddress || s.mail || "";
        const email = String(rawEmail).trim().toLowerCase();
        const fullName = (s.fullName || s.name || '').trim();

        let status: StudentBulkPreview['status'] = 'new';
        let reasonAr = 'طالب جديد سيتم إنشاؤه';
        let reasonEn = 'New trainee to be created';

        // Check validation first
        if (!fullName) {
          status = 'invalid';
          reasonAr = 'الاسم الكامل مفقود';
          reasonEn = 'Full name is missing';
        } else if (!phoneStr && !normalizedPhone) {
          status = 'invalid';
          reasonAr = 'رقم الهاتف مفقود';
          reasonEn = 'Phone number is missing';
        } else if (normalizedPhone && seenPhonesInFile.has(normalizedPhone)) {
          status = 'duplicate_in_file';
          reasonAr = 'مكرر داخل الملف المرفوع';
          reasonEn = 'Duplicate phone number inside file';
        }

        const is50PercentPaid = checkIs50PercentPaid(s);

        // Check if already in current group
        if (status !== 'invalid' && status !== 'duplicate_in_file' && normalizedPhone) {
          seenPhonesInFile.add(normalizedPhone);

          const alreadyInGroup = currentStudents.find(curS => 
            normalizeEgyptPhone(curS.phone) === normalizedPhone || 
            curS.phone === normalizedPhone ||
            (curS.email && email && curS.email.toLowerCase() === email) ||
            curS.name.toLowerCase() === fullName.toLowerCase()
          );

          if (alreadyInGroup) {
            status = 'already_in_group';
            reasonAr = 'موجود بالفعل في هذا الجروب';
            reasonEn = 'Already enrolled in this group';
          } else {
            // Check if student exists in database (under another group) to re-use credentials
            const matchedDbStudent = dbStudents.find(dbS => 
              normalizeEgyptPhone(dbS.phone) === normalizedPhone || 
              dbS.phone === normalizedPhone ||
              (dbS.email && email && dbS.email.toLowerCase() === email)
            );

            if (matchedDbStudent) {
              status = 'existing_in_db';
              reasonAr = !is50PercentPaid 
                ? 'مسجل بالنظام من قبل (غير مستكمل المبلغ - سيستورد موقوفاً)'
                : 'مسجل بالنظام من قبل (سيتم ربطه بالجروب)';
              reasonEn = !is50PercentPaid 
                ? 'Registered previously (Incomplete payment - will import deactivated)'
                : 'Registered in system previously (will link)';
              return {
                id: `bulk_${idx}`,
                fullName,
                phone: normalizedPhone || phoneStr,
                normalizedPhone,
                whatsapp: normalizedWhatsapp || normalizedPhone || phoneStr,
                email,
                githubProfile: s.githubProfile || '',
                linkedinProfile: s.linkedinProfile || '',
                paymentStatus: s.paymentStatus || (is50PercentPaid ? 'paid' : 'pending'),
                is50PercentPaid,
                salesName: s.salesName || '',
                notes: s.notes || '',
                sourceBookingId: s.sourceBookingId || '',
                sourceCustomerId: s.sourceCustomerId || '',
                status,
                reasonAr,
                reasonEn,
                existingStudentRef: matchedDbStudent,
                shouldImport: true // selected by default
              };
            }
          }
        }

        if (!is50PercentPaid && (status === 'new')) {
          reasonAr = 'طالب غير مستكمل المبلغ (سيتم استيراده بحالة موقوف)';
          reasonEn = 'Incomplete payment student (will be imported as deactivated)';
        }

        return {
          id: `bulk_${idx}`,
          fullName,
          phone: normalizedPhone || phoneStr,
          normalizedPhone,
          whatsapp: normalizedWhatsapp || normalizedPhone || phoneStr,
          email,
          githubProfile: s.githubProfile || '',
          linkedinProfile: s.linkedinProfile || '',
          paymentStatus: s.paymentStatus || (is50PercentPaid ? 'paid' : 'pending'),
          is50PercentPaid,
          salesName: s.salesName || '',
          notes: s.notes || '',
          sourceBookingId: s.sourceBookingId || '',
          sourceCustomerId: s.sourceCustomerId || '',
          status,
          reasonAr,
          reasonEn,
          shouldImport: status === 'new'
        };
      });

      setStudentsPreview(listPreviews);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse standard export JSON file.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      readFile(file);
    } else {
      setErrorMsg(lang === 'ar' ? 'يرجى تحميل ملف JSON فقط.' : 'Please upload a JSON file only.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setErrorMsg(null);
        handleJsonData(json);
      } catch (err) {
        setErrorMsg(lang === 'ar' ? 'فشل قراءة الملف كـ JSON صالح.' : 'Failed to parse file. Invalid JSON format.');
      }
    };
    reader.readAsText(file);
  };

  const toggleSelectStudent = (id: string) => {
    setStudentsPreview(prev => prev.map(item => {
      if (item.id === id) {
        if (item.status === 'already_in_group' || item.status === 'invalid' || item.status === 'duplicate_in_file') {
          return item; // Keep disabled
        }
        return { ...item, shouldImport: !item.shouldImport };
      }
      return item;
    }));
  };

  const toggleSelectAll = () => {
    const validAndNotGroupCount = studentsPreview.filter(s => s.status === 'new' || s.status === 'existing_in_db');
    const allSelected = validAndNotGroupCount.every(s => s.shouldImport);
    
    setStudentsPreview(prev => prev.map(item => {
      if (item.status === 'new' || item.status === 'existing_in_db') {
        return { ...item, shouldImport: !allSelected };
      }
      return item;
    }));
  };

  const handleConfirmImport = async () => {
    const targets = studentsPreview.filter(s => s.shouldImport);
    if (targets.length === 0) {
      alert(lang === 'ar' ? 'يرجى تحديد طالب واحد على الأقل للاستيراد.' : 'Please select at least one student to import.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const stats = await runTransaction(db, async (transaction) => {
        // Fetch current credentials in DB to prevent ID collision
        const dbStudentsSnap = await getDocs(collection(db, 'students'));
        const reservedIdNums = new Set<string>();
        dbStudentsSnap.docs.forEach(d => {
          const data = d.data();
          if (data.studentIdNum) reservedIdNums.add(data.studentIdNum);
        });

        const localIdGenSet = new Set<string>(reservedIdNums);
        let createdCount = 0;
        let linkedCount = 0;

        const welcomeQueue: { id: string; name: string; email: string; studentIdNum: string; studentPassword: string }[] = [];

        for (const stud of targets) {
          let studentIdNum = "";
          let studentPassword = "";
          let studentDocId = "";

          if (stud.status === 'existing_in_db' && stud.existingStudentRef) {
            studentIdNum = stud.existingStudentRef.studentIdNum || "";
            studentPassword = stud.existingStudentRef.studentPassword || "";
            studentDocId = stud.existingStudentRef.id;
            linkedCount++;
          } else {
            // Generate non-colliding
            do {
              studentIdNum = Math.floor(100000 + Math.random() * 900000).toString();
            } while (localIdGenSet.has(studentIdNum));
            localIdGenSet.add(studentIdNum);

            const chars = '0123456789';
            for (let i = 0; i < 5; i++) {
              studentPassword += chars[Math.floor(Math.random() * chars.length)];
            }
            createdCount++;
          }

          // 1. Write student document
          const newStudentRef = doc(collection(db, 'students'));
          studentDocId = newStudentRef.id;
          const is50Paid = stud.is50PercentPaid !== false;
          const studentPayload: any = {
            id: newStudentRef.id,
            name: stud.fullName,
            phone: stud.phone,
            whatsapp: stud.whatsapp,
            email: stud.email || "",
            githubProfile: stud.githubProfile || "",
            linkedinProfile: stud.linkedinProfile || "",
            notes: stud.notes || "",
            groupId: groupId,
            studentIdNum,
            studentPassword,
            sourceBookingId: stud.sourceBookingId,
            sourceCustomerId: stud.sourceCustomerId,
            is50PercentPaid: is50Paid,
            deactivated: !is50Paid,
            deactivatedAt: !is50Paid ? new Date().toISOString() : null,
            deactivatedByName: !is50Paid ? (user.name || 'النظام') : null,
            deactivationReasonCategory: !is50Paid ? 'unpaid_50_percent' : null,
            deactivationReason: !is50Paid ? 'موقوف لعدم استكمال المبلغ (لم يتم استكمال المبلغ)' : null,
            deactivationHistory: !is50Paid ? [{
              type: 'deactivate',
              reasonCategory: 'unpaid_50_percent',
              reason: 'موقوف لعدم استكمال المبلغ (لم يتم استكمال المبلغ)',
              timestamp: new Date().toISOString(),
              performedByUid: user.uid,
              performedByName: user.name
            }] : [],
            createdAt: serverTimestamp()
          };
          transaction.set(newStudentRef, studentPayload);

          if (stud.email) {
            welcomeQueue.push({
              id: newStudentRef.id,
              name: stud.fullName,
              email: stud.email,
              studentIdNum,
              studentPassword
            });
          }

          // 2. Write enrollment document
          const enrollRef = doc(collection(db, 'enrollments'));
          transaction.set(enrollRef, {
            id: `${groupId}_${newStudentRef.id}`,
            groupId: groupId,
            studentId: newStudentRef.id,
            sourceBookingId: stud.sourceBookingId,
            sourceCustomerId: stud.sourceCustomerId,
            paymentStatus: stud.paymentStatus || 'pending',
            salesName: stud.salesName || '',
            points: 0,
            attendanceStatus: 'active',
            taskStatus: 'active',
            notes: stud.notes || '',
            joinedAt: new Date().toISOString(),
            createdAt: serverTimestamp()
          });
        }

        // Log Activity
        const activityLogRef = doc(collection(db, 'activityLogs'));
        transaction.set(activityLogRef, {
          action: 'STUDENTS_BULK_IMPORT',
          entityType: 'group',
          entityId: groupId,
          entityName: groupName,
          performedByUid: user.uid,
          performedByName: user.name,
          performedByRole: user.role,
          details: { 
            count: targets.length,
            created: createdCount,
            linked: linkedCount
          },
          timestamp: serverTimestamp()
        });

        return {
          totalProcessed: targets.length,
          createdCount,
          linkedCount,
          skippedCount: studentsPreview.length - targets.length,
          welcomeQueue
        };
      });

      setResultStats(stats);
      setStep(3);
      onSuccess();

      // Trigger welcome email asynchronously for imported targets with exact credentials
      if (stats.welcomeQueue && stats.welcomeQueue.length > 0) {
        stats.welcomeQueue.forEach(item => {
          if (item.email && groupId) {
            triggerStudentWelcomeEmail({
              id: item.id,
              name: item.name,
              email: item.email,
              groupId: groupId,
              studentIdNum: item.studentIdNum,
              studentPassword: item.studentPassword
            }).catch(e => console.warn("Failed sending welcome email for imported student:", e));
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to commit Firestore transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const validAndNotGroup = studentsPreview.filter(s => s.status === 'new' || s.status === 'existing_in_db');
  const allChecked = validAndNotGroup.length > 0 && validAndNotGroup.every(s => s.shouldImport);
  const partChecked = validAndNotGroup.some(s => s.shouldImport) && !allChecked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 rounded-3xl w-full max-w-4xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Banner Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {lang === 'ar' ? 'استيراد طلاب دفعة واحدة' : 'Bulk Import Students'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                {lang === 'ar' ? `المجموعة المستهدفة: ${groupName}` : `Target Group: ${groupName}`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs font-bold">{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-xs font-bold text-slate-400 leading-relaxed max-w-2xl bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-extrabold block mb-1">
                    {lang === 'ar' ? 'استيراد من نظام الحسابات' : 'Integration from Billing System'}
                  </span>
                  {lang === 'ar' 
                    ? 'يرجى تحميل ملف JSON المصدَّر الخاص بالمجموعة المحدثة. سيقوم النظام بمراجعة بيانات الطلاب، وتحديد من هو موجود بالفعل في هذا الجروب وتجاوزه، وإعداد الطلاب الجدد لاستقبال بيانات الدخول تلقائياً.' 
                    : 'Upload the exported workspace JSON file. The system checks trainee phone/email to identify those who are already in the group to skip them, and prepare new students with auto-generated credentials.'
                  }
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-500/5 shadow-xl scale-[0.99]' 
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept=".json" 
                  className="hidden" 
                />
                
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>

                <div>
                  <p className="text-sm font-black text-slate-200">
                    {lang === 'ar' ? 'اسحب وأفلت ملف الـ JSON هنا' : 'Drag & drop JSON file here'}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
                    {lang === 'ar' ? 'أو اضغط للتصفح من جهازك' : 'or click to browse local files'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Selection */}
          {step === 2 && (
            <div className="space-y-6">
              
              {/* Header Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {lang === 'ar' ? 'الطلاب المكتشفين في الملف' : 'Trainees Discovered in File'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {lang === 'ar' 
                      ? `${studentsPreview.length} طالب بالملف | ${studentsPreview.filter(s => s.shouldImport).length} جاهز للاستيراد` 
                      : `${studentsPreview.length} trainees in file | ${studentsPreview.filter(s => s.shouldImport).length} to import`
                    }
                  </p>
                </div>

                {validAndNotGroup.length > 0 && (
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 transition-all text-[11px] font-black text-slate-300"
                  >
                    {allChecked ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                        <span>{lang === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All'}</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 text-slate-500" />
                        <span>{lang === 'ar' ? 'تحديد الكل المتاح' : 'Select All Available'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Trainees List */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
                {studentsPreview.length === 0 ? (
                  <p className="p-8 text-center text-xs font-bold text-slate-500">
                    {lang === 'ar' ? 'لا يوجد طلاب في هذا الملف.' : 'No trainees found in this file.'}
                  </p>
                ) : (
                  studentsPreview.map((s) => {
                    const isEditing = editingStudentId === s.id;
                    const isDisabled = !isEditing && (s.status === 'already_in_group' || s.status === 'invalid' || s.status === 'duplicate_in_file');
                    
                    if (isEditing) {
                      return (
                        <div key={s.id} className="p-4 bg-slate-900/90 border-2 border-blue-500/50 rounded-xl my-1 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                            <span>✏️ {lang === 'ar' ? 'تعديل وتصحيح بيانات الطالب' : 'Edit & Fix Trainee Data'}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {lang === 'ar' ? 'يمكنك تصحيح رقم الهاتف أو الاسم ليتم قبوله بالسيستم' : 'Fix phone or name to enable import'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">
                                {lang === 'ar' ? 'الاسم الكامل:' : 'Full Name:'}
                              </label>
                              <input 
                                type="text"
                                value={editingStudentData.fullName || ""}
                                onChange={(e) => setEditingStudentData(prev => ({ ...prev, fullName: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                                placeholder="الاسم الكامل"
                                dir="auto"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">
                                {lang === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}
                              </label>
                              <input 
                                type="text"
                                value={editingStudentData.phone || ""}
                                onChange={(e) => setEditingStudentData(prev => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                placeholder="01012345678"
                                dir="ltr"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">
                                {lang === 'ar' ? 'رقم الواتساب:' : 'WhatsApp:'}
                              </label>
                              <input 
                                type="text"
                                value={editingStudentData.whatsapp || ""}
                                onChange={(e) => setEditingStudentData(prev => ({ ...prev, whatsapp: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                placeholder="01012345678"
                                dir="ltr"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">
                                {lang === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}
                              </label>
                              <input 
                                type="email"
                                value={editingStudentData.email || ""}
                                onChange={(e) => setEditingStudentData(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                placeholder="example@gmail.com"
                                dir="ltr"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button 
                              type="button"
                              onClick={(e) => cancelEditingStudent(e)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                            >
                              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => saveStudentChanges(s.id, e)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-1 shadow-lg shadow-emerald-900/30"
                            >
                              ✓ {lang === 'ar' ? 'حفظ وتصحيح البيانات' : 'Save & Fix'}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={s.id} 
                        onClick={() => !isDisabled && toggleSelectStudent(s.id)}
                        className={`p-4 flex items-center justify-between gap-4 transition-all ${
                          isDisabled 
                            ? 'bg-slate-950/30 opacity-80' 
                            : 'hover:bg-slate-850 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checked Icon */}
                          <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                            isDisabled 
                              ? 'bg-slate-900 border border-slate-800 text-slate-600'
                              : s.shouldImport 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-950 border border-slate-800'
                          }`}>
                            {s.shouldImport && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          <div>
                            <div className="font-bold text-xs text-slate-200">{s.fullName}</div>
                            <div className="flex flex-wrap items-center gap-x-3 mt-1 text-[10px] text-slate-400 font-mono">
                              <span>📞 {s.phone || (lang === 'ar' ? 'مفقود' : 'Missing')}</span>
                              {s.email && <span>📧 {s.email}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Status Label & Edit Option */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {!s.is50PercentPaid && s.status !== 'already_in_group' && s.status !== 'invalid' && s.status !== 'duplicate_in_file' && (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20">
                              {lang === 'ar' ? '⏳ غير مستكمل (موقوف)' : '⏳ Incomplete (Deactivated)'}
                            </span>
                          )}
                          {s.status === 'already_in_group' && (
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-slate-400 bg-slate-950 border border-slate-850">
                              {lang === 'ar' ? 'موجود بالجروب بالفعل ⚠️' : 'Already in group ⚠️'}
                            </span>
                          )}
                          {s.status === 'invalid' && (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-red-500 bg-red-500/10 border border-red-500/20">
                              {lang === 'ar' ? s.reasonAr : s.reasonEn}
                            </span>
                          )}
                          {s.status === 'duplicate_in_file' && (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20">
                              {lang === 'ar' ? s.reasonAr : s.reasonEn}
                            </span>
                          )}
                          {s.status === 'existing_in_db' && (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-yellow-500 bg-yellow-500/10 border border-yellow-500/20">
                              {lang === 'ar' ? 'مسجل بالنظام (سيتم ربطه)' : 'DB Profile (Will Link)'}
                            </span>
                          )}
                          {s.status === 'new' && (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                              {lang === 'ar' ? 'طالب جديد ✨' : 'New ✨'}
                            </span>
                          )}

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={(e) => startEditingStudent(s, e)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                              s.status === 'invalid' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                            title={lang === 'ar' ? 'تعديل وتصحيح رقم الهاتف أو الاسم' : 'Edit and fix phone or name'}
                          >
                            ✏️ {s.status === 'invalid' ? (lang === 'ar' ? 'تصحيح رقم الهاتف' : 'Fix Phone') : (lang === 'ar' ? 'تعديل' : 'Edit')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Actions Step 2 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep(1)} 
                  disabled={isSubmitting}
                  className="px-6 py-3 border border-slate-800 bg-slate-950 rounded-2xl text-xs font-black text-slate-400 hover:text-white transition-all hover:bg-slate-900"
                >
                  {lang === 'ar' ? 'رجوع' : 'Back'}
                </button>

                <button 
                  onClick={handleConfirmImport}
                  disabled={isSubmitting || studentsPreview.filter(s => s.shouldImport).length === 0}
                  className={`px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all ${
                    isSubmitting 
                      ? 'bg-blue-600/50 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5'
                  }`}
                >
                  {isSubmitting 
                    ? (lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...') 
                    : (lang === 'ar' ? `تأكيد استيراد (${studentsPreview.filter(s => s.shouldImport).length}) طالب` : `Confirm Import (${studentsPreview.filter(s => s.shouldImport).length})` )
                  }
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Completed Successfully */}
          {step === 3 && resultStats && (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-lg font-black text-white">
                  {lang === 'ar' ? 'تم اكتمال الاستيراد بنجاح! 🎉' : 'Import Completed Successfully! 🎉'}
                </h4>
                <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  {lang === 'ar' 
                    ? 'لقد تم إضافة وتحديث الطلاب وربطهم بالمجموعة الحالية، وتوليد حسابات الدخول الخاصة بهم تلقائياً للتواصل والتسليمات.' 
                    : 'Trainees have been successfully enrolled, linked, and active credentials generated for student portal accesses.'
                  }
                </p>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto p-4 bg-slate-950/40 border border-slate-800 rounded-3xl mt-4">
                <div className="p-3 text-center">
                  <div className="text-xl font-black text-white">{resultStats.totalProcessed}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    {lang === 'ar' ? 'إجمالي المستورد' : 'Total Imported'}
                  </div>
                </div>

                <div className="p-3 text-center border-l sm:border-l-0 border-slate-800 sm:border-r">
                  <div className="text-xl font-black text-emerald-500">+{resultStats.createdCount}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    {lang === 'ar' ? 'طالب جديد' : 'New Trainees'}
                  </div>
                </div>

                <div className="p-3 text-center border-t md:border-t-0 border-slate-800 md:border-r">
                  <div className="text-xl font-black text-yellow-500">+{resultStats.linkedCount}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    {lang === 'ar' ? 'ملفات مرتبطة' : 'Linked Profiles'}
                  </div>
                </div>

                <div className="p-3 text-center border-t md:border-t-0 border-l border-slate-800">
                  <div className="text-xl font-black text-slate-400">{resultStats.skippedCount}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    {lang === 'ar' ? 'تم تجاوزهم' : 'Skipped Count'}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-6">
                <button 
                  onClick={onClose}
                  className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-500 hover:scale-[1.01] transition-all"
                >
                  {lang === 'ar' ? 'إغلاق النافذة' : 'Close Window'}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default BulkStudentsImportModal;
