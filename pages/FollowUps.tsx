import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  StudentFollowUp,
  Group,
  Student,
  LectureEvaluation,
  Session,
  FollowUpMention,
  FollowUpSuggestionRejection,
  FollowUpSuggestionExemption,
  SuggestionEscalation,
} from "../types";
import Layout from "../components/Layout";
import { useLanguage } from "../contexts/LanguageContext";
import { usePermissions } from "../contexts/PermissionsContext";
import { formatTime12h } from "../utils";
import {
  subscribeToCollection,
  submitTrainerFollowUpUpdate,
  resolveStudentFollowUp,
  saveStudentFollowUpComment,
  reopenStudentFollowUp,
  requestFollowUp,
  scheduleFollowUp,
  autoActivateScheduledFollowUps,
  reactivateScheduledFollowUp,
  approveNextFollowUpDate,
  rejectNextFollowUpDate,
  approveFollowUpSuggestion,
  rejectFollowUpSuggestion,
  exemptStudentFromSuggestions,
  removeSuggestionExemption,
  resetAllFollowUps,
  escalateFollowUp,
  respondToEscalation,
  markFollowUpMentionDone,
  snoozeFollowUpMention,
  escalateSuggestionToAdmin,
  approveSuggestionEscalation,
  markSuggestionEscalationDone,
  revertSuggestionEscalation,
  cancelSuggestionEscalation,
} from "../services/firestore";
import { computeFollowUpSuggestions, FollowUpSuggestion } from "../services/followUpSuggestions";
import {
  MessageSquare,
  Calendar,
  User as UserIcon,
  CheckCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  Users,
  Activity,
  RefreshCcw,
  History,
  Phone,
  Reply,
  ListTodo,
  ExternalLink,
} from "lucide-react";
import * as firestore from "firebase/firestore";

const { orderBy, limit } = firestore as any;

const FollowUps: React.FC<{ user: User }> = ({ user }) => {
  const { lang } = useLanguage();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState<StudentFollowUp[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<LectureEvaluation[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [mentions, setMentions] = useState<FollowUpMention[]>([]);
  const [rejections, setRejections] = useState<FollowUpSuggestionRejection[]>([]);
  const [exemptions, setExemptions] = useState<FollowUpSuggestionExemption[]>([]);
  const [suggestionEscalations, setSuggestionEscalations] = useState<SuggestionEscalation[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewAll = hasPermission(user, "viewAllFollowUps");

  const [mainView, setMainView] = useState<
    "all" | "suggestions" | "escalations" | "personal"
  >(() => (canViewAll ? "all" : "personal"));
  const [personalTab, setPersonalTab] = useState<
    "mine" | "tasks" | "doneByMe" | "doneAll"
  >("mine");
  const [escalationSection, setEscalationSection] = useState<
    "pending" | "approved" | "on_hold" | "resolved"
  >("pending");
  const [escalateModalFor, setEscalateModalFor] = useState<StudentFollowUp | null>(null);
  const [escalateAction, setEscalateAction] = useState("");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [snoozeDraft, setSnoozeDraft] = useState<Record<string, string>>({});
  const [rejectModalFor, setRejectModalFor] = useState<FollowUpSuggestion | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState("");
  const [rejectAlsoExempt, setRejectAlsoExempt] = useState(false);
  const [showRejectedSuggestions, setShowRejectedSuggestions] = useState(false);
  const [showExemptions, setShowExemptions] = useState(false);
  const [suggestionEscalateModalFor, setSuggestionEscalateModalFor] = useState<FollowUpSuggestion | null>(null);
  const [suggestionEscalateAction, setSuggestionEscalateAction] = useState("");
  const [expandedSuggestionGroupId, setExpandedSuggestionGroupId] = useState<string | null>(null);
  const [showSuggestionDecisions, setShowSuggestionDecisions] = useState(true);
  const [studentHistoryFor, setStudentHistoryFor] = useState<{ studentId: string; studentName: string } | null>(null);
  const [replyingToUpdate, setReplyingToUpdate] = useState<
    Record<string, { id: string; authorName: string } | null>
  >({});

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    null,
  );
  const [interactionTab, setInteractionTab] = useState<
    Record<string, "comments" | "updates">
  >({});

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestionSearchQuery, setSuggestionSearchQuery] = useState("");
  const [personalSearchQuery, setPersonalSearchQuery] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("");
  const [mentionFilter, setMentionFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [viewTab, setViewTab] = useState<
    "active" | "scheduled" | "resolved" | "archived"
  >("active");
  const [nextFollowUpDates, setNextFollowUpDates] = useState<
    Record<string, string>
  >({});
  const [cancelAbsenceWarnings, setCancelAbsenceWarnings] = useState<
    Record<string, boolean>
  >({});

  const [newComment, setNewComment] = useState("");
  const [trainerNote, setTrainerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionUserIdForFollowUp, setMentionUserIdForFollowUp] = useState<
    Record<string, string>
  >({});

  // For Requesting Follow-up
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [requestData, setRequestData] = useState({
    groupId: "",
    studentId: "",
    deadline: "",
    note: "",
    mentionedUserId: "",
    labels: [] as string[],
  });

  // For Scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    f: null as StudentFollowUp | null,
    date: "",
  });

  const isAdmin = ["admin", "coordinator", "team_leader", "supervisor"].includes(user.role);
  const canViewSuggestions = hasPermission(user, "viewFollowUpSuggestions");
  const canApproveSuggestion = hasPermission(user, "approveFollowUpSuggestion");
  const canResolveFollowUp = hasPermission(user, "resolveFollowUp");
  const canApproveReschedule = hasPermission(user, "approveFollowUpReschedule");
  const canEscalate = hasPermission(user, "escalateFollowUp");
  const isFollowUpAdminUser = user.role === "admin";

  const getTomorrowDateStr = (): string => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(tomorrow);
      const day = parts.find((p) => p.type === "day")?.value || "";
      const month = parts.find((p) => p.type === "month")?.value || "";
      const year = parts.find((p) => p.type === "year")?.value || "";
      return `${year}-${month}-${day}`;
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    }
  };

  useEffect(() => {
    // Auto activate scheduled
    autoActivateScheduledFollowUps();

    const unsubFollowUps = subscribeToCollection<StudentFollowUp>(
      "studentFollowUps",
      setFollowUps,
      [orderBy("lastUpdatedAt", "desc")],
    );
    const unsubGroups = subscribeToCollection<Group>("groups", setGroups);
    const unsubStudents = subscribeToCollection<Student>(
      "students",
      setStudents
    );
    const unsubSessions = subscribeToCollection<Session>(
      "sessions",
      setSessions
    );
    const unsubEvals = subscribeToCollection<LectureEvaluation>(
      "lectureEvaluations",
      setEvaluations
    );
    const unsubUsers = subscribeToCollection<User>("users", (data) =>
      setTrainers(
        data.filter((u) =>
          ["trainer", "team_leader", "coordinator", "admin", "supervisor"].includes(u.role),
        ),
      ),
    );
    const unsubMentions = subscribeToCollection<FollowUpMention>(
      "followUpMentions",
      setMentions,
    );
    const unsubRejections = subscribeToCollection<FollowUpSuggestionRejection>(
      "followUpSuggestionRejections",
      setRejections,
    );
    const unsubSuggestionEscalations = subscribeToCollection<SuggestionEscalation>(
      "suggestionEscalations",
      setSuggestionEscalations,
    );
    const unsubExemptions = subscribeToCollection<FollowUpSuggestionExemption>(
      "followUpSuggestionExemptions",
      setExemptions,
    );

    setLoading(false);
    return () => {
      unsubFollowUps();
      unsubGroups();
      unsubStudents();
      unsubSessions();
      unsubEvals();
      unsubUsers();
      unsubMentions();
      unsubRejections();
      unsubSuggestionEscalations();
      unsubExemptions();
    };
  }, []);

  const suggestions = useMemo(
    () => computeFollowUpSuggestions(groups, students, sessions, evaluations, followUps, rejections, exemptions),
    [groups, students, sessions, evaluations, followUps, rejections, exemptions],
  );

  const activeRejections = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return rejections.filter((r) => r.reappearAt > todayStr);
  }, [rejections]);

  // Suggestions with a still-open (pending/approved) admin decision are
  // hidden from the normal approve/reject buttons — they're being tracked in
  // the decisions section instead, to avoid double-processing the same case.
  const openSuggestionEscalationByKey = useMemo(() => {
    const map: Record<string, SuggestionEscalation> = {};
    suggestionEscalations
      .filter((e) => e.status !== "done")
      .forEach((e) => {
        map[`${e.groupId}_${e.studentId}_${e.reason}`] = e;
      });
    return map;
  }, [suggestionEscalations]);

  const openSuggestionDecisions = useMemo(
    () => suggestionEscalations.filter((e) => e.status !== "done"),
    [suggestionEscalations],
  );

  const doneSuggestionDecisions = useMemo(
    () => suggestionEscalations.filter((e) => e.status === "done"),
    [suggestionEscalations],
  );

  // How many times has this student's follow-up been closed and reopened
  // before, per student — so "this is follow-up #N" is visible up front
  // (protocol: recurring cases should be escalated, not treated as routine).
  // Counted from the updates[] timeline (mark_done events), zero extra reads.
  const followUpOrdinalByStudent = useMemo(() => {
    const map: Record<string, number> = {};
    followUps.forEach((f) => {
      const closures = (f.updates || []).filter((u) => u.eventType === "mark_done").length;
      map[f.studentId] = (map[f.studentId] || 0) + closures;
    });
    return map;
  }, [followUps]);

  const getFollowUpOrdinal = (studentId: string) => (followUpOrdinalByStudent[studentId] || 0) + 1;

  // Everything already loaded in memory — computed on demand, zero extra
  // Firestore reads, matching the protocol's "check their history first" step.
  const studentHistory = useMemo(() => {
    if (!studentHistoryFor) return null;
    const sid = studentHistoryFor.studentId;

    const followUpsForStudent = followUps
      .filter((f) => f.studentId === sid)
      .sort((a, b) => {
        const ta = a.lastUpdatedAt?.toDate ? a.lastUpdatedAt.toDate().getTime() : 0;
        const tb = b.lastUpdatedAt?.toDate ? b.lastUpdatedAt.toDate().getTime() : 0;
        return tb - ta;
      });

    const rejectionsForStudent = rejections.filter((r) => r.studentId === sid);
    const exemptionsForStudent = exemptions.filter((e) => e.studentId === sid);
    const escalationsForStudent = suggestionEscalations.filter((e) => e.studentId === sid);

    const closuresByDocId: Record<string, number> = {};
    followUpsForStudent.forEach((f) => {
      closuresByDocId[f.id] = (f.updates || []).filter((u) => u.eventType === "mark_done").length;
    });

    return {
      followUpsForStudent,
      rejectionsForStudent,
      exemptionsForStudent,
      escalationsForStudent,
      closuresByDocId,
      ordinal: getFollowUpOrdinal(sid),
    };
  }, [studentHistoryFor, followUps, rejections, exemptions, suggestionEscalations]);

  const matchesStudentSearch = (studentId: string, studentName: string, q: string) => {
    if (!q.trim()) return true;
    const query = q.trim().toLowerCase();
    if (studentName.toLowerCase().includes(query)) return true;
    const phone = students.find((s) => s.id === studentId)?.phone || "";
    return phone.includes(q.trim());
  };

  const suggestionsByGroup = useMemo(() => {
    const map: Record<string, FollowUpSuggestion[]> = {};
    suggestions
      .filter((s) => matchesStudentSearch(s.studentId, s.studentName, suggestionSearchQuery))
      .forEach((s) => {
        if (!map[s.groupId]) map[s.groupId] = [];
        map[s.groupId].push(s);
      });
    return map;
  }, [suggestions, suggestionSearchQuery, students]);

  const escalatedFollowUps = useMemo(
    () => followUps.filter((f) => !!f.escalation),
    [followUps],
  );

  const myFollowUps = useMemo(
    () => followUps.filter((f) => f.mentionedUserId === user.uid && f.status !== "resolved"),
    [followUps, user.uid],
  );

  const myFollowUpsGrouped = useMemo(() => {
    return myFollowUps
      .filter((f) => matchesStudentSearch(f.studentId, f.studentName, personalSearchQuery))
      .reduce(
        (acc, f) => {
          if (!acc[f.groupId]) acc[f.groupId] = [];
          acc[f.groupId].push(f);
          return acc;
        },
        {} as Record<string, StudentFollowUp[]>,
      );
  }, [myFollowUps, personalSearchQuery, students]);

  const todayStr = new Date().toISOString().split("T")[0];

  const myPendingTasks = useMemo(
    () =>
      mentions.filter(
        (m) =>
          m.mentionedUserId === user.uid &&
          m.status === "pending" &&
          (!m.snoozedUntil || m.snoozedUntil <= todayStr) &&
          matchesStudentSearch(m.studentId, m.studentName, personalSearchQuery),
      ),
    [mentions, user.uid, todayStr, personalSearchQuery, students],
  );

  const myDoneTasks = useMemo(
    () =>
      mentions.filter(
        (m) =>
          m.mentionedUserId === user.uid &&
          m.status === "done" &&
          matchesStudentSearch(m.studentId, m.studentName, personalSearchQuery),
      ),
    [mentions, user.uid, personalSearchQuery, students],
  );

  const allResolvedFollowUps = useMemo(
    () =>
      followUps.filter(
        (f) => f.status === "resolved" && matchesStudentSearch(f.studentId, f.studentName, personalSearchQuery),
      ),
    [followUps, personalSearchQuery, students],
  );

  const [suggestionMentionPick, setSuggestionMentionPick] = useState<Record<string, string>>({});

  const handleApproveSuggestion = async (s: FollowUpSuggestion) => {
    try {
      setIsSubmitting(true);
      const key = `${s.groupId}_${s.studentId}_${s.reason}`;
      const mentionId = suggestionMentionPick[key];
      const mentionUser = trainers.find((t) => t.uid === mentionId);
      await approveFollowUpSuggestion(
        s.groupId,
        s.groupName,
        s.studentId,
        s.studentName,
        s.reason,
        user,
        mentionId || undefined,
        mentionUser?.name || undefined,
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateModalFor || !escalateAction.trim()) return;
    try {
      setIsSubmitting(true);
      const adminUsers = trainers.filter((t) => t.role === "admin");
      await escalateFollowUp(
        escalateModalFor.groupId,
        escalateModalFor.studentId,
        escalateAction.trim(),
        user,
        adminUsers,
      );
      setEscalateModalFor(null);
      setEscalateAction("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalationResponse = async (
    f: StudentFollowUp,
    status: "approved" | "on_hold" | "resolved",
  ) => {
    const note = status === "resolved" ? "" : prompt(lang === "ar" ? "ملحوظة (اختياري):" : "Note (optional):") || "";
    try {
      setIsSubmitting(true);
      await respondToEscalation(f.groupId, f.studentId, status, note, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToMention = async (m: FollowUpMention) => {
    const text = replyDraft[m.id]?.trim();
    if (!text) return;
    try {
      setIsSubmitting(true);
      // submitTrainerFollowUpUpdate automatically closes every pending mention
      // the current user has on this follow-up (see closeOwnPendingMentions in
      // services/firestore.ts) — no separate markFollowUpMentionDone call needed.
      await submitTrainerFollowUpUpdate(
        m.groupId,
        m.studentId,
        text,
        user,
        undefined,
        undefined,
        undefined,
        null,
        m.sourceUpdateId,
      );
      setReplyDraft((prev) => ({ ...prev, [m.id]: "" }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkMentionDone = async (m: FollowUpMention) => {
    try {
      await markFollowUpMentionDone(m.id, user);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectSuggestion = async () => {
    if (!rejectModalFor || !rejectReasonText.trim()) return;
    try {
      setIsSubmitting(true);
      await rejectFollowUpSuggestion(
        rejectModalFor.groupId,
        rejectModalFor.groupName,
        rejectModalFor.studentId,
        rejectModalFor.studentName,
        rejectModalFor.reason,
        rejectReasonText.trim(),
        user,
      );
      if (rejectAlsoExempt) {
        await exemptStudentFromSuggestions(
          rejectModalFor.groupId,
          rejectModalFor.groupName,
          rejectModalFor.studentId,
          rejectModalFor.studentName,
          rejectModalFor.reason,
          rejectReasonText.trim(),
          user,
        );
      }
      setRejectModalFor(null);
      setRejectReasonText("");
      setRejectAlsoExempt(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveExemption = async (e: FollowUpSuggestionExemption) => {
    if (
      !confirm(
        lang === "ar"
          ? `إلغاء استثناء ${e.studentName} من متابعة ${e.reason === "absence" ? "الحضور" : "التاسكات"}؟ هيرجع يظهر كاقتراح عادي لو استوفى الشرط.`
          : `Remove ${e.studentName}'s exemption from ${e.reason} follow-up? They'll go back to showing up as a normal suggestion if the threshold is met.`,
      )
    )
      return;
    try {
      await removeSuggestionExemption(e.id, user);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEscalateSuggestion = async () => {
    if (!suggestionEscalateModalFor || !suggestionEscalateAction.trim()) return;
    try {
      setIsSubmitting(true);
      const adminUsers = trainers.filter((t) => t.role === "admin");
      await escalateSuggestionToAdmin(
        suggestionEscalateModalFor.groupId,
        suggestionEscalateModalFor.groupName,
        suggestionEscalateModalFor.studentId,
        suggestionEscalateModalFor.studentName,
        suggestionEscalateModalFor.reason,
        suggestionEscalateAction.trim(),
        user,
        adminUsers,
      );
      setSuggestionEscalateModalFor(null);
      setSuggestionEscalateAction("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSuggestionEscalation = async (e: SuggestionEscalation) => {
    const note = prompt(lang === "ar" ? "ملحوظة (اختياري):" : "Note (optional):") || "";
    try {
      setIsSubmitting(true);
      await approveSuggestionEscalation(e.id, note, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSuggestionEscalationDone = async (e: SuggestionEscalation) => {
    if (
      !confirm(
        lang === "ar"
          ? "تأكيد إنك نفّذت الإجراء المعتمد بالفعل؟"
          : "Confirm you've actually carried out the approved action?",
      )
    )
      return;
    try {
      setIsSubmitting(true);
      await markSuggestionEscalationDone(e.id, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevertSuggestionEscalation = async (e: SuggestionEscalation) => {
    if (e.status !== "approved" && e.status !== "done") return;
    if (!confirm(lang === "ar" ? "تراجع خطوة واحدة للخلف؟" : "Undo one step back?")) return;
    try {
      setIsSubmitting(true);
      await revertSuggestionEscalation(e.id, e.status, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSuggestionEscalation = async (e: SuggestionEscalation) => {
    if (!confirm(lang === "ar" ? "إلغاء هذا التصعيد نهائياً؟" : "Cancel this escalation entirely?")) return;
    try {
      setIsSubmitting(true);
      await cancelSuggestionEscalation(e.id, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSnoozeMention = async (m: FollowUpMention) => {
    const date = snoozeDraft[m.id];
    if (!date) return;
    try {
      await snoozeFollowUpMention(m.id, date);
      setSnoozeDraft((prev) => ({ ...prev, [m.id]: "" }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolve = async (f: StudentFollowUp) => {
    if (!canResolveFollowUp) {
      alert("Only supervisors can resolve follow-ups.");
      return;
    }
    if (!confirm("Are you sure this follow-up is resolved?")) return;
    try {
      setIsSubmitting(true);
      await resolveStudentFollowUp(f.groupId, f.studentId, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAllFollowUps = async () => {
    if (!isFollowUpAdminUser) return;
    const pendingCount = followUps.filter(
      (f) => f.status === "active" || f.status === "scheduled",
    ).length;
    if (pendingCount === 0) {
      alert(
        lang === "ar"
          ? "لا توجد متابعات نشطة أو مجدولة لتصفيرها حالياً."
          : "There are no active or scheduled follow-ups to reset right now.",
      );
      return;
    }
    const confirmMsg =
      lang === "ar"
        ? `هيتقفل ${pendingCount} متابعة (نشطة/مجدولة) وتتحول لـ "منتهية" دفعة واحدة، وأي مهام معلقة على أي حد هتتقفل معاها. الإجراء ده مش قابل للتراجع. متأكد؟`
        : `This will close ${pendingCount} active/scheduled follow-up(s) as done in one shot, and every pending mention task will close with them. This cannot be undone. Are you sure?`;
    if (!confirm(confirmMsg)) return;
    try {
      setIsSubmitting(true);
      const count = await resetAllFollowUps(user);
      alert(
        lang === "ar"
          ? `تم تصفير ${count} متابعة بنجاح. النظام جاهز للبدء من جديد.`
          : `Successfully reset ${count} follow-up(s). The system is ready for a fresh start.`,
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async (f: StudentFollowUp) => {
    if (!canResolveFollowUp) return;
    if (!confirm("Reopen this follow-up for further tracking?")) return;
    try {
      setIsSubmitting(true);
      await reopenStudentFollowUp(f.groupId, f.studentId, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (f: StudentFollowUp) => {
    if (!newComment.trim()) return;
    try {
      setIsSubmitting(true);
      const mentionId = mentionUserIdForFollowUp[f.id];
      const mentionUser = trainers.find((u) => u.uid === mentionId);

      await saveStudentFollowUpComment(
        f.groupId,
        f.studentId,
        newComment,
        user,
        mentionId || undefined,
        mentionUser?.name || undefined,
      );
      setNewComment("");
      setMentionUserIdForFollowUp((prev) => ({ ...prev, [f.id]: "" }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrainerUpdate = async (f: StudentFollowUp) => {
    if (!trainerNote.trim()) return;
    try {
      setIsSubmitting(true);
      const mentionId = mentionUserIdForFollowUp[f.id];
      const mentionUser = trainers.find((u) => u.uid === mentionId);

      const nextDate = nextFollowUpDates[f.id] || undefined;

      let resetSessionNum: number | null = null;
      if (cancelAbsenceWarnings[f.id]) {
        const groupSessions = sessions.filter(
          (s) => s.groupId === f.groupId && s.status === "done",
        );
        if (groupSessions.length > 0) {
          resetSessionNum = Math.max(
            ...groupSessions.map((s) => s.sessionNumber),
          );
        } else {
          resetSessionNum = 0;
        }
      }

      await submitTrainerFollowUpUpdate(
        f.groupId,
        f.studentId,
        trainerNote,
        user,
        mentionId || undefined,
        mentionUser?.name || undefined,
        nextDate,
        resetSessionNum,
        replyingToUpdate[f.id]?.id,
      );
      setTrainerNote("");
      setInteractionTab((prev) => ({ ...prev, [f.id]: "updates" }));
      setMentionUserIdForFollowUp((prev) => ({ ...prev, [f.id]: "" }));
      setNextFollowUpDates((prev) => ({ ...prev, [f.id]: "" }));
      setCancelAbsenceWarnings((prev) => ({ ...prev, [f.id]: false }));
      setReplyingToUpdate((prev) => ({ ...prev, [f.id]: null }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveNextFollowUp = async (f: StudentFollowUp) => {
    if (!canApproveReschedule) {
      alert("Only supervisors can approve follow-up postponements.");
      return;
    }
    if (
      !confirm(
        lang === "ar"
          ? "هل أنت متأكد من الموافقة على تأجيل هذه المتابعة؟"
          : "Are you sure you want to approve postponing this follow-up?",
      )
    )
      return;
    try {
      setIsSubmitting(true);
      await approveNextFollowUpDate(f.groupId, f.studentId, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectNextFollowUp = async (f: StudentFollowUp) => {
    if (!canApproveReschedule) {
      alert("Only supervisors can reject follow-up postponements.");
      return;
    }
    if (
      !confirm(
        lang === "ar"
          ? "هل أنت متأكد من رفض طلب التأجيل هذا؟"
          : "Are you sure you want to reject this postponement request?",
      )
    )
      return;
    try {
      setIsSubmitting(true);
      await rejectNextFollowUpDate(f.groupId, f.studentId, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleOpenRequestForStudent = (f: StudentFollowUp) => {
    setRequestData({
      groupId: f.groupId,
      studentId: f.studentId,
      deadline: "",
      note: "",
      mentionedUserId: "",
      labels: f.labels || [],
    });
    setIsRequestModalOpen(true);
  };

  const handleOpenSchedule = (f: StudentFollowUp) => {
    setScheduleData({ f, date: "" });
    setIsScheduleModalOpen(true);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleData.f || !scheduleData.date) return;
    try {
      setIsSubmitting(true);
      await scheduleFollowUp(
        scheduleData.f.groupId,
        scheduleData.f.studentId,
        scheduleData.date,
        user,
      );
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleTomorrow = async () => {
    if (!scheduleData.f) return;
    const tomorrowStr = getTomorrowDateStr();
    try {
      setIsSubmitting(true);
      await scheduleFollowUp(
        scheduleData.f.groupId,
        scheduleData.f.studentId,
        tomorrowStr,
        user,
      );
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateScheduled = async (f: StudentFollowUp) => {
    try {
      setIsSubmitting(true);
      await reactivateScheduledFollowUp(f.groupId, f.studentId, user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestFollowUp = async () => {
    if (
      !requestData.groupId ||
      !requestData.studentId ||
      !requestData.deadline ||
      !requestData.note
    ) {
      alert("Please fill all required fields");
      return;
    }
    try {
      setIsSubmitting(true);
      const group = groups.find((g) => g.id === requestData.groupId);
      const student = students.find((s) => s.id === requestData.studentId);
      const mentionedUser = trainers.find(
        (u) => u.uid === requestData.mentionedUserId,
      );

      await requestFollowUp(
        {
          groupId: requestData.groupId,
          groupName: group?.name || "Unknown",
          studentId: requestData.studentId,
          studentName: student?.name || "Unknown",
          deadline: requestData.deadline,
          note: requestData.note,
          mentionedUserId: requestData.mentionedUserId || undefined,
          mentionedUserName: mentionedUser?.name || undefined,
          labels: requestData.labels,
        },
        user,
      );

      setIsRequestModalOpen(false);
      setRequestData({
        groupId: "",
        studentId: "",
        deadline: "",
        note: "",
        mentionedUserId: "",
        labels: [],
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((f) => {
      const g = groups.find((group) => group.id === f.groupId);
      const isGroupArchived = g?.archived === true;

      const isSearching = searchQuery.trim() !== "";
      let matchesTab = false;
      if (viewTab === "archived") {
        matchesTab = isGroupArchived;
      } else {
        if (isGroupArchived) return false;
        if (isSearching) {
          matchesTab = f.status === "active" || f.status === "scheduled";
        } else {
          matchesTab = f.status === viewTab;
        }
      }

      const matchesSearch =
        f.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.studentId &&
          students
            .find((s) => s.id === f.studentId)
            ?.phone?.includes(searchQuery));
      const matchesGroup = groupFilter === "" || f.groupId === groupFilter;
      const matchesTrainer =
        trainerFilter === "" || g?.trainerIds?.includes(trainerFilter);
      const matchesMention =
        mentionFilter === "" || f.mentionedUserId === mentionFilter;

      return (
        matchesTab &&
        matchesSearch &&
        matchesGroup &&
        matchesTrainer &&
        matchesMention
      );
    });
  }, [
    followUps,
    viewTab,
    searchQuery,
    groupFilter,
    trainerFilter,
    mentionFilter,
    groups,
    students,
  ]);

  const groupedFollowUps = useMemo(() => {
    return filteredFollowUps.reduce(
      (acc, f) => {
        if (!acc[f.groupId]) acc[f.groupId] = [];
        acc[f.groupId].push(f);
        return acc;
      },
      {} as Record<string, StudentFollowUp[]>,
    );
  }, [filteredFollowUps]);

  // "My Follow-ups" reuses this exact same grouped-card rendering with a
  // different data source, so it gets the full toolset instead of a summary.
  const activeGroupedFollowUps = mainView === "personal" ? myFollowUpsGrouped : groupedFollowUps;

  const getStudentStats = (studentId: string, groupId: string) => {
    const f = followUps.find(
      (item) => item.studentId === studentId && item.groupId === groupId,
    );

    const studentEvals = evaluations.filter(
      (e) => e.studentId === studentId && e.groupId === groupId,
    );
    const groupSessions = sessions.filter(
      (s) => s.groupId === groupId && s.status === "done",
    );

    // If live evaluations or sessions exist, calculate real-time stats
    const resetSessionNum = f?.attendanceResetSessionNumber || 0;

    const totalRequired = groupSessions.reduce(
      (sum, s) => sum + (s.requiredTasksCount || 0),
      0,
    );
    const totalCompleted = studentEvals.reduce(
      (sum, e) => sum + (e.taskDelivered || 0),
      0,
    );

    // Only count attendance metrics for sessions after the reset session
    const groupSessionsFiltered = groupSessions.filter(
      (s) => s.sessionNumber > resetSessionNum,
    );
    const studentEvalsFiltered = studentEvals.filter(
      (e) => e.sessionNumber > resetSessionNum,
    );

    const totalAttended = studentEvalsFiltered.filter(
      (e) => e.attendance === 1,
    ).length;
    const totalSessions = groupSessionsFiltered.length;

    // Fallback to static stored stats only if evaluations and sessions are not loaded at all
    if (
      evaluations.length === 0 &&
      sessions.length === 0 &&
      f &&
      f.tasksDone !== undefined &&
      f.totalTasks !== undefined &&
      f.attendanceCount !== undefined &&
      f.totalSessions !== undefined
    ) {
      const rate = f.totalTasks > 0 ? Math.round((f.tasksDone / f.totalTasks) * 100) : 0;
      const attRate = f.totalSessions > 0 ? Math.round((f.attendanceCount / f.totalSessions) * 100) : 0;
      return {
        tasks: `${f.tasksDone}/${f.totalTasks}`,
        attendance: `${f.attendanceCount}/${f.totalSessions}`,
        rate,
        attRate
      };
    }

    return {
      tasks: `${totalCompleted}/${totalRequired}`,
      attendance: `${totalAttended}/${totalSessions}`,
      rate:
        totalRequired > 0
          ? Math.round((totalCompleted / totalRequired) * 100)
          : 0,
      attRate:
        totalSessions > 0
          ? Math.round((totalAttended / totalSessions) * 100)
          : 0,
    };
  };

  const getTrainerNames = (groupId: string) => {
    const g = groups.find((group) => group.id === groupId);
    if (!g || !g.trainerIds) return "No trainers assigned";
    return g.trainerIds
      .map((tid) => trainers.find((u) => u.uid === tid)?.name || "Unknown")
      .join(", ");
  };

  return (
    <Layout user={user}>
      {/* Main Section Tabs: All / Suggestions / Escalations / Personal */}
      <div className="flex flex-wrap gap-2 mb-8">
        {canViewAll && (
          <button
            onClick={() => setMainView("all")}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${mainView === "all" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            {lang === "ar" ? "كل المتابعات" : "All Follow-ups"}
          </button>
        )}
        {canViewSuggestions && (
          <button
            onClick={() => setMainView("suggestions")}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mainView === "suggestions" ? "bg-amber-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            💡 {lang === "ar" ? "اقتراحات المتابعة" : "Suggestions"}
            {suggestions.length > 0 && (
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px]">{suggestions.length}</span>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setMainView("escalations")}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mainView === "escalations" ? "bg-rose-600 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            🔺 {lang === "ar" ? "تصعيدات الإدارة" : "Escalations"}
            {escalatedFollowUps.filter((f) => f.escalation?.status === "pending").length > 0 && (
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px]">
                {escalatedFollowUps.filter((f) => f.escalation?.status === "pending").length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setMainView("personal")}
          className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mainView === "personal" ? "bg-primary-600 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          👤 {lang === "ar" ? "متابعاتي" : "My Follow-ups"}
          {myPendingTasks.length > 0 && (
            <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px]">{myPendingTasks.length}</span>
          )}
        </button>
      </div>

      {mainView === "suggestions" && canViewSuggestions && (
        <div className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-6">
            <h2 className="text-lg font-black text-amber-800 dark:text-amber-400 mb-1">
              {lang === "ar" ? "اقتراحات المتابعة" : "Follow-up Suggestions"}
            </h2>
            <p className="text-xs text-amber-700 dark:text-amber-500 font-semibold">
              {lang === "ar"
                ? "هذه اقتراحات لحظية فقط — لم يُنشأ أي شيء بعد. راجعها ثم اعتمد ما يستحق تحويله لمتابعة فعلية."
                : "These are live suggestions only — nothing has been created yet. Review and approve what deserves becoming a real follow-up."}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={suggestionSearchQuery}
              onChange={(e) => setSuggestionSearchQuery(e.target.value)}
              placeholder={lang === "ar" ? "بحث بالاسم أو رقم الموبايل..." : "Search by name or phone..."}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold shadow-sm"
            />
          </div>

          {Object.keys(suggestionsByGroup).length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-slate-500 dark:text-slate-400 font-bold">
                {suggestionSearchQuery.trim()
                  ? (lang === "ar" ? "لا يوجد طالب مطابق للبحث" : "No student matches this search")
                  : (lang === "ar" ? "لا توجد اقتراحات متابعة حالياً" : "No follow-up suggestions right now")}
              </p>
            </div>
          ) : (
            Object.entries(suggestionsByGroup).map(([groupId, items]: [string, FollowUpSuggestion[]]) => {
              const g = groups.find((grp) => grp.id === groupId);
              const isGroupExpanded =
                expandedSuggestionGroupId === groupId || suggestionSearchQuery.trim() !== "";
              const scheduleText = g
                ? `${(g.daysOfWeek || []).join(", ")} — ${formatTime12h(g.sessionTime)}`
                : "";
              return (
                <div key={groupId} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div
                    className="p-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 cursor-pointer flex items-center justify-between gap-4"
                    onClick={() => setExpandedSuggestionGroupId(isGroupExpanded ? null : groupId)}
                  >
                    <div>
                      <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                        {items[0].groupName}
                        <span className="bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5 text-[10px] font-black">
                          {items.length}
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 flex flex-wrap gap-x-3">
                        <span>👤 {getTrainerNames(groupId)}</span>
                        {g?.courseName && <span>📚 {g.courseName}</span>}
                        {g && <span>🗓️ {scheduleText}</span>}
                      </p>
                    </div>
                    {isGroupExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                  {isGroupExpanded && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((s) => {
                        const key = `${s.groupId}_${s.studentId}_${s.reason}`;
                        const openEscalation = openSuggestionEscalationByKey[key];
                        return (
                          <div key={key} className="p-5 flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={`/#/groups/${s.groupId}?tab=taskProgress&studentId=${s.studentId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-black text-sm text-primary-600 hover:text-primary-700 hover:underline"
                                >
                                  {s.studentName}
                                </a>
                                {getFollowUpOrdinal(s.studentId) > 1 && (
                                  <span
                                    className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getFollowUpOrdinal(s.studentId) >= 3 ? "bg-rose-600/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}
                                  >
                                    #{getFollowUpOrdinal(s.studentId)}
                                  </span>
                                )}
                                <button
                                  onClick={() => setStudentHistoryFor({ studentId: s.studentId, studentName: s.studentName })}
                                  className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1"
                                >
                                  📜 {lang === "ar" ? "السجل" : "History"}
                                </button>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                                {s.reason === "absence"
                                  ? (lang === "ar" ? `⚠️ نسبة الحضور ${s.rate}%` : `⚠️ Attendance ${s.rate}%`)
                                  : (lang === "ar" ? `⚠️ نسبة تسليم التاسكات ${s.rate}%` : `⚠️ Task delivery ${s.rate}%`)}
                              </p>
                              {openEscalation && (
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                                  🏛️ {lang === "ar" ? "بانتظار قرار الإدارة" : "Awaiting admin decision"} ({openEscalation.status})
                                </p>
                              )}
                            </div>
                            {canApproveSuggestion && !openEscalation && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  value={suggestionMentionPick[key] || ""}
                                  onChange={(e) =>
                                    setSuggestionMentionPick((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold"
                                >
                                  <option value="">{lang === "ar" ? "بدون توجيه" : "No mention"}</option>
                                  {trainers.map((t) => (
                                    <option key={t.uid} value={t.uid}>{t.name}</option>
                                  ))}
                                </select>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => handleApproveSuggestion(s)}
                                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                  {lang === "ar" ? "تحويل لمتابعة" : "Approve"}
                                </button>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => setRejectModalFor(s)}
                                  className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                  {lang === "ar" ? "رفض" : "Reject"}
                                </button>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => setSuggestionEscalateModalFor(s)}
                                  className="px-5 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 border border-indigo-600/30 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                  🏛️ {lang === "ar" ? "تصعيد للإدارة" : "Escalate"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {openSuggestionDecisions.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-3xl overflow-hidden">
              <button
                onClick={() => setShowSuggestionDecisions((v) => !v)}
                className="w-full p-5 flex items-center justify-between gap-3 text-left"
              >
                <h3 className="font-black text-sm text-indigo-700 dark:text-indigo-400">
                  🏛️ {lang === "ar" ? `قرارات إدارية معلقة (${openSuggestionDecisions.length})` : `Pending admin decisions (${openSuggestionDecisions.length})`}
                </h3>
                {showSuggestionDecisions ? <ChevronUp size={16} className="text-indigo-400" /> : <ChevronDown size={16} className="text-indigo-400" />}
              </button>
              {showSuggestionDecisions && (
                <div className="divide-y divide-indigo-100 dark:divide-indigo-900/30">
                  {openSuggestionDecisions.map((e) => (
                    <div key={e.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-white">
                            {e.studentName} — {e.groupName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                            {lang === "ar" ? "صعّدها" : "Escalated by"} {e.escalatedByName}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            e.status === "pending"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {e.status === "pending"
                            ? (lang === "ar" ? "بانتظار الأدمن" : "Awaiting admin")
                            : (lang === "ar" ? "معتمد — بانتظار التنفيذ" : "Approved — awaiting execution")}
                        </span>
                      </div>
                      <p className="text-sm font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl p-3">
                        {e.proposedAction}
                      </p>
                      {e.adminNote && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          {lang === "ar" ? "ملحوظة الأدمن: " : "Admin note: "}{e.adminNote}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {isFollowUpAdminUser && e.status === "pending" && (
                          <button
                            onClick={() => handleApproveSuggestionEscalation(e)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                          >
                            {lang === "ar" ? "موافقة على الإجراء" : "Approve action"}
                          </button>
                        )}
                        {e.status === "approved" && (
                          <button
                            onClick={() => handleMarkSuggestionEscalationDone(e)}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                          >
                            {lang === "ar" ? "تم التنفيذ" : "Mark executed"}
                          </button>
                        )}
                        {e.status === "approved" && (
                          <button
                            onClick={() => handleRevertSuggestionEscalation(e)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest"
                          >
                            {lang === "ar" ? "تراجع" : "Revert"}
                          </button>
                        )}
                        {e.status === "pending" && (
                          <button
                            onClick={() => handleCancelSuggestionEscalation(e)}
                            className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest"
                          >
                            {lang === "ar" ? "إلغاء التصعيد" : "Cancel escalation"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {doneSuggestionDecisions.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                {lang === "ar" ? "قرارات مُنفَّذة" : "Executed decisions"}
              </p>
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {doneSuggestionDecisions.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {e.studentName} — {e.groupName}
                      </p>
                      <p className="text-xs text-slate-400">{e.proposedAction}</p>
                    </div>
                    <button
                      onClick={() => handleRevertSuggestionEscalation(e)}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest shrink-0"
                    >
                      {lang === "ar" ? "تراجع" : "Revert"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeRejections.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowRejectedSuggestions((v) => !v)}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
              >
                {showRejectedSuggestions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {lang === "ar" ? `اقتراحات مرفوضة مؤقتاً (${activeRejections.length})` : `Temporarily rejected (${activeRejections.length})`}
              </button>
              {showRejectedSuggestions && (
                <div className="mt-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {activeRejections.map((r) => (
                    <div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-white">
                          {r.studentName} — {r.groupName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                          {r.reason === "absence" ? (lang === "ar" ? "سبب الحضور" : "attendance") : (lang === "ar" ? "سبب التاسكات" : "tasks")}
                          {" — "}{r.rejectionReason}
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {lang === "ar" ? "تظهر تاني بتاريخ" : "Reappears"} {r.reappearAt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {exemptions.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowExemptions((v) => !v)}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
              >
                {showExemptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                🛡️ {lang === "ar" ? `استثناءات دائمة (${exemptions.length})` : `Permanent exemptions (${exemptions.length})`}
              </button>
              {showExemptions && (
                <div className="mt-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {exemptions.map((e) => (
                    <div key={e.id} className="p-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-white">
                          {e.studentName} — {e.groupName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                          {lang === "ar" ? "مستثنى من" : "Exempt from"}{" "}
                          {e.reason === "absence" ? (lang === "ar" ? "الحضور" : "attendance") : (lang === "ar" ? "التاسكات" : "tasks")}
                          {" — "}{e.exemptionReason}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {lang === "ar" ? "بواسطة" : "By"} {e.exemptedByName}
                          {e.exemptedAt?.toDate ? ` — ${e.exemptedAt.toDate().toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveExemption(e)}
                        className="text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest shrink-0"
                      >
                        {lang === "ar" ? "إلغاء الاستثناء" : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {rejectModalFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-black text-slate-800 dark:text-white">
              {lang === "ar" ? "رفض الاقتراح" : "Reject suggestion"} — {rejectModalFor.studentName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "ar"
                ? "لن يظهر هذا الاقتراح مرة أخرى قبل 7 أيام على الأقل، حتى لو استمرت الحالة."
                : "This suggestion won't reappear for at least 7 days, even if the condition persists."}
            </p>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder={lang === "ar" ? "سبب الرفض..." : "Rejection reason..."}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold min-h-[100px]"
            />
            <label className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rejectAlsoExempt}
                onChange={(e) => setRejectAlsoExempt(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                {lang === "ar"
                  ? `🛡️ استثناء دائم — أوقف المتابعة التلقائية لهذا الطالب بخصوص ${rejectModalFor.reason === "absence" ? "الحضور" : "التاسكات"} نهائياً (لن يظهر كاقتراح مرة أخرى حتى لو استمرت الحالة، حتى تُلغي الاستثناء يدوياً)`
                  : `🛡️ Permanent exemption — stop automatic follow-up for this student on ${rejectModalFor.reason} entirely (won't reappear as a suggestion until you manually remove this exemption)`}
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModalFor(null); setRejectReasonText(""); setRejectAlsoExempt(false); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleRejectSuggestion}
                disabled={!rejectReasonText.trim() || isSubmitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "تأكيد الرفض" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {suggestionEscalateModalFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-black text-slate-800 dark:text-white">
              🏛️ {lang === "ar" ? "تصعيد الاقتراح للإدارة" : "Escalate suggestion to admin"} — {suggestionEscalateModalFor.studentName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "ar"
                ? "استخدمها لما القرار المطلوب أكبر من متابعة أو رفض عادي — مثلاً الطالب مش موجود في الجروب أصلاً والقرار المطلوب حذفه من النظام. اكتب الإجراء المقترح، والأدمن هيوافق عليه قبل أي تنفيذ."
                : "Use this when the decision needed is bigger than a normal follow-up/reject — e.g. the student isn't even in the group anymore and the decision is removing them from the system. Write the proposed action; the admin approves before anything is done."}
            </p>
            <textarea
              value={suggestionEscalateAction}
              onChange={(e) => setSuggestionEscalateAction(e.target.value)}
              placeholder={lang === "ar" ? "الإجراء المقترح وسببه..." : "Proposed action and reason..."}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold min-h-[100px]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setSuggestionEscalateModalFor(null); setSuggestionEscalateAction(""); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleEscalateSuggestion}
                disabled={!suggestionEscalateAction.trim() || isSubmitting}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "تصعيد" : "Escalate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentHistoryFor && studentHistory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                📜 {lang === "ar" ? "تاريخ المتابعة" : "Follow-up History"} — {studentHistoryFor.studentName}
              </h3>
              <button
                onClick={() => setStudentHistoryFor(null)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black text-white">#{studentHistory.ordinal}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {lang === "ar"
                  ? `المتابعة رقم ${studentHistory.ordinal} لهذا الطالب${studentHistory.ordinal > 1 ? ` (اتقفلت قبل كده ${studentHistory.ordinal - 1} مرة)` : " (أول مرة)"}`
                  : `Follow-up #${studentHistory.ordinal} for this student${studentHistory.ordinal > 1 ? ` (closed ${studentHistory.ordinal - 1} time(s) before)` : " (first time)"}`}
              </p>
            </div>

            {studentHistory.ordinal >= 3 && (
              <div className="bg-rose-600/10 border border-rose-600/30 rounded-2xl p-4 text-xs font-bold text-rose-600">
                ⚠️ {lang === "ar"
                  ? "المشكلة تكررت أكتر من مرة — طبقاً للبروتوكول، فكر في التصعيد المباشر للأدمن بدل متابعة عادية."
                  : "This has recurred more than once — per protocol, consider escalating directly to admin instead of a normal follow-up."}
              </div>
            )}

            <div>
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                {lang === "ar" ? "سجل المتابعات" : "Follow-up records"} ({studentHistory.followUpsForStudent.length})
              </h4>
              {studentHistory.followUpsForStudent.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">{lang === "ar" ? "لا يوجد سجل سابق." : "No prior record."}</p>
              ) : (
                <div className="space-y-3">
                  {studentHistory.followUpsForStudent.map((f) => (
                    <div key={f.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                          {f.groupName}
                          {studentHistory.closuresByDocId[f.id] > 0 && (
                            <span className="ml-2 text-[9px] font-bold text-slate-400 normal-case">
                              {lang === "ar"
                                ? `— اتقفلت ${studentHistory.closuresByDocId[f.id]} مرة قبل كده`
                                : `— closed ${studentHistory.closuresByDocId[f.id]} time(s) before`}
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            f.status === "active"
                              ? "bg-red-500/10 text-red-600"
                              : f.status === "scheduled"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {f.status}
                        </span>
                      </div>
                      {f.labels && f.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {f.labels.map((l) => (
                            <span key={l} className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                        {(f.updates || [])
                          .slice()
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((u) => (
                            <div key={u.id} className="text-[11px] text-slate-600 dark:text-slate-400 flex gap-2">
                              <span className="text-slate-400 shrink-0">{new Date(u.createdAt).toLocaleDateString()}</span>
                              <span>{u.text}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {studentHistory.rejectionsForStudent.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  {lang === "ar" ? "اقتراحات مرفوضة سابقاً" : "Previously rejected suggestions"}
                </h4>
                <div className="space-y-2">
                  {studentHistory.rejectionsForStudent.map((r) => (
                    <div key={r.id} className="text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <span className="font-black">{r.reason}</span> — {r.rejectionReason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {studentHistory.exemptionsForStudent.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  🛡️ {lang === "ar" ? "استثناءات دائمة سارية" : "Active permanent exemptions"}
                </h4>
                <div className="space-y-2">
                  {studentHistory.exemptionsForStudent.map((e) => (
                    <div key={e.id} className="text-xs bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-3">
                      <span className="font-black">{e.reason}</span> — {e.exemptionReason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {studentHistory.escalationsForStudent.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  🏛️ {lang === "ar" ? "تصعيدات إدارية سابقة" : "Prior admin escalations"}
                </h4>
                <div className="space-y-2">
                  {studentHistory.escalationsForStudent.map((e) => (
                    <div key={e.id} className="text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <span className="font-black uppercase">{e.status}</span> — {e.proposedAction}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mainView === "escalations" && isAdmin && (
        <div className="space-y-6">
          <div className="flex gap-2">
            {(["pending", "approved", "on_hold", "resolved"] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setEscalationSection(sec)}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${escalationSection === sec ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
              >
                {sec === "pending" ? (lang === "ar" ? "بانتظار الرد" : "Pending")
                  : sec === "approved" ? (lang === "ar" ? "معتمد" : "Approved")
                  : sec === "on_hold" ? (lang === "ar" ? "معلق" : "On Hold")
                  : (lang === "ar" ? "منتهي" : "Resolved")}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {escalatedFollowUps.filter((f) => f.escalation?.status === escalationSection).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 font-bold">
                {lang === "ar" ? "لا يوجد شيء هنا" : "Nothing here"}
              </div>
            ) : (
              escalatedFollowUps
                .filter((f) => f.escalation?.status === escalationSection)
                .map((f) => (
                  <div key={f.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/40 p-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-800 dark:text-white">{f.studentName} — {f.groupName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {lang === "ar" ? "صعّدها" : "Escalated by"} {f.escalation?.escalatedByName}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-xl p-3">
                      {f.escalation?.proposedAction}
                    </p>
                    {f.escalation?.adminNote && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        {lang === "ar" ? "ملحوظة الأدمن: " : "Admin note: "}{f.escalation.adminNote}
                      </p>
                    )}
                    {isFollowUpAdminUser && escalationSection !== "resolved" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleEscalationResponse(f, "approved")}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                        >
                          {lang === "ar" ? "موافقة" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleEscalationResponse(f, "on_hold")}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                        >
                          {lang === "ar" ? "تعليق" : "On Hold"}
                        </button>
                        <button
                          onClick={() => handleEscalationResponse(f, "resolved")}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                        >
                          {lang === "ar" ? "إنهاء التصعيد" : "Resolve"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {mainView === "personal" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {([
              ["mine", lang === "ar" ? "متابعاتي" : "My Follow-ups", myFollowUps.length],
              ["tasks", lang === "ar" ? "مهام موجهة لي" : "Follow-up Tasks", myPendingTasks.length],
              ["doneByMe", lang === "ar" ? "أنهيتها بنفسي" : "Mark as done for me", myDoneTasks.length],
              ["doneAll", lang === "ar" ? "المنتهية (عموماً)" : "Mark as done (all)", allResolvedFollowUps.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setPersonalTab(key)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${personalTab === key ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
              >
                {label} <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={personalSearchQuery}
              onChange={(e) => setPersonalSearchQuery(e.target.value)}
              placeholder={lang === "ar" ? "بحث بالاسم أو رقم الموبايل..." : "Search by name or phone..."}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold shadow-sm"
            />
          </div>

          {/* personalTab === "mine" renders below via the shared "all"-style
              follow-up card list (see the broadened mainView condition further
              down) so it shows the exact same full functionality — reply,
              comments, resolve, schedule, mention, escalate — not a stripped
              summary. */}

          {personalTab === "tasks" && (
            <div className="space-y-4">
              {myPendingTasks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 font-bold">
                  {lang === "ar" ? "لا توجد مهام موجهة لك حالياً" : "No tasks assigned to you right now"}
                </div>
              ) : (
                myPendingTasks.map((m) => (
                  <div key={m.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">{m.studentName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                        {lang === "ar" ? "من" : "From"} {m.mentionedByName}{m.note ? `: ${m.note}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={replyDraft[m.id] || ""}
                        onChange={(e) => setReplyDraft((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={lang === "ar" ? "اكتب رد..." : "Write a reply..."}
                        className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold"
                      />
                      <button
                        onClick={() => handleReplyToMention(m)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                      >
                        {lang === "ar" ? "رد وإنهاء" : "Reply & Done"}
                      </button>
                      <button
                        onClick={() => handleMarkMentionDone(m)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                      >
                        {lang === "ar" ? "Mark as done" : "Mark as done"}
                      </button>
                      <input
                        type="date"
                        value={snoozeDraft[m.id] || ""}
                        onChange={(e) => setSnoozeDraft((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold"
                      />
                      <button
                        onClick={() => handleSnoozeMention(m)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest"
                      >
                        {lang === "ar" ? "ذكرني لاحقاً" : "Remind me later"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {personalTab === "doneByMe" && (
            <div className="space-y-3">
              {myDoneTasks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 font-bold">
                  {lang === "ar" ? "لا يوجد شيء هنا بعد" : "Nothing here yet"}
                </div>
              ) : (
                myDoneTasks.map((m) => (
                  <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{m.studentName}</p>
                    <span className="text-[10px] text-slate-400 font-bold">✅ {lang === "ar" ? "تم" : "Done"}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {personalTab === "doneAll" && (
            <div className="space-y-3">
              {allResolvedFollowUps.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 font-bold">
                  {lang === "ar" ? "لا يوجد شيء هنا بعد" : "Nothing here yet"}
                </div>
              ) : (
                allResolvedFollowUps.map((f) => (
                  <div key={f.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{f.studentName} — {f.groupName}</p>
                    <span className="text-[10px] text-slate-400 font-bold">
                      ✅ {f.resolvedByName || (lang === "ar" ? "تم" : "Done")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {escalateModalFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-black text-slate-800 dark:text-white">
              {lang === "ar" ? "تصعيد للإدارة" : "Escalate to admin"} — {escalateModalFor.studentName}
            </h3>
            <textarea
              value={escalateAction}
              onChange={(e) => setEscalateAction(e.target.value)}
              placeholder={lang === "ar" ? "الإجراء المقترح..." : "Proposed action..."}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold min-h-[100px]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setEscalateModalFor(null); setEscalateAction(""); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleEscalate}
                disabled={!escalateAction.trim() || isSubmitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "تصعيد" : "Escalate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(mainView === "all" || (mainView === "personal" && personalTab === "mine")) && (
      <>
      {mainView === "personal" ? (
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-1">
            {lang === "ar" ? "متابعاتي" : "My Follow-ups"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            {lang === "ar"
              ? "كل المتابعات اللي أنت مسؤول عنها — نفس الأدوات الكاملة (رد، تعليقات، حل، جدولة، تصعيد)."
              : "Every follow-up you own — the same full toolset (reply, comments, resolve, schedule, escalate)."}
          </p>
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
            {viewTab === "active"
              ? "Active Follow-ups"
              : viewTab === "scheduled"
                ? "Scheduled Follow-ups"
                : "Resolved Cases"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Monitoring track students requiring attention and resolving
            challenges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFollowUpAdminUser && (
            <button
              onClick={handleResetAllFollowUps}
              disabled={isSubmitting}
              className="px-5 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 border border-rose-600/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
            >
              🔄 {lang === "ar" ? "تصفير كل المتابعات" : "Reset All Follow-ups"}
            </button>
          )}
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all flex items-center gap-2"
          >
            <Send size={16} /> Request Follow-up
          </button>
        </div>
      </div>

      {/* Smart Usage Guide / دليل الاستخدام الذكي */}
      <div className="mb-8 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 shadow-xl transition-all duration-300">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setShowGuide(!showGuide)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">💡</span>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                دليل الاستخدام الذكي ومنظومة تتبع المتابعات والأدوار
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">
                انقر لتكبير/تصغير دليل منظومة العمل بالتفصيل
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-800/80 rounded-xl text-slate-450 hover:text-white transition-colors">
            {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {showGuide && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-800">
            {/* Trainer card */}
            <div className="p-4 bg-slate-950/20 border border-slate-800/60 rounded-2xl space-y-2">
              <span className="inline-block p-2 bg-violet-500/10 text-violet-400 rounded-xl">
                <UserIcon size={16} />
              </span>
              <h4 className="text-xs font-black text-violet-400 uppercase tracking-wider">
                👤 دور المدرب (Trainer)
              </h4>
              <p className="text-[10px] text-slate-350 leading-relaxed font-semibold">
                المسؤول المباشر عن تتبع أداء الطالب اليومي في حل وتسليم المهام.
                بإمكان المدرب مراجعة نسبة الإنجاز والغياب وكتابة التقارير
                والملاحظات المباشرة وحث الطالب على تسليم الفروض لرفع كفاءته.
              </p>
            </div>

            {/* Supervisor card */}
            <div className="p-4 bg-slate-950/20 border border-slate-800/60 rounded-2xl space-y-2">
              <span className="inline-block p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                <Users size={16} />
              </span>
              <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider">
                👑 دور المشرف (Supervisor)
              </h4>
              <p className="text-[10px] text-slate-350 leading-relaxed font-semibold">
                قائد العملية التنظيمية والمتابع للأداء العام. يملك الصلاحية
                الكاملة لتأكيد تأجيل المتابعات وتعديل تواريخ الجدولة، بالإضافة
                لاعتماد التذاكر المحلولة وحفظها في التبويب النهائي.
              </p>
            </div>

            {/* Mention card */}
            <div className="p-4 bg-slate-950/20 border border-slate-800/60 rounded-2xl space-y-2">
              <span className="inline-block p-2 bg-rose-500/10 text-rose-455 rounded-xl">
                <Send size={16} />
              </span>
              <h4 className="text-xs font-black text-rose-455 uppercase tracking-wider">
                🔔 التوجيه والمنشن (Mentions)
              </h4>
              <p className="text-[10px] text-slate-350 leading-relaxed font-semibold">
                أي عمل منشن لمشرف أو مدرب آخر في تذكرة المتابعة يعني توجيه
                المسؤولية المشتركة إليه للتدخل السريع. يظهر تنبيه المنشن بوضوح
                على التذكرة لتتكامل الأدوار وتتم المتابعة الجماعية لحل مشاكل
                الطالب.
              </p>
            </div>

            {/* General flow card */}
            <div className="p-4 bg-slate-950/20 border border-slate-800/60 rounded-2xl space-y-2">
              <span className="inline-block p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Activity size={16} />
              </span>
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                ⚙️ طريقة العمل والجدولة
              </h4>
              <p className="text-[10px] text-slate-355 leading-relaxed font-semibold">
                تنشأ المتابعة إما تلقائياً إذا هبط مستوى مهام الطالب المجموعي عن
                70%، أو يدوياً بطلب خارجي. يتم تدوين التعليقات والتنبيهات وحين
                حل المشكلة تُعرّف كحالة محلولة، وإذا تمت أرشفة الجروب تتحول معه
                تلقائياً.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-200 dark:border-slate-800 shadow-inner">
        <button
          onClick={() => setViewTab("active")}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === "active" ? "bg-primary-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          Active
        </button>
        <button
          onClick={() => setViewTab("scheduled")}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === "scheduled" ? "bg-amber-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setViewTab("resolved")}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === "resolved" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          {lang === "ar" ? "المنتهية" : "Marked as Done"}
        </button>
        <button
          onClick={() => setViewTab("archived")}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === "archived" ? "bg-rose-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          {lang === "ar" ? "المؤرشفة 📁" : "Archived 📁"}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Student name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold"
          />
        </div>
        <div className="relative">
          <Filter
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold appearance-none"
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Users
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold appearance-none"
          >
            <option value="">All Trainers</option>
            {trainers.map((t) => (
              <option key={t.uid} value={t.uid}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <UserIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <select
            value={mentionFilter}
            onChange={(e) => setMentionFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold appearance-none"
          >
            <option value="">All Mentions</option>
            <option value={user.uid}>My Mentions</option>
            {trainers.map((t) => (
              <option key={t.uid} value={t.uid}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 px-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filteredFollowUps.length} Cases Found
          </span>
        </div>
      </div>
      </>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(activeGroupedFollowUps).length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-20 rounded-4xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="text-6xl mb-6">✅</div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                {mainView === "personal"
                  ? (lang === "ar" ? "لا توجد متابعات مسؤول عنها حالياً" : "No follow-ups you own right now")
                  : "No results matching your filters"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            Object.entries(activeGroupedFollowUps).map(([groupId, items]) => {
              const followUpItems = items as StudentFollowUp[];
              const groupName = followUpItems[0].groupName;
              const trainerNames = getTrainerNames(groupId);
              const isExpanded = expandedGroupId === groupId;
              const gObj = groups.find((g) => g.id === groupId);

              return (
                <div
                  key={groupId}
                  className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
                >
                  <div
                    className="p-8 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                    onClick={() =>
                      setExpandedGroupId(isExpanded ? null : groupId)
                    }
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-2xl">
                        <Users />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {groupName}
                          </h2>
                          {gObj?.archived && (
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450 border border-rose-200 dark:border-rose-900/30 rounded-lg text-[9px] font-black tracking-widest uppercase">
                              {lang === "ar" ? "مؤرشف 📁" : "Archived 📁"}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                          {" "}
                          Trainer:{" "}
                          <span className="text-primary-600">
                            {trainerNames}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {followUpItems.length} Students
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 animate-slide-down">
                      {followUpItems.map((f) => {
                        const stats = getStudentStats(f.studentId, f.groupId);
                        const isStudentExpanded = expandedStudentId === f.id;
                        const isPendingApproval =
                          f.approvalStatus === "pending";

                        return (
                          <div
                            key={f.id}
                            className={`p-8 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all ${isStudentExpanded ? "bg-slate-50/50 dark:bg-slate-800/10" : ""} ${isPendingApproval ? "bg-purple-500/[0.04] dark:bg-purple-500/[0.08] border-l-4 border-l-purple-500 ring-1 ring-purple-500/10" : ""}`}
                          >
                            <div
                              className="flex flex-wrap items-center justify-between gap-6 cursor-pointer"
                              onClick={() =>
                                setExpandedStudentId(
                                  isStudentExpanded ? null : f.id,
                                )
                              }
                            >
                              <div className="flex items-center gap-6 min-w-0 flex-1">
                                <div
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 ${
                                    isPendingApproval ||
                                    f.colorStatus === "purple"
                                      ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300"
                                      : f.colorStatus === "red"
                                        ? "bg-red-100 text-red-600"
                                        : f.colorStatus === "yellow"
                                          ? "bg-amber-100 text-amber-600"
                                          : "bg-emerald-100 text-emerald-600"
                                  }`}
                                >
                                  <UserIcon />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg truncate">
                                      {f.studentName}
                                    </h3>
                                    {students.find((s) => s.id === f.studentId)
                                      ?.phone && (
                                      <a
                                        href={`https://wa.me/${students.find((s) => s.id === f.studentId)?.phone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center w-7 h-7 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-500/20 transition-all hover:scale-110"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open WhatsApp Chat"
                                      >
                                        <MessageSquare
                                          size={14}
                                          fill="currentColor"
                                          fillOpacity={0.2}
                                        />
                                      </a>
                                    )}
                                    {getFollowUpOrdinal(f.studentId) > 1 && (
                                      <span
                                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getFollowUpOrdinal(f.studentId) >= 3 ? "bg-rose-600/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}
                                      >
                                        #{getFollowUpOrdinal(f.studentId)}
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStudentHistoryFor({ studentId: f.studentId, studentName: f.studentName });
                                      }}
                                      className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1"
                                    >
                                      📜 {lang === "ar" ? "السجل" : "History"}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {f.labels?.map((label) => {
                                      let text = label;
                                      let color =
                                        "bg-slate-500/10 text-slate-600";

                                      if (label === "absence") {
                                        text =
                                          lang === "ar"
                                            ? "تنبيه غياب"
                                            : "Absence Alert";
                                        color = "bg-red-500/10 text-red-600";
                                      } else if (label === "tasks") {
                                        text =
                                          lang === "ar"
                                            ? "تنبيه مهام"
                                            : "Tasks Alert";
                                        color =
                                          "bg-amber-500/10 text-amber-600";
                                      } else if (label === "distinguished") {
                                        text =
                                          lang === "ar"
                                            ? "متميز"
                                            : "Distinguished";
                                        color =
                                          "bg-emerald-500/10 text-emerald-600";
                                      } else if (label === "best_achiever") {
                                        text =
                                          lang === "ar"
                                            ? "أفضل إنجاز"
                                            : "Best Achiever";
                                        color =
                                          "bg-primary-500/10 text-primary-600";
                                      } else if (label === "online") {
                                        text =
                                          lang === "ar"
                                            ? "أونلاين 🌐"
                                            : "Online 🌐";
                                        color =
                                          "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20";
                                      } else if (label === "offline") {
                                        text =
                                          lang === "ar"
                                            ? "أوفلاين 🏢"
                                            : "Offline 🏢";
                                        color =
                                          "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20";
                                      }

                                      return (
                                        <span
                                          key={label}
                                          className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${color}`}
                                        >
                                          {text}
                                        </span>
                                      );
                                    })}
                                    {f.mentionedUserId && (
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                        {lang === "ar"
                                          ? `إشارة: ${f.mentionedUserName}`
                                          : `Mention: ${f.mentionedUserName}`}
                                      </span>
                                    )}
                                    {f.supervisorOrder && (
                                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                        {lang === "ar"
                                          ? "أمر مشرف ⚠️"
                                          : "Supervisor Flag ⚠️"}
                                      </span>
                                    )}
                                    {f.status === "active" && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-300">
                                        {lang === "ar" ? "مُتابع نشط 🟢" : "Active Follow-up 🟢"}
                                      </span>
                                    )}
                                    {f.status === "scheduled" && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-850 rounded-lg text-[8px] font-black uppercase tracking-widest border border-amber-300">
                                        {lang === "ar"
                                          ? `⏳ مجدول إعادة متابعته يوم: ${f.scheduledAt}`
                                          : `⏳ Scheduled Re-follow on: ${f.scheduledAt}`}
                                      </span>
                                    )}
                                    {isPendingApproval && (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-[8px] font-black uppercase tracking-widest border border-purple-200">
                                        {lang === "ar"
                                          ? `⏳ تأجيل معلق: ${f.pendingNextFollowUpDate}`
                                          : `⏳ Pending Delay: ${f.pendingNextFollowUpDate}`}
                                      </span>
                                    )}
                                    {f.attendanceResetSessionNumber !==
                                      undefined &&
                                      f.attendanceResetSessionNumber !==
                                        null && (
                                        <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-lg text-[8px] font-black uppercase tracking-widest border border-teal-200">
                                          {lang === "ar"
                                            ? `⚙️ تم تصفير الغياب (م ${f.attendanceResetSessionNumber})`
                                            : `⚙️ Absence Reset (Lec ${f.attendanceResetSessionNumber})`}
                                        </span>
                                      )}
                                  </div>

                                  {/* Action Figures: Group, Trainer, Supervisor, and Mentions */}
                                  {(() => {
                                    const g = groups.find(
                                      (group) => group.id === f.groupId,
                                    );
                                    const groupTrainers = trainers
                                      .filter(
                                        (u) =>
                                          g?.trainerIds?.includes(u.uid) ||
                                          g?.assignedTrainerIds?.includes(
                                            u.uid,
                                          ),
                                      )
                                      .map((u) => u.name);
                                    return (
                                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800/40">
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-350 rounded-xl text-[8px] font-bold flex items-center gap-1">
                                          🏫 {g?.name || f.groupName}
                                        </span>
                                        {groupTrainers.length > 0 && (
                                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-450 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-violet-100 dark:border-violet-950/30">
                                            👤{" "}
                                            {lang === "ar"
                                              ? "المدرب:"
                                              : "Trainer:"}{" "}
                                            {groupTrainers.join(", ")}
                                          </span>
                                        )}
                                        {(g?.supervisorName ||
                                          g?.supervisorId) && (
                                          <span className="px-2 py-0.5 bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-455 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-sky-100 dark:border-sky-950/30">
                                            👑{" "}
                                            {lang === "ar"
                                              ? "المشرف:"
                                              : "Supervisor:"}{" "}
                                            {g?.supervisorName || "معيّن"}
                                          </span>
                                        )}
                                        {(g?.assistantTrainerName ||
                                          (g?.assistantTrainerId && trainers.find((u) => u.uid === g.assistantTrainerId))) && (
                                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-emerald-100 dark:border-emerald-950/30">
                                            🤝{" "}
                                            {lang === "ar"
                                              ? "المساعد:"
                                              : "Assistant:"}{" "}
                                            {g?.assistantTrainerName || trainers.find((u) => u.uid === g?.assistantTrainerId)?.name}
                                          </span>
                                        )}
                                        {f.mentionedUserName && (
                                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 rounded-xl text-[8px] font-bold flex items-center gap-1 border border-rose-100 dark:border-rose-950/30">
                                            🔔{" "}
                                            {lang === "ar"
                                              ? "الموجّه إليه المتابعة:"
                                              : "Mentioned:"}{" "}
                                            {f.mentionedUserName}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="flex items-center gap-8 text-right">
                                {/* Academic Stats */}
                                <div className="flex gap-6 border-r border-slate-200 dark:border-slate-800 pr-8 mr-2 overflow-x-auto no-scrollbar">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                      Tasks Done
                                    </span>
                                    <span
                                      className={`text-xs font-black ${stats.rate < 50 ? "text-red-500" : "text-blue-500"}`}
                                    >
                                      {stats.tasks} ({stats.rate}%)
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                      Attendance
                                    </span>
                                    <span
                                      className={`text-xs font-black ${stats.attRate < 50 ? "text-red-500" : "text-emerald-500"}`}
                                    >
                                      {stats.attendance} ({stats.attRate}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                    Resolution
                                  </span>
                                  <span
                                    className={`text-[10px] font-black uppercase ${f.status === "active" ? "text-amber-500" : "text-emerald-500"}`}
                                  >
                                    {f.status === "active"
                                      ? "Active"
                                      : "Marked as Done"}
                                  </span>
                                </div>
                                {isStudentExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {isStudentExpanded && (() => {
                              const myPendingMention = mentions.find(
                                (m) =>
                                  m.followUpId === f.id &&
                                  m.mentionedUserId === user.uid &&
                                  m.status === "pending",
                              );
                              return (
                              <div className="mt-8 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 space-y-6 animate-slide-down">
                                {myPendingMention && (
                                  <div className="bg-primary-500/10 border border-primary-500/30 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-1">
                                        🔔 {lang === "ar" ? "مطلوب منك رد" : "A response is expected from you"}
                                      </h4>
                                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {lang === "ar" ? "من" : "From"} {myPendingMention.mentionedByName}
                                        {myPendingMention.note ? `: ${myPendingMention.note}` : ""}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleMarkMentionDone(myPendingMention)}
                                      disabled={isSubmitting}
                                      className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shrink-0"
                                    >
                                      {lang === "ar" ? "Mark as done for me" : "Mark as done for me"}
                                    </button>
                                  </div>
                                )}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left Side: Input Form */}
                                <div className="space-y-6">
                                  {f.approvalStatus === "pending" && (
                                    <div className="bg-purple-100/60 dark:bg-purple-950/20 p-6 rounded-3xl border border-purple-200/50 relative overflow-hidden animate-pulse shadow-md">
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                                        ✨{" "}
                                        {lang === "ar"
                                          ? "طلب تأجيل معلق"
                                          : "Postponement Request Pending Approval"}
                                      </h4>
                                      <p className="text-sm font-bold text-purple-900 dark:text-purple-300 leading-relaxed mb-4">
                                        {lang === "ar"
                                          ? `الموعد المقترح: ${f.pendingNextFollowUpDate}`
                                          : `Proposed Follow-up Date: ${f.pendingNextFollowUpDate}`}
                                        {f.pendingNextFollowUpNote && (
                                          <span className="block italic text-xs mt-2 text-purple-700/80 dark:text-purple-400/80 font-normal">
                                            "{f.pendingNextFollowUpNote}"
                                          </span>
                                        )}
                                      </p>
                                      {isAdmin ? (
                                        <div className="flex gap-3">
                                          <button
                                            onClick={() =>
                                              handleApproveNextFollowUp(f)
                                            }
                                            disabled={isSubmitting}
                                            className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/10 transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
                                          >
                                            ✅{" "}
                                            {lang === "ar"
                                              ? "موافقة وتأجيل"
                                              : "Approve & Postpone"}
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleRejectNextFollowUp(f)
                                            }
                                            disabled={isSubmitting}
                                            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/10 transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
                                          >
                                            ❌{" "}
                                            {lang === "ar"
                                              ? "رفض الطلب"
                                              : "Reject Request"}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                                          ℹ️{" "}
                                          {lang === "ar"
                                            ? "بانتظار مراجعة المشرف للطلب."
                                            : "Waiting for a supervisor to review the request."}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {f.supervisorOrder && (
                                    <div className="bg-amber-100/50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-200/50 relative overflow-hidden">
                                      <div className="absolute top-0 right-0 p-3">
                                        <Clock className="text-amber-500/20 w-12 h-12" />
                                      </div>
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">
                                        Supervisor Order
                                      </h4>
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                                        {f.supervisorOrder.note}
                                      </p>
                                      <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                        <span className="text-amber-600">
                                          BY:{" "}
                                          {f.supervisorOrder.requestedByName}
                                        </span>
                                        <span className="text-red-600 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl shadow-sm border border-red-50">
                                          BY: {f.supervisorOrder.deadline}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-4">
                                    {/* Postpone & Warning Reset Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-950/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-purple-500" />
                                          {lang === "ar"
                                            ? "تحديد موعد المتابعة القادمة"
                                            : "Set Next Follow-up Date"}
                                        </label>
                                        <input
                                          type="date"
                                          value={nextFollowUpDates[f.id] || ""}
                                          onChange={(e) =>
                                            setNextFollowUpDates((prev) => ({
                                              ...prev,
                                              [f.id]: e.target.value,
                                            }))
                                          }
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-800 dark:text-white"
                                        />
                                        <p className="text-[9px] text-slate-400 font-medium">
                                          {lang === "ar"
                                            ? "إخفاء من القائمة النشطة حتى موعد المتابعة القادمة (يتطلب موافقة المشرف)"
                                            : "Hides from active list until this date (Requires supervisor approval)"}
                                        </p>
                                      </div>

                                      <div className="flex flex-col justify-center gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-1.5">
                                          <RefreshCcw className="w-3.5 h-3.5 text-rose-500" />
                                          {lang === "ar"
                                            ? "إلغاء تنبيه الغياب والبدء من جديد"
                                            : "Cancel Absence Warning & Reset"}
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCancelAbsenceWarnings(
                                              (prev) => ({
                                                ...prev,
                                                [f.id]: !prev[f.id],
                                              }),
                                            )
                                          }
                                          className={`w-full py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                            cancelAbsenceWarnings[f.id]
                                              ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              !!cancelAbsenceWarnings[f.id]
                                            }
                                            readOnly
                                            className="accent-rose-500 cursor-pointer hidden"
                                          />
                                          {cancelAbsenceWarnings[f.id]
                                            ? lang === "ar"
                                              ? "✓ تم تفعيل خيار إلغاء التنبيه"
                                              : "✓ Reset Warning Activated"
                                            : lang === "ar"
                                              ? "تفعيل إلغاء وحساب الغياب مجدداً"
                                              : "Activate Reset Warning"}
                                        </button>
                                        <p className="text-[9px] text-slate-400 font-medium">
                                          {lang === "ar"
                                            ? "تجاوز الغيابات السابقة والبدء بحساب نسبة الغياب مجدداً من هذه النقطة"
                                            : "Clears past attendance, restarting evaluation threshold forward"}
                                        </p>
                                      </div>
                                    </div>

                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 block">
                                      Progress Update & Training Note
                                    </label>
                                    {replyingToUpdate[f.id] && (
                                      <div className="flex items-center justify-between bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-2">
                                        <span className="text-[10px] font-black text-primary-600 flex items-center gap-1">
                                          <Reply size={12} />{" "}
                                          {lang === "ar" ? "الرد على تحديث " : "Replying to "}
                                          {replyingToUpdate[f.id]?.authorName}
                                        </span>
                                        <button
                                          onClick={() =>
                                            setReplyingToUpdate((prev) => ({
                                              ...prev,
                                              [f.id]: null,
                                            }))
                                          }
                                          className="text-[10px] font-black text-slate-400 hover:text-slate-600"
                                        >
                                          {lang === "ar" ? "إلغاء" : "Cancel"}
                                        </button>
                                      </div>
                                    )}
                                    <textarea
                                      value={trainerNote}
                                      onChange={(e) =>
                                        setTrainerNote(e.target.value)
                                      }
                                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 text-sm resize-none focus:ring-4 focus:ring-primary-500/10 outline-none transition-all h-32"
                                      placeholder={
                                        lang === "ar"
                                          ? "أضف ملاحظة أو تحديث للمتدرب..."
                                          : "Add progress note describing what happened with the student..."
                                      }
                                    />

                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
                                      <span className="text-[10px] font-black text-slate-500 uppercase">
                                        Mention & Direct Follow-up to:
                                      </span>
                                      <select
                                        value={
                                          mentionUserIdForFollowUp[f.id] || ""
                                        }
                                        onChange={(e) =>
                                          setMentionUserIdForFollowUp(
                                            (prev) => ({
                                              ...prev,
                                              [f.id]: e.target.value,
                                            }),
                                          )
                                        }
                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs font-bold rounded-xl flex-1 outline-none"
                                      >
                                        <option value="">
                                          No Mention (Optional)
                                        </option>
                                        {trainers.map((t) => (
                                          <option key={t.uid} value={t.uid}>
                                            {t.name} ({t.role})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => handleTrainerUpdate(f)}
                                        disabled={
                                          isSubmitting ||
                                          !trainerNote.trim() ||
                                          f.status === "resolved"
                                        }
                                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                                      >
                                        <Activity className="w-4 h-4" /> Save
                                        Update
                                      </button>
                                      {isAdmin && f.status === "active" && (
                                        <button
                                          onClick={() => handleResolve(f)}
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          <CheckCircle className="w-4 h-4" />{" "}
                                          Mark as Done
                                        </button>
                                      )}
                                      {f.status !== "resolved" && (
                                        <button
                                          onClick={() =>
                                            handleOpenRequestForStudent(f)
                                          }
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          <Send className="w-4 h-4" /> Request
                                          Follow-up
                                        </button>
                                      )}
                                      {f.status !== "resolved" && (
                                        <button
                                          onClick={() => handleOpenSchedule(f)}
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          <Calendar className="w-4 h-4" />{" "}
                                          Schedule Re-follow
                                        </button>
                                      )}
                                      {f.status === "scheduled" && (
                                        <button
                                          onClick={() =>
                                            handleReactivateScheduled(f)
                                          }
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-sky-600/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          <RefreshCcw className="w-4 h-4" />{" "}
                                          {lang === "ar"
                                            ? "تنشيط المتابعة الآن"
                                            : "Activate Follow-up Now"}
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/groups/${f.groupId}?tab=taskProgress&studentId=${f.studentId}`,
                                          )
                                        }
                                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                      >
                                        <ListTodo className="w-4 h-4" />{" "}
                                        {lang === "ar"
                                          ? "تقدم التاسكات"
                                          : "Task Progress"}
                                      </button>
                                      {students.find((s) => s.id === f.studentId)
                                        ?.tasksLink && (
                                        <a
                                          href={
                                            students.find(
                                              (s) => s.id === f.studentId,
                                            )?.tasksLink
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-1 py-4 bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 border border-sky-500/30 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                          <ExternalLink className="w-4 h-4" />{" "}
                                          {lang === "ar"
                                            ? "لينك التاسكات"
                                            : "Tasks Link"}
                                        </a>
                                      )}
                                      {canEscalate && f.status === "active" && !f.escalation && (
                                        <button
                                          onClick={() => setEscalateModalFor(f)}
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          🔺 {lang === "ar" ? "تصعيد للإدارة" : "Escalate to Admin"}
                                        </button>
                                      )}
                                      {f.escalation && (
                                        <div className="flex-1 py-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                          🔺 {lang === "ar" ? "تم التصعيد" : "Escalated"} ({f.escalation.status})
                                        </div>
                                      )}
                                      {isAdmin && f.status === "resolved" && (
                                        <button
                                          onClick={() => handleReopen(f)}
                                          disabled={isSubmitting}
                                          className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          <RefreshCcw className="w-4 h-4" />{" "}
                                          Continue Follow-up
                                        </button>
                                      )}
                                      {!isAdmin && f.status === "active" && (
                                        <div className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black text-[8px] uppercase tracking-widest flex items-center justify-center text-center px-4">
                                          Only Supervisor can Resolve
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Tabbed Timeline Log */}
                                <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px]">
                                  <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    <button
                                      onClick={() =>
                                        setInteractionTab((prev) => ({
                                          ...prev,
                                          [f.id]: "comments",
                                        }))
                                      }
                                      className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${!interactionTab[f.id] || interactionTab[f.id] === "comments" ? "text-primary-600 border-b-2 border-primary-600" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                      <MessageSquare size={14} /> Comments
                                    </button>
                                    <button
                                      onClick={() =>
                                        setInteractionTab((prev) => ({
                                          ...prev,
                                          [f.id]: "updates",
                                        }))
                                      }
                                      className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${interactionTab[f.id] === "updates" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                      <History size={14} /> Trainer Updates
                                    </button>
                                  </div>

                                  <div className="flex-1 p-6 relative flex flex-col">
                                    <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar scroll-smooth pr-2 pb-20">
                                      {!interactionTab[f.id] ||
                                      interactionTab[f.id] === "comments" ? (
                                        // Comments List
                                        <>
                                          {f.comments
                                            ?.sort(
                                              (a, b) =>
                                                new Date(
                                                  b.createdAt,
                                                ).getTime() -
                                                new Date(a.createdAt).getTime(),
                                            )
                                            .map((c) => (
                                              <div
                                                key={c.id}
                                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm"
                                              >
                                                <div className="flex justify-between items-center mb-1">
                                                  <span className="text-[9px] font-black text-primary-600 uppercase tracking-widest">
                                                    {c.createdByName} •{" "}
                                                    {c.createdByRole}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400">
                                                    {new Date(
                                                      c.createdAt,
                                                    ).toLocaleString()}
                                                  </span>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                  {c.text}
                                                </p>
                                              </div>
                                            ))}
                                          {(!f.comments ||
                                            f.comments.length === 0) && (
                                            <div className="h-40 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                              <MessageSquare
                                                size={32}
                                                className="mb-2 opacity-30"
                                              />
                                              <span className="text-[10px] font-black uppercase tracking-tighter">
                                                No discussion yet
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        // Updates Timeline
                                        <div className="space-y-8 pl-4 border-l-2 border-emerald-500/20 py-2">
                                          {f.updates
                                            ?.sort(
                                              (a, b) =>
                                                new Date(
                                                  b.createdAt,
                                                ).getTime() -
                                                new Date(a.createdAt).getTime(),
                                            )
                                            .map((u) => (
                                              <div
                                                key={u.id}
                                                className="relative"
                                              >
                                                <div className="absolute -left-[25px] top-0 w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/10" />
                                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[1.5rem] shadow-sm ml-2">
                                                  <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full">
                                                      {u.createdByName}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                      {new Date(
                                                        u.createdAt,
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                                    {u.text}
                                                  </p>
                                                  {u.createdByUid !== user.uid && (
                                                    <button
                                                      onClick={() =>
                                                        setReplyingToUpdate((prev) => ({
                                                          ...prev,
                                                          [f.id]: {
                                                            id: u.id,
                                                            authorName: u.createdByName,
                                                          },
                                                        }))
                                                      }
                                                      className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700"
                                                    >
                                                      <Reply size={12} />{" "}
                                                      {lang === "ar" ? "رد" : "Reply"}
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          {(!f.updates ||
                                            f.updates.length === 0) && (
                                            <div className="h-40 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl ml-2">
                                              <History
                                                size={32}
                                                className="mb-2 opacity-30"
                                              />
                                              <span className="text-[10px] font-black uppercase tracking-tighter">
                                                No progress updates yet
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Quick Comment Input (Only for comments tab) */}
                                    {(!interactionTab[f.id] ||
                                      interactionTab[f.id] === "comments") && (
                                      <div className="absolute bottom-6 left-6 right-6 space-y-2">
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            Assign/Mention:
                                          </span>
                                          <select
                                            value={
                                              mentionUserIdForFollowUp[f.id] ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              setMentionUserIdForFollowUp(
                                                (prev) => ({
                                                  ...prev,
                                                  [f.id]: e.target.value,
                                                }),
                                              )
                                            }
                                            className="bg-transparent text-[10px] font-bold text-primary-600 outline-none flex-1"
                                          >
                                            <option value="">
                                              No Mention (Optional)
                                            </option>
                                            {trainers.map((t) => (
                                              <option key={t.uid} value={t.uid}>
                                                {t.name} ({t.role})
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 p-2 rounded-2xl shadow-xl flex gap-2">
                                          <input
                                            type="text"
                                            value={newComment}
                                            onChange={(e) =>
                                              setNewComment(e.target.value)
                                            }
                                            placeholder="Write a comment..."
                                            onKeyPress={(e) =>
                                              e.key === "Enter" &&
                                              handleAddComment(f)
                                            }
                                            className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-xl text-xs font-bold focus:ring-0 outline-none"
                                          />
                                          <button
                                            onClick={() => handleAddComment(f)}
                                            disabled={
                                              isSubmitting || !newComment.trim()
                                            }
                                            className="w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20"
                                          >
                                            <Send size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {/* Request Follow-up Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">
              Request New Follow-up
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                  Group
                </label>
                <select
                  value={requestData.groupId}
                  onChange={(e) =>
                    setRequestData({
                      ...requestData,
                      groupId: e.target.value,
                      studentId: "",
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold"
                >
                  <option value="">Select Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                  Student
                </label>
                <select
                  value={requestData.studentId}
                  onChange={(e) =>
                    setRequestData({
                      ...requestData,
                      studentId: e.target.value,
                    })
                  }
                  disabled={!requestData.groupId}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold"
                >
                  <option value="">Select Student</option>
                  {students
                    .filter((s) => s.groupId === requestData.groupId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                    Mention (Responsible)
                  </label>
                  <select
                    value={requestData.mentionedUserId}
                    onChange={(e) =>
                      setRequestData({
                        ...requestData,
                        mentionedUserId: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold"
                  >
                    <option value="">None</option>
                    {trainers.map((t) => (
                      <option key={t.uid} value={t.uid}>
                        {t.name} ({t.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={requestData.deadline}
                    onChange={(e) =>
                      setRequestData({
                        ...requestData,
                        deadline: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                  Labels
                </label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {["absence", "tasks", "distinguished", "best_achiever"].map(
                    (l) => (
                      <button
                        key={l}
                        onClick={() => {
                          const newLabels = requestData.labels.includes(l)
                            ? requestData.labels.filter((x) => x !== l)
                            : [...requestData.labels, l];
                          setRequestData({ ...requestData, labels: newLabels });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestData.labels.includes(l) ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 ring-1 ring-slate-200 dark:ring-slate-700"}`}
                      >
                        {l}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                  Notes
                </label>
                <textarea
                  value={requestData.note}
                  onChange={(e) =>
                    setRequestData({ ...requestData, note: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold h-24 resize-none"
                  placeholder="What needs to be done with this student?"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestFollowUp}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Submitting..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduling Modal */}
      {isScheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">
              {lang === "ar" ? "جدولة إعادة المتابعة 🗓️" : "Schedule Re-follow"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {lang === "ar"
                ? "اختر تاريخاً محداً لعودة المتدرب لقائمة المتابعات النشطة تلقائياً."
                : "Choose a date to bring this student back to the follow-up list."}
            </p>

            <div className="mb-6">
              <button
                type="button"
                onClick={handleScheduleTomorrow}
                disabled={isSubmitting}
                className="w-full py-4 mb-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>
                  🌅{" "}
                  {lang === "ar"
                    ? "جدولة لغدٍ تلقائياً (تأجيل لبكرة)"
                    : "Schedule for Tomorrow"}
                </span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase">
                  {lang === "ar"
                    ? "أو اختر يوماً آخراً"
                    : "Or select another date"}
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2">
                {lang === "ar" ? "تاريخ العودة للمتابعة" : "Return Date"}
              </label>
              <input
                type="date"
                value={scheduleData.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) =>
                  setScheduleData({ ...scheduleData, date: e.target.value })
                }
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-center outline-none focus:ring-4 focus:ring-amber-500/10"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmSchedule}
                disabled={isSubmitting || !scheduleData.date}
                className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 transition-all"
              >
                {lang === "ar" ? "تأكيد الجدولة" : "Schedule Now"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </Layout>
  );
};

export default FollowUps;
