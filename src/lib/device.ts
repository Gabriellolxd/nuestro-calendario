// src/lib/device.ts

import { supabase } from './supabase';

const DEVICE_ID_KEY = 'device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function ensureDeviceRegistered(userId: string, label: string = 'Mi teléfono') {
  const deviceId = getDeviceId();

  const { data: existing, error: fetchError } = await supabase
    .from('devices')
    .select('device_id')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    const { error: insertError } = await supabase
      .from('devices')
      .insert({ device_id: deviceId, user_id: userId, label });
    if (insertError) throw insertError;
  }

  return deviceId;
}