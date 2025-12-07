'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authService } from '@/services/auth';

interface SignOutButtonProps {
  compact?: boolean;
  className?: string;
}

export default function SignOutButton({ compact = false, className }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = () => {
    authService.logout();
    router.push('/login');
  };

  return (
    <button
      onClick={handleSignOut}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        className || "border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700"
      }`}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      {!compact && <span>Sign out</span>}
    </button>
  );
}
