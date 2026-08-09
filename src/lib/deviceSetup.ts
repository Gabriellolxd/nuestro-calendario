// src/lib/deviceSetup.ts
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface DeviceSetupPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAutoStartSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
}

const DeviceSetup = registerPlugin<DeviceSetupPlugin>('DeviceSetup');

export async function estaExentoDeOptimizacionBateria(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const { ignoring } = await DeviceSetup.isIgnoringBatteryOptimizations();
    return ignoring;
  } catch (err) {
    console.error('Error revisando optimización de batería:', err);
    return false;
  }
}

export async function solicitarExencionBateria() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DeviceSetup.requestIgnoreBatteryOptimizations();
  } catch (err) {
    console.error('Error solicitando exención de batería:', err);
  }
}

export async function abrirInicioAutomatico() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DeviceSetup.openAutoStartSettings();
  } catch (err) {
    console.error('Error abriendo ajustes de inicio automático:', err);
  }
}