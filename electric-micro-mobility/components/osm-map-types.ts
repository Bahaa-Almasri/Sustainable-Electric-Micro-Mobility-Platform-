import type { VehicleWithState } from '@/types/entities';

export type MapCameraRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type OsmMapViewRef = {
  animateToRegion: (region: MapCameraRegion, vehicles?: VehicleWithState[]) => void;
};

export type OsmMapViewProps = {
  style?: object;
  region: MapCameraRegion;
  vehicles: VehicleWithState[];
  onVehiclePress: (vehicleId: string) => void;
};
