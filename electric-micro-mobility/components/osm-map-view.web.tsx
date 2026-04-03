import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { OSM_LEAFLET_HTML, serializeMapPayload } from '@/components/osm-leaflet-html';
import type { OsmMapViewProps, OsmMapViewRef } from '@/components/osm-map-types';

/**
 * Web: `react-native-webview` is not supported on RN-web; use an iframe with the same Leaflet document.
 */
export const OsmMapView = forwardRef<OsmMapViewRef, OsmMapViewProps>(function OsmMapView(
  { style, region, stations, userLocation, onStationPress, stationMarkerMode = 'browse' },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const rideMode = stationMarkerMode === 'parking';

  const pushPayload = useCallback(
    (r: typeof region, s: typeof stations, loc: typeof userLocation, fitCamera: boolean) => {
      if (!loadedRef.current) return;
      const payload = serializeMapPayload(r, s, loc, { fitCamera, stationMarkerMode, rideMode });
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ __osmUpdate: payload }, '*');
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
    [pushPayload]
  );

  useEffect(() => {
    pushPayload(region, stations, userLocation, false);
  }, [region, stations, userLocation, stationMarkerMode, rideMode, pushPayload]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (iframeRef.current?.contentWindow && ev.source !== iframeRef.current.contentWindow) {
        return;
      }
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data) as { type?: string; id?: string };
        if (msg.type === 'station' && msg.id) onStationPress(msg.id);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onStationPress]);

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={OSM_LEAFLET_HTML}
        title="Station map"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        } as React.CSSProperties}
        onLoad={() => {
          loadedRef.current = true;
          pushPayload(region, stations, userLocation, true);
        }}
      />
    </View>
  );
});
