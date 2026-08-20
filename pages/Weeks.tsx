
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Week } from '../types';
import { subscribeToCollection, saveWeek, archiveWeek, restoreWeek, deleteWeekPermanently } from '../services/firestore';
import Layout from '../components/Layout';
import * as firestore from 'firebase/firestore';

const { orderBy } = firestore as any;

const WeeksPage: React.FC<{ user: User }> = ({ user }) => {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [weekToDelete, setWeekToDelete] = useState<Week | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const isStaff = ['admin', 'coordinator', 'team_leader'].includes(user.role);

  useEffect(() => {
    const unsub = subscribeToCollection<Week>('weeks', setWeeks, [orderBy('startDate', 'desc')]);
    return () => unsub();
  }, []);

  const handleCreateWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return;
    
    const title = formData.title || `Week Plan ${formData.startDate}`;
    await saveWeek({ ...formData, title, status: 'active' }, user);
    setIsCreateModalOpen(false);
    setFormData({ title: '', startDate: new Date().toISOString().split('T')[0] });
  };

  const handleArchive = async (id: string) => {
    if (!isStaff) return;
    await archiveWeek(id, user);
  };

  const handleRestore = async (id: string) => {
    if (!isStaff) return;
    await restoreWeek(id, user);
  };

  const openDeleteModal = (week: Week) => {
    setWeekToDelete(week);
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!weekToDelete || deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteWeekPermanently(weekToDelete.id, user);
      setIsDeleteModalOpen(false);
      setWeekToDelete(null);
    } catch (err: any) {
      alert("Error during deletion: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeWeeks = weeks.filter(w => w.status === 'active');
  const archivedWeeks = weeks.filter(w => w.status === 'archived');

  return (
    <Layout user={user}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">Weekly Scheduling</h1>
          <p className="text-slate-500 font-medium">Manage and plan multi-week training schedules.</p>
        </div>
        {isStaff && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-600/20 active:scale-95 transition-all"
          >
            + Create New Week
          </button>
        )}
      </div>

      <div className="space-y-16">
        {/* Active Plans Section */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-1.5 h-6 bg-primary-600 rounded-full"></span>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[3px]">Active Plans ({activeWeeks.length})</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeWeeks.map(week => (
              <div key={week.id} className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary-100 transition-all group flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-primary-100">
                      Live Plan
                    </span>
                    {isStaff && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleArchive(week.id)}
                          className="p-2.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                          title="Archive Plan"
                        >
                          📦
                        </button>
                        <button 
                          onClick={() => openDeleteModal(week)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Plan"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tighter group-hover:text-primary-600 transition-colors">{week.title}</h3>
                  <p className="text-xs font-black text-slate-400 mb-8 uppercase tracking-widest flex items-center gap-2">
                    📅 {week.startDate} → {week.endDate}
                  </p>
                </div>
                
                <Link 
                  to={`/weekly-schedule/${week.id}`}
                  className="w-full text-center py-4 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  View Schedule Details
                </Link>
                <div className="absolute bottom-0 left-0 h-1 w-full bg-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </div>
            ))}
            {activeWeeks.length === 0 && (
              <div className="col-span-full py-24 text-center bg-white rounded-4xl border-2 border-dashed border-slate-200 text-slate-400">
                 <p className="font-black uppercase tracking-widest text-[10px]">No active week plans found</p>
              </div>
            )}
          </div>
        </section>

        {/* Archived Plans Section */}
        <section className="pt-12 border-t border-slate-100">
          <div className="flex items-center gap-4 mb-8">
            <span className="w-1.5 h-6 bg-slate-400 rounded-full"></span>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[3px]">Archived Plans ({archivedWeeks.length})</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {archivedWeeks.map(week => (
              <div key={week.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-none opacity-60 grayscale-[0.8] hover:grayscale-0 hover:opacity-100 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-300">
                      Archived
                    </span>
                    {isStaff && (
                      <button 
                        onClick={() => openDeleteModal(week)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-all"
                        title="Permanently Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-slate-600 mb-1 group-hover:text-slate-900 transition-colors">{week.title}</h3>
                  <p className="text-[10px] font-black text-slate-400 mb-8 uppercase tracking-widest">
                    📅 {week.startDate} → {week.endDate}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Link 
                    to={`/weekly-schedule/${week.id}`}
                    className="w-full text-center py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                  >
                    View (Read-Only)
                  </Link>
                  {isStaff && (
                    <button 
                      onClick={() => handleRestore(week.id)}
                      className="w-full py-3 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                    >
                      Restore Plan
                    </button>
                  )}
                </div>
              </div>
            ))}
            {archivedWeeks.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest italic">
                Archive is empty.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Create Week Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-4xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Plan New Week</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-3xl text-slate-400 hover:text-slate-900 transition-colors">&times;</button>
            </div>
            <form onSubmit={handleCreateWeek} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Plan Title</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all font-bold text-sm"
                  placeholder="e.g. Finals Week Revision"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Start Date</label>
                <input 
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all font-bold text-sm"
                />
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-primary-600 text-white font-black rounded-2xl shadow-xl shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all text-[10px] uppercase tracking-widest">
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-white rounded-4xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-red-50 bg-red-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-red-800 tracking-tighter">Delete Weekly Plan</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-3xl text-red-300 hover:text-red-600 transition-colors">&times;</button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl">
                <p className="text-xs text-amber-800 font-black leading-relaxed uppercase tracking-tight">
                  ⚠️ This action is irreversible. All scheduled items and day plans for this week will be PERMANENTLY DELETED.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">To confirm deletion, type DELETE below:</p>
                <input 
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-red-100 bg-red-50 outline-none text-center font-black text-xl text-red-600 tracking-[0.5rem] focus:ring-4 focus:ring-red-500/10 transition-all"
                  placeholder="DELETE"
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  disabled={isDeleting}
                  className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all ${
                    deleteConfirmText === 'DELETE' 
                    ? 'bg-red-600 text-white shadow-xl shadow-red-500/30 active:scale-95' 
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isDeleting ? 'Processing...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WeeksPage;
