import React, { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

const { doc, updateDoc, serverTimestamp } = firestore as any;

const DEFAULT_PASSWORD = '123456';

// Shown after an admin reset the user's password to the default:
// the user cannot use the system until they choose a new password.
const ForcePasswordChange: React.FC<{ user: User; onDone: () => void }> = ({ user, onDone }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) return setError('كلمة السر لازم تكون 6 أحرف على الأقل.');
    if (newPassword === DEFAULT_PASSWORD) return setError('اختار كلمة سر مختلفة عن الافتراضية (123456).');
    if (newPassword !== confirmPassword) return setError('كلمتين السر مش متطابقين.');

    const fbUser = auth.currentUser;
    if (!fbUser) return setError('انتهت الجلسة، سجّل الدخول مرة أخرى.');

    setLoading(true);
    try {
      try {
        await updatePassword(fbUser, newPassword);
      } catch (err: any) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email!, DEFAULT_PASSWORD));
        await updatePassword(fbUser, newPassword);
      }
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false,
        passwordChangedAt: serverTimestamp()
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-slate-950 font-[Cairo,Tajawal,sans-serif]">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h1 className="text-xl font-black text-slate-800 dark:text-white">🔐 تعيين كلمة سر جديدة</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-bold">
            أهلاً {user.name}، تم إعادة تعيين كلمة السر الخاصة بك. من فضلك اختار كلمة سر جديدة للمتابعة.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{error}</div>}
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5">كلمة السر الجديدة</label>
            <input
              type="password" required minLength={6} autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5">تأكيد كلمة السر</label>
            <input
              type="password" required minLength={6} autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
            >
              تسجيل الخروج
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 text-xs"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ كلمة السر'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
