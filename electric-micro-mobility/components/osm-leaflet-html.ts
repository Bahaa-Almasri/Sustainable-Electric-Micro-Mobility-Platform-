import type { MapCameraRegion } from './osm-map-types';
import type { VehicleWithState } from '@/types/entities';

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
      var markersLayer = L.layerGroup().addTo(map);
      function sendVehicleToHost(id) {
        var payload = JSON.stringify({ type: 'vehicle', id: id });
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
      function setMarkers(vehicles) {
        markersLayer.clearLayers();
        if (!vehicles || !vehicles.length) return;
        vehicles.forEach(function (v) {
          if (v.lat == null || v.lng == null) return;
          var m = L.circleMarker([v.lat, v.lng], {
            radius: 10,
            fillColor: '#FF4B41',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.95
          });
          m.on('click', function () {
            if (v.vehicle_id) sendVehicleToHost(v.vehicle_id);
          });
          m.addTo(markersLayer);
        });
      }
      function applyPayload(payload) {
        if (payload.region) fitRegion(payload.region);
        if (payload.vehicles) setMarkers(payload.vehicles);
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

export function serializeMapPayload(region: MapCameraRegion, vehicles: VehicleWithState[]) {
  const markers = vehicles
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({
      vehicle_id: v.vehicle_id,
      lat: v.lat,
      lng: v.lng,
    }));
  return JSON.stringify({
    action: 'update',
    region: {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    },
    vehicles: markers,
  });
}
