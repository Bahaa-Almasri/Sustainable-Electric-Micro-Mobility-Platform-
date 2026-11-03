import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

type Props = {
  title: string;
  titleColor?: string;
  /** Card background behind grouped rows. */
  surfaceColor: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When false, section is hidden (e.g. search filter). */
  visible?: boolean;
};

export function SettingsSection({ title, titleColor, surfaceColor, children, footer, visible = true }: Props) {
  const { c } = useWayfinder();
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[Type.label, styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor: c.line }]}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    marginLeft: 8,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
