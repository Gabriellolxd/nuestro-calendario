// src/lib/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays } from 'date-fns';
import { ahoraEcuador, format } from './dates';
import { proyectarEventos, type EventoBase, type Excepcion } from './recurrence';
import { obtenerCalendariosSilenciados } from './notificationPrefs';
import { obtenerEventosYExcepcionesRemoto } from './notificationsRemoto';
import { TONOS_NOTIFICACION } from './notificationTones';

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

// Un canal de Android por cada tono disponible — es la única forma real
// de que sonidos distintos por evento funcionen en Android 8+, porque el
// sistema ata el sonido al CANAL, no a cada notificación individual.
function idCanalParaTono(tonoId: string): string {
  return `eventos-nc-${tonoId}`;
}

const VENTANA_DIAS = 60;
const MAX_NOTIFICACIONES = 50;

let permisoVerificado = false;

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

    // Crea UN canal por cada tono — cada uno con su propio sonido fijo.
    for (const tono of TONOS_NOTIFICACION) {
      try {
        await LocalNotifications.createChannel({
          id: idCanalParaTono(tono.id),
          name: `Eventos — ${tono.nombre}`,
          description: 'Avisos de eventos de nuestro-calendario',
          importance: 5,
          sound: tono.archivo,
          visibility: 1,
          vibration: true,
        });
      } catch (err) {
        console.error(`Error creando canal para tono ${tono.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error solicitando permiso / creando canales:', err);
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

export type DatosCalendario = { ownerId: string; eventos: EventoBase[]; excepciones: Excepcion[] };

export async function reprogramarNotificacionesCalendarios(calendarios: DatosCalendario[]) {
  if (!esNativo()) return;

  const tienePermiso = await asegurarPermisos();
  if (!tienePermiso) {
    console.warn('Reprogramación omitida: permiso de notificaciones no otorgado.');
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
      const tonoPorId = new Map(cal.eventos.map((e) => [e.id, e.tono_notificacion]));

      for (const oc of ocurrencias) {
        const minutosAviso = minutosAvisoPorId.get(oc.eventoId) ?? 5;
        const disparo = new Date(oc.hora_inicio.getTime() - minutosAviso * 60000);
        if (disparo.getTime() <= Date.now()) continue;
        if (aProgramar.length >= MAX_NOTIFICACIONES) break;

        const fechaStr = format(oc.fecha, 'yyyy-MM-dd');
        const id = idParaOcurrencia(oc.eventoId, fechaStr);
        idsValidos.add(id);

        const tonoId = tonoPorId.get(oc.eventoId) ?? 'notificacion_evento';

        aProgramar.push({
          id,
          title: oc.titulo || 'Evento',
          body: 'Toca para ver el detalle en nuestro-calendario',
          channelId: idCanalParaTono(tonoId),
          smallIcon: 'ic_stat_name',
          schedule: { at: disparo, allowWhileIdle: true },
        });
      }
    }

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

export async function reprogramarNotificacionesDeUsuario(
  opciones: { ownerId: string }[],
  // Datos ya frescos que NO deben volver a leerse de Supabase — se usan
  // para el calendario que se acaba de editar en este mismo dispositivo,
  // evitando la condición de carrera con el push que aún no terminó.
  overrides?: DatosCalendario[]
) {
  if (!esNativo()) return;
  try {
    const silenciados = obtenerCalendariosSilenciados();
    const activos = opciones.filter((o) => !silenciados.includes(o.ownerId));
    if (activos.length === 0) return;

    const overridesPorId = new Map((overrides ?? []).map((o) => [o.ownerId, o]));

    const datos = await Promise.all(
      activos.map(async (o) => {
        const override = overridesPorId.get(o.ownerId);
        if (override) return override;
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

export async function estaPermisoNotificacionesConcedido(): Promise<boolean> {
  if (!esNativo()) return false;
  try {
    const check = await LocalNotifications.checkPermissions();
    return check.display === 'granted';
  } catch {
    return false;
  }
}