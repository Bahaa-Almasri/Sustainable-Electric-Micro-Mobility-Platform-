import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { OSM_LEAFLET_HTML, serializeMapPayload } from '@/components/osm-leaflet-html';
import type { OsmMapViewProps, OsmMapViewRef } from '@/components/osm-map-types';

export const OsmMapView = forwardRef<OsmMapViewRef, OsmMapViewProps>(function OsmMapView(
  { style, region, stations, userLocation, onStationPress, stationMarkerMode = 'browse' },
  ref
) {
  const webRef = useRef<WebView>(null);
  const loadedRef = useRef(false);
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const rideMode = stationMarkerMode === 'parking';

  const pushPayload = useCallback(
    (r: typeof region, s: typeof stations, loc: typeof userLocation, fitCamera: boolean) => {
      if (!loadedRef.current) return;
      const str = serializeMapPayload(r, s, loc, {
        fitCamera,
        stationMarkerMode,
        rideMode,
      });
      const injected = `try{window.__osmReceive(${JSON.stringify(str)});}catch(e){}true;`;
      webRef.current?.injectJavaScript(injected);
    },
    [stationMarkerMode, rideMode]
  );

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, stationsOverride, userLocationOverride) => {
        const s = stationsOverride ?? stationsRef.current;
        const loc = userLocationOverride ?? userLocationRef.current;
        pushPayload(r, s, loc, true);
      },
    }),
    [pushPayload, stationMarkerMode, rideMode]
  );

  useEffect(() => {
    pushPayload(region, stations, userLocation, false);
  }, [region, stations, userLocation, stationMarkerMode, rideMode, pushPayload]);

  return (
    <WebView
      ref={webRef}
      style={[StyleSheet.absoluteFillObject, style]}
      originWhitelist={['*']}
      source={{ html: OSM_LEAFLET_HTML, baseUrl: 'https://localhost' }}
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={() => {
        loadedRef.current = true;
        pushPayload(region, stations, userLocation, true);
      }}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data) as { type?: string; id?: string };
          if (msg.type === 'station' && msg.id) onStationPress(msg.id);
        } catch {
          /* ignore */
        }
      }}
    />
  );
});
