import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Calendar, 
  Users, 
  BookOpen, 
  CheckCircle, 
  LogIn, 
  Video, 
  ShieldCheck, 
  Mail, 
  Globe, 
  BarChart3,
  ArrowRight
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-950/92 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight block">SABER GROUP</span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">Training Operations</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-sm transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Login to Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
            <span>Saber Group Academy operations workspace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] mb-5 max-w-4xl">
            Training management built for daily academy operations
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed mb-8 font-medium">
            An integrated platform for managing training courses, groups, sessions, attendance, trainers and students in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-sm transition-colors"
            >
              <span>Login to Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/student/portal"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-sm transition-colors"
            >
              <GraduationCap className="w-5 h-5 text-sky-300" />
              <span>Student Portal</span>
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
            <div className="border border-slate-800 bg-slate-900/70 rounded-lg px-4 py-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">Workflows</span>
              <span className="text-sm text-slate-200 font-semibold">Courses, groups, attendance</span>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 rounded-lg px-4 py-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">Scheduling</span>
              <span className="text-sm text-slate-200 font-semibold">Sessions, Calendar, Meet links</span>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 rounded-lg px-4 py-3">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">Portals</span>
              <span className="text-sm text-slate-200 font-semibold">Admin, trainer, student access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">Core Capabilities</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Powerful Features for Seamless Academy Operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">1. Training Management</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                إدارة الكورسات والجروبات والمحاضرات ومواعيد التدريب الشاملة بكل سهولة ودقة.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">2. Attendance Tracking</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                متابعة حضور الطلاب والتقارير الأسبوعية وتتبع نسبة الالتزام بدقة عالية.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-sky-950 text-sky-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">3. Trainer Management</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                إدارة حسابات المدربين وربط كل مدرب بجروباته وتتبع التقييمات والأداء.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">4. Google Calendar Integration</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                إنشاء ومزامنة مواعيد المحاضرات مع Google Calendar وإنشاء روابط Google Meet تلقائياً.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all group lg:col-span-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">5. Student Management</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                إدارة بيانات الطلاب الكاملة، متابعة تقدمهم الأكاديمي، وتوفير بوابة طالب مخصصة للاطلاع على جدول المحاضرات والمشروعات والتسجيلات.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-950 text-indigo-400 mb-6">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">About Saber Group Academy</h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal max-w-2xl mx-auto">
            "Saber Group Academy provides professional training programs and manages learning experiences through modern technology solutions."
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Get in Touch</h2>
            <p className="text-slate-400 text-sm">Have questions or need assistance? Reach out to our support team.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs text-slate-500 font-bold uppercase">Email Support</span>
                <a href="mailto:sabergroup.eg@gmail.com" className="text-sm font-semibold text-slate-200 hover:text-indigo-400 transition-colors truncate block">
                  sabergroup.eg@gmail.com
                </a>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs text-slate-500 font-bold uppercase">Official Website</span>
                <a href="https://training.sabergroupacademy.com" target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-200 hover:text-blue-400 transition-colors truncate block">
                  training.sabergroupacademy.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-950 border-t border-slate-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Saber Group Academy. All rights reserved.
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
