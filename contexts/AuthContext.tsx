'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Profile, Role } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  loginAsMock: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define some mock profiles for testing
const MOCK_PROFILES: Record<Role, Profile> = {
  business: {
    id: 'mock-business-id',
    full_name: 'Business Manager',
    role: 'business',
    position_id: null,
    created_at: new Date().toISOString(),
  },
  employee: {
    id: 'mock-employee-id',
    full_name: 'Jane Doe',
    role: 'employee',
    position_id: 'mock-position-1',
    created_at: new Date().toISOString(),
  },
  individual: {
    id: 'mock-individual-id',
    full_name: 'John Smith',
    role: 'individual',
    position_id: null,
    created_at: new Date().toISOString(),
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there's a real Supabase session, or fallback to saved mock user
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Fetch real profile from DB
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) setUser(data as Profile);
      } else {
        // Check for local storage mock user
        const savedMock = localStorage.getItem('mock_user_role') as Role;
        if (savedMock && MOCK_PROFILES[savedMock]) {
          setUser(MOCK_PROFILES[savedMock]);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const loginAsMock = (role: Role) => {
    setUser(MOCK_PROFILES[role]);
    localStorage.setItem('mock_user_role', role);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('mock_user_role');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAsMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
