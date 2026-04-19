import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';

import { cardShadow } from '@/components/account/account-theme';

export type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  visible?: boolean;
};

type Props = {
  actions: QuickAction[];
  colors: {
    text: string;
    muted: string;
    cardBg: string;
    elevatedStroke: string;
  };
};

export function QuickActionsRow({ actions, colors }: Props) {
  const list = actions.filter((a) => a.visible !== false);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.muted }]}>QUICK ACTIONS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {list.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.chip,
              cardShadow,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.elevatedStroke,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.label}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.text}0D` }]}>
              <Ionicons name={a.icon} size={18} color={colors.text} />
            </View>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    gap: 10,
  },
  heading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginLeft: 4,
  },
  scroll: {
    gap: 10,
    paddingRight: 4,
    paddingLeft: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
