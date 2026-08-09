package com.dani.nuestrocalendario;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // IMPORTANTE: registerPlugin debe ir DESPUÉS de super.onCreate
        registerPlugin(DeviceSetupPlugin.class);
    }
}