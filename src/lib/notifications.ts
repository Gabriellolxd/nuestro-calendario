// src/lib/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { utcToEcuador } from './dates';
import type { EventoBase, Excepcion, TipoRecurrencia } from './recurrence';

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

// Canal de notificación propio: en Android 8+ el sonido/vibración/
// importancia se configuran a nivel de CANAL, no por notificación
// individual — por eso hay que crearlo una vez al iniciar la app.
// IMPORTANTE: el nombre del archivo de sonido debe existir en
// android/app/src/main/res/raw/ (ver instrucciones en el chat) ANTES
// de instalar la app — si el canal ya se creó una vez con el sonido
// por defecto, Android IGNORA cambios posteriores al mismo id de canal.
// Si cambias el sonido después de la primera instalación, sube el
// número de CHANNEL_ID (ej. a 'eventos-nuestro-calendario-v2').
const CHANNEL_ID = 'eventos-nuestro-calendario-v2';
const NOMBRE_ARCHIVO_SONIDO = 'notificacion_evento.wav'; // sin la carpeta, tal cual el archivo en res/raw/

export async function solicitarPermisoNotificaciones() {
  if (!esNativo()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Eventos del calendario',
      description: 'Avisos de eventos de nuestro-calendario',
      importance: 5, // máxima: permite heads-up + sonido
      sound: NOMBRE_ARCHIVO_SONIDO,
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.error('Error solicitando permiso / creando canal:', err);
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

export async function programarNotificacionEvento(evento: EventoBase) {
  if (!esNativo()) return;
  await cancelarNotificacionEvento(evento.id);
  if (evento.minutos_aviso == null) return;

  const horaInicioEcuador = utcToEcuador(evento.hora_inicio);
  const disparo = new Date(horaInicioEcuador.getTime() - evento.minutos_aviso * 60000);

  const esRecurrente = evento.tipo_recurrencia !== 'none';
  if (!esRecurrente && disparo.getTime() < Date.now()) return;

  const schedule: any = { at: disparo, allowWhileIdle: true };
  if (esRecurrente) {
    schedule.repeats = true;
    schedule.every = REPEAT_MAP[evento.tipo_recurrencia];
  }

  const cuerpo = evento.descripcion || 'Toca para ver el detalle en nuestro-calendario';

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idParaEvento(evento.id),
          title: evento.titulo,
          body: cuerpo,
          largeBody: cuerpo,
          summary: evento.titulo,
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_notify',
          schedule,
        },
      ],
    });
  } catch (err) {
    console.error('Error programando notificación:', err);
  }
}

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

  const titulo = excepcion.nuevo_titulo ?? eventoBase.titulo;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idParaExcepcion(excepcion.id),
          title: titulo,
          body: 'Toca para ver el detalle en nuestro-calendario',
          summary: titulo,
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_notify',
          schedule: { at: disparo, allowWhileIdle: true },
        },
      ],
    });
  } catch (err) {
    console.error('Error programando notificación de excepción:', err);
  }
}

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