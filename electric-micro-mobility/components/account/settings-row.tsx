import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export type SettingsRowProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  /** When false, row is omitted (e.g. search). */
  visible?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
  right?: ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'new' | 'recommended';
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
  icon,
  iconColor,
  onPress,
  visible = true,
  showChevron = true,
  disabled = false,
  right,
  badge,
  badgeVariant = 'default',
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
      {icon ? (
        <View style={[styles.iconCircle, { backgroundColor: `${iconColor ?? '#FF4B41'}18` }]}>
          <Ionicons name={icon} size={18} color={iconColor ?? '#FF4B41'} />
        </View>
      ) : null}
      <View style={styles.textCol}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {badge ? (
            <View
              style={[
                styles.badge,
                badgeVariant === 'new' && styles.badgeNew,
                badgeVariant === 'recommended' && styles.badgeRec,
              ]}>
              <Text style={styles.badgeText}>{badge}</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowFirst: {},
  rowLast: {},
  pressed: {
    opacity: 0.92,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.92,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    marginLeft: 2,
    opacity: 0.85,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,75,65,0.12)',
  },
  badgeNew: {
    backgroundColor: 'rgba(33,150,243,0.14)',
  },
  badgeRec: {
    backgroundColor: 'rgba(76,175,80,0.14)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#C62828',
  },
});
