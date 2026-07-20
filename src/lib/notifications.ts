// src/lib/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { utcToEcuador } from './dates';
import type { EventoBase, Excepcion, TipoRecurrencia } from './recurrence';

function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

// Convierte cualquier string (UUID) a un entero de 32 bits estable — Android
// exige IDs numéricos para las notificaciones programadas.
function hashANumero(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647;
}

function idParaEvento(eventoId: string): number {
  return hashANumero(`evento-${eventoId}`);
}

function idParaExcepcion(excepcionId: string): number {
  return hashANumero(`excepcion-${excepcionId}`);
}

const REPEAT_MAP: Partial<Record<TipoRecurrencia, 'day' | 'week' | 'month' | 'year'>> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export async function solicitarPermisoNotificaciones() {
  if (!esNativo()) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.error('Error solicitando permiso de notificaciones:', err);
  }
}

export async function cancelarNotificacionEvento(eventoId: string) {
  if (!esNativo()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: idParaEvento(eventoId) }] });
  } catch (err) {
    console.error('Error cancelando notificación de evento:', err);
  }
}

export async function cancelarNotificacionExcepcion(excepcionId: string) {
  if (!esNativo()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: idParaExcepcion(excepcionId) }] });
  } catch (err) {
    console.error('Error cancelando notificación de excepción:', err);
  }
}

// Programa (o reprograma) la notificación de un evento base. Si es
// recurrente, usa el modo "repeats" nativo de Android — una sola
// notificación que se repite sola, en vez de crear una por cada ocurrencia
// futura. Limitación conocida: si luego se excepciona UN día puntual de
// la serie, esta notificación base sigue sonando ese día igual (Android
// no permite "saltar" una sola repetición nativa) — se compensa
// mostrando/cancelando por separado la notificación de la excepción,
// pero ambas pueden sonar el mismo día en ese caso puntual.
export async function programarNotificacionEvento(evento: EventoBase) {
  if (!esNativo()) return;
  await cancelarNotificacionEvento(evento.id);
  if (evento.minutos_aviso == null) return;

  const horaInicioEcuador = utcToEcuador(evento.hora_inicio);
  const disparo = new Date(horaInicioEcuador.getTime() - evento.minutos_aviso * 60000);

  const esRecurrente = evento.tipo_recurrencia !== 'none';
  if (!esRecurrente && disparo.getTime() < Date.now()) {
    return; // evento único ya pasado: no tiene sentido programar
  }

  const schedule: any = { at: disparo, allowWhileIdle: true };
  if (esRecurrente) {
    schedule.repeats = true;
    schedule.every = REPEAT_MAP[evento.tipo_recurrencia];
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idParaEvento(evento.id),
          title: evento.titulo,
          body: evento.descripcion || 'Tienes un evento próximo en nuestro-calendario',
          schedule,
        },
      ],
    });
  } catch (err) {
    console.error('Error programando notificación:', err);
  }
}

// Programa la notificación de una excepción puntual (un día movido o con
// hora distinta). Si la excepción CANCELA la ocurrencia (is_cancelled),
// solo cancela cualquier notificación propia de esa excepción — no puede
// silenciar la notificación recurrente base de ese día (ver limitación
// arriba).
export async function programarNotificacionExcepcion(
  excepcion: Excepcion,
  eventoBase: EventoBase
) {
  if (!esNativo()) return;
  await cancelarNotificacionExcepcion(excepcion.id);

  if (excepcion.is_cancelled || !excepcion.nueva_hora_inicio) return;

  const horaInicioEcuador = utcToEcuador(excepcion.nueva_hora_inicio);
  const disparo = new Date(horaInicioEcuador.getTime() - eventoBase.minutos_aviso * 60000);
  if (disparo.getTime() < Date.now()) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idParaExcepcion(excepcion.id),
          title: excepcion.nuevo_titulo ?? eventoBase.titulo,
          body: 'Tienes un evento próximo en nuestro-calendario',
          schedule: { at: disparo, allowWhileIdle: true },
        },
      ],
    });
  } catch (err) {
    console.error('Error programando notificación de excepción:', err);
  }
}

// Reprograma TODAS las notificaciones a partir de lo que hay en Dexie —
// se llama tras cada sync (pull), porque eventos creados por el otro
// dispositivo (tu pareja) también deben notificar en este teléfono.
export async function reprogramarTodasLasNotificaciones(
  eventos: EventoBase[],
  excepciones: Excepcion[]
) {
  if (!esNativo()) return;
  for (const evento of eventos) {
    await programarNotificacionEvento(evento);
  }
  for (const excepcion of excepciones) {
    const eventoBase = eventos.find((e) => e.id === excepcion.event_base_id);
    if (eventoBase) await programarNotificacionExcepcion(excepcion, eventoBase);
  }
}