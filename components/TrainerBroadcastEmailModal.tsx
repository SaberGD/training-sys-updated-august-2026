import React, { useState, useEffect } from 'react';
import { Group, Student, User } from '../types';
import { Mail, Send, CheckCircle2, AlertCircle, Eye, Edit3, Users, RefreshCw, X, Sparkles, MessageSquare, LayoutTemplate, HelpCircle } from 'lucide-react';
import { getApiEndpoint } from '../lib/apiConfig';
import { sendNotification } from '../services/firestore';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface SavedEmailTemplate {
  id: string;
  nameAr: string;
  subject: string;
  bodyHtml: string;
}

const BUILTIN_TEMPLATES: SavedEmailTemplate[] = [
  {
    id: 'trainer_announcement',
    nameAr: '📢 تنويه إعلاني من المدرب / الأكاديمية (افتراضي)',
    subject: '📢 تنويه هام من المدرب {trainer_name} - {course_name} | {group_name}',
    bodyHtml: ''
  },
  {
    id: 'ai_assistant_invitation',
    nameAr: '🤖 دعوة تجربة المساعد الذكي MARO AI وشروط الجروبات',
    subject: '🤖 دعوة خاصة لتجربة المساعد الذكي الجديد MARO AI | SABER GROUP',
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">
<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>
<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">🤖 دعوة خاصة لتجربة المساعد الذكي MARO AI</div>
</div>
<div style="padding:32px 28px;">
<h3 style="margin:0 0 12px 0;font-size:18px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</h3>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.7;">يسعدنا دعوتك لتجربة المساعد الذكي الجديد <strong>MARO AI</strong> الخاص بالأكاديمية عبر الرابط: <a href="https://ai.sabergroupacademy.com/" target="_blank" style="color:#FF8900;font-weight:800;">https://ai.sabergroupacademy.com/</a></p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:24px;font-size:15px;font-weight:800;color:#0D0D0D;line-height:2;">
🔑 ID: <span style="font-family:monospace;color:#620000;font-size:16px;">{student_id}</span><br>
🔐 Password: <span style="font-family:monospace;color:#620000;font-size:16px;">{student_password}</span>
</div>
<div style="background:#FFF7ED;border:1.5px solid #FFEDD5;border-radius:18px;padding:20px;margin-bottom:24px;">
<div style="font-size:15px;font-weight:900;color:#C2410C;margin-bottom:10px;">📌 شروط وتعليمات هامّة جداً:</div>
<div style="font-size:13px;color:#7C2D12;line-height:1.7;">
<strong>1️⃣ للطلاب في الجروبات الشغالة حالياً:</strong><br>
• يجب أن تكون مسجلاً في جروب شغال حالياً ومُلتزماً بالحضور.<br>
• قم بعمل مشاركة (Share) لبوست الأكاديمية على فيسبوك وإرسال سكرين شوت من الشير للبوست التالي:<br>
<a href="https://www.facebook.com/photo/?fbid=1014941958047609&set=a.149461877928959" target="_blank" style="color:#EA580C;font-weight:800;">رابط بوست الفيسبوك للمشاركة 🔗</a><br>
• قم بإرسال سكرين شوت تثبت تواجدك بالجروب الشغال حالياً.<br><br>
<strong>2️⃣ للطلاب الخريجين (من أنهوا الكورس):</strong><br>
• يجب أن تكون حاصلاً على الشهادة الخاصة بالكورس وإرسال سكرين شوت من الشهادة (أو من الجروب الحقيقي).
</div>
</div>
<div style="text-align:center;margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
<a href="https://ai.sabergroupacademy.com/" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF8900 0%,#D97300 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(255,137,0,.4);">🤖 تجربة MARO AI ←</a>
<a href="https://www.facebook.com/photo/?fbid=1014941958047609&set=a.149461877928959" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#1877F2 0%,#0F52BA 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(24,119,242,.4);">📌 بوست الفيسبوك ←</a>
</div>
</div>
<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'welcome',
    nameAr: '👋 الترحيب وبيانات دخول بوابة الطالب (Welcome Student Portal)',
    subject: '🎉 أهلاً بك يا {student_name} في {course_name} - بيانات دخول بوابة الطالب',
    bodyHtml: `<div dir="rtl" style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 14px;">
    <h2 style="color: #1d4ed8; margin: 0 0 6px 0; font-size: 20px;">👋 مرحباً بك في أكاديمية صابر جروب</h2>
    <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: bold;">{course_name} - {group_name}</p>
  </div>

  <p style="font-size: 15px;">عزيزي الطالب <strong>{student_name}</strong>،</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155;">تم تسجيلك بنجاح في المنصة التعليمية. فيما يلي بيانات دخول بوابة الطالب الرسمية الخاصة بك:</p>

  <div style="background-color: #eff6ff; padding: 18px; border-radius: 12px; border: 1px solid #bfdbfe; margin: 18px 0;">
    <p style="margin: 4px 0; font-size: 14px; color: #1e40af;"><strong>كود الطالب (ID):</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold;">{student_id}</span></p>
    <p style="margin: 4px 0; font-size: 14px; color: #1e40af;"><strong>كلمة المرور:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold;">{student_password}</span></p>
  </div>

  <div style="text-align: center; margin: 24px 0;">
    <a href="{portal_link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">الدخول إلى بوابة الطالب</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
  <p style="font-size: 11px; color: #94a3b8; text-align: center;">All rights reserved to Eng. Mohamed Saber© - SABER GROUP COURSES ACADEMY</p>
</div>`
  },
  {
    id: 'absence_alert',
    nameAr: '⚠️ تنبيه الغياب والالتزام بالحضور (Absence Alert)',
    subject: '⚠️ تنبيه هام بخصوص غياب الطالب {student_name} - {course_name}',
    bodyHtml: `<div dir="rtl" style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; background-color: #fff1f2; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #fecdd3;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e11d48; padding-bottom: 14px;">
    <h2 style="color: #be123c; margin: 0 0 6px 0; font-size: 20px;">⚠️ إشعار تنبيه بالغياب</h2>
    <p style="color: #9f1239; font-size: 13px; margin: 0; font-weight: bold;">{course_name} - {group_name}</p>
  </div>

  <p style="font-size: 15px;">عزيزي الطالب <strong>{student_name}</strong>،</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155;">نود لفت انتباهكم إلى تسجيل غياب غير مبرر في المحاضرة الأخيرة. يرجى التواصل مع مدرب الكورس أو إدارة الأكاديمية لتقديم العذر اللازم وتجنب خصم النقاط.</p>

  <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; border-right: 4px solid #e11d48; margin: 18px 0; font-size: 14px; color: #475569;">
    {announcement_content}
  </div>

  <div style="text-align: center; margin: 24px 0;">
    <a href="{portal_link}" style="display: inline-block; background-color: #be123c; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">متابعة سجل الغياب والبوابة</a>
  </div>
</div>`
  }
];

interface TrainerBroadcastEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: Group | null;
  students: Student[];
  user: User;
  trainers?: User[];
}

export const TrainerBroadcastEmailModal: React.FC<TrainerBroadcastEmailModalProps> = ({
  isOpen,
  onClose,
  group,
  students,
  user,
  trainers = []
}) => {
  const [trainerName, setTrainerName] = useState<string>('');
  const [messageContent, setMessageContent] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [templateHtml, setTemplateHtml] = useState<string>('');
  const [savedTemplates, setSavedTemplates] = useState<SavedEmailTemplate[]>(BUILTIN_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('trainer_announcement');
  
  const [allFetchedStudents, setAllFetchedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Effective list of students (prefer allFetchedStudents if loaded, fallback to passed students)
  const effectiveStudents = allFetchedStudents.length > 0 ? allFetchedStudents : students;
  const activeStudentsWithEmail = effectiveStudents.filter(s => !s.deactivated && s.email && typeof s.email === 'string' && s.email.trim() !== '');
  const noEmailStudentsCount = effectiveStudents.filter(s => !s.deactivated && (!s.email || typeof s.email !== 'string' || !s.email.trim())).length;

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  const [currentStep, setCurrentStep] = useState<'edit' | 'preview' | 'sending' | 'done'>('edit');
  const [sendingProgress, setSendingProgress] = useState<{ total: number; sent: number; failed: number }>({ total: 0, sent: 0, failed: 0 });
  const [logs, setLogs] = useState<{ email: string; name: string; success: boolean; error?: string }[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Determine default trainer name
      let defaultName = user.name || 'م. صابر عبد الدايم';
      const primaryTrainerId = group?.primaryTrainerId || (group?.trainerIds && group?.trainerIds[0]);
      if (primaryTrainerId && trainers.length > 0) {
        const found = trainers.find(t => t.uid === primaryTrainerId || t.id === primaryTrainerId);
        if (found?.name) {
          defaultName = found.name;
        }
      }
      setTrainerName(defaultName);

      // Fetch all students directly from Firestore to bypass page pagination limits
      loadModalStudents();

      // Fetch all templates from Firestore
      fetchAllTemplates();

      // Reset state
      setCurrentStep('edit');
      setMessageContent('');
      setLogs([]);
      setSendingProgress({ total: 0, sent: 0, failed: 0 });
    }
  }, [isOpen, group?.id]);

  const loadModalStudents = async () => {
    setLoadingStudents(true);
    try {
      let q;
      if (group?.id) {
        q = query(collection(db, 'students'), where('groupId', '==', group.id));
      } else {
        q = collection(db, 'students');
      }
      const snap = await getDocs(q);
      const fetchedList: Student[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Record<string, any>;
        fetchedList.push({ id: docSnap.id, ...data } as Student);
      });

      if (fetchedList.length > 0) {
        setAllFetchedStudents(fetchedList);
        const valid = fetchedList.filter(s => !s.deactivated && s.email && typeof s.email === 'string' && s.email.trim() !== '');
        setSelectedStudentIds(valid.map(s => s.id));
      } else {
        setAllFetchedStudents(students);
        const valid = students.filter(s => !s.deactivated && s.email && typeof s.email === 'string' && s.email.trim() !== '');
        setSelectedStudentIds(valid.map(s => s.id));
      }
    } catch (err) {
      console.warn('Could not fetch all students for modal:', err);
      setAllFetchedStudents(students);
      const valid = students.filter(s => !s.deactivated && s.email && typeof s.email === 'string' && s.email.trim() !== '');
      setSelectedStudentIds(valid.map(s => s.id));
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchAllTemplates = async () => {
    setLoadingTemplate(true);
    try {
      const querySnap = await getDocs(collection(db, 'emailTemplates'));
      const firestoreTemplates: SavedEmailTemplate[] = [];
      querySnap.forEach(docSnap => {
        if (docSnap.id === 'global_master_layout') return;
        const d = docSnap.data();
        firestoreTemplates.push({
          id: docSnap.id,
          nameAr: d.nameAr || d.name || docSnap.id,
          subject: d.subject || '',
          bodyHtml: d.bodyHtml || d.content || ''
        });
      });

      // Merge builtin and firestore
      const map = new Map<string, SavedEmailTemplate>();
      BUILTIN_TEMPLATES.forEach(t => map.set(t.id, t));
      firestoreTemplates.forEach(t => {
        map.set(t.id, t);
      });

      const all = Array.from(map.values());
      setSavedTemplates(all);

      // Default to trainer_announcement or first
      const defaultT = all.find(t => t.id === 'trainer_announcement') || all[0];
      if (defaultT) {
        setSelectedTemplateId(defaultT.id);
        setCustomSubject(defaultT.subject || (group ? '📢 تنويه هام من المدرب {trainer_name} - {course_name} | {group_name}' : '📢 تنويه إعلاني هام من الأكاديمية - {trainer_name}'));
        setTemplateHtml(defaultT.bodyHtml || '');
      }
    } catch (e) {
      console.warn('Could not fetch email templates from Firestore:', e);
      setSavedTemplates(BUILTIN_TEMPLATES);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = savedTemplates.find(t => t.id === templateId);
    if (found) {
      setCustomSubject(found.subject || '');
      setTemplateHtml(found.bodyHtml || '');
    }
  };

  if (!isOpen) return null;

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === activeStudentsWithEmail.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(activeStudentsWithEmail.map(s => s.id));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Helper to replace variable placeholders per student
  const replacePlaceholders = (text: string, student?: Student) => {
    if (!text) return '';
    let res = text;
    const sampleName = student?.name || 'محمد أحمد';
    const sampleId = student?.studentIdNum || student?.id || '2026';
    const samplePass = student?.studentPassword || (student as any)?.password || (student?.id ? student.id.slice(-6) : '123456');
    const cName = (student as any)?.courseName || group?.courseName || 'الأكاديمية';
    const gName = (student as any)?.groupName || group?.name || 'جميع الطلاب';
    const bCode = group?.batchCode || group?.name || 'عام';
    const tName = trainerName || 'إدارة الأكاديمية';
    const formattedMsg = (messageContent || '').replace(/\n/g, '<br/>');

    res = res.replace(/{student_name}/g, sampleName);
    res = res.replace(/{name}/g, sampleName);
    res = res.replace(/{student_id}/g, sampleId);
    res = res.replace(/{id}/g, sampleId);
    res = res.replace(/{student_password}/g, samplePass);
    res = res.replace(/{password}/g, samplePass);
    res = res.replace(/{course_name}/g, cName);
    res = res.replace(/{group_name}/g, gName);
    res = res.replace(/{group_code}/g, gName);
    res = res.replace(/{batch_code}/g, bCode);
    res = res.replace(/{trainer_name}/g, tName);
    res = res.replace(/{announcement_content}/g, formattedMsg || 'نص الرسالة أو التنويه...');
    res = res.replace(/{portal_link}/g, 'https://training.sabergroupacademy.com/#/student/portal');
    res = res.replace(/{ai_link}/g, 'https://ai.sabergroupacademy.com/');
    res = res.replace(/{facebook_post_link}/g, 'https://www.facebook.com/photo/?fbid=1014941958047609');
    res = res.replace(/{facebook_link}/g, 'https://www.facebook.com/SABERGROUP.Courses');
    res = res.replace(/{instagram_link}/g, 'https://www.instagram.com/sabergroup.egc/');
    res = res.replace(/{whatsapp_link}/g, 'https://wa.me/201040784390');
    return res;
  };

  // Generate preview Subject
  const getRenderedSubject = (sampleStudent?: Student) => {
    let subj = customSubject || (group ? '📢 تنويه هام من المدرب {trainer_name} - {course_name} | {group_name}' : '📢 تنويه إعلاني هام من الأكاديمية - {trainer_name}');
    return replacePlaceholders(subj, sampleStudent);
  };

  // Generate preview Body HTML
  const getRenderedBodyHtml = (sampleStudent?: Student) => {
    if (templateHtml && templateHtml.trim() !== '') {
      return replacePlaceholders(templateHtml, sampleStudent);
    }

    // Default template layout fallback
    const formattedMessage = (messageContent || 'نص الرسالة أو التنويه...').replace(/\n/g, '<br/>');
    const studentName = sampleStudent?.name || 'محمد أحمد';

    return `<div dir="rtl" style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 14px;">
    <h2 style="color: #1d4ed8; margin: 0 0 6px 0; font-size: 20px;">📢 رسالة إعلانية هامة من الأكاديمية</h2>
    <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: bold;">${group?.courseName || 'أكاديمية صابر جروب'} - ${group?.name || 'جميع الطلاب المسجلين'}</p>
  </div>

  <p style="font-size: 15px;">عزيزي الطالب <strong>${studentName}</strong>،</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155;">تحية طيبة وبعد،،</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155;">نود إفادتكم بالتالي:</p>

  <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border-right: 4px solid #2563eb; margin: 18px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.06); line-height: 1.7; font-size: 14px; color: #0f172a;">
    ${formattedMessage}
  </div>

  <div style="background-color: #eff6ff; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
    <p style="margin: 2px 0; font-size: 13px; color: #1e40af;"><strong>المرسل:</strong> ${trainerName || 'إدارة الأكاديمية'}</p>
    <p style="margin: 2px 0; font-size: 13px; color: #1e40af;"><strong>النطاق:</strong> ${group?.batchCode || group?.name || 'جميع الطلاب والجروبات'}</p>
  </div>

  <p style="font-size: 13px; line-height: 1.5; color: #475569;">يرجى متابعة التكليفات واللوائح عبر بوابة الطالب الرسمية الخاصة بك.</p>

  <div style="text-align: center; margin-top: 22px; margin-bottom: 24px;">
    <a href="https://training.sabergroupacademy.com/#/student/portal" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">الانتقال إلى بوابة الطالب</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
  <p style="font-size: 11px; color: #94a3b8; text-align: center;">All rights reserved to Eng. Mohamed Saber© - SABER GROUP COURSES ACADEMY</p>
</div>`;
  };

  // Start sending bulk emails
  const handleStartBulkSend = async () => {
    const selectedStudents = activeStudentsWithEmail.filter(s => selectedStudentIds.includes(s.id));
    if (selectedStudents.length === 0) {
      alert('برجاء اختيار طالب واحد على الأقل لإرسال الإيميل إليه.');
      return;
    }

    // Check if selected template requires message content
    const selectedT = savedTemplates.find(t => t.id === selectedTemplateId);
    const requiresMessage = selectedTemplateId === 'trainer_announcement' || (selectedT?.bodyHtml && selectedT.bodyHtml.includes('{announcement_content}'));

    if (requiresMessage && (!messageContent || messageContent.trim() === '')) {
      alert('برجاء إدخال نص الرسالة/التنويه أولاً.');
      return;
    }

    setCurrentStep('sending');
    setSendingProgress({ total: selectedStudents.length, sent: 0, failed: 0 });
    const logResults: { email: string; name: string; success: boolean; error?: string }[] = [];

    let sentCount = 0;
    let failedCount = 0;

    for (const student of selectedStudents) {
      try {
        const studentSubject = replacePlaceholders(customSubject, student);
        const studentHtml = getRenderedBodyHtml(student);

        const payload = {
          recipientEmail: student.email,
          studentName: student.name,
          customSubject: studentSubject,
          customHtml: studentHtml,
          template: selectedTemplateId || 'trainer_announcement',
          groupId: group?.id || 'global',
          groupCode: group?.name || 'عام',
          courseName: group?.courseName || 'عام',
          batchCode: group?.batchCode || group?.name || 'عام',
          trainerName: trainerName || 'إدارة الأكاديمية',
          announcementContent: messageContent
        };

        const res = await fetch(getApiEndpoint('/api/google/send-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          sentCount++;
          logResults.push({ email: student.email, name: student.name, success: true });
        } else {
          failedCount++;
          logResults.push({ email: student.email, name: student.name, success: false, error: data.error || 'فشل الإرسال' });
        }

        // Send in-app notification to student
        try {
          await sendNotification({
            userId: student.id,
            title: `📢 تنويه هام من ${trainerName || 'الأكاديمية'}`,
            message: `رسالة إعلانية: ${messageContent ? messageContent.slice(0, 120) : customSubject}`,
            type: 'task_status',
            link: `/student-portal?studentId=${student.id}`
          });
        } catch (notifErr) {
          console.error("Failed to send in-app notification:", notifErr);
        }

      } catch (err: any) {
        failedCount++;
        logResults.push({ email: student.email, name: student.name, success: false, error: err.message || 'خطأ اتصال' });
      }

      setSendingProgress({
        total: selectedStudents.length,
        sent: sentCount,
        failed: failedCount
      });
      setLogs([...logResults]);
    }

    setCurrentStep('done');
  };

  const sampleStudent = students[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-arabic text-right">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {group ? `إرسال إيميل جماعي لطلاب الجروب (${group.name}) 📧` : 'إرسال إيميل جماعي لجميع طلاب السيستم 📧'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {group ? (
                  <>جروب: <span className="text-blue-400 font-bold">{group.name}</span> • كورس: <span className="text-slate-200 font-semibold">{group.courseName}</span></>
                ) : (
                  <>النطاق الشامل: <span className="text-blue-400 font-bold">{activeStudentsWithEmail.length} طالب</span> لديهم بريد إلكتروني مسجل</>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={currentStep === 'sending'}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-thin">

          {/* STEP 1: EDIT MESSAGE & SELECT RECIPIENTS */}
          {currentStep === 'edit' && (
            <div className="space-y-5">
              
              {/* Info banner */}
              <div className="bg-blue-950/30 border border-blue-800/40 p-4 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <p className="font-bold text-blue-300 mb-1">إرسال قالب معتمد لجميع الطلاب عبر السيرفر المركزي</p>
                  <p className="text-slate-400">اختر القالب المحفوظ على السيستم أو اكتب تنويهك المباشر، وسيقوم النظام بتعويض بيانات كل طالب (الاسم، الـ ID، وكلمة السر) تلقائياً في الإيميل.</p>
                </div>
              </div>

              {/* Template Selector Dropdown */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-blue-400" />
                  <span>اختر القالب المحفوظ في النظام (Select Template) 📋</span>
                  {loadingTemplate && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full text-right px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {savedTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sender Name & Subject Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">اسم المرسل (يظهر بالرسالة) 👤</label>
                  <input
                    type="text"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="مثال: م. صابر عبد الدايم"
                    className="w-full text-right px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">عنوان الرسالة (Subject) 📌</label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full text-right px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Custom Message Content / Announcement Area */}
              {(selectedTemplateId === 'trainer_announcement' || templateHtml.includes('{announcement_content}')) && (
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>نص الرسالة / التنويه الموجه للطلاب ✍️</span>
                    <span className="text-[11px] text-blue-400 font-normal">سيتم دمج النص في مكان {"{announcement_content}"} داخل القالب</span>
                  </label>
                  <textarea
                    rows={4}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="اكتب هنا التنويه أو التعليمات الهامة التي تريد إرسالها للطلاب..."
                    className="w-full text-right p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-medium placeholder:text-slate-600"
                  />
                </div>
              )}

              {/* Dynamic Variables Guide */}
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <span className="text-[11px] text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  المتغيرات التلقائية المستبدلة لكل طالب:
                </span>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  <span className="bg-slate-900 border border-slate-800 text-blue-400 px-2 py-0.5 rounded-md">{"{student_name}"} : اسم الطالب</span>
                  <span className="bg-slate-900 border border-slate-800 text-emerald-400 px-2 py-0.5 rounded-md">{"{student_id}"} : ID الطالب</span>
                  <span className="bg-slate-900 border border-slate-800 text-purple-400 px-2 py-0.5 rounded-md">{"{student_password}"} : كلمة السر</span>
                  <span className="bg-slate-900 border border-slate-800 text-amber-400 px-2 py-0.5 rounded-md">{"{course_name}"} : اسم الكورس</span>
                  <span className="bg-slate-900 border border-slate-800 text-cyan-400 px-2 py-0.5 rounded-md">{"{group_name}"} : اسم الجروب</span>
                </div>
              </div>

              {/* Student Recipients Selection */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-200">
                      الطلاب المستلمون ({selectedStudentIds.length} من {activeStudentsWithEmail.length} ببريد فعّال)
                    </span>
                    {loadingStudents && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin mr-1" />}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold bg-blue-950/50 border border-blue-900/40 px-3 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    {selectedStudentIds.length === activeStudentsWithEmail.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الطلاب'}
                  </button>
                </div>

                {loadingStudents ? (
                  <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2 font-medium">
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                    <span>جاري جلب قائمة جميع الطلاب المسجلين بالسيستم من قاعدة البيانات...</span>
                  </div>
                ) : activeStudentsWithEmail.length === 0 ? (
                  <p className="text-xs text-amber-400 text-center py-2 font-medium">⚠️ لا يوجد طلاب فعالين يمتلكون بريد إلكتروني مسجل.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin pl-1">
                      {activeStudentsWithEmail.map(student => {
                        const isSelected = selectedStudentIds.includes(student.id);
                        return (
                          <label 
                            key={student.id} 
                            onClick={() => handleToggleStudent(student.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                              isSelected ? 'bg-blue-950/40 border-blue-500/40 text-slate-200' : 'bg-slate-900/40 border-slate-800/60 text-slate-500 hover:text-slate-400'
                            }`}
                          >
                            <div className="truncate pl-2">
                              <span className="font-bold block truncate">{student.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate">{student.email}</span>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 shrink-0 pointer-events-none" 
                            />
                          </label>
                        );
                      })}
                    </div>

                    {noEmailStudentsCount > 0 && (
                      <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-300 font-medium flex items-center gap-2 mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>ملاحظة: يوجد <strong>{noEmailStudentsCount}</strong> طالب من أصل <strong>{effectiveStudents.length}</strong> بالسيستم ليس لديهم إيميل مسجل بملفاتهم.</span>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          )}

          {/* STEP 2: PREVIEW STEP */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-800/40 p-3.5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
                  <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>معاينة طريقة ظهور الإيميل للطلاب قبل الإرسال الفعلي:</span>
                </div>
                <span className="text-[11px] bg-amber-900/50 text-amber-200 font-mono font-bold px-2.5 py-0.5 rounded-lg border border-amber-700/50">
                  {selectedStudentIds.length} مستلم
                </span>
              </div>

              {/* Rendered Subject */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <span className="font-bold text-slate-400 shrink-0">عنوان الرسالة:</span>
                <span className="font-semibold text-blue-400 truncate">{getRenderedSubject(sampleStudent)}</span>
              </div>

              {/* Rendered HTML Container */}
              <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-inner max-h-[420px] overflow-y-auto scrollbar-thin">
                <div dangerouslySetInnerHTML={{ __html: getRenderedBodyHtml(sampleStudent) }} />
              </div>
            </div>
          )}

          {/* STEP 3: SENDING PROGRESS */}
          {currentStep === 'sending' && (
            <div className="py-10 text-center space-y-6">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                <Send className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white mb-2">جاري إرسال الإيميل الجماعي للطلاب... 🚀</h3>
                <p className="text-xs text-slate-400">تم إرسال {sendingProgress.sent} من أصل {sendingProgress.total} إيميل</p>
              </div>

              {/* Progress bar */}
              <div className="max-w-md mx-auto bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${sendingProgress.total > 0 ? (sendingProgress.sent / sendingProgress.total) * 100 : 0}%` }}
                />
              </div>

              <div className="text-xs text-slate-500 font-mono">
                يرجى الانتظار حتى اكتمال جميع عمليات الإرسال عبر الخادم المركزي...
              </div>
            </div>
          )}

          {/* STEP 4: DONE SUMMARY */}
          {currentStep === 'done' && (
            <div className="py-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-white">تمت عملية الإرسال الجماعي بنجاح! 🎉</h3>
                <p className="text-xs text-slate-400">تم إرسال القالب المحدد لجميع الطلاب المحددين وتسجيل الإشعار بـ Activity Logs.</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">الإجمالي</span>
                  <span className="text-lg font-black text-slate-200">{sendingProgress.total}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-2xl">
                  <span className="text-[10px] text-emerald-400 font-bold block mb-1">تم الإرسال</span>
                  <span className="text-lg font-black text-emerald-400">{sendingProgress.sent}</span>
                </div>
                <div className="bg-rose-950/30 border border-rose-900/40 p-3 rounded-2xl">
                  <span className="text-[10px] text-rose-400 font-bold block mb-1">فشل الإرسال</span>
                  <span className="text-lg font-black text-rose-400">{sendingProgress.failed}</span>
                </div>
              </div>

              {/* Logs */}
              <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 max-h-48 overflow-y-auto scrollbar-thin text-xs space-y-2">
                <span className="font-bold text-slate-400 block mb-2">تقرير تفصيلي بالإرسال:</span>
                {logs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-900 pb-1.5 text-slate-300">
                    <span className="font-medium">{log.name} ({log.email})</span>
                    {log.success ? (
                      <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">✔ تم الإرسال</span>
                    ) : (
                      <span className="text-rose-400 font-bold text-[11px]">❌ {log.error || 'فشل'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          {currentStep === 'edit' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={selectedStudentIds.length === 0}
                onClick={() => setCurrentStep('preview')}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة القالب قبل الإرسال (Preview)</span>
              </button>
            </>
          )}

          {currentStep === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep('edit')}
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>العودة للتعديل</span>
              </button>
              <button
                type="button"
                onClick={handleStartBulkSend}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>تأكيد وإرسال لـ {selectedStudentIds.length} طالب (Bulk Send)</span>
              </button>
            </>
          )}

          {currentStep === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg cursor-pointer"
            >
              إغلاق الشاشة
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default TrainerBroadcastEmailModal;
