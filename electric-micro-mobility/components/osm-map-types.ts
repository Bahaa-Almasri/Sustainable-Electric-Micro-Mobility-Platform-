import type { StationRow } from '@/types/entities';

export type MapCameraRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type OsmMapViewRef = {
  animateToRegion: (region: MapCameraRegion, stations?: StationRow[], userLocation?: MapUserLocation | null) => void;
};

export type MapUserLocation = {
  latitude: number;
  longitude: number;
};

export type StationMarkerMode = 'browse' | 'parking';

export type OsmMapViewProps = {
  style?: object;
  region: MapCameraRegion;
  stations: StationRow[];
  userLocation: MapUserLocation | null;
  onStationPress: (stationId: string) => void;
  /** Browse: badge = available vehicles. Parking: badge = free parking spots; pin shows P. */
  stationMarkerMode?: StationMarkerMode;
};
