Place dedicated vehicle hero images here:

- `scooter.png`
- `bike.png`
- `ebike.png`

Then wire them in `lib/vehicle-image-map.ts`:

```ts
const VEHICLE_IMAGE_MAP = {
  scooter: require('@/assets/vehicles/scooter.png'),
  bike: require('@/assets/vehicles/bike.png'),
  ebike: require('@/assets/vehicles/ebike.png'),
};
```
