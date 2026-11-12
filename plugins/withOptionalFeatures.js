/**
 * Camera (QR scanner) and fingerprint (group lock) are extras: scanning has
 * "Type a code instead" and the lock falls back to the screen PIN. Without
 * saying so, Android reads the CAMERA and USE_FINGERPRINT permissions as
 * "this app needs a rear camera and a fingerprint sensor", and Play hides
 * the app from devices without them (most Chromebooks, car screens, some
 * tablets). Each feature is declared here as not required.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = [
  'android.hardware.camera',
  'android.hardware.camera.any',
  'android.hardware.camera.autofocus',
  'android.hardware.fingerprint',
];

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    for (const name of OPTIONAL) {
      const existing = features.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = features;
    return config;
  });
};
