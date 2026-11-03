import { Dialog } from '@/components/wayfinder/ui';

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function SignOutConfirmModal({ visible, busy = false, onClose, onConfirm }: Props) {
  return (
    <Dialog
      visible={visible}
      title="Sign out?"
      message="You will need to sign in again to use your wallet, reservations, and rides."
      onRequestClose={() => {
        if (!busy) onClose();
      }}
      actions={[
        { label: 'Cancel', variant: 'secondary', onPress: onClose, disabled: busy },
        { label: 'Sign out', onPress: onConfirm, loading: busy },
      ]}
    />
  );
}
