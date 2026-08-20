
import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

const translations = {
  en: {
    dashboard: 'Dashboard',
    groups: 'Groups',
    students: 'Students',
    users: 'Users',
    courses: 'Courses',
    weeklySchedule: 'Weekly Schedule',
    activityLog: 'Activity Log',
    myGroups: 'My Groups',
    logout: 'Logout',
    evaluation: 'Evaluation',
    ranking: 'Ranking',
    project: 'Project',
    penalties: 'Penalties',
    save: 'Save Changes',
    cancel: 'Cancel',
    exports: 'Exports & Packup',
    fullPackup: 'Full Packup',
    importBackup: 'Import Backup',
    systemActive: 'System Active',
    lecture: 'Lecture',
    attendance: 'Attendance',
    task: 'Task',
    ontime: 'On Time',
    quality: 'Quality',
    redo: 'Redo',
    bonus: 'Bonus',
    score: 'Score',
    restoreWarning: 'Warning: Importing a backup will overwrite existing data. Proceed?',
    restoreSuccess: 'System restored successfully!',
    restoreError: 'Failed to restore system.',
    followUps: 'Follow-ups',
    adminRoleNoteTitle: 'Admin Role Note',
    adminRoleNoteText: 'The **Admin** role is not listed here because it always has full permissions for all system features and cannot be restricted.'
  },
  ar: {
    dashboard: 'لوحة التحكم',
    groups: 'المجموعات',
    students: 'الطلاب',
    users: 'المستخدمين',
    courses: 'الكورسات',
    weeklySchedule: 'الجدول الأسبوعي',
    activityLog: 'سجل النشاطات',
    myGroups: 'مجموعاتي',
    logout: 'تسجيل الخروج',
    evaluation: 'التقييمات',
    ranking: 'الترتيب',
    project: 'المشروع',
    penalties: 'الخصومات',
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    exports: 'التقارير والاستعادة',
    fullPackup: 'تغليف كامل البيانات',
    importBackup: 'استيراد نسخة احتياطية',
    systemActive: 'النظام نشط',
    lecture: 'محاضرة',
    attendance: 'حضور',
    task: 'تاسك',
    ontime: 'في الموعد',
    quality: 'الجودة',
    redo: 'إعادة',
    bonus: 'إضافي',
    score: 'الدرجة',
    restoreWarning: 'تحذير: استيراد النسخة سيؤدي لاستبدال البيانات الحالية. استمرار؟',
    restoreSuccess: 'تم استعادة النظام بنجاح!',
    restoreError: 'فشلت عملية استعادة النظام.',
    followUps: 'المتابعات',
    adminRoleNoteTitle: 'ملاحظة دور المسؤول',
    adminRoleNoteText: 'دور **المسؤول** غير مدرج هنا لأنه يمتلك دائماً صلاحيات كاملة لجميع ميزات النظام ولا يمكن تقييده.'
  }
};

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('saber-lang');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('saber-lang', lang);
  }, [lang]);

  const t = (key: keyof typeof translations.en) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
