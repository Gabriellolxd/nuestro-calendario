// src/lib/syncErrorStore.ts
// Almacén simple del último error de sincronización, para poder
// mostrarlo en la UI (mantener presionado el ícono de nube) sin tener
// que ir a la consola del navegador cada vez.
type Listener = (mensaje: string | null) => void;

let ultimoError: string | null = null;
const listeners = new Set<Listener>();

export function registrarErrorSync(mensaje: string) {
  ultimoError = mensaje;
  listeners.forEach((l) => l(mensaje));
}

export function limpiarErrorSync() {
  ultimoError = null;
  listeners.forEach((l) => l(null));
}

export function obtenerUltimoErrorSync(): string | null {
  return ultimoError;
}

export function suscribirseAErrorSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}