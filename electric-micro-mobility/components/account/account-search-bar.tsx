import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { FontFamily } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  colors: {
    text: string;
    muted: string;
  };
};

export function AccountSearchBar({ value, onChangeText, placeholder = 'Search settings', colors }: Props) {
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.text }]}>
      <Ionicons name="search" size={18} color={colors.text} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderBottomWidth: 1.5,
    marginHorizontal: 8,
    marginBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    paddingVertical: 0,
  },
});
