import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { OSM_LEAFLET_HTML, serializeMapPayload } from '@/components/osm-leaflet-html';
import type { OsmMapViewProps, OsmMapViewRef } from '@/components/osm-map-types';

/**
 * Web: `react-native-webview` is not supported on RN-web; use an iframe with the same Leaflet document.
 */
export const OsmMapView = forwardRef<OsmMapViewRef, OsmMapViewProps>(function OsmMapView(
  { style, region, vehicles, onVehiclePress },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const pushPayload = useCallback((r: (typeof region), v: (typeof vehicles)) => {
    if (!loadedRef.current) return;
    const payload = serializeMapPayload(r, v);
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ __osmUpdate: payload }, '*');
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

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (iframeRef.current?.contentWindow && ev.source !== iframeRef.current.contentWindow) {
        return;
      }
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data) as { type?: string; id?: string };
        if (msg.type === 'vehicle' && msg.id) onVehiclePress(msg.id);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onVehiclePress]);

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={OSM_LEAFLET_HTML}
        title="Vehicle map"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        } as React.CSSProperties}
        onLoad={() => {
          loadedRef.current = true;
          pushPayload(region, vehicles);
        }}
      />
    </View>
  );
});
