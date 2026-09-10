import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { UserSession, UserRole } from '@/types';

/**
 * Authoritative Server-Side Auth Session Resolver
 * 
 * SECURITY RULES ENFORCED:
 * 1. Identity is derived strictly from the authenticated Supabase Auth session.
 * 2. No arbitrary dev headers, client-provided user IDs, or fake session fallbacks.
 * 3. Application roles & departments are fetched directly from Prisma/PostgreSQL.
 */
export async function getCurrentAppUser(): Promise<UserSession | null> {
  try {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser || !authUser.email) {
      return null;
    }

    // Map authenticated Supabase Auth UUID to application Prisma User
    let prismaUser = await db.user.findFirst({
      where: {
        OR: [
          { supabaseAuthId: authUser.id },
          { email: authUser.email },
        ],
      },
      include: { department: true },
    });

    if (prismaUser) {
      // Safely link real Supabase Auth UUID if not linked yet
      if (!prismaUser.supabaseAuthId) {
        prismaUser = await db.user.update({
          where: { id: prismaUser.id },
          data: { supabaseAuthId: authUser.id },
          include: { department: true },
        });
      }

      return {
        id: prismaUser.id,
        name: prismaUser.name,
        email: prismaUser.email,
        role: prismaUser.role as UserRole,
        departmentId: prismaUser.departmentId,
        departmentCode: prismaUser.department?.code,
      };
    }
  } catch (err) {
    // If unauthenticated or DB error, return null
  }

  return null;
}
