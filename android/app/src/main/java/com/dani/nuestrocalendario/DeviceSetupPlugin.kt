package com.dani.nuestrocalendario

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DeviceSetup")
class DeviceSetupPlugin : Plugin() {

    @PluginMethod
    fun isIgnoringBatteryOptimizations(call: PluginCall) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val ignoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }
        val ret = JSObject()
        ret.put("ignoring", ignoring)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestIgnoreBatteryOptimizations(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                intent.data = Uri.parse("package:" + context.packageName)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo abrir el ajuste de batería", e)
        }
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.data = Uri.parse("package:" + context.packageName)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo abrir los ajustes de la app", e)
        }
    }

    // No existe una API estándar de Android para "inicio automático" — cada
    // fabricante lo esconde en una pantalla propia. Se intenta cada una
    // conocida y, si ninguna existe en este teléfono, se cae a los
    // ajustes generales de la app.
    @PluginMethod
    fun openAutoStartSettings(call: PluginCall) {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val intents = mutableListOf<Intent>()

        when {
            manufacturer.contains("xiaomi") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"
                )))
            }
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                )))
                intents.add(Intent().setComponent(ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.optimize.process.ProtectActivity"
                )))
            }
            manufacturer.contains("oppo") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                )))
                intents.add(Intent().setComponent(ComponentName(
                    "com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"
                )))
            }
            manufacturer.contains("vivo") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                )))
            }
            manufacturer.contains("samsung") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.ui.battery.BatteryActivity"
                )))
            }
            manufacturer.contains("asus") -> {
                intents.add(Intent().setComponent(ComponentName(
                    "com.asus.mobilemanager",
                    "com.asus.mobilemanager.autostart.AutoStartActivity"
                )))
            }
        }

        val pm = context.packageManager
        for (intent in intents) {
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            if (intent.resolveActivity(pm) != null) {
                try {
                    context.startActivity(intent)
                    call.resolve()
                    return
                } catch (e: SecurityException) {
                    // MIUI bloquea este intent en versiones recientes — se
                    // intenta la siguiente opción conocida, si existe.
                } catch (e: Exception) {
                    // continúa con la siguiente
                }
            }
        }

        openAppSettings(call)
    }
}