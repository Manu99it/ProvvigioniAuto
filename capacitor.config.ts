import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emanu.provvigioniauto',
  appName: 'Provvigioni',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 500,
    },
  },
};

export default config;
