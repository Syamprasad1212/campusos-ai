import HeaderNav from '@/components/ui/navigation';
import { getCurrentAppUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect('/login');
  }

  // Server-side Role Guard: Only STUDENT and FACULTY can access Student Portal
  if (user.role === 'STAFF') {
    redirect('/staff/dashboard');
  }
  if (user.role === 'DEPARTMENT_ADMIN' || user.role === 'UNIVERSITY_ADMIN') {
    redirect('/admin/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <HeaderNav currentPortal="student" userSession={user} />
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
