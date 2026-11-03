import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily } from '@/constants/theme';

export type SettingsRowProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** When false, row is omitted (e.g. search). */
  visible?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
  right?: ReactNode;
  badge?: string;
  isFirst?: boolean;
  isLast?: boolean;
  divider?: boolean;
  colors: {
    text: string;
    muted: string;
    divider: string;
    cardBg: string;
  };
  style?: StyleProp<ViewStyle>;
};

export function SettingsRow({
  title,
  subtitle,
  onPress,
  visible = true,
  showChevron = true,
  disabled = false,
  right,
  badge,
  isFirst,
  isLast,
  divider = true,
  colors,
  style,
}: SettingsRowProps) {
  if (!visible) return null;

  const content = (
    <View
      style={[
        styles.row,
        { backgroundColor: 'transparent' },
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        style,
      ]}>
      <View style={styles.textCol}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {badge ? (
            <View style={[styles.badge, { borderColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.muted }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {right}
        {showChevron && onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} style={styles.chevron} />
        ) : null}
      </View>
    </View>
  );

  const underlay =
    divider && !isLast ? <View style={[styles.hairline, { backgroundColor: colors.divider }]} /> : null;

  if (onPress && !disabled) {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.pressed]}>
          {content}
        </Pressable>
        {underlay}
      </View>
    );
  }

  return (
    <View>
      {content}
      {underlay}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 48,
  },
  rowFirst: {},
  rowLast: {},
  pressed: {
    opacity: 0.8,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    flexShrink: 1,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    marginLeft: 2,
  },
  hairline: {
    height: 1,
    marginHorizontal: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
});
