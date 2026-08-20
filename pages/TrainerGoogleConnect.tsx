import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { User, GoogleConnection, EmailTemplate } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToCollection } from '../services/firestore';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getApiEndpoint } from '../lib/apiConfig';
import { 
  ShieldCheck, 
  Calendar, 
  Video, 
  RefreshCw, 
  Unlink, 
  Link2, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Info,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Mail,
  Clock,
  Key,
  ShieldAlert,
  Bell,
  Copy,
  Check
} from 'lucide-react';

interface TrainerGoogleConnectProps {
  user: User;
}

const DEFAULT_TEMPLATES_SUMMARY: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Student Portal Welcome',
    nameAr: 'ترحيب انضمام الطالب وبوابة الطلاب',
    subject: 'مرحباً بك في {group_name} - {course_name}',
    descriptionAr: 'يتم إرساله فور إضافة أو تسكين أي طالب بأي جروب (حتى لو بعد بداية الكورس) متضمناً الـ ID وكلمة السر ورابط البورتال وتنبيه أمني بعدم المشاركة.',
    availableVariables: ['{student_name}', '{group_name}', '{course_name}', '{student_id}', '{student_password}', '{portal_link}'],
    bodyHtml: ''
  },
  {
    id: 'session_reminder',
    name: 'Upcoming Session Reminder',
    nameAr: 'تذكير بموعد المحاضرة القادمة',
    subject: 'تذكير بموعد المحاضرة رقم {session_number} - {group_name}',
    descriptionAr: 'يتم إرسال إيميل قبل المحاضرة بـ 12 ساعة، وإيميل تذكيري آخر قبل المحاضرة بـ 30 دقيقة لتأكيد الجاهزية ورابط Google Meet.',
    availableVariables: ['{student_name}', '{group_name}', '{session_number}', '{session_date}', '{session_time}', '{meet_link}'],
    bodyHtml: ''
  },
  {
    id: 'absence_alert',
    name: 'Absence Warning Alert',
    nameAr: 'تحذير الغياب عن المحاضرات',
    subject: 'تنبيه تسجيل غياب - المحاضرة رقم {session_number}',
    descriptionAr: 'يمكن إرساله يدوياً في أي وقت، أو يرسل تلقائياً إذا تخطى الطالب نسبة 20% غياب بعد أول 4 محاضرات.',
    availableVariables: ['{student_name}', '{group_name}', '{session_number}', '{session_date}'],
    bodyHtml: ''
  },
  {
    id: 'session_changed',
    name: 'Session Rescheduled',
    nameAr: 'إشعار تأجيل / تعديل موعد المحاضرة',
    subject: 'إلغاء / تأجيل المحاضرة رقم {session_number} - {group_name}',
    descriptionAr: 'يتم إرساله تلقائياً للطلاب والمدربين فور ترحيل أو تعديل موعد محاضرة مجدولة بالنظام.',
    availableVariables: ['{student_name}', '{group_name}', '{old_date}', '{new_date}', '{reason}'],
    bodyHtml: ''
  }
];

const TrainerGoogleConnect: React.FC<TrainerGoogleConnectProps> = ({ user }) => {
  const { lang, t } = useLanguage();
  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Subscribe to live Email Templates
  useEffect(() => {
    const unsub = subscribeToCollection<EmailTemplate>(
      'emailTemplates',
      (data) => {
        if (data && data.length > 0) {
          const map = new Map<string, EmailTemplate>();
          DEFAULT_TEMPLATES_SUMMARY.forEach(def => map.set(def.id, def));
          data.forEach(item => {
            const existing = map.get(item.id);
            map.set(item.id, {
              ...existing,
              ...item
            });
          });
          setTemplates(Array.from(map.values()));
        }
      }
    );
    return () => unsub();
  }, []);

  // Check query params for success message after OAuth redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    if (urlParams.get('success') === 'true') {
      const email = urlParams.get('email');
      setActionSuccess(
        lang === 'ar' 
          ? `تم ربط حساب Google (${email || ''}) بنجاح! ✅` 
          : `Google account (${email || ''}) connected successfully! ✅`
      );
      // Clean query string
      window.history.replaceState({}, document.title, window.location.pathname + '#/trainer/google-connect');
    }
  }, [lang]);

  // Subscribe to googleConnections strictly for current trainer
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const unsub = subscribeToCollection<GoogleConnection>(
      'googleConnections',
      (data) => {
        // Filter strictly for current trainer's connections
        const trainerConns = data.filter(c => 
          (c as any).trainerId === user.uid || 
          (c as any).userId === user.uid || 
          c.id === `trainer_${user.uid}` ||
          (c.email && c.email.toLowerCase() === (user.email || '').toLowerCase())
        );
        setConnections(trainerConns);
        setLoading(false);
      },
      [],
      (err) => {
        console.error("Error loading trainer google connection:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, user?.email]);

  const trainerConnection = connections.length > 0 ? connections[0] : null;

  const handleStartOAuth = async () => {
    setConnecting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const returnUrl = encodeURIComponent(`${window.location.origin}/#/trainer/google-connect`);
      const endpoint = getApiEndpoint(`/api/google/auth-url?accountType=trainer&trainerId=${user.uid}&userId=${user.uid}&returnUrl=${returnUrl}`);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل جلب رابط المصادقة من خادم Google');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('لم يتم استقبال رابط المصادقة بشكل صحيح.');
      }
    } catch (err: any) {
      console.error("OAuth Error:", err);
      setActionError(err.message || 'حدث خطأ أثناء الاتصال بـ Google.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!trainerConnection) return;

    const confirmMsg = lang === 'ar' 
      ? 'هل أنت تأكد من إغلاق وإلغاء ربط حساب Google الخاص بك؟ لن تتمكن القاعات التدريبية من إنشاء مواعيد تقويم أو روابط Meet باسمك حتى تعيد الربط.' 
      : 'Are you sure you want to disconnect your Google account? Automatic Google Calendar events and Meet links won\'t be created until you reconnect.';

    if (!window.confirm(confirmMsg)) return;

    setDisconnecting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      // Mark status as disconnected or delete doc
      const docRef = doc(db, 'googleConnections', trainerConnection.id);
      await updateDoc(docRef, {
        status: 'disconnected',
        updatedAt: new Date().toISOString()
      });

      setActionSuccess(
        lang === 'ar' 
          ? 'تم إلغاء ربط حساب Google بنجاح.' 
          : 'Google account disconnected successfully.'
      );
    } catch (err: any) {
      console.error("Disconnect Error:", err);
      setActionError(err.message || 'فشل إلغاء ربط الحساب.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-indigo-700/50">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-indigo-200 border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>{lang === 'ar' ? 'إعدادات ربط المدربين' : 'Trainer Integration Portal'}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                {lang === 'ar' ? `أهلاً بك يا ${user.name || 'المدرب'} 👋` : `Welcome ${user.name || 'Trainer'} 👋`}
              </h1>
              <p className="text-sm text-indigo-200/90 max-w-xl leading-relaxed">
                {lang === 'ar' 
                  ? 'قم بتمكين ربط حساب Google الشخصي لتأكيد حضور محاضراتك، إنشاء مواعيد التقويم وتوليد روابط اجتماعات Google Meet للمجموعات التدريبية المسندة إليك.'
                  : 'Connect your personal Google account to synchronize training schedules, create Google Calendar events, and auto-generate Google Meet links.'}
              </p>
            </div>

            <div className="shrink-0 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
              <div className="text-xs text-indigo-200 mb-1">{lang === 'ar' ? 'المستخدم الحالي' : 'Logged-in User'}</div>
              <div className="font-bold text-sm text-white">{user.email}</div>
              <div className="text-[11px] text-indigo-300/80 mt-0.5">{lang === 'ar' ? 'رتبة: مدرب معتمد' : 'Role: Trainer'}</div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-bold flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-xs hover:underline">✕</button>
          </div>
        )}

        {actionError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm font-bold flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-xs hover:underline">✕</button>
          </div>
        )}

        {/* OAuth Callback Notice & Helper */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-200 text-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-black text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'إعداد هام: رابط إعادة التوجيه (Redirect URI) للحساب' : 'Important Setup: Authorized Redirect URI'}</span>
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
              <span>{copiedCallback ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ رابط الـ Callback' : 'Copy Redirect URI')}</span>
            </button>
          </div>
          <p className="leading-relaxed font-medium text-slate-300">
            {lang === 'ar' 
              ? 'إذا ظهرت رسالة (Error 400: redirect_uri_mismatch)، يرجى إرسال هذا الرابط إلى أدمن النظام لإضافته في Google Cloud Console ➔ Authorized redirect URIs:'
              : 'If you see (Error 400: redirect_uri_mismatch), please provide this URI to your system admin to add in Google Cloud Console:'}
          </p>
          <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 font-mono text-xs font-bold text-amber-300 select-all break-all dir-ltr">
            {`${window.location.origin}/api/google/callback`}
          </div>
        </div>

        {/* Main Status & Action Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              <span>{lang === 'ar' ? 'حالة ربط حساب Google' : 'Google Account Connection Status'}</span>
            </h2>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'ar' ? 'جاري الفحص...' : 'Checking...'}</span>
              </div>
            ) : trainerConnection && trainerConnection.status === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black">
                <CheckCircle2 className="w-4 h-4" />
                <span>{lang === 'ar' ? 'مربوط بنجاح (Connected)' : 'Connected'}</span>
              </span>
            ) : trainerConnection && trainerConnection.status === 'reconnect_required' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black">
                <AlertTriangle className="w-4 h-4" />
                <span>{lang === 'ar' ? 'يلزم إعادة الربط (Reconnect Required)' : 'Reconnect Required'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-black">
                <Unlink className="w-4 h-4" />
                <span>{lang === 'ar' ? 'غير مربوط (Not Connected)' : 'Not Connected'}</span>
              </span>
            )}
          </div>

          {/* Conditional View Based on Connection Status */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
              <p className="text-sm">{lang === 'ar' ? 'جاري جلب إعدادات اتصال Google...' : 'Loading Google Connection settings...'}</p>
            </div>
          ) : !trainerConnection || trainerConnection.status === 'disconnected' ? (
            /* STATE 1: NOT CONNECTED */
            <div className="space-y-8">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 text-amber-200/90 text-sm leading-relaxed space-y-3">
                <div className="font-bold text-amber-400 text-base flex items-center gap-2">
                  <Info className="w-5 h-5 shrink-0" />
                  <span>{lang === 'ar' ? 'تنبيه هائم قبل بدء المزامنة' : 'Important Notice Before Connecting'}</span>
                </div>
                <p>
                  {lang === 'ar'
                    ? 'لإتمام إعداد وتوليد المحاضرات الخاصة بك تلقائياً، يرجى ربط حساب Google الرسمي أو الشخصي الخاص بك بصفتك المدرب المعتمد.'
                    : 'To enable automated lecture scheduling and Google Meet room generation, please connect your authorized Google account.'}
                </p>
              </div>

              {/* Scope Features Explanation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'مواعيد تقويم Google Calendar' : 'Google Calendar Events'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === 'ar'
                      ? 'إنشاء مواعيد المحاضرات المجدولة مباشرة في تقويمك لمنع التضارب التنظيمي وتسهيل متابعتك.'
                      : 'Automatically adds lecture dates to your Google Calendar to keep your schedule organized.'}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                    <Video className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'روابط Google Meet المباشرة' : 'Google Meet Instant Links'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === 'ar'
                      ? 'توليد رابط اجتماع متجدد لكل محاضرة تلقائياً دون الحاجة لإنشائه أو مشاركته يدوياً.'
                      : 'Auto-generates Google Meet video links for every scheduled training session.'}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl w-fit">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'تحديث وتأجيل المحاضرات' : 'Lecture Rescheduling Sync'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === 'ar'
                      ? 'مزامنة وتحديث مواعيد التقويم وروابط الاجتماع فور ترحيل أو تعديل موعد المحاضرة بالنظام.'
                      : 'Keeps Calendar events synced whenever a lecture date is postponed or rescheduled.'}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  {lang === 'ar' ? '🔒 يتم تشفير أسرار الربط خوارزمياً لحماية خصوصية حسابك.' : '🔒 Tokens are encrypted using AES-256.'}
                </div>

                <button
                  onClick={handleStartOAuth}
                  disabled={connecting}
                  className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{lang === 'ar' ? 'جاري التوجيه إلى Google...' : 'Redirecting to Google...'}</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-5 h-5" />
                      <span>{lang === 'ar' ? 'ربط حساب Google Account' : 'Connect Google Account'}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : trainerConnection.status === 'connected' ? (
            /* STATE 2: CONNECTED */
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 text-emerald-400 font-bold text-base">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <span>{lang === 'ar' ? 'تم ربط حساب Google بنجاح ✅' : 'Google Account Connected Successfully ✅'}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">{lang === 'ar' ? 'البريد الإلكتروني المربوط (Google Email)' : 'Connected Google Email'}</span>
                    <span className="font-mono text-sm text-indigo-300 font-bold">{trainerConnection.googleEmail || trainerConnection.email}</span>
                  </div>

                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">{lang === 'ar' ? 'تاريخ الربط الأول' : 'First Connected At'}</span>
                    <span className="text-xs text-slate-300 font-bold">
                      {trainerConnection.createdAt ? new Date(trainerConnection.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : '—'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-emerald-300/80 leading-relaxed">
                  {lang === 'ar'
                    ? 'حسابك جاهز تماماً الآن. عند إضافة أو جدولة محاضرات للجروبات المسندة إليك، سيستخدم النظام هذا الحساب لإنشاء المواعيد وروابط Google Meet تلقائياً.'
                    : 'Your account is ready. Scheduled sessions will use this Google account to generate Calendar events & Meet links.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                <button
                  onClick={handleStartOAuth}
                  disabled={connecting}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-2"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'إعادة ربط الحساب (Reconnect)' : 'Reconnect Account'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl transition-all border border-rose-500/30 flex items-center gap-2"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'إلغاء ربط الحساب (Disconnect)' : 'Disconnect Account'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* STATE 3: RECONNECT REQUIRED */
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl space-y-3 text-amber-300">
                <div className="flex items-center gap-3 font-bold text-base">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
                  <span>{lang === 'ar' ? 'يلزم إعادة ربط حساب Google ⚠️' : 'Google Account Reconnection Required ⚠️'}</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-200/90">
                  {lang === 'ar'
                    ? 'انتهت صلاحية رمز التحديث الحقيقي للحساب أو تم إلغاؤه من إعدادات الأمان. يرجى الضغط على زر "إعادة ربط الحساب" أدناه وتأكيد منح الصلاحيات مجدداً.'
                    : 'The refresh token for this account has expired or been revoked. Please click "Reconnect Account" to grant permissions again.'}
                </p>
                {trainerConnection.email && (
                  <div className="text-xs font-mono font-bold text-amber-400 bg-black/20 p-2 rounded-lg w-fit">
                    {trainerConnection.email}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  onClick={handleStartOAuth}
                  disabled={connecting}
                  className="px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'إعادة ربط الحساب الآن (Reconnect Now)' : 'Reconnect Account Now'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-2"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'حذف هذا الربط' : 'Remove Connection'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* EMAIL SCHEDULE & TEMPLATES SUMMARY FOR TRAINER */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-lg mb-1">
                <Mail className="w-5 h-5" />
                <h2>{lang === 'ar' ? 'جدول ومواعيد إرسال الإيميلات للطلاب' : 'Email Schedules & Templates Summary'}</h2>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'ملخص لحظي للقوالب والمواعيد المعتمدة لإرسال الرسائل والتنبيهات للطلاب عبر البريد الإلكتروني (محدث تلقائياً).'
                  : 'Live summary of operational email triggers and notification templates.'}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{lang === 'ar' ? 'مربوط بالـ Templates المباشرة' : 'Live Synced with Templates'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => {
              let triggerBadge = 'عند الحدث المحدد';
              let timingDetail = tpl.descriptionAr || 'إيميل إشعار تلقائي';
              let icon = <Mail className="w-5 h-5 text-indigo-400" />;

              if (tpl.id === 'welcome_group' || tpl.id === 'welcome') {
                triggerBadge = 'فور الإضافة لأي جروب 🚀';
                timingDetail = 'يُرسل فوراً بمجرد إضافة أو تسكين الطالب بالجروب (حتى بعد بدايته). يتضمن الـ ID وكلمة السر ورابط البورتال وتنبيه أمني بعدم المشاركة.';
                icon = <Key className="w-5 h-5 text-emerald-400" />;
              } else if (tpl.id === 'session_reminder') {
                triggerBadge = 'قبل 12h وقبل 30m ⏰';
                timingDetail = 'تذكير أول قبل المحاضرة بـ 12 ساعة + تذكير ثانٍ قبل المحاضرة بـ 30 دقيقة للاستعداد ورابط Google Meet.';
                icon = <Clock className="w-5 h-5 text-amber-400" />;
              } else if (tpl.id === 'absence_alert') {
                triggerBadge = 'يدوياً أو غياب > 20% ⚠️';
                timingDetail = 'يمكن إرساله يدوياً بضغطة زر، أو يُرسل تلقائياً إذا تخطى الطالب نسبة 20% غياب بعد أول 4 محاضرات.';
                icon = <ShieldAlert className="w-5 h-5 text-rose-400" />;
              } else if (tpl.id === 'session_changed') {
                triggerBadge = 'فور تعديل الموعد 📅';
                timingDetail = 'يُرسل تلقائياً فور ترحيل أو إلغاء أو تغيير موعد محاضرة بالنظام.';
                icon = <Bell className="w-5 h-5 text-cyan-400" />;
              }

              return (
                <div key={tpl.id} className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                          {icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{tpl.nameAr || tpl.name}</h3>
                          <span className="text-[11px] font-mono text-indigo-300/80">{tpl.id}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold rounded-lg shrink-0">
                        {triggerBadge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300/90 leading-relaxed pt-1">
                      {timingDetail}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-900 space-y-1.5">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{lang === 'ar' ? 'عنوان الرسالة:' : 'Subject:'}</span>
                      <span className="text-slate-300 font-bold truncate max-w-[200px]">{tpl.subject}</span>
                    </div>
                    {tpl.availableVariables && tpl.availableVariables.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tpl.availableVariables.map(v => (
                          <span key={v} className="px-1.5 py-0.5 bg-slate-900 text-slate-400 text-[10px] font-mono rounded border border-slate-800">
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TrainerGoogleConnect;
