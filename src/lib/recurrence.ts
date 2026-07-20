// src/lib/recurrence.ts

import { addDays, addWeeks, addMonths, addYears, isBefore, isAfter, format } from 'date-fns';
import { utcToEcuador } from './dates';

export type TipoRecurrencia = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type EventoBase = {
  id: string;
  titulo: string;
  descripcion: string | null;
  hex_color: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_recurrencia: TipoRecurrencia;
  minutos_aviso: number;
};

export type Excepcion = {
  id: string;
  event_base_id: string;
  fecha_excepcion: string; // 'yyyy-MM-dd'
  nuevo_titulo: string | null;
  nuevo_hex_color: string | null;
  nueva_hora_inicio: string | null;
  nueva_hora_fin: string | null;
  is_cancelled: boolean;
};

export type Ocurrencia = {
  eventoId: string;
  fecha: Date; // día base (hora Ecuador) según la regla, aunque se haya movido
  titulo: string;
  hex_color: string;
  hora_inicio: Date; // hora Ecuador ya resuelta (con excepción aplicada si existe)
  hora_fin: Date;
  esExcepcion: boolean;
  exceptionId?: string;
};

const LIMITE_ITERACIONES = 2000; // evita loops infinitos si algo sale mal

function avanzar(fecha: Date, tipo: TipoRecurrencia): Date {
  switch (tipo) {
    case 'daily':
      return addDays(fecha, 1);
    case 'weekly':
      return addWeeks(fecha, 1);
    case 'monthly':
      return addMonths(fecha, 1);
    case 'yearly':
      return addYears(fecha, 1);
    default:
      return fecha;
  }
}

export function proyectarEventos(
  eventos: EventoBase[],
  excepciones: Excepcion[],
  rangoInicio: Date,
  rangoFin: Date
): Ocurrencia[] {
  const resultado: Ocurrencia[] = [];

  for (const ev of eventos) {
    const inicioBase = utcToEcuador(ev.hora_inicio);
    const finBase = utcToEcuador(ev.hora_fin);
    const duracionMs = finBase.getTime() - inicioBase.getTime();

    if (ev.tipo_recurrencia === 'none') {
      if (!isBefore(inicioBase, rangoInicio) && !isAfter(inicioBase, rangoFin)) {
        agregarOcurrencia(ev, excepciones, inicioBase, finBase, resultado);
      }
      continue;
    }

    // Avanza el cursor desde la fecha ancla hasta entrar al rango visible.
    let cursorInicio = inicioBase;
    let guardA = 0;
    while (isBefore(cursorInicio, rangoInicio) && guardA < LIMITE_ITERACIONES) {
      cursorInicio = avanzar(cursorInicio, ev.tipo_recurrencia);
      guardA++;
    }

    let guardB = 0;
    while (!isAfter(cursorInicio, rangoFin) && guardB < LIMITE_ITERACIONES) {
      const cursorFin = new Date(cursorInicio.getTime() + duracionMs);
      agregarOcurrencia(ev, excepciones, cursorInicio, cursorFin, resultado);
      cursorInicio = avanzar(cursorInicio, ev.tipo_recurrencia);
      guardB++;
    }
  }

  return resultado;
}

function agregarOcurrencia(
  ev: EventoBase,
  excepciones: Excepcion[],
  inicio: Date,
  fin: Date,
  resultado: Ocurrencia[]
) {
  const fechaStr = format(inicio, 'yyyy-MM-dd');
  const excepcion = excepciones.find(
    (ex) => ex.event_base_id === ev.id && ex.fecha_excepcion === fechaStr
  );

  if (excepcion?.is_cancelled) return; // "esta semana no hay gimnasio"

  if (excepcion) {
    resultado.push({
      eventoId: ev.id,
      fecha: inicio,
      titulo: excepcion.nuevo_titulo ?? ev.titulo,
      hex_color: excepcion.nuevo_hex_color ?? ev.hex_color,
      hora_inicio: excepcion.nueva_hora_inicio ? utcToEcuador(excepcion.nueva_hora_inicio) : inicio,
      hora_fin: excepcion.nueva_hora_fin ? utcToEcuador(excepcion.nueva_hora_fin) : fin,
      esExcepcion: true,
      exceptionId: excepcion.id,
    });
  } else {
    resultado.push({
      eventoId: ev.id,
      fecha: inicio,
      titulo: ev.titulo,
      hex_color: ev.hex_color,
      hora_inicio: inicio,
      hora_fin: fin,
      esExcepcion: false,
    });
  }
}