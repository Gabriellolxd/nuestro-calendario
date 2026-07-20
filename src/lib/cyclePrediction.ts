// src/lib/cyclePrediction.ts
import { differenceInCalendarDays, addDays, parseISO, format as formatDate } from 'date-fns';

export type CycleLogInput = {
  period_start: string;
  period_end: string | null;
  luteal_length_manual: number | null;
};

type Episodio = { inicio: string; fin: string };

export type Prediccion = {
  avgCycleLength: number;
  stdDevCycle: number;
  lutealLength: number;
  avgPeriodDuration: number;
  esEstimado: boolean;
  ventanaEnsanchada: boolean;
  nextPeriodPredicted: string;
  ovulationPredicted: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  cycleLengths: number[];
};

export type PrediccionParaFases = Pick<Prediccion, 'avgCycleLength' | 'lutealLength' | 'ventanaEnsanchada' | 'avgPeriodDuration'>;

const LUTEAL_LENGTH_DEFAULT = 14;
const CYCLE_LENGTH_DEFAULT = 28;
const PERIOD_DURATION_DEFAULT = 5;
const UMBRAL_IRREGULARIDAD_DIAS = 4;
const ENSANCHE_VENTANA_DIAS = 2;
const MAX_CICLOS_CONSIDERADOS = 6;
const MAX_CICLOS_PROYECTADOS = 12;
const ALPHA_PESO_EXPONENCIAL = 0.65;

function agruparEnEpisodios(logs: CycleLogInput[]): Episodio[] {
  if (logs.length === 0) return [];
  const rangos = logs
    .map((l) => ({ inicio: l.period_start, fin: l.period_end ?? l.period_start }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const episodios: Episodio[] = [{ inicio: rangos[0].inicio, fin: rangos[0].fin }];
  for (let i = 1; i < rangos.length; i++) {
    const actual = episodios[episodios.length - 1];
    const gap = differenceInCalendarDays(parseISO(rangos[i].inicio), parseISO(actual.fin));
    if (gap <= 1) {
      if (rangos[i].fin > actual.fin) {
        actual.fin = rangos[i].fin;
      }
    } else {
      episodios.push({ inicio: rangos[i].inicio, fin: rangos[i].fin });
    }
  }
  return episodios;
}

function promedioPonderadoExponencial(valores: number[]): number {
  const n = valores.length;
  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (let i = 0; i < n; i++) {
    const antiguedad = n - 1 - i;
    const peso = Math.pow(ALPHA_PESO_EXPONENCIAL, antiguedad);
    sumaPonderada += valores[i] * peso;
    sumaPesos += peso;
  }
  return sumaPonderada / sumaPesos;
}

function desviacionEstandar(valores: number[]): number {
  const n = valores.length;
  if (n < 2) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const varianza = valores.reduce((acc, v) => acc + (v - media) * (v - media), 0) / n;
  return Math.sqrt(varianza);
}

export function calcularPrediccion(logs: CycleLogInput[]): Prediccion | null {
  if (logs.length === 0) return null;

  const episodios = agruparEnEpisodios(logs);

  const duracionesPeriodo = episodios.map(function (e) {
    return differenceInCalendarDays(parseISO(e.fin), parseISO(e.inicio)) + 1;
  });
  const sumaDuraciones = duracionesPeriodo.reduce((a, b) => a + b, 0);
  const avgPeriodDuration = duracionesPeriodo.length > 0
    ? Math.round(sumaDuraciones / duracionesPeriodo.length)
    : PERIOD_DURATION_DEFAULT;

  const lutealesManual = logs
    .map((l) => l.luteal_length_manual)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const lutealLength = lutealesManual.length > 0
    ? Math.round(lutealesManual.reduce((a, b) => a + b, 0) / lutealesManual.length)
    : LUTEAL_LENGTH_DEFAULT;

  let avgCycleLength: number;
  let stdDevCycle = 0;
  let esEstimado = false;
  const cycleLengths: number[] = [];

  if (episodios.length >= 2) {
    for (let i = 1; i < episodios.length; i++) {
      const dur = differenceInCalendarDays(parseISO(episodios[i].inicio), parseISO(episodios[i - 1].inicio));
      if (dur > 0) {
        cycleLengths.push(dur);
      }
    }
    if (cycleLengths.length === 0) {
      avgCycleLength = CYCLE_LENGTH_DEFAULT;
      esEstimado = true;
    } else {
      const consideradas = cycleLengths.slice(-MAX_CICLOS_CONSIDERADOS);
      avgCycleLength = promedioPonderadoExponencial(consideradas);
      stdDevCycle = desviacionEstandar(consideradas);
    }
  } else {
    avgCycleLength = CYCLE_LENGTH_DEFAULT;
    esEstimado = true;
  }

  const ventanaEnsanchada = stdDevCycle > UMBRAL_IRREGULARIDAD_DIAS;
  const ultimoInicio = parseISO(episodios[episodios.length - 1].inicio);
  const largoRedondeado = Math.round(avgCycleLength);

  const nextPeriodPredicted = addDays(ultimoInicio, largoRedondeado);
  const ovulationPredicted = addDays(nextPeriodPredicted, -lutealLength);
  const extra = ventanaEnsanchada ? ENSANCHE_VENTANA_DIAS : 0;
  const fertileWindowStart = addDays(ovulationPredicted, -5 - extra);
  const fertileWindowEnd = addDays(ovulationPredicted, 1 + extra);

  return {
    avgCycleLength: avgCycleLength,
    stdDevCycle: stdDevCycle,
    lutealLength: lutealLength,
    avgPeriodDuration: avgPeriodDuration,
    esEstimado: esEstimado,
    ventanaEnsanchada: ventanaEnsanchada,
    nextPeriodPredicted: formatDate(nextPeriodPredicted, 'yyyy-MM-dd'),
    ovulationPredicted: formatDate(ovulationPredicted, 'yyyy-MM-dd'),
    fertileWindowStart: formatDate(fertileWindowStart, 'yyyy-MM-dd'),
    fertileWindowEnd: formatDate(fertileWindowEnd, 'yyyy-MM-dd'),
    cycleLengths: cycleLengths,
  };
}

export type FaseDia =
  | { fase: 'periodo' }
  | { fase: 'periodo_predicho' }
  | { fase: 'folicular' }
  | { fase: 'ventana_fertil' }
  | { fase: 'ovulacion' }
  | { fase: 'fase_lutea' }
  | null;

export function calcularFaseDia(
  fechaStr: string,
  logs: CycleLogInput[],
  prediccion: PrediccionParaFases | null
): FaseDia {
  for (const log of logs) {
    const inicio = log.period_start;
    const fin = log.period_end ?? log.period_start;
    if (fechaStr >= inicio && fechaStr <= fin) {
      return { fase: 'periodo' };
    }
  }

  if (!prediccion || logs.length === 0) return null;

  const episodios = agruparEnEpisodios(logs);
  const ultimoInicio = parseISO(episodios[episodios.length - 1].inicio);
  const fecha = parseISO(fechaStr);
  if (fecha < ultimoInicio) return null;

  const cycleLength = Math.max(1, Math.round(prediccion.avgCycleLength));
  const diffDays = differenceInCalendarDays(fecha, ultimoInicio);
  if (diffDays > cycleLength * MAX_CICLOS_PROYECTADOS) return null;

  const dayInCycle = (diffDays % cycleLength) + 1;

  if (diffDays > 0 && dayInCycle <= prediccion.avgPeriodDuration) {
    return { fase: 'periodo_predicho' };
  }

  const ovulationDay = cycleLength - prediccion.lutealLength;
  const extra = prediccion.ventanaEnsanchada ? ENSANCHE_VENTANA_DIAS : 0;
  const fertileStart = ovulationDay - 5 - extra;
  const fertileEnd = ovulationDay + 1 + extra;

  if (dayInCycle === ovulationDay) return { fase: 'ovulacion' };
  if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) return { fase: 'ventana_fertil' };
  if (dayInCycle < ovulationDay) return { fase: 'folicular' };
  return { fase: 'fase_lutea' };
}

export const ICONOS_FASE: Record<string, string> = {
  periodo: '🩸',
  periodo_predicho: '🔴',
  folicular: '🌱',
  ventana_fertil: '💛',
  ovulacion: '🥚',
  fase_lutea: '🌙',
};

export const NOMBRES_FASE: Record<string, string> = {
  periodo: 'Periodo',
  periodo_predicho: 'Periodo (predicho)',
  folicular: 'Fase folicular',
  ventana_fertil: 'Ventana fértil',
  ovulacion: 'Ovulación',
  fase_lutea: 'Fase lútea',
};