package it.ema99.provvigioni;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isNightMode() {
        int nightModeFlags = getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    }

    private int getLaunchBackgroundColor() {
        if (isNightMode()) {
            return Color.rgb(8, 47, 73);
        }
        return Color.rgb(240, 249, 255);
    }

    private void applySystemBarIconStyle(Window window) {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(!isNightMode());
        controller.setAppearanceLightNavigationBars(!isNightMode());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Window launchWindow = getWindow();
        launchWindow.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(getLaunchBackgroundColor()));
        applySystemBarIconStyle(launchWindow);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        
        // Abilita edge-to-edge per la navbar trasparente
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setNavigationBarColor(Color.TRANSPARENT);
        applySystemBarIconStyle(window);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            webView.setBackgroundColor(getLaunchBackgroundColor());
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
        }
    }
}
