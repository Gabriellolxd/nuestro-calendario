// src/app/onboarding/page.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import {
  ChevronLeft, ChevronRight, Sparkles, Bell, BatteryCharging, PlayCircle,
  CheckCircle2, Calendar, Droplet, Palette, PartyPopper,
} from 'lucide-react';
import { marcarOnboardingCompletado } from '@/lib/onboarding';
import { IMAGENES_ONBOARDING } from '@/lib/onboardingImages';
import { solicitarPermisoNotificaciones, estaPermisoNotificacionesConcedido } from '@/lib/notifications';
import { estaExentoDeOptimizacionBateria, solicitarExencionBateria, abrirInicioAutomatico } from '@/lib/deviceSetup';

type Paso = {
  id: keyof typeof IMAGENES_ONBOARDING;
  titulo: string;
  descripcion: string;
  soloNativo?: boolean;
};

const PASOS: Paso[] = [
  { id: 'bienvenida', titulo: '¡Bienvenida a Nuestro Calendario! ❤️', descripcion: 'Un espacio hecho con cariño para organizar nuestra vida juntos. ¡Hay eventos, notitas, stickers, y hasta el ciclo menstrual! Todo en un solo lugar ;)' },
  { id: 'intro', titulo: '¡Comparte tu calendario con quien quieras!', descripcion: 'Dejales notas o stickers rancios a los demás y no se pierdan de ningún detalle de la vida del otro.' },
  { id: 'notificaciones', titulo: 'Antes de comenzar 👌', descripcion: 'Para que nunca pierdas un evento importante, la app necesita permiso para mostrar notificaciones.', soloNativo: true },
  { id: 'bateria', titulo: '¡Que los avisos no se duerman!', descripcion: 'Algunos teléfonos "duermen" las apps para ahorrar batería, y eso puede silenciar tus notificaciones. Actívalo para asegurarte de recibirlas siempre a tiempo.', soloNativo: true },
  { id: 'autoinicio', titulo: 'Un último ajuste...', descripcion: 'En algunos teléfonos (Xiaomi, Huawei, Samsung y otros) hay que permitir el "inicio automático" para que la app pueda avisarte incluso si no la abres seguido.', soloNativo: true },
  { id: 'listo', titulo: '¡Todo listo! 🎉', descripcion: 'Ya puedes empezar a usar Nuestro Calendario. Aunque ahora es TU calendario ❤️ Gracias por darle una oportunidad.' },
];

function ImagenPaso({ src, Fallback }: { src?: string; Fallback: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-[var(--color-surface)]">
        <Fallback size={56} className="text-[var(--color-primary)]" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className="h-40 w-40 rounded-3xl object-cover shadow-[var(--sombra-panel-suave)]"
    />
  );
}

const FALLBACK_ICONO: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  bienvenida: Sparkles,
  intro: Calendar,
  notificaciones: Bell,
  bateria: BatteryCharging,
  autoinicio: PlayCircle,
  listo: PartyPopper,
};

export default function OnboardingPage() {
  const router = useRouter();
  const esNativo = Capacitor.isNativePlatform();
  const pasos = PASOS.filter((p) => !p.soloNativo || esNativo);

  const [pasoActual, setPasoActual] = useState(0);
  const [notifConcedido, setNotifConcedido] = useState(false);
  const [bateriaExenta, setBateriaExenta] = useState(false);
  const [autoinicioConfirmado, setAutoinicioConfirmado] = useState(false);
  const inicioSwipe = useRef<{ x: number; y: number } | null>(null);

  const paso = pasos[pasoActual];
  const esUltimo = pasoActual === pasos.length - 1;

  function irSiguiente() {
    if (esUltimo) {
      marcarOnboardingCompletado();
      router.push('/login');
      return;
    }
    setPasoActual((p) => Math.min(pasos.length - 1, p + 1));
  }

  function irAnterior() {
    setPasoActual((p) => Math.max(0, p - 1));
  }

  function manejarSwipeInicio(e: React.TouchEvent) {
    const t = e.touches[0];
    inicioSwipe.current = { x: t.clientX, y: t.clientY };
  }

  function manejarSwipeFin(e: React.TouchEvent) {
    if (!inicioSwipe.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicioSwipe.current.x;
    const dy = t.clientY - inicioSwipe.current.y;
    inicioSwipe.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) irSiguiente();
    else irAnterior();
  }

  async function handleActivarNotificaciones() {
    await solicitarPermisoNotificaciones();
    const concedido = await estaPermisoNotificacionesConcedido();
    setNotifConcedido(concedido);
  }

  async function handleActivarBateria() {
    await solicitarExencionBateria();
    setTimeout(async () => {
      const exenta = await estaExentoDeOptimizacionBateria();
      setBateriaExenta(exenta);
    }, 600);
  }

  async function handleAbrirAutoinicio() {
    await abrirInicioAutomatico();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] textura-cozy">
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 py-8"
        onTouchStart={manejarSwipeInicio}
        onTouchEnd={manejarSwipeFin}
      >
        <div key={paso.id} className="panel-madera flex w-full max-w-sm flex-col items-center gap-5 p-6 animar-entrada">
          <ImagenPaso src={IMAGENES_ONBOARDING[paso.id]} Fallback={FALLBACK_ICONO[paso.id]} />

          <div className="text-center">
            <h1 className="font-display mb-2 text-xl font-bold text-[var(--color-text)]">{paso.titulo}</h1>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{paso.descripcion}</p>
          </div>

          {/* Mini-presentación animada en el paso "intro" */}
          {paso.id === 'intro' && (
            <div className="flex gap-4">
              {[Calendar, Droplet, Palette].map((Icono, i) => (
                <span
                  key={i}
                  className="insignia-icono h-12 w-12 animar-entrada"
                  style={{ animationDelay: `${i * 0.15}s`, borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}
                >
                  <Icono size={22} className="text-[var(--color-primary)]" strokeWidth={2} />
                </span>
              ))}
            </div>
          )}

          {/* Paso: notificaciones */}
          {paso.id === 'notificaciones' && (
            <button
              onClick={handleActivarNotificaciones}
              className={`boton-tallado flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold ${
                notifConcedido
                  ? 'bg-[var(--color-sage)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
              }`}
            >
              {notifConcedido ? <CheckCircle2 size={18} /> : <Bell size={18} />}
              {notifConcedido ? 'Activado' : 'Activar notificaciones'}
            </button>
          )}

          {/* Paso: batería */}
          {paso.id === 'bateria' && (
            <button
              onClick={handleActivarBateria}
              className={`boton-tallado flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold ${
                bateriaExenta
                  ? 'bg-[var(--color-sage)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
              }`}
            >
              {bateriaExenta ? <CheckCircle2 size={18} /> : <BatteryCharging size={18} />}
              {bateriaExenta ? 'Activado' : 'Permitir siempre en segundo plano'}
            </button>
          )}

          {/* Paso: autoinicio (no se puede verificar por API, se auto-reporta) */}
          {paso.id === 'autoinicio' && (
            <div className="flex w-full flex-col gap-2">
              <button
                onClick={handleAbrirAutoinicio}
                className="boton-tallado flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-2.5 font-semibold text-[var(--color-text-inverse)]"
              >
                <PlayCircle size={18} />
                Abrir ajuste de inicio automático
              </button>
              <button
                onClick={() => setAutoinicioConfirmado(true)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-xs font-medium ${
                  autoinicioConfirmado
                    ? 'border-[var(--color-sage)] text-[var(--color-sage)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
              >
                {autoinicioConfirmado && <CheckCircle2 size={14} />}
                {autoinicioConfirmado ? 'Confirmado' : 'Ya lo activé / mi teléfono no lo pide'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navegación + barra de progreso */}
      <div className="px-6 pb-8">
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {pasos.map((p, i) => (
            <span
              key={p.id}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === pasoActual ? 22 : 8,
                backgroundColor: i === pasoActual ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            />
          ))}
        </div>
        <p className="font-hand mb-3 text-center text-base text-[var(--color-text-muted)]">
          Paso {pasoActual + 1} de {pasos.length}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={irAnterior}
            disabled={pasoActual === 0}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={irSiguiente}
            className="boton-tallado flex-1 rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-[var(--color-text-inverse)]"
          >
            {esUltimo ? 'Comenzar' : 'Siguiente'}
          </button>
          {!esUltimo && (
            <button
              onClick={irSiguiente}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-border)] text-[var(--color-text-muted)]"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}