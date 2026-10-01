
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, LockKeyhole, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sg-os-shell sg-login-page">
      <header className="sg-login-topbar">
        <div className="sg-login-brand">
          <img src="/saber-group-logo.png" alt="Saber Group" />
          <div>
            <span>TRAINING OPERATIONS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="sg-login-security">
            <ShieldCheck size={15} />
            <span>AUTHORIZED STAFF ACCESS</span>
          </div>
          <div className="sg-theme-switch" role="group" aria-label="Choose theme">
            <button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')} title="Light mode" aria-label="Light mode" aria-pressed={theme === 'light'}><Sun size={16} /></button>
            <button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => setTheme('dark')} title="Dark mode" aria-label="Dark mode" aria-pressed={theme === 'dark'}><Moon size={16} /></button>
          </div>
        </div>
      </header>

      <main className="sg-login-stage">
        <section className="sg-login-intro" aria-label="Training system introduction">
          <div className="sg-kicker"><span /> SG TRAINING OS / 2026</div>
          <h1>ACADEMY<br /><em>OPERATIONS</em></h1>
          <p>إدارة المجموعات، الحضور، التقييمات والرحلة التدريبية من مساحة عمل واحدة.</p>
          <div className="sg-system-readout">
            <span><i /> SYSTEM READY</span>
            <span>FIREBASE SYNC</span>
            <span>ROLE BASED ACCESS</span>
          </div>
        </section>

        <section className="sg-login-card sg-cut-panel">
          <div className="sg-panel-index">ACCESS / 01</div>
          <div className="sg-login-card-head">
            <span>WELCOME BACK</span>
            <h2>دخول فريق صابر جروب</h2>
            <p>استخدم حساب الإدارة أو التدريب المسجل على النظام.</p>
          </div>

          {error && <div className="sg-login-error" role="alert">{error}</div>}

          <form onSubmit={handleLogin} className="sg-login-form">
            <label>
              <span>EMAIL ADDRESS</span>
              <div className="sg-field-shell">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="trainer@sabergroupacademy.com"
                />
              </div>
            </label>
            <label>
              <span>SECRET PASSWORD</span>
              <div className="sg-field-shell">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </div>
            </label>
            <button type="submit" disabled={loading} className="sg-primary-action">
              <span>{loading ? 'AUTHENTICATING...' : 'SIGN IN TO SYSTEM'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="sg-login-meta">
            <span>SECURE SESSION</span>
            <span>sabergroupacademy.com</span>
          </div>
        </section>
      </main>

      <footer className="sg-login-footer">
        Developed by Eng. Mohamed Saber <span /> All rights reserved by SABER GROUP
      </footer>
    </div>
  );
};

export default Login;
