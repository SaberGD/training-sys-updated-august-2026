
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RolePermissions, UserRole } from '../types';
import { subscribeToCollection, saveRolePermissions } from '../services/firestore';
import { db } from '../firebase';
import * as firestore from 'firebase/firestore';

interface PermissionsContextType {
  rolePermissions: Record<UserRole, RolePermissions['permissions'] | null>;
  hasPermission: (user: User | null, permission: keyof RolePermissions['permissions']) => boolean;
  updatePermissions: (role: UserRole, permissions: RolePermissions['permissions']) => Promise<void>;
  hiddenPages: string[];
  updatePageVisibility: (hiddenPages: string[]) => Promise<void>;
  isPageHidden: (path: string) => boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions['permissions']> = {
  admin: {
    viewDashboard: true, viewUsers: true, viewCourses: true, viewGroups: true, viewStudents: true,
    viewMarketing: true, viewWeeklySchedule: true, viewExports: true, viewActivityLog: true,
    viewTasks: true, createTasks: true, manageTemplates: true, viewAllReports: true,
    submitDailyReport: true, manageGroups: true, manageCourses: true, manageStudents: true,
    manageUsers: true, viewRanking: true, manageEvaluations: true,
    viewPerformanceReports: true, submitPerformanceReport: true, approvePerformanceReport: true
  },
  coordinator: {
    viewDashboard: true, viewUsers: false, viewCourses: true, viewGroups: true, viewStudents: true,
    viewMarketing: true, viewWeeklySchedule: true, viewExports: true, viewActivityLog: true,
    viewTasks: true, createTasks: true, manageTemplates: true, viewAllReports: true,
    submitDailyReport: true, manageGroups: true, manageCourses: true, manageStudents: true,
    manageUsers: false, viewRanking: true, manageEvaluations: true,
    viewPerformanceReports: true, submitPerformanceReport: true, approvePerformanceReport: true
  },
  team_leader: {
    viewDashboard: true, viewUsers: false, viewCourses: true, viewGroups: true, viewStudents: true,
    viewMarketing: true, viewWeeklySchedule: true, viewExports: false, viewActivityLog: false,
    viewTasks: true, createTasks: false, manageTemplates: false, viewAllReports: false,
    submitDailyReport: true, manageGroups: false, manageCourses: false, manageStudents: false,
    manageUsers: false, viewRanking: true, manageEvaluations: true,
    viewPerformanceReports: true, submitPerformanceReport: true, approvePerformanceReport: false
  },
  trainer: {
    viewDashboard: true, viewUsers: false, viewCourses: true, viewGroups: true, viewStudents: true,
    viewMarketing: true, viewWeeklySchedule: true, viewExports: false, viewActivityLog: false,
    viewTasks: true, createTasks: false, manageTemplates: false, viewAllReports: false,
    submitDailyReport: true, manageGroups: false, manageCourses: false, manageStudents: false,
    manageUsers: false, viewRanking: true, manageEvaluations: true,
    viewPerformanceReports: true, submitPerformanceReport: true, approvePerformanceReport: false
  }
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode; user: User | null }> = ({ children, user }) => {
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, RolePermissions['permissions'] | null>>({
    admin: null, coordinator: null, team_leader: null, trainer: null
  });
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToCollection<RolePermissions>('rolePermissions', (data) => {
      const permsMap: any = { ...rolePermissions };
      data.forEach(item => {
        permsMap[item.role] = item.permissions;
      });
      
      // If a role is missing from DB, use default
      (Object.keys(DEFAULT_PERMISSIONS) as UserRole[]).forEach(role => {
        if (!permsMap[role]) {
          permsMap[role] = DEFAULT_PERMISSIONS[role];
        }
      });

      setRolePermissions(permsMap);
    });

    const unsubscribeVisibility = subscribeToCollection<any>('settings', (data) => {
      const visDoc = data.find(item => item.id === 'pagesVisibility');
      if (visDoc) {
        setHiddenPages(visDoc.hiddenPages || []);
      } else {
        setHiddenPages([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeVisibility();
    };
  }, []);

  const hasPermission = (u: User | null, permission: keyof RolePermissions['permissions']): boolean => {
    if (!u) return false;
    if (u.role === 'admin') return true; // Admin always has all permissions
    const perms = rolePermissions[u.role];
    if (!perms) return DEFAULT_PERMISSIONS[u.role][permission];
    return perms[permission] || false;
  };

  const updatePermissions = async (role: UserRole, permissions: RolePermissions['permissions']) => {
    if (!user || user.role !== 'admin') return;
    await saveRolePermissions(role, permissions, user);
  };

  const updatePageVisibility = async (newHiddenPages: string[]) => {
    if (!user || user.role !== 'admin') return;
    try {
      const { doc, setDoc } = firestore as any;
      await setDoc(doc(db, 'settings', 'pagesVisibility'), {
        hiddenPages: newHiddenPages,
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error updating page visibility:", err);
    }
  };

  const isPageHidden = (path: string): boolean => {
    return hiddenPages.includes(path);
  };

  return (
    <PermissionsContext.Provider value={{ 
      rolePermissions, 
      hasPermission, 
      updatePermissions, 
      hiddenPages, 
      updatePageVisibility, 
      isPageHidden, 
      loading 
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
