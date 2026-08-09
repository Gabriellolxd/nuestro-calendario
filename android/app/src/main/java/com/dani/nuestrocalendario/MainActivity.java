package com.dani.nuestrocalendario;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceSetupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}