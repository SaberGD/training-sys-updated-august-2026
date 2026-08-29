
import React, { useState } from 'react';
import { User, UserRole, RolePermissions } from '../types';
import Layout from '../components/Layout';
import { usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';

const PermissionsPage: React.FC<{ user: User }> = ({ user }) => {
  const { rolePermissions, updatePermissions, hiddenPages, updatePageVisibility } = usePermissions();
  const { t, lang } = useLanguage();
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'permissions' | 'pages'>('permissions');

  const roles: UserRole[] = ['supervisor', 'coordinator', 'team_leader', 'trainer'];
  
  const permissionLabels: Record<keyof RolePermissions['permissions'], string> = {
    viewDashboard: 'View Dashboard',
    viewUsers: 'View Users List',
    viewCourses: 'View Courses',
    viewGroups: 'View Groups',
    viewStudents: 'View Students',
    viewMarketing: 'View Marketing Resources',
    viewWeeklySchedule: 'View Weekly Schedule',
    viewExports: 'View Exports',
    viewActivityLog: 'View Activity Log',
    viewTasks: 'View Tasks Module',
    createTasks: 'Create/Assign Tasks',
    manageTemplates: 'Manage Daily Templates',
    viewAllReports: 'View All Trainer Reports',
    submitDailyReport: 'Submit Daily Report',
    manageGroups: 'Create/Edit Groups',
    manageCourses: 'Create/Edit Courses',
    manageStudents: 'Create/Edit Students',
    manageUsers: 'Manage User Accounts',
    viewRanking: 'View Student Rankings',
    manageEvaluations: 'Submit Evaluations',
    viewPerformanceReports: 'View Performance Reports',
    submitPerformanceReport: 'Submit Performance Report',
    approvePerformanceReport: 'Approve Performance Report',
    viewFollowUpSuggestions: lang === 'ar' ? 'عرض اقتراحات المتابعة' : 'View Follow-up Suggestions',
    approveFollowUpSuggestion: lang === 'ar' ? 'اعتماد اقتراح متابعة' : 'Approve Follow-up Suggestion',
    resolveFollowUp: lang === 'ar' ? 'إغلاق/إعادة فتح متابعة' : 'Resolve/Reopen Follow-up',
    approveFollowUpReschedule: lang === 'ar' ? 'اعتماد جدولة متابعة تالية' : 'Approve Follow-up Reschedule',
    escalateFollowUp: lang === 'ar' ? 'تصعيد متابعة للإدارة' : 'Escalate Follow-up to Admin'
  };

  const controllablePages = [
    { name: lang === 'ar' ? 'المهام والتاكات' : 'Tasks Module', nameAr: 'المهام والتاكات (Tasks)', path: '/tasks', icon: '✅', desc: lang === 'ar' ? 'تمكن المستخدمين من إسناد واستعراض والتعليق على المهام اليومية والمستمرة والتقارير.' : 'Enables users to assign, view, and comment on daily and ongoing tasks.' },
    { name: lang === 'ar' ? 'الشكاوى والاستفسارات' : 'Complaints Module', nameAr: 'الشكاوى (Complaints)', path: '/complaints', icon: '⚠️', desc: lang === 'ar' ? 'تتيح للمستخدمين تقديم الشكاوى والاقتراحات والاعتراضات ومتابعتها.' : 'Enables trainers/coordinators to submit and follow up on complaints.' },
    { name: lang === 'ar' ? 'تقارير الأداء' : 'Performance Reports', nameAr: 'تقارير الأداء (Performance Reports)', path: '/performance-reports', icon: '📈', desc: lang === 'ar' ? 'تقارير أداء ومتابعة الحضور والتقويم اليومي والأسبوعي للمحاضرين.' : 'Performance reporting, daily/weekly status tracking, and logs for trainers.' },
    { name: lang === 'ar' ? 'مؤشرات أداء المدربين' : 'Trainer KPIs', nameAr: 'مؤشرات أداء المدربين (Trainer KPIs)', path: '/trainer-kpis', icon: '🏆', desc: lang === 'ar' ? 'حساب وعرض التقييمات الشهرية ومؤشرات الأداء للمحاضرين والمدربين.' : 'Monthly evaluations, ratings, and key performance indicators of instructors.' },
    { name: lang === 'ar' ? 'المواد التسويقية' : 'Marketing Resources', nameAr: 'المواد التسويقية (Marketing Resources)', path: '/marketing', icon: '📁', desc: lang === 'ar' ? 'مستودع ملفات وتصنيفات للمواد الإعلانية ومحتوى التسويق الخاص بالأكاديمية.' : 'File repository for curriculum materials and academy advertisement items.' },
    { name: lang === 'ar' ? 'جدول الحصص الأسبوعي' : 'Weekly Schedule', nameAr: 'جدول الحصص الأسبوعي (Weekly Schedule)', path: '/weekly-schedule', icon: '📅', desc: lang === 'ar' ? 'منصة عرض وتنظيم حجز القاعات وتنظيم المجموعات الأسبوعية.' : 'Weekly agenda view, room reservations, and session plans.' },
    { name: lang === 'ar' ? 'سجل النشاطات بالسيستم' : 'Activity Log', nameAr: 'سجل النشاطات (Activity Log)', path: '/activity-log', icon: '📜', desc: lang === 'ar' ? 'تتبع العمليات المسجلة داخل النظام من إضافة وتعديل وحذف.' : 'Audit logs tracking workspace mutations like inserts, updates, and deletes.' },
    { name: lang === 'ar' ? 'تصدير البيانات خارج النظام' : 'Data Exports', nameAr: 'تصدير البيانات (Exports)', path: '/exports', icon: '📤', desc: lang === 'ar' ? 'تصدير جداول الطلاب والبيانات الإحصائية لمجموعات التدريب.' : 'Exporting tables and student listings outside the portal.' },
    { name: lang === 'ar' ? 'العلامات وتصنيف المتابعة' : 'Labels Manager', nameAr: 'العلامات والتصنيفات (Labels)', path: '/labels', icon: '🏷️', desc: lang === 'ar' ? 'إدارة وتخصيص بطاقات المتابعة والوسوم الملونة للطلاب.' : 'Create and assign custom tracking tags and labels for students.' }
  ];

  const handleToggle = async (role: UserRole, key: keyof RolePermissions['permissions']) => {
    const currentPerms = rolePermissions[role];
    if (!currentPerms) return;

    const newPerms = {
      ...currentPerms,
      [key]: !currentPerms[key]
    };

    setSaving(role);
    try {
      await updatePermissions(role, newPerms);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handlePageVisibilityToggle = async (path: string) => {
    const isCurrentlyHidden = hiddenPages.includes(path);
    const updatedHidden = isCurrentlyHidden
      ? hiddenPages.filter(p => p !== path)
      : [...hiddenPages, path];
    
    setSaving('pages');
    try {
      await updatePageVisibility(updatedHidden);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Layout user={user}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
              {lang === 'ar' ? 'الصلاحيات والتحكم في الصفحات' : 'Permissions & Pages Control'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {lang === 'ar' 
                ? 'إدارة صلاحيات مستخدمي النظام والتحكم في تفعيل أو إخفاء الصفحات المختلفة مؤقتاً.' 
                : 'Manage system roles permission schema and dynamically scale or hide page views.'}
            </p>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit self-start md:self-center select-none">
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeTab === 'permissions'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              🔐 {lang === 'ar' ? 'صلاحيات الأدوار' : 'Role Permissions'}
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeTab === 'pages'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              📄 {lang === 'ar' ? 'التحكم في الصفحات' : 'Pages Visibility'}
            </button>
          </div>
        </div>

        {activeTab === 'permissions' ? (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {roles.map(role => {
                const perms = rolePermissions[role];
                if (!perms) return null;

                return (
                  <div key={role} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-black tracking-tight uppercase text-primary-600">
                          {role.replace('_', ' ')}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {saving === role ? 'Saving changes...' : 'Role Permissions'}
                        </p>
                      </div>
                      {saving === role && <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    
                    <div className="p-6 space-y-3 flex-1 overflow-y-auto max-h-[600px] no-scrollbar">
                      {(Object.keys(permissionLabels) as Array<keyof RolePermissions['permissions']>).map(key => (
                        <div 
                          key={key}
                          onClick={() => handleToggle(role, key)}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group ${
                            perms[key] 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' 
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <span className={`text-xs font-bold ${perms[key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {permissionLabels[key]}
                          </span>
                          <div className={`w-10 h-5 rounded-full relative transition-all ${perms[key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${perms[key] ? 'right-1' : 'left-1'}`}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-3xl">
              <div className="flex gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">{t('adminRoleNoteTitle' as any)}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                    {t('adminRoleNoteText' as any)}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  {lang === 'ar' ? '💡 معلومات التحكم بالصفحات' : '💡 Pages Visibility Information'}
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-300 leading-relaxed max-w-3xl">
                  {lang === 'ar'
                    ? 'يمكنك هنا إخفاء أو إظهار الصفحات المختلفة من القائمة الجانبية فوراً. في حالة إيقاف صفحة معينة (مثل صفحة المهام)، فستختفي نهائياً من شريط التنقل الجانبي لجميع المستخدمين عدا حسابك الشخصي (الأدمن) لكي تتمكن دوماً من إدارتها وإعادتها للعمل بأي وقت.'
                    : 'Toggle standard application views from the sidebar navigation. Disabling a page hides it for everyone except you (the system admin), so you can manage layout states securely.'}
                </p>
              </div>
              {saving === 'pages' && (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">جاري الحفظ...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {controllablePages.map((page) => {
                const isHidden = hiddenPages.includes(page.path);
                return (
                  <div
                    key={page.path}
                    onClick={() => handlePageVisibilityToggle(page.path)}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between group hover:scale-[1.01] active:scale-[0.99] select-none ${
                      isHidden
                        ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/20 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform">
                            {page.icon}
                          </span>
                          <div>
                            <h3 className={`text-sm font-black tracking-tight ${isHidden ? 'text-red-900 dark:text-red-400 text-opacity-80' : 'text-slate-900 dark:text-white'}`}>
                              {lang === 'ar' ? page.nameAr : page.name}
                            </h3>
                            <span className="text-[9px] font-mono font-bold tracking-tight text-slate-400">
                              {page.path}
                            </span>
                          </div>
                        </div>
                        
                        {/* Custom Switch Toggle */}
                        <div className={`w-11 h-6 rounded-full p-1 transition-all ${!isHidden ? 'bg-indigo-600' : 'bg-rose-500/20 dark:bg-rose-950/60'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${!isHidden ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                      
                      <p className={`text-xs leading-relaxed ${isHidden ? 'text-red-800/60 dark:text-red-500/50' : 'text-slate-500 dark:text-slate-400'}`}>
                        {page.desc}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px]">
                      <span className={`font-black uppercase tracking-wider ${isHidden ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {isHidden 
                          ? (lang === 'ar' ? '🔴 مخفية مؤقتاً للعامة' : '🔴 Temporarily Hidden') 
                          : (lang === 'ar' ? '🟢 نشطة ومتاحة للجميع' : '🟢 Active & Available')}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {lang === 'ar' ? 'انقر للتغيير' : 'Click to Toggle'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PermissionsPage;
