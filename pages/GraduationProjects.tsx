import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { User, Group, GraduationProject } from '../types';
import { subscribeToCollection, importGraduationProjectToGroups } from '../services/firestore';
import { GraduationCap, ExternalLink, Copy, Search, Calendar, FolderCheck, Users, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface GraduationProjectsProps {
  user: User;
}

const GraduationProjectsPage: React.FC<GraduationProjectsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<GraduationProject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  
  // Import Modal State
  const [importModalProject, setImportModalProject] = useState<GraduationProject | null>(null);
  const [selectedTargetGroupIds, setSelectedTargetGroupIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubProjects = subscribeToCollection<GraduationProject>('graduationProjects', setProjects);
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    return () => {
      unsubProjects();
      unsubGroups();
    };
  }, []);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.groupName && p.groupName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesGroup = !selectedGroupFilter || p.groupId === selectedGroupFilter || (p.assignedGroupIds && p.assignedGroupIds.includes(selectedGroupFilter));
    
    return matchesSearch && matchesGroup;
  });

  const getProjectStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) {
      return { label: 'لم يبدأ التسليم بعد ⏳', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    } else if (now >= start && now <= end) {
      return { label: 'باب التسليم مفتوح 🟢', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    } else {
      return { label: 'انتهى الديدلاين 🔴', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
  };

  const handleOpenImportModal = (project: GraduationProject) => {
    setImportModalProject(project);
    setSelectedTargetGroupIds([]);
    setImportSuccessMsg(null);
  };

  const toggleTargetGroupSelect = (groupId: string) => {
    if (selectedTargetGroupIds.includes(groupId)) {
      setSelectedTargetGroupIds(selectedTargetGroupIds.filter(id => id !== groupId));
    } else {
      setSelectedTargetGroupIds([...selectedTargetGroupIds, groupId]);
    }
  };

  const handleExecuteImport = async () => {
    if (!importModalProject || selectedTargetGroupIds.length === 0) return;
    setIsImporting(true);
    try {
      const targetGroupsObjects = groups
        .filter(g => selectedTargetGroupIds.includes(g.id))
        .map(g => ({ id: g.id, name: g.name }));

      await importGraduationProjectToGroups(importModalProject, targetGroupsObjects, user);
      setImportSuccessMsg(`تم استيراد مشروع التخرج بنجاح إلى ${targetGroupsObjects.length} مجموعة جديدة! 🎉`);
      setTimeout(() => {
        setImportModalProject(null);
        setImportSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      console.error("Error importing project:", err);
      alert("حدث خطأ أثناء استيراد المشروع: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 font-arabic text-right">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-black">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>نظام إدارة مشاريع التخرج بالسيستم 🎓</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                فهرس مشاريع التخرج للمجموعات
              </h1>
              <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
                استعراض كامل لكافة مشاريع التخرج المعتمدة عبر المجموعات المختلفة، مع إمكانية استيراد وتعيين نفس مشروع التخرج لأكثر من دفعة بسهولة.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-2xl shrink-0">
              <div className="text-center px-4 border-l border-slate-800">
                <span className="block text-xl font-black text-white">{projects.length}</span>
                <span className="text-[10px] text-slate-400 font-bold">إجمالي المشاريع</span>
              </div>
              <div className="text-center px-4">
                <span className="block text-xl font-black text-indigo-400">{groups.length}</span>
                <span className="text-[10px] text-slate-400 font-bold">المجموعات النشطة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم البراند، اسم المشروع، أو المجموعات..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-arabic"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 shrink-0">تصفية بالمجموعة:</span>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-arabic w-full md:w-56"
            >
              <option value="">جميع المجموعات</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-3xl">
              🎓
            </div>
            <h3 className="text-lg font-black text-white">لا توجد مشاريع تخرج مضافة حتى الآن</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              يمكنك إضافة مشروعات تخرج جديدة مباشرة من داخل التاب الخاصة بـ "مشاريع التخرج" في تفاصيل أي مجموعة تدريبية.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => {
              const status = getProjectStatus(project.startDate, project.endDate);
              const assignedCount = (project.assignedGroupNames?.length || 0) + 1;

              return (
                <div
                  key={project.id}
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-6 transition-all shadow-lg flex flex-col justify-between gap-6 group hover:shadow-indigo-950/20"
                >
                  <div className="space-y-4">
                    {/* Top Bar Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black border ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        الدفعة الأساسية: {project.groupName}
                      </span>
                    </div>

                    {/* Brand Name & Title */}
                    <div>
                      <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block">
                        🏷️ {project.brandName}
                      </span>
                      <h3 className="text-base font-black text-white mt-1 group-hover:text-indigo-300 transition-colors">
                        {project.title}
                      </h3>
                    </div>

                    {/* Description preview */}
                    {project.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed bg-slate-950/50 p-3 rounded-2xl border border-slate-800/80">
                        {project.description}
                      </p>
                    )}

                    {/* Linked Groups Labels */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-black text-slate-500 block">
                        المجموعات المخصص لها هذا المشروع ({assignedCount}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {project.groupName} ⭐
                        </span>
                        {project.assignedGroupNames?.map((gn, idx) => (
                          <span key={idx} className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {gn}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="block text-slate-500 font-bold">بداية التسليم:</span>
                        <span className="font-mono text-slate-300">{project.startDate ? new Date(project.startDate).toLocaleDateString('ar-EG') : 'غير محدد'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 font-bold">الديدلاين:</span>
                        <span className="font-mono text-rose-300 font-bold">{project.endDate ? new Date(project.endDate).toLocaleDateString('ar-EG') : 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenImportModal(project)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition-all flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                      title="استيراد وتعيين هذا المشروع لدفعة أخرى"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>نسخ لجروب آخر</span>
                    </button>

                    <Link
                      to={`/groups/${project.groupId}?tab=graduationProjects`}
                      className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                      <span>الانتقال للجروب</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Import Modal */}
        {importModalProject && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-arabic text-right">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl relative">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Copy className="w-5 h-5 text-indigo-400" />
                    <span>استيراد وتعيين مشروع التخرج لجروب آخر</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    المشروع الحالي: <strong className="text-indigo-300">{importModalProject.title}</strong> ({importModalProject.brandName})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportModalProject(null)}
                  className="text-slate-500 hover:text-white text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {importSuccessMsg ? (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-black text-emerald-300">{importSuccessMsg}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-300">
                    اختر المجموعات المراد تعيين هذا المشروع لها (سيتم إنشاء نسخة مستقلة لكل مجموعة مع الاحتفاظ بنفس الميعاد والتفاصيل):
                  </label>

                  <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar pr-1">
                    {groups
                      .filter(g => g.id !== importModalProject.groupId)
                      .map(g => {
                        const isAlreadyAssigned = importModalProject.assignedGroupIds?.includes(g.id);
                        const isChecked = selectedTargetGroupIds.includes(g.id);

                        return (
                          <label
                            key={g.id}
                            onClick={() => !isAlreadyAssigned && toggleTargetGroupSelect(g.id)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isAlreadyAssigned
                                ? 'bg-slate-950/40 border-slate-800/50 opacity-60 cursor-not-allowed'
                                : isChecked
                                ? 'bg-indigo-950/40 border-indigo-500/60 text-white'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked || !!isAlreadyAssigned}
                                disabled={!!isAlreadyAssigned}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                              />
                              <div>
                                <span className="font-black text-xs block">{g.name}</span>
                                <span className="text-[10px] text-slate-500">{g.courseName}</span>
                              </div>
                            </div>
                            {isAlreadyAssigned && (
                              <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-lg">
                                معين سابقاً ✓
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setImportModalProject(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={isImporting || selectedTargetGroupIds.length === 0}
                      onClick={handleExecuteImport}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                    >
                      {isImporting ? 'جاري الاستيراد...' : `استيراد إلى (${selectedTargetGroupIds.length}) مجموعات 🚀`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default GraduationProjectsPage;
