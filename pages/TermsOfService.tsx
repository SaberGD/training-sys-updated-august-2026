import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Mail, CheckCircle2, GraduationCap } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm text-white">SABER GROUP ACADEMY</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Terms of Service</h1>
              <p className="text-xs text-slate-400 font-medium">Last Updated: July 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-sm text-slate-300 leading-relaxed font-normal">
            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the <strong>Saber Group Training Management System</strong> (<a href="https://training.sabergroupacademy.com" className="text-indigo-400 underline">https://training.sabergroupacademy.com</a>), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                2. User Accounts & Responsibilities
              </h2>
              <p className="mb-2">
                Accounts on the Saber Group Training Management System are issued to authorized administrators, trainers, team leaders, and enrolled students.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                <li>Users are responsible for maintaining the security of their credentials.</li>
                <li>Unauthorized sharing of platform access or course content is strictly prohibited.</li>
                <li>Trainers agree to use connected Google Calendar and Google Meet features solely for official academy training sessions.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                3. Intellectual Property
              </h2>
              <p>
                All course materials, training schedules, software interfaces, and branding logos are the exclusive property of Saber Group Academy. Unauthorized copying or redistribution is prohibited.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                4. Service Availability & Modifications
              </h2>
              <p>
                We reserve the right to modify or update features, schedules, or platform interfaces at any time to improve system security and educational delivery.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                5. Contact Information
              </h2>
              <p>
                For questions regarding these Terms of Service, please contact:
              </p>
              <div className="mt-2 text-slate-300 font-medium">
                Email: <a href="mailto:sabergroup.eg@gmail.com" className="text-indigo-400 hover:underline">sabergroup.eg@gmail.com</a><br />
                Website: <a href="https://training.sabergroupacademy.com" className="text-indigo-400 hover:underline">https://training.sabergroupacademy.com</a>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Saber Group Academy. All rights reserved.
      </footer>
    </div>
  );
};

export default TermsOfService;
