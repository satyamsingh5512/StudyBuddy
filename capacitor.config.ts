import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studybuddy.app',
  appName: 'StudyBuddy',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For development, uncomment the following to connect to local server
    // url: 'http://10.0.2.2:5173', // Android emulator
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6366f1',
      showSpinner: false,
    },
  },
};

export default config;
