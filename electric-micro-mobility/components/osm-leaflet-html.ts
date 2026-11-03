import type { MapCameraRegion, MapUserLocation, StationMarkerMode } from './osm-map-types';
import type { StationRow } from '@/types/entities';

/** OSM-derived raster tiles (Leaflet) — no Google / Apple map SDK. */
export const OSM_LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body { margin:0; padding:0; height:100%; width:100%; overflow:hidden; }
    #map { position:absolute; top:0; left:0; right:0; bottom:0; }
    .leaflet-control-attribution { font-size:10px; max-width:50%; white-space:normal; }
    .leaflet-top.leaflet-left { top: 112px; }
    body.ride .leaflet-control-zoom { display: none; }
    body { --surface:#FAF9F6; --text:#121212; --muted:#5E5B55; --accent:#FF4B41; --on-accent:#121212; --halo:rgba(255,75,65,0.22); background:#E7E4DD; }
    body.dark { --surface:#1C1B19; --text:#F1EFEA; --muted:#A39F97; --accent:#FF5A4F; --halo:rgba(255,90,79,0.25); background:#181816; }
    body.dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.82) contrast(0.86) saturate(0.55); }
    body.dark .leaflet-container { background:#181816; }
    .station-pin {
      box-sizing: border-box;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--surface);
      border: 2.5px solid var(--text);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      position: relative;
    }
    .station-pin.empty { border-style: dashed; border-color: var(--muted); color: var(--muted); }
    .station-pin.selected {
      width: 48px;
      height: 48px;
      margin: -7px 0 0 -7px;
      background: var(--accent);
      border: 0;
      color: var(--on-accent);
      font-size: 20px;
      box-shadow: 0 0 0 8px var(--halo);
    }
    .station-pin.parking { background: var(--text); color: var(--surface); }
    .station-pin-badge {
      position: absolute;
      top: -7px;
      right: -9px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: 9px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 11px;
      line-height: 18px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var DEFAULT_CENTER = [40.7128, -74.006];
      var DEFAULT_ZOOM = 13;
      var map = L.map('map', { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
      var stationsLayer = L.layerGroup().addTo(map);
      var userLayer = L.layerGroup().addTo(map);
      function sendStationToHost(id) {
        var payload = JSON.stringify({ type: 'station', id: id });
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(payload);
          }
        } catch (e) {}
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
          }
        } catch (e) {}
      }
      function finiteNumber(value) {
        return typeof value === 'number' && isFinite(value);
      }
      function fitRegion(region) {
        if (!region) return;
        if (!finiteNumber(region.latitude) || !finiteNumber(region.longitude)) return;
        var lat = region.latitude, lng = region.longitude;
        var latd = finiteNumber(region.latitudeDelta) && region.latitudeDelta > 0 ? region.latitudeDelta : 0.06;
        var lngd = finiteNumber(region.longitudeDelta) && region.longitudeDelta > 0 ? region.longitudeDelta : 0.06;
        var south = lat - latd / 2, north = lat + latd / 2;
        var west = lng - lngd / 2, east = lng + lngd / 2;
        try {
          map.fitBounds([[south, west], [north, east]], { animate: true, padding: [16, 16], maxZoom: 17 });
        } catch (e) {
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }
      }
      var payloadStationMarkerMode = 'browse';
      var payloadRideMode = false;
      var payloadSelectedStationId = null;
      function stationIcon(station) {
        var isParking = (payloadStationMarkerMode || 'browse') === 'parking';
        var classes = 'station-pin';
        var label = '';
        var badge = '';
        if (isParking) {
          classes += ' parking';
          label = 'P';
          var spots = station.available_parking_spots;
          if (typeof spots === 'number' && spots > 0) badge = '<div class="station-pin-badge">' + spots + '</div>';
        } else {
          var available = typeof station.available_vehicles === 'number' ? station.available_vehicles : 0;
          label = String(available);
          if (available === 0) classes += ' empty';
          if (station.station_id === payloadSelectedStationId) classes += ' selected';
        }
        return L.divIcon({
          className: '',
          html: '<div class="' + classes + '">' + label + badge + '</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
      }
      function setStations(stations) {
        stationsLayer.clearLayers();
        if (!stations || !stations.length) return;
        stations.forEach(function (s) {
          if (s.lat == null || s.lng == null) return;
          var m = L.marker([s.lat, s.lng], { icon: stationIcon(s) });
          m.on('click', function () {
            if (s.station_id) sendStationToHost(s.station_id);
          });
          m.addTo(stationsLayer);
        });
      }
      function setUserLocation(userLocation) {
        userLayer.clearLayers();
        if (!userLocation) return;
        if (!finiteNumber(userLocation.latitude) || !finiteNumber(userLocation.longitude)) return;
        var ride = !!payloadRideMode;
        L.circleMarker([userLocation.latitude, userLocation.longitude], {
          radius: ride ? 10 : 8,
          fillColor: ride ? '#FF4B41' : (document.body.classList.contains('dark') ? '#6E97FF' : '#2F6BFF'),
          color: '#FFFFFF',
          weight: ride ? 3 : 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(userLayer);
      }
      function applyPayload(payload) {
        // Only recenter/zoom when explicitly requested (e.g. refresh). Routine GPS
        // updates send userLocation without fitCamera — otherwise watchPositionAsync
        // retriggers fitBounds every few seconds and the map looks like it “refreshes”.
        if (payload.fitCamera && payload.region) fitRegion(payload.region);
        if (payload.stationMarkerMode === 'parking' || payload.stationMarkerMode === 'browse') {
          payloadStationMarkerMode = payload.stationMarkerMode;
        }
        payloadRideMode = payload.rideMode === true;
        payloadSelectedStationId = payload.selectedStationId || null;
        document.body.classList.toggle('dark', payload.isDark === true);
        document.body.classList.toggle('ride', payloadRideMode);
        if (payload.stations) setStations(payload.stations);
        setUserLocation(payload.userLocation || null);
      }
      window.__mapReady = false;
      window.__osmPending = null;
      window.__osmReceive = function (jsonStr) {
        try {
          if (!window.__mapReady) {
            window.__osmPending = jsonStr;
            return;
          }
          applyPayload(JSON.parse(jsonStr));
        } catch (e) {}
      };
      window.addEventListener('message', function (ev) {
        try {
          var d = ev.data;
          if (d && typeof d === 'object' && d != null && typeof d.__osmUpdate === 'string') {
            window.__osmReceive(d.__osmUpdate);
          }
        } catch (e) {}
      });
      map.whenReady(function () {
        window.__mapReady = true;
        map.invalidateSize();
        if (window.__osmPending) {
          window.__osmReceive(window.__osmPending);
          window.__osmPending = null;
        }
      });
      window.addEventListener('resize', function () {
        map.invalidateSize();
      });
    })();
  </script>
</body>
</html>`;

export type MapPayloadOptions = {
  /** When true, Leaflet fits bounds to `region`. Use for first paint and explicit recenter (refresh). */
  fitCamera?: boolean;
  stationMarkerMode?: StationMarkerMode;
  /** Active ride map: stronger user location styling. */
  rideMode?: boolean;
  isDark?: boolean;
  selectedStationId?: string | null;
};

export function serializeMapPayload(
  region: MapCameraRegion,
  stations: StationRow[],
  userLocation: MapUserLocation | null,
  options?: MapPayloadOptions
) {
  const markers = stations
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      station_id: s.station_id,
      lat: s.lat,
      lng: s.lng,
      available_vehicles: s.available_vehicles,
      available_parking_spots: s.available_parking_spots ?? null,
    }));
  return JSON.stringify({
    action: 'update',
    fitCamera: options?.fitCamera === true,
    stationMarkerMode: options?.stationMarkerMode ?? 'browse',
    rideMode: options?.rideMode === true,
    isDark: options?.isDark === true,
    selectedStationId: options?.selectedStationId ?? null,
    region: {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    },
    stations: markers,
    userLocation: userLocation
      ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }
      : null,
  });
}
