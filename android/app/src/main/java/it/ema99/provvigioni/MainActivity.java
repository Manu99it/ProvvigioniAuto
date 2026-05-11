package it.ema99.provvigioni;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        
        // Abilita edge-to-edge per la navbar trasparente
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setVerticalScrollBarEnabled(false);
            bridge.getWebView().setHorizontalScrollBarEnabled(false);
        }
    }
}
