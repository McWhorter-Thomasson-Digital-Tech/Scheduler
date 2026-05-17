'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/types/database';
import { useRouter } from 'next/navigation';
import styles from '@/styles/glassmorphism.module.css';

export default function LoginPage() {
  const { loginAsMock } = useAuth();
  const router = useRouter();

  const handleMockLogin = (role: Role) => {
    loginAsMock(role);
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`${styles.glassCard} max-w-md w-full p-8`}>
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In to Scheduler</h1>
        
        <div className="space-y-4 mb-8">
          <input 
            type="email" 
            placeholder="Email (Supabase Auth disabled for now)" 
            disabled
            className={`${styles.glassInput} opacity-50 cursor-not-allowed`}
          />
          <input 
            type="password" 
            placeholder="Password" 
            disabled
            className={`${styles.glassInput} opacity-50 cursor-not-allowed`}
          />
          <button disabled className={`${styles.glassButton} w-full opacity-50 cursor-not-allowed`}>
            Sign In with Email
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--glass-border)]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
              Or bypass for development
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => handleMockLogin('business')}
            className={`${styles.glassButton} ${styles.glassButtonPrimary} w-full justify-between`}
          >
            <span>Login as Business Manager</span>
            <span className="text-xs opacity-75">Full Access</span>
          </button>
          
          <button 
            onClick={() => handleMockLogin('employee')}
            className={`${styles.glassButton} w-full justify-between`}
          >
            <span>Login as Employee</span>
            <span className="text-xs opacity-75">Time Tracking</span>
          </button>
          
          <button 
            onClick={() => handleMockLogin('individual')}
            className={`${styles.glassButton} w-full justify-between`}
          >
            <span>Login as Individual</span>
            <span className="text-xs opacity-75">Personal Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
}
