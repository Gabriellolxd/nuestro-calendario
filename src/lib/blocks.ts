// src/lib/blocks.ts
import type { Ocurrencia } from './recurrence';
import { mezclarColores } from './colors';

export type Segmento = {
  id: string;
  inicioMs: number;
  finMs: number;
  ocurrencias: Ocurrencia[];
  color: string;
};

function mismoConjunto(a: Ocurrencia[], b: Ocurrencia[]): boolean {
  if (a.length !== b.length) return false;
  const clave = (oc: Ocurrencia) => `${oc.eventoId}-${oc.fecha.toISOString()}`;
  const setA = new Set(a.map(clave));
  return b.every((oc) => setA.has(clave(oc)));
}

// Divide las ocurrencias de un día en tramos de tiempo según dónde cambia
// el conjunto de eventos activos. Un tramo donde solo hay un evento
// conserva su color original; un tramo donde dos o más eventos se
// solapan muestra la mezcla de colores, EXACTAMENTE en el rango donde
// colisionan (no en todo el evento). Ejemplo: evento1 07-10, evento2
// 09-11 → tramo 07-09 color1, tramo 09-10 mezcla, tramo 10-11 color2.
export function construirSegmentos(ocs: Ocurrencia[]): Segmento[] {
  if (ocs.length === 0) return [];

  const puntos = new Set<number>();
  ocs.forEach((oc) => {
    puntos.add(oc.hora_inicio.getTime());
    puntos.add(oc.hora_fin.getTime());
  });
  const ordenados = Array.from(puntos).sort((a, b) => a - b);

  const crudos: { inicioMs: number; finMs: number; ocurrencias: Ocurrencia[] }[] = [];
  for (let i = 0; i < ordenados.length - 1; i++) {
    const inicioMs = ordenados[i];
    const finMs = ordenados[i + 1];
    if (finMs <= inicioMs) continue;

    const activos = ocs.filter(
      (oc) => oc.hora_inicio.getTime() <= inicioMs && oc.hora_fin.getTime() >= finMs
    );
    if (activos.length === 0) continue;
    crudos.push({ inicioMs, finMs, ocurrencias: activos });
  }

  // Fusiona tramos consecutivos donde el conjunto de activos no cambió,
  // para no cortar visualmente sin necesidad.
  const fusionados: { inicioMs: number; finMs: number; ocurrencias: Ocurrencia[] }[] = [];
  for (const tramo of crudos) {
    const anterior = fusionados[fusionados.length - 1];
    if (
      anterior &&
      anterior.finMs === tramo.inicioMs &&
      mismoConjunto(anterior.ocurrencias, tramo.ocurrencias)
    ) {
      anterior.finMs = tramo.finMs;
    } else {
      fusionados.push({ ...tramo });
    }
  }

  return fusionados.map((tramo) => ({
    id: `${tramo.inicioMs}-${tramo.finMs}-${tramo.ocurrencias.map((o) => o.eventoId).join(',')}`,
    inicioMs: tramo.inicioMs,
    finMs: tramo.finMs,
    ocurrencias: tramo.ocurrencias,
    color:
      tramo.ocurrencias.length > 1
        ? mezclarColores(tramo.ocurrencias.map((o) => o.hex_color))
        : tramo.ocurrencias[0].hex_color,
  }));
}