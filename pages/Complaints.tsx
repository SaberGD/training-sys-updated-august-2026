import React, { useState, useEffect } from 'react';
import * as firestore from 'firebase/firestore';
import { 
  subscribeToCollection, 
  saveComplaint, 
  deleteComplaint
} from '../services/firestore';
import { User, Group, Student, Complaint, ComplaintStatus } from '../types';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Plus, 
  Search, 
  Trash2, 
  UserPlus,
  MessageSquare,
  Users as UsersIcon,
  Edit2
} from 'lucide-react';

const Complaints: React.FC<{ user: User }> = ({ user }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('active');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const [formData, setFormData] = useState<Partial<Complaint>>({
    studentId: '',
    groupId: '',
    problem: '',
    assignedTo: '',
    status: 'active'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubComplaints = subscribeToCollection<Complaint>('complaints', setComplaints, [firestore.orderBy('createdAt', 'desc'), firestore.limit(50)]);
    const unsubStudents = subscribeToCollection<Student>('students', setStudents);
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    const unsubUsers = subscribeToCollection<User>('users', setUsers);
    
    setLoading(false);
    return () => {
      unsubComplaints();
      unsubStudents();
      unsubGroups();
      unsubUsers();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.groupId || !formData.problem) return;

    const student = students.find(s => s.id === formData.studentId);
    const group = groups.find(g => g.id === formData.groupId);
    const assignee = users.find(u => u.uid === formData.assignedTo);

    await saveComplaint({
      ...formData,
      id: editingId || undefined,
      studentName: student?.name || 'Unknown',
      groupName: group?.name || 'Unknown',
      assignedToName: assignee?.name || (formData.assignedTo ? 'Unknown' : 'غير موجهة')
    }, user);

    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ studentId: '', groupId: '', problem: '', assignedTo: '', status: 'active' });
  };

  const handleEdit = (complaint: Complaint) => {
    setEditingId(complaint.id);
    setFormData({
      studentId: complaint.studentId,
      groupId: complaint.groupId,
      problem: complaint.problem,
      assignedTo: complaint.assignedTo || '',
      status: complaint.status
    });
    setIsModalOpen(true);
  };

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = (c.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (c.problem || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesGroup = groupFilter === 'all' || c.groupId === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'active': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'in_progress': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'resolved': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Student Complaints</h1>
            <p className="text-slate-400 text-sm">Manage and track student issues and feedback</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={18} />
            New Complaint
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search complaints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select 
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredComplaints.map(complaint => (
              <motion.div 
                key={complaint.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{complaint.studentName}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <UsersIcon size={12} /> {complaint.groupName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${getStatusColor(complaint.status)}`}>
                      {complaint.status.replace('_', ' ')}
                    </span>
                    <div className="text-[8px] text-slate-500 font-bold text-right">
                      <p>بواسطة: {complaint.createdByName}</p>
                      <p>{complaint.createdAt?.toDate ? complaint.createdAt.toDate().toLocaleString('ar-EG') : ''}</p>
                    </div>
                  </div>
                </div>

                <p className="text-slate-300 text-sm line-clamp-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 italic">
                  "{complaint.problem}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                      {(complaint.assignedToName || 'غ').charAt(0)}
                    </div>
                    <div className="text-[10px]">
                      <p className="text-slate-500 uppercase font-black tracking-tighter">موجهة إلى</p>
                      <p className="text-slate-300 font-bold">{complaint.assignedToName || 'غير موجهة'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={complaint.status}
                      onChange={(e) => saveComplaint({ id: complaint.id, status: e.target.value as any }, user)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    {(user.role === 'admin' || complaint.createdBy === user.uid) && (
                      <button 
                        onClick={() => handleEdit(complaint)}
                        className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                        title="تعديل الشكوى"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {user.role === 'admin' && (
                      <button 
                        onClick={() => { if(window.confirm('Delete this complaint?')) deleteComplaint(complaint.id, user); }}
                        className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* New/Edit Complaint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-xl font-black text-white mb-6">{editingId ? 'تعديل الشكوى' : 'تسجيل شكوى جديدة'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">المجموعة</label>
                <select 
                  required
                  value={formData.groupId}
                  onChange={(e) => setFormData({ ...formData, groupId: e.target.value, studentId: '' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر المجموعة</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">الطالب</label>
                <select 
                  required
                  disabled={!formData.groupId}
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">اختر الطالب</option>
                  {students.filter(s => s.groupId === formData.groupId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">تفاصيل المشكلة</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.problem}
                  onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="اكتب تفاصيل الشكوى هنا..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">موجهة إلى (اختياري)</label>
                <select 
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">غير موجهة</option>
                  {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setFormData({ studentId: '', groupId: '', problem: '', assignedTo: '', status: 'active' });
                  }}
                  className="flex-1 px-4 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                >
                  {editingId ? 'تحديث الشكوى' : 'حفظ الشكوى'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default Complaints;
