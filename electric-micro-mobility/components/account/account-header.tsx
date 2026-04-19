import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow } from '@/components/account/account-theme';

const AVATAR_START = '#6B4540';
const AVATAR_END = '#2A3D2E';

type Props = {
  displayName: string;
  email: string;
  phone?: string | null;
  memberSinceLabel: string;
  avatarLetter: string;
  verificationLabel: string;
  isVerified: boolean;
  profileCompletion: number;
  onEditProfile: () => void;
  onChangePhoto: () => void;
  onSecurity: () => void;
  colors: {
    text: string;
    muted: string;
    subtle: string;
    cardBg: string;
    elevatedStroke: string;
  };
  pageBg: string;
};

export function AccountHeader({
  displayName,
  email,
  phone,
  memberSinceLabel,
  avatarLetter,
  verificationLabel,
  isVerified,
  profileCompletion,
  onEditProfile,
  onChangePhoto,
  onSecurity,
  colors,
  pageBg,
}: Props) {
  const completion = Math.min(100, Math.max(0, Math.round(profileCompletion)));

  return (
    <View
      style={[
        styles.card,
        cardShadow,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.elevatedStroke,
        },
      ]}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[AVATAR_START, AVATAR_END]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </LinearGradient>
          <Pressable
            onPress={onChangePhoto}
            style={[styles.photoFab, { borderColor: pageBg }]}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo">
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {displayName}
            </Text>
            <View style={[styles.statusPill, isVerified ? styles.pillOk : styles.pillWarn]}>
              <Ionicons
                name={isVerified ? 'shield-checkmark' : 'time-outline'}
                size={12}
                color={isVerified ? '#1B4332' : '#B06000'}
              />
              <Text style={[styles.statusText, isVerified ? styles.statusOk : styles.statusWarn]}>
                {verificationLabel}
              </Text>
            </View>
          </View>
          {email ? (
            <Text style={[styles.email, { color: colors.subtle }]} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {phone ? (
            <Text style={[styles.phone, { color: colors.muted }]} numberOfLines={1}>
              {phone}
            </Text>
          ) : null}
          <Text style={[styles.member, { color: colors.muted }]}>
            Member since {memberSinceLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.meterTrack, { backgroundColor: `${colors.text}10` }]}>
        <View style={[styles.meterFill, { width: `${completion}%` }]} />
      </View>
      <Text style={[styles.meterCaption, { color: colors.muted }]}>
        Profile {completion}% complete
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onEditProfile}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button">
          <Ionicons name="create-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Edit profile</Text>
        </Pressable>
        <Pressable
          onPress={onSecurity}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.elevatedStroke },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button">
          <Ionicons name="lock-closed-outline" size={18} color={colors.text} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Security</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  avatarWrap: {
    width: 88,
    height: 88,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },
  photoFab: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  nameRow: {
    gap: 8,
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOk: {
    backgroundColor: 'rgba(27, 67, 50, 0.12)',
  },
  pillWarn: {
    backgroundColor: 'rgba(176, 96, 0, 0.12)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  statusOk: {
    color: '#1B4332',
  },
  statusWarn: {
    color: '#B06000',
  },
  email: {
    fontSize: 13,
    fontWeight: '600',
  },
  phone: {
    fontSize: 14,
    fontWeight: '600',
  },
  member: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  meterTrack: {
    height: 6,
    borderRadius: 999,
    marginTop: 16,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FF4B41',
  },
  meterCaption: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#111111',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
});
