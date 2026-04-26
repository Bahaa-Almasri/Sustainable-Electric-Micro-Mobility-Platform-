import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow } from '@/components/account/account-theme';

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  colors: {
    text: string;
    muted: string;
    cardBg: string;
    divider: string;
    destructive: string;
  };
};

export function SignOutConfirmModal({ visible, busy = false, onClose, onConfirm, colors }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}>
      <Pressable
        style={styles.backdrop}
        onPress={busy ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss">
        <Pressable style={[styles.card, cardShadow, { backgroundColor: colors.cardBg }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.destructive}18` }]}>
            <Ionicons name="log-out-outline" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Sign out?</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You will need to sign in again to use your wallet, reservations, and rides.
          </Text>
          <View style={[styles.actions, { borderTopColor: colors.divider }]}>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                { borderColor: colors.divider },
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={[styles.btnSecondaryLabel, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: colors.destructive },
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryLabel}>Sign out</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    paddingTop: 26,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: -22,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnSecondary: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'transparent',
  },
  btnSecondaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnPrimary: {},
  btnPrimaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
