/**
 * Student portal login through the `studentPortal` Cloud Function, so the
 * browser never downloads other students' records or passwords.
 *
 * The portal signs in to its own named Firebase app ("student-portal"), so a
 * student session never replaces a staff session open in the same browser.
 */
import * as firebaseApp from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { firebaseConfig } from '../firebase';

const STUDENT_PORTAL_URL = 'https://us-central1-sg-tms-v2.cloudfunctions.net/studentPortal';

const portalApp = (firebaseApp as any).getApps().find((a: any) => a.name === 'student-portal')
  || (firebaseApp as any).initializeApp(firebaseConfig, 'student-portal');
export const portalAuth = getAuth(portalApp);

const LOGIN_ERRORS: Record<string, string> = {
  email_used_instead_of_id: 'تنبيه: لقد قمت بكتابة بريد إلكتروني! تسجيل الدخول في البورتال يتطلب كتابة الرقم التعريفي (Student ID المكون من 6 أرقام) المستلم في إيميل الترحيب وليس الإيميل.',
  unknown_student: 'الرقم التعريفي (Student ID) أو رقم الموبايل غير مطابق لأي طالب مسجل. يرجى التأكد من كتابة كود الـ ID الخاص بك.',
  wrong_password: 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.',
  invalid_credentials: 'الرقم التعريفي أو كلمة المرور غير صحيحة.',
  too_many_attempts: 'محاولات دخول كثيرة خاطئة. يرجى الانتظار 15 دقيقة ثم المحاولة مرة أخرى.',
};

async function callPortal(payload: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(STUDENT_PORTAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('تعذر الاتصال بالخادم. تأكد من اتصال الإنترنت وحاول مرة أخرى.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(LOGIN_ERRORS[data.error] || 'حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى.');
  }
  return data;
}

export interface PortalLoginResult<T> {
  primaryId: string;
  records: T[];
}

export async function portalLogin<T = any>(loginId: string, password: string, exact = false): Promise<PortalLoginResult<T>> {
  const data = await callPortal({ action: 'login', loginId, password, exact });
  if (data.token) {
    // Used by the stricter Firestore rules of the next phase; never blocks login.
    signInWithCustomToken(portalAuth, data.token).catch(err => console.warn('Portal token sign-in failed:', err));
  }
  return { primaryId: data.primaryId, records: data.records || [] };
}

export async function portalRoster(groupId: string): Promise<{ id: string; name: string }[]> {
  const data = await callPortal({ action: 'roster', groupId });
  return data.students || [];
}

export function portalLogout() {
  signOut(portalAuth).catch(() => {});
}
