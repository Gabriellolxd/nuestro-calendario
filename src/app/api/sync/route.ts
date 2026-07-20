// src/app/api/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type EntityType = 'event' | 'event_exception' | 'cycle_log';

type CambioEntrante = {
  entity_type: EntityType;
  data: Record<string, any>;
};

const UMBRAL_CONFLICTO_MS = 5 * 60 * 1000; // 5 minutos
const CAMPOS_IGNORADOS = ['device_id', 'change_uuid', 'client_updated_at', 'created_at', 'origen_offline'];

function datosComparables(fila: Record<string, any>) {
  const copia = { ...fila };
  for (const campo of CAMPOS_IGNORADOS) delete copia[campo];
  return copia;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const body = await req.json();
  const cambios: CambioEntrante[] = body.cambios ?? [];
  const resultados: Array<{
    id: string;
    entity_type: EntityType;
    estado: 'aplicado' | 'duplicado' | 'conflicto' | 'error';
    mensaje?: string;
  }> = [];

  for (const cambio of cambios) {
    const tabla = cambio.entity_type === 'event' ? 'events' : cambio.entity_type === 'event_exception' ? 'event_exceptions' : 'cycle_logs';
    const { origen_offline: origenOfflineEntrante, ...datosEntrante } = cambio.data;

    const { data: filaExistente, error: selError } = await supabaseUser
      .from(tabla)
      .select('*')
      .eq('id', datosEntrante.id)
      .maybeSingle();

    if (selError) {
      resultados.push({ id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'error', mensaje: selError.message });
      continue;
    }

    if (!filaExistente) {
      const { error: upsertError } = await supabaseUser.from(tabla).upsert(datosEntrante, { onConflict: 'id' });
      resultados.push(
        upsertError
          ? { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'error', mensaje: upsertError.message }
          : { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'aplicado' }
      );
      continue;
    }

    if (filaExistente.change_uuid === datosEntrante.change_uuid) {
      resultados.push({ id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'duplicado' });
      continue;
    }

    const iguales =
      JSON.stringify(datosComparables(filaExistente)) === JSON.stringify(datosComparables(datosEntrante));

    if (iguales) {
      resultados.push({ id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'duplicado' });
      continue;
    }

    const tsExistente = new Date(filaExistente.client_updated_at).getTime();
    const tsEntrante = new Date(datosEntrante.client_updated_at).getTime();
    const diffMs = Math.abs(tsEntrante - tsExistente);

    // Un conflicto real solo existe entre DOS dispositivos distintos.
    // Si el dispositivo que sube el cambio es el mismo que ya tenía el
    // servidor, es simplemente una edición secuencial tuya (o un falso
    // "offline" por navigator.onLine poco confiable) — nunca un choque
    // real con otra persona. Se aplica LWW automático sin preguntar.
    const mismoDispositivo = filaExistente.device_id === datosEntrante.device_id;
    const esConflicto = !mismoDispositivo && (diffMs <= UMBRAL_CONFLICTO_MS || origenOfflineEntrante === 1);

    if (esConflicto) {
      const payloadConflicto = {
        entity_type: cambio.entity_type,
        entity_id: datosEntrante.id,
        device_id_local: datosEntrante.device_id,
        datos_locales: datosEntrante,
        local_updated_at: datosEntrante.client_updated_at,
        local_origen_offline: origenOfflineEntrante === 1,
        device_id_servidor: filaExistente.device_id,
        datos_servidor: filaExistente,
        server_updated_at: filaExistente.client_updated_at,
      };

      // Evita duplicar: si ya hay un conflicto SIN resolver para esta
      // misma entidad, se actualiza esa fila en vez de insertar otra.
      const { data: conflictoExistente } = await supabaseAdmin
        .from('sync_conflicts')
        .select('id')
        .eq('entity_type', cambio.entity_type)
        .eq('entity_id', datosEntrante.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: conflictError } = conflictoExistente
        ? await supabaseAdmin.from('sync_conflicts').update(payloadConflicto).eq('id', conflictoExistente.id)
        : await supabaseAdmin.from('sync_conflicts').insert(payloadConflicto);

      resultados.push(
        conflictError
          ? { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'error', mensaje: conflictError.message }
          : { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'conflicto' }
      );
      continue;
    }

    if (tsEntrante > tsExistente) {
      const { error: updError } = await supabaseUser.from(tabla).upsert(datosEntrante, { onConflict: 'id' });
      resultados.push(
        updError
          ? { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'error', mensaje: updError.message }
          : { id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'aplicado' }
      );
    } else {
      resultados.push({ id: datosEntrante.id, entity_type: cambio.entity_type, estado: 'aplicado' });
    }
  }

  return NextResponse.json({ resultados }, { headers: corsHeaders });
}