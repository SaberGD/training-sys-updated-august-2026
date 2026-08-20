
import React, { useState, useEffect } from 'react';
import { ActivityLog, User } from '../types';
import { subscribeToCollection } from '../services/firestore';
import * as firestore from 'firebase/firestore';
import Layout from '../components/Layout';

const { orderBy, limit } = firestore as any;

const ActivityLogPage: React.FC<{ user: User }> = ({ user }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    // Only fetch for authorized roles
    if (!['admin', 'coordinator', 'team_leader'].includes(user.role)) return;

    const unsub = subscribeToCollection<ActivityLog>(
      'activityLogs', 
      setLogs, 
      [orderBy('timestamp', 'desc'), limit(50)]
    );
    return () => unsub();
  }, [user.role]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.performedByName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (log.entityName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType ? log.entityType === filterType : true;
    return matchesSearch && matchesType;
  });

  if (!['admin', 'coordinator', 'team_leader'].includes(user.role)) {
    return <Layout user={user}><div className="p-10 text-center text-slate-400 italic">Access Denied.</div></Layout>;
  }

  return (
    <Layout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Activity Log</h1>
        <p className="text-slate-500 font-medium tracking-tight">Audit trail of important system actions and changes.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search by user or entity name..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
            />
          </div>
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
          >
            <option value="">All Entity Types</option>
            <option value="group">Group</option>
            <option value="student">Student</option>
            <option value="follow_up">Follow Up</option>
            <option value="task">Task</option>
            <option value="user">User</option>
            <option value="label">Label</option>
            <option value="penalty">Penalty</option>
            <option value="complaint">Complaint</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Time</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">User</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Action</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Target Entity</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] text-slate-500 tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">No logs found matching your criteria.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Recent'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{log.performedByName}</span>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-tighter">{log.performedByRole.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                        log.action.includes('DELETE') ? 'bg-red-50 text-red-600 border-red-100' :
                        log.action.includes('CREATE') || log.action.includes('SUBMIT') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{log.entityName || 'N/A'}</span>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-tighter">{log.entityType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 font-medium max-w-md line-clamp-2">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default ActivityLogPage;
