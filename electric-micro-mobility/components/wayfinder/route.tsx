import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useWayfinder } from '@/hooks/use-wayfinder';

export type StopState = 'upcoming' | 'current' | 'end' | 'open';

type RouteStopProps = {
  state: StopState;
  /** Colour of the line running down to the next stop; omit on the last stop. */
  line?: 'accent' | 'text' | 'dashed';
  /** Center the stop on its content (button rows) instead of aligning to the first line. */
  centered?: boolean;
  dotOffset?: number;
  children: ReactNode;
};

/** One stop on the route line, used by the sign-in form and the active ride timeline. */
export function RouteStop({ state, line, centered = false, dotOffset = 22, children }: RouteStopProps) {
  const { c } = useWayfinder();

  const dot = {
    upcoming: { borderWidth: 2, borderColor: c.accent, backgroundColor: c.bg },
    current: { borderWidth: 2, borderColor: c.accent, backgroundColor: c.accent },
    end: { backgroundColor: c.text },
    open: { borderWidth: 2, borderColor: c.muted, borderStyle: 'dashed', backgroundColor: c.bg },
  }[state];

  return (
    <View style={[styles.row, centered && styles.centered]}>
      <View style={styles.rail}>
        {!centered ? <View style={{ height: dotOffset }} /> : null}
        <View style={[styles.dot, dot as object]} />
        {line === 'dashed' ? (
          <View style={styles.dashedRail}>
            <Svg width={2} height="100%">
              <Line x1="1" y1="0" x2="1" y2="100%" stroke={c.accent} strokeWidth={2} strokeDasharray="4 5" />
            </Svg>
          </View>
        ) : line ? (
          <View style={[styles.line, { backgroundColor: line === 'text' ? c.text : c.accent }]} />
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 18 },
  centered: { alignItems: 'center' },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  line: { flex: 1, width: 2 },
  dashedRail: { flex: 1, width: 2 },
  body: { flex: 1, minWidth: 0 },
});
