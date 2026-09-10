'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, ShieldCheck, UserCheck, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UserSession } from '@/types';
import NotificationBell from '@/components/NotificationBell';

interface HeaderNavProps {
  currentPortal: 'home' | 'student' | 'staff' | 'admin';
  userSession?: UserSession | null;
}

export default function HeaderNav({ currentPortal, userSession }: HeaderNavProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {}
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white font-black">
            C
          </div>
          <span>CampusOS <span className="text-sky-600 font-semibold text-sm px-2 py-0.5 rounded bg-sky-50 border border-sky-200 ml-1">AI</span></span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {(!userSession || userSession.role === 'STUDENT' || userSession.role === 'FACULTY') && (
            <Link
              href="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                currentPortal === 'student'
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Student Portal</span>
            </Link>
          )}

          {(!userSession || userSession.role === 'STAFF' || userSession.role === 'DEPARTMENT_ADMIN' || userSession.role === 'UNIVERSITY_ADMIN') && (
            <Link
              href="/staff/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                currentPortal === 'staff'
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Staff Portal</span>
            </Link>
          )}

          {(!userSession || userSession.role === 'DEPARTMENT_ADMIN' || userSession.role === 'UNIVERSITY_ADMIN') && (
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                currentPortal === 'admin'
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Portal</span>
            </Link>
          )}

          {userSession ? (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
              <NotificationBell />
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 line-clamp-1">{userSession.name}</span>
                <span className="text-[10px] uppercase font-bold text-sky-700">{userSession.role}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Log Out"
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
