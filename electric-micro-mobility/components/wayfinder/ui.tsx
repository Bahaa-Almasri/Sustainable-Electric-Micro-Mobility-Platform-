import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

type ButtonVariant = 'primary' | 'secondary' | 'inverse' | 'text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  radius?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Pushes the label and trailing icon to opposite ends. */
  spread?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  height = 56,
  radius = 18,
  leading,
  trailing,
  spread = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { c } = useWayfinder();
  const colors = {
    primary: { bg: c.accent, fg: c.onAccent, border: 'transparent' },
    secondary: { bg: 'transparent', fg: c.text, border: c.text },
    inverse: { bg: c.inverse, fg: c.inverseText, border: 'transparent' },
    text: { bg: 'transparent', fg: c.accentText, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          borderRadius: radius,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          justifyContent: spread ? 'space-between' : 'center',
          paddingHorizontal: spread ? 22 : 12,
          opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <>
          {leading}
          <Text style={[Type.button, { color: colors.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: ReactNode;
  onPress: () => void;
  label: string;
  variant?: 'outline' | 'inverse' | 'line';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon, onPress, label, variant = 'outline', size = 44, style }: IconButtonProps) {
  const { c } = useWayfinder();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.8 : 1 },
        variant === 'inverse'
          ? { backgroundColor: c.inverse }
          : { borderWidth: 1.5, borderColor: variant === 'line' ? c.line : c.text },
        style,
      ]}>
      {icon}
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const { c } = useWayfinder();
  return (
    <IconButton label="Back" onPress={onPress} icon={<Ionicons name="arrow-back" size={22} color={c.text} />} />
  );
}

type FieldProps = TextInputProps & { label: string; style?: StyleProp<ViewStyle> };

/** Uppercase label over a bottom line that thickens on focus. */
export function Field({ label, style, onFocus, onBlur, ...input }: FieldProps) {
  const { c } = useWayfinder();
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      <Text style={[Type.label, { color: c.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          Type.input,
          styles.input,
          input.multiline && styles.inputMultiline,
          { color: c.text, borderBottomColor: focused ? c.text : c.line, borderBottomWidth: focused ? 2 : 1.5 },
        ]}
      />
    </View>
  );
}

export function DashedLine({ color, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useWayfinder();
  return (
    <View style={[styles.dashed, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width="100%" height={2}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={color ?? c.line} strokeWidth={2} strokeDasharray="6 5" />
      </Svg>
    </View>
  );
}

export function StatusPill({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  const { c } = useWayfinder();
  return (
    <View
      style={[
        styles.pill,
        filled ? { backgroundColor: color, borderColor: color } : { borderColor: color },
      ]}>
      <Text style={[styles.pillText, { color: filled ? c.onAccent : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useWayfinder();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

/** Page title with room for the status bar. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { c } = useWayfinder();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: top + 16 }]}>
      <Text style={[Type.pageTitle, { color: c.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[styles.headerSub, { color: c.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useWayfinder();
  return (
    <View style={style}>
      <Text style={[Type.sectionTitle, { color: c.text }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

export function EmptyNote({ text }: { text: string }) {
  const { c } = useWayfinder();
  return <Text style={[styles.empty, { color: c.muted }]}>{text}</Text>;
}

type UnderlineTabsProps<T extends string> = {
  options: { label: string; value: T }[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function UnderlineTabs<T extends string>({ options, value, onChange, style }: UnderlineTabsProps<T>) {
  const { c } = useWayfinder();
  return (
    <View style={[styles.tabs, { borderBottomColor: c.line }, style]} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.tab, active && { borderBottomColor: c.accent }]}>
            <Text style={[styles.tabText, { color: active ? c.text : c.muted }, active && styles.tabTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

type DialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  onRequestClose: () => void;
  actions: DialogAction[];
  children?: ReactNode;
  /**
   * Render over the screen instead of in a native Modal. Use right after closing another modal:
   * iOS can leave an invisible, touch-blocking layer when modals are swapped in the same tick.
   */
  inline?: boolean;
};

/** Centered confirmation or result card, used in place of the older per-screen dialogs. */
export function Dialog({ visible, title, message, onRequestClose, actions, children, inline = false }: DialogProps) {
  const { c } = useWayfinder();
  const body = (
      <View style={[inline ? styles.inlineBackdrop : styles.backdrop, { backgroundColor: c.backdrop }]}>
        <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[Type.sectionTitle, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text style={[styles.dialogMessage, { color: c.muted }]}>{message}</Text> : null}
          {children}
          <View style={styles.dialogActions}>
            {actions.map((a) => (
              <Button
                key={a.label}
                label={a.label}
                onPress={a.onPress}
                variant={a.variant}
                loading={a.loading}
                disabled={a.disabled}
                height={50}
                radius={16}
                style={styles.flex}
              />
            ))}
          </View>
        </View>
      </View>
  );
  if (inline) return visible ? body : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 0 },
  inputMultiline: { minHeight: 66, textAlignVertical: 'top' },
  dashed: { height: 2, overflow: 'hidden' },
  pill: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: FontFamily.bold, fontSize: 12 },
  card: { borderRadius: 20, borderWidth: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 14 },
  headerSub: { fontFamily: FontFamily.regular, fontSize: 16, marginTop: 8 },
  empty: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  tabs: { flexDirection: 'row', gap: 22, borderBottomWidth: 1 },
  tab: { height: 40, justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent', marginBottom: -1 },
  tabText: { fontFamily: FontFamily.semibold, fontSize: 15 },
  tabTextActive: { fontFamily: FontFamily.bold },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  inlineBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
  },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 26, borderWidth: 1, padding: 22, gap: 10 },
  dialogMessage: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
  dialogActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
