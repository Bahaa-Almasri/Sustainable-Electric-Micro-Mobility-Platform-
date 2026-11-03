import { StyleSheet, Switch, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

export type ToggleRowProps = {
  title: string;
  subtitle?: string;
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
  value,
  onValueChange,
  visible = true,
  disabled = false,
  isLast,
  divider = true,
  colors,
}: ToggleRowProps) {
  const { c } = useWayfinder();
  if (!visible) return null;

  return (
    <View>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
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
          trackColor={{ false: c.line, true: c.accent }}
          thumbColor={c.surface}
          ios_backgroundColor={c.line}
          accessibilityLabel={title}
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
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 48,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingRight: 8,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
  },
  hairline: {
    height: 1,
    marginHorizontal: 16,
  },
});
