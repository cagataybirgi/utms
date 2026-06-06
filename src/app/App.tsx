import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { RoleSwitchScreen } from './components/RoleSwitchScreen';
import { StudentDashboard } from './components/student/StudentDashboard';
import { OIDBDashboard } from './components/oidb/OIDBDashboard';
import { YDYODashboard } from './components/ydyo/YDYODashboard';
import { YGKDashboard } from './components/ygk/YGKDashboard';
import { DeanDashboard } from './components/dean/DeanDashboard';
import { BoardDashboard } from './components/board/BoardDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Toaster } from './components/ui/sonner';

export type UserRole = 
  | 'Student'
  | 'OIDB'
  | 'YDYO'
  | 'YGK'
  | 'Dean'
  | 'Board'
  | 'Admin';

export interface User {
  id: string;
  tckn: string;
  name: string;
  surname: string;
  roles: UserRole[];
  email: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('selectedRole');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedRole) {
        setSelectedRole(savedRole as UserRole);
      }
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
    
    // If user has only one role, select it automatically
    if (loggedInUser.roles.length === 1) {
      setSelectedRole(loggedInUser.roles[0]);
      localStorage.setItem('selectedRole', loggedInUser.roles[0]);
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    localStorage.setItem('selectedRole', role);
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedRole(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedRole');
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
    localStorage.removeItem('selectedRole');
  };

  // Not logged in. A password-reset link (?token=...) opens the reset screen directly.
  if (!user) {
    const resetToken =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;
    return <LoginScreen onLogin={handleLogin} initialResetToken={resetToken} />;
  }

  // Multiple roles but none selected
  if (user.roles.length > 1 && !selectedRole) {
    return (
      <RoleSwitchScreen
        roles={user.roles}
        onSelectRole={handleRoleSelect}
        onLogout={handleLogout}
      />
    );
  }

  // Render appropriate dashboard based on selected role
  const renderDashboard = () => {
    switch (selectedRole) {
      case 'Student':
        return <StudentDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'OIDB':
        return <OIDBDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'YDYO':
        return <YDYODashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'YGK':
        return <YGKDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'Dean':
        return <DeanDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'Board':
        return <BoardDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      case 'Admin':
        return <AdminDashboard user={user} onLogout={handleLogout} onSwitchRole={user.roles.length > 1 ? handleBackToRoleSelection : undefined} />;
      default:
        return <div>Invalid role</div>;
    }
  };

  return (
    <>
      {renderDashboard()}
      <Toaster />
    </>
  );
}