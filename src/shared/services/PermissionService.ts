import {Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

class PermissionServiceClass {
  /**
   * Checks if read access to photos/media library is granted.
   * Handles iOS (PHOTO_LIBRARY), Android 13+ (READ_MEDIA_IMAGES), and Android <13 (READ_EXTERNAL_STORAGE).
   */
  async hasImagePermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const res = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return res === RESULTS.GRANTED || res === RESULTS.LIMITED;
    }

    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const res = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        return res === RESULTS.GRANTED;
      }
      const res = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return res === RESULTS.GRANTED;
    }

    return true;
  }

  /**
   * Checks if read access to video media library is granted.
   */
  async hasVideoPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const res = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return res === RESULTS.GRANTED || res === RESULTS.LIMITED;
    }

    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const res = await check(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        return res === RESULTS.GRANTED;
      }
      const res = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return res === RESULTS.GRANTED;
    }

    return true;
  }

  /**
   * Prompts user for image access permission. Returns true if granted or limited.
   */
  async ensureImagePermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const res = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return res === RESULTS.GRANTED || res === RESULTS.LIMITED;
    }

    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const res = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        return res === RESULTS.GRANTED;
      }
      const res = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return res === RESULTS.GRANTED;
    }

    return true;
  }

  /**
   * Prompts user for video access permission. Returns true if granted or limited.
   */
  async ensureVideoPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const res = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return res === RESULTS.GRANTED || res === RESULTS.LIMITED;
    }

    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const res = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        return res === RESULTS.GRANTED;
      }
      const res = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return res === RESULTS.GRANTED;
    }

    return true;
  }

  /**
   * Prompts for both photo and video library access permissions.
   * Resolves true if media access is available.
   */
  async ensureMediaPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const res = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return res === RESULTS.GRANTED || res === RESULTS.LIMITED;
    }

    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const img = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        const vid = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        return img === RESULTS.GRANTED || vid === RESULTS.GRANTED;
      }
      const res = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return res === RESULTS.GRANTED;
    }

    return true;
  }
}

export const PermissionService = new PermissionServiceClass();
