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
const VENTANA_DIAS = 60;
const MAX_NOTIFICACIONES = 50; // Límite de seguridad para Android

let permisoVerificado = false;

// Comprueba los permisos de forma segura antes de realizar cualquier llamada a la API nativa
async function asegurarPermisos(): Promise<boolean> {
  if (!esNativo()) return false;
  if (permisoVerificado) return true;

  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display === 'granted') {
      permisoVerificado = true;
      return true;
    }
    const req = await LocalNotifications.requestPermissions();
    permisoVerificado = req.display === 'granted';
    return permisoVerificado;
  } catch (err) {
    console.error('Error comprobando permisos de notificaciones:', err);
    return false;
  }
}

export async function solicitarPermisoNotificaciones() {
  if (!esNativo()) return;
  try {
    const concedido = await asegurarPermisos();
    if (!concedido) return;

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

export async function reprogramarNotificacionesCalendarios(calendarios: DatosCalendario[]) {
  if (!esNativo()) return;

  // VERIFICACIÓN DE SEGURIDAD CRÍTICA:
  // Si no hay permisos, abortamos inmediatamente ANTES de tocar el plugin nativo.
  const tienePermiso = await asegurarPermisos();
  if (!tienePermiso) {
    console.warn('Reprogramación omitida: Permiso de notificaciones denegado o no otorgado.');
    return;
  }

  try {
    const ahora = ahoraEcuador();
    const limite = addDays(ahora, VENTANA_DIAS);
    const idsValidos = new Set<number>();
    const aProgramar: NotifProgramada[] = [];

    for (const cal of calendarios) {
      let ocurrencias;
      try {
        ocurrencias = proyectarEventos(cal.eventos, cal.excepciones, ahora, limite);
      } catch (e) {
        console.error('Error proyectando eventos:', e);
        continue;
      }

      const minutosAvisoPorId = new Map(cal.eventos.map((e) => [e.id, e.minutos_aviso]));

      for (const oc of ocurrencias) {
        const minutosAviso = minutosAvisoPorId.get(oc.eventoId) ?? 5;
        const disparo = new Date(oc.hora_inicio.getTime() - minutosAviso * 60000);
        if (disparo.getTime() <= Date.now()) continue;

        if (aProgramar.length >= MAX_NOTIFICACIONES) break;

        const fechaStr = format(oc.fecha, 'yyyy-MM-dd');
        const id = idParaOcurrencia(oc.eventoId, fechaStr);
        idsValidos.add(id);

        aProgramar.push({
          id,
          title: oc.titulo || 'Evento',
          body: 'Toca para ver el detalle en nuestro-calendario',
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_name',
          schedule: { at: disparo, allowWhileIdle: true },
        });
      }
    }

    // Cada paso nativo se aísla con try/catch individual
    let pendientes;
    try {
      pendientes = await LocalNotifications.getPending();
    } catch (err) {
      console.error('Error obteniendo pendientes:', err);
      return;
    }

    const aCancelar = pendientes.notifications
      .filter((n) => !idsValidos.has(n.id))
      .map((n) => ({ id: n.id }));

    if (aCancelar.length > 0) {
      try {
        await LocalNotifications.cancel({ notifications: aCancelar });
      } catch (err) {
        console.error('Error cancelando notificaciones:', err);
      }
    }

    if (aProgramar.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications: aProgramar });
      } catch (err) {
        console.error('Error al programar schedule():', err);
      }
    }
  } catch (err) {
    console.error('Error inesperado reprogramando notificaciones:', err);
  }
}

export async function reprogramarNotificacionesDeUsuario(opciones: { ownerId: string }[]) {
  if (!esNativo()) return;
  try {
    const silenciados = obtenerCalendariosSilenciados();
    const activos = opciones.filter((o) => !silenciados.includes(o.ownerId));
    if (activos.length === 0) return;

    const datos = await Promise.all(
      activos.map(async (o) => {
        try {
          const { eventos, excepciones } = await obtenerEventosYExcepcionesRemoto(o.ownerId);
          return { ownerId: o.ownerId, eventos, excepciones };
        } catch (err) {
          console.error(`Error obteniendo datos remotos (${o.ownerId}):`, err);
          return { ownerId: o.ownerId, eventos: [], excepciones: [] };
        }
      })
    );

    await reprogramarNotificacionesCalendarios(datos);
  } catch (err) {
    console.error('Error en reprogramarNotificacionesDeUsuario:', err);
  }
}