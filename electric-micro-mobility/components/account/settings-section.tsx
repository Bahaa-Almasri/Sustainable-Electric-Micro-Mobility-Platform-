import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cardShadow } from '@/components/account/account-theme';

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
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: surfaceColor }]}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
    marginLeft: 4,
    opacity: 0.75,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
