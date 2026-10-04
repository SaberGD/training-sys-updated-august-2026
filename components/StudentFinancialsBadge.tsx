import React, { useEffect, useMemo, useState } from 'react';
import * as firestore from 'firebase/firestore';
import { subscribeToCollection } from '../services/firestore';
import { useSensitiveData } from '../contexts/SensitiveDataContext';

const { where } = firestore as any;

/** Booking price / paid amount synced from accounting (studentFinancials/{studentId}). */
export interface StudentFinancials {
  totalPrice: number;
  paidTotal: number;
  remaining: number;
  paidPercentage: number | null;
  bookingStatus?: string;
}

const FINANCIALS_ROLES = ['admin', 'coordinator', 'team_leader', 'supervisor'];

/**
 * Loads accounting amounts for the given students. Management only, and only
 * while "show sensitive data" is on; otherwise nothing is read.
 */
export function useStudentFinancials(studentIds: string[], userRole: string | undefined) {
  const { showSensitiveData } = useSensitiveData();
  const enabled = showSensitiveData && FINANCIALS_ROLES.includes(userRole || '');
  const [financials, setFinancials] = useState<Record<string, StudentFinancials>>({});
  const idsKey = useMemo(() => [...studentIds].sort().join(','), [studentIds]);

  useEffect(() => {
    if (!enabled || !idsKey) {
      setFinancials({});
      return;
    }
    const ids = idsKey.split(',');
    const unsubs: (() => void)[] = [];
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      unsubs.push(subscribeToCollection<StudentFinancials & { id: string }>('studentFinancials', (data) => {
        setFinancials(prev => {
          const next = { ...prev };
          chunk.forEach(id => { delete next[id]; });
          data.forEach(f => { next[f.id] = f; });
          return next;
        });
      }, [where(firestore.documentId(), 'in', chunk)]));
    }
    return () => unsubs.forEach(u => u());
  }, [enabled, idsKey]);

  return { enabled, financials };
}

export const StudentFinancialsBadge: React.FC<{ financials?: StudentFinancials }> = ({ financials: f }) => {
  if (!f) {
    return (
      <span className="mt-1 text-[9px] text-slate-400 font-arabic" dir="rtl">💰 لا توجد بيانات مالية من الحسابات</span>
    );
  }
  const fmt = (n: number) => (n || 0).toLocaleString('en-US');
  const pct = f.paidPercentage ?? (f.totalPrice > 0 ? Math.round((f.paidTotal / f.totalPrice) * 100) : 100);
  const below50 = pct < 50;
  return (
    <div
      className={`mt-1 inline-flex items-center gap-1.5 flex-wrap px-2 py-0.5 rounded-lg border text-[10px] font-black font-arabic w-fit ${below50 ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'}`}
      dir="rtl"
      title="بيانات حساسة من نظام الحسابات"
    >
      <span>💰 حاجز بـ {fmt(f.totalPrice)} ج.م</span>
      <span className="opacity-50">•</span>
      <span>دفع {fmt(f.paidTotal)} ({pct}%)</span>
      {f.remaining > 0 && (
        <>
          <span className="opacity-50">•</span>
          <span>متبقي {fmt(f.remaining)}</span>
        </>
      )}
    </div>
  );
};
