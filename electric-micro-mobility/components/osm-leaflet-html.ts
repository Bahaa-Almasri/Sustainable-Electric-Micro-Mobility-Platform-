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
    .station-marker-wrap {
      width: 44px;
      height: 44px;
      position: relative;
      transform: translate(-22px, -42px);
    }
    .station-marker-pin {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      background: linear-gradient(135deg, #D90429, #1B4332);
      border: 2px solid rgba(255,255,255,0.95);
      box-shadow: 0 8px 20px rgba(17, 24, 28, 0.25);
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .station-marker-pin.parking-mode {
      background: linear-gradient(135deg, #11181C, #FF4B41);
      border-color: rgba(255,255,255,0.92);
    }
    .station-marker-badge {
      position: absolute;
      top: -5px;
      right: -6px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      background: #FF4B41;
      border: 2px solid #fff;
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 800;
      line-height: 16px;
      text-align: center;
      box-shadow: 0 6px 12px rgba(17, 24, 28, 0.2);
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
      function stationIcon(station) {
        var mode = payloadStationMarkerMode || 'browse';
        var isParking = mode === 'parking';
        var letter = isParking ? 'P' : 'S';
        var badgeText = '';
        if (isParking) {
          var ps = station.available_parking_spots;
          if (typeof ps === 'number' && ps > 0) badgeText = String(ps);
        } else {
          var av = station.available_vehicles;
          if (typeof av === 'number' && av > 0) badgeText = String(av);
        }
        var pinClass = 'station-marker-pin' + (isParking ? ' parking-mode' : '');
        return L.divIcon({
          className: '',
          html:
            '<div class="station-marker-wrap">' +
            '<div class="' + pinClass + '">' + letter + '</div>' +
            (badgeText ? ('<div class="station-marker-badge">' + badgeText + '</div>') : '') +
            '</div>',
          iconSize: [44, 44],
          iconAnchor: [22, 42],
          popupAnchor: [0, -42]
        });
      }
      var payloadStationMarkerMode = 'browse';
      var payloadRideMode = false;
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
          fillColor: ride ? '#FF4B41' : '#2B7FFF',
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
