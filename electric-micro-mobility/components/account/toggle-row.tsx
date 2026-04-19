import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/components/account/account-theme';

export type ToggleRowProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  visible?: boolean;
  disabled?: boolean;
  isLast?: boolean;
  divider?: boolean;
  colors: {
    text: string;
    muted: string;
    divider: string;
    cardBg: string;
  };
};

export function ToggleRow({
  title,
  subtitle,
  icon,
  iconColor,
  value,
  onValueChange,
  visible = true,
  disabled = false,
  isLast,
  divider = true,
  colors,
}: ToggleRowProps) {
  if (!visible) return null;

  return (
    <View>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        {icon ? (
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor ?? ACCENT}18` }]}>
            <Ionicons name={icon} size={18} color={iconColor ?? ACCENT} />
          </View>
        ) : null}
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: 'rgba(120,120,128,0.28)', true: 'rgba(255, 75, 65, 0.45)' }}
          thumbColor={value ? ACCENT : '#f4f3f4'}
          ios_backgroundColor="rgba(120,120,128,0.28)"
        />
      </View>
      {divider && !isLast ? (
        <View style={[styles.hairline, { backgroundColor: colors.divider }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
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
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
});
