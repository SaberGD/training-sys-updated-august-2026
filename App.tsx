
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getOrCreateUser, runScheduleWeekMigration } from './services/firestore';
import { User, UserRole } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetails from './pages/GroupDetails';
import Users from './pages/Users';
import Courses from './pages/Courses';
import Students from './pages/Students';
import ActivityLogPage from './pages/ActivityLog';
import WeeksPage from './pages/Weeks';
import WeeklySchedulePage from './pages/WeeklySchedule';
import Exports from './pages/Exports';
import MarketingResourcesPage from './pages/MarketingResources';
import TasksPage from './pages/Tasks';
import PermissionsPage from './pages/Permissions';
import GoogleIntegrations from './pages/GoogleIntegrations';
import TrainerGoogleConnect from './pages/TrainerGoogleConnect';
import PerformanceReports from './pages/PerformanceReports';
import Complaints from './pages/Complaints';
import TrainerKPIs from './pages/TrainerKPIs';
import FollowUpsPage from './pages/FollowUps';
import LabelsPage from './pages/Labels';
import LandingPage from './pages/LandingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import StudentPortal from './pages/StudentPortal';
import StudentDirectory from './pages/StudentDirectory';
import GraduationProjectsPage from './pages/GraduationProjects';
import { PermissionsProvider } from './contexts/PermissionsContext';

export const ViewAsContext = React.createContext<{
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  actualRole: UserRole | null;
}>({ viewAsRole: null, setViewAsRole: () => {}, actualRole: null });

const App: React.FC = () => {
  const [actualUser, setActualUser] = useState<User | null>(null);
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const u = await getOrCreateUser(fbUser.uid, fbUser.email!, fbUser.displayName || fbUser.email!.split('@')[0]);
          if (u.disabled) {
            await auth.signOut();
            setError("Your account is disabled. Contact admin.");
            setActualUser(null);
          } else {
            setActualUser(u);
            setError(null);
            runScheduleWeekMigration(u).catch(console.error);
          }
        } else {
          setActualUser(null);
        }
      } catch (err: any) {
        setError(`Failed to bootstrap app: ${err.message}`);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const user = actualUser ? (viewAsRole ? { ...actualUser, role: viewAsRole } : actualUser) : null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ViewAsContext.Provider value={{ viewAsRole, setViewAsRole, actualRole: actualUser?.role || null }}>
          <PermissionsProvider user={user}>
            <Router>
              <Routes>
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/student/portal" element={<StudentPortal />} />
                <Route path="/student-portal" element={<StudentPortal />} />
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                <Route path="/" element={user ? <Dashboard user={user} /> : <LandingPage />} />
                <Route path="/*" element={
                  user ? (
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard user={user} />} />
                      <Route path="/groups" element={<Groups user={user} />} />
                      <Route path="/groups/:id" element={<GroupDetails user={user} />} />
                      <Route path="/graduation-projects" element={<GraduationProjectsPage user={user} />} />
                      <Route path="/my-groups" element={<Groups user={user} isTrainerOnly />} />
                      <Route path="/tasks" element={<TasksPage user={user} />} />
                      <Route path="/marketing" element={<MarketingResourcesPage user={user} />} />
                      <Route path="/weekly-schedule" element={<WeeksPage user={user} />} />
                      <Route path="/weekly-schedule/:weekId" element={<WeeklySchedulePage user={user} />} />
                      <Route path="/users" element={user.role === 'admin' ? <Users user={user} /> : <Navigate to="/" />} />
                      <Route path="/permissions" element={user.role === 'admin' ? <PermissionsPage user={user} /> : <Navigate to="/" />} />
                      <Route path="/google-integrations" element={user.role === 'admin' ? <GoogleIntegrations user={user} /> : <Navigate to="/" />} />
                      <Route path="/trainer/google-connect" element={<TrainerGoogleConnect user={user} />} />
                      <Route path="/performance-reports" element={<PerformanceReports user={user} />} />
                      <Route path="/trainer-kpis" element={<TrainerKPIs user={user} />} />
                      <Route path="/complaints" element={<Complaints user={user} />} />
                      <Route path="/follow-ups" element={<FollowUpsPage user={user} />} />
                      <Route path="/labels" element={<LabelsPage user={user} />} />
                      <Route path="/courses" element={<Courses user={user} />} />
                      <Route path="/students" element={<Students user={user} />} />
                      <Route path="/student-directory" element={<StudentDirectory user={user} />} />
                      <Route path="/exports" element={['admin', 'coordinator', 'team_leader'].includes(user.role) ? <Exports user={user} /> : <Navigate to="/" />} />
                      <Route path="/activity-log" element={['admin', 'coordinator', 'team_leader'].includes(user.role) ? <ActivityLogPage user={user} /> : <Navigate to="/" />} />
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  ) : <Navigate to="/login" />
                } />
              </Routes>
            </Router>
          </PermissionsProvider>
        </ViewAsContext.Provider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
