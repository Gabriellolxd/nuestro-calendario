// src/lib/notificationPrefs.ts
// Preferencia de silencio por calendario — es local al dispositivo (cada
// persona puede querer avisos distintos en su propio teléfono).
const KEY = 'nc_calendarios_silenciados';

export function obtenerCalendariosSilenciados(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function estaSilenciado(ownerId: string): boolean {
  return obtenerCalendariosSilenciados().includes(ownerId);
}

export function alternarSilencio(ownerId: string): string[] {
  const actuales = obtenerCalendariosSilenciados();
  const nuevos = actuales.includes(ownerId)
    ? actuales.filter((id) => id !== ownerId)
    : [...actuales, ownerId];
  localStorage.setItem(KEY, JSON.stringify(nuevos));
  return nuevos;
}