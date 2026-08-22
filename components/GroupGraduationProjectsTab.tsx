import React, { useState, useEffect, useMemo } from 'react';
import { where } from 'firebase/firestore';
import { User, Group, Student, GroupRanking, GraduationProject, GraduationProjectSubmission, GraduationProjectEvaluation, GraduationProjectComment } from '../types';
import { subscribeToCollection, saveGraduationProject, saveGraduationProjectEvaluation, saveGraduationProjectComment, deleteGraduationProjectComment, importGraduationProjectToGroups } from '../services/firestore';
import { GraduationCap, Plus, Edit2, ExternalLink, Copy, CheckCircle2, XCircle, AlertCircle, Clock, Link as LinkIcon, MessageSquare, Trash2, Award, ChevronDown, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

interface GroupGraduationProjectsTabProps {
  group: Group;
  students: Student[];
  rankings: GroupRanking[];
  user: User;
}

export const GroupGraduationProjectsTab: React.FC<GroupGraduationProjectsTabProps> = ({
  group,
  students,
  rankings,
  user
}) => {
  const [projects, setProjects] = useState<GraduationProject[]>([]);
  const [submissions, setSubmissions] = useState<GraduationProjectSubmission[]>([]);
  const [evaluations, setEvaluations] = useState<GraduationProjectEvaluation[]>([]);
  const [comments, setComments] = useState<GraduationProjectComment[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  // Modals & Active Selections
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<GraduationProject | null>(null);

  // Project Form State
  const [projectForm, setProjectForm] = useState({
    title: '',
    brandName: '',
    description: '',
    requirements: '',
    telegramChannelLink: '',
    submissionGuideVideoLink: '',
    extraLinks: [] as { title: string; url: string }[],
    startDate: '',
    endDate: '',
    rules: ''
  });
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTargetGroupIds, setSelectedTargetGroupIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Student Evaluation Modal State
  const [evaluatingStudent, setEvaluatingStudent] = useState<Student | null>(null);
  const [evalForm, setEvalForm] = useState({
    c1_submission: 2,
    c2_noPixelatedNoSizeErr: 2,
    c3_typography: 2,
    c4_aiUsage: 2,
    c5_reference: 2,
    c6_completeFilesOpenLinks: 2,
    bonusPoints: 0,
    deductionPoints: 0,
    deductionReason: '',
    isExtraWorkshopsEligible: true,
    isRejected: false,
    rejectionReason: ''
  });
  const [isSavingEval, setIsSavingEval] = useState(false);

  // Student Design Comments Modal State
  const [commentsStudent, setCommentsStudent] = useState<Student | null>(null);
  const [commentTitle, setCommentTitle] = useState('تصميم 1');
  const [commentText, setCommentText] = useState('');
  const [commentDesignLink, setCommentDesignLink] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [isSavingComment, setIsSavingComment] = useState(false);

  // View Submission Modal State
  const [viewingSubmissionStudent, setViewingSubmissionStudent] = useState<Student | null>(null);

  // Table Filters & Search
  const [filterMode, setFilterMode] = useState<'all' | 'submitted' | 'not_submitted'>('all');
  const [sortMode, setSortMode] = useState<'rank' | 'date' | 'name' | 'score'>('rank');
  const [searchQuery, setSearchQuery] = useState('');

  // Subscriptions
  useEffect(() => {
    const unsubP = subscribeToCollection<GraduationProject>('graduationProjects', setProjects, [
      firestoreWhere('groupId', '==', group.id)
    ]);
    const unsubSub = subscribeToCollection<GraduationProjectSubmission>('graduationSubmissions', setSubmissions, [
      firestoreWhere('groupId', '==', group.id)
    ]);
    const unsubEval = subscribeToCollection<GraduationProjectEvaluation>('graduationEvaluations', setEvaluations, [
      firestoreWhere('groupId', '==', group.id)
    ]);
    const unsubCom = subscribeToCollection<GraduationProjectComment>('graduationComments', setComments, [
      firestoreWhere('groupId', '==', group.id)
    ]);
    const unsubG = subscribeToCollection<Group>('groups', setAllGroups);

    return () => {
      unsubP();
      unsubSub();
      unsubEval();
      unsubCom();
      unsubG();
    };
  }, [group.id]);

  function firestoreWhere(field: string, op: any, value: any) {
    return where(field, op, value);
  }

  const activeProject = projects[0] || null;

  // Open Project Creation / Edit Modal
  const handleOpenProjectModal = (projToEdit?: GraduationProject) => {
    if (projToEdit) {
      setEditingProject(projToEdit);
      setProjectForm({
        title: projToEdit.title,
        brandName: projToEdit.brandName,
        description: projToEdit.description || '',
        requirements: projToEdit.requirements || '',
        telegramChannelLink: projToEdit.telegramChannelLink || '',
        submissionGuideVideoLink: projToEdit.submissionGuideVideoLink || '',
        extraLinks: projToEdit.extraLinks || [],
        startDate: projToEdit.startDate || '',
        endDate: projToEdit.endDate || '',
        rules: projToEdit.rules || ''
      });
    } else {
      setEditingProject(null);
      setProjectForm({
        title: '',
        brandName: '',
        description: '',
        requirements: '',
        telegramChannelLink: '',
        submissionGuideVideoLink: '',
        extraLinks: [],
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        rules: '1. الالتزام بتحديد مقاسات التصميم بدقة.\n2. تسليم ملف العمل المفتوح بدقة عالية.\n3. الالتزام بالهوية البصرية المحددة للبراند.'
      });
    }
    setIsProjectModalOpen(true);
  };

  // Add / Remove Extra Link in Project Form
  const handleAddExtraLinkForm = () => {
    setProjectForm({
      ...projectForm,
      extraLinks: [...projectForm.extraLinks, { title: '', url: '' }]
    });
  };

  const handleUpdateExtraLinkForm = (idx: number, field: 'title' | 'url', val: string) => {
    const updated = [...projectForm.extraLinks];
    updated[idx][field] = val;
    setProjectForm({ ...projectForm, extraLinks: updated });
  };

  const handleRemoveExtraLinkForm = (idx: number) => {
    setProjectForm({
      ...projectForm,
      extraLinks: projectForm.extraLinks.filter((_, i) => i !== idx)
    });
  };

  // Save Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim() || !projectForm.brandName.trim()) {
      alert('يرجى ملء اسم المشروع واسم البراند.');
      return;
    }

    setIsSavingProject(true);
    try {
      await saveGraduationProject({
        id: editingProject?.id,
        groupId: group.id,
        groupName: group.name,
        courseName: group.courseName || '',
        title: projectForm.title.trim(),
        brandName: projectForm.brandName.trim(),
        description: projectForm.description.trim(),
        requirements: projectForm.requirements.trim(),
        telegramChannelLink: projectForm.telegramChannelLink.trim(),
        submissionGuideVideoLink: projectForm.submissionGuideVideoLink.trim(),
        extraLinks: projectForm.extraLinks.filter(l => l.title.trim() && l.url.trim()),
        startDate: projectForm.startDate,
        endDate: projectForm.endDate,
        rules: projectForm.rules.trim()
      }, user);

      setIsProjectModalOpen(false);
    } catch (err: any) {
      console.error("Error saving graduation project:", err);
      alert("حدث خطأ أثناء حفظ مشروع التخرج: " + err.message);
    } finally {
      setIsSavingProject(false);
    }
  };

  // Open Evaluation Modal for Student
  const handleOpenEvaluationModal = (student: Student) => {
    setEvaluatingStudent(student);
    const existingEval = evaluations.find(e => e.studentId === student.id);
    if (existingEval) {
      setEvalForm({
        c1_submission: existingEval.c1_submission ?? 2,
        c2_noPixelatedNoSizeErr: existingEval.c2_noPixelatedNoSizeErr ?? 2,
        c3_typography: existingEval.c3_typography ?? 2,
        c4_aiUsage: existingEval.c4_aiUsage ?? 2,
        c5_reference: existingEval.c5_reference ?? 2,
        c6_completeFilesOpenLinks: existingEval.c6_completeFilesOpenLinks ?? 2,
        bonusPoints: existingEval.bonusPoints || 0,
        deductionPoints: existingEval.deductionPoints || 0,
        deductionReason: existingEval.deductionReason || '',
        isExtraWorkshopsEligible: existingEval.isExtraWorkshopsEligible !== false,
        isRejected: !!existingEval.isRejected,
        rejectionReason: existingEval.rejectionReason || ''
      });
    } else {
      setEvalForm({
        c1_submission: 2,
        c2_noPixelatedNoSizeErr: 2,
        c3_typography: 2,
        c4_aiUsage: 2,
        c5_reference: 2,
        c6_completeFilesOpenLinks: 2,
        bonusPoints: 0,
        deductionPoints: 0,
        deductionReason: '',
        isExtraWorkshopsEligible: true,
        isRejected: false,
        rejectionReason: ''
      });
    }
  };

  // Computed Evaluation Total
  const calculatedEvalTotal = useMemo(() => {
    if (evalForm.isRejected) return 0;
    const base = 
      Number(evalForm.c1_submission) +
      Number(evalForm.c2_noPixelatedNoSizeErr) +
      Number(evalForm.c3_typography) +
      Number(evalForm.c4_aiUsage) +
      Number(evalForm.c5_reference) +
      Number(evalForm.c6_completeFilesOpenLinks);
    
    const final = base + Number(evalForm.bonusPoints || 0) - Number(evalForm.deductionPoints || 0);
    return Math.max(0, final);
  }, [evalForm]);

  // Save Evaluation
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !evaluatingStudent) return;

    if (evalForm.deductionPoints > 0 && !evalForm.deductionReason.trim()) {
      alert('يرجى توضيح سبب الخصم.');
      return;
    }

    if (evalForm.isRejected && !evalForm.rejectionReason.trim()) {
      alert('يرجى توضيح سبب رفض مشروع التخرج.');
      return;
    }

    setIsSavingEval(true);
    try {
      await saveGraduationProjectEvaluation({
        projectId: activeProject.id,
        groupId: group.id,
        studentId: evaluatingStudent.id,
        studentName: evaluatingStudent.name,
        c1_submission: Number(evalForm.c1_submission),
        c2_noPixelatedNoSizeErr: Number(evalForm.c2_noPixelatedNoSizeErr),
        c3_typography: Number(evalForm.c3_typography),
        c4_aiUsage: Number(evalForm.c4_aiUsage),
        c5_reference: Number(evalForm.c5_reference),
        c6_completeFilesOpenLinks: Number(evalForm.c6_completeFilesOpenLinks),
        bonusPoints: Number(evalForm.bonusPoints || 0),
        deductionPoints: Number(evalForm.deductionPoints || 0),
        deductionReason: evalForm.deductionReason.trim(),
        isExtraWorkshopsEligible: evalForm.isExtraWorkshopsEligible,
        isRejected: evalForm.isRejected,
        rejectionReason: evalForm.rejectionReason.trim(),
        totalScore: calculatedEvalTotal
      }, user);

      setEvaluatingStudent(null);
    } catch (err: any) {
      console.error("Error saving evaluation:", err);
      alert("حدث خطأ أثناء حفظ تقييم مشروع التخرج: " + err.message);
    } finally {
      setIsSavingEval(false);
    }
  };

  // Open Design Comments Modal
  const handleOpenCommentsModal = (student: Student) => {
    setCommentsStudent(student);
    const studentComments = comments.filter(c => c.studentId === student.id);
    setCommentTitle(`تصميم ${studentComments.length + 1}`);
    setCommentText('');
    setCommentDesignLink('');
    setEditingCommentId(null);
  };

  // Save Design Comment
  const handleSaveComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !commentsStudent || !commentText.trim()) return;

    setIsSavingComment(true);
    try {
      await saveGraduationProjectComment({
        id: editingCommentId || undefined,
        projectId: activeProject.id,
        groupId: group.id,
        studentId: commentsStudent.id,
        title: commentTitle.trim() || 'تصميم',
        comment: commentText.trim(),
        designLink: commentDesignLink.trim()
      }, user);

      setCommentTitle(`تصميم ${comments.filter(c => c.studentId === commentsStudent.id).length + 2}`);
      setCommentText('');
      setCommentDesignLink('');
      setEditingCommentId(null);
    } catch (err: any) {
      console.error("Error saving comment:", err);
      alert("حدث خطأ أثناء حفظ التعليق: " + err.message);
    } finally {
      setIsSavingComment(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('هل أنت تأكد من حذف هذا التعليق؟')) return;
    try {
      await deleteGraduationProjectComment(commentId);
    } catch (err: any) {
      console.error("Error deleting comment:", err);
    }
  };

  // Processed Students List (Sorting & Filtering)
  const processedStudents = useMemo(() => {
    let list = students.map(s => {
      const rankObj = rankings.find(r => r.studentId === s.id);
      const subObj = submissions.find(sb => sb.studentId === s.id);
      const evalObj = evaluations.find(ev => ev.studentId === s.id);
      const studentComms = comments.filter(cm => cm.studentId === s.id);

      const rankScoreBefore = rankObj ? (rankObj.lectureTotal || 0) - (rankObj.penaltiesTotal || 0) : 0;
      const rankScoreAfter = rankObj ? (rankObj.finalScore || 0) : rankScoreBefore;

      return {
        ...s,
        ranking: rankObj,
        submission: subObj,
        evaluation: evalObj,
        commentsCount: studentComms.length,
        rankScoreBefore,
        rankScoreAfter,
        isSubmitted: !!subObj?.driveLink
      };
    });

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.studentIdNum?.toLowerCase().includes(q));
    }

    // Submission status filter
    if (filterMode === 'submitted') {
      list = list.filter(s => s.isSubmitted);
    } else if (filterMode === 'not_submitted') {
      list = list.filter(s => !s.isSubmitted);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortMode === 'rank') {
        return (b.rankScoreAfter || 0) - (a.rankScoreAfter || 0);
      } else if (sortMode === 'date') {
        const dateA = a.submission?.submittedAt ? new Date(a.submission.submittedAt).getTime() : 0;
        const dateB = b.submission?.submittedAt ? new Date(b.submission.submittedAt).getTime() : 0;
        return dateB - dateA;
      } else if (sortMode === 'name') {
        return a.name.localeCompare(b.name, 'ar');
      } else if (sortMode === 'score') {
        return (b.evaluation?.totalScore || 0) - (a.evaluation?.totalScore || 0);
      }
      return 0;
    });

    return list;
  }, [students, rankings, submissions, evaluations, comments, searchQuery, filterMode, sortMode]);

  // Project Deadline Status
  const projectDeadlineStatus = useMemo(() => {
    if (!activeProject) return null;
    const now = new Date();
    const start = new Date(activeProject.startDate);
    const end = new Date(activeProject.endDate);

    if (now < start) {
      return { label: 'لم يبدأ موعد التسليم بعد ⏳', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    } else if (now >= start && now <= end) {
      return { label: 'باب التسليم مفتوح للطلاب 🟢', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    } else {
      return { label: 'انتهى الديدلاين - تم إغلاق التعديل 🔴', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
  }, [activeProject]);

  return (
    <div className="space-y-8 font-arabic text-right">
      
      {/* Top Header & Project Overview */}
      {!activeProject ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-xl">
          <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-lg shadow-indigo-950/30">
            🎓
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-black text-white">لم يتم إضافة مشروع تخرج لهذا الجروب بعد</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              يمكنك إضافة مشروع تخرج جديد وتحديد البراند والقواعد ورابط تليجرام وفيديو التسليم لتبدأ عملية تقييم ومتابعة تسليمات المتدربين.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenProjectModal()}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-xl shadow-indigo-600/30 inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>بدء مشروع تخرج جديد 🚀</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Project Details Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                  🏷️ البراند: {activeProject.brandName}
                </span>
                {projectDeadlineStatus && (
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black border ${projectDeadlineStatus.color}`}>
                    {projectDeadlineStatus.label}
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">
                {activeProject.title}
              </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenProjectModal(activeProject)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>تعديل تفاصيل المشروع</span>
              </button>
            </div>
          </div>

          {/* Project Content Bento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* Description & Requirements */}
            <div className="lg:col-span-2 space-y-4">
              {activeProject.description && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-black text-indigo-400 block">📌 تفاصيل مشروع التخرج:</span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{activeProject.description}</p>
                </div>
              )}

              {activeProject.requirements && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-black text-amber-400 block">🎯 المطلوب من المتدرب:</span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{activeProject.requirements}</p>
                </div>
              )}

              {activeProject.rules && (
                <div className="bg-rose-950/20 p-4 rounded-2xl border border-rose-500/20 space-y-1.5">
                  <span className="text-[11px] font-black text-rose-400 block">⚠️ القواعد الأساسية للمشروع (لا يجب الخروج عنها):</span>
                  <p className="text-xs text-rose-200 leading-relaxed whitespace-pre-wrap">{activeProject.rules}</p>
                </div>
              )}
            </div>

            {/* Links & Dates Sidebar Card */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 h-fit">
              <span className="text-xs font-black text-slate-300 block border-b border-slate-800 pb-2">🔗 الروابط ومواعيد التسليم:</span>

              <div className="space-y-2 text-xs">
                {activeProject.telegramChannelLink && (
                  <a
                    href={activeProject.telegramChannelLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold flex items-center justify-between transition-all"
                  >
                    <span>💬 تفاصيل المشروع على تليجرام</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {activeProject.submissionGuideVideoLink && (
                  <a
                    href={activeProject.submissionGuideVideoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold flex items-center justify-between transition-all"
                  >
                    <span>📺 فيديو شرح طريقة التسليم</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {activeProject.extraLinks?.map((l, idx) => (
                  <a
                    key={idx}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold flex items-center justify-between transition-all"
                  >
                    <span>🔗 {l.title}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span>موعد فتح التسليم:</span>
                  <span className="font-mono text-slate-200 font-bold">{activeProject.startDate ? new Date(activeProject.startDate).toLocaleString('ar-EG') : 'غير محدد'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>موعد الديدلاين (النهاية):</span>
                  <span className="font-mono text-rose-400 font-bold">{activeProject.endDate ? new Date(activeProject.endDate).toLocaleString('ar-EG') : 'غير محدد'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] font-black text-slate-500 uppercase block">إجمالي طلاب الدفعة</span>
              <span className="text-lg font-black text-white">{students.length}</span>
            </div>
            <div className="bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-500/30 text-center">
              <span className="text-[10px] font-black text-emerald-400 uppercase block">تم التسليم 🟢</span>
              <span className="text-lg font-black text-emerald-300">{submissions.filter(s => s.driveLink).length}</span>
            </div>
            <div className="bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-500/30 text-center">
              <span className="text-[10px] font-black text-indigo-400 uppercase block">تم التقييم ⭐</span>
              <span className="text-lg font-black text-indigo-300">{evaluations.length}</span>
            </div>
            <div className="bg-rose-950/30 p-3.5 rounded-2xl border border-rose-500/30 text-center">
              <span className="text-[10px] font-black text-rose-400 uppercase block">لم يسلموا بعد 🔴</span>
              <span className="text-lg font-black text-rose-300">{students.length - submissions.filter(s => s.driveLink).length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Submissions & Evaluations Table Section */}
      {activeProject && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-6">
          
          {/* Table Header Controls */}
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950/40">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>📋 جدول تسليمات وتقييمات مشاريع التخرج</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                  {processedStudents.length} طالب
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                عرض ترتيب الطلاب وحالة التسليم والتقييم، مع إمكانية التعليق على التصاميم الفردية وإضافة النقاط للرانك.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Submission Filter */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterMode === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('submitted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterMode === 'submitted' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  سلموا فقط 🟢
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('not_submitted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterMode === 'not_submitted' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  لم يسلموا 🔴
                </button>
              </div>

              {/* Sorting Mode */}
              <select
                value={sortMode}
                onChange={(e: any) => setSortMode(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-arabic"
              >
                <option value="rank">الترتيب: الأعلى رانك (افتراضي)</option>
                <option value="date">الترتيب: تاريخ التسليم الأحدث</option>
                <option value="name">الترتيب: الأبجدي باسم الطالب</option>
                <option value="score">الترتيب: درجات المشروع</option>
              </select>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الطالب..."
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-arabic w-36 md:w-48"
              />
            </div>
          </div>

          {/* Trainees List Table */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 font-black uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">الطالب والـ ID</th>
                  <th className="px-6 py-4 text-center">الرانك (قبل ➔ بعد)</th>
                  <th className="px-6 py-4">حالة التسليم والروابط</th>
                  <th className="px-6 py-4 text-center">تقييم مشروع التخرج</th>
                  <th className="px-6 py-4 text-center">تعليقات التصاميم</th>
                  <th className="px-6 py-4 text-center font-arabic">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-arabic">
                {processedStudents.map((st, index) => {
                  const isSubmitted = st.isSubmitted;
                  const evalObj = st.evaluation;

                  return (
                    <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Index */}
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{index + 1}</td>

                      {/* Student Name & ID */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-200 text-sm">{st.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">ID: {st.studentIdNum || 'غير محدد'}</span>
                        </div>
                      </td>

                      {/* Rank Score Side-By-Side */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-xs">
                          <span className="text-slate-400">{st.rankScoreBefore}</span>
                          <span className="text-slate-600">➔</span>
                          <span className={`font-black ${st.rankScoreAfter > st.rankScoreBefore ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {st.rankScoreAfter}
                          </span>
                        </div>
                      </td>

                      {/* Submission Status & Drive Link */}
                      <td className="px-6 py-4">
                        {isSubmitted ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                🟢 تم التسليم
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {st.submission?.submittedAt ? new Date(st.submission.submittedAt).toLocaleDateString('ar-EG') : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewingSubmissionStudent(st)}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-4 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>عرض روابط درايف والملفات</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              🔴 لم يسلم بعد
                            </span>
                            {st.submission?.unsubmittedReason && (
                              <p className="text-[10px] text-amber-300 bg-amber-950/20 p-1.5 rounded-lg border border-amber-500/20">
                                💬 سبب عدم التسليم: {st.submission.unsubmittedReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Evaluation Total Score Badge */}
                      <td className="px-6 py-4 text-center">
                        {evalObj ? (
                          evalObj.isRejected ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-950/60 text-rose-300 border border-rose-500/40 block w-fit mx-auto">
                              ❌ مرفوض ({evalObj.rejectionReason || 'غير ملتزم'})
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                {evalObj.totalScore} نقطة ⭐
                              </span>
                              {evalObj.isExtraWorkshopsEligible && (
                                <span className="text-[9px] text-emerald-400 font-bold mt-0.5">
                                  ✓ مؤهل للورش الإضافية
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">لم يُقيّم بعد</span>
                        )}
                      </td>

                      {/* Comments Count Badge */}
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenCommentsModal(st)}
                          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          <span>({st.commentsCount}) تعليق</span>
                        </button>
                      </td>

                      {/* Action Button */}
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEvaluationModal(st)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          {evalObj ? 'تعديل التقييم ✏️' : 'رصد التقييم 📝'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Form Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-arabic text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <span>{editingProject ? 'تعديل تفاصيل مشروع التخرج' : 'بدء مشروع تخرج جديد'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="text-slate-500 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">اسم مشروع التخرج *</label>
                  <input
                    type="text"
                    required
                    value={projectForm.title}
                    onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                    placeholder="مثال: الهوية البصرية والتصاميم الإعلانية الشاملة"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">اسم البراند *</label>
                  <input
                    type="text"
                    required
                    value={projectForm.brandName}
                    onChange={(e) => setProjectForm({ ...projectForm, brandName: e.target.value })}
                    placeholder="مثال: قهوة الأصيل Al Aseel Coffee"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">تفاصيل ومفهوم المشروع</label>
                <textarea
                  rows={3}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="شرح مختصر عن البراند ورؤيته والجمهور المستهدف..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">المطلوب تسليمه من المتدرب</label>
                <textarea
                  rows={3}
                  value={projectForm.requirements}
                  onChange={(e) => setProjectForm({ ...projectForm, requirements: e.target.value })}
                  placeholder="مثال: شعار البراند الرئيسي + 3 تصاميم سوشيال ميديا + المطبوعات..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">لينك المشروع التفصيلي على تليجرام</label>
                  <input
                    type="url"
                    value={projectForm.telegramChannelLink}
                    onChange={(e) => setProjectForm({ ...projectForm, telegramChannelLink: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">رابط فيديو الشرح الخاص بطريقة التسليم</label>
                  <input
                    type="url"
                    value={projectForm.submissionGuideVideoLink}
                    onChange={(e) => setProjectForm({ ...projectForm, submissionGuideVideoLink: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">تاريخ ووقت بدء التسليم</label>
                  <input
                    type="datetime-local"
                    value={projectForm.startDate}
                    onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">موعد نهاية التسليم (الديدلاين)</label>
                  <input
                    type="datetime-local"
                    value={projectForm.endDate}
                    onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">القواعد الأساسية للمشروع التي لا يجب الخروج عنها</label>
                <textarea
                  rows={3}
                  value={projectForm.rules}
                  onChange={(e) => setProjectForm({ ...projectForm, rules: e.target.value })}
                  placeholder="القواعد والشروط الفنية الهامة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Extra Links Builder */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-300">روابط إضافية اختياري (اسم اللينك واللينك نفسها):</span>
                  <button
                    type="button"
                    onClick={handleAddExtraLinkForm}
                    className="text-[11px] font-bold text-indigo-400 hover:underline cursor-pointer"
                  >
                    + إضافة رابط
                  </button>
                </div>

                {projectForm.extraLinks.map((l, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="عنوان الرابط (مثال: ملحقات الفوتوشوب)"
                      value={l.title}
                      onChange={(e) => handleUpdateExtraLinkForm(idx, 'title', e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="url"
                      placeholder="الرابط https://..."
                      value={l.url}
                      onChange={(e) => handleUpdateExtraLinkForm(idx, 'url', e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraLinkForm(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingProject}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {isSavingProject ? 'جاري الحفظ...' : 'حفظ مشروع التخرج 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      {evaluatingStudent && activeProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-arabic text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  <span>تقييم مشروع التخرج للطالب: {evaluatingStudent.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">ID: {evaluatingStudent.studentIdNum}</p>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingStudent(null)}
                className="text-slate-500 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-5">
              {/* Rejection Option Toggle */}
              <div className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isRejected"
                  checked={evalForm.isRejected}
                  onChange={(e) => setEvalForm({ ...evalForm, isRejected: e.target.checked })}
                  className="w-5 h-5 rounded border-rose-500 text-rose-600 focus:ring-rose-500 bg-slate-950 mt-0.5 cursor-pointer"
                />
                <div className="space-y-1 flex-1">
                  <label htmlFor="isRejected" className="font-black text-xs text-rose-300 block cursor-pointer">
                    رفض مشروع التخرج لعدم الالتزام بالقواعد ❌
                  </label>
                  <p className="text-[10px] text-rose-400">
                    عند التحديد، سيتم رصد النتيجة كمرفوض مع توضيح السبب المكتوب للمتدرب في البورتال.
                  </p>

                  {evalForm.isRejected && (
                    <textarea
                      required
                      rows={2}
                      value={evalForm.rejectionReason}
                      onChange={(e) => setEvalForm({ ...evalForm, rejectionReason: e.target.value })}
                      placeholder="اكتب سبب رفض المشروع هنا ليصل للمتدرب..."
                      className="w-full bg-slate-950 border border-rose-500/40 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 mt-2"
                    />
                  )}
                </div>
              </div>

              {!evalForm.isRejected && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-300 block border-b border-slate-800 pb-2">
                    معايير التقييم الأساسية (نقطتان لكل معيار - الإجمالي 12):
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Criterion 1 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">1. تسليم المشروع:</span>
                        <span className="font-black text-indigo-400">{evalForm.c1_submission} / 2</span>
                      </div>
                      <select
                        value={evalForm.c1_submission}
                        onChange={(e) => setEvalForm({ ...evalForm, c1_submission: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (مكتمل وحصل على النقطتين بالكامل)</option>
                        <option value={1}>1 (نقطة واحدة - تسليم جزئي)</option>
                        <option value={0}>0 (لم يحصل على نقطة)</option>
                      </select>
                    </div>

                    {/* Criterion 2 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">2. عدم استخدام صور مبكسلة والالتزام بالمقاس:</span>
                        <span className="font-black text-indigo-400">{evalForm.c2_noPixelatedNoSizeErr} / 2</span>
                      </div>
                      <select
                        value={evalForm.c2_noPixelatedNoSizeErr}
                        onChange={(e) => setEvalForm({ ...evalForm, c2_noPixelatedNoSizeErr: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (الالتزام بالمقاس وجودة الصور ممتازة)</option>
                        <option value={1}>1 (ملاحظات بسيطة على الجودة أو المقاس)</option>
                        <option value={0}>0 (صور مبكسلة أو مقاسات خاطئة)</option>
                      </select>
                    </div>

                    {/* Criterion 3 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">3. تايبوجرافي كويس:</span>
                        <span className="font-black text-indigo-400">{evalForm.c3_typography} / 2</span>
                      </div>
                      <select
                        value={evalForm.c3_typography}
                        onChange={(e) => setEvalForm({ ...evalForm, c3_typography: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (تايبوجرافي ممتاز ومريح)</option>
                        <option value={1}>1 (تايبوجرافي مقبول مع ملاحظات)</option>
                        <option value={0}>0 (ضعيف جداً)</option>
                      </select>
                    </div>

                    {/* Criterion 4 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">4. استخدام الـ AI بشكل مناسب وعدم الاعتماد الكلي:</span>
                        <span className="font-black text-indigo-400">{evalForm.c4_aiUsage} / 2</span>
                      </div>
                      <select
                        value={evalForm.c4_aiUsage}
                        onChange={(e) => setEvalForm({ ...evalForm, c4_aiUsage: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (استخدام ذكي ومتوازن للذكاء الاصطناعي)</option>
                        <option value={1}>1 (اعتماد زائد نسبياً)</option>
                        <option value={0}>0 (اعتماد كلي دون لمسة تصميمية)</option>
                      </select>
                    </div>

                    {/* Criterion 5 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">5. أخذ ريفرانس والتحرك بناءً عليه:</span>
                        <span className="font-black text-indigo-400">{evalForm.c5_reference} / 2</span>
                      </div>
                      <select
                        value={evalForm.c5_reference}
                        onChange={(e) => setEvalForm({ ...evalForm, c5_reference: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (استلهام ممتاز وتطبيق احترافي)</option>
                        <option value={1}>1 (تطبيق متوسط)</option>
                        <option value={0}>0 (بدون تغذية بصرية أو ريفرانس)</option>
                      </select>
                    </div>

                    {/* Criterion 6 */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">6. مسلم الملفات كاملة + اللينكات مفتوحة:</span>
                        <span className="font-black text-indigo-400">{evalForm.c6_completeFilesOpenLinks} / 2</span>
                      </div>
                      <select
                        value={evalForm.c6_completeFilesOpenLinks}
                        onChange={(e) => setEvalForm({ ...evalForm, c6_completeFilesOpenLinks: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      >
                        <option value={2}>2 (تسليم كامل والروابط مفتوحة للجميع)</option>
                        <option value={1}>1 (ملفات ناقصة جزئياً)</option>
                        <option value={0}>0 (روابط مغلقة أو ملفات مفقودة)</option>
                      </select>
                    </div>
                  </div>

                  {/* Bonus & Deduction Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-500/20 space-y-2">
                      <span className="text-xs font-black text-emerald-400 block">+ نقاط إضافية للمدرب (Bonus):</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={evalForm.bonusPoints}
                        onChange={(e) => setEvalForm({ ...evalForm, bonusPoints: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="bg-amber-950/20 p-3.5 rounded-2xl border border-amber-500/20 space-y-2">
                      <span className="text-xs font-black text-amber-400 block">- خصم نقاط (Deduction):</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={evalForm.deductionPoints}
                        onChange={(e) => setEvalForm({ ...evalForm, deductionPoints: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white mb-2"
                      />
                      {evalForm.deductionPoints > 0 && (
                        <input
                          type="text"
                          required
                          placeholder="سبب الخصم..."
                          value={evalForm.deductionReason}
                          onChange={(e) => setEvalForm({ ...evalForm, deductionReason: e.target.value })}
                          className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      )}
                    </div>
                  </div>

                  {/* Extra Workshops Eligibility Toggle */}
                  <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-2xl flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isExtraWorkshopsEligible"
                      checked={evalForm.isExtraWorkshopsEligible}
                      onChange={(e) => setEvalForm({ ...evalForm, isExtraWorkshopsEligible: e.target.checked })}
                      className="w-5 h-5 rounded border-indigo-500 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                    <label htmlFor="isExtraWorkshopsEligible" className="font-black text-xs text-indigo-200 cursor-pointer">
                      له الحق في دخول الورش الإضافية المتاحة 🎉
                    </label>
                  </div>

                  {/* Final Points Summary Badge */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-300">إجمالي النقاط النهائية لمشروع التخرج:</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {calculatedEvalTotal} نقطة
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEvaluatingStudent(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEval}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {isSavingEval ? 'جاري الحفظ...' : 'حفظ التقييم ومزامنة الرانك 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Design Comments Modal */}
      {commentsStudent && activeProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-arabic text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span>تعليقات وملاحظات التصاميم للمتدرب: {commentsStudent.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">كتابة تعليقات فردية لمكل تصميم على حده مع لينك التصميم اختياري.</p>
              </div>
              <button
                type="button"
                onClick={() => setCommentsStudent(null)}
                className="text-slate-500 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Existing Comments List */}
            <div className="space-y-3">
              <span className="text-xs font-black text-slate-300 block">التعليقات المضافة حالياً:</span>
              {comments.filter(c => c.studentId === commentsStudent.id).length === 0 ? (
                <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-2xl text-center">
                  لا توجد تعليقات فردية مضافة لهذا الطالب بعد.
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {comments.filter(c => c.studentId === commentsStudent.id).map(cm => (
                    <div key={cm.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative group">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-black text-indigo-400">{cm.title}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(cm.id);
                              setCommentTitle(cm.title);
                              setCommentText(cm.comment);
                              setCommentDesignLink(cm.designLink || '');
                            }}
                            className="text-slate-400 hover:text-white text-xs font-bold"
                          >
                            تعديل ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(cm.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-bold"
                          >
                            حذف 🗑️
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{cm.comment}</p>
                      {cm.designLink && (
                        <a
                          href={cm.designLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 underline font-bold"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>عرض التصميم المقصود</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add / Edit Comment Form */}
            <form onSubmit={handleSaveComment} className="space-y-4 pt-4 border-t border-slate-800">
              <span className="text-xs font-black text-indigo-400 block">
                {editingCommentId ? 'تعديل التعليق المحدد:' : 'إضافة تعليق تصميم جديد:'}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم/عنوان التصميم *</label>
                  <input
                    type="text"
                    required
                    value={commentTitle}
                    onChange={(e) => setCommentTitle(e.target.value)}
                    placeholder="مثال: تصميم 1 أو تصميم السوشيال ميديا"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">لينك التصميم المقصود (اختياري)</label>
                  <input
                    type="url"
                    value={commentDesignLink}
                    onChange={(e) => setCommentDesignLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">نص الملاحظة والتقييم *</label>
                <textarea
                  required
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="اكتب ملاحظاتك الفنية وتوجيهاتك للتصميم..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingCommentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(null);
                      setCommentTitle('تصميم');
                      setCommentText('');
                      setCommentDesignLink('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    إلغاء التعديل
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingComment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all cursor-pointer"
                >
                  {isSavingComment ? 'جاري الحفظ...' : editingCommentId ? 'حفظ التعديل 💾' : 'إضافة التعليق 💬'}
                </button>
              </div>
            </form>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setCommentsStudent(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Submission Modal */}
      {viewingSubmissionStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-arabic text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-indigo-400" />
                  <span>تفاصيل تسليم الطالب: {viewingSubmissionStudent.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">ID: {viewingSubmissionStudent.studentIdNum}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubmissionStudent(null)}
                className="text-slate-500 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {viewingSubmissionStudent.submission ? (
              <div className="space-y-4 text-xs">
                {/* Drive Link */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-black text-indigo-400 block">📁 رابط درايف المشروع الرئيسي:</span>
                  <a
                    href={viewingSubmissionStudent.submission.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold block text-center transition-all underline"
                  >
                    فتح رابط الدرايف في نافذة جديدة ↗
                  </a>
                </div>

                {/* Confirmations Checklist */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-black text-slate-300 block">☑ التأكيدات المقرة من الطالب:</span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={viewingSubmissionStudent.submission.checkConfirmedOpen ? 'text-emerald-400' : 'text-rose-400'}>
                        {viewingSubmissionStudent.submission.checkConfirmedOpen ? '✓' : '✕'}
                      </span>
                      <span className="text-slate-300">تأكيد أن رابط الدرايف مفتوح للجميع (Anyone with link)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={viewingSubmissionStudent.submission.checkUploadedEditableFiles ? 'text-emerald-400' : 'text-rose-400'}>
                        {viewingSubmissionStudent.submission.checkUploadedEditableFiles ? '✓' : '✕'}
                      </span>
                      <span className="text-slate-300">تأكيد رفع الملفات المفتوحة القابلة للتعديل والصور النهائية</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={viewingSubmissionStudent.submission.checkReadRules ? 'text-emerald-400' : 'text-rose-400'}>
                        {viewingSubmissionStudent.submission.checkReadRules ? '✓' : '✕'}
                      </span>
                      <span className="text-slate-300">تأكيد قراءة والالتزام بكافة القواعد الأساسية للمشروع</span>
                    </div>
                  </div>
                </div>

                {/* Extra Links */}
                {viewingSubmissionStudent.submission.extraLinks && viewingSubmissionStudent.submission.extraLinks.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-black text-slate-300 block">🔗 روابط إضافية مسلمة:</span>
                    {viewingSubmissionStudent.submission.extraLinks.map((el, idx) => (
                      <a
                        key={idx}
                        href={el.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-900 text-indigo-300 border border-slate-800 block hover:bg-slate-800 transition-all"
                      >
                        {el.title || 'رابط إضافي'}: {el.url}
                      </a>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-500 font-mono text-center pt-2">
                  تاريخ التسليم: {viewingSubmissionStudent.submission.submittedAt ? new Date(viewingSubmissionStudent.submission.submittedAt).toLocaleString('ar-EG') : ''}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">لا يوجد تسليم مسجل لهذا الطالب حتى الآن.</p>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingSubmissionStudent(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
