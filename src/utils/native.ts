import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

export const requestPermissions = async () => {
  if (!isNative) return true;
  
  try {
    const geoStatus = await Geolocation.checkPermissions();
    if (geoStatus.location !== 'granted') {
      await Geolocation.requestPermissions();
    }

    const notifStatus = await LocalNotifications.checkPermissions();
    if (notifStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    
    return true;
  } catch (error) {
    console.error("Error requesting permissions", error);
    return false;
  }
};

export const vibrate = async (style: ImpactStyle = ImpactStyle.Heavy) => {
  if (!isNative) {
    if (navigator.vibrate) navigator.vibrate(200);
    return;
  }
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.error(e);
  }
};

export const showNativeNotification = async (title: string, body: string) => {
  if (!isNative) {
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, { body, icon: '/app-logo.png', badge: '/app-logo.png', vibrate: [200, 100, 200] });
        });
    }
    return;
  }
  
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: new Date().getTime(),
          schedule: { at: new Date(Date.now() + 100) },
          sound: null,
          attachments: undefined,
          actionTypeId: "",
          extra: null
        }
      ]
    });
  } catch (e) {
    console.error("LocalNotification error", e);
  }
};

export const getCurrentPosition = async (): Promise<{ lat: number; lng: number } | null> => {
  if (!isNative) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  try {
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
    return {
      lat: coordinates.coords.latitude,
      lng: coordinates.coords.longitude
    };
  } catch (error) {
    console.error("Capacitor Geolocation error", error);
    return null;
  }
};
