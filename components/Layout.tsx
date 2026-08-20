
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { User, AppNotification } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { ViewAsContext } from '../App';
import { subscribeToCollection, markNotificationRead } from '../services/firestore';
import * as firestore from 'firebase/firestore';
import { Bell, Check, Eye } from 'lucide-react';
import { GemyChatWidget } from './GemyChatWidget';

const { where, orderBy, limit } = firestore as any;

interface LayoutProps {
  user: User;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { hasPermission, isPageHidden } = usePermissions();
  const { viewAsRole, setViewAsRole, actualRole } = React.useContext(ViewAsContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => localStorage.getItem('header_collapsed') === 'true');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user.uid) return;
    const unsub = subscribeToCollection<AppNotification>(
      'notifications',
      setNotifications,
      [where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10)]
    );
    return () => unsub();
  }, [user.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const isSystemAdmin = user.role === 'admin';

  const menuItems = [
    { label: t('dashboard'), path: '/', icon: '📊', show: hasPermission(user, 'viewDashboard') },
    { label: t('users'), path: '/users', icon: '👥', show: isSystemAdmin },
    { label: 'Permissions', path: '/permissions', icon: '🔐', show: isSystemAdmin },
    { label: lang === 'ar' ? 'ربط Google Integrations 🔗' : 'Google Integrations 🔗', path: '/google-integrations', icon: '🔗', show: isSystemAdmin },
    { label: lang === 'ar' ? 'ربط حساب Google 🔗' : 'Trainer Google Connect 🔗', path: '/trainer/google-connect', icon: '🔑', show: ['trainer', 'team_leader', 'admin'].includes(user.role) },
    { label: t('courses'), path: '/courses', icon: '📚', show: hasPermission(user, 'viewCourses') },
    { label: t('groups'), path: '/groups', icon: '🏢', show: hasPermission(user, 'viewGroups') },
    { label: t('myGroups'), path: '/my-groups', icon: '🏢', show: false },
    { label: t('followUps'), path: '/follow-ups', icon: '🎯', show: true },
    { label: 'Labels', path: '/labels', icon: '🏷️', show: ['admin', 'coordinator'].includes(user.role) },
    { label: 'Tasks', path: '/tasks', icon: '✅', show: hasPermission(user, 'viewTasks') },
    { label: 'Complaints', path: '/complaints', icon: '⚠️', show: true },
    { label: 'Performance Reports', path: '/performance-reports', icon: '📈', show: hasPermission(user, 'viewPerformanceReports') },
    { label: 'Trainer KPIs', path: '/trainer-kpis', icon: '🏆', show: ['admin', 'coordinator', 'team_leader', 'trainer'].includes(user.role) },
    { label: t('students'), path: '/students', icon: '🎓', show: hasPermission(user, 'viewStudents') },
    { label: lang === 'ar' ? 'فهرس وسجلات الطلاب 🔍' : 'Student Directory 🔍', path: '/student-directory', icon: '🔍', show: hasPermission(user, 'viewStudents') },
    { label: lang === 'ar' ? 'بوابة المتدربين 🌐' : 'Student Portal 🌐', path: '/student/portal', icon: '🎓', show: true, target: '_blank' },
    { label: 'Marketing Resources', path: '/marketing', icon: '📁', show: hasPermission(user, 'viewMarketing') },
    { label: t('weeklySchedule'), path: '/weekly-schedule', icon: '📅', show: hasPermission(user, 'viewWeeklySchedule') },
    { label: t('exports'), path: '/exports', icon: '📤', show: hasPermission(user, 'viewExports') },
    { label: t('activityLog'), path: '/activity-log', icon: '📜', show: hasPermission(user, 'viewActivityLog') },
  ].filter(item => {
    if (!item.show) return false;
    // Hide page if disabled by admin, unless current user is admin
    if (isPageHidden(item.path) && user.role !== 'admin') {
      return false;
    }
    return true;
  });

  const currentPage = menuItems.find(m => m.path === location.pathname)?.label || 
                     (location.pathname.startsWith('/groups/') ? t('evaluation') : 'SABER GROUP');

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative ${lang === 'ar' ? 'font-arabic' : ''}`}>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} bg-white dark:bg-slate-900 flex flex-col z-40 transition-all duration-300 transform
        md:relative md:translate-x-0 border-x border-slate-200 dark:border-slate-800
        ${isSidebarCollapsed ? 'w-72 md:w-20' : 'w-72 md:w-72'}
        ${isSidebarOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}
      `}>
        <div className={`p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center transition-all ${isSidebarCollapsed ? 'md:p-4' : 'md:p-8'}`}>
          <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
            <span className="bg-primary-600 p-2 rounded-xl text-xs font-black text-white shrink-0">S</span>
            <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>SABER GROUP</span>
          </h1>
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => {
                const newVal = !isSidebarCollapsed;
                setIsSidebarCollapsed(newVal);
                localStorage.setItem('sidebar_collapsed', String(newVal));
              }}
              className="hidden md:flex w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-black transition-all text-slate-600 dark:text-slate-300"
              title={isSidebarCollapsed ? (lang === 'ar' ? 'توسيع القائمة الجانبية' : 'Expand Sidebar') : (lang === 'ar' ? 'طي القائمة الجانبية' : 'Collapse Sidebar')}
            >
              {isSidebarCollapsed ? (lang === 'ar' ? '◀️' : '▶️') : (lang === 'ar' ? '▶️' : '◀️')}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-2xl text-slate-500 hover:text-slate-900 dark:hover:text-white">&times;</button>
          </div>
        </div>
        
        <nav className={`flex-1 overflow-y-auto space-y-2 no-scrollbar ${isSidebarCollapsed ? 'p-2' : 'py-8 px-4'}`}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                target={item.target}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all group ${
                  isActive 
                  ? 'bg-primary-600 text-white font-black shadow-lg shadow-primary-600/30' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                } ${isSidebarCollapsed ? 'md:justify-center md:px-0 md:h-12 md:w-12 md:mx-auto' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span className="text-xl shrink-0">{item.icon}</span>
                <span className={`text-sm font-semibold tracking-tight transition-all duration-300 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
              </Link>
            );
          })}

          {/* External Link Section */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
             <a
              href="https://mails.sabergroupacademy.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 group ${isSidebarCollapsed ? 'md:justify-center md:px-0 md:h-12 md:w-12 md:mx-auto' : ''}`}
              title={isSidebarCollapsed ? 'youtube bulk adder' : undefined}
            >
              <span className="text-xl shrink-0">📺</span>
              <span className={`text-sm font-black tracking-tight uppercase ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>youtube bulk adder</span>
            </a>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all uppercase tracking-widest border border-transparent hover:border-red-200 dark:hover:border-red-900/50 ${isSidebarCollapsed ? 'md:p-2' : ''}`}
            title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          >
            {isSidebarCollapsed ? '🚪' : t('logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {isHeaderCollapsed && (
          <button
            onClick={() => {
              setIsHeaderCollapsed(false);
              localStorage.setItem('header_collapsed', 'false');
            }}
            className="fixed top-0 left-1/2 transform -translate-x-1/2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-b-2xl shadow-xl z-50 text-[10px] font-black tracking-widest flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 animate-bounce border-t-0 border border-indigo-400/20"
            style={{ direction: 'ltr' }}
          >
            ⬇️ {lang === 'ar' ? 'إظهار الشريط العلوي' : 'Show Top Navbar'}
          </button>
        )}

        <header className={`transition-all duration-300 shrink-0 z-30 ${
          isHeaderCollapsed 
            ? 'h-0 border-b-0 py-0 opacity-0 pointer-events-none overflow-hidden' 
            : 'h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10'
        }`}>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-2xl text-slate-600 dark:text-slate-300">☰</button>
            <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
              {currentPage}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setIsHeaderCollapsed(true);
                localStorage.setItem('header_collapsed', 'true');
              }}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors border border-slate-200 dark:border-slate-700"
              title={lang === 'ar' ? 'إخفاء الشريط العلوي' : 'Collapse Top Navbar'}
            >
              ⬆️
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors border border-slate-200 dark:border-slate-700 relative"
                title="Notifications"
              >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-primary-605 animate-bounce' : 'text-slate-500'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className={`absolute top-full ${lang === 'ar' ? 'left-0' : 'right-0'} mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50`}>
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={() => notifications.filter(n => !n.read).forEach(n => markNotificationRead(n.id))}
                        className="text-[10px] font-black text-primary-600 uppercase tracking-widest"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.link) navigate(n.link);
                          setShowNotifications(false);
                        }}
                        className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer ${!n.read ? 'bg-primary-50/30 dark:bg-primary-950/10' : ''}`}
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-slate-400 mt-2 uppercase font-black">
                          {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-8 text-center text-slate-400">
                        <p className="text-xs font-bold uppercase tracking-widest">No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-black hover:bg-primary-50 dark:hover:bg-primary-950 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
              title="Switch Language"
            >
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>

            <button 
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors border border-slate-200 dark:border-slate-700 font-sans"
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {actualRole === 'admin' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 select-none">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 items-center gap-1.5 hidden xl:flex">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'عرض كـ:' : 'View:'}</span>
                </span>
                <button 
                  onClick={() => setViewAsRole(null)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${!viewAsRole ? 'bg-white dark:bg-slate-955 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title={lang === 'ar' ? 'عرض كـ مدير النظام' : 'View as Administrator'}
                >
                  {lang === 'ar' ? 'أدمن' : 'Admin'}
                </button>
                <button 
                  onClick={() => setViewAsRole('coordinator')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${viewAsRole === 'coordinator' ? 'bg-white dark:bg-slate-955 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title={lang === 'ar' ? 'عرض كـ منسق' : 'View as Coordinator'}
                >
                  {lang === 'ar' ? 'منسق' : 'Coord'}
                </button>
                <button 
                  onClick={() => setViewAsRole('team_leader')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${viewAsRole === 'team_leader' ? 'bg-white dark:bg-slate-955 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title={lang === 'ar' ? 'عرض كـ قائد فريق' : 'View as Team Leader'}
                >
                  {lang === 'ar' ? 'قائد' : 'TL'}
                </button>
                <button 
                  onClick={() => setViewAsRole('trainer')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${viewAsRole === 'trainer' ? 'bg-white dark:bg-slate-955 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title={lang === 'ar' ? 'عرض كـ مدرب' : 'View as Trainer'}
                >
                  {lang === 'ar' ? 'مدرب' : 'Trainer'}
                </button>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('systemActive')}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-7xl mx-auto animate-fade-in flex flex-col min-h-full">
            <div className="flex-1">
              {children}
            </div>
            
            {/* Elegant Branded Footer */}
            <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-400 dark:text-slate-550 font-medium">
              <div className="flex flex-col gap-1 items-center sm:items-start select-none">
                <p className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Developed by Eng: <span className="text-primary-600 dark:text-primary-400">Mohamed Saber</span>
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400/70">
                  All rights reserved by Saber Group Courses Academy
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href="https://wa.me/201024689480" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-8.5 h-8.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-emerald-500/20 shadow-sm"
                  title="Contact Eng. Mohamed Saber on WhatsApp"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.588 1.45 5.374 1.451 5.4 0 9.791-4.39 9.795-9.792.002-2.618-1.01-5.079-2.859-6.93C17.06 2.03 14.605.992 11.994.992 6.59.992 2.198 5.383 2.193 10.786c-.001 1.905.497 3.766 1.444 5.394L2.656 21.8l5.803-1.522c1.55.845 3.28 1.289 5.011 1.29h.178z"/>
                  </svg>
                </a>
                <a 
                  href="https://www.facebook.com/MS.GD.FL/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-8.5 h-8.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-blue-500/20 shadow-sm"
                  title="Follow on Facebook"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                  </svg>
                </a>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* MARO AI Assistant Widget */}
      <GemyChatWidget staffUser={user} />
    </div>
  );
};

export default Layout;
