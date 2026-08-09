// src/lib/onboarding.ts
const KEY = 'nc_onboarding_completado';

export function onboardingCompletado(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY) === '1';
}

export function marcarOnboardingCompletado() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, '1');
}