'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatbotExperience from '@/components/ChatbotExperience';
import { adminAuth } from '@/services/admin';

export default function AdminChatbotPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!adminAuth.isAuthenticated()) {
      router.replace('/admin-login');
      return;
    }
    adminAuth.ensureChatSession();
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return <ChatbotExperience preferChatView mode="admin" />;
}

