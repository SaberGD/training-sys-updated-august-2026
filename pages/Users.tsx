
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { subscribeToCollection, logActivity, updateUserRole, toggleUserDisabled, updateUserName } from '../services/firestore';
import Layout from '../components/Layout';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
// Fix: Using namespace import for firebase/app to avoid 'no exported member' errors
import * as firebaseApp from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// Fix: Destructure functions from firestore namespace
const { doc, updateDoc, serverTimestamp, setDoc } = firestore as any;

const Users: React.FC<{ user: User }> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editNameInput, setEditNameInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'trainer' as UserRole
  });

  useEffect(() => {
    const unsub = subscribeToCollection<User>('users', setUsers, [], (err) => setError(err.message));
    return () => unsub();
  }, []);

  const handleToggleDisabled = async (uid: string, userName: string, currentState: boolean) => {
    if (confirm(`Are you sure you want to ${currentState ? 'enable' : 'disable'} this user?`)) {
      try {
        setLoading(true);
        await toggleUserDisabled(uid, userName, currentState, user);
        setSuccessMsg(`User ${userName} ${currentState ? 'enabled' : 'disabled'} successfully.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setError(err.message);
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRoleChange = async (uid: string, userName: string, newRole: UserRole) => {
    if (confirm(`Change role to ${newRole}?`)) {
      try {
        setLoading(true);
        await updateUserRole(uid, userName, newRole, user);
        setSuccessMsg(`Role for ${userName} updated to ${newRole}.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setError(err.message);
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (email: string, userName: string) => {
    if (confirm(`Send password reset email to ${userName} (${email})?`)) {
      try {
        setLoading(true);
        const auth = getAuth();
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg(`Password reset email sent to ${userName}.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setError(err.message);
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editNameInput.trim()) return;
    try {
      setLoading(true);
      await updateUserName(editingUser.uid, editingUser.name, editNameInput.trim(), user);
      setSuccessMsg(`تم تحديث اسم المستخدم "${editingUser.name}" إلى "${editNameInput.trim()}" بنجاح.`);
      setEditingUser(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Hostinger/Firebase Config needed for secondary app creation
    const firebaseConfig = {
      apiKey: "AIzaSyDALDGiPJQUOV1FODEC-Wv9lof0fbDI6GI",
      authDomain: "sg-tms-v2.firebaseapp.com",
      projectId: "sg-tms-v2",
      storageBucket: "sg-tms-v2.firebasestorage.app",
      messagingSenderId: "713765974154",
      appId: "1:713765974154:web:59f41edc6ed512a0dd3d73"
    };

    let secondaryApp;
    try {
      // Fix: Access initializeApp from firebaseApp namespace
      secondaryApp = (firebaseApp as any).initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );
      
      const newUid = userCredential.user.uid;

      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        disabled: false,
        createdAt: serverTimestamp()
      });

      await logActivity({
        action: 'USER_CREATE',
        entityType: 'user',
        entityId: newUid,
        entityName: formData.name,
        performedByUid: user.uid,
        performedByName: user.name,
        performedByRole: user.role,
        details: { role: formData.role }
      });

      setSuccessMsg(`User ${formData.name} created successfully.`);
      setFormData({ name: '', email: '', password: '', role: 'trainer' });
      setTimeout(() => setIsModalOpen(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Fix: Access deleteApp from firebaseApp namespace
      if (secondaryApp) await (firebaseApp as any).deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const isAdmin = user.role === 'admin';

  return (
    <Layout user={user}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Users</h1>
          <p className="text-slate-500 font-medium tracking-tight">Manage access, roles, and status for staff members.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span className="text-xl leading-none">+</span> Add User
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {error && <div className="m-6 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{error}</div>}
        {successMsg && <div className="m-6 p-3 bg-green-50 text-green-600 text-xs font-bold rounded-lg border border-green-100">{successMsg}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Name</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Email</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Role</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Status</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.uid} className={`hover:bg-slate-50/50 transition-colors ${u.disabled ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{u.name}</span>
                      {(isAdmin || u.uid === user.uid) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setEditNameInput(u.name);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs"
                          title="تعديل اسم المستخدم"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold">{u.email}</td>
                  <td className="px-6 py-4">
                    <select 
                      disabled={!isAdmin}
                      onChange={(e) => handleRoleChange(u.uid, u.name, e.target.value as UserRole)}
                      value={u.role}
                      className="text-[10px] font-black uppercase border border-slate-200 rounded-lg p-1.5 px-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                    >
                      <option value="trainer">Trainer</option>
                      <option value="team_leader">Team Leader</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                      u.disabled ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {u.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(isAdmin || u.uid === user.uid) && (
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setEditNameInput(u.name);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all flex items-center gap-1"
                        >
                          <span>✏️</span>
                          <span>تعديل الاسم</span>
                        </button>
                      )}
                      {isAdmin && (
                        <button 
                          onClick={() => handleResetPassword(u.email, u.name)}
                          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-blue-100 text-blue-600 hover:bg-blue-50 transition-all"
                          title="Send Password Reset Email"
                        >
                          Reset PW
                        </button>
                      )}
                      {isAdmin && u.uid !== user.uid && (
                        <button 
                          onClick={() => handleToggleDisabled(u.uid, u.name, !!u.disabled)}
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all ${
                            u.disabled ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-white text-red-600 border-red-100 hover:bg-red-50'
                          }`}
                        >
                          {u.disabled ? 'Enable' : 'Disable'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Add System User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{error}</div>}
              {successMsg && <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-lg border border-green-100">{successMsg}</div>}
              
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Full Name</label>
                <input
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Saber Trainer"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Email Address</label>
                <input
                  type="email" required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="trainer@sabergroupacademy.com"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Temporary Password</label>
                <input
                  type="password" required minLength={6}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">System Role</label>
                <select
                  required
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="trainer">Trainer</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="pt-6 border-t flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all border border-slate-100">Cancel</button>
                <button 
                  type="submit" disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit User Name Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <span>✏️</span>
                <span>تعديل اسم المستخدم (Edit Name)</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditNameSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                  الاسم الكامل لـ ({editingUser.email})
                </label>
                <input
                  type="text"
                  required
                  value={editNameInput}
                  onChange={e => setEditNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                  placeholder="ادخل الاسم الجديد هنا..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700 text-xs"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={loading || !editNameInput.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] text-xs"
                >
                  {loading ? 'حفظ...' : 'حفظ الاسم الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Users;