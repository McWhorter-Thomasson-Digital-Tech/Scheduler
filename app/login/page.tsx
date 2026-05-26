'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import styles from '@/styles/glassmorphism.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (signUpError) throw signUpError;
        setError('Check your email for the confirmation link. You may need to confirm before signing in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        await refreshSession();
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`${styles.glassCard} max-w-md w-full p-8`}>
        <div className="flex justify-center mb-4">
          <img src="/ChronoDo%20Logo%20Clear.png" alt="ChronoDo Logo" className="w-16 h-16 object-contain drop-shadow-[0_4px_12px_rgba(59,130,246,0.3)]" />
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isSignUp ? 'Create an Account' : 'Sign In to ChronoDo'}
        </h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isSignUp && (
            <input
              type="text"
              placeholder="User Name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.glassInput}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.glassInput}
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.glassInput}
          />
          <button
            type="submit"
            disabled={loading}
            className={`${styles.glassButton} ${styles.glassButtonPrimary} w-full`}
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-sm text-[var(--text-secondary)]">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
