
export type GoogleConnectionType = 'central' | 'organizer';
export type GoogleConnectionStatus = 'connected' | 'disconnected' | 'reconnect_required';

export type EmailTemplateType = 'welcome' | 'welcome_group' | 'session_reminder' | 'session_changed' | 'absence_notification' | 'weekly_report' | 'trainer_announcement' | 'test';

export interface EmailLog {
  id: string;
  recipientEmail: string;
  studentName?: string;
  groupId?: string;
  groupCode?: string;
  courseName?: string;
  template: EmailTemplateType;
  status: 'sent' | 'failed';
  sentAt: any;
  error?: string;
}

export interface GoogleAuditLog {
  id: string;
  action: 'Email Sent' | 'Calendar Created' | 'Calendar Updated' | 'Calendar Deleted' | 'Error' | string;
  operator: string;
  operatorEmail?: string;
  groupId?: string;
  groupName?: string;
  sessionId?: string;
  sessionNumber?: number;
  details: string;
  status: 'success' | 'failed';
  timestamp: any;
  error?: string;
}

export interface GoogleConnection {
  id: string;
  email: string;
  displayName: string;
  type: GoogleConnectionType;
  status: GoogleConnectionStatus;
  encryptedRefreshToken?: string;
  lastConnectedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export type UserRole = 'admin' | 'coordinator' | 'team_leader' | 'trainer' | 'supervisor';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: any;
  disabled?: boolean;
}

export interface CourseChecklistItemTemplate {
  id: string;
  title: string;
  description?: string;
  module?: string;
  seq: number;
  isRequired: boolean;
  suggestedSession?: number;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  createdAt: any;
  maxApprovedHours?: number; // الحد الأقصى لساعات العمل المعتمدة للمحاضرة الواحد
  checklist?: CourseChecklistItemTemplate[];
}

export interface TrainerPlan {
  id: string; // `${trainerId}_${courseId}`
  trainerId: string;
  trainerName: string;
  courseId: string;
  courseName: string;
  expectedSessions: number;
  allocations: Record<string, number>; // itemId -> plannedSessionNumber (1-indexed)
  notes?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface GroupChecklistItem {
  id: string; // Same as Course checklist item ID
  title: string;
  description?: string;
  module?: string;
  seq: number;
  isRequired: boolean;
  suggestedSession?: number;
  plannedSession: number; // Initially from TrainerPlan or Course Checklist default
  status: 'not_started' | 'planned' | 'completed' | 'partially_completed' | 'skipped';
  completedInSessionNumber?: number | null;
  completedAt?: string | null; // ISO Date / YYYY-MM-DD
  completedByUid?: string | null;
  completedByName?: string | null;
}

export interface GroupExecutionPlan {
  id: string; // groupId
  groupId: string;
  items: GroupChecklistItem[];
  updatedAt?: any;
  updatedByUid?: string;
  updatedByName?: string;
}

export interface Group {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  startDate: string;
  daysOfWeek: string[];
  totalSessions: number;
  sessionTime: string;
  trainerIds: string[];
  primaryTrainerId?: string;
  secondaryTrainerId?: string;
  assistantTrainerId?: string;
  assistantTrainerName?: string;
  supervisorId?: string;
  supervisorName?: string;
  createdAt: any;
  archived?: boolean;
  telegramLink?: string;    // Interactive Telegram Channel link for the group
  telegramRecordsLink?: string; // Telegram channel link for lecture records
  whatsappLink?: string;    // Interactive WhatsApp Group link for the group
  groupType?: 'online' | 'offline';
  feedbackSessions?: number[];
  batchCode?: string;
  sourceSystem?: string;
  sourceGroupId?: string;
  importedAt?: string;
  calendarInvitationMode?: 'all_at_creation' | '24h_before';
  certificatesVisibleToStudents?: boolean;
}

export interface StudentCertificateRecord {
  id: string; // `${groupId}_${studentId}`
  groupId: string;
  studentId: string;
  studentName?: string;
  statusOverride?: 'none' | 'exception_granted' | 'blocked';
  overrideReason?: string;
  certificateUrl?: string;
  uneligibilityReason?: string;
  updatedAt?: any;
  updatedByUid?: string;
  updatedByName?: string;
}

export type TaskStatus = 
  | 'assigned'      // تم الإسناد
  | 'received'      // تم الاستلام
  | 'in_progress'   // قيد التنفيذ
  | 'on_hold'       // قائمة الانتظار
  | 'delivered'     // تم التسليم
  | 'under_review'  // قيد المراجعة
  | 'approved'      // تم الاعتماد
  | 'rejected'      // مرفوضة
  | 'completed';    // مكتملة

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
  fileUrl?: string;
  notes?: string;
}

export interface TaskFile {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: any;
}

export interface TaskComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_status' | 'task_deadline' | 'task_overdue' | 'task_review' | 'followup_mention' | 'followup_suggestion' | 'followup_escalation' | 'followup_reply';
  read: boolean;
  createdAt: any;
  link?: string;
}

export interface AssignedTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // trainerId or coordinatorId
  assignedToName: string;
  assignedBy: string; // manager uid
  assignedByName: string;
  dueDate: any; // timestamp
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: SubTask[];
  files: TaskFile[];
  comments: TaskComment[];
  groupId?: string;
  groupName?: string;
  courseType?: 'online' | 'offline';
  completedAt: any | null;
  createdAt: any;
  updatedAt: any;
}

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  description: string;
  active: boolean;
  createdAt: any;
}

export interface TrainerDailyReport {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string; // YYYY-MM-DD
  completedRecurring: string[]; // template ids
  completedAssigned: string[]; // assignedTasks ids
  dailyNotes: string;
  submittedAt: any;
  completionScore: number;
}

export interface RolePermissions {
  role: UserRole;
  permissions: {
    viewDashboard: boolean;
    viewUsers: boolean;
    viewCourses: boolean;
    viewGroups: boolean;
    viewStudents: boolean;
    viewMarketing: boolean;
    viewWeeklySchedule: boolean;
    viewExports: boolean;
    viewActivityLog: boolean;
    viewTasks: boolean;
    createTasks: boolean;
    manageTemplates: boolean;
    viewAllReports: boolean;
    submitDailyReport: boolean;
    manageGroups: boolean;
    manageCourses: boolean;
    manageStudents: boolean;
    manageUsers: boolean;
    viewRanking: boolean;
    manageEvaluations: boolean;
    viewPerformanceReports: boolean;
    submitPerformanceReport: boolean;
    approvePerformanceReport: boolean;
    viewAllFollowUps: boolean;
    viewFollowUpSuggestions: boolean;
    approveFollowUpSuggestion: boolean;
    resolveFollowUp: boolean;
    approveFollowUpReschedule: boolean;
    escalateFollowUp: boolean;
  }
}

export interface PerformanceDailyReport {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string; // YYYY-MM-DD
  dayName: string;

  assignedGroups: { groupId: string; groupName: string }[];

  checklist: {
    evaluatedTasks: { done: boolean; comment: string };
    followedWhatsappQuestions: { done: boolean; comment: string };
    outstandingStudents: { done: boolean; comment: string };
    atRiskStudentsAdded: { done: boolean; comment: string };
    atRiskStudentsResolved: { done: boolean; comment: string };
    technicalIssuesSolved: { done: boolean; comment: string };
    recordedSolutionVideo: { done: boolean; comment: string };
    usedAnyDesk: { done: boolean; comment: string };
    attendanceCollected: { done: boolean; comment: string };
    reviewedLecturesAndTasks: { done: boolean; comment: string };
    notifiedWhatsappUpload: { done: boolean; comment: string };
  };

  dependencyIssue: {
    hasIssue: boolean;
    blockedById: string | null;
    blockedByName: string | null;
    details: string;
  };

  complaintsReported: string;
  additionalNotes: string;

  supervisorStatus: "pending" | "accepted" | "rejected";
  supervisorComment: string;

  managerStatus: "pending" | "accepted" | "rejected";
  managerComment: string;

  violationRecorded: boolean;
  violationDetails?: string;

  links?: string[]; // Added for screenshots or other links

  submittedAt: any;
  lastUpdatedAt: any;
}

export interface PerformanceWeeklyReport {
  id: string;
  trainerId: string;
  trainerName: string;
  weekStart: string;
  weekEnd: string;

  aiGeneratedSummary: string;
  trainerFinalComment: string;

  supervisorStatus: "pending" | "approved" | "needs_revision";
  supervisorComment: string;

  managerStatus: "pending" | "approved" | "needs_revision";
  managerComment: string;

  submittedAt: any;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  email?: string;
  attendanceEmail?: string;  // Email used specifically for Google Calendar attendance invitations
  groupId: string;
  createdAt: any;
  studentIdNum?: string;     // Unique 5 or 6 digit code for login
  studentPassword?: string;  // 5-character auto password
  notes?: string;
  whatsapp?: string;
  github?: string;
  linkedin?: string;
  telegramLink?: string;     // Student specific telegram link if any
  whatsappLink?: string;     // Student specific WhatsApp link if any
  tasksLink?: string;        // Student specific telegram topic/tasks submission link
  hasLoggedIn?: boolean;     // Whether the student has ever successfully logged into the Student Portal
  firstLoginAt?: string;    // ISO timestamp of first successful portal login
  lastLoginAt?: string;     // ISO timestamp of most recent portal login
  loginCount?: number;      // Number of portal logins/sessions
  credsSent?: boolean;
  credsSentByName?: string;
  credsSentByUid?: string;
  credsSentAt?: string;
  welcomeEmailSent?: boolean;
  welcomeEmailSentAt?: string;
  welcomeEmailStatus?: 'sent' | 'failed' | 'not_sent';
  welcomeEmailError?: string;
  welcomeEmailFailedAt?: string;
  deactivated?: boolean;
  deactivatedAt?: string;
  deactivatedByUid?: string;
  deactivatedByName?: string;
  deactivationReason?: string;
  deactivationReasonCategory?: 'unpaid_50_percent' | 'installment_delinquency' | 'permanent_suspension' | 'other';
  permanentDeactivation?: boolean;
  is50PercentPaid?: boolean;
  deactivationChecklist?: Record<string, boolean>;
  deactivationHistory?: Array<{
    type: 'deactivate' | 'reactivate';
    reasonCategory?: 'unpaid_50_percent' | 'installment_delinquency' | 'permanent_suspension' | 'other';
    reason: string;
    timestamp: string;
    performedByUid: string;
    performedByName: string;
    checklist?: Record<string, boolean>;
  }>;
  profileEditedFields?: Record<string, {
    editedAt: string;
    previousValue: string;
    newValue: string;
  }>;
  profileEditHistory?: Array<{
    field: string;
    fieldNameAr: string;
    oldValue: string;
    newValue: string;
    editedAt: string;
  }>;
  isTestAccount?: boolean;
}

export interface RescheduleHistoryEntry {
  oldDate: string;
  newDate: string;
  reason?: string;
  changedBy: string;
  changedAt: any;
}

export interface RescheduleLog {
  id?: string;
  sessionId: string;
  sessionNumber?: number;
  groupId: string;
  groupName?: string;
  oldDate: string;
  newDate: string;
  reason?: string;
  changedBy: string;
  changedAt: any;
  googleSyncStatus: 'synced' | 'failed' | 'pending';
  googleError?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  nameAr: string;
  subject: string;
  bodyHtml: string;
  descriptionAr: string;
  availableVariables: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface DateHistoryEntry {
  oldDate: string;
  newDate: string;
  reason: string;
  changedByUid: string;
  changedByName: string;
  changedAt: any;
}

export interface SessionBreak {
  startTime: string;
  endTime: string;
  duration: number; // minutes
}

export interface SessionPractice {
  description: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
}

export interface SessionSmartEvent {
  eventType: 'start' | 'end' | 'break_start' | 'break_end' | 'practice_start' | 'practice_end';
  timestamp: string;
  text?: string;
}

export interface Session {
  id: string;
  groupId: string;
  sessionNumber: number;
  date: string;
  createdAt: any;
  status: 'upcoming' | 'done';
  requiredTasksCount?: number;
  lectureRecordingUrl?: string;
  tasksMessageUrl?: string;
  lectureTitle?: string;
  isPostponed?: boolean;
  dateChangeReason?: string;
  dateHistory?: DateHistoryEntry[];
  meetingLink?: string;
  isOffline?: boolean;
  googleCalendarEventId?: string;
  googleMeetUrl?: string;
  googleSyncStatus?: 'synced' | 'failed' | 'pending';
  originalDate?: string;
  currentScheduledDate?: string;
  rescheduleHistory?: RescheduleHistoryEntry[];
  startPostponeMinutes?: number;
  startPostponeNewTime?: string;
  generalPostponeActive?: boolean;
  generalPostponeDate?: string;
  
  // New session execution fields
  actualTrainerId?: string;
  actualTrainerName?: string;
  startTimeActual?: string; // HH:MM
  endTimeActual?: string; // HH:MM
  durationActual?: number; // total duration of session in minutes
  approvedHours?: number; // total approved hours (limited by Course maxApprovedHours)
  actualHours?: number; // actual hours taught
  overtimeReason?: string; // justification for hours over standard limit
  breakDuration?: number; // total breaks in minutes
  practicePercentage?: number; // percentage of session spent on hands-on code practice
  sessionNotes?: string;
  breaks?: SessionBreak[];
  practices?: SessionPractice[];
  explainedItems?: string[]; // array of item IDs completed/partially completed in this session
  smartEventsLog?: SessionSmartEvent[];
  smartAssistantState?: 'idle' | 'running' | 'break' | 'practice';
  activeSectionStartTime?: string; // HH:MM:SS format
  activePracticeDesc?: string;

  // Supervisor Audit & Review
  auditStatus?: 'checked' | 'under_review' | 'issue_flagged' | 'unreviewed';
  auditComment?: string;
  auditCheckedByUid?: string;
  auditCheckedByName?: string;
  auditCheckedAt?: string;
  auditHistory?: Array<{
    status: 'checked' | 'under_review' | 'issue_flagged' | 'unreviewed';
    comment?: string;
    checkedByUid: string;
    checkedByName: string;
    checkedAt: string;
  }>;

  // Time Adjustment & Override by Supervisor/Admin/Manager
  timeModifiedByUid?: string;
  timeModifiedByName?: string;
  timeModifiedAt?: string;
  timeModifiedReason?: string;
  originalStartTimeActual?: string;
  originalEndTimeActual?: string;
}

export type ComplaintStatus = 'active' | 'in_progress' | 'resolved';

export interface Complaint {
  id: string;
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  problem: string;
  assignedTo?: string; // userId (optional)
  assignedToName?: string; // (optional)
  status: ComplaintStatus;
  createdBy: string; // userId
  createdByName: string;
  createdAt: any;
  updatedAt: any;
}

export interface FollowUpComment {
  id: string;
  text: string;
  createdByUid: string;
  createdByName: string;
  createdByRole: string;
  createdAt: any;
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string; // hex or tailwind class
  description?: string;
  createdBy: string;
  createdAt: any;
  visibleOnScreen?: boolean;
}

export type FollowUpEventType = 'note' | 'mark_done' | 'schedule_next' | 'mention' | 'reply' | 'escalate' | 'system';

export interface FollowUpUpdate {
  id: string;
  text: string;
  createdByUid: string;
  createdByName: string;
  createdAt: any;
  eventType?: FollowUpEventType;
  replyToUpdateId?: string;
}

export interface FollowUpEscalation {
  status: 'pending' | 'approved' | 'on_hold' | 'resolved';
  proposedAction: string;
  escalatedByUid: string;
  escalatedByName: string;
  escalatedAt: any;
  adminUid?: string;
  adminName?: string;
  adminNote?: string;
  resolvedAt?: any;
  resolvedByUid?: string;
}

export interface FollowUpMention {
  id: string;
  followUpId: string;
  groupId: string;
  studentId: string;
  studentName: string;
  mentionedUserId: string;
  mentionedUserName: string;
  mentionedByUid: string;
  mentionedByName: string;
  createdAt: any;
  sourceUpdateId?: string;
  note?: string;
  status: 'pending' | 'done';
  doneAt?: any;
  doneByUid?: string;
  snoozedUntil?: string | null;
}

export interface FollowUpSuggestionRejection {
  id: string; // `${groupId}_${studentId}_${reason}`
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string;
  reason: 'absence' | 'tasks';
  rejectedByUid: string;
  rejectedByName: string;
  rejectedAt: any;
  rejectionReason: string;
  reappearAt: string; // YYYY-MM-DD — suggestion is suppressed until this date
}

// A suggestion that needs an administrative decision beyond simple
// approve/reject — e.g. the student turns out to have already dropped out,
// so the real decision is whether to remove them from the system entirely.
// This tracks that decision loop; it never performs the action itself.
export interface SuggestionEscalation {
  id: string;
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string;
  reason: 'absence' | 'tasks';
  proposedAction: string;
  escalatedByUid: string;
  escalatedByName: string;
  escalatedAt: any;
  status: 'pending' | 'approved' | 'done';
  adminUid?: string;
  adminName?: string;
  adminRespondedAt?: any;
  adminNote?: string;
  executedByUid?: string;
  executedAt?: any;
}

export interface StudentFollowUp {
  id: string; // groupId_studentId
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  status: 'active' | 'resolved' | 'scheduled';
  colorStatus: 'yellow' | 'red' | 'green' | 'default' | 'purple';
  labels: string[]; // Flexible labels: absence, tasks, distinguished, best_achiever, or custom
  mentionedUserId?: string;
  mentionedUserName?: string;
  scheduledAt?: any; // The date when it should become active again (YYYY-MM-DD)
  supervisorOrder?: {
    orderDate: any;
    deadline: string; // YYYY-MM-DD
    requestedByUid: string;
    requestedByName: string;
    note: string;
  };
  updates: FollowUpUpdate[];
  comments: FollowUpComment[];
  resolvedAt?: any;
  resolvedByUid?: string;
  resolvedByName?: string;
  lastUpdatedAt: any;
  mutedUserIds?: string[];
  pendingNextFollowUpDate?: string | null;
  pendingNextFollowUpNote?: string | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
  attendanceResetSessionNumber?: number | null;
  tasksDone?: number;
  totalTasks?: number;
  attendanceCount?: number;
  totalSessions?: number;
  escalation?: FollowUpEscalation | null;
}

export interface Attendance {
  id: string;
  groupId: string;
  sessionId: string;
  sessionNumber: number;
  date: string;
  presentStudentIds: string[];
  createdAt: any;
  updatedAt: any;
}

export interface LectureEvaluation {
  id: string;
  groupId: string;
  studentId: string;
  sessionNumber: number;
  evaluatorId: string;
  attendance: 0 | 1;
  taskDelivered: number; // Changed from 0|1 to number for multiple tasks
  taskOnTime: 0 | 1;
  taskQuality: 0 | 1;
  taskRedo: 0 | 1;
  bonus: 0 | 1;
  total: number;
  trainerNote?: string;
  taskNote?: string;
  taskNotSubmittedPenalty?: boolean;
  updatedAt: any;
}

export interface StudentWeaknessPoint {
  id: string;
  studentId: string;
  studentName?: string;
  groupId?: string;
  groupName?: string;
  description: string;
  resolved: boolean;
  createdAt: any;
  createdByUid: string;
  createdByName: string;
  resolvedAt?: any;
  resolvedByUid?: string;
  resolvedByName?: string;
  notes?: string;
  sessionNumber?: number;
  visibleToStudent?: boolean;
}

export interface LectureFeedback {
  id: string;
  groupId: string;
  groupName: string;
  courseName: string;
  courseType?: 'online' | 'offline';
  sessionNumber?: number;
  date?: string;
  trainerId?: string;
  trainerName?: string;
  studentId?: string;
  studentName?: string;
  
  isAnonymous?: boolean;
  
  ratingGeneral?: number; // 1-5
  ratingCourse?: number; // 1-5
  ratingTrainerExplanation?: number; // 1-5
  ratingTrainer?: number; // 1-5
  ratingPracticeUseful?: number; // 1-5
  ratingContentSuitable?: number; // 1-5
  ratingContent?: number; // 1-5
  ratingSupportService?: number; // 1-5
  ratingAcademy?: number; // 1-5
  
  // Trainer evaluation
  primaryTrainerName?: string;
  otherTrainerName?: string;
  otherTrainerRating?: number;
  otherTrainerNotes?: string;

  // Sales evaluation
  salesAgentName?: string;
  ratingSales?: number;
  salesNotes?: string;

  comments?: string;
  
  hasComplaint?: boolean;
  complaintText?: string;
  wantsCall?: boolean;
  
  onlineIssueText?: string;
  offlineVenueFeedback?: string;
  
  createdAt: any;
  
  // Follow up info
  complaintStatus?: 'new' | 'in_progress' | 'solved' | 'closed';
  complaintFollowUpNote?: string;
  complaintUpdatedBy?: string;
  complaintUpdatedByName?: string;
  complaintUpdatedAt?: any;
  
  // Global / Monthly Evaluation Fields
  globalEvalId?: string;
  globalEvalTitle?: string;
  isMonthlyGlobal?: boolean;
}

export interface GlobalEvalForm {
  id: string;
  title: string;
  description?: string;
  month?: string; // e.g. "2026-07"
  targetGroups: 'all' | string[];
  targetGroupNames?: string[];
  isActive: boolean;
  createdAt: any;
  createdBy?: string;
  formType?: 'monthly' | 'mid_course' | 'final' | 'general';
}

export interface FinalProject {
  id: string;
  groupId: string;
  studentId: string;
  score: number;
  note: string;
  updatedAt: any;
}

export interface GraduationProjectExtraLink {
  title: string;
  url: string;
}

export interface GraduationProject {
  id: string;
  groupId: string;
  groupName: string;
  courseName?: string;
  title: string;
  brandName: string;
  description: string;
  requirements: string;
  telegramChannelLink: string;
  submissionGuideVideoLink?: string;
  extraLinks?: GraduationProjectExtraLink[];
  startDate: string;
  endDate: string;
  rules: string;
  assignedGroupIds?: string[];
  assignedGroupNames?: string[];
  templateId?: string;
  createdAt: any;
  createdByUid: string;
  createdByName: string;
}

export interface GraduationProjectSubmission {
  id: string;
  projectId: string;
  groupId: string;
  studentId: string;
  studentName: string;
  studentIdNum?: string;
  driveLink: string;
  checkConfirmedOpen: boolean;
  checkUploadedEditableFiles: boolean;
  checkReadRules: boolean;
  extraLinks?: GraduationProjectExtraLink[];
  submittedAt: any;
  updatedAt: any;
  unsubmittedReason?: string;
}

export interface GraduationProjectEvaluation {
  id: string;
  projectId: string;
  groupId: string;
  studentId: string;
  studentName: string;
  c1_submission: number;
  c2_noPixelatedNoSizeErr: number;
  c3_typography: number;
  c4_aiUsage: number;
  c5_reference: number;
  c6_completeFilesOpenLinks: number;
  bonusPoints: number;
  deductionPoints: number;
  deductionReason?: string;
  isExtraWorkshopsEligible: boolean;
  isRejected: boolean;
  rejectionReason?: string;
  totalScore: number;
  evaluatedByUid?: string;
  evaluatedByName?: string;
  updatedAt: any;
}

export interface GraduationProjectComment {
  id: string;
  projectId: string;
  studentId: string;
  groupId: string;
  title: string;
  comment: string;
  designLink?: string;
  createdAt: any;
  createdByUid?: string;
  createdByName?: string;
}

export interface Penalty {
  id: string;
  groupId: string;
  studentId: string;
  points: number;
  reason: string;
  createdAt: any;
}

export interface GroupRanking {
  id: string;
  groupId: string;
  studentId: string;
  lectureTotal: number;
  projectScore: number;
  penaltiesTotal: number;
  finalScore: number;
  updatedAt: any;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  performedByUid: string;
  performedByName: string;
  performedByRole: string;
  timestamp: any;
  details?: any; // Flexible for both string and object
  metadata?: any;
}

export interface Week {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  createdAt: any;
  updatedAt: any;
  archivedAt?: any;
  restoredAt?: any;
  createdByUid: string;
  createdByName: string;
  createdByRole: string;
}

export interface WeekDay {
  id: string;
  weekId: string;
  date: string;
  dayOfWeek: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
  status: 'active' | 'done';
  note?: string;
  updatedAt: any;
}

export interface ScheduleItem {
  id: string;
  scheduleId: string;
  weekId: string;
  date: string;
  trainerId: string;
  trainerName: string;
  weekStartDate: string;
  dayOfWeek: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
  type: "groupSession" | "workshop" | "manual";
  title: string;
  groupId?: string;
  groupName?: string;
  courseName?: string;
  sessionId?: string;
  sessionNumber?: number;
  lectureContent?: string;
  time?: string;
  details?: string;
  status: "upcoming" | "done";
  ops: {
    recordingUploaded: boolean;
    emailsAdded: boolean;
    sentOnTelegram: boolean;
    taskSent: boolean;
    whatsappConfirmationSent: boolean;
  };
  doneAt?: any;
  doneByUid?: string;
  doneByName?: string;
  trainerNote?: string;
  createdAt: any;
  updatedAt: any;
}

export interface DailyTrainerOps {
  id: string;
  trainerId: string;
  weekId?: string;
  date: string;
  preparingLectures: boolean;
  attendingSessions: boolean;
  tasksFollowUp: boolean;
  uploadLectures: boolean;
  studentsQuestions: boolean;
  dailyReport: boolean;
  note?: string;
  updatedAt: any;
  updatedByUid: string;
  updatedByName: string;
}

export interface SessionMeta {
  id: string;
  groupId: string;
  sessionId: string;
  sessionNumber: number;
  lectureNotes?: string;
  taskInstructions?: string; // New field for lecture tasks
  opsChecklist: {
    recordingUploaded: boolean;
    emailsAdded?: boolean;
    telegramSent?: boolean;
    taskSent: boolean;
    whatsappConfirmationSent: boolean;
    tasksEvaluated?: boolean;
  };
  opsChecklistCheckedBy?: Record<string, { byName: string; atTime: string }>;
  lastUpdatedAt: any;
  lastUpdatedByUid: string;
  lastUpdatedByName: string;
  lastUpdatedByRole: string;
  revision: {
    revisioned: boolean;
    revisionedAt?: any;
    revisionedByUid?: string;
    revisionedByName?: string;
    revisionNote?: string;
  };
}

export interface MarketingCategory {
  id: string;
  name: string;
  type: "reviews" | "student_work" | "success_story" | "before_after" | "custom";
  createdBy: string;
  createdAt: any;
}

export interface MarketingSectionTemplate {
  id: "reviews" | "student_work" | "success_story" | "before_after" | "custom";
  link: string;
  updatedAt: any;
  updatedBy: string;
}

export interface MarketingResource {
  id: string;
  title: string;
  description: string;
  resourceType: "reviews" | "student_work" | "success_story" | "before_after" | "custom";
  categoryId: string;
  categoryName: string;
  driveLink: string;
  studentName?: string;
  groupId?: string;
  groupName?: string;
  publishStatus: "not_published" | "published";
  postLink?: string;
  rating: number; // 1-5
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}
