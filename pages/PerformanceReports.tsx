
import React, { useState, useEffect, useMemo } from 'react';
import { User, Group, PerformanceDailyReport, PerformanceWeeklyReport } from '../types';
import { 
  subscribeToCollection, 
  savePerformanceDailyReport, 
  savePerformanceWeeklyReport,
  getDocument
} from '../services/firestore';
import Layout from '../components/Layout';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermissions } from '../contexts/PermissionsContext';
import * as firestore from 'firebase/firestore';
import { Trash2 } from 'lucide-react';

const { where, orderBy, limit } = firestore as any;

interface PerformanceReportsProps {
  user: User;
}

const PerformanceReports: React.FC<PerformanceReportsProps> = ({ user }) => {
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  
  const canSubmit = hasPermission(user, 'submitPerformanceReport');
  const canApprove = hasPermission(user, 'approvePerformanceReport');
  const isAdmin = user.role === 'admin' || user.role === 'coordinator';

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'review'>(
    canSubmit ? 'daily' : 'review'
  );

  const [dailyReports, setDailyReports] = useState<PerformanceDailyReport[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<PerformanceWeeklyReport[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Filters
  const [filterTrainer, setFilterTrainer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterViolation, setFilterViolation] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  useEffect(() => {
    const unsubUsers = subscribeToCollection<User>('users', setAllUsers, [orderBy('name', 'asc')]);
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);

    let dailyQ: any[] = [orderBy('date', 'desc')];
    if (canSubmit && !canApprove) {
      dailyQ = [where('trainerId', '==', user.uid), orderBy('date', 'desc')];
    }
    const unsubDaily = subscribeToCollection<PerformanceDailyReport>('dailyReports', setDailyReports, dailyQ);

    let weeklyQ: any[] = [orderBy('weekStart', 'desc')];
    if (canSubmit && !canApprove) {
      weeklyQ = [where('trainerId', '==', user.uid), orderBy('weekStart', 'desc')];
    }
    const unsubWeekly = subscribeToCollection<PerformanceWeeklyReport>('weeklyReports', setWeeklyReports, weeklyQ);

    setLoading(false);
    return () => {
      unsubUsers();
      unsubGroups();
      unsubDaily();
      unsubWeekly();
    };
  }, [user.uid, canSubmit, canApprove]);

  // Daily Report Form State
  const [currentDaily, setCurrentDaily] = useState<Partial<PerformanceDailyReport> | null>(null);

  useEffect(() => {
    if (activeTab === 'daily' && canSubmit) {
      const existing = dailyReports.find(r => r.date === todayStr && r.trainerId === user.uid);
      if (existing) {
        setCurrentDaily(existing);
      } else {
        const trainerGroups = groups.filter(g => g.trainerIds?.includes(user.uid));
        setCurrentDaily({
          trainerId: user.uid,
          trainerName: user.name,
          date: todayStr,
          dayName: dayName,
          assignedGroups: trainerGroups.map(g => ({ groupId: g.id, groupName: g.name })),
          checklist: {
            evaluatedTasks: { done: false, comment: '' },
            followedWhatsappQuestions: { done: false, comment: '' },
            outstandingStudents: { done: false, comment: '' },
            atRiskStudentsAdded: { done: false, comment: '' },
            atRiskStudentsResolved: { done: false, comment: '' },
            technicalIssuesSolved: { done: false, comment: '' },
            recordedSolutionVideo: { done: false, comment: '' },
            usedAnyDesk: { done: false, comment: '' },
            attendanceCollected: { done: false, comment: '' },
            reviewedLecturesAndTasks: { done: false, comment: '' },
            notifiedWhatsappUpload: { done: false, comment: '' }
          },
          dependencyIssue: {
            hasIssue: false,
            blockedById: null,
            blockedByName: null,
            details: ''
          },
          complaintsReported: '',
          additionalNotes: '',
          supervisorStatus: 'pending',
          supervisorComment: '',
          managerStatus: 'pending',
          managerComment: '',
          violationRecorded: false,
          links: []
        });
      }
    }
  }, [activeTab, dailyReports, groups, user.uid, user.name, todayStr, dayName, canSubmit]);

  const [selectedReport, setSelectedReport] = useState<PerformanceDailyReport | null>(null);

  const handleSaveDaily = async () => {
    if (!currentDaily) return;
    setSaving(true);
    try {
      await savePerformanceDailyReport(currentDaily, user);
      alert('Daily report saved successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveDaily = async (report: PerformanceDailyReport, status: 'accepted' | 'rejected', comment: string) => {
    setSaving(true);
    try {
      const isTeamLeader = user.role === 'team_leader';
      const isManager = user.role === 'admin' || user.role === 'coordinator';

      const update: any = { id: report.id };
      
      if (isTeamLeader) {
        update.supervisorStatus = status;
        update.supervisorComment = comment;
      }
      
      if (isManager) {
        update.managerStatus = status;
        update.managerComment = comment;
      }

      await savePerformanceDailyReport(update, user);
      alert(`Report ${status} successfully.`);
    } catch (err: any) {
      console.error(err);
      alert('Error updating report: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const generateWeeklySummary = async (trainerId: string, weekStart: string) => {
    setAiLoading(true);
    try {
      const reports = dailyReports.filter(r => r.trainerId === trainerId && r.date >= weekStart);
      const summaryText = reports.map(r => `Date: ${r.date}, Checklist: ${JSON.stringify(r.checklist)}, Notes: ${r.additionalNotes}`).join('\n');
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Summarize the following daily trainer reports for the week starting ${weekStart}. Focus on achievements, issues, and student progress:\n\n${summaryText}`
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || "AI summary generation failed.";
    } catch (err: any) {
      console.error(err);
      return "Error generating AI summary: " + err.message;
    } finally {
      setAiLoading(false);
    }
  };

  const [filterMissing, setFilterMissing] = useState(false);

  const filteredReports = useMemo(() => {
    let reports = dailyReports;
    
    if (filterMissing) {
      // Find trainers who haven't submitted for the selected date range (or today if range empty)
      const targetDate = filterDateFrom || todayStr;
      const submittedTrainerIds = new Set(dailyReports.filter(r => r.date === targetDate).map(r => r.trainerId));
      // This is a simplified "missing" view for a specific day
      return []; // We'll handle this differently in the UI if needed
    }

    return reports.filter(r => {
      if (filterTrainer && r.trainerId !== filterTrainer) return false;
      if (filterStatus && r.supervisorStatus !== filterStatus && r.managerStatus !== filterStatus) return false;
      if (filterViolation && !r.violationRecorded) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      return true;
    });
  }, [dailyReports, filterTrainer, filterStatus, filterViolation, filterDateFrom, filterDateTo, filterMissing, todayStr]);

  const missingTrainers = useMemo(() => {
    if (!filterMissing) return [];
    const targetDate = filterDateFrom || todayStr;
    const submittedTrainerIds = new Set(dailyReports.filter(r => r.date === targetDate).map(r => r.trainerId));
    return allUsers.filter(t => t.role === 'trainer' && !submittedTrainerIds.has(t.uid));
  }, [allUsers, dailyReports, filterMissing, filterDateFrom, todayStr]);

  const checklistItems = [
    { key: 'evaluatedTasks', label: 'تم تقييم التاسكات المرسلة حتى الوقت الحالي' },
    { key: 'followedWhatsappQuestions', label: 'تم متابعة استفسارات جروب الواتس' },
    { key: 'outstandingStudents', label: 'هل هناك طلبة مميزين اليوم؟' },
    { key: 'atRiskStudentsAdded', label: 'هل هناك طلبة في خطر تم إضافتهم؟' },
    { key: 'atRiskStudentsResolved', label: 'هل تم معالجة طلبة في خطر؟' },
    { key: 'technicalIssuesSolved', label: 'هل تم حل مشاكل فنية؟' },
    { key: 'recordedSolutionVideo', label: 'هل تم تسجيل فيديو للحل؟' },
    { key: 'usedAnyDesk', label: 'هل استخدمت AnyDesk؟' },
    { key: 'attendanceCollected', label: 'هل أخذت غياب الجروبات اليوم؟' },
    { key: 'reviewedLecturesAndTasks', label: 'هل راجعت تسجيلات المحاضرات والتاسكات؟' },
    { key: 'notifiedWhatsappUpload', label: 'هل تم إرسال رسالة رفع المحاضرات؟' },
  ] as const;

  if (loading) return <Layout user={user}><div className="p-10 text-center">Loading Performance Reports...</div></Layout>;

  return (
    <Layout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
              Performance Reports
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Daily and weekly performance tracking for trainers.
            </p>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {canSubmit && (
              <button 
                onClick={() => setActiveTab('daily')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'daily' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Daily Report
              </button>
            )}
            {canSubmit && (
              <button 
                onClick={() => setActiveTab('weekly')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'weekly' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Weekly Report
              </button>
            )}
            {canApprove && (
              <button 
                onClick={() => setActiveTab('review')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'review' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Review Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Daily Report Submission (Trainer View) */}
        {activeTab === 'daily' && currentDaily && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Header Info */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{currentDaily.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{currentDaily.dayName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trainer</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{currentDaily.trainerName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Groups Worked With Today</p>
                    <div className="flex flex-wrap gap-2">
                      {groups.map(g => {
                        const isSelected = currentDaily.assignedGroups?.some(ag => ag.groupId === g.id);
                        return (
                          <button
                            key={g.id}
                            onClick={() => {
                              const current = currentDaily.assignedGroups || [];
                              const next = isSelected 
                                ? current.filter(ag => ag.groupId !== g.id)
                                : [...current, { groupId: g.id, groupName: g.name }];
                              setCurrentDaily({ ...currentDaily, assignedGroups: next });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                              isSelected 
                              ? 'bg-primary-600 text-white border-primary-500 shadow-md' 
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary-300'
                            }`}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist Section */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-black tracking-tight uppercase">Daily Checklist</h2>
                </div>
                <div className="p-8 space-y-6">
                  {checklistItems.map(({ key, label }) => (
                    <div key={key} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-4 flex-1">
                        <input 
                          type="checkbox"
                          checked={currentDaily.checklist?.[key]?.done || false}
                          onChange={(e) => setCurrentDaily({
                            ...currentDaily,
                            checklist: {
                              ...currentDaily.checklist!,
                              [key]: { ...currentDaily.checklist![key], done: e.target.checked }
                            }
                          })}
                          className="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-bold text-slate-900 dark:text-white text-right flex-1">{label}</span>
                      </div>
                      <input 
                        type="text"
                        placeholder="Add comment..."
                        value={currentDaily.checklist?.[key]?.comment || ''}
                        onChange={(e) => setCurrentDaily({
                          ...currentDaily,
                          checklist: {
                            ...currentDaily.checklist!,
                            [key]: { ...currentDaily.checklist![key], comment: e.target.value }
                          }
                        })}
                        className="w-full md:w-64 p-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dependency Section */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-black tracking-tight uppercase">Dependencies & Blockers</h2>
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox"
                      id="hasIssue"
                      checked={currentDaily.dependencyIssue?.hasIssue || false}
                      onChange={(e) => setCurrentDaily({
                        ...currentDaily,
                        dependencyIssue: { ...currentDaily.dependencyIssue!, hasIssue: e.target.checked }
                      })}
                      className="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="hasIssue" className="text-sm font-bold text-slate-900 dark:text-white">هل في شئ ناقص معطل شغلك؟</label>
                  </div>

                  {currentDaily.dependencyIssue?.hasIssue && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Blocked By</label>
                          <select 
                            value={currentDaily.dependencyIssue?.blockedById || ''}
                            onChange={(e) => {
                              const u = allUsers.find(u => u.uid === e.target.value);
                              setCurrentDaily({
                                ...currentDaily,
                                dependencyIssue: { 
                                  ...currentDaily.dependencyIssue!, 
                                  blockedById: e.target.value,
                                  blockedByName: u?.name || null
                                }
                              });
                            }}
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Select Person</option>
                            {allUsers.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Details</label>
                        <textarea 
                          value={currentDaily.dependencyIssue?.details || ''}
                          onChange={(e) => setCurrentDaily({
                            ...currentDaily,
                            dependencyIssue: { ...currentDaily.dependencyIssue!, details: e.target.value }
                          })}
                          className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="What is blocking you?"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Additional Sections */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-black tracking-tight uppercase">Additional Notes</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Report Links (Screenshots, etc.)</label>
                    <div className="space-y-2">
                      {(currentDaily.links || []).map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="url"
                            value={link}
                            onChange={(e) => {
                              const newLinks = [...(currentDaily.links || [])];
                              newLinks[idx] = e.target.value;
                              setCurrentDaily({ ...currentDaily, links: newLinks });
                            }}
                            className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="https://..."
                          />
                          <button 
                            onClick={() => {
                              const newLinks = (currentDaily.links || []).filter((_, i) => i !== idx);
                              setCurrentDaily({ ...currentDaily, links: newLinks });
                            }}
                            className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setCurrentDaily({ ...currentDaily, links: [...(currentDaily.links || []), ''] })}
                        className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-primary-500 hover:text-primary-500 transition-all"
                      >
                        + Add Link
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Complaints Reported</label>
                    <textarea 
                      value={currentDaily.complaintsReported || ''}
                      onChange={(e) => setCurrentDaily({ ...currentDaily, complaintsReported: e.target.value })}
                      className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Any complaints to management?"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">General Notes</label>
                    <textarea 
                      value={currentDaily.additionalNotes || ''}
                      onChange={(e) => setCurrentDaily({ ...currentDaily, additionalNotes: e.target.value })}
                      className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Any other notes for today?"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                onClick={handleSaveDaily}
                disabled={saving || (currentDaily.id && !isAdmin)}
                className="w-full py-6 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-3xl shadow-xl shadow-primary-600/20 transition-all uppercase tracking-widest text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : currentDaily.id ? 'Report Submitted' : 'Submit Daily Report'}
              </button>

              {currentDaily.id && (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Review Status</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Supervisor</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                      currentDaily.supervisorStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                      currentDaily.supervisorStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {currentDaily.supervisorStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Manager</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                      currentDaily.managerStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                      currentDaily.managerStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {currentDaily.managerStatus}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review Dashboard (Manager/Supervisor View) */}
        {activeTab === 'review' && (
          <div className="space-y-8">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trainer</label>
                  <select 
                    value={filterTrainer}
                    onChange={(e) => setFilterTrainer(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                  >
                    <option value="">All Trainers</option>
                    {allUsers.filter(u => u.role === 'trainer').map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From Date</label>
                  <input 
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Date</label>
                  <input 
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input 
                    type="checkbox"
                    id="filterViolation"
                    checked={filterViolation}
                    onChange={(e) => { setFilterViolation(e.target.checked); setFilterMissing(false); }}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600"
                  />
                  <label htmlFor="filterViolation" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Violations</label>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input 
                    type="checkbox"
                    id="filterMissing"
                    checked={filterMissing}
                    onChange={(e) => { setFilterMissing(e.target.checked); setFilterViolation(false); }}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600"
                  />
                  <label htmlFor="filterMissing" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Missing</label>
                </div>
              </div>
            </div>

            {/* Reports List */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / Day</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Trainer</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">{filterMissing ? 'Status' : 'Checklist %'}</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">{filterMissing ? 'Email' : 'Blockers'}</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filterMissing ? (
                      missingTrainers.map(trainer => (
                        <tr key={trainer.uid} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                          <td className="p-6 font-bold text-slate-900 dark:text-white">{filterDateFrom || todayStr}</td>
                          <td className="p-6 font-bold text-slate-900 dark:text-white">{trainer.name}</td>
                          <td className="p-6 text-red-500 font-black text-xs uppercase tracking-widest">Missing Submission</td>
                          <td className="p-6 text-xs text-slate-500">{trainer.email}</td>
                          <td className="p-6">-</td>
                          <td className="p-6">
                            <button className="text-[10px] font-black bg-primary-600 text-white px-3 py-1 rounded-lg uppercase">Remind</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      filteredReports.map(report => {
                        const checklistValues = Object.values(report.checklist) as { done: boolean; comment: string }[];
                        const doneCount = checklistValues.filter(v => v.done).length;
                        const totalCount = checklistValues.length;
                        const percentage = Math.round((doneCount / totalCount) * 100);

                        return (
                          <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                            <td className="p-6">
                              <p className="font-bold text-slate-900 dark:text-white">{report.date}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">{report.dayName}</p>
                            </td>
                            <td className="p-6">
                              <p className="font-bold text-slate-900 dark:text-white">{report.trainerName}</p>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full transition-all ${percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }}></div>
                                </div>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{percentage}%</span>
                              </div>
                            </td>
                            <td className="p-6">
                              {report.dependencyIssue.hasIssue ? (
                                <span className="text-[10px] font-black bg-red-500/10 text-red-500 px-2 py-1 rounded-lg uppercase">
                                  Blocked by {report.dependencyIssue.blockedByName}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg uppercase">None</span>
                              )}
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col gap-1">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase text-center ${
                                  report.supervisorStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                                  report.supervisorStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                                }`}>
                                  Sup: {report.supervisorStatus}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase text-center ${
                                  report.managerStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                                  report.managerStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                                }`}>
                                  Man: {report.managerStatus}
                                </span>
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setSelectedReport(report)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl transition-all"
                                  title="View Details"
                                >
                                  👁️
                                </button>
                                <button 
                                  onClick={() => {
                                    const comment = prompt('Add comment:', report.supervisorComment || report.managerComment || '');
                                    if (comment !== null) handleApproveDaily(report, 'accepted', comment);
                                  }}
                                  className={`p-2 rounded-xl transition-all ${
                                    (user.role === 'team_leader' && report.supervisorStatus === 'accepted') ||
                                    ((user.role === 'admin' || user.role === 'coordinator') && report.managerStatus === 'accepted')
                                    ? 'bg-emerald-500 text-white' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                  }`}
                                  title="Accept"
                                >
                                  ✓
                                </button>
                                <button 
                                  onClick={() => {
                                    const comment = prompt('Add rejection reason:', report.supervisorComment || report.managerComment || '');
                                    if (comment !== null) handleApproveDaily(report, 'rejected', comment);
                                  }}
                                  className={`p-2 rounded-xl transition-all ${
                                    (user.role === 'team_leader' && report.supervisorStatus === 'rejected') ||
                                    ((user.role === 'admin' || user.role === 'coordinator') && report.managerStatus === 'rejected')
                                    ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                                  }`}
                                  title="Reject"
                                >
                                  ✕
                                </button>
                                <button 
                                  onClick={async () => {
                                    const details = prompt('Enter violation details (leave empty to clear):', report.violationDetails || '');
                                    if (details !== null) {
                                      setSaving(true);
                                      try {
                                        await savePerformanceDailyReport({ 
                                          id: report.id, 
                                          violationRecorded: details.trim() !== '',
                                          violationDetails: details.trim()
                                        }, user);
                                        alert(details.trim() !== '' ? 'Violation recorded.' : 'Violation cleared.');
                                      } catch (err: any) {
                                        console.error(err);
                                        alert('Error: ' + err.message);
                                      } finally {
                                        setSaving(false);
                                      }
                                    }
                                  }}
                                  className={`p-2 rounded-xl transition-all ${report.violationRecorded ? 'text-red-600 bg-red-100' : 'text-slate-400 hover:text-red-500'}`}
                                  title={report.violationRecorded ? `Violation: ${report.violationDetails}` : "Record Violation"}
                                >
                                  ⚠️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {(!filterMissing && filteredReports.length === 0) && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">No reports found matching filters.</td>
                      </tr>
                    )}
                    {(filterMissing && missingTrainers.length === 0) && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">All trainers have submitted for this date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Report View (Trainer View) */}
        {activeTab === 'weekly' && canSubmit && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase">Weekly Performance Summary</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Review your weekly progress and AI-generated summary.</p>
                </div>
                <button 
                  onClick={async () => {
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
                    const weekStartStr = weekStart.toISOString().split('T')[0];
                    const summary = await generateWeeklySummary(user.uid, weekStartStr);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    
                    await savePerformanceWeeklyReport({
                      trainerId: user.uid,
                      trainerName: user.name,
                      weekStart: weekStartStr,
                      weekEnd: weekEnd.toISOString().split('T')[0],
                      aiGeneratedSummary: summary,
                      trainerFinalComment: '',
                      supervisorStatus: 'pending',
                      managerStatus: 'pending'
                    }, user);
                  }}
                  disabled={aiLoading}
                  className="px-8 py-4 bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-600/20 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {aiLoading ? 'Generating...' : 'Generate Weekly Report'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {weeklyReports.map(report => (
                <div key={report.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Week Range</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{report.weekStart} to {report.weekEnd}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                      report.managerStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {report.managerStatus}
                    </span>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Summary</label>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                        {report.aiGeneratedSummary}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Comment</label>
                      <textarea 
                        value={report.trainerFinalComment}
                        onChange={(e) => savePerformanceWeeklyReport({ id: report.id, trainerFinalComment: e.target.value }, user)}
                        className="w-full h-24 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Add your final thoughts for the week..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Daily Report Details</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedReport.trainerName} — {selectedReport.date}</p>
              </div>
              <button 
                onClick={() => setSelectedReport(null)} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Checklist Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Checklist Items</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checklistItems.map(({ key, label }) => {
                    const item = selectedReport.checklist[key as keyof typeof selectedReport.checklist] as { done: boolean; comment: string };
                    return (
                      <div key={key} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {item.done ? 'Done' : 'Not Done'}
                          </span>
                        </div>
                        {item.comment && (
                          <p className="text-[11px] text-slate-500 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            "{item.comment}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dependency & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Blockers & Issues</h4>
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Has Blocker?</span>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${selectedReport.dependencyIssue.hasIssue ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {selectedReport.dependencyIssue.hasIssue ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {selectedReport.dependencyIssue.hasIssue && (
                      <>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blocked By</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedReport.dependencyIssue.blockedByName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Issue Details</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{selectedReport.dependencyIssue.details}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Notes & Complaints</h4>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Complaints</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedReport.complaintsReported || 'No complaints reported.'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Additional Notes</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedReport.additionalNotes || 'No additional notes.'}</p>
                    </div>
                    {selectedReport.links && selectedReport.links.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Report Links</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.links.map((link, idx) => (
                            <a 
                              key={idx} 
                              href={link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-primary-500 hover:text-primary-600 truncate max-w-[200px]"
                            >
                              Link {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Violation Details */}
              {selectedReport.violationRecorded && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest border-b border-red-100 dark:border-red-900/30 pb-2">Violation Record</h4>
                  <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium leading-relaxed">
                      {selectedReport.violationDetails}
                    </p>
                  </div>
                </div>
              )}

              {/* Status & Comments */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Review Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Supervisor</span>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        selectedReport.supervisorStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                        selectedReport.supervisorStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {selectedReport.supervisorStatus}
                      </span>
                    </div>
                    {selectedReport.supervisorComment && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{selectedReport.supervisorComment}"</p>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Manager</span>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        selectedReport.managerStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                        selectedReport.managerStatus === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {selectedReport.managerStatus}
                      </span>
                    </div>
                    {selectedReport.managerComment && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{selectedReport.managerComment}"</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
              <button 
                onClick={() => setSelectedReport(null)}
                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PerformanceReports;
