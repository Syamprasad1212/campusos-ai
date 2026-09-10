'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDefaultDashboardRoute, canAccessPortalRoute } from '@/lib/permissions';
import { AlertCircle, Lock, Mail } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirectTo');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });

        if (signUpError) throw new Error(signUpError.message);

        setMessage('Account created! Please check your email for confirmation or sign in.');
        setIsSignUp(false);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw new Error(signInError.message);

        // Fetch authoritative application user session to determine role-based landing
        let destination = '/dashboard';
        try {
          const res = await fetch('/api/auth/me');
          const json = await res.json();
          if (json.success && json.data?.role) {
            const userRole = json.data.role;
            const defaultLanding = getDefaultDashboardRoute(userRole);

            if (requestedRedirect && canAccessPortalRoute(userRole, requestedRedirect)) {
              destination = requestedRedirect;
            } else {
              destination = defaultLanding;
            }
          }
        } catch (e) {
          // Fallback to default
        }

        router.push(destination);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-slate-200">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isSignUp && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Full Name</label>
            <div className="mt-1">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Johnson"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Email Address</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@campus.edu"
              className="w-full rounded-lg border border-slate-300 pl-10 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 pl-10 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition"
        >
          {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-600">
        {isSignUp ? (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className="font-semibold text-sky-600 hover:text-sky-800"
            >
              Sign In
            </button>
          </p>
        ) : (
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className="font-semibold text-sky-600 hover:text-sky-800"
            >
              Register Account
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-2xl text-slate-900 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white font-black">
            C
          </div>
          <span>CampusOS <span className="text-sky-600 font-semibold text-sm px-2 py-0.5 rounded bg-sky-50 border border-sky-200 ml-1">AI</span></span>
        </Link>

        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Automated Campus Workflows & Governance
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="bg-white py-8 px-4 shadow sm:rounded-2xl border border-slate-200 text-center text-sm text-slate-500">Loading form...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
