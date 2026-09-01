// src/lib/adminMode.ts
// Bandera puramente en memoria (nunca en localStorage) — se resetea sola
// al cerrar la pestaña/app, tal como se pidió.
const CONTRASENA_ADMIN = 'panchito';
let eliminacionAjenaActiva = false;

export function intentarActivarEliminacionAjena(contrasena: string): boolean {
  if (contrasena !== CONTRASENA_ADMIN) return false;
  eliminacionAjenaActiva = true;
  return true;
}

export function desactivarEliminacionAjena() {
  eliminacionAjenaActiva = false;
}

export function eliminacionAjenaEstaActiva(): boolean {
  return eliminacionAjenaActiva;
}