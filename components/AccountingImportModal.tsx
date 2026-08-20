import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Group, User, Course, Student } from '../types';
import { 
  generateGroupSessions, 
  initializeGroupExecutionPlan, 
  logActivity,
  triggerStudentWelcomeEmail 
} from '../services/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileJson, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Users, 
  Info, 
  X, 
  Plus, 
  Calendar, 
  UserCheck, 
  FileCheck, 
  Link2, 
  Settings, 
  Clock, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';

// Helpers
export function checkIs50PercentPaid(s: any): boolean {
  if (!s) return true;

  const parseBool = (val: any): boolean | undefined => {
    if (val === true || val === 'true' || val === 1 || val === '1' || val === 'TRUE' || val === 'True') return true;
    if (val === false || val === 'false' || val === 0 || val === '0' || val === 'FALSE' || val === 'False') return false;
    return undefined;
  };

  const explicitFlag = 
    parseBool(s.is50PercentPaid) ?? 
    parseBool(s.is_50_percent_paid) ?? 
    parseBool(s.is50percentpaid) ?? 
    parseBool(s.is50Percent) ?? 
    parseBool(s['is50%']) ?? 
    parseBool(s['50%']) ??
    parseBool(s.hasPaid50Percent) ??
    parseBool(s.isCompleted) ??
    parseBool(s.is_completed) ??
    parseBool(s.isPaid) ??
    parseBool(s.is_paid) ??
    parseBool(s.completed50Percent);

  if (explicitFlag !== undefined) {
    return explicitFlag;
  }

  const pStatus = String(s.paymentStatus || s.payment_status || s.paymentState || s.status || '').toLowerCase().trim();
  if (
    pStatus === 'pending' || 
    pStatus === 'unpaid' || 
    pStatus === 'incomplete' || 
    pStatus === 'not_completed' ||
    pStatus.includes('لم يستكمل') || 
    pStatus.includes('غير مستكمل') || 
    pStatus.includes('غير مدفوع') || 
    pStatus.includes('موقوف')
  ) {
    return false;
  }

  if (typeof s.paidAmount === 'number' && typeof s.totalAmount === 'number' && s.totalAmount > 0) {
    return (s.paidAmount / s.totalAmount) >= 0.5;
  }

  return true;
}

export function normalizeEgyptPhone(phone: any): string {
  if (phone === null || phone === undefined) return "";

  let value = String(phone)
    .trim()
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s+/g, "")
    .replace(/[-().]/g, "")
    .replace(/^\+/, "");

  if (!value) return "";

  if (value.startsWith("0020")) {
    value = "0" + value.slice(4);
  } else if (value.startsWith("20") && value.length === 12) {
    value = "0" + value.slice(2);
  } else if (value.startsWith("1") && value.length === 10) {
    value = "0" + value;
  }

  if (/^01[0125][0-9]{8}$/.test(value)) {
    return value;
  }

  return "";
}

export function isValidEgyptPhone(phone: any): boolean {
  const normalized = normalizeEgyptPhone(phone);
  return normalized !== "";
}

export function getNextBatchCode(existingGroups: Group[], startDate: string): { code: string; warning?: string } {
  const year = new Date(startDate).getFullYear();
  if (isNaN(year)) {
    throw new Error("Invalid start date");
  }
  const YY = year.toString().slice(-2);
  
  let maxSeq = 0;
  existingGroups.forEach(g => {
    const code = g.batchCode || g.name;
    if (code && /^\d{4}$/.test(code) && code.startsWith(YY)) {
      const NNStr = code.slice(2);
      const NN = parseInt(NNStr, 10);
      if (!isNaN(NN) && NN > maxSeq) {
        maxSeq = NN;
      }
    }
  });
  
  const nextSeq = maxSeq + 1;
  let warning: string | undefined;
  if (nextSeq > 99) {
    warning = `Warning: Sequence number (${nextSeq}) exceeded 99 for year 20${YY}.`;
  }
  
  const NNStr = nextSeq.toString().padStart(2, '0');
  const code = `${YY}${NNStr}`;
  return { code, warning };
}

interface StudentPreviewItem {
  id: string; // temp unique UI ID
  fullName: string;
  phone: string;
  phoneDisplay: string;
  normalizedPhone: string;
  whatsapp: string;
  email: string;
  githubProfile: string;
  linkedinProfile: string;
  paymentStatus: 'paid' | 'partial' | 'pending';
  bookingDate: string;
  salesName: string;
  notes: string;
  sourceBookingId: string;
  sourceCustomerId: string;
  is50PercentPaid: boolean;
  status: 'new' | 'existing' | 'duplicate_in_file' | 'invalid';
  reason?: string; 
  existingStudentRef?: Student; 
  shouldImport: boolean;
}

interface AccountingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  courses: Course[];
  trainers: User[];
  existingGroups: Group[];
}

const AccountingImportModal: React.FC<AccountingImportModalProps> = ({
  isOpen,
  onClose,
  user,
  courses,
  trainers,
  existingGroups
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper State: 1: Upload, 2: Group, 3: Students, 4: Confirm, 5: Result
  const [step, setStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // RAW imported JSON content holders
  const [importedJson, setImportedJson] = useState<any>(null);
  const [doubleImportWarning, setDoubleImportWarning] = useState<any>(null);

  // Group settings edits
  const [groupSettings, setGroupSettings] = useState({
    batchCode: '',
    groupName: '',
    courseId: '',
    courseName: '',
    courseLevel: '',
    groupType: 'online' as 'online' | 'offline',
    branch: '',
    startDate: '',
    daysOfWeek: [] as string[],
    sessionTime: '19:00',
    sessionDurationMinutes: 120,
    totalSessions: 22,
    evaluationSessionsStr: '1, 4, 7, 10, 13, 16, 19, 22',
    capacity: 30,
    bookedCount: 0,
    telegramLink: '',
    telegramRecordsLink: '',
    whatsappLink: '',
    recordingsBaseUrl: '',
    notes: '',
    assignedTrainerIds: [] as string[],
    assistantTrainerId: '',
    supervisorId: '',
    sourceSystem: '',
    sourceGroupId: ''
  });

  // Students preview edits
  const [studentsPreview, setStudentsPreview] = useState<StudentPreviewItem[]>([]);
  const [dbStudents, setDbStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentData, setEditingStudentData] = useState<Partial<StudentPreviewItem>>({});

  // Loading / Submit Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Double import override state
  const [ignoreDoubleImport, setIgnoreDoubleImport] = useState(false);

  const isAdmin = user.role === 'admin';

  // Load active DB students to check background duplicates on mounted
  useEffect(() => {
    if (isOpen) {
      const fetchStudents = async () => {
        try {
          const qSnap = await getDocs(collection(db, 'students'));
          const list = qSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student);
          setDbStudents(list);
        } catch (err) {
          console.error("Failed to load existing students for duplicate check:", err);
        }
      };
      fetchStudents();
      
      // Reset Modal States
      setStep(1);
      setErrorMsg(null);
      setImportedJson(null);
      setDoubleImportWarning(null);
      setStudentsPreview([]);
      setEditingStudentId(null);
      setImportResult(null);
      setIgnoreDoubleImport(false);
    }
  }, [isOpen]);

  const mapDayToSystemDays = (day: string): string => {
    const mapping: Record<string, string> = {
      "MON": "Mon", "TUE": "Tue", "WED": "Wed", "THU": "Thu", "FRI": "Fri", "SAT": "Sat", "SUN": "Sun",
      "MONDAY": "Mon", "TUESDAY": "Tue", "WEDNESDAY": "Wed", "THURSDAY": "Thu", "FRIDAY": "Fri", "SATURDAY": "Sat", "SUNDAY": "Sun"
    };
    return mapping[day.toUpperCase()] || day;
  };

  const handleJsonUploadData = async (parsed: any) => {
    try {
      if (!parsed.sourceSystem || !parsed.group || !parsed.students || !Array.isArray(parsed.students)) {
        throw new Error("Invalid accounting file structure structure. Must contain 'sourceSystem', 'group' and 'students' array.");
      }

      const grp = parsed.group;
      setImportedJson(parsed);

      // Check double import
      const pastImportedGroup = existingGroups.find(g => 
        g.sourceSystem === parsed.sourceSystem && 
        g.sourceGroupId === grp.sourceGroupId
      );

      if (pastImportedGroup) {
        setDoubleImportWarning(pastImportedGroup);
      } else {
        setDoubleImportWarning(null);
      }

      // Generate next batch code for the year
      const startDate = grp.startDate || new Date().toISOString().split('T')[0];
      const { code: nextBatch } = getNextBatchCode(existingGroups, startDate);

      // Try auto-selecting course
      const courseName = grp.courseName || '';
      const matchedCourse = courses.find(c => c.name.toLowerCase() === courseName.toLowerCase()) || 
                            courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));

      // Try auto-selecting trainer & supervisor
      const importedTrainerName = grp.trainerName || '';
      const matchedTrainer = trainers.find(t => t.name.toLowerCase().includes(importedTrainerName.toLowerCase()));

      const importedSupervisorName = grp.supervisorName || '';
      const matchedSupervisor = trainers.find(t => t.name.toLowerCase().includes(importedSupervisorName.toLowerCase()));

      // Prepopulate group state
      const mappedDays = (grp.daysOfWeek || []).map((d: string) => mapDayToSystemDays(d));
      const evSessions = grp.evaluationSessions || [1, 4, 7, 10, 13, 16, 19, 22];

      setGroupSettings({
        batchCode: nextBatch,
        groupName: `Batch ${nextBatch} ${(grp.courseType || 'online').toUpperCase()}`,
        courseId: matchedCourse?.id || '',
        courseName: matchedCourse?.name || courseName,
        courseLevel: grp.courseLevel || 'Beginners Level',
        groupType: grp.courseType === 'offline' ? 'offline' : 'online',
        branch: grp.branchName || 'Online',
        startDate: startDate,
        daysOfWeek: mappedDays,
        sessionTime: grp.sessionTime || '19:00',
        sessionDurationMinutes: grp.sessionDurationMinutes || 120,
        totalSessions: grp.totalSessions || 22,
        evaluationSessionsStr: evSessions.join(', '),
        capacity: grp.capacity || 30,
        bookedCount: grp.bookedCount || parsed.students.length,
        telegramLink: grp.telegramLink || '',
        telegramRecordsLink: grp.telegramRecordsLink || '',
        whatsappLink: grp.whatsappLink || '',
        recordingsBaseUrl: grp.recordingsBaseUrl || '',
        notes: grp.notes || '',
        assignedTrainerIds: matchedTrainer ? [matchedTrainer.uid] : [],
        supervisorId: matchedSupervisor?.uid || '',
        sourceSystem: parsed.sourceSystem,
        sourceGroupId: grp.sourceGroupId || ''
      });

            // Prepare students rows and check duplicate
      const seenPhonesInFile = new Set<string>();
      const listPreviews: StudentPreviewItem[] = parsed.students.map((s: any, idx: number) => {
        // Map raw fields into standard internal fields with multiple possible key fallbacks
        const rawPhoneRaw =
          s.phone ||
          s.phoneNumber ||
          s.mobile ||
          s.customerPhone ||
          s.whatsapp ||
          s.whatsApp ||
          "";

        let rawPhoneStr = typeof rawPhoneRaw === 'number' ? String(rawPhoneRaw) : String(rawPhoneRaw || '').trim();
        if (/^\d{10}$/.test(rawPhoneStr)) {
          rawPhoneStr = "0" + rawPhoneStr;
        }
        const phoneString = String(rawPhoneStr || "").trim();

        const rawWhatsappRaw =
          s.whatsapp ||
          s.whatsApp ||
          s.whatsappNumber ||
          phoneString;

        let rawWhatsappStr = typeof rawWhatsappRaw === 'number' ? String(rawWhatsappRaw) : String(rawWhatsappRaw || '').trim();
        if (/^\d{10}$/.test(rawWhatsappStr)) {
          rawWhatsappStr = "0" + rawWhatsappStr;
        }
        const whatsappString = String(rawWhatsappStr || "").trim();

        // Normalize
        const normalizedPhone = normalizeEgyptPhone(phoneString) || phoneString;
        const normalizedWhatsapp = normalizeEgyptPhone(whatsappString) || whatsappString || normalizedPhone;
        const rawEmailRaw = s.email || s.customerEmail || s.emailAddress || s.mail || "";
        const email = String(rawEmailRaw).trim();

        let status: StudentPreviewItem['status'] = 'new';
        let reason = '';

        // Validate
        if (!s.fullName || !s.fullName.trim()) {
          status = 'invalid';
          reason = 'missing name';
        } else if (!phoneString && !normalizedPhone) {
          status = 'invalid';
          reason = 'MISSING PHONE';
        } else if (normalizedPhone && seenPhonesInFile.has(normalizedPhone)) {
          status = 'duplicate_in_file';
          reason = 'duplicate phone in file';
        }

        if (status !== 'invalid' && status !== 'duplicate_in_file') {
          if (normalizedPhone) {
            seenPhonesInFile.add(normalizedPhone);
          }

          // lookup DB
          const matchedDbStudent = dbStudents.find(dbS => 
            normalizeEgyptPhone(dbS.phone) === normalizedPhone || 
            dbS.phone === normalizedPhone ||
            (dbS.email && email && dbS.email.toLowerCase() === email.toLowerCase())
          );

          if (matchedDbStudent) {
            status = 'existing';
            reason = 'existing profile (will link)';
          }
        }

        const is50PercentPaid = checkIs50PercentPaid(s);
        if (!is50PercentPaid && status !== 'invalid' && status !== 'duplicate_in_file') {
          reason = status === 'existing' 
            ? 'ربط طالب كـ موقوف لعدم استكمال المبلغ' 
            : 'استيراد طالـب موقوف لعدم استكمال المبلغ';
        }

        return {
          id: `row_${idx}`,
          fullName: s.fullName || '',
          phone: normalizedPhone || phoneString,
          phoneDisplay: phoneString,
          normalizedPhone: normalizedPhone,
          whatsapp: normalizedWhatsapp || normalizedPhone || phoneString,
          email: email,
          githubProfile: s.githubProfile || '',
          linkedinProfile: s.linkedinProfile || '',
          paymentStatus: s.paymentStatus || 'pending',
          bookingDate: s.bookingDate || new Date().toISOString().split('T')[0],
          salesName: s.salesName || '',
          notes: s.notes || '',
          sourceBookingId: s.sourceBookingId || '',
          sourceCustomerId: s.sourceCustomerId || '',
          is50PercentPaid,
          status,
          reason,
          existingStudentRef: dbStudents.find(dbS => normalizeEgyptPhone(dbS.phone) === normalizedPhone || (dbS.email && email && dbS.email.toLowerCase() === email.toLowerCase())),
          shouldImport: status !== 'invalid' && status !== 'duplicate_in_file'
        };
      });

      setStudentsPreview(listPreviews);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process accounting export file.");
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      readFileContent(file);
    } else {
      setErrorMsg("Please upload a valid JSON file export.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileContent(file);
    }
  };

  const readFileContent = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setErrorMsg(null);
        handleJsonUploadData(json);
      } catch (err) {
        setErrorMsg("Failed to parse JSON file content. Make sure it has valid syntax.");
      }
    };
    reader.readAsText(file);
  };

  // Stepper handlers
  const handleGroupStepConfirm = () => {
    if (!groupSettings.batchCode) {
      alert("Batch Code is required.");
      return;
    }
    if (!groupSettings.courseId) {
      alert("Please select a Course template for the group.");
      return;
    }
    if (groupSettings.daysOfWeek.length === 0) {
      alert("Please select at least one day of the week for lectures.");
      return;
    }
    setStep(3);
  };

  const handleStudentsStepConfirm = () => {
    // Lock in confirmation stats preview
    setStep(4);
  };

  // Quick edit student inline
  const startEditingStudent = (s: StudentPreviewItem) => {
    setEditingStudentId(s.id);
    setEditingStudentData({ ...s });
  };

  const saveStudentChanges = (id: string) => {
    setStudentsPreview(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...editingStudentData } as StudentPreviewItem;
        
        // Handle phone value from editing data
        const rawPhoneVal = updated.phoneDisplay !== undefined ? updated.phoneDisplay : updated.phone;
        let rawPhone = typeof rawPhoneVal === 'number' ? String(rawPhoneVal) : String(rawPhoneVal || '').trim();
        if (/^\d{10}$/.test(rawPhone)) {
          rawPhone = "0" + rawPhone;
        }
        const phoneString = String(rawPhone || "").trim();

        // Handle WhatsApp value from editing data
        const rawWhatsappVal = updated.whatsapp;
        let rawWhatsapp = typeof rawWhatsappVal === 'number' ? String(rawWhatsappVal) : String(rawWhatsappVal || '').trim();
        if (/^\d{10}$/.test(rawWhatsapp)) {
          rawWhatsapp = "0" + rawWhatsapp;
        }
        const whatsappString = String(rawWhatsapp || "").trim();

        const normalizedPhone = normalizeEgyptPhone(phoneString);
        const normalizedWhatsapp = normalizeEgyptPhone(whatsappString);
        const email = (updated.email || '').trim();

        let status: StudentPreviewItem['status'] = 'new';
        let reason = '';

        if (!updated.fullName || !updated.fullName.trim()) {
          status = 'invalid';
          reason = 'missing name';
        } else if (!phoneString && !normalizedPhone) {
          status = 'invalid';
          reason = 'MISSING PHONE';
        } else if (phoneString && !normalizedPhone) {
          status = 'invalid';
          reason = 'INVALID PHONE FORMAT';
        } else {
          // lookup DB
          const matchedDbStudent = dbStudents.find(dbS => 
            normalizeEgyptPhone(dbS.phone) === normalizedPhone || 
            (dbS.email && email && dbS.email.toLowerCase() === email.toLowerCase())
          );

          if (matchedDbStudent) {
            status = 'existing';
            reason = 'existing profile (will link)';
            updated.existingStudentRef = matchedDbStudent;
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log("Updated Student Debug:", {
            fullName: updated.fullName,
            rawPhone: rawPhoneVal,
            phoneString,
            normalizedPhone,
            validationError: status === 'invalid' ? reason : null
          });
        }

        return {
          ...updated,
          phone: normalizedPhone || phoneString,
          phoneDisplay: phoneString,
          normalizedPhone: normalizedPhone,
          whatsapp: normalizedWhatsapp || normalizedPhone || phoneString,
          status,
          reason,
          shouldImport: status !== 'invalid'
        };
      }
      return s;
    }));
    setEditingStudentId(null);
  };

  // Run final atomic import process
  const handleFinalizeImport = async () => {
    setIsSubmitting(true);
    try {
      const selectedCourse = courses.find(c => c.id === groupSettings.courseId);
      const selectedSupervisor = trainers.find(t => t.uid === groupSettings.supervisorId);
      const selectedAssistantTrainer = trainers.find(t => t.uid === groupSettings.assistantTrainerId);

      // Parse evaluation sessions
      const parsedEvaluationSessions = groupSettings.evaluationSessionsStr
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));

      // Final lists
      const studentsToImport = studentsPreview.filter(s => s.shouldImport);
      const newLogs: Student[] = [];

      // Run transactional batch write on firestore
      const finalResult = await runTransaction(db, async (trans) => {
        // A. Double check batch code concurrency
        const groupsSnap = await getDocs(collection(db, 'groups'));
        const allGroups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Group);

        // Calculate a safe non-colliding batch code
        const currentYY = new Date(groupSettings.startDate).getFullYear().toString().slice(-2);
        
        let targetCode = groupSettings.batchCode;
        if (!isAdmin) {
          // Force automatic serialization override for non-admins to prevent mistakes
          const { code: safeCode } = getNextBatchCode(allGroups, groupSettings.startDate);
          targetCode = safeCode;
        } else {
          // For admins, verify they didn't collide
          const alreadyExists = allGroups.some(g => (g.batchCode || g.name) === targetCode);
          if (alreadyExists) {
            const { code: safeCode } = getNextBatchCode(allGroups, groupSettings.startDate);
            targetCode = safeCode;
          }
        }

        const finalGroupName = `Batch ${targetCode} ${groupSettings.groupType.toUpperCase()}`;

        // B. Allocate Group Doc
        const newGroupRef = doc(collection(db, 'groups'));
        
        const combinedTrainerIds = Array.from(new Set([
          ...(groupSettings.assignedTrainerIds || []),
          groupSettings.assistantTrainerId
        ].filter(Boolean)));

        const groupPayload = {
          batchCode: targetCode,
          name: targetCode, // backward compatibility
          groupName: finalGroupName,
          courseId: groupSettings.courseId,
          courseName: selectedCourse?.name || groupSettings.courseName,
          courseLevel: groupSettings.courseLevel,
          groupType: groupSettings.groupType,
          branch: groupSettings.branch,
          startDate: groupSettings.startDate,
          daysOfWeek: groupSettings.daysOfWeek,
          sessionTime: groupSettings.sessionTime,
          sessionDurationMinutes: Number(groupSettings.sessionDurationMinutes),
          totalSessions: Number(groupSettings.totalSessions),
          feedbackSessions: parsedEvaluationSessions,
          primaryTrainerId: groupSettings.assignedTrainerIds[0] || null,
          assignedTrainerIds: combinedTrainerIds,
          trainerIds: combinedTrainerIds, // backward compatibility
          assistantTrainerId: groupSettings.assistantTrainerId || null,
          assistantTrainerName: selectedAssistantTrainer?.name || null,
          supervisorId: groupSettings.supervisorId || null,
          supervisorName: selectedSupervisor?.name || null,
          telegramLink: groupSettings.telegramLink,
          telegramRecordsLink: groupSettings.telegramRecordsLink || '',
          whatsappLink: groupSettings.whatsappLink,
          recordingsBaseUrl: groupSettings.recordingsBaseUrl,
          sourceSystem: groupSettings.sourceSystem,
          sourceGroupId: groupSettings.sourceGroupId,
          importedAt: new Date().toISOString(),
          createdAt: serverTimestamp()
        };

        // Write Group
        trans.set(newGroupRef, groupPayload);

        // Write Group Activity Log
        const logRef = doc(collection(db, 'activityLogs'));
        trans.set(logRef, {
          action: 'GROUP_IMPORT_CREATE',
          entityType: 'group',
          entityId: newGroupRef.id,
          entityName: finalGroupName,
          performedByUid: user.uid,
          performedByName: user.name,
          performedByRole: user.role,
          details: { 
            courseId: groupSettings.courseId, 
            sourceSystem: groupSettings.sourceSystem, 
            sourceGroupId: groupSettings.sourceGroupId 
          },
          timestamp: serverTimestamp()
        });

        // C. Fetch all current database studentIdNums for unique reservation
        const allDbStudents = await getDocs(collection(db, 'students'));
        const reservedIdNums = new Set<string>();
        allDbStudents.docs.forEach(d => {
          const s = d.data();
          if (s.studentIdNum) reservedIdNums.add(s.studentIdNum);
        });

        const localIdGenSet = new Set<string>(reservedIdNums);

        let createdCount = 0;
        let linkedCount = 0;

        // Generate and Write Students / Enrollments
        for (const stud of studentsToImport) {
          let studentIdNum = "";
          let studentPassword = "";
          let studentDocId = "";

          if (stud.status === 'existing' && stud.existingStudentRef) {
            // Re-use current student attributes for linkage
            studentIdNum = stud.existingStudentRef.studentIdNum || "";
            studentPassword = stud.existingStudentRef.studentPassword || "";
            studentDocId = stud.existingStudentRef.id;
            linkedCount++;
          } else {
            // Generate brand new student credentials
            do {
              studentIdNum = Math.floor(100000 + Math.random() * 900000).toString();
            } while (localIdGenSet.has(studentIdNum));
            localIdGenSet.add(studentIdNum);

            // Generate Password
            const chars = '0123456789';
            for (let i = 0; i < 5; i++) {
              studentPassword += chars[Math.floor(Math.random() * chars.length)];
            }

            const newStudentRef = doc(collection(db, 'students'));
            studentDocId = newStudentRef.id;
            createdCount++;
          }

          // 1. Create enrollment/group copy in 'students' collection for absolute backward compatibility
          const activeStudentRef = doc(collection(db, 'students'));
          const is50Paid = stud.is50PercentPaid !== false;
          const studentProfilePayload: any = {
            id: activeStudentRef.id,
            name: stud.fullName,
            phone: stud.phone,
            whatsapp: stud.whatsapp,
            email: stud.email || "",
            githubProfile: stud.githubProfile || "",
            linkedinProfile: stud.linkedinProfile || "",
            notes: stud.notes || "",
            groupId: newGroupRef.id,
            studentIdNum,
            studentPassword,
            sourceBookingId: stud.sourceBookingId,
            sourceCustomerId: stud.sourceCustomerId,
            is50PercentPaid: is50Paid,
            deactivated: !is50Paid,
            deactivatedAt: !is50Paid ? new Date().toISOString() : null,
            deactivatedByName: !is50Paid ? 'نظام الحسابات (تلقائي)' : null,
            deactivationReasonCategory: !is50Paid ? 'unpaid_50_percent' : null,
            deactivationReason: !is50Paid ? 'موقوف لعدم استكمال 50% من سعر الكورس (مستورد من الحسابات)' : null,
            deactivationHistory: !is50Paid ? [{
              type: 'deactivate',
              reasonCategory: 'unpaid_50_percent',
              reason: 'موقوف لعدم استكمال 50% من سعر الكورس (مستورد من الحسابات)',
              timestamp: new Date().toISOString(),
              performedByUid: user.uid,
              performedByName: user.name
            }] : [],
            createdAt: serverTimestamp()
          };
          trans.set(activeStudentRef, studentProfilePayload);

          // Push to logs table for Step 5
          newLogs.push({
            id: studentDocId,
            name: stud.fullName,
            phone: stud.phone,
            studentIdNum,
            studentPassword,
            groupId: newGroupRef.id,
            createdAt: new Date().toISOString()
          });

          // 2. Create high-fidelity document in 'enrollments' collection
          const enrollRef = doc(collection(db, 'enrollments'));
          trans.set(enrollRef, {
            id: `${newGroupRef.id}_${studentDocId}`,
            groupId: newGroupRef.id,
            studentId: studentDocId,
            sourceBookingId: stud.sourceBookingId,
            sourceCustomerId: stud.sourceCustomerId,
            paymentStatus: stud.paymentStatus,
            salesName: stud.salesName,
            points: 0,
            attendanceStatus: 'active',
            taskStatus: 'active',
            notes: stud.notes,
            joinedAt: new Date().toISOString(),
            createdAt: serverTimestamp()
          });
        }

        return {
          groupId: newGroupRef.id,
          batchCode: targetCode,
          groupName: finalGroupName,
          createdCount,
          linkedCount,
          totalProcessed: studentsToImport.length,
          skippedCount: studentsPreview.length - studentsToImport.length
        };
      });

      // Post-Transaction: Generate group session dates list & group execution goals
      const selectedCourseObj = courses.find(c => c.id === groupSettings.courseId);
      
      const fullGroupObject: Group = {
        id: finalResult.groupId,
        name: finalResult.batchCode,
        batchCode: finalResult.batchCode,
        courseId: groupSettings.courseId,
        courseName: selectedCourseObj?.name || groupSettings.courseName,
        startDate: groupSettings.startDate,
        daysOfWeek: groupSettings.daysOfWeek,
        totalSessions: Number(groupSettings.totalSessions),
        sessionTime: groupSettings.sessionTime,
        primaryTrainerId: groupSettings.assignedTrainerIds[0] || undefined,
        trainerIds: Array.from(new Set([...groupSettings.assignedTrainerIds, groupSettings.assistantTrainerId].filter(Boolean))),
        assistantTrainerId: groupSettings.assistantTrainerId || undefined,
        assistantTrainerName: selectedAssistantTrainer?.name || undefined,
        supervisorId: groupSettings.supervisorId || undefined,
        supervisorName: selectedSupervisor?.name || undefined,
        telegramLink: groupSettings.telegramLink,
        telegramRecordsLink: groupSettings.telegramRecordsLink || '',
        whatsappLink: groupSettings.whatsappLink,
        groupType: groupSettings.groupType,
        feedbackSessions: parsedEvaluationSessions,
        createdAt: new Date().toISOString()
      };

      // Create lectures dates
      await generateGroupSessions(fullGroupObject);

      // Create execution schedule
      await initializeGroupExecutionPlan(
        finalResult.groupId, 
        groupSettings.courseId, 
        groupSettings.assignedTrainerIds[0] || user.uid, 
        user
      );

      // Trigger welcome email asynchronously for imported targets with an email
      newLogs.forEach(log => {
        const stud = studentsToImport.find(s => s.fullName === log.name || s.phone === log.phone);
        const targetEmail = (stud?.email || '').trim();
        if (targetEmail && finalResult.groupId) {
          triggerStudentWelcomeEmail({
            id: log.id,
            name: log.name,
            email: targetEmail,
            groupId: finalResult.groupId,
            studentIdNum: log.studentIdNum,
            studentPassword: log.studentPassword
          }).catch(e => console.warn("Failed sending welcome email for imported student:", e));
        }
      });

      // Save credentials logs to memory for sharing screen
      setImportResult({
        ...finalResult,
        credentialsList: newLogs
      });
      setStep(5);
    } catch (err: any) {
      alert(`Import failed: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAllCredentialsText = () => {
    if (!importResult?.credentialsList) return;
    const block = importResult.credentialsList.map((c: any) => 
      `👤 الاسم: ${c.name}\n📞 الهاتف: ${c.phone}\n🔑 الكود: ${c.studentIdNum}\n🔒 الباسوورد: ${c.studentPassword}\n-------------------------`
    ).join('\n');
    
    navigator.clipboard.writeText(block).then(() => {
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in duration-150">
        
        {/* Header toolbar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              📥 Import from Accounting/Bookings System
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              {step === 1 && "Step 1: Upload Booking JSON File"}
              {step === 2 && "Step 2: Customise Training Group Settings"}
              {step === 3 && "Step 3: Resolve Duplicate Student Credentials"}
              {step === 4 && "Step 4: Finalize & Launch Academic Group"}
              {step === 5 && "Step 5: Saved Student Login Credentials"}
            </p>
          </div>
          <button 
            disabled={isSubmitting}
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl leading-none w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 flex items-center justify-center transition-all"
          >
            &times;
          </button>
        </div>

        {/* Stepper Progress Indicator */}
        {step < 5 && (
          <div className="bg-slate-100/50 dark:bg-slate-950/40 px-8 py-4 border-b border-slate-150 dark:border-slate-800 grid grid-cols-4 gap-4 text-center">
            {[
              { id: 1, name: "Upload JSON" },
              { id: 2, name: "Group Setup" },
              { id: 3, name: "Preview Students" },
              { id: 4, name: "Confirm Launch" }
            ].map(s => (
              <div key={s.id} className="relative">
                <span className={`text-[10px] font-black uppercase tracking-wider block transition-colors ${
                  step === s.id ? 'text-purple-600 dark:text-purple-400' : step > s.id ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  {step > s.id ? "✓ " : ""}{s.id}. {s.name}
                </span>
                <div className={`h-1 rounded-full mt-2 transition-all ${
                  step === s.id ? 'bg-purple-600' : step > s.id ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                }`} />
              </div>
            ))}
          </div>
        )}

        {/* Modal content body */}
        <div className="flex-1 overflow-y-auto p-8 min-h-[300px]">
          
          <AnimatePresence mode="wait">
            
            {/* Step 1: Upload */}
            {step === 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="max-w-xl mx-auto text-center space-y-4">
                  <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                    Select the Accounting JSON Record
                  </h4>
                  <p className="text-sm font-medium text-slate-500">
                    Drop the exported file containing the reserved student list and booking metadata. The system will parse information, set up a scheduling batch code, and check duplicate accounts.
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 p-4 rounded-2xl border border-rose-200/50 flex gap-3 items-start text-xs font-bold max-w-xl mx-auto leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-black uppercase tracking-wider">Failed Parsing JSON</p>
                      <p className="mt-1 normal-case">{errorMsg}</p>
                    </div>
                  </div>
                )}

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`max-w-xl mx-auto py-16 px-8 rounded-4xl border-3 border-dashed text-center cursor-pointer transition-all duration-300 ${
                    isDragging 
                      ? 'border-purple-500 bg-purple-500/[0.04] dark:bg-purple-950/20' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-900 bg-slate-50/50 dark:bg-slate-950/30'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-black text-slate-700 dark:text-white">
                    Drag and drop your exported JSON file here
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">
                    Or click to browse storage (.json)
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Customise Group Settings */}
            {step === 2 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {doubleImportWarning && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 text-amber-800 dark:text-amber-400 p-6 rounded-3xl flex gap-4 items-start shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <p className="font-black text-sm uppercase tracking-wider">⚠️ Duplicate Account Group Detected</p>
                      <p className="text-xs font-bold leading-relaxed">
                        This accounting course group was previously imported on <span className="underline">{doubleImportWarning.importedAt ? new Date(doubleImportWarning.importedAt).toLocaleDateString() : ""}</span> under Training Batch: <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono text-[10px] uppercase font-black">Batch {doubleImportWarning.name || doubleImportWarning.batchCode}</span>.
                      </p>
                      <p className="text-xs font-medium opacity-80 pt-2 leading-relaxed">
                        If you want to re-import, click "Ignore Warning & Import Again" below to enable, otherwise press cancel to discard.
                      </p>
                      <div className="pt-3">
                        <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-amber-300 w-fit">
                          <input 
                            type="checkbox"
                            checked={ignoreDoubleImport}
                            onChange={(e) => setIgnoreDoubleImport(e.target.checked)}
                            className="accent-amber-500 w-4 h-4"
                          />
                          <span className="text-[10px] font-black uppercase text-amber-800">Ignore Warning & Import Again</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {(!doubleImportWarning || ignoreDoubleImport) && (
                  <div className="space-y-8">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        Group Meta Map Parameters
                      </h4>
                      <p className="text-xs text-slate-400 font-bold mt-1">Review parameters fetched from your booking system. Make adjustments as necessary.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left: General Configs */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Batch Code Code (YYNN)</label>
                          <input 
                            type="text"
                            required
                            disabled={!isAdmin}
                            value={groupSettings.batchCode}
                            onChange={(e) => {
                              const code = e.target.value.trim();
                              setGroupSettings(prev => ({ 
                                ...prev, 
                                batchCode: code,
                                groupName: `Batch ${code} ${prev.groupType.toUpperCase()}`
                              }));
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g. 2601"
                          />
                          {!isAdmin && (
                            <p className="text-[9px] text-slate-400 italic mt-1">Batch code automatically calculated. Only Admins can manually override code serialization.</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Auto Generated Group Name</label>
                          <input 
                            type="text"
                            disabled
                            value={groupSettings.groupName}
                            className="w-full bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Map to Academic Course</label>
                          <select
                            required
                            value={groupSettings.courseId}
                            onChange={(e) => {
                              const c = courses.find(item => item.id === e.target.value);
                              setGroupSettings(prev => ({ ...prev, courseId: e.target.value, courseName: c?.name || '' }));
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">-- Choose Course template --</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {!groupSettings.courseId && (
                            <p className="text-[9px] text-rose-500 font-bold mt-1">⚠️ Warning: No exact matches found for imported course '{groupSettings.courseName}'. Please choose a template manually.</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Course Level</label>
                          <input 
                            type="text"
                            value={groupSettings.courseLevel}
                            onChange={(e) => setGroupSettings(prev => ({ ...prev, courseLevel: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      {/* Middle: Schedulers */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                            <input 
                              type="date"
                              required
                              value={groupSettings.startDate}
                              onChange={(e) => {
                                const date = e.target.value;
                                const { code: nextCode } = getNextBatchCode(existingGroups, date);
                                setGroupSettings(prev => ({ 
                                  ...prev, 
                                  startDate: date,
                                  batchCode: nextCode,
                                  groupName: `Batch ${nextCode} ${prev.groupType.toUpperCase()}`
                                }));
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Session Time</label>
                            <input 
                              type="time"
                              required
                              value={groupSettings.sessionTime}
                              onChange={(e) => setGroupSettings(prev => ({ ...prev, sessionTime: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Weekly Days list</label>
                          <div className="grid grid-cols-4 gap-2">
                            {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map(day => {
                              const selected = groupSettings.daysOfWeek.includes(day);
                              return (
                                <button
                                  type="button"
                                  key={day}
                                  onClick={() => {
                                    setGroupSettings(prev => ({
                                      ...prev,
                                      daysOfWeek: selected 
                                        ? prev.daysOfWeek.filter(d => d !== day) 
                                        : [...prev.daysOfWeek, day]
                                    }));
                                  }}
                                  className={`py-2 px-1 text-xs rounded-lg font-black border text-center transition-all ${
                                    selected 
                                      ? 'bg-purple-600 border-purple-600 text-white shadow shadow-purple-600/10' 
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Total Lectures/Sessions</label>
                            <input 
                              type="number"
                              min="1" max="100"
                              value={groupSettings.totalSessions}
                              onChange={(e) => setGroupSettings(prev => ({ ...prev, totalSessions: parseInt(e.target.value) || 22 }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Duration (Minutes)</label>
                            <input 
                              type="number"
                              min="1" max="600"
                              value={groupSettings.sessionDurationMinutes}
                              onChange={(e) => setGroupSettings(prev => ({ ...prev, sessionDurationMinutes: parseInt(e.target.value) || 120 }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Feedback/Evaluation Lectures list</label>
                          <input 
                            type="text"
                            value={groupSettings.evaluationSessionsStr}
                            onChange={(e) => setGroupSettings(prev => ({ ...prev, evaluationSessionsStr: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none"
                            placeholder="Comma-separated lecture numbers"
                          />
                        </div>
                      </div>

                      {/* Right: Assigned trainers & staff */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Assign Active Trainer</label>
                          <select
                            required
                            value={groupSettings.assignedTrainerIds[0] || ""}
                            onChange={(e) => {
                              const id = e.target.value;
                              setGroupSettings(prev => ({
                                ...prev,
                                assignedTrainerIds: id ? [id] : []
                              }));
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">-- Choose primary trainer --</option>
                            {trainers.map(t => (
                              <option key={t.uid} value={t.uid}>{t.name} ({t.role})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Assistant Trainer / Co-Trainer</span>
                            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-black">Optional (اختياري)</span>
                          </label>
                          <select
                            value={groupSettings.assistantTrainerId}
                            onChange={(e) => setGroupSettings(prev => ({ ...prev, assistantTrainerId: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- No assistant trainer (لا يوجد مدرب مساعد) --</option>
                            {trainers.filter(t => t.uid !== groupSettings.assignedTrainerIds[0]).map(t => (
                              <option key={t.uid} value={t.uid}>{t.name} ({t.role})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Group Supervisor</label>
                          <select
                            value={groupSettings.supervisorId}
                            onChange={(e) => setGroupSettings(prev => ({ ...prev, supervisorId: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none"
                          >
                            <option value="">-- Select supervisor --</option>
                            {trainers.filter(u => ['admin', 'coordinator', 'team_leader'].includes(u.role)).map(t => (
                              <option key={t.uid} value={t.uid}>{t.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Branch Location</label>
                            <input 
                              type="text"
                              value={groupSettings.branch}
                              onChange={(e) => setGroupSettings(prev => ({ ...prev, branch: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Lecture Medium</label>
                            <select
                              value={groupSettings.groupType}
                              onChange={(e) => {
                                const type = e.target.value as 'online' | 'offline';
                                setGroupSettings(prev => ({ 
                                  ...prev, 
                                  groupType: type,
                                  groupName: `Batch ${prev.batchCode} ${type.toUpperCase()}`
                                }));
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white"
                            >
                              <option value="online">Online</option>
                              <option value="offline">Offline / In-Center</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Group Capacity limit / Booked</label>
                          <div className="grid grid-cols-2 gap-3">
                            <input 
                              type="number"
                              value={groupSettings.capacity}
                              onChange={(e) => setGroupSettings(prev => ({ ...prev, capacity: parseInt(e.target.value) || 30 }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white"
                              placeholder="Capacity limit"
                            />
                            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 text-center font-black text-[12px] text-purple-600 dark:text-purple-400 flex items-center justify-center">
                              📝 {groupSettings.bookedCount} Booked in JSON
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Socials & Recordings configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-6 rounded-3xl border border-slate-150 dark:border-slate-800">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Classroom Group Link</label>
                        <input 
                          type="url"
                          value={groupSettings.whatsappLink}
                          onChange={(e) => setGroupSettings(prev => ({ ...prev, whatsappLink: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white"
                          placeholder="https://chat.whatsapp.com/..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Telegram Interactive Link</label>
                        <input 
                          type="url"
                          value={groupSettings.telegramLink}
                          onChange={(e) => setGroupSettings(prev => ({ ...prev, telegramLink: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white"
                          placeholder="https://t.me/..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Telegram Records Link</label>
                        <input 
                          type="url"
                          value={groupSettings.telegramRecordsLink || ''}
                          onChange={(e) => setGroupSettings(prev => ({ ...prev, telegramRecordsLink: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white"
                          placeholder="https://t.me/..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Recordings Folder/Channel Path</label>
                        <input 
                          type="url"
                          value={groupSettings.recordingsBaseUrl}
                          onChange={(e) => setGroupSettings(prev => ({ ...prev, recordingsBaseUrl: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white"
                          placeholder="Recordings Base URL"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Students Setup and Preview List */}
            {step === 3 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      Enrollment Candidates Review List
                    </h4>
                    <p className="text-xs text-slate-400 font-bold">Inspect student accounts. Existing students will keep their profile and be safely registered in this group with their existing login details.</p>
                  </div>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white max-w-xs w-full outline-none"
                    placeholder="Filter by name, phone..."
                  />
                </div>

                <div className="border border-slate-150 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-950/20 shadow-inner">
                  <div className="overflow-x-auto max-h-[420px] no-scrollbar">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="p-4 text-center select-none w-12 col-span-1">
                            <input 
                              type="checkbox"
                              checked={studentsPreview.length > 0 && studentsPreview.every(s => s.status === 'invalid' ? true : s.shouldImport)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setStudentsPreview(prev => prev.map(s => s.status === 'invalid' ? s : { ...s, shouldImport: checked }));
                              }}
                              className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                            />
                          </th>
                          <th className="p-4 w-32">Status</th>
                          <th className="p-4 w-44">Name</th>
                          <th className="p-4 w-32">Phone Display</th>
                          <th className="p-4 w-32">Normalized Phone</th>
                          <th className="p-4 w-32">WhatsApp</th>
                          <th className="p-4 w-44">Email</th>
                          <th className="p-4 w-28">Payment Status</th>
                          <th className="p-4 w-32">Sales Name</th>
                          <th className="p-4">Error Reason</th>
                          <th className="p-4 text-center w-36">Edit Inline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-semibold text-slate-700 dark:text-slate-300">
                        {studentsPreview
                          .filter(s => s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                       s.phone.includes(searchQuery) || 
                                       (s.phoneDisplay && s.phoneDisplay.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                       (s.normalizedPhone && s.normalizedPhone.includes(searchQuery))
                          )
                          .map((stud) => {
                            const isEditing = editingStudentId === stud.id;
                            return (
                              <tr key={stud.id} className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors ${
                                !stud.shouldImport ? 'opacity-50 line-through bg-slate-50/20 dark:bg-slate-900/5' : ''
                              }`}>
                                <td className="p-4 text-center">
                                  <input 
                                    type="checkbox"
                                    disabled={stud.status === 'invalid'}
                                    checked={stud.shouldImport}
                                    onChange={(e) => {
                                      setStudentsPreview(prev => prev.map(s => s.id === stud.id ? { ...s, shouldImport: e.target.checked } : s));
                                    }}
                                    className="w-4 h-4 rounded accent-purple-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  />
                                </td>
                                <td className="p-4">
                                  {stud.status === 'new' && (
                                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                                      ✨ New Account
                                    </span>
                                  )}
                                  {stud.status === 'existing' && (
                                    <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-200">
                                      🔗 Link User
                                    </span>
                                  )}
                                  {stud.status === 'duplicate_in_file' && (
                                    <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-purple-200" title={stud.reason}>
                                      ⚠️ File Duplicate
                                    </span>
                                  )}
                                  {stud.status === 'invalid' && (
                                    <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-200" title={stud.reason}>
                                      ❌ Invalid Row
                                    </span>
                                  )}
                                </td>
                                <td className="p-4" dir="auto">
                                  {isEditing ? (
                                    <input 
                                      type="text"
                                      value={editingStudentData.fullName || ""}
                                      onChange={(e) => setEditingStudentData(prev => ({ ...prev, fullName: e.target.value }))}
                                      className="px-2 py-1 rounded border border-slate-300 dark:bg-slate-900 w-full font-bold"
                                      dir="auto"
                                    />
                                  ) : (
                                    <span className="font-bold text-slate-900 dark:text-white leading-tight block">{stud.fullName}</span>
                                  )}
                                </td>
                                <td className="p-4" dir="ltr">
                                  {isEditing ? (
                                    <input 
                                      type="text"
                                      value={editingStudentData.phoneDisplay ?? editingStudentData.phone ?? ""}
                                      onChange={(e) => setEditingStudentData(prev => ({ ...prev, phoneDisplay: e.target.value }))}
                                      className="px-2 py-1 rounded border border-slate-300 dark:bg-slate-900 font-mono w-full"
                                      dir="ltr"
                                    />
                                  ) : (
                                    <span className="font-mono">{stud.phoneDisplay}</span>
                                  )}
                                </td>
                                <td className="p-4 font-mono" dir="ltr">
                                  {stud.normalizedPhone || "-"}
                                </td>
                                <td className="p-4" dir="ltr">
                                  {isEditing ? (
                                    <input 
                                      type="text"
                                      value={editingStudentData.whatsapp || ""}
                                      onChange={(e) => setEditingStudentData(prev => ({ ...prev, whatsapp: e.target.value }))}
                                      className="px-2 py-1 rounded border border-slate-300 dark:bg-slate-900 font-mono w-full"
                                      dir="ltr"
                                    />
                                  ) : (
                                    <span className="font-mono">{stud.whatsapp || "-"}</span>
                                  )}
                                </td>
                                <td className="p-4" dir="ltr">
                                  {isEditing ? (
                                    <input 
                                      type="email"
                                      value={editingStudentData.email || ""}
                                      onChange={(e) => setEditingStudentData(prev => ({ ...prev, email: e.target.value }))}
                                      className="px-2 py-1 rounded border border-slate-300 dark:bg-slate-900 font-mono w-full text-xs"
                                      dir="ltr"
                                    />
                                  ) : (
                                    <span className="font-mono text-xs">{stud.email || "-"}</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded font-black w-fit border ${
                                    stud.paymentStatus === 'paid' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                      : stud.paymentStatus === 'partial' 
                                        ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                  }`}>
                                    {stud.paymentStatus}
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                                  {stud.salesName || "Self-Booking"}
                                </td>
                                <td className="p-4 text-xs font-semibold text-rose-500 uppercase tracking-wide" dir="auto">
                                  {stud.reason || "-"}
                                </td>
                                <td className="p-4 text-center">
                                  {isEditing ? (
                                    <div className="flex gap-1.5 justify-center">
                                      <button 
                                        onClick={() => saveStudentChanges(stud.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-black uppercase"
                                      >
                                        Save
                                      </button>
                                      <button 
                                        onClick={() => setEditingStudentId(null)}
                                        className="bg-slate-500 hover:bg-slate-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => startEditingStudent(stud)}
                                      className="text-slate-400 hover:text-purple-600 p-2 text-xs font-bold transition-all"
                                      title="Edit Student Profile details"
                                    >
                                      ✏️ Edit inline
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirm review indicators */}
            {step === 4 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Confirm Import Launch</h4>
                  <p className="text-sm font-medium text-slate-500">You are about to run a live database transaction which creates the group and allocates student records inside the database.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/40 p-6 rounded-3xl border border-slate-150 dark:border-slate-800 grid grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Training Batch</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase">Batch {groupSettings.batchCode} {groupSettings.groupType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Academy Course</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{groupSettings.courseName} ({groupSettings.courseLevel})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Lecture Schedule</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">📅 Every {groupSettings.daysOfWeek.join(', ')} starting {groupSettings.startDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Time & Duration</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">⏰ {groupSettings.sessionTime} • {groupSettings.totalSessions} Lectures ({groupSettings.sessionDurationMinutes} Mins)</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-emerald-500/[0.04] p-4 rounded-2xl border border-emerald-500/10">
                    <span className="block text-xl font-black text-emerald-600">{studentsPreview.filter(s => s.shouldImport).length}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">To Import</span>
                  </div>
                  <div className="bg-emerald-500/[0.04] p-4 rounded-2xl border border-emerald-500/10">
                    <span className="block text-xl font-black text-emerald-600">{studentsPreview.filter(s => s.shouldImport && s.status === 'new').length}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">New Accounts</span>
                  </div>
                  <div className="bg-amber-500/[0.04] p-4 rounded-2xl border border-amber-500/10">
                    <span className="block text-xl font-black text-amber-600">{studentsPreview.filter(s => s.shouldImport && s.status === 'existing').length}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Linked profiles</span>
                  </div>
                  <div className="bg-rose-500/[0.04] p-4 rounded-2xl border border-rose-500/10">
                    <span className="block text-xl font-black text-rose-500">{studentsPreview.filter(s => !s.shouldImport).length}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Skipped</span>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 p-4 rounded-2xl border border-indigo-200/50 flex gap-3 text-xs font-bold leading-relaxed">
                  <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
                  <p>
                    <strong>Automatic Safeguard:</strong> The system locks the batch code at confirmation time. If another transaction registers this code in this year, the system increments the serial code suffix to protect against race conditions.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 5: Finished Success metrics showing created logins */}
            {step === 5 && importResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-8 text-center"
              >
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Academic Group Created Successfully!</h4>
                  <p className="text-sm font-medium text-slate-500">
                    Batch <span className="font-extrabold text-slate-800 dark:text-white">{importResult.batchCode}</span> is fully launched with <span className="font-bold text-slate-800 dark:text-white">{importResult.totalProcessed}</span> students.
                  </p>
                </div>

                {/* Import stats */}
                <div className="grid grid-cols-3 gap-4 border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 p-4 rounded-3xl">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">New Students</span>
                    <span className="text-xl font-black text-emerald-600">{importResult.createdCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Linked Profiles</span>
                    <span className="text-xl font-black text-amber-600">{importResult.linkedCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Skipped/Duplicate rows</span>
                    <span className="text-xl font-black text-slate-500">{importResult.skippedCount}</span>
                  </div>
                </div>

                {/* Newly created logins credentials list */}
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-950 p-4 rounded-t-3xl border-b border-slate-200">
                    <div>
                      <h5 className="text-[11px] font-black uppercase text-slate-800 dark:text-white tracking-widest">Share Login Credentials</h5>
                      <p className="text-[10px] text-slate-400 font-bold">Copy formatted logins info block to instantly send on WhatsApp.</p>
                    </div>
                    <button 
                      onClick={copyAllCredentialsText}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2"
                    >
                      {copiedCredentials ? (
                        <>
                          <Check className="w-4 h-4" /> Logins Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy All Credentials Block
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="border border-slate-200 rounded-b-3xl overflow-hidden bg-white dark:bg-slate-900/40">
                    <div className="max-h-[260px] overflow-y-auto no-scrollbar">
                      <table className="w-full border-collapse text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black">
                          <tr>
                            <th className="p-3 text-left">Name</th>
                            <th className="p-3 text-left">Phone</th>
                            <th className="p-3 text-left">Student ID</th>
                            <th className="p-3 text-left">Password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                          {importResult.credentialsList.map((c: any) => (
                            <tr key={c.id}>
                              <td className="p-3 font-extrabold text-slate-900 dark:text-white">{c.name}</td>
                              <td className="p-3 font-mono">{c.phone}</td>
                              <td className="p-3 font-mono text-purple-600 dark:text-purple-400">#{c.studentIdNum}</td>
                              <td className="p-3 font-mono font-black">{c.studentPassword}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="pt-4 flex gap-4 max-w-sm mx-auto">
                  <button 
                    onClick={() => {
                      onClose();
                      navigate(`/groups/${importResult.groupId}`);
                    }}
                    className="flex-1 bg-purple-600 text-white py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-600/30 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                  >
                    🚀 Open Group Dashboard <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

        {/* Modal footer panels */}
        {step < 5 && (
          <div className="p-6 border-t border-slate-150 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-950/20">
            {step === 1 ? (
              <button 
                onClick={onClose}
                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
            ) : (
              <button 
                disabled={isSubmitting}
                onClick={() => setStep(prev => prev - 1)}
                className="px-6 py-3 rounded-xl border border-slate-200/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 text-xs font-black uppercase tracking-widest"
              >
                Back / Return
              </button>
            )}

            {step === 2 && (
              <button 
                onClick={handleGroupStepConfirm}
                className="bg-purple-600 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition"
              >
                Proceed: Student list →
              </button>
            )}

            {step === 3 && (
              <button 
                onClick={handleStudentsStepConfirm}
                className="bg-purple-600 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition"
              >
                Review Launch Summary →
              </button>
            )}

            {step === 4 && (
              <button 
                disabled={isSubmitting}
                onClick={handleFinalizeImport}
                className="bg-emerald-600 text-white px-10 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? "Generating logs..." : "Confirm & Import Group ✅"}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AccountingImportModal;
