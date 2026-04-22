import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myapp.mobile',
  appName: 'mobile',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      permissions: {
        android: 'ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION',
        ios: 'location'
      },
      requestPermissions: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    }
  }
};

export default config;
