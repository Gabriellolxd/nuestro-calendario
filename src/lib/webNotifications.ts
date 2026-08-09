// src/lib/webNotifications.ts
import { proyectarEventos, type EventoBase, type Excepcion } from './recurrence';
import { obtenerEventosYExcepcionesRemoto } from './notificationsRemoto';
import { ahoraEcuador } from './dates';
import { addDays } from 'date-fns';

export type NotificacionProxima = {
  id: string;
  titulo: string;
  hora: Date;
  tono: string;
};

export async function calcularProximasNotificaciones(ownerIds: string[]): Promise<NotificacionProxima[]> {
  const ahora = ahoraEcuador();
  const limite = addDays(ahora, 2); // ventana corta: solo interesa lo inminente
  const resultado: NotificacionProxima[] = [];

  for (const ownerId of ownerIds) {
    let eventos: EventoBase[] = [];
    let excepciones: Excepcion[] = [];
    try {
      const datos = await obtenerEventosYExcepcionesRemoto(ownerId);
      eventos = datos.eventos;
      excepciones = datos.excepciones;
    } catch (err) {
      console.error('Error obteniendo eventos para aviso web:', err);
      continue;
    }

    const ocurrencias = proyectarEventos(eventos, excepciones, ahora, limite);
    const minutosPorId = new Map(eventos.map((e) => [e.id, e.minutos_aviso]));
    const tonoPorId = new Map(eventos.map((e) => [e.id, e.tono_notificacion]));

    for (const oc of ocurrencias) {
      const minutos = minutosPorId.get(oc.eventoId) ?? 5;
      const disparo = new Date(oc.hora_inicio.getTime() - minutos * 60000);
      resultado.push({
        id: `${oc.eventoId}-${oc.fecha.toISOString()}`,
        titulo: oc.titulo,
        hora: disparo,
        tono: tonoPorId.get(oc.eventoId) ?? 'notificacion_evento',
      });
    }
  }

  return resultado;
}