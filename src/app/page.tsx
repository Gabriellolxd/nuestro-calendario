// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { onboardingCompletado } from '../lib/onboarding';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/calendario');
        return;
      }
      if (!onboardingCompletado()) {
        router.push('/onboarding');
        return;
      }
      router.push('/login');
    }
    checkSession();
  }, [router]);

  return <p className="p-8 text-center text-gray-400">Cargando...</p>;
}