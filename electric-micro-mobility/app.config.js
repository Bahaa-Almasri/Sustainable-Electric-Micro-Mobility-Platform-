/**
 * Expo merges this with app.json.
 * Frontend → FastAPI: EXPO_PUBLIC_API_URL or extra.apiBaseUrl
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow location access to show your position and nearby vehicles on the map.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  },
});
