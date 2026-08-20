
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User, Group, Session, ScheduleItem, DailyTrainerOps, Week, WeekDay } from '../types';
import { 
  subscribeToCollection, saveScheduleItem, deleteScheduleItem, 
  saveDailyOps, getDocument 
} from '../services/firestore';
import * as firestore from 'firebase/firestore';
import Layout from '../components/Layout';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { formatTime12h } from '../utils';

const { where, orderBy } = firestore as any;

const WeeklySchedulePage: React.FC<{ user: User }> = ({ user }) => {
  const { weekId } = useParams<{ weekId: string }>();
  const navigate = useNavigate();

  const isStaff = ['admin', 'coordinator', 'team_leader'].includes(user.role);

  const [week, setWeek] = useState<Week | null>(null);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  
  // Refined Filter state: Default "all" for staff, current user uid for trainers
  const [selectedTrainerId, setSelectedTrainerId] = useState(isStaff ? 'all' : user.uid);
  
  const [trainers, setTrainers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [dailyOps, setDailyOps] = useState<DailyTrainerOps[]>([]);
  const [expandedContent, setExpandedContent] = useState<Record<string, boolean>>({});
  
  // Deletion Modal State
  const [itemToDelete, setItemToDelete] = useState<ScheduleItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [modalData, setModalData] = useState<Partial<ScheduleItem>>({
    type: 'groupSession',
    dayOfWeek: 'Sun',
    time: '19:00',
    lectureContent: '',
    trainerId: '',
    trainerName: '',
    title: '',
    groupId: '',
    sessionId: ''
  });
  const [availableSessions, setAvailableSessions] = useState<Session[]>([]);

  const canManageItems = isStaff;

  useEffect(() => {
    if (!weekId) {
      navigate('/weekly-schedule');
      return;
    }

    const fetchWeek = async () => {
      const w = await getDocument<Week>('weeks', weekId);
      if (!w) navigate('/weekly-schedule');
      else setWeek(w);
    };
    fetchWeek();

    const unsubDays = subscribeToCollection<WeekDay>('weekDays', setWeekDays, [
      where('weekId', '==', weekId),
      orderBy('date', 'asc')
    ]);

    const unsubUsers = subscribeToCollection<User>('users', (data) => {
      setTrainers(data.filter(u => !u.disabled && ['trainer', 'team_leader', 'admin', 'coordinator'].includes(u.role)));
    });
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    
    return () => { unsubDays(); unsubUsers(); unsubGroups(); };
  }, [weekId, navigate]);

  // Subscription for schedule items: Fetch all items for the week
  useEffect(() => {
    if (!weekId) return;
    const unsubItems = subscribeToCollection<ScheduleItem>('scheduleItems', setScheduleItems, [
      where('weekId', '==', weekId)
    ]);
    
    // Daily ops are still tied to the selected trainer check-in view
    let unsubOps = () => {};
    if (selectedTrainerId !== 'all') {
      unsubOps = subscribeToCollection<DailyTrainerOps>('dailyTrainerOps', setDailyOps, [
        where('trainerId', '==', selectedTrainerId),
        where('weekId', '==', weekId)
      ]);
    } else {
      setDailyOps([]);
    }

    return () => { unsubItems(); unsubOps(); };
  }, [selectedTrainerId, weekId]);

  const fetchGroupSessions = async (groupId: string) => {
    const unsub = subscribeToCollection<Session>('sessions', setAvailableSessions, [
      where('groupId', '==', groupId),
      orderBy('sessionNumber', 'asc')
    ]);
    return unsub;
  };

  const resetModal = () => {
    setModalData({
      type: 'groupSession',
      dayOfWeek: 'Sun',
      time: '19:00',
      lectureContent: '',
      trainerId: '',
      trainerName: '',
      title: '',
      groupId: '',
      sessionId: ''
    });
    setEditingItem(null);
  };

  const handleEditItem = (item: ScheduleItem) => {
    setEditingItem(item);
    setModalData({ ...item });
    if (item.groupId) {
      fetchGroupSessions(item.groupId);
    }
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: ScheduleItem) => {
    const newStatus = item.status === 'done' ? 'upcoming' : 'done';
    await saveScheduleItem({ ...item, status: newStatus }, user);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageItems || !week) return;

    let title = modalData.title || '';
    let groupName = '';
    let courseName = '';
    let sessionNumber = 0;

    if (modalData.type === 'groupSession' && modalData.groupId) {
      const g = groups.find(x => x.id === modalData.groupId);
      const s = availableSessions.find(x => x.id === modalData.sessionId);
      groupName = g?.name || '';
      courseName = g?.courseName || '';
      sessionNumber = s?.sessionNumber || 0;
      title = `Lec ${sessionNumber} - ${courseName} - Batch ${groupName}`;
    }

    const trainer = trainers.find(t => t.uid === modalData.trainerId);

    const item: Partial<ScheduleItem> = {
      ...modalData,
      weekId: weekId,
      weekStartDate: week.startDate,
      title,
      groupName,
      courseName,
      sessionNumber,
      trainerName: trainer?.name || 'Unknown',
      status: modalData.status || 'upcoming',
      ops: modalData.ops || {
        recordingUploaded: false,
        emailsAdded: false,
        sentOnTelegram: false,
        taskSent: false,
        whatsappConfirmationSent: false
      }
    };

    await saveScheduleItem(item, user);
    setIsModalOpen(false);
    resetModal();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    try {
      await deleteScheduleItem(itemToDelete.id, user);
      setItemToDelete(null);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const toggleDailyOp = async (date: string, field: keyof DailyTrainerOps) => {
    if (selectedTrainerId === 'all') return;
    const existing = dailyOps.find(o => o.date === date);
    const newVal = existing ? !(existing as any)[field] : true;
    
    await saveDailyOps({
      trainerId: selectedTrainerId,
      weekId,
      date,
      [field]: newVal
    }, user);
  };

  const filteredItems = useMemo(() => {
    if (selectedTrainerId === 'all') return scheduleItems;
    return scheduleItems.filter(i => i.trainerId === selectedTrainerId);
  }, [scheduleItems, selectedTrainerId]);

  return (
    <Layout user={user}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <Link to="/weekly-schedule" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline mb-2 block">← Back to Weeks</Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{week?.title}</h1>
          <p className="text-slate-500 font-medium">Weekly Execution & Trainer Check-ins</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View As:</span>
            <select 
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
              className="outline-none text-xs font-bold text-slate-700 bg-transparent cursor-pointer"
            >
              {isStaff && <option value="all">System Overview (All)</option>}
              {trainers.map(t => <option key={t.uid} value={t.uid}>{t.name} ({t.role.replace('_', ' ')})</option>)}
            </select>
          </div>
          {canManageItems && (
            <button 
              onClick={() => { resetModal(); setIsModalOpen(true); }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              + Add Schedule Item
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {weekDays.map(day => {
          // Sort items for this day by time ascending
          const items = filteredItems
            .filter(i => i.date === day.date)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

          const ops = dailyOps.find(o => o.date === day.date);
          const isToday = day.date === new Date().toISOString().split('T')[0];

          return (
            <section key={day.id} className={`${isToday ? 'bg-blue-50/30 p-6 -m-6 rounded-[2rem] border border-blue-100/50' : ''}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {day.dayOfWeek}, {day.date}
                    {isToday && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Today</span>}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] mt-1">Daily Program</p>
                </div>

                {selectedTrainerId !== 'all' && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Trainer Ops:</span>
                    {[
                      { key: 'preparingLectures', label: 'Lec Prep' },
                      { key: 'attendingSessions', label: 'Attendance' },
                      { key: 'tasksFollowUp', label: 'Task F-Up' },
                      { key: 'uploadLectures', label: 'Lec Upload' },
                      { key: 'studentsQuestions', label: 'Q&A Support' },
                      { key: 'dailyReport', label: 'End Report' }
                    ].map(op => (
                      <button
                        key={op.key}
                        onClick={() => toggleDailyOp(day.date, op.key as any)}
                        className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all ${
                          (ops as any)?.[op.key] 
                          ? 'bg-green-600 text-white border-green-700 shadow-md' 
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(item => (
                  <div key={item.id} className={`p-6 rounded-3xl border transition-all relative overflow-hidden group shadow-sm hover:shadow-md ${item.status === 'done' ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100/50' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          item.status === 'done' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          item.type === 'groupSession' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          item.type === 'workshop' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                          {item.type.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatTime12h(item.time)}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {canManageItems && (
                           <>
                             <button 
                               onClick={() => handleToggleStatus(item)}
                               className={`p-1.5 rounded-lg transition-all ${item.status === 'done' ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                               title={item.status === 'done' ? "Mark as Upcoming" : "Mark as Completed"}
                             >
                               {item.status === 'done' ? '✅' : '✔️'}
                             </button>
                             <button onClick={() => handleEditItem(item)} className="p-1.5 text-slate-300 hover:text-blue-500">✏️</button>
                             <button onClick={() => setItemToDelete(item)} className="p-1.5 text-slate-300 hover:text-red-500">🗑️</button>
                           </>
                         )}
                      </div>
                    </div>

                    <h3 className={`text-sm font-black mb-2 leading-tight ${item.status === 'done' ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {item.title}
                    </h3>
                    
                    {item.type === 'groupSession' && item.groupId && (
                      <Link to={`/groups/${item.groupId}`} className={`text-[10px] font-black uppercase hover:underline mb-4 block ${item.status === 'done' ? 'text-emerald-600' : 'text-blue-500'}`}>
                        Open Batch Dashboard →
                      </Link>
                    )}

                    <div className="mb-4">
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${item.status === 'done' ? 'text-emerald-400' : 'text-slate-400'}`}>Assigned Trainer</p>
                      <p className={`text-xs font-bold ${item.status === 'done' ? 'text-emerald-800' : 'text-slate-700'}`}>{item.trainerName}</p>
                    </div>

                    {item.lectureContent && (
                      <div className={`mt-4 pt-4 border-t ${item.status === 'done' ? 'border-emerald-100' : 'border-slate-50'}`}>
                        <button 
                          onClick={() => setExpandedContent({ ...expandedContent, [item.id]: !expandedContent[item.id] })}
                          className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mb-2 ${item.status === 'done' ? 'text-emerald-400' : 'text-slate-400'}`}
                        >
                          {expandedContent[item.id] ? '▼ Hide Plan' : '▶ View Plan'}
                        </button>
                        {expandedContent[item.id] && (
                          <p className={`text-xs font-medium whitespace-pre-wrap p-3 rounded-xl border animate-in fade-in slide-in-from-top-2 ${item.status === 'done' ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200/50' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                            {item.lectureContent}
                          </p>
                        )}
                      </div>
                    )}

                    {item.status === 'done' && (
                      <div className="absolute top-0 right-0 p-2">
                         <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl-xl shadow-sm">Completed</span>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-300 text-xs italic bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    No items scheduled for this day.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete}
        onCancel={() => setItemToDelete(null)}
        onConfirm={confirmDeleteItem}
        entityName={itemToDelete?.title || ''}
        entityType="Schedule Item"
        isProcessing={isDeletingItem}
      />

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                {editingItem ? 'Edit Schedule Item' : 'Add Schedule Item'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetModal(); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Item Type</label>
                  <select 
                    value={modalData.type}
                    onChange={(e) => setModalData({ ...modalData, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="groupSession">Group Session (Lecture)</option>
                    <option value="workshop">Workshop / Lab</option>
                    <option value="manual">Other / Manual Task</option>
                  </select>
                </div>

                {modalData.type === 'groupSession' ? (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Select Batch (Optional)</label>
                      <select 
                        value={modalData.groupId || ''}
                        onChange={(e) => {
                          setModalData({ ...modalData, groupId: e.target.value, sessionId: '' });
                          if (e.target.value) {
                            fetchGroupSessions(e.target.value);
                          } else {
                            setAvailableSessions([]);
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="">No Batch Assigned (Temporary / Finishing)</option>
                        {groups.map(g => <option key={g.id} value={g.id}>Batch {g.name} - {g.courseName}</option>)}
                      </select>
                    </div>
                    {modalData.groupId && (
                      <div className="col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Select Session</label>
                        <select 
                          required
                          value={modalData.sessionId || ''}
                          onChange={(e) => setModalData({ ...modalData, sessionId: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">Choose a session...</option>
                          {availableSessions.map(s => <option key={s.id} value={s.id}>Lec {s.sessionNumber} ({s.status})</option>)}
                        </select>
                      </div>
                    )}
                  </>
                ) : null}

                {/* Show Title field if not a group session, or if no group is selected for a group session */}
                {(modalData.type !== 'groupSession' || !modalData.groupId) && (
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Lecture / Task Title</label>
                    <input 
                      type="text" required
                      value={modalData.title || ''}
                      onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      placeholder="e.g. Planning Session / Temporary Batch Intro"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Date</label>
                  <select 
                    required
                    value={modalData.date || ''}
                    onChange={(e) => {
                      const day = weekDays.find(d => d.date === e.target.value);
                      setModalData({ ...modalData, date: e.target.value, dayOfWeek: day?.dayOfWeek });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Select Date...</option>
                    {weekDays.map(d => <option key={d.id} value={d.date}>{d.dayOfWeek} ({d.date})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Time</label>
                  <input 
                    type="time" required
                    value={modalData.time || ''}
                    onChange={(e) => setModalData({ ...modalData, time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Responsible Trainer</label>
                  <select 
                    required
                    value={modalData.trainerId || ''}
                    onChange={(e) => setModalData({ ...modalData, trainerId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Select Trainer...</option>
                    {trainers.map(t => <option key={t.uid} value={t.uid}>{t.name} ({t.role.replace('_', ' ')})</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-wider">Content Plan / Notes</label>
                  <textarea 
                    value={modalData.lectureContent || ''}
                    onChange={(e) => setModalData({ ...modalData, lectureContent: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 h-24 text-xs font-medium"
                    placeholder="What will be taught or done? List main points..."
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); resetModal(); }} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all border border-slate-100">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-widest">
                  {editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WeeklySchedulePage;
