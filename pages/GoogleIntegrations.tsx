import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { User, GoogleConnection, GoogleConnectionType, GoogleAuditLog, RescheduleLog, EmailTemplate } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { doc, setDoc, deleteDoc, getDoc, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToCollection } from '../services/firestore';
import { getApiEndpoint } from '../lib/apiConfig';
import { MasterEmailLayout, DEFAULT_MASTER_EMAIL_LAYOUT, wrapInSaberEmailFrame } from '../lib/emailTemplates';
import { 
  ShieldCheck, 
  Mail, 
  Calendar, 
  Video, 
  Plus, 
  RefreshCw, 
  Unlink, 
  Link2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  ExternalLink,
  Info,
  Activity,
  Search,
  Filter,
  FileText,
  AlertCircle,
  Eye,
  Code2,
  Save,
  Send,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Bold,
  Italic,
  Underline,
  Palette,
  Type,
  Sliders,
  LayoutGrid,
  Trash2
} from 'lucide-react';

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'ai_assistant_invitation',
    name: 'MARO AI Assistant Trainee Invitation',
    nameAr: 'دعوة تجربة المساعد الذكي MARO AI وشروط الجروبات',
    subject: '🤖 دعوة خاصة لتجربة المساعد الذكي الجديد MARO AI | SABER GROUP',
    descriptionAr: 'دعوة لجميع المتدربين لتجربة المساعد الذكي MARO AI مع إرسال الـ ID وكلمة السر، والشروط الخاصة بالجروبات الشغالة أو الشهادات للجروبات المنتهية.',
    availableVariables: ['{student_name}', '{course_name}', '{group_name}', '{student_id}', '{student_password}', '{ai_link}', '{facebook_post_link}', '{portal_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
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
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'welcome',
    name: 'Student Portal Welcome',
    nameAr: 'ترحيب انضمام الطالب وبوابة الطلاب',
    subject: 'أهلاً بيك في صابر جروب ❤️',
    descriptionAr: 'رسالة ترحيبية فورية تُرسل للطالب متضمنة الـ ID وكلمة السر الخاصة ببوابة الطلاب ورابط البورتال.',
    availableVariables: ['{student_name}', '{course_name}', '{group_name}', '{student_id}', '{student_password}', '{portal_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>

<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">أهلاً بيك في صابر جروب ❤️</div>
</div>
<div style="padding:32px 28px;">
<h3 style="margin:0 0 12px 0;font-size:18px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</h3>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">يسعدنا انضمامك إلى كورس {course_name} - الجروب {group_name}.</p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:24px;font-size:15px;font-weight:800;color:#0D0D0D;line-height:2;">
🔑 ID: <span style="font-family:monospace;color:#620000;font-size:16px;">{student_id}</span><br>
🔐 Password: <span style="font-family:monospace;color:#620000;font-size:16px;">{student_password}</span>
</div>
<div style="text-align:center;margin-top:24px;">
<a href="{portal_link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF8900 0%,#D97300 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(255,137,0,.4);">الانتقال لبوابة الطالب ←</a>
</div>
</div>

<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'session_reminder',
    name: 'Upcoming Session Reminder',
    nameAr: 'تذكير بالمحاضرة القادمة',
    subject: 'تذكير بالمحاضرة القادمة 🎓 - {course_name}',
    descriptionAr: 'رسالة تذكيرية بموعد المحاضرة وتفاصيلها مع رابط الدخول لـ Google Meet.',
    availableVariables: ['{student_name}', '{course_name}', '{group_name}', '{session_number}', '{lecture_title}', '{trainer_name}', '{session_date}', '{session_time}', '{meet_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>

<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">تذكير بالمحاضرة القادمة 🎓</div>
</div>
<div style="padding:32px 28px;">
<p style="margin:0 0 8px 0;font-size:15px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">يسعدنا تذكيرك بموعد المحاضرة القادمة ضمن برنامجك التدريبي.</p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:24px;font-size:14px;color:#0D0D0D;line-height:2;font-weight:700;">
الكورس: <span style="color:#620000;">{course_name}</span><br>
الجروب: <span>{group_name}</span><br>
المحاضرة: <span style="color:#FF8900;">#{session_number} - {lecture_title}</span><br>
المدرب: <span>{trainer_name}</span><br>
التاريخ: <span>{session_date}</span><br>
الوقت: <span>{session_time}</span>
</div>
<div style="text-align:center;margin-top:24px;">
<a href="{meet_link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#16A34A 0%,#15803D 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(22,163,74,.4);">🎥 دخول Google Meet</a>
</div>
</div>

<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'session_changed',
    name: 'Session Rescheduled / Postponed',
    nameAr: 'تحديث موعد المحاضرة',
    subject: 'تحديث موعد المحاضرة 📅 - {group_name}',
    descriptionAr: 'تنبيه بتحديث أو تغيير موعد المحاضرة والسبب والموعد الجديد.',
    availableVariables: ['{student_name}', '{old_date}', '{new_date}', '{reason}', '{portal_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>

<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">تحديث موعد المحاضرة 📅</div>
</div>
<div style="padding:32px 28px;">
<p style="margin:0 0 8px 0;font-size:15px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">تم تحديث موعد المحاضرة الخاصة بك.</p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:24px;font-size:14px;color:#0D0D0D;line-height:2;font-weight:700;">
الموعد السابق: <span style="color:#DC2626;text-decoration:line-through;">{old_date}</span><br>
الموعد الجديد: <span style="color:#16A34A;">{new_date}</span><br>
السبب: <span>{reason}</span>
</div>
<div style="text-align:center;margin-top:24px;">
<a href="{portal_link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF8900 0%,#D97300 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(255,137,0,.4);">الانتقال لبوابة الطالب ←</a>
</div>
</div>

<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'absence_alert',
    name: 'Absence Warning Alert',
    nameAr: 'تحديث سجل الحضور والغياب',
    subject: 'تحديث سجل الحضور ⚠️ - {group_name}',
    descriptionAr: 'إشعار عند تسجيل حالة الغياب أو التحديث لمتابعة البورتال.',
    availableVariables: ['{student_name}', '{session_number}', '{session_date}', '{portal_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>

<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">تحديث سجل الحضور ⚠️</div>
</div>
<div style="padding:32px 28px;">
<p style="margin:0 0 8px 0;font-size:15px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">تم تحديث سجل الحضور الخاص بك.</p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:24px;font-size:14px;color:#0D0D0D;line-height:2;font-weight:700;">
المحاضرة: <span style="color:#620000;">المحاضرة رقم {session_number}</span><br>
التاريخ: <span>{session_date}</span>
</div>
<div style="text-align:center;margin-top:24px;">
<a href="{portal_link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#DC2626 0%,#B91C1C 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(220,38,38,.4);">مراجعة سجل الحضور ←</a>
</div>
</div>

<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  },
  {
    id: 'trainer_announcement',
    name: 'Trainer Group Broadcast',
    nameAr: 'رسالة / إعلان من مدرب الجروب',
    subject: 'رسالة من مدرب الجروب 📢 - {trainer_name}',
    descriptionAr: 'رسالة توجيهية أو إعلان هام يُرسل من مدرب الجروب للطلاب.',
    availableVariables: ['{student_name}', '{announcement_content}', '{trainer_name}', '{portal_link}', '{facebook_link}', '{instagram_link}', '{whatsapp_link}'],
    bodyHtml: `<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#F4F6F8;padding:24px 10px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%);padding:36px 28px;text-align:center;">
<img src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp" width="165" style="display:block;margin:auto;margin-bottom:20px;">
<div style="height:4px;background:linear-gradient(90deg, #FF8900 0%, #FFB048 100%);border-radius:2px;margin-bottom:20px;"></div>
<div style="display:inline-block;background:rgba(255,137,0,.15);border:1px solid rgba(255,137,0,.4);padding:5px 16px;border-radius:50px;">
<span style="color:#FF8900;font-size:11px;font-weight:800;">✦ ADOBE AUTHORIZED ACADEMY ✦</span>
</div>
<h1 style="color:#fff;font-size:22px;font-weight:900;margin:12px 0 0 0;">SABER GROUP COURSES ACADEMY</h1>

<div style="color:#FF8900;font-size:17px;font-weight:800;margin-top:8px;">رسالة من مدرب الجروب 📢</div>
</div>
<div style="padding:32px 28px;">
<p style="margin:0 0 8px 0;font-size:15px;color:#0D0D0D;font-weight:800;">عزيزي الطالب {student_name} 👋</p>
<div style="border:2px solid #FF8900;border-radius:20px;padding:22px;background:#FFFBF5;margin-bottom:16px;font-size:14px;color:#0D0D0D;line-height:1.8;">
{announcement_content}
</div>
<p style="margin:0 0 20px 0;font-size:14px;color:#475569;font-weight:700;">المدرب: <span style="color:#FF8900;">{trainer_name}</span></p>
<div style="text-align:center;margin-top:24px;">
<a href="{portal_link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF8900 0%,#D97300 100%);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px;box-shadow:0 8px 20px -4px rgba(255,137,0,.4);">الانتقال لبوابة الطالب ←</a>
</div>
</div>

<div style="background:#0D0D0D;padding:32px 28px;text-align:center;border-top:3px solid #FF8900;">
<div style="color:#fff;font-size:15px;font-weight:900;">SABER GROUP COURSES ACADEMY</div>
<div style="color:#FF8900;font-size:11px;font-weight:700;margin-top:2px;">Official Training Management System</div>
<div style="margin-top:20px;">
<a href="https://www.facebook.com/SABERGROUP.Courses" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Facebook</a> •
<a href="https://www.instagram.com/sabergroup.egc/" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">Instagram</a> •
<a href="https://wa.me/201040784390" target="_blank" style="color:#fff;text-decoration:none;font-size:12px;font-weight:700;">WhatsApp</a>
</div>
<p style="font-size:11px;color:#666;margin:16px 0 0 0;">جميع الحقوق محفوظة © Eng. Mohamed Saber</p>
</div></div></div>`
  }
];

interface GoogleIntegrationsProps {
  user: User;
}

const GoogleIntegrations: React.FC<GoogleIntegrationsProps> = ({ user }) => {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Test Email state
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [selectedTestTemplateId, setSelectedTestTemplateId] = useState<string>('welcome');
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // New Custom Template Modal State
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTplNameAr, setNewTplNameAr] = useState('');
  const [newTplSubject, setNewTplSubject] = useState('');
  const [newTplTrigger, setNewTplTrigger] = useState('custom');
  const [newTplDesc, setNewTplDesc] = useState('');
  const [newTplBody, setNewTplBody] = useState(`<div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #4f46e5; margin-top: 0;">أهلاً بك يا {student_name} 🎓</h2>
  <p style="font-size: 14px; color: #334155;">رسالة مخصصة لكورس {course_name} بالجروب {group_name}.</p>
  <div style="text-align: center; margin-top: 20px;">
    <a href="{portal_link}" style="background-color: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">بوابة الطالب</a>
  </div>
</div>`);

  // Email Logs state
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  // Audit Logs state (Google Operations Logs)
  const [auditLogs, setAuditLogs] = useState<GoogleAuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditFilterStatus, setAuditFilterStatus] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Reschedule Logs state
  const [rescheduleLogs, setRescheduleLogs] = useState<RescheduleLog[]>([]);
  const [rescheduleRetryLoading, setRescheduleRetryLoading] = useState<string | null>(null);

  // Sessions stats state
  const [sessionsList, setSessionsList] = useState<any[]>([]);

  // Email Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_EMAIL_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('session_changed');
  const [templateTab, setTemplateTab] = useState<'visual' | 'editor' | 'preview'>('visual');
  const [templateSubject, setTemplateSubject] = useState<string>('');
  const [templateBody, setTemplateBody] = useState<string>('');
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Master Header & Footer layout state
  const [masterLayout, setMasterLayout] = useState<MasterEmailLayout>(DEFAULT_MASTER_EMAIL_LAYOUT);
  const [showMasterLayoutModal, setShowMasterLayoutModal] = useState(false);
  const [masterSaveLoading, setMasterSaveLoading] = useState(false);
  const [masterModalTab, setMasterModalTab] = useState<'header' | 'footer' | 'preview'>('header');

  // Fetch Master Header & Footer from Firestore
  useEffect(() => {
    const fetchMasterLayout = async () => {
      try {
        const mlRef = doc(db, 'emailTemplates', 'global_master_layout');
        const mlSnap = await getDoc(mlRef);
        if (mlSnap.exists()) {
          setMasterLayout({ ...DEFAULT_MASTER_EMAIL_LAYOUT, ...mlSnap.data() });
        }
      } catch (e) {
        console.warn("Could not fetch master email layout:", e);
      }
    };
    fetchMasterLayout();
  }, []);

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_EMAIL_TEMPLATES[0];
  }, [templates, selectedTemplateId]);

  // Sync state when selected template changes
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateSubject(selectedTemplate.subject);
      setTemplateBody(selectedTemplate.bodyHtml);
    }
  }, [selectedTemplateId, templates]);

  // Subscribe to real-time updates for googleConnections, emailLogs, auditLogs, rescheduleLogs, emailTemplates & sessions
  useEffect(() => {
    const unsubTemplates = subscribeToCollection<EmailTemplate>(
      'emailTemplates',
      (data) => {
        if (data && data.length > 0) {
          const defaultIds = new Set(DEFAULT_EMAIL_TEMPLATES.map(d => d.id));
          const customTpls = data.filter(d => !defaultIds.has(d.id));
          const merged = DEFAULT_EMAIL_TEMPLATES.map(def => {
            const found = data.find(d => d.id === def.id);
            return found ? { ...def, ...found } : def;
          });
          setTemplates([...merged, ...customTpls]);
        }
      }
    );
    const unsubConns = subscribeToCollection<GoogleConnection>(
      'googleConnections', 
      (data) => {
        const normalized = data.map(c => {
          if (c.email?.toLowerCase() === 'sabergroup.eg@gmail.com' || c.id === 'sabergroup_eg_gmail_com') {
            return { ...c, type: 'central' as const, accountType: 'admin' };
          }
          return c;
        });
        setConnections(normalized);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.warn('Realtime subscription failed for googleConnections, falling back to API:', err);
        fetchConnections();
      }
    );

    const unsubEmailLogs = subscribeToCollection<any>(
      'emailLogs', 
      (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());
        setEmailLogs(sorted);
      },
      [orderBy('sentAt', 'desc'), limit(30)],
      (err) => {
        console.warn('Realtime subscription failed for emailLogs, falling back to API:', err);
        fetchEmailLogs();
      }
    );

    const unsubAuditLogs = subscribeToCollection<GoogleAuditLog>(
      'googleAuditLogs',
      (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAuditLogs(sorted);
      },
      [orderBy('timestamp', 'desc'), limit(30)],
      (err) => {
        console.warn('Realtime subscription failed for googleAuditLogs, falling back to API:', err);
        fetchAuditLogs();
      }
    );

    const unsubRescheduleLogs = subscribeToCollection<RescheduleLog>(
      'rescheduleLogs',
      (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());
        setRescheduleLogs(sorted);
      },
      [orderBy('changedAt', 'desc'), limit(30)]
    );

    const unsubSessions = subscribeToCollection<any>(
      'sessions',
      (data) => {
        setSessionsList(data);
      },
      [limit(50)]
    );

    // Initial API fetches
    fetchConnections();
    fetchEmailLogs();
    fetchAuditLogs();

    // Listen for OAuth completion message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
        setMessage({
          type: 'success',
          text: isAr 
            ? `تم ربط الحساب (${event.data.email}) بنجاح!` 
            : `Account (${event.data.email}) connected successfully!`
        });
        fetchConnections();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      unsubTemplates();
      unsubConns();
      unsubEmailLogs();
      unsubAuditLogs();
      unsubRescheduleLogs();
      unsubSessions();
      window.removeEventListener('message', handleMessage);
    };
  }, [isAr]);

  const applyVisualFormat = (command: string, value: string = '') => {
    const editor = document.getElementById('visual-email-editor');
    if (editor) {
      editor.focus();
      document.execCommand(command, false, value);
      setTemplateBody(editor.innerHTML);
    }
  };

  const insertHtmlAtCursor = (html: string) => {
    const editor = document.getElementById('visual-email-editor');
    if (editor) {
      editor.focus();
      const sel = window.getSelection();
      if (sel && sel.getRangeAt && sel.rangeCount) {
        let range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const el = document.createElement('div');
          el.innerHTML = html;
          let frag = document.createDocumentFragment(), node, lastNode;
          while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode) {
            range = range.cloneRange();
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          setTemplateBody(editor.innerHTML);
          return;
        }
      }
    }
    setTemplateBody(prev => prev + html);
  };

  const insertComponentIntoVisual = (type: 'credentials' | 'button' | 'alert') => {
    let snippet = '';
    if (type === 'credentials') {
      snippet = `
        <div style="background: #FFFFFF; border: 2px solid #FF8900; border-radius: 20px; padding: 22px; margin: 18px 0; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.12); text-align: right;" dir="rtl">
          <div style="font-size: 15px; font-weight: 800; color: #0D0D0D; margin-bottom: 14px; border-bottom: 1px solid #F1F5F9; padding-bottom: 10px;">🔑 بيانات تسجيل الدخول إلى بوابة الطالب:</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 10px 14px; background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 11px; color: #64748B; font-weight: 700; display: block; margin-bottom: 2px;">الـ ID الخاص بك</span>
                <span style="font-size: 15px; font-weight: 900; color: #0D0D0D; font-family: monospace;">{student_id}</span>
              </td>
              <td width="4%"></td>
              <td style="padding: 10px 14px; background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 11px; color: #64748B; font-weight: 700; display: block; margin-bottom: 2px;">كلمة السر</span>
                <span style="font-size: 15px; font-weight: 900; color: #620000; font-family: monospace;">{student_password}</span>
              </td>
            </tr>
          </table>
        </div>`;
    } else if (type === 'button') {
      snippet = `
        <div style="text-align: center; margin: 24px 0;">
          <a href="{portal_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #FF8900 0%, #D97300 100%); color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 15px 36px; border-radius: 14px; box-shadow: 0 8px 20px -4px rgba(255, 137, 0, 0.4);">الانتقال لبوابة الطالب ←</a>
        </div>`;
    } else if (type === 'alert') {
      snippet = `
        <div style="background-color: #FEF2F2; border: 1.5px solid #FECDD3; border-radius: 16px; padding: 16px; margin: 18px 0; text-align: right;" dir="rtl">
          <p style="margin: 0; font-size: 12px; color: #991B1B; font-weight: 800; line-height: 1.5;">⚠️ تحذير أمني هام: يرجى عدم مشاركة الـ ID أو كلمة السر الخاصة بك مع أي شخص إطلاقاً لضمان أمان حسابك وحفظ سجل حضورك وتطبيقك.</p>
        </div>`;
    }
    insertHtmlAtCursor(snippet);
  };

  const handleSaveMasterLayoutOnly = async () => {
    setMasterSaveLoading(true);
    setMessage(null);
    try {
      const masterRef = doc(db, 'emailTemplates', 'global_master_layout');
      await setDoc(masterRef, {
        ...masterLayout,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.email
      }, { merge: true });

      setMessage({
        type: 'success',
        text: isAr ? '✅ تم حفظ الهيدر والفوتر الرئيسي في قاعدة البيانات بنجاح!' : '✅ Master Header & Footer layout saved to Firebase!'
      });
      setShowMasterLayoutModal(false);
    } catch (err: any) {
      console.error('Failed to save master email layout:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل حفظ الهيدر والفوتر الرئيسي' : 'Failed to save master layout')
      });
    } finally {
      setMasterSaveLoading(false);
    }
  };

  const handleApplyMasterLayoutToAll = async () => {
    if (!window.confirm(isAr 
      ? 'هل أنت متأكد من تطبيق وتعميم الهيدر والفوتر الرئيسي الحالي على جميع قوالب الإيميلات في السيستم وقاعدة البيانات؟' 
      : 'Are you sure you want to apply this Master Header & Footer to ALL email templates and sync to Firebase?'
    )) {
      return;
    }

    setMasterSaveLoading(true);
    setMessage(null);
    try {
      // 1. Save global master layout document
      const masterRef = doc(db, 'emailTemplates', 'global_master_layout');
      await setDoc(masterRef, {
        ...masterLayout,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.email
      }, { merge: true });

      // 2. Process and update all templates
      const batchPromises = templates.map(async (tpl) => {
        let coreBody = tpl.bodyHtml || '';

        // If template already has a full Saber frame wrapper, extract inner content
        if (coreBody.includes('<!DOCTYPE') || coreBody.includes('<html') || coreBody.includes('SABER GROUP COURSES ACADEMY')) {
          if (coreBody.includes('<td style="padding: 36px 32px; background-color: #FFFFFF;">')) {
            const parts = coreBody.split('<td style="padding: 36px 32px; background-color: #FFFFFF;">');
            if (parts[1]) {
              const inner = parts[1].split('</td>')[0];
              if (inner && inner.trim()) coreBody = inner;
            }
          } else if (coreBody.includes('<div style="padding:32px 28px;">')) {
            const parts = coreBody.split('<div style="padding:32px 28px;">');
            if (parts[1]) {
              const inner = parts[1].split('</div>\n\n<div style="background:#0D0D0D')[0];
              if (inner && inner.trim()) coreBody = inner;
            }
          }
        }

        const newFrameHtml = wrapInSaberEmailFrame(
          tpl.subject || tpl.nameAr || 'إيميل رسمي',
          '{course_name} — الجروب {group_name}',
          coreBody,
          masterLayout
        );

        const templateRef = doc(db, 'emailTemplates', tpl.id);
        const updatedData: EmailTemplate = {
          ...tpl,
          bodyHtml: newFrameHtml,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.email
        };

        await setDoc(templateRef, updatedData, { merge: true });
        return updatedData;
      });

      const updatedList = await Promise.all(batchPromises);
      setTemplates(updatedList);

      const currentlySelected = updatedList.find(t => t.id === selectedTemplateId);
      if (currentlySelected) {
        setTemplateSubject(currentlySelected.subject);
        setTemplateBody(currentlySelected.bodyHtml);
      }

      setMessage({
        type: 'success',
        text: isAr 
          ? '✅ تم تطبيق وتعميم الهيدر والفوتر الرئيسي المشترك على كافة القوالب وحفظها في قاعدة البيانات Firebase بنجاح!' 
          : '✅ Shared Master Header & Footer successfully applied to ALL email templates in Firebase!'
      });
      setShowMasterLayoutModal(false);
    } catch (err: any) {
      console.error('Failed to apply master layout to all templates:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل تطبيق الهيدر والفوتر على جميع القوالب' : 'Failed to apply master layout to all templates')
      });
    } finally {
      setMasterSaveLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaveTemplateLoading(true);
    setMessage(null);
    try {
      const templateRef = doc(db, 'emailTemplates', selectedTemplate.id);
      const updatedData: EmailTemplate = {
        ...selectedTemplate,
        subject: templateSubject,
        bodyHtml: templateBody,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.email
      };
      await setDoc(templateRef, updatedData, { merge: true });
      
      // Local update
      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? updatedData : t));

      setMessage({
        type: 'success',
        text: isAr ? '✅ تم حفظ القالب وتطبيقه مباشرة في قاعدة بيانات النظام للإيميلات المرسلة!' : '✅ Email template saved and synchronized to database!'
      });
    } catch (err: any) {
      console.error('Failed to save email template:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل حفظ القالب' : 'Failed to save template')
      });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleResetToOfficialDefault = async () => {
    if (!selectedTemplate) return;
    const defaultPreset = DEFAULT_EMAIL_TEMPLATES.find(t => t.id === selectedTemplate.id) || DEFAULT_EMAIL_TEMPLATES[0];
    if (!defaultPreset) return;

    setSaveTemplateLoading(true);
    setMessage(null);
    try {
      const templateRef = doc(db, 'emailTemplates', selectedTemplate.id);
      const updatedData: EmailTemplate = {
        ...selectedTemplate,
        subject: defaultPreset.subject,
        bodyHtml: defaultPreset.bodyHtml,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.email
      };
      await setDoc(templateRef, updatedData, { merge: true });

      setTemplateSubject(defaultPreset.subject);
      setTemplateBody(defaultPreset.bodyHtml);
      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? updatedData : t));

      setMessage({
        type: 'success',
        text: isAr ? '✅ تم إعادة تعيين واستبدال القالب بالتصميم المعتمد وتحديثه في قاعدة البيانات!' : '✅ Template reset to official standard!'
      });
    } catch (err: any) {
      console.error('Failed to reset email template:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشلت إعادة تعيين القالب' : 'Failed to reset template')
      });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleOverwriteAllWithOfficialStyle = async () => {
    if (!window.confirm(isAr 
      ? 'هل أنت متأكد من تطبيق تصميم Student Portal Welcome المعتمد على جميع القوالب في السيستم وقاعدة البيانات؟ سيتم استبدال نصوص القوالب بالاستايل الرسمي الموحد.' 
      : 'Are you sure you want to apply the official Student Portal Welcome style to ALL templates and save to database?'
    )) {
      return;
    }

    setSaveTemplateLoading(true);
    setMessage(null);
    try {
      const batchPromises = DEFAULT_EMAIL_TEMPLATES.map(async (defaultPreset) => {
        const templateRef = doc(db, 'emailTemplates', defaultPreset.id);
        const existingTpl = templates.find(t => t.id === defaultPreset.id);
        const updatedData: EmailTemplate = {
          ...(existingTpl || defaultPreset),
          subject: defaultPreset.subject,
          bodyHtml: defaultPreset.bodyHtml,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.email
        };
        await setDoc(templateRef, updatedData, { merge: true });
        return updatedData;
      });

      const updatedList = await Promise.all(batchPromises);

      const defaultIds = new Set(DEFAULT_EMAIL_TEMPLATES.map(d => d.id));
      const customTemplates = templates.filter(t => !defaultIds.has(t.id));
      const finalTemplates = [...updatedList, ...customTemplates];

      setTemplates(finalTemplates);

      const currentlySelected = finalTemplates.find(t => t.id === selectedTemplateId);
      if (currentlySelected) {
        setTemplateSubject(currentlySelected.subject);
        setTemplateBody(currentlySelected.bodyHtml);
      }

      setMessage({
        type: 'success',
        text: isAr 
          ? '✅ تم تطبيق استايل Student Portal Welcome المعتمد على جميع القوالب وحفظها في قاعدة البيانات بنجاح!' 
          : '✅ All templates successfully overwritten with official Student Portal Welcome style!'
      });
    } catch (err: any) {
      console.error('Failed to overwrite all email templates:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل تطبيق الاستايل على جميع القوالب' : 'Failed to overwrite all templates')
      });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateIdToDelete?: string) => {
    const targetId = templateIdToDelete || selectedTemplate?.id;
    if (!targetId) return;
    const targetTpl = templates.find(t => t.id === targetId);
    if (!targetTpl) return;

    if (!window.confirm(isAr ? `هل أنت متأكد من حذف القالب "${targetTpl.nameAr || targetTpl.name}"؟` : `Are you sure you want to delete "${targetTpl.name}"?`)) {
      return;
    }

    setSaveTemplateLoading(true);
    setMessage(null);
    try {
      const templateRef = doc(db, 'emailTemplates', targetId);
      await deleteDoc(templateRef);

      const updatedTemplates = templates.filter(t => t.id !== targetId);
      setTemplates(updatedTemplates);

      if (selectedTemplateId === targetId) {
        const nextTemplate = updatedTemplates[0];
        if (nextTemplate) {
          setSelectedTemplateId(nextTemplate.id);
        }
      }

      setMessage({
        type: 'success',
        text: isAr ? '✅ تم حذف القالب بنجاح من النظام!' : '✅ Email template deleted successfully!'
      });
    } catch (err: any) {
      console.error('Failed to delete email template:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل حذف القالب' : 'Failed to delete template')
      });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleCopyVariable = (varName: string) => {
    navigator.clipboard.writeText(varName);
    setCopiedVariable(varName);
    setTimeout(() => setCopiedVariable(null), 2000);
    
    if (templateTab === 'visual') {
      insertHtmlAtCursor(` <strong style="color:#FF8900; background:#FFF7ED; padding:2px 6px; border-radius:4px; font-family:monospace;">${varName}</strong> `);
    } else {
      setTemplateBody(prev => prev + ' ' + varName);
    }
  };

  const renderedPreviewHtml = useMemo(() => {
    let html = templateBody || '';
    const sampleData: Record<string, string> = {
      '{student_name}': 'أحمد محمود (مثال)',
      '{group_name}': 'UI/UX Design - Batch 12',
      '{group_code}': 'GRP-UX-12',
      '{course_name}': 'UI/UX & Product Design Masterclass',
      '{session_number}': '4',
      '{lecture_title}': 'Design Systems & Figma Tokens',
      '{session_date}': '2026-08-01',
      '{session_time}': '06:00 PM',
      '{old_date}': '2026-07-28',
      '{new_date}': '2026-08-01',
      '{reason}': 'ظرف طارئ وتم ترحيل الجدول بالتنسيق مع المتدربين',
      '{trainer_name}': 'م. صابر عبد الدايم',
      '{meet_link}': 'https://meet.google.com/abc-defg-hij',
      '{portal_link}': 'https://training.sabergroupacademy.com/#/student-portal',
      'YOUR_LOGO': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp',
      '{logo}': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp',
      '{logo_url}': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp'
    };

    html = html.replace(/src=["']YOUR_LOGO["']/gi, 'src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp"');

    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replaceAll(key, value);
    });

    return html;
  }, [templateBody]);

// Helper for safe JSON fetching without crashing on HTML response
async function safeFetchJson(url: string, options?: RequestInit) {
  const targetUrl = getApiEndpoint(url);
  try {
    const res = await fetch(targetUrl, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    let data: any = {};
    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { error: 'استجابة غير صالحة من السيرفر' };
      }
    } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`لم يتم الوصول لخدمة API (${res.status}). يرجى التأكد من تشغيل السيرفر.`);
    } else {
      data = { error: text || `HTTP Error ${res.status}` };
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `فشل الطلب (${res.status})`);
    }

    return data;
  } catch (err: any) {
    if (err.name === 'SyntaxError' || (err.message && err.message.includes('JSON'))) {
      throw new Error('استجابة غير صالحة من الخادم. يرجى إعادة المحاولة.');
    }
    throw err;
  }
}

  const handleRetryRescheduleSync = async (groupId: string, logId?: string) => {
    setRescheduleRetryLoading(logId || groupId);
    setMessage(null);
    try {
      const data = await safeFetchJson('/api/google/sync-group-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, operatorName: user.name, operatorEmail: user.email })
      });
      if (data.success) {
        setMessage({
          type: 'success',
          text: isAr ? `✅ ${data.message}` : `✅ Re-sync triggered successfully!`
        });
      } else {
        throw new Error(data.error || 'فشلت إعادة المزامنة');
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء إعادة المزامنة' : 'Failed to retry sync')
      });
    } finally {
      setRescheduleRetryLoading(null);
    }
  };

  const fetchConnections = async () => {
    try {
      const data = await safeFetchJson('/api/google/connections');
      if (Array.isArray(data)) {
        const normalized = data.map(c => {
          if (c.email?.toLowerCase() === 'sabergroup.eg@gmail.com' || c.id === 'sabergroup_eg_gmail_com') {
            return { ...c, type: 'central' as const, accountType: 'admin' };
          }
          return c;
        });
        setConnections(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch google connections via API:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true);
    try {
      const data = await safeFetchJson('/api/google/email-logs');
      if (Array.isArray(data)) {
        setEmailLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch email logs:", err);
    } finally {
      setEmailLogsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const data = await safeFetchJson('/api/google/audit-logs');
      if (data.logs) setAuditLogs(data.logs);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Metrics computation for Stage 8 Dashboard
  const metrics = useMemo(() => {
    const connectedAccounts = connections.filter(c => c.status === 'connected').length;
    const reconnectRequired = connections.filter(c => c.status === 'reconnect_required').length;
    const syncedSessions = sessionsList.filter(s => s.googleSyncStatus === 'synced').length;
    const failedSessions = sessionsList.filter(s => s.googleSyncStatus === 'failed').length;
    const failedEmails = emailLogs.filter(e => e.status === 'failed').length;

    return {
      connectedAccounts,
      reconnectRequired,
      syncedSessions,
      failedSessions,
      failedEmails
    };
  }, [connections, sessionsList, emailLogs]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditFilterStatus !== 'all' && log.status !== auditFilterStatus) return false;
      if (auditSearchQuery.trim()) {
        const query = auditSearchQuery.toLowerCase();
        const op = (log.operator || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        return op.includes(query) || action.includes(query) || details.includes(query);
      }
      return true;
    });
  }, [auditLogs, auditFilterStatus, auditSearchQuery]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestEmailLoading(true);
    setMessage(null);
    try {
      const activeTpl = templates.find(t => t.id === selectedTestTemplateId) || selectedTemplate;
      const data = await safeFetchJson('/api/google/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recipientEmail: testEmailAddress.trim(),
          template: activeTpl?.id || 'welcome',
          customSubject: activeTpl?.subject || templateSubject,
          customHtml: activeTpl?.bodyHtml || templateBody
        })
      });

      if (data.success) {
        setMessage({
          type: 'success',
          text: isAr ? `✅ ${data.message}` : `✅ Test email sent successfully!`
        });
        setShowTestEmailModal(false);
        setTestEmailAddress('');
        fetchEmailLogs();
      } else {
        throw new Error(data.error || 'فشل إرسال الإيميل التجريبي');
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء إرسال الإيميل التجريبي' : 'Failed to send test email')
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplNameAr.trim() || !newTplSubject.trim()) return;
    setSaveTemplateLoading(true);
    setMessage(null);
    try {
      const templateId = `custom_${Date.now()}`;
      const triggerLabelMap: Record<string, string> = {
        'on_join_group': 'عند الانضمام للجروب',
        'session_reminder_24h': 'قبل المحاضرة بـ 24 ساعة',
        'session_reminder_2h': 'قبل المحاضرة بـ 2 ساعة',
        'session_reminder_1h': 'قبل المحاضرة بـ 1 ساعة',
        'absence_alert': 'عند الغياب',
        'weekly_report': 'التقرير الأسبوعي',
        'custom': 'يدوي / مخصص'
      };

      const newTemplateData: EmailTemplate = {
        id: templateId,
        name: newTplNameAr,
        nameAr: newTplNameAr,
        subject: newTplSubject,
        descriptionAr: newTplDesc || `قالب مخصص: ${triggerLabelMap[newTplTrigger] || 'مخصص'}`,
        availableVariables: ['{student_name}', '{group_name}', '{course_name}', '{session_number}', '{lecture_title}', '{session_date}', '{session_time}', '{trainer_name}', '{meet_link}', '{portal_link}'],
        bodyHtml: newTplBody,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.email
      };

      const templateRef = doc(db, 'emailTemplates', templateId);
      await setDoc(templateRef, newTemplateData);

      setTemplates(prev => [...prev, newTemplateData]);
      setSelectedTemplateId(templateId);
      setShowCreateTemplateModal(false);
      setNewTplNameAr('');
      setNewTplSubject('');
      setNewTplDesc('');

      setMessage({
        type: 'success',
        text: isAr ? '✅ تم إنشاء قالب الإيميل الجديد بنجاح!' : '✅ Custom email template created successfully!'
      });
    } catch (err: any) {
      console.error('Failed to create custom template:', err);
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل إنشاء القالب الجديد' : 'Failed to create template')
      });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleConnect = async (type: GoogleConnectionType) => {
    setActionLoading(`connect_${type}`);
    setMessage(null);
    try {
      const data = await safeFetchJson(`/api/google/auth-url?type=${type}`);
      if (!data.url) {
        throw new Error(data.error || 'فشل توليد رابط الربط مع Google');
      }

      // Open OAuth in popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        'GoogleOAuthPopup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to top window if popup blocked
        window.location.href = data.url;
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء فتح صفحة المصادقة' : 'Failed to start OAuth flow')
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestConnection = async (conn: GoogleConnection) => {
    setActionLoading(`test_${conn.id}`);
    setMessage(null);
    try {
      const data = await safeFetchJson('/api/google/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conn.id, email: conn.email })
      });

      if (data.success) {
        setMessage({
          type: 'success',
          text: isAr ? `✅ ${data.message}` : `✅ Connection active and verified!`
        });
      } else {
        setMessage({
          type: 'error',
          text: isAr ? `⚠️ ${data.message || data.error}` : `⚠️ Connection test failed: ${data.error}`
        });
      }
      fetchConnections();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'فشل فحص الاتصال بالحساب' : 'Failed to test connection')
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (conn: GoogleConnection) => {
    if (!window.confirm(isAr ? `هل أنت تأكد من قطع اتصال الحساب (${conn.email})؟` : `Disconnect ${conn.email}?`)) {
      return;
    }

    setActionLoading(`disconnect_${conn.id}`);
    setMessage(null);
    try {
      const data = await safeFetchJson('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conn.id, email: conn.email })
      });

      setMessage({
        type: 'info',
        text: isAr ? `تم قطع اتصال الحساب (${conn.email})` : `Account disconnected (${conn.email})`
      });
      fetchConnections();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء قطع الاتصال' : 'Failed to disconnect account')
      });
    } finally {
      setActionLoading(null);
    }
  };

  const centralConnection = connections.find(c => c.type === 'central' || c.email?.toLowerCase() === 'sabergroup.eg@gmail.com');
  const organizerConnections = connections.filter(c => (c.type === 'organizer' || !c.type) && c.email?.toLowerCase() !== 'sabergroup.eg@gmail.com');

  const getStatusBadge = (status: GoogleConnection['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isAr ? 'متصل (Connected)' : 'Connected'}
          </span>
        );
      case 'reconnect_required':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            {isAr ? 'إعادة ربط (Reconnect Required)' : 'Reconnect Required'}
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {isAr ? 'غير متصل (Disconnected)' : 'Disconnected'}
          </span>
        );
    }
  };

  return (
    <Layout user={user}>
      <div className="space-y-8 pb-12">
        {/* Page Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-600 via-indigo-600 to-emerald-500" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isAr ? 'لوحة تحكم وتكامل Google (Google Integrations)' : 'Google Integrations & Operations'}
                  </h1>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                    {isAr 
                      ? 'ربط الحسابات الرسمية، متابعة المزامنة والعمليات، وسجل تعديلات الأحداث والإيميلات'
                      : 'Manage connected accounts, monitor Google Calendar sync, and review operation audit logs'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { fetchConnections(); fetchEmailLogs(); fetchAuditLogs(); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                {isAr ? 'تحديث اللوحة' : 'Refresh Dashboard'}
              </button>
            </div>
          </div>
        </div>

        {/* STAGE 8 DASHBOARD METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{isAr ? 'حسابات متصلة' : 'Connected'}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{metrics.connectedAccounts}</p>
            <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'حسابات Google جاهزة' : 'Active OAuth connections'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{isAr ? 'تحتاج Reconnect' : 'Need Reconnect'}</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className={`text-2xl font-black ${metrics.reconnectRequired > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
              {metrics.reconnectRequired}
            </p>
            <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'تتطلب إعادة مصادقة' : 'Expired token refresh'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{isAr ? 'محاضرات متزامنة' : 'Synced Sessions'}</span>
              <Calendar className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{metrics.syncedSessions}</p>
            <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'تم إنشاء/تحديث تقويمها' : 'Synced on Google Calendar'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{isAr ? 'محاضرات فشلت' : 'Failed Sessions'}</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <p className={`text-2xl font-black ${metrics.failedSessions > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {metrics.failedSessions}
            </p>
            <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'تعذر مزامنتها مع التقويم' : 'Failed Calendar sync'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2 col-span-2 sm:col-span-1">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{isAr ? 'إيميلات فشلت' : 'Failed Emails'}</span>
              <Mail className="w-4 h-4 text-rose-400" />
            </div>
            <p className={`text-2xl font-black ${metrics.failedEmails > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {metrics.failedEmails}
            </p>
            <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'رسائل تعذر إرسالها' : 'Failed dispatched emails'}</p>
          </div>
        </div>

        {/* Global System Alert Messages */}
        {message && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
              : message.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
          }`}>
            <span className="text-sm font-bold flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              {message.text}
            </span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold opacity-75 hover:opacity-100">
              &times;
            </button>
          </div>
        )}

        {/* OAuth Callback Notice & Helper */}
        <div className="bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 rounded-2xl p-4 sm:p-5 text-amber-900 dark:text-amber-200 text-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-black text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'تنبيه هامة لإعداد رابط إعادة التوجيه (Redirect URI) بـ Google Cloud Console' : 'Important Setup: Authorized Redirect URI'}</span>
            </div>
            <button
              onClick={() => {
                const uri = `${window.location.origin}/api/google/callback`;
                navigator.clipboard.writeText(uri);
                setCopiedCallback(true);
                setTimeout(() => setCopiedCallback(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shrink-0 cursor-pointer shadow-sm"
            >
              {copiedCallback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCallback ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ رابط الـ Callback' : 'Copy Redirect URI')}</span>
            </button>
          </div>
          <p className="leading-relaxed font-medium text-slate-700 dark:text-slate-300">
            {isAr 
              ? 'إذا ظهر لك خطأ (Error 400: redirect_uri_mismatch) عند الضغط على ربط الحساب، يرجى إدراج هذا الرابط بالضبط في Google Cloud Console تحت Credentials ➔ OAuth 2.0 Client IDs ➔ Authorized redirect URIs:'
              : 'If you see (Error 400: redirect_uri_mismatch) when connecting, please add this URI in Google Cloud Console under Credentials ➔ OAuth 2.0 Client IDs ➔ Authorized redirect URIs:'}
          </p>
          <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-amber-500/30 font-mono text-xs font-bold text-amber-800 dark:text-amber-300 select-all break-all dir-ltr">
            {`${window.location.origin}/api/google/callback`}
          </div>
        </div>

        {/* SECTION 1: Central Official System Account */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {isAr ? '1- الحساب الرسمي للنظام (Central Email)' : '1. Official Central System Email'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">
                    {isAr ? 'حصري وحساس' : 'Exclusive'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {isAr 
                    ? 'الحساب المسؤول عن إرسال كافة رسائل وتنبيهات وتقارير النظام للطلاب والمدربين.'
                    : 'Responsible for sending system notifications, alert emails, and student reports.'}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-red-500" />
                  <span>sabergroup.eg@gmail.com</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleConnect('central')}
              disabled={actionLoading === 'connect_central'}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
            >
              {actionLoading === 'connect_central' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {centralConnection?.status === 'connected'
                ? (isAr ? 'إعادة ربط الحساب الرسمي' : 'Reconnect Central Account')
                : (isAr ? 'Connect Google Account (ربط الحساب الرسمي)' : 'Connect Google Account')}
            </button>
          </div>

          {/* Central Email Card Status */}
          {centralConnection ? (
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900 dark:text-white text-base">
                    {centralConnection.displayName}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ({centralConnection.email})
                  </span>
                  {getStatusBadge(centralConnection.status)}
                </div>
                <p className="text-xs text-slate-400">
                  {isAr ? 'آخر اتصال:' : 'Last Connected:'}{' '}
                  <span className="font-mono text-slate-300">
                    {centralConnection.lastConnectedAt 
                      ? new Date(centralConnection.lastConnectedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')
                      : 'N/A'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowTestEmailModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isAr ? 'Send Test Email (إرسال إيميل تجريبي)' : 'Send Test Email'}
                </button>

                <button
                  onClick={() => handleTestConnection(centralConnection)}
                  disabled={actionLoading === `test_${centralConnection.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
                >
                  {actionLoading === `test_${centralConnection.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                  )}
                  {isAr ? 'Test Connection (فحص)' : 'Test Connection'}
                </button>

                <button
                  onClick={() => handleDisconnect(centralConnection)}
                  disabled={actionLoading === `disconnect_${centralConnection.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-all"
                >
                  {actionLoading === `disconnect_${centralConnection.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5" />
                  )}
                  {isAr ? 'Disconnect (قطع)' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'لم يتم ربط الحساب الرسمي للنظام بعد.' : 'No Central System Account connected yet.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isAr 
                  ? 'اضغط على زر "Connect Google Account" أعلاه وسجل الدخول بحساب sabergroup.eg@gmail.com' 
                  : 'Click "Connect Google Account" above and sign in with sabergroup.eg@gmail.com'}
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2: Group Organizers Accounts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {isAr ? '2- حسابات مسؤولي الجروبات (Group Organizers)' : '2. Group Organizer Accounts'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wider">
                    {isAr ? 'متعدد الحسابات' : 'Multiple Accounts'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {isAr 
                    ? 'هذه الحسابات تُستخدم خصيصاً لإنشاء مواعيد المحاضرات في Google Calendar وتوليد روابط اجتماعات Google Meet.'
                    : 'Used to schedule group lecture events on Google Calendar and generate Google Meet space links.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                    <Video className="w-3 h-3 text-indigo-500" /> Google Meet Links
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                    <Calendar className="w-3 h-3 text-emerald-500" /> Google Calendar Events
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleConnect('organizer')}
              disabled={actionLoading === 'connect_organizer'}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
            >
              {actionLoading === 'connect_organizer' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isAr ? 'Connect Google Account (إضافة حساب مسؤول جديد)' : 'Connect Google Account'}
            </button>
          </div>

          {/* Group Organizers Accounts List */}
          {organizerConnections.length > 0 ? (
            <div className="space-y-3">
              {organizerConnections.map((conn) => (
                <div 
                  key={conn.id}
                  className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-black text-slate-900 dark:text-white text-base">
                        {conn.displayName}
                      </span>
                      <span className="text-xs font-mono text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        {conn.email}
                      </span>
                      {getStatusBadge(conn.status)}
                    </div>
                    <p className="text-xs text-slate-400">
                      {isAr ? 'تاريخ آخر اتصال:' : 'Last Connected:'}{' '}
                      <span className="font-mono text-slate-300">
                        {conn.lastConnectedAt 
                          ? new Date(conn.lastConnectedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')
                          : 'N/A'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={actionLoading === `test_${conn.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
                    >
                      {actionLoading === `test_${conn.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      {isAr ? 'Test Connection' : 'Test Connection'}
                    </button>

                    <button
                      onClick={() => handleConnect('organizer')}
                      disabled={actionLoading === 'connect_organizer'}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {isAr ? 'Reconnect' : 'Reconnect'}
                    </button>

                    <button
                      onClick={() => handleDisconnect(conn)}
                      disabled={actionLoading === `disconnect_${conn.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-all"
                    >
                      {actionLoading === `disconnect_${conn.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      {isAr ? 'Disconnect' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'لا يوجد حسابات مسؤولي جروبات مضافة حالياً.' : 'No Group Organizer accounts added yet.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isAr 
                  ? 'مثال: training01@gmail.com, training02@gmail.com - اضغط على Connect Google Account لإضافة حساب جديد.'
                  : 'Example: training01@gmail.com, training02@gmail.com - Click Connect Google Account to add one.'}
              </p>
            </div>
          )}
        </div>

        {/* Unified All Google Connections Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isAr ? 'جدول ملخص كافة حسابات Google المربوطة بالنظام' : 'All Google Connected Accounts Table'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? 'عرض شامل لحالة الأذونات والاتصال المباشر بالحسابات' : 'Comprehensive overview of connection statuses and account types'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {connections.length} {isAr ? 'حسابات' : 'Accounts'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="p-4 rounded-r-xl">{isAr ? 'اسم الحساب' : 'Account Name'}</th>
                  <th className="p-4">{isAr ? 'الإيميل' : 'Email'}</th>
                  <th className="p-4">{isAr ? 'نوع الحساب' : 'Account Type'}</th>
                  <th className="p-4">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-4">{isAr ? 'تاريخ آخر اتصال' : 'Last Connected'}</th>
                  <th className="p-4 rounded-l-xl text-center">{isAr ? 'العمليات المتاحة' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                {connections.length > 0 ? (
                  connections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {conn.displayName}
                      </td>
                      <td className="p-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {conn.email}
                      </td>
                      <td className="p-4">
                        {conn.type === 'central' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 font-bold">
                            <Mail className="w-3 h-3" />
                            {isAr ? 'Central Email (الحساب الرسمي)' : 'Central Email'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-bold">
                            <Calendar className="w-3 h-3" />
                            {isAr ? 'Group Organizer (مسؤول الجروبات)' : 'Group Organizer'}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(conn.status)}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {conn.lastConnectedAt ? new Date(conn.lastConnectedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'N/A'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleConnect(conn.type)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all"
                            title={isAr ? 'Connect / Reconnect' : 'Connect / Reconnect'}
                          >
                            <Link2 className="w-4 h-4 text-indigo-500" />
                          </button>
                          <button
                            onClick={() => handleTestConnection(conn)}
                            disabled={actionLoading === `test_${conn.id}`}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all"
                            title={isAr ? 'Test Connection' : 'Test Connection'}
                          >
                            {actionLoading === `test_${conn.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-emerald-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDisconnect(conn)}
                            disabled={actionLoading === `disconnect_${conn.id}`}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold transition-all"
                            title={isAr ? 'Disconnect' : 'Disconnect'}
                          >
                            {actionLoading === `disconnect_${conn.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      {isAr ? 'لا توجد أي حسابات مربوطة حالياً.' : 'No Google connections found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION: Email Templates Manager (قسم إدارة وتعديل قوالب الإيميلات) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? 'إدارة وقوالب إيميلات النظام (Email Templates Manager)' : 'Email Templates Manager'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? 'مكان مخصص لتعديل نصوص، عناوين، وتصاميم الإيميلات التي يُرسلها السيستم للمتدربين تلقائياً مع المعاينة الحية' : 'Customize, edit subjects, HTML templates, and live preview all system automated emails sent to trainees'}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteTemplate()}
                disabled={saveTemplateLoading || templates.length <= 1}
                title={isAr ? 'حذف القالب الحالي من النظام' : 'Delete this template'}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isAr ? 'حذف القالب' : 'Delete Template'}
              </button>
              <button
                type="button"
                onClick={handleResetToOfficialDefault}
                disabled={saveTemplateLoading}
                title={isAr ? 'استعادة الشكل المعتمد لهذا القالب المحدد' : 'Reset to official template with ID & password'}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isAr ? 'استعادة تصميم القالب' : 'Reset Template'}
              </button>
              <button
                type="button"
                onClick={handleOverwriteAllWithOfficialStyle}
                disabled={saveTemplateLoading}
                title={isAr ? 'تطبيق تصميم Student Portal Welcome الرسمي المعتمد على جميع القوالب وحفظها في قاعدة البيانات' : 'Apply official Student Portal Welcome layout to ALL templates & save to database'}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                {isAr ? 'تطبيق ستايل الطالب المعتمد على الكل' : 'Apply Official Style to All'}
              </button>
              <button
                type="button"
                onClick={() => setShowMasterLayoutModal(true)}
                title={isAr ? 'تعديل الأجزاء المشتركة الهيدر والفوتر وتعميمها على جميع القوالب في Firebase' : 'Edit shared Master Header & Footer and apply to all templates'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all"
              >
                <Sliders className="w-4 h-4 text-purple-200" />
                {isAr ? 'تعديل وتعميم الهيدر والفوتر الرئيسي' : 'Master Header & Footer'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-all"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'قالب مخصص جديد' : 'New Custom Template'}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={saveTemplateLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
              >
                {saveTemplateLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isAr ? 'حفظ تعديلات القالب' : 'Save Template'}
              </button>
            </div>
          </div>

          {/* Template Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {templates.map((tpl) => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer relative group ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {tpl.id}
                      </span>
                      <div className="flex items-center gap-1">
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                        {templates.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                            title={isAr ? 'حذف هذا القالب' : 'Delete template'}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white pt-1">
                      {isAr ? tpl.nameAr : tpl.name}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">
                    {tpl.descriptionAr}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Active Template Editor & Preview Tabs */}
          {selectedTemplate && (
            <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    {isAr ? selectedTemplate.nameAr : selectedTemplate.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedTemplate.descriptionAr}
                  </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <button
                    onClick={() => setTemplateTab('visual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      templateTab === 'visual'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    {isAr ? 'محرر التصميم المرئي (Visual UI Editor)' : 'Visual Editor'}
                  </button>
                  <button
                    onClick={() => setTemplateTab('editor')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      templateTab === 'editor'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {isAr ? 'كود HTML المصدر' : 'HTML Source'}
                  </button>
                  <button
                    onClick={() => setTemplateTab('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      templateTab === 'preview'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isAr ? 'المعاينة الحية للإيميل' : 'Live Preview'}
                  </button>
                </div>
              </div>

              {/* Dynamic Variables Quick Chips */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-500" />
                    {isAr ? 'المتغيرات الديناميكية المتاحة لهذا القالب (انقر للنسخ والإضافة المباشرة):' : 'Available Dynamic Variables (Click to insert):'}
                  </span>
                  {copiedVariable && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <Check className="w-3 h-3" />
                      تم نسخ وإضافة {copiedVariable}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedTemplate.availableVariables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleCopyVariable(v)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm flex items-center gap-1"
                      title={isAr ? 'إضافة المتغير لنص القالب' : 'Insert variable into template'}
                    >
                      <Copy className="w-3 h-3 opacity-60" />
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {templateTab === 'visual' ? (
                <div className="space-y-4">
                  {/* Email Subject Input */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                      {isAr ? 'عنوان الإيميل (Subject Line):' : 'Email Subject Line:'}
                    </label>
                    <input
                      type="text"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="عنوان الإيميل..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Visual Formatting Toolbar */}
                  <div className="bg-slate-100 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-indigo-500" />
                        {isAr ? 'أدوات التنسيق والتصميم المرئي المباشر:' : 'Visual Format Controls:'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {isAr ? 'تعديل مرئي بدون حاجة لخبرة برمجية' : 'No coding skills required'}
                      </span>
                    </div>

                    {/* Row 1: Font, Size, Styles, Alignment */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800">
                      {/* Font Family Selector */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Type className="w-3.5 h-3.5 text-slate-400 ms-1" />
                        <select
                          onChange={(e) => applyVisualFormat('fontName', e.target.value)}
                          defaultValue="Segoe UI"
                          className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="Cairo">خط كايرو (Cairo)</option>
                          <option value="Tajawal">خط تجول (Tajawal)</option>
                          <option value="Segoe UI">Segoe UI</option>
                          <option value="Arial">Arial</option>
                          <option value="Tahoma">Tahoma</option>
                          <option value="Amiri">خط أميري (Amiri)</option>
                          <option value="monospace">Monospace</option>
                        </select>
                      </div>

                      {/* Font Size Selector */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <select
                          onChange={(e) => applyVisualFormat('fontSize', e.target.value)}
                          defaultValue="3"
                          className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="2">حجم صغير (12px)</option>
                          <option value="3">حجم عادي (14px)</option>
                          <option value="4">حجم متوسط (16px)</option>
                          <option value="5">عنوان فرعي (18px)</option>
                          <option value="6">عنوان رئيسي (24px)</option>
                        </select>
                      </div>

                      <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5" />

                      {/* Style Toggles: Bold, Italic, Underline */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('bold')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="عريض (Bold)"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('italic')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="مائل (Italic)"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('underline')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="تحته خط (Underline)"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5" />

                      {/* Alignment buttons */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('justifyRight')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="محاذاة لليمين"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('justifyCenter')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="توسيط"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyVisualFormat('justifyLeft')}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                          title="محاذاة لليسار"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5" />

                      {/* Text Color palette */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Palette className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500">{isAr ? 'اللون:' : 'Color:'}</span>
                        {[
                          { color: '#0D0D0D', label: 'أسود' },
                          { color: '#620000', label: 'خمري أكاديمي' },
                          { color: '#FF8900', label: 'برتقالي صابر' },
                          { color: '#059669', label: 'أخضر' },
                          { color: '#1E3A8A', label: 'كحلي' },
                          { color: '#DC2626', label: 'أحمر' }
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => applyVisualFormat('foreColor', c.color)}
                            style={{ backgroundColor: c.color }}
                            className="w-4 h-4 rounded-full border border-white/80 shadow-sm hover:scale-125 transition-transform"
                            title={c.label}
                          />
                        ))}
                      </div>

                      {/* Background Highlights */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-slate-500">{isAr ? 'تظليل:' : 'Highlight:'}</span>
                        {[
                          { color: '#FEF9C3', label: 'أصفر' },
                          { color: '#FFEDD5', label: 'برتقالي' },
                          { color: '#DCFCE7', label: 'أخضر' },
                          { color: '#FEE2E2', label: 'أحمر' },
                          { color: 'transparent', label: 'إزالة التظليل' }
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => applyVisualFormat('hiliteColor', c.color)}
                            style={{ backgroundColor: c.color === 'transparent' ? '#FFFFFF' : c.color }}
                            className="w-4 h-4 rounded-md border border-slate-300 text-[8px] font-black flex items-center justify-center hover:scale-125 transition-transform"
                            title={c.label}
                          >
                            {c.color === 'transparent' ? '✕' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Row 2: Insert Special UI Components */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                      <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                        {isAr ? 'إدراج قوالب جاهزة للتعديل بكبسة زر:' : 'Quick Component Inserts:'}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => insertComponentIntoVisual('credentials')}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        🔑 {isAr ? 'كارت بيانات الـ ID والباسوورد' : 'ID & Password Box'}
                      </button>

                      <button
                        type="button"
                        onClick={() => insertComponentIntoVisual('button')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        🔘 {isAr ? 'زر رابط البوابة (CTA)' : 'Portal CTA Button'}
                      </button>

                      <button
                        type="button"
                        onClick={() => insertComponentIntoVisual('alert')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        ⚠️ {isAr ? 'صندوق تنبيه أمني ملون' : 'Security Warning Box'}
                      </button>
                    </div>
                  </div>

                  {/* Visual ContentEditable Canvas Area */}
                  <div className="p-4 sm:p-8 rounded-2xl bg-slate-200/60 dark:bg-slate-950 border border-slate-300/80 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3 px-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        {isAr ? 'انقر على النص في الكارت أدناه للكتابة والتعديل المباشر كأنك في Word:' : 'Click directly on the text below to edit visually like Word:'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Visual Canvas Editor
                      </span>
                    </div>

                    <div
                      id="visual-email-editor"
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={(e) => setTemplateBody(e.currentTarget.innerHTML)}
                      onBlur={(e) => setTemplateBody(e.currentTarget.innerHTML)}
                      dangerouslySetInnerHTML={{ __html: templateBody }}
                      className="bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden max-w-xl mx-auto border border-slate-200 p-6 sm:p-8 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[420px] dir-rtl text-right cursor-text"
                      dir="rtl"
                    />
                  </div>
                </div>
              ) : templateTab === 'editor' ? (
                <div className="space-y-4">
                  {/* Email Subject Input */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                      {isAr ? 'عنوان الإيميل (Subject Line):' : 'Email Subject Line:'}
                    </label>
                    <input
                      type="text"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="عنوان الإيميل..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* HTML Body Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                        {isAr ? 'محتوى الرسالة الهيكلي (HTML Code):' : 'HTML Body Content:'}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Standard inline-styled HTML
                      </span>
                    </div>
                    <textarea
                      rows={14}
                      value={templateBody}
                      onChange={(e) => setTemplateBody(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-indigo-300 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-inner dir-ltr text-left"
                    />
                  </div>
                </div>
              ) : (
                /* Live HTML Preview Mode */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-black text-slate-900 dark:text-white">{isAr ? 'عنوان الإيميل:' : 'Subject:'}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{templateSubject}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isAr ? '* المعاينة التفاعلية أدناه تحاكي البيانات الواقعية كاسم الطالب، اسم الكورس، المواعيد ورابط البوابة.' : '* Interactive preview replaces variables with sample student and course data.'}
                    </div>
                  </div>

                  {/* Rendered HTML Container */}
                  <div className="p-6 sm:p-10 rounded-2xl bg-slate-200/60 dark:bg-slate-950 border border-slate-300/80 dark:border-slate-800 overflow-x-auto">
                    <div 
                      className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-xl mx-auto border border-slate-200"
                      dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTestEmailAddress(user.email || '');
                    setShowTestEmailModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAr ? 'تجربة إرسال القالب على بريدك' : 'Send Test Copy to My Inbox'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {saveTemplateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isAr ? 'حفظ القالب الآن' : 'Save Template Now'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Email Logs (سجل إرسال الإيميلات) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? 'سجل رسائل النظام المباشرة (Email Logs)' : 'Email System Logs'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? 'متابعة كافة الإيميلات الصادرة من sabergroup.eg@gmail.com وحالتها في الوقت الفعلي' : 'Live logs of all emails sent via sabergroup.eg@gmail.com'}
              </p>
            </div>
            <button
              onClick={fetchEmailLogs}
              disabled={emailLogsLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${emailLogsLoading ? 'animate-spin' : ''}`} />
              {isAr ? 'تحديث السجل' : 'Refresh Logs'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="p-4 rounded-r-xl">{isAr ? 'المستلم (Recipient)' : 'Recipient'}</th>
                  <th className="p-4">{isAr ? 'اسم الطالب' : 'Student Name'}</th>
                  <th className="p-4">{isAr ? 'نوع القالب (Template)' : 'Template'}</th>
                  <th className="p-4">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-4">{isAr ? 'تاريخ الإرسال' : 'Sent At'}</th>
                  <th className="p-4 rounded-l-xl">{isAr ? 'ملاحظات / الخطأ' : 'Error Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                {emailLogs.length > 0 ? (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                        {log.recipientEmail}
                      </td>
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                        {log.studentName || '-'}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 font-bold">
                          {log.template}
                        </span>
                      </td>
                      <td className="p-4">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isAr ? 'تم الإرسال' : 'Sent'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            {isAr ? 'فشل الإرسال' : 'Failed'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {log.sentAt ? new Date(log.sentAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'N/A'}
                      </td>
                      <td className="p-4 text-rose-500 text-[11px] font-mono max-w-xs truncate">
                        {log.error || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      {isAr ? 'لا توجد سجلات إيميل مسجلة حالياً.' : 'No email logs recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5: Google Operations Audit Logs (STAGE 8 Requirement) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? 'سجل كافة عمليات Google (Google Operations Logs)' : 'Google Operations Audit Logs'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? 'سجل شامل ودقيق لجميع العمليات (Email Sent, Calendar Created, Calendar Updated, Calendar Deleted, Error)' : 'Audit trail of all Google actions, updates, deletions and errors'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder={isAr ? 'بحث بالمنفذ أو العملية...' : 'Search by operator or action...'}
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={auditFilterStatus}
                onChange={(e) => setAuditFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="all">{isAr ? 'جميع الحالات (All)' : 'All Status'}</option>
                <option value="success">{isAr ? 'ناجحة (Success)' : 'Success'}</option>
                <option value="failed">{isAr ? 'فاشلة (Failed)' : 'Failed'}</option>
              </select>

              <button
                onClick={fetchAuditLogs}
                disabled={auditLogsLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                {isAr ? 'تحديث العمليات' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="p-4 rounded-r-xl">{isAr ? 'نوع العملية (Action)' : 'Action'}</th>
                  <th className="p-4">{isAr ? 'من قام بالتعديل (Operator)' : 'Operator'}</th>
                  <th className="p-4">{isAr ? 'تفاصيل التغيير (Details)' : 'Details'}</th>
                  <th className="p-4">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="p-4 rounded-l-xl text-center">{isAr ? 'النتيجة (Status)' : 'Result'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                {filteredAuditLogs.length > 0 ? (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${
                          log.action === 'Calendar Created'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : log.action === 'Calendar Updated'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : log.action === 'Calendar Deleted'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : log.action === 'Email Sent'
                            ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          <FileText className="w-3.5 h-3.5" />
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <p>{log.operator || 'النظام (System)'}</p>
                          {log.operatorEmail && (
                            <p className="text-[10px] font-mono text-slate-400 font-normal">{log.operatorEmail}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-md leading-relaxed">
                        {log.details}
                        {log.groupName && (
                          <span className="block text-[10px] text-indigo-400 font-bold mt-0.5">
                            الجروب: {log.groupName}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'N/A'}
                      </td>
                      <td className="p-4 text-center">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isAr ? 'نجاح' : 'Success'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            {isAr ? 'فشل' : 'Failed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      {isAr ? 'لا توجد سجلات عمليات مطابقة للبحث.' : 'No audit operation logs found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 6: Reschedule Audit Trail (سجل ترحيل المحاضرات ومزامنة Google) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? 'سجل ترحيل المحاضرات ومزامنة Google (Reschedule Audit Trail)' : 'Reschedule Audit Trail & Google Sync'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? 'تتبع تاريخ تعديل المواعيد، التاريخ القديم والجديد، السبب، حالة المزامنة، وإعادة المحاولة' : 'Track session postponement history, old vs new dates, reasons, and sync status'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="p-4 rounded-r-xl">{isAr ? 'الجروب / المحاضرة' : 'Group & Session'}</th>
                  <th className="p-4">{isAr ? 'التاريخ القديم' : 'Old Date'}</th>
                  <th className="p-4">{isAr ? 'التاريخ الجديد' : 'New Date'}</th>
                  <th className="p-4">{isAr ? 'السبب / من قام بالتعديل' : 'Reason & Operator'}</th>
                  <th className="p-4">{isAr ? 'تاريخ الترحيل' : 'Rescheduled At'}</th>
                  <th className="p-4 text-center">{isAr ? 'حالة المزامنة' : 'Sync Status'}</th>
                  <th className="p-4 rounded-l-xl text-center">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                {rescheduleLogs.length > 0 ? (
                  rescheduleLogs.map((log) => (
                    <tr key={log.id || `${log.sessionId}_${log.changedAt}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <p className="text-indigo-600 dark:text-indigo-400 font-extrabold">{log.groupName || log.groupId}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">المحاضرة رقم {log.sessionNumber || '-'}</p>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-500 line-through">
                        {log.oldDate || '-'}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {log.newDate}
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs">
                        <p className="font-semibold">{log.reason}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">بواسطة: {log.changedBy}</p>
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {log.changedAt ? new Date(log.changedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'N/A'}
                      </td>
                      <td className="p-4 text-center">
                        {log.googleSyncStatus === 'synced' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isAr ? 'متزامن' : 'Synced'}
                          </span>
                        ) : log.googleSyncStatus === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            {isAr ? 'فشل المزامنة' : 'Failed'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {isAr ? 'قيد المزامنة' : 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleRetryRescheduleSync(log.groupId, log.id)}
                          disabled={rescheduleRetryLoading === (log.id || log.groupId)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto disabled:opacity-50"
                        >
                          {rescheduleRetryLoading === (log.id || log.groupId) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          {isAr ? 'إعادة المزامنة' : 'Re-sync'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {isAr ? 'لا توجد سجلات ترحيل محاضرة مسجلة حالياً.' : 'No reschedule logs recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Send Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isAr ? 'Send Test Email (إرسال إيميل تجريبي)' : 'Send Test Email'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr ? 'اختبار إرسال الرسائل من sabergroup.eg@gmail.com' : 'Test sending via central email'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {isAr ? 'اختر قالب الإيميل للتجربة:' : 'Select Email Template to Test:'}
                </label>
                <select
                  value={selectedTestTemplateId}
                  onChange={(e) => setSelectedTestTemplateId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none mb-3"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {isAr ? tpl.nameAr : tpl.name} ({tpl.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {isAr ? 'البريد الإلكتروني التجريبي للمستلم:' : 'Recipient Test Email:'}
                </label>
                <input
                  type="email"
                  required
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="sabergroup.eg@gmail.com أو أي إيميل للتجربة"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {isAr ? 'سيتم إرسال القالب المحدد تجريبياً عبر حساب Gmail المعتمد.' : 'The selected template will be dispatched using the official central account.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTestEmailModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={testEmailLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {testEmailLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {isAr ? 'إرسال الآن' : 'Send Test Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Custom Template */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isAr ? 'إضافة قالب إيميل جديد (New Custom Template)' : 'Create New Custom Email Template'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr ? 'إنشاء وتحديد مواعيد وأحداث إرسال إيميل جديد للطلاب' : 'Create and set triggers for automated emails'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomTemplate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? 'اسم القالب:' : 'Template Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newTplNameAr}
                    onChange={(e) => setNewTplNameAr(e.target.value)}
                    placeholder="مثال: تذكير بمشروع الكورس أو إيميل ترحيبي خاص"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? 'حدث / توقيت إرسال الإيميل (Trigger Event):' : 'Trigger Event / Timing:'}
                  </label>
                  <select
                    value={newTplTrigger}
                    onChange={(e) => setNewTplTrigger(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="on_join_group">فور تسكين / انضمام الطالب للجروب</option>
                    <option value="session_reminder_24h">تذكير تلقائي قبل المحاضرة بـ 24 ساعة</option>
                    <option value="session_reminder_2h">تذكير تلقائي قبل المحاضرة بـ 2 ساعة</option>
                    <option value="session_reminder_1h">تذكير تلقائي قبل المحاضرة بـ 1 ساعة</option>
                    <option value="absence_alert">عند تسجيل غياب الطالب</option>
                    <option value="weekly_report">إرسال التقرير الأسبوعي</option>
                    <option value="custom">إرسال يدوي / مخصص عند الطلب</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'عنوان الرسالة (Subject Line):' : 'Subject Line:'}
                </label>
                <input
                  type="text"
                  required
                  value={newTplSubject}
                  onChange={(e) => setNewTplSubject(e.target.value)}
                  placeholder="مثال: تنبيه مهم بشأن {lecture_title} - {group_name}"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'وصف مختصر للقالب:' : 'Short Description:'}
                </label>
                <input
                  type="text"
                  value={newTplDesc}
                  onChange={(e) => setNewTplDesc(e.target.value)}
                  placeholder="وصف موجز يوضح الغرض من هذا القالب للمشرفين"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'تصميم الهيكل (HTML Template Body):' : 'HTML Template Body:'}
                </label>
                <textarea
                  rows={6}
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-emerald-400 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none dir-ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saveTemplateLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {saveTemplateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAr ? 'حفظ وتفعيل القالب' : 'Create & Activate Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Header & Footer Layout Modal (تعديل وتعميم الهيدر والفوتر الرئيسي) */}
      {showMasterLayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 my-8">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {isAr ? 'تعديل وتعميم الهيدر والفوتر الرئيسي (Master Email Branding)' : 'Master Header & Footer Layout'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {isAr 
                      ? 'تعديل الهيدر والفوتر واللوجو والشارات الموحدة لجميع الإيميلات المرسلة في السيستم وقاعدة البيانات Firebase' 
                      : 'Customize shared header, footer, logo & social badges across all email templates'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterLayoutModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-lg transition-all"
              >
                &times;
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setMasterModalTab('header')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  masterModalTab === 'header'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {isAr ? '1. قسم الهيدر (Header)' : '1. Header Config'}
              </button>
              <button
                type="button"
                onClick={() => setMasterModalTab('footer')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  masterModalTab === 'footer'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {isAr ? '2. قسم الفوتر (Footer)' : '2. Footer Config'}
              </button>
              <button
                type="button"
                onClick={() => setMasterModalTab('preview')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  masterModalTab === 'preview'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {isAr ? '3. معاينة الهيكل المشترك (Preview)' : '3. Live Frame Preview'}
              </button>
            </div>

            {/* TAB 1: Header Configuration */}
            {masterModalTab === 'header' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Academy Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'اسم الأكاديمية الرئيسي (Academy Title):' : 'Academy Title:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.academyTitle || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, academyTitle: e.target.value })}
                      placeholder="SABER GROUP COURSES ACADEMY"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Badge Text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'الشارة العلمية / الاعتماد الأكاديمي:' : 'Badge Text:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.academySubtitleBadge || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, academySubtitleBadge: e.target.value })}
                      placeholder="✦ ADOBE AUTHORIZED TRAINING ACADEMY ✦"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Logo Image URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رابط صورة اللوجو (Logo Image URL):' : 'Logo Image URL:'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={masterLayout.logoUrl || ''}
                        onChange={(e) => setMasterLayout({ ...masterLayout, logoUrl: e.target.value })}
                        placeholder="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      {masterLayout.logoUrl && (
                        <div className="w-12 h-10 rounded-xl bg-slate-900 border border-slate-700 p-1 flex items-center justify-center overflow-hidden">
                          <img src={masterLayout.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Background Gradient */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'تدرج خلفية الهيدر (Header CSS Background Gradient):' : 'Header CSS Gradient:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.headerBgGradient || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, headerBgGradient: e.target.value })}
                      placeholder="linear-gradient(135deg,#0D0D0D 0%,#2A0000 50%,#620000 100%)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Accent Glow Color */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'لون الإضاءة المميزة (Accent Glow Color):' : 'Accent Glow Color:'}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={masterLayout.accentGlowColor || '#FF8900'}
                        onChange={(e) => setMasterLayout({ ...masterLayout, accentGlowColor: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        value={masterLayout.accentGlowColor || '#FF8900'}
                        onChange={(e) => setMasterLayout({ ...masterLayout, accentGlowColor: e.target.value })}
                        placeholder="#FF8900"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Custom Header HTML */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'كود HTML مخصص للهيدر (اختياري - Custom Header HTML):' : 'Custom Header HTML (Optional):'}
                    </label>
                    <textarea
                      rows={3}
                      value={masterLayout.customHeaderHtml || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, customHeaderHtml: e.target.value })}
                      placeholder="<!-- كود إضافي يتم إدراجه داخل الهيدر -->"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-indigo-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Footer Configuration */}
            {masterModalTab === 'footer' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Footer Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'عنوان الفوتر الرئيسي (Footer Title):' : 'Footer Title:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.footerTitle || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, footerTitle: e.target.value })}
                      placeholder="SABER GROUP COURSES ACADEMY"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Footer Subtitle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'الوصف المكمل للفوتر:' : 'Footer Subtitle:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.footerSubtitle || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, footerSubtitle: e.target.value })}
                      placeholder="Official Training Management System"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Support Text */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رسالة الدعم الفني والتواصل (Support Text):' : 'Support Message Text:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.footerSupportText || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, footerSupportText: e.target.value })}
                      placeholder="هل تحتاج إلى مساعدة أو لديك استفسار؟ تواصل معنا عبر القنوات الرسمية."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Social Links */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رابط فيسبوك (Facebook URL):' : 'Facebook URL:'}
                    </label>
                    <input
                      type="url"
                      value={masterLayout.facebookUrl || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, facebookUrl: e.target.value })}
                      placeholder="https://www.facebook.com/SABERGROUP.Courses"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رابط انستجرام (Instagram URL):' : 'Instagram URL:'}
                    </label>
                    <input
                      type="url"
                      value={masterLayout.instagramUrl || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, instagramUrl: e.target.value })}
                      placeholder="https://www.instagram.com/sabergroup.egc/"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رابط الواتساب (WhatsApp URL):' : 'WhatsApp URL:'}
                    </label>
                    <input
                      type="url"
                      value={masterLayout.whatsappUrl || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, whatsappUrl: e.target.value })}
                      placeholder="https://wa.me/201040784390"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Copyright Notice */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'حقوق النشر والملكية (Copyright Notice):' : 'Copyright Notice:'}
                    </label>
                    <input
                      type="text"
                      value={masterLayout.copyrightText || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, copyrightText: e.target.value })}
                      placeholder="جميع الحقوق محفوظة © Eng. Mohamed Saber"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Custom Footer HTML */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'كود HTML مخصص للفوتر (اختياري - Custom Footer HTML):' : 'Custom Footer HTML (Optional):'}
                    </label>
                    <textarea
                      rows={3}
                      value={masterLayout.customFooterHtml || ''}
                      onChange={(e) => setMasterLayout({ ...masterLayout, customFooterHtml: e.target.value })}
                      placeholder="<!-- كود إضافي يتم إدراجه أسفل الفوتر -->"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-indigo-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Live Preview of Master Frame */}
            {masterModalTab === 'preview' && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  {isAr 
                    ? '💡 هذه معاينة حية لشكل الهيدر والفوتر الرئيسي المشترك حول محتوى الرسالة التوضيحي:' 
                    : '💡 Live preview of how master header and footer frames standard email messages:'}
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-slate-200/60 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 overflow-x-auto">
                  <div 
                    className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-xl mx-auto border border-slate-200"
                    dangerouslySetInnerHTML={{
                      __html: wrapInSaberEmailFrame(
                        'عنوان الإيميل التجريبي',
                        'معاينة الهيكل الرئيسي المشترك',
                        `<div style="font-size:15px;color:#0D0D0D;font-weight:800;margin-bottom:12px;">عزيزي الطالب أحمد محمود 👋</div>
                         <p style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:20px;">هذا نموذج تجريبي يوضح كيف يحيط الهيدر والفوتر الرئيسي المشترك بالنص الداخلي لأي رسالة سيتم إرسالها.</p>
                         <div style="background:#FFFBF5;border:2px solid #FF8900;border-radius:18px;padding:20px;margin-bottom:20px;">
                           🔑 <strong>ID الطالب:</strong> STU-99203<br>
                           🔐 <strong>كلمة السر:</strong> pass#2026
                         </div>
                         <div style="text-align:center;">
                           <a href="#" style="background:linear-gradient(135deg,#FF8900,#D97300);color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">زر تجريبي لبوابة الطالب ←</a>
                         </div>`,
                        masterLayout
                      )
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMasterLayoutModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all"
              >
                {isAr ? 'إلغاء' : 'Close'}
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveMasterLayoutOnly}
                  disabled={masterSaveLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-900 text-white shadow-md transition-all disabled:opacity-50"
                >
                  {masterSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isAr ? 'حفظ إعدادات الهيدر والفوتر فقط' : 'Save Layout Only'}
                </button>

                <button
                  type="button"
                  onClick={handleApplyMasterLayoutToAll}
                  disabled={masterSaveLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 transform hover:scale-[1.02]"
                >
                  {masterSaveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-purple-200" />
                  )}
                  {isAr ? '✨ تطبيق وتعميم الهيدر والفوتر على جميع القوالب في Firebase' : '✨ Apply to ALL Templates & Sync Firebase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GoogleIntegrations;
