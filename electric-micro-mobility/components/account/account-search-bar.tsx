import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  colors: {
    text: string;
    muted: string;
    searchBg: string;
  };
};

export function AccountSearchBar({ value, onChangeText, placeholder = 'Search settings', colors }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.searchBg }]}>
      <Ionicons name="search" size={18} color={colors.muted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  icon: {
    opacity: 0.85,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
});
