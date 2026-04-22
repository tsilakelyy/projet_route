package com.myapp.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Activer le support du DOM Storage pour la carte
        this.getBridge().getWebView().getSettings().setDomStorageEnabled(true);
        // Activer le support de la géolocalisation
        this.getBridge().getWebView().getSettings().setGeolocationEnabled(true);
        // Activer le support JavaScript
        this.getBridge().getWebView().getSettings().setJavaScriptEnabled(true);
        // Améliorer le rendu de la carte
        this.getBridge().getWebView().getSettings().setRenderPriority(android.webkit.WebSettings.RenderPriority.HIGH);
    }
}
