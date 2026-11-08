import { eos, space, transitions } from '@tac/core/tokens';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';
import { useEffect } from 'react';
import { create } from 'zustand';

import { AppText } from './AppText';
import { DangerButton } from './Buttons';
import { PlateButton } from './PlateButton';
import { SheetBody } from './Sheet';

// Design v2 confirm sheet (Exit, Reset, Log out everywhere): title, body,
// a filled danger action and a slate Cancel. `confirm()` opens it from any
// screen in place of the native Alert.alert, which drew the platform's own
// dialog (owner, 2026-11-04).
//
// It is not the Modal-based <Sheet>: a root-level Modal cannot present over
// fullScreenModal routes (Storm run, course exam). Like the toasts it sits
// in a FullWindowOverlay on iOS (its own window, mounted only while open,
// so Maestro still sees the app otherwise) and above the navigator on
// Android.

export type ConfirmRequest = {
  title: string;
  body?: string;
  /** The destructive action ("End run", "Unfriend"). */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** testID prefix: `<id>-sheet`, `<id>-confirm`, `<id>-cancel`. */
  testID?: string;
};

type State = { req: ConfirmRequest | null; open: boolean };

const useConfirmStore = create<State>(() => ({ req: null, open: false }));

/** Opens the confirm sheet. A second call replaces an open one. */
export function confirm(req: ConfirmRequest): void {
  useConfirmStore.setState({ req, open: true });
}

/**
 * Closes with the slide-out, then runs `then`: a navigation it starts
 * (router.replace, a prevented back) happens once the overlay is gone.
 */
function close(then?: () => void) {
  useConfirmStore.setState({ open: false });
  setTimeout(() => {
    if (!useConfirmStore.getState().open) useConfirmStore.setState({ req: null });
    then?.();
  }, transitions.sheet.duration);
}

/** Mounted once in the root layout, after the navigator. */
export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req);
  if (!req) return null;
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        {/* A separate UIWindow: gestures need their own root there. */}
        <GestureHandlerRootView style={styles.fill}>
          <ConfirmLayer req={req} />
        </GestureHandlerRootView>
      </FullWindowOverlay>
    );
  }
  return <ConfirmLayer req={req} />;
}

function ConfirmLayer({ req }: { req: ConfirmRequest }) {
  const open = useConfirmStore((s) => s.open);
  const cancel = () => close(req.onCancel);

  // Android back cancels, as the backdrop does.
  useEffect(() => {
    if (!open || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      cancel();
      return true;
    });
    return () => sub.remove();
  });

  const id = req.testID ?? 'confirm';
  return (
    <View style={styles.fill} pointerEvents={open ? 'auto' : 'none'}>
      {open ? (
        <SheetBody onClose={cancel} testID={`${id}-sheet`} closeLabel={req.cancelLabel}>
          <AppText variant="title">{req.title}</AppText>
          {req.body ? (
            <AppText variant="body" color={eos.ash}>
              {req.body}
            </AppText>
          ) : null}
          <View style={styles.buttons}>
            <DangerButton testID={`${id}-confirm`} label={req.confirmLabel} filled onPress={() => close(req.onConfirm)} />
            <PlateButton testID={`${id}-cancel`} label={req.cancelLabel} variant="slate" block onPress={cancel} />
          </View>
        </SheetBody>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  buttons: { gap: space[2.5], marginTop: space[2] },
});
