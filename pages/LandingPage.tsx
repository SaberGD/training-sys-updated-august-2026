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
  Sparkles,
  ArrowRight
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight block">SABER GROUP</span>
              <span className="text-[10px] font-semibold text-indigo-400 tracking-wider uppercase block">Training Management System</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              <span>Login to Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-semibold mb-8 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Saber Group Academy - Modern Education Tech</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.15] mb-6">
            Saber Group <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-sky-300 bg-clip-text text-transparent">
              Training Management System
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-medium">
            An integrated platform for managing training courses, groups, sessions, attendance, trainers and students in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-base shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Login to Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/student/portal"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-base transition-all"
            >
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              <span>Student Portal</span>
            </Link>
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
