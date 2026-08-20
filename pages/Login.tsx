
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4"></div>

      <div className="mb-12 text-center relative z-10">
        <div className="bg-primary-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary-600/40">
          <span className="text-4xl font-black text-white">S</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter mb-2">SABER GROUP</h1>
        <p className="text-slate-500 font-black uppercase tracking-[0.3rem] text-[10px]">Training management system</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-4xl shadow-2xl p-10 relative z-10 border border-white/5">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Welcome Back</h2>
          <p className="text-sm font-medium text-slate-500">Log in to manage your training sessions.</p>
        </div>
        
        {error && (
          <div className="mb-8 p-5 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 font-black uppercase tracking-widest text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 outline-none transition-all font-bold text-sm"
              placeholder="trainer@sabergroupacademy.com"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secret Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 outline-none transition-all font-bold text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2rem] hover:bg-primary-700 active:scale-95 transition-all shadow-2xl shadow-primary-600/30 disabled:opacity-50 mt-4"
          >
            {loading ? 'Authenticating...' : 'Sign In Now'}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
            Authorized Access Only<br/>
            <span className="text-primary-600 mt-1 block">sabergroupacademy.com</span>
          </p>
        </div>
      </div>
      
      <p className="mt-10 text-slate-600 text-[10px] font-black uppercase tracking-widest opacity-50 relative z-10">
        &copy; 2025 Saber Group Academy. All rights reserved.
      </p>
    </div>
  );
};

export default Login;