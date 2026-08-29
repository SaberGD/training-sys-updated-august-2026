import { Group, Student, Session, LectureEvaluation, StudentFollowUp, FollowUpSuggestionRejection } from '../types';

export interface FollowUpSuggestion {
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string;
  reason: 'absence' | 'tasks';
  rate: number;
}

/**
 * Live, unsaved computation of who the system would suggest for follow-up —
 * nothing here is written to Firestore. Thresholds mirror the previous
 * automatic-transfer logic (GroupDetails.tsx's per-group sync effect) exactly,
 * just generalized to run across every group at once for the supervisor's
 * suggestions tab. A supervisor must explicitly approve a suggestion
 * (approveFollowUpSuggestion in services/firestore.ts) before it becomes a
 * real, tracked follow-up.
 */
export const computeFollowUpSuggestions = (
  groups: Group[],
  students: Student[],
  sessions: Session[],
  evaluations: LectureEvaluation[],
  existingFollowUps: StudentFollowUp[],
  rejections: FollowUpSuggestionRejection[] = []
): FollowUpSuggestion[] => {
  const suggestions: FollowUpSuggestion[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const isCoolingDown = (groupId: string, studentId: string, reason: 'absence' | 'tasks') => {
    const rejection = rejections.find(r => r.groupId === groupId && r.studentId === studentId && r.reason === reason);
    return !!rejection && rejection.reappearAt > todayStr;
  };

  for (const group of groups) {
    if (group.archived) continue;

    const groupSessionsDone = sessions.filter(s => s.groupId === group.id && s.status === 'done');
    const totalSessionsDoneOverall = groupSessionsDone.length;
    if (totalSessionsDoneOverall === 0) continue;

    const groupStudents = students.filter(s => s.groupId === group.id && !s.deactivated);

    for (const student of groupStudents) {
      const studentEvals = evaluations.filter(e => e.studentId === student.id && e.groupId === group.id);
      const existingFollowUp = existingFollowUps.find(f => f.studentId === student.id && f.groupId === group.id);
      const resetSessionNum = existingFollowUp?.attendanceResetSessionNumber || 0;
      const existingLabels = (existingFollowUp?.status === 'active' && existingFollowUp.labels) || [];

      // Tasks
      const totalRequired = groupSessionsDone.reduce((sum, s) => sum + (s.requiredTasksCount || 0), 0);
      const totalCompleted = studentEvals.reduce((sum, e) => sum + (e.taskDelivered || 0), 0);
      const completionRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100;

      if (totalSessionsDoneOverall >= 3 && completionRate < 70 && !existingLabels.includes('tasks') && !isCoolingDown(group.id, student.id, 'tasks')) {
        suggestions.push({
          groupId: group.id,
          groupName: group.name,
          studentId: student.id,
          studentName: student.name,
          reason: 'tasks',
          rate: completionRate
        });
      }

      // Attendance
      const sessionsAfterReset = groupSessionsDone.filter(s => s.sessionNumber > resetSessionNum);
      const sessionsDoneCountAfterReset = sessionsAfterReset.length;
      const uniqueAttendedAfterReset = new Set(
        studentEvals.filter(e => e.attendance === 1 && e.sessionNumber > resetSessionNum).map(e => e.sessionNumber)
      );
      const totalAttended = Math.min(uniqueAttendedAfterReset.size, sessionsDoneCountAfterReset);
      const attendanceRate = sessionsDoneCountAfterReset > 0
        ? Math.min(100, Math.round((totalAttended / sessionsDoneCountAfterReset) * 100))
        : 100;

      const attendanceEligible =
        sessionsDoneCountAfterReset >= 2 ||
        (resetSessionNum === 0 && totalSessionsDoneOverall >= 3);

      if (attendanceEligible && attendanceRate < 70 && !existingLabels.includes('absence') && !isCoolingDown(group.id, student.id, 'absence')) {
        suggestions.push({
          groupId: group.id,
          groupName: group.name,
          studentId: student.id,
          studentName: student.name,
          reason: 'absence',
          rate: attendanceRate
        });
      }
    }
  }

  return suggestions;
};
