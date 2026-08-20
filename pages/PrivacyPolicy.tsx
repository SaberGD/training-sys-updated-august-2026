import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Lock, CheckCircle2, GraduationCap } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
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
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Privacy Policy</h1>
              <p className="text-xs text-slate-400 font-medium">Last Updated: July 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-sm text-slate-300 leading-relaxed font-normal">
            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                1. Overview
              </h2>
              <p>
                Saber Group Academy ("we", "our", or "us") operates the <strong>Saber Group Training Management System</strong> (<a href="https://training.sabergroupacademy.com" className="text-indigo-400 underline">https://training.sabergroupacademy.com</a>). This Privacy Policy explains how we collect, use, disclose, and safeguard user information when trainers, administrators, and students interact with our platform and integrated Google Services.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                2. Information We Collect
              </h2>
              <p className="mb-3">
                We collect information necessary to deliver training management features:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-2">
                <li><strong>Account Information:</strong> Name, email address, phone number, and user role (Admin, Trainer, Coordinator, Student).</li>
                <li><strong>Training Data:</strong> Course enrollments, group assignments, lecture schedules, session attendance, and progress reports.</li>
                <li><strong>Google Account Data (OAuth):</strong> Email address, basic profile details, and authorization tokens required for Google Calendar and Gmail integrations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                3. Use of Google User Data & OAuth Scopes
              </h2>
              <p className="mb-3">
                Our application requests access to specific Google OAuth scopes strictly for internal educational operational features:
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
                <div>
                  <span className="text-indigo-400 font-bold block mb-1">Google Calendar API (`calendar`, `calendar.events`)</span>
                  <p className="text-slate-400 font-sans">
                    Used exclusively to schedule training lectures, sync group session timetables, and generate Google Meet video conference links for trainers and enrolled students.
                  </p>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <span className="text-indigo-400 font-bold block mb-1">Gmail API (`gmail.send`)</span>
                  <p className="text-slate-400 font-sans">
                    Used exclusively to send transactional training notification emails (e.g., welcome letters, lecture time reminders, weekly student performance updates) from our verified system email account (<span className="text-indigo-300">sabergroup.eg@gmail.com</span>).
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                We do NOT sell, rent, or transfer Google user data to third parties, advertising networks, or data brokers under any circumstances.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                4. Data Protection & Security
              </h2>
              <p>
                All data is stored securely using encrypted cloud database solutions (Google Cloud Firestore). Authorization tokens are encrypted before storage. Access control is strictly enforced via role-based permissions.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                5. Contact Us
              </h2>
              <p>
                If you have any questions or concerns regarding this Privacy Policy or your data, please contact us:
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

export default PrivacyPolicy;
