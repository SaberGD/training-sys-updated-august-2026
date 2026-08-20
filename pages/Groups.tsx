
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { Group, User, Course, Student } from '../types';
import { subscribeToCollection, deleteGroupCascading, archiveGroup, unarchiveGroup } from '../services/firestore';
import Layout from '../components/Layout';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import GroupModal from '../components/GroupModal';
import AccountingImportModal from '../components/AccountingImportModal';
import { formatTime12h } from '../utils';

const { where } = firestore as any;

interface GroupsProps {
  user: User;
  isTrainerOnly?: boolean;
}

const Groups: React.FC<GroupsProps> = ({ user, isTrainerOnly }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  
  // Delete Modal States
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const qParams = isTrainerOnly ? [where('trainerIds', 'array-contains', user.uid)] : [];
    const unsub = subscribeToCollection<Group>('groups', setGroups, qParams);
    const unsubCourses = subscribeToCollection<Course>('courses', setCourses);
    const unsubStudents = subscribeToCollection<Student>('students', setAllStudents);
    const unsubUsers = subscribeToCollection<User>('users', (data) => {
      const eligibleTrainers = data.filter(u => 
        ['trainer', 'team_leader', 'coordinator', 'admin'].includes(u.role) && !u.disabled
      );
      setTrainers(eligibleTrainers);
    });
    
    return () => {
      unsub();
      unsubCourses();
      unsubStudents();
      unsubUsers();
    };
  }, [isTrainerOnly, user.uid]);

  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, group: Group) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingGroup(group);
    setIsModalOpen(true);
  };

  const handleOpenDeleteModal = (e: React.MouseEvent, group: Group) => {
    e.preventDefault();
    e.stopPropagation();
    setGroupToDelete(group);
    setDeleteProgress({ current: 0, total: 0 });
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGroupCascading(groupToDelete.id, user, (current, total) => {
        setDeleteProgress({ current, total });
      });
      setGroupToDelete(null);
    } catch (err: any) {
      alert("Failed to delete group: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveGroup = async (e: React.MouseEvent, group: Group) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to archive "${group.name}"?`)) {
      try {
        await archiveGroup(group.id, user);
      } catch (err: any) {
        alert("Failed to archive group: " + err.message);
      }
    }
  };

  const handleUnarchiveGroup = async (e: React.MouseEvent, group: Group) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to restore "${group.name}"?`)) {
      try {
        await unarchiveGroup(group.id, user);
      } catch (err: any) {
        alert("Failed to restore group: " + err.message);
      }
    }
  };

  const filteredGroups = groups.filter(g => showArchived ? g.archived === true : !g.archived);

  const isStaff = ['admin', 'coordinator', 'team_leader', 'trainer'].includes(user.role);

  return (
    <Layout user={user}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">Groups Management</h1>
          <p className="text-slate-500 font-medium">Manage all training batches and session schedules.</p>
          <div className="flex bg-slate-100 p-1 rounded-xl mt-4 w-fit">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                !showArchived ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active Groups
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                showArchived ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Archived Groups
            </button>
          </div>
        </div>
        {isStaff && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-purple-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-600/20 hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              📥 Import from Accounting System
            </button>
            <button 
              onClick={handleOpenCreateModal}
              className="bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-600/20 hover:bg-primary-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 w-full sm:w-auto justify-center"
            >
              <span className="text-xl leading-none">+</span> Create Group
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredGroups.map((group) => (
          <div key={group.id} className="relative group animate-fade-in">
            <Link 
              to={`/groups/${group.id}`}
              className="block bg-white p-8 rounded-4xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary-100 transition-all h-full overflow-hidden relative"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="bg-primary-50 text-primary-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-primary-100 tracking-widest">
                  Batch {group.name}
                </span>
                <span className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-primary-600 group-hover:bg-primary-50 transition-all duration-300">
                  <span className="text-xl">→</span>
                </span>
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-6 leading-tight tracking-tighter group-hover:text-primary-600 transition-colors">
                {group.courseName}
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date & Timing</p>
                  <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
                    📅 {group.startDate} ({group.daysOfWeek.join(', ')})
                  </p>
                </div>
                
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Details</p>
                  <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
                    ⏰ {formatTime12h(group.sessionTime)} • {group.totalSessions} Sessions
                  </p>
                </div>

                {(() => {
                  const gStudents = allStudents.filter(s => s.groupId === group.id);
                  const activeCount = gStudents.filter(s => !s.deactivated && s.is50PercentPaid !== false).length;
                  const deactivatedCount = gStudents.filter(s => s.deactivated || s.is50PercentPaid === false).length;
                  return (
                    <div className="flex items-center gap-2 pt-1 font-arabic" dir="rtl">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                        🟢 {activeCount} نشط
                      </span>
                      {deactivatedCount > 0 && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                          🔴 {deactivatedCount} موقوف
                        </span>
                      )}
                    </div>
                  );
                })()}
                
                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between font-arabic text-right" dir="rtl">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">المدربون المسؤولون 👨‍🏫</p>
                    <div className="text-xs font-bold text-slate-700">
                      {(() => {
                        const primaryT = trainers.find(t => t.uid === (group.primaryTrainerId || group.trainerIds?.[0]));
                        const secondaryT = trainers.find(t => t.uid === (group.secondaryTrainerId || group.trainerIds?.[1]));
                        const assistantT = trainers.find(t => t.uid === group.assistantTrainerId) || (group.assistantTrainerName ? { name: group.assistantTrainerName } : null);
                        return (
                          <>
                            {primaryT ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">أساسي</span>
                                <span className="text-indigo-900 font-extrabold">{primaryT.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">لم يحدد مدرب أساسي</span>
                            )}
                            {secondaryT && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">ثانوي</span>
                                <span className="text-slate-700">{secondaryT.name}</span>
                              </div>
                            )}
                            {assistantT && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-md font-bold">مُساعد</span>
                                <span className="text-emerald-900 font-bold">{assistantT.name}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Subtle accent line */}
              <div className="absolute bottom-0 left-0 h-1.5 w-full bg-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
            </Link>
            
            {isStaff && (
              <div className="absolute top-6 right-16 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const evalUrl = `${window.location.origin}/student-portal?isFeedbackMode=true&qGroupId=${group.id}`;
                    navigator.clipboard.writeText(evalUrl);
                    alert(`✅ تم نسخ رابط فورم تقييم الجروب (${group.name}) بنجاح!\n\nالرابط:\n${evalUrl}\n\nيمكنك الآن إرساله للطلاب في الجروب في أي وقت.`);
                  }}
                  className="p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 shadow-lg rounded-xl border border-purple-200 transition-all hover:scale-110 font-bold text-xs flex items-center gap-1"
                  title="نسخ رابط فورم التقييم للمجموعة"
                >
                  ⭐ رابط التقييم
                </button>
                <button 
                  onClick={(e) => handleOpenEditModal(e, group)}
                  className="p-2.5 bg-white shadow-lg text-slate-400 hover:text-primary-600 rounded-xl border border-slate-100 transition-all hover:scale-110"
                  title="Edit Group"
                >
                  ✏️
                </button>
                {group.archived ? (
                  <button 
                    onClick={(e) => handleUnarchiveGroup(e, group)}
                    className="p-2.5 bg-white shadow-lg text-slate-400 hover:text-green-600 rounded-xl border border-slate-100 transition-all hover:scale-110"
                    title="Restore Group"
                  >
                    ♻️
                  </button>
                ) : (
                  <button 
                    onClick={(e) => handleArchiveGroup(e, group)}
                    className="p-2.5 bg-white shadow-lg text-slate-400 hover:text-amber-600 rounded-xl border border-slate-100 transition-all hover:scale-110"
                    title="Archive Group"
                  >
                    📦
                  </button>
                )}
                <button 
                  onClick={(e) => handleOpenDeleteModal(e, group)}
                  className="p-2.5 bg-white shadow-lg text-slate-400 hover:text-red-600 rounded-xl border border-slate-100 transition-all hover:scale-110"
                  title="Delete Group"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-5xl border-2 border-dashed border-slate-200 text-slate-400 animate-fade-in">
            <div className="text-5xl mb-4 opacity-50">{showArchived ? '📦' : '🏢'}</div>
            <p className="text-lg font-black uppercase tracking-widest">
              {showArchived ? 'No archived batches' : 'No active batches registered yet'}
            </p>
          </div>
        )}
      </div>

      <GroupModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
        editingGroup={editingGroup}
        courses={courses}
        trainers={trainers}
        onSuccess={() => {}}
      />

      <AccountingImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        user={user}
        courses={courses}
        trainers={trainers}
        existingGroups={groups}
      />

      <ConfirmDeleteModal 
        isOpen={!!groupToDelete}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={handleDeleteGroup}
        entityName={groupToDelete?.name || ''}
        entityType="Training Batch"
        isProcessing={isDeleting}
      />
    </Layout>
  );
};

export default Groups;
