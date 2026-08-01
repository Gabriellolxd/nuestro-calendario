// src/lib/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays } from 'date-fns';
import { ahoraEcuador, format } from './dates';
import { proyectarEventos, type EventoBase, type Excepcion } from './recurrence';
import { obtenerCalendariosSilenciados } from './notificationPrefs';
import { obtenerEventosYExcepcionesRemoto } from './notificationsRemoto';

function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

function hashANumero(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647;
}

function idParaOcurrencia(eventoId: string, fechaStr: string): number {
  return hashANumero(`oc-${eventoId}-${fechaStr}`);
}

const CHANNEL_ID = 'eventos-nuestro-calendario-v2';
const NOMBRE_ARCHIVO_SONIDO = 'notificacion_evento.wav';
const VENTANA_DIAS = 60; // hasta cuántos días adelante se programan notificaciones

export async function solicitarPermisoNotificaciones() {
  if (!esNativo()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Eventos del calendario',
      description: 'Avisos de eventos de nuestro-calendario',
      importance: 5,
      sound: NOMBRE_ARCHIVO_SONIDO,
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.error('Error solicitando permiso / creando canal:', err);
  }
}

type NotifProgramada = {
  id: number;
  title: string;
  body: string;
  channelId: string;
  smallIcon: string;
  schedule: { at: Date; allowWhileIdle: boolean };
};

type DatosCalendario = { ownerId: string; eventos: EventoBase[]; excepciones: Excepcion[] };

// Motor principal: recalcula TODAS las notificaciones necesarias a partir de
// cero. Usa proyectarEventos — la MISMA función que dibuja el calendario —
// como única fuente de verdad: si un evento fue eliminado o un día fue
// excepcionado/cancelado, simplemente no aparece en la proyección, y por
// lo tanto tampoco se reprograma. Cualquier notificación que el sistema ya
// tenía programada y que no aparece en la nueva lista válida se cancela
// aquí mismo — así un evento borrado en OTRO dispositivo deja de sonar en
// este apenas se sincroniza.
export async function reprogramarNotificacionesCalendarios(calendarios: DatosCalendario[]) {
  if (!esNativo()) return;

  const ahora = ahoraEcuador();
  const limite = addDays(ahora, VENTANA_DIAS);
  const idsValidos = new Set<number>();
  const aProgramar: NotifProgramada[] = [];

  for (const cal of calendarios) {
    const ocurrencias = proyectarEventos(cal.eventos, cal.excepciones, ahora, limite);
    const minutosAvisoPorId = new Map(cal.eventos.map((e) => [e.id, e.minutos_aviso]));

    for (const oc of ocurrencias) {
      const minutosAviso = minutosAvisoPorId.get(oc.eventoId) ?? 5;
      const disparo = new Date(oc.hora_inicio.getTime() - minutosAviso * 60000);
      if (disparo.getTime() <= Date.now()) continue; // ya pasó, no tiene sentido programarla

      const fechaStr = format(oc.fecha, 'yyyy-MM-dd');
      const id = idParaOcurrencia(oc.eventoId, fechaStr);
      idsValidos.add(id);

      aProgramar.push({
        id,
        title: oc.titulo,
        body: 'Toca para ver el detalle en nuestro-calendario',
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_name',
        schedule: { at: disparo, allowWhileIdle: true },
      });
    }
  }

  try {
    const pendientes = await LocalNotifications.getPending();
    const aCancelar = pendientes.notifications
      .filter((n) => !idsValidos.has(n.id))
      .map((n) => ({ id: n.id }));

    if (aCancelar.length > 0) {
      await LocalNotifications.cancel({ notifications: aCancelar });
    }
    if (aProgramar.length > 0) {
      await LocalNotifications.schedule({ notifications: aProgramar });
    }
  } catch (err) {
    console.error('Error reprogramando notificaciones:', err);
  }
}

// Punto de entrada de alto nivel: recibe la lista de calendarios a los que
// el usuario tiene acceso (propio + compartidos), descarta los que estén
// silenciados, trae sus datos actuales desde Supabase, y recalcula todo.
export async function reprogramarNotificacionesDeUsuario(opciones: { ownerId: string }[]) {
  if (!esNativo()) return;
  const silenciados = obtenerCalendariosSilenciados();
  const activos = opciones.filter((o) => !silenciados.includes(o.ownerId));

  const datos = await Promise.all(
    activos.map(async (o) => {
      const { eventos, excepciones } = await obtenerEventosYExcepcionesRemoto(o.ownerId);
      return { ownerId: o.ownerId, eventos, excepciones };
    })
  );

  await reprogramarNotificacionesCalendarios(datos);
}