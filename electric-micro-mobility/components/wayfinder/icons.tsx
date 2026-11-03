import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color: ColorValue; size?: number };

const stroke = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function RouteIcon({ color, size = 22 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={6} cy={5} r={2.5} stroke={c} {...stroke} />
      <Path d="M6 7.5V13a3 3 0 0 0 3 3h6.5" stroke={c} {...stroke} />
      <Circle cx={18} cy={16} r={2.5} stroke={c} {...stroke} />
    </Svg>
  );
}

export function HoldIcon({ color, size = 22 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={13} r={8} stroke={c} {...stroke} />
      <Path d="M12 9v4l2.5 2.5M9 2h6" stroke={c} {...stroke} />
    </Svg>
  );
}

export function TicketIcon({ color, size = 22 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" stroke={c} {...stroke} />
      <Path d="M15 7v10" stroke={c} strokeWidth={2} strokeDasharray="2 2.5" fill="none" />
    </Svg>
  );
}

export function ChatIcon({ color, size = 22 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5h16v11H10l-6 4z" stroke={c} {...stroke} />
    </Svg>
  );
}

export function PersonIcon({ color, size = 22 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={c} {...stroke} />
      <Path d="M4 21a8 8 0 0 1 16 0" stroke={c} {...stroke} />
    </Svg>
  );
}

export function RefreshIcon({ color, size = 20 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 11a8 8 0 1 0-2.3 6.3" stroke={c} {...stroke} strokeWidth={2.2} />
      <Path d="M20 5v6h-6" stroke={c} {...stroke} strokeWidth={2.2} />
    </Svg>
  );
}

export function FiltersIcon({ color, size = 20 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={c} {...stroke} />
      <Circle cx={16} cy={7} r={2} stroke={c} {...stroke} />
      <Circle cx={10} cy={17} r={2} stroke={c} {...stroke} />
    </Svg>
  );
}

export function ScanIcon({ color, size = 20 }: IconProps) {
  const c = String(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"
        stroke={c}
        {...stroke}
        strokeWidth={2.2}
      />
    </Svg>
  );
}
