// src/components/SelectorFechaModal.tsx
'use client';

import { useState } from 'react';
import { addMonths, subMonths, startOfMonth, isSameWeek } from 'date-fns';
import { getMonthGrid, isSameMonth, isSameDay, format, es, ahoraEcuador } from '@/lib/dates';

type Vista = 'mes' | 'semana' | 'dia';

interface SelectorFechaModalProps {
  fechaSeleccionada: Date;
  // Vista activa en el calendario: si es 'semana', se resalta con un
  // fondo suave toda la semana que contiene la fecha, no solo el día.
  vista: Vista;
  onSeleccionar: (fecha: Date) => void;
  onCerrar: () => void;
}

export default function SelectorFechaModal({
  fechaSeleccionada,
  vista,
  onSeleccionar,
  onCerrar,
}: SelectorFechaModalProps) {
  // Mes que se está mostrando dentro del selector (puede ser distinto
  // al mes de la vista principal mientras el usuario navega).
  // Como este componente se monta/desmonta cada vez que se abre/cierra
  // el modal (ver page.tsx: `{mostrarSelectorFecha && <SelectorFechaModal .../>}`),
  // no hace falta un useEffect para "sincronizar" esto: el estado inicial
  // ya se recalcula solo en cada montaje.
  const [mesVisible, setMesVisible] = useState<Date>(() => startOfMonth(fechaSeleccionada));

  const dias = getMonthGrid(mesVisible);
  const hoy = ahoraEcuador();

  function irMesAnterior() {
    setMesVisible((m) => subMonths(m, 1));
  }

  function irMesSiguiente() {
    setMesVisible((m) => addMonths(m, 1));
  }

  function seleccionarHoy() {
    onSeleccionar(hoy);
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-2xl animate-[fadeIn_0.15s_ease-out]"
      >
        {/* Encabezado: mes/año + flechas de navegación */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={irMesAnterior}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-pink-50 hover:text-pink-500"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <span className="text-sm font-semibold capitalize text-gray-800">
            {format(mesVisible, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={irMesSiguiente}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-pink-50 hover:text-pink-500"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>

        {/* Nombres de los días */}
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
          {dias.map((dia) => {
            const dentroDelMes = isSameMonth(dia, mesVisible);
            const esHoy = isSameDay(dia, hoy);
            const esSeleccionado = isSameDay(dia, fechaSeleccionada);
            // Si estamos en vista "semana", resaltamos con un fondo suave
            // TODA la semana que contiene la fecha (porque elegir un día
            // en esa vista en realidad activa toda su semana).
            const enSemanaSeleccionada =
              vista === 'semana' && isSameWeek(dia, fechaSeleccionada, { weekStartsOn: 1 });

            return (
              <button
                key={dia.toISOString()}
                onClick={() => {
                  onSeleccionar(dia);
                  onCerrar();
                }}
                className={[
                  'mx-auto flex h-8 w-8 items-center justify-center transition-colors',
                  !dentroDelMes ? 'text-gray-300' : 'text-gray-700',
                  esSeleccionado
                    ? 'rounded-full bg-pink-500 text-white font-semibold'
                    : esHoy
                    ? 'rounded-full border border-pink-400 text-pink-500 font-semibold'
                    : enSemanaSeleccionada
                    ? 'rounded-md bg-pink-50 hover:bg-pink-100'
                    : 'rounded-full hover:bg-pink-50',
                ].join(' ')}
              >
                {format(dia, 'd')}
              </button>
            );
          })}
        </div>

        {/* Footer con acceso rápido a "Hoy" */}
        <div className="mt-3 flex justify-center border-t border-gray-100 pt-3">
          <button
            onClick={seleccionarHoy}
            className="rounded-full px-4 py-1 text-xs font-medium text-pink-500 hover:bg-pink-50"
          >
            Ir a hoy
          </button>
        </div>
      </div>
    </div>
  );
}