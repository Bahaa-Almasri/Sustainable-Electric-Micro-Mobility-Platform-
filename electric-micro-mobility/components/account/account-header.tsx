import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

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
}: Props) {
  const { c } = useWayfinder();
  const { top } = useSafeAreaInsets();
  const completion = Math.min(100, Math.max(0, Math.round(profileCompletion)));
  const contact = [email, phone].filter(Boolean).join(' · ');

  return (
    <View style={[styles.wrap, { paddingTop: top + 12 }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={onChangePhoto}
          style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <Text style={[styles.avatarText, { color: c.accentText }]}>{avatarLetter}</Text>
        </Pressable>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1} accessibilityRole="header">
            {displayName}
          </Text>
          <View style={styles.status}>
            <Ionicons
              name={isVerified ? 'checkmark' : 'time-outline'}
              size={15}
              color={isVerified ? c.success : c.warning}
            />
            <Text style={[styles.statusText, { color: isVerified ? c.success : c.warning }]} numberOfLines={1}>
              {isVerified ? 'Verified rider' : verificationLabel}
            </Text>
          </View>
        </View>
        <Button
          label="Edit profile"
          variant="secondary"
          onPress={onEditProfile}
          height={44}
          radius={22}
          style={styles.edit}
        />
      </View>
      {contact ? (
        <Text style={[Type.secondary, styles.meta, { color: c.muted }]} numberOfLines={1}>
          {contact}
        </Text>
      ) : null}
      <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={1}>
        Member since {memberSinceLabel} · Profile {completion}% complete
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.display, fontSize: 22 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontFamily: FontFamily.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusText: { fontFamily: FontFamily.bold, fontSize: 13 },
  edit: { paddingHorizontal: 14 },
  meta: { marginTop: 10 },
});
