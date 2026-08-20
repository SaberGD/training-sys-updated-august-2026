
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, AssignedTask, TaskStatus, TaskPriority, 
  SubTask, TaskFile, TaskComment, AppNotification 
} from '../types';
import { 
  subscribeToCollection, 
  saveAssignedTask, 
  updateTaskStatus,
  addTaskComment,
  updateSubTasks,
  addTaskFile,
  deleteTask,
  sendNotification
} from '../services/firestore';
import Layout from '../components/Layout';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermissions } from '../contexts/PermissionsContext';
import * as firestore from 'firebase/firestore';
import { 
  Plus, Search, Filter, Calendar, Clock, AlertCircle, 
  CheckCircle2, MessageSquare, Paperclip, Copy, 
  MoreVertical, ChevronRight, LayoutDashboard, ListTodo,
  CheckSquare, Square, Send, Trash2, Eye, ExternalLink,
  TrendingUp, AlertTriangle, CheckCircle, Clock4, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { Group, Student, LectureEvaluation, Session } from '../types';

const { where, orderBy } = firestore as any;

const STATUS_LABELS: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  assigned: { label: '📥 تم الإسناد', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  received: { label: '✅ تم الاستلام', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  in_progress: { label: '🔄 قيد التنفيذ', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  on_hold: { label: '⏳ قائمة الانتظار', color: 'text-slate-600', bgColor: 'bg-slate-50' },
  delivered: { label: '📤 تم التسليم', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  under_review: { label: '🔍 قيد المراجعة', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  approved: { label: '✔️ تم الاعتماد', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  rejected: { label: '❌ مرفوضة', color: 'text-red-600', bgColor: 'bg-red-50' },
  completed: { label: '🏁 مكتملة', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
};

const PRIORITY_LABELS: Record<TaskPriority, { label: string; color: string; icon: any }> = {
  low: { label: 'منخفضة 🟢', color: 'text-emerald-500', icon: CheckCircle2 },
  medium: { label: 'متوسطة 🟡', color: 'text-amber-500', icon: AlertCircle },
  high: { label: 'عالية 🔴', color: 'text-red-500', icon: AlertTriangle },
  urgent: { label: 'عاجلة 🚨', color: 'text-red-600', icon: AlertCircle },
};

interface TasksPageProps {
  user: User;
}

const TasksPage: React.FC<TasksPageProps> = ({ user }) => {
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  
  const isAdmin = user.role === 'admin' || user.role === 'coordinator';
  const isSupervisor = user.role === 'team_leader';
  const isTrainer = user.role === 'trainer';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'my_tasks' | 'all_tasks' | 'reports' | 'analytics'>(
    isAdmin ? 'dashboard' : 'my_tasks'
  );

  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [evaluations, setEvaluations] = useState<LectureEvaluation[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AssignedTask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubTasks = subscribeToCollection<AssignedTask>(
      'assignedTasks',
      setTasks,
      [firestore.orderBy('createdAt', 'desc'), firestore.limit(50)]
    );

    const unsubUsers = subscribeToCollection<User>(
      'users',
      (data) => setUsers(data.filter(u => u.role === 'trainer' || u.role === 'coordinator')),
      [firestore.orderBy('name', 'asc')]
    );

    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    const unsubEvals = subscribeToCollection<LectureEvaluation>('lectureEvaluations', setEvaluations, [firestore.limit(30)]);
    const unsubSessions = subscribeToCollection<Session>('sessions', setSessions, [firestore.limit(50)]);

    setLoading(false);
    return () => {
      unsubTasks();
      unsubUsers();
      unsubGroups();
      unsubEvals();
      unsubSessions();
    };
  }, []);

  // Check for task ID in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('id');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) setSelectedTask(task);
    }
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesAssignee = !filterAssignee || task.assignedTo === filterAssignee;
      const matchesStatus = !filterStatus || task.status === filterStatus;
      const matchesPriority = !filterPriority || task.priority === filterPriority;
      const matchesSearch = !searchQuery || 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // If trainer, only show their tasks unless they are admin/supervisor?
      // User said: Manager views all. Supervisor reviews. Trainer receives.
      if (isTrainer && activeTab === 'my_tasks') {
        return task.assignedTo === user.uid && matchesStatus && matchesPriority && matchesSearch;
      }

      return matchesAssignee && matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tasks, filterAssignee, filterStatus, filterPriority, searchQuery, user.uid, isTrainer, activeTab]);

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'approved').length;
    const review = tasks.filter(t => t.status === 'under_review' || t.status === 'delivered').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'approved') return false;
      const due = new Date(t.dueDate.seconds * 1000);
      return due < new Date();
    }).length;

    return { active, review, completed, overdue };
  }, [tasks]);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const assigneeId = formData.get('assignedTo') as string;
    const assignee = users.find(u => u.uid === assigneeId);

    const newTask: Partial<AssignedTask> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      assignedTo: assigneeId,
      assignedToName: assignee?.name || 'Unknown',
      assignedBy: user.uid,
      assignedByName: user.name,
      dueDate: firestore.Timestamp.fromDate(new Date(formData.get('dueDate') as string)),
      priority: formData.get('priority') as TaskPriority,
      status: 'assigned',
      subtasks: (formData.get('subtasks') as string).split('\n').filter(s => s.trim()).map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        title: s.trim(),
        done: false
      })),
      files: [],
      comments: [],
      courseType: formData.get('courseType') as 'online' | 'offline'
    };

    try {
      await saveAssignedTask(newTask, user);
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Error creating task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepeatTask = async (task: AssignedTask) => {
    setSubmitting(true);
    try {
      const repeatedTask: Partial<AssignedTask> = {
        title: `${task.title} (نسخة)`,
        description: task.description,
        assignedTo: task.assignedTo,
        assignedToName: task.assignedToName,
        assignedBy: user.uid,
        assignedByName: user.name,
        dueDate: task.dueDate, // Keep same due date for now, user can edit
        priority: task.priority,
        status: 'assigned',
        subtasks: task.subtasks.map(s => ({ ...s, done: false })),
        files: [],
        comments: [],
        courseType: task.courseType
      };
      await saveAssignedTask(repeatedTask, user);
      alert('تم تكرار المهمة بنجاح');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus, user);
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(s => 
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );

    try {
      await updateSubTasks(taskId, updatedSubtasks, user);
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, subtasks: updatedSubtasks } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (taskId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await addTaskComment(taskId, {
        text,
        authorId: user.uid,
        authorName: user.name
      }, user);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Layout user={user}><div className="p-10 text-center">Loading Tasks...</div></Layout>;

  return (
    <Layout user={user}>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-3">
              <ListTodo className="w-10 h-10 text-primary-600" />
              Tasks Module
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              Manage projects, track progress, and collaborate on tasks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl shadow-xl shadow-primary-600/20 transition-all uppercase tracking-widest text-xs"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            )}
            
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Dashboard
                </button>
              )}
              <button 
                onClick={() => setActiveTab('my_tasks')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'my_tasks' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                My Tasks
              </button>
              {(isAdmin || isSupervisor) && (
                <button 
                  onClick={() => setActiveTab('all_tasks')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all_tasks' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  All Tasks
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('reports')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Reports
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Analytics
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        {activeTab === 'dashboard' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.active}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Tasks in progress</p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue</span>
              </div>
              <p className="text-3xl font-black text-red-600">{stats.overdue}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Missed deadlines</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/10 rounded-2xl">
                  <Clock4 className="w-6 h-6 text-purple-500" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Review</span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.review}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Pending approval</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.completed}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Successfully finished</p>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>

            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>

            {(isAdmin || isSupervisor) && (
              <select 
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none"
              >
                <option value="">All Assignees</option>
                {users.map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => {
              const statusInfo = STATUS_LABELS[task.status];
              const priorityInfo = PRIORITY_LABELS[task.priority];
              const doneSubtasks = task.subtasks.filter(s => s.done).length;
              const progress = task.subtasks.length > 0 ? Math.round((doneSubtasks / task.subtasks.length) * 100) : 0;
              const isTaskOverdue = !['completed', 'approved'].includes(task.status) && new Date(task.dueDate.seconds * 1000) < new Date();

              return (
                <motion.div 
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500`}>
                          {priorityInfo.label}
                        </span>
                        {isTaskOverdue && (
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider bg-red-500 text-white animate-pulse">
                            🚨 متأخرة
                          </span>
                        )}
                        {task.courseType && (
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                            {task.courseType === 'online' ? '🌐 أونلاين' : '🏢 مقر'}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-primary-600 transition-colors">
                        {task.title}
                      </h3>
                      
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">
                        {task.description}
                      </p>

                      <div className="flex items-center gap-6 pt-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">
                            {new Date(task.dueDate.seconds * 1000).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <CheckSquare className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">
                            {doneSubtasks}/{task.subtasks.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">
                            {task.comments.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-4 min-w-[200px]">
                      <div className="w-full space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={`h-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned To</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{task.assignedToName}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black text-xs">
                          {task.assignedToName.charAt(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredTasks.length === 0 && (
            <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No tasks found matching your criteria.</p>
            </div>
          )}
        </div>
        {/* Performance Reports View */}
        {activeTab === 'reports' && isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black tracking-tight uppercase">Employee Performance Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Completed</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Overdue</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Commitment %</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Avg Time (Days)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map(emp => {
                    const empTasks = tasks.filter(t => t.assignedTo === emp.uid);
                    const completed = empTasks.filter(t => t.status === 'completed').length;
                    const overdue = empTasks.filter(t => {
                      if (t.status === 'completed' || t.status === 'approved') return false;
                      const due = new Date(t.dueDate.seconds * 1000);
                      return due < new Date();
                    }).length;
                    const total = empTasks.length;
                    const rate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

                    // Calculate avg time
                    const completedWithTime = empTasks.filter(t => t.status === 'completed' && t.completedAt);
                    const avgTime = completedWithTime.length > 0 
                      ? (completedWithTime.reduce((sum, t) => {
                          const start = t.createdAt.seconds;
                          const end = t.completedAt.seconds;
                          return sum + (end - start);
                        }, 0) / completedWithTime.length / 86400).toFixed(1)
                      : 'N/A';

                    return (
                      <tr key={emp.uid} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black text-xs">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className="text-lg font-black text-slate-900 dark:text-white">{completed}</span>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`text-lg font-black ${overdue > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{overdue}</span>
                        </td>
                        <td className="p-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-black ${rate >= 80 ? 'text-emerald-500' : rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                              {rate}%
                            </span>
                            <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full ${rate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className="text-lg font-black text-slate-900 dark:text-white">{avgTime}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Task Analytics View */}
        {activeTab === 'analytics' && isAdmin && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary-600" />
                  Task Completion by Group
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groups.map(g => {
                      const groupSessions = sessions.filter(s => s.groupId === g.id);
                      const groupEvals = evaluations.filter(e => e.groupId === g.id);
                      const totalCompleted = groupEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
                      const totalRequired = groupSessions.reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
                      return {
                        name: g.name,
                        completed: totalCompleted,
                        required: totalRequired,
                        rate: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0
                      };
                    }).filter(d => d.required > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      />
                      <Bar dataKey="rate" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Completion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Global Task Volume (Last 30 Days)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={Array.from({ length: 30 }).map((_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() - (29 - i));
                      const dateStr = date.toISOString().split('T')[0];
                      const dayTasks = tasks.filter(t => {
                        const tDate = new Date(t.createdAt.seconds * 1000).toISOString().split('T')[0];
                        return tDate === dateStr;
                      }).length;
                      return { date: dateStr.split('-').slice(1).join('/'), count: dayTasks };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8">System-wide Task Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl font-black text-primary-600 mb-2">
                    {evaluations.reduce((sum, e) => sum + (e.taskDelivered || 0), 0)}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Student Tasks</div>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl font-black text-emerald-600 mb-2">
                    {tasks.filter(t => t.status === 'completed').length}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed Admin Tasks</div>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl font-black text-red-600 mb-2">
                    {tasks.filter(t => {
                      if (t.status === 'completed' || t.status === 'approved') return false;
                      return new Date(t.dueDate.seconds * 1000) < new Date();
                    }).length}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue Admin Tasks</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest ${STATUS_LABELS[selectedTask.status].bgColor} ${STATUS_LABELS[selectedTask.status].color}`}>
                      {STATUS_LABELS[selectedTask.status].label}
                    </span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300`}>
                      {PRIORITY_LABELS[selectedTask.priority].label}
                    </span>
                    {selectedTask.courseType && (
                      <span className="text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                        {selectedTask.courseType === 'online' ? '🌐 أونلاين' : '🏢 مقر'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{selectedTask.title}</h2>
                  <div className="flex items-center gap-6 text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Due: {new Date(selectedTask.dueDate.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Created: {new Date(selectedTask.createdAt.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">By: {selectedTask.assignedByName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => handleRepeatTask(selectedTask)}
                      className="p-3 bg-white dark:bg-slate-800 text-slate-500 hover:text-primary-600 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                      title="Repeat Task"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="p-3 bg-white dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all text-2xl leading-none"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  {/* Left: Description & Subtasks */}
                  <div className="lg:col-span-2 space-y-10">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {selectedTask.description}
                      </p>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Checklist</h4>
                        <span className="text-xs font-black text-primary-600">
                          {Math.round((selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100)}% Complete
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedTask.subtasks.map((sub) => (
                          <div 
                            key={sub.id}
                            onClick={() => (isTrainer || isAdmin) && handleToggleSubtask(selectedTask.id, sub.id)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                              sub.done 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50' 
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-primary-300'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                              sub.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {sub.done && <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <span className={`text-sm font-bold ${sub.done ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-60' : 'text-slate-900 dark:text-white'}`}>
                              {sub.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Files Section */}
                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Files & Resources</h4>
                        <button 
                          onClick={() => {
                            const url = prompt('Enter file URL:');
                            const name = prompt('Enter file name:');
                            if (url && name) addTaskFile(selectedTask.id, { url, name, uploadedBy: user.uid, uploadedByName: user.name }, user);
                          }}
                          className="text-xs font-black text-primary-600 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add File
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTask.files.map(file => (
                          <a 
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-500 transition-all group"
                          >
                            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-400 group-hover:text-primary-500 transition-colors">
                              <Paperclip className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">By {file.uploadedByName}</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-300" />
                          </a>
                        ))}
                        {selectedTask.files.length === 0 && (
                          <div className="col-span-2 p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No files uploaded yet</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Right: Workflow & Comments */}
                  <div className="space-y-10">
                    {/* Workflow Actions */}
                    <section className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Workflow Actions</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {/* Trainer Actions */}
                        {isTrainer && selectedTask.assignedTo === user.uid && (
                          <>
                            {selectedTask.status === 'assigned' && (
                              <button 
                                onClick={() => handleStatusChange(selectedTask.id, 'received')}
                                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 uppercase tracking-widest text-xs"
                              >
                                ✅ استلام المهمة
                              </button>
                            )}
                            {['received', 'on_hold', 'rejected'].includes(selectedTask.status) && (
                              <button 
                                onClick={() => handleStatusChange(selectedTask.id, 'in_progress')}
                                className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-600/20 uppercase tracking-widest text-xs"
                              >
                                🔄 بدء التنفيذ
                              </button>
                            )}
                            {selectedTask.status === 'in_progress' && (
                              <>
                                <button 
                                  onClick={() => handleStatusChange(selectedTask.id, 'on_hold')}
                                  className="w-full py-4 bg-slate-600 text-white font-black rounded-2xl shadow-lg shadow-slate-600/20 uppercase tracking-widest text-xs"
                                >
                                  ⏳ وضع في الانتظار
                                </button>
                                <button 
                                  onClick={() => handleStatusChange(selectedTask.id, 'delivered')}
                                  className="w-full py-4 bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-600/20 uppercase tracking-widest text-xs"
                                >
                                  📤 تسليم المهمة
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {/* Supervisor Actions */}
                        {(isSupervisor || isAdmin) && (selectedTask.status === 'delivered' || selectedTask.status === 'under_review') && (
                          <>
                            <button 
                              onClick={() => handleStatusChange(selectedTask.id, 'approved')}
                              className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-xs"
                            >
                              ✔️ اعتماد المهمة
                            </button>
                            <button 
                              onClick={() => {
                                const reason = prompt('سبب الرفض:');
                                if (reason) {
                                  handleAddComment(selectedTask.id, `❌ تم الرفض: ${reason}`);
                                  handleStatusChange(selectedTask.id, 'rejected');
                                }
                              }}
                              className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/20 uppercase tracking-widest text-xs"
                            >
                              ❌ رفض المهمة
                            </button>
                          </>
                        )}

                        {/* Final Completion (Supervisor/Admin) */}
                        {(isSupervisor || isAdmin) && selectedTask.status === 'approved' && (
                          <button 
                            onClick={() => handleStatusChange(selectedTask.id, 'completed')}
                            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs"
                          >
                            🏁 إنهاء المهمة (مكتملة)
                          </button>
                        )}
                      </div>
                    </section>

                    {/* Comments Section */}
                    <section className="space-y-6 flex flex-col h-[400px]">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Comments Log</h4>
                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                        {selectedTask.comments.map(comment => (
                          <div 
                            key={comment.id}
                            className={`flex flex-col gap-1 ${comment.authorId === user.uid ? 'items-end' : 'items-start'}`}
                          >
                            <div className={`p-4 rounded-2xl max-w-[90%] text-sm font-medium ${
                              comment.authorId === user.uid 
                              ? 'bg-primary-600 text-white rounded-tr-none' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                            }`}>
                              {comment.text}
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                              {comment.authorName} • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                        {selectedTask.comments.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                            <MessageSquare className="w-8 h-8 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No comments yet</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-4">
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Add a comment..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(selectedTask.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                            className="w-full pl-4 pr-12 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-600">
                            <Send className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Create New Task</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white">&times;</button>
              </div>
              <form onSubmit={handleCreateTask} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Title</label>
                  <input 
                    name="title"
                    required
                    placeholder="e.g. ترتيب محاضرات دفعة يناير"
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                  <textarea 
                    name="description"
                    required
                    placeholder="Describe the task in detail..."
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500 h-24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assign To</label>
                    <select 
                      name="assignedTo"
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Employee</option>
                      {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                    <input 
                      name="dueDate"
                      type="date"
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</label>
                    <select 
                      name="priority"
                      defaultValue="medium"
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="low">Low 🟢</option>
                      <option value="medium">Medium 🟡</option>
                      <option value="high">High 🔴</option>
                      <option value="urgent">Urgent 🚨</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Course Type</label>
                    <select 
                      name="courseType"
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="online">Online 🌐</option>
                      <option value="offline">Offline 🏢</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtasks (One per line)</label>
                  <textarea 
                    name="subtasks"
                    placeholder="رفع الفيديوهات&#10;كتابة الوصف&#10;رفع ملفات المحاضرة"
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500 h-32"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl shadow-xl shadow-primary-600/20 transition-all uppercase tracking-widest text-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Task & Send Notification'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default TasksPage;
