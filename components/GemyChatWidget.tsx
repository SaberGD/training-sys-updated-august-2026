import React from 'react';
import { Student, Group, Session, LectureEvaluation, Penalty, GroupRanking, User } from '../types';

export interface GemyChatWidgetProps {
  currentStudent?: Student | null;
  studentGroup?: Group | null;
  staffUser?: User | null;
  sessions?: Session[];
  evaluations?: LectureEvaluation[];
  penalties?: Penalty[];
  rankings?: GroupRanking[];
  isOpen?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}

export const extractSmartName = (rawName: string = '', isStaff: boolean = false): {
  cleanFirstName: string;
  cleanFullName: string;
  honorificTitle: string;
  greetingName: string;
} => {
  if (!rawName) return { cleanFirstName: '', cleanFullName: '', honorificTitle: isStaff ? 'باشمهندس' : '', greetingName: isStaff ? 'باشمهندس' : '' };

  let trimmed = rawName.trim();
  let honorificTitle = isStaff ? 'باشمهندس' : '';

  const engPattern = /^(eng\.?|engineer|م\.?|م\/|باشمهندس|مهندس|المهندس)\s+/i;
  const docPattern = /^(dr\.?|doctor|د\.?|د\/|دكتور|الدكتور)\s+/i;
  const mrPattern = /^(mr\.?|mrs\.?|ms\.?|أ\.?|أ\/|استاذ|الأستاذ|الاستاذ)\s+/i;
  const profPattern = /^(prof\.?|professor|بروف|بروفيسور)\s+/i;

  if (engPattern.test(trimmed)) {
    honorificTitle = 'باشمهندس';
    trimmed = trimmed.replace(engPattern, '').trim();
  } else if (docPattern.test(trimmed)) {
    honorificTitle = 'د.';
    trimmed = trimmed.replace(docPattern, '').trim();
  } else if (mrPattern.test(trimmed)) {
    honorificTitle = 'أ.';
    trimmed = trimmed.replace(mrPattern, '').trim();
  } else if (profPattern.test(trimmed)) {
    honorificTitle = 'بروفيسور';
    trimmed = trimmed.replace(profPattern, '').trim();
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const cleanFirstName = parts[0] || trimmed;
  const cleanFullName = trimmed;
  const greetingName = honorificTitle ? `${honorificTitle} ${cleanFirstName}` : cleanFirstName;

  return { cleanFirstName, cleanFullName, honorificTitle, greetingName };
};

export const GemyChatWidget: React.FC<GemyChatWidgetProps> = () => {
  return null;
};

export default GemyChatWidget;
