import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { OSM_LEAFLET_HTML, serializeMapPayload } from '@/components/osm-leaflet-html';
import type { OsmMapViewProps, OsmMapViewRef } from '@/components/osm-map-types';

export const OsmMapView = forwardRef<OsmMapViewRef, OsmMapViewProps>(function OsmMapView(
  { style, region, vehicles, onVehiclePress },
  ref
) {
  const webRef = useRef<WebView>(null);
  const loadedRef = useRef(false);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const pushPayload = useCallback((r: (typeof region), v: (typeof vehicles)) => {
    if (!loadedRef.current) return;
    const str = serializeMapPayload(r, v);
    const injected = `try{window.__osmReceive(${JSON.stringify(str)});}catch(e){}true;`;
    webRef.current?.injectJavaScript(injected);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, vehiclesOverride) => {
        const v = vehiclesOverride ?? vehiclesRef.current;
        pushPayload(r, v);
      },
    }),
    [pushPayload]
  );

  useEffect(() => {
    pushPayload(region, vehicles);
  }, [region, vehicles, pushPayload]);

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
        pushPayload(region, vehicles);
      }}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data) as { type?: string; id?: string };
          if (msg.type === 'vehicle' && msg.id) onVehiclePress(msg.id);
        } catch {
          /* ignore */
        }
      }}
    />
  );
});
