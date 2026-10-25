import { queryKeys } from '@tac/core/api';
import { eos, graphite, layout, radii, semantic, shadows, space } from '@tac/core/tokens';
import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { feel } from '@/feel';
import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { useAuthStore } from '@/stores/authStore';
import { AppText, textStyle } from '@/ui/AppText';
import { Input } from '@/ui/Input';
import { useLang, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { chooseAvatar, useAvatarUpload } from './avatarUpload';
import { Avatar } from './Avatar';

const NAME_MAX = 40;
const BIO_MAX = 280;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export type ProfileFields = { displayName: string | null; bio: string | null; country: string | null };

/**
 * Profile editor (web ProfileEditor) as a native page sheet. Explicit Save
 * only: nothing commits on blur (the web settings tab saved per field on
 * blur, which mobile can't rely on). Closing with changes asks first; the
 * swipe-down dismissal is off while the form is dirty.
 */
export function ProfileEditorSheet({
  visible,
  initial,
  onClose,
}: {
  visible: boolean;
  initial: ProfileFields;
  onClose: () => void;
}) {
  // Swipe-to-dismiss only while nothing would be lost.
  const [dirty, setDirty] = useState(false);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={() => setDirty(false)}
      allowSwipeDismissal={!dirty}
    >
      {visible ? <EditorBody initial={initial} onClose={onClose} onDirty={setDirty} /> : null}
    </Modal>
  );
}

function EditorBody({
  initial,
  onClose,
  onDirty,
}: {
  initial: ProfileFields;
  onClose: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const preview = useAvatarUpload((s) => s.previewUri);
  const uploading = useAvatarUpload((s) => s.uploading);
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [country, setCountry] = useState((initial.country ?? '').toUpperCase());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nameValid = displayName.length <= NAME_MAX;
  const bioValid = bio.length <= BIO_MAX;
  const countryValid = country.length === 0 || COUNTRY_RE.test(country);
  const dirty =
    displayName !== (initial.displayName ?? '') ||
    bio !== (initial.bio ?? '') ||
    country.toLowerCase() !== (initial.country ?? '').toLowerCase();
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  const close = () => {
    if (!dirty) {
      onClose();
      return;
    }
    feel.emit('exitSheet');
    Alert.alert(t('profile.discard_title'), undefined, [
      { text: t('profile.keep_editing'), style: 'cancel' },
      { text: t('profile.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (!nameValid || !bioValid || !countryValid) {
      feel.emit('formError');
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      const r = await apiClient.patch<ProfileFields & { achievementsUnlocked?: string[] }>('/users/me/profile', {
        displayName,
        bio,
        country,
      });
      if (user) useAuthStore.getState().setUser({ ...user, displayName: r.displayName });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.nickname.toLowerCase()) });
      toast.show({ title: t('profile.saved') });
      toast.achievements(r.achievementsUnlocked, t);
      onClose();
    } catch {
      feel.emit('formError');
      setErr(t('profile.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const counter = (n: number, max: number) => (
    <AppText variant="caption" color={n > max ? semantic.danger : eos.dust} style={styles.counter}>
      {`${n}/${max}`}
    </AppText>
  );

  return (
    <View style={styles.root} testID="profile-editor">
      {/* Save lives in the bar (iOS edit-sheet pattern) so the keyboard never covers it. */}
      <View style={styles.bar}>
        <Tap
          testID="profile-editor-close"
          accessibilityRole="button"
          accessibilityLabel={t('profile.close_editor')}
          onPress={close}
          style={styles.close}
        >
          <X size={22} color={eos.bone} />
        </Tap>
        <AppText variant="turnTitle" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
          {t('profile.edit_title')}
        </AppText>
        <PlateButton
          label={t('common.save')}
          size="sm"
          onPress={() => void save()}
          loading={saving}
          disabled={!dirty || !nameValid || !bioValid || !countryValid}
          testID="profile-editor-save"
        />
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[8] }]}
        bottomOffset={space[6]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarRow}>
          <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} previewUri={preview} size={64} />
          <PlateButton
            label={t('profile.change_avatar')}
            variant="slate"
            size="sm"
            loading={uploading}
            onPress={chooseAvatar}
            testID="profile-editor-avatar"
          />
        </View>

        <View>
          <View style={styles.labelRow}>
            <AppText variant="label">{t('profile.display_name')}</AppText>
            {counter(displayName.length, NAME_MAX)}
          </View>
          <Input
            testID="profile-editor-name"
            accessibilityLabel={t('profile.display_name')}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={NAME_MAX}
            placeholder={user?.nickname}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View>
          <View style={styles.labelRow}>
            <AppText variant="label">{t('profile.bio')}</AppText>
            {counter(bio.length, BIO_MAX)}
          </View>
          <TextInput
            testID="profile-editor-bio"
            accessibilityLabel={t('profile.bio')}
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX}
            multiline
            placeholder={t('profile.bio_placeholder')}
            placeholderTextColor={eos.dust}
            selectionColor={eos.ember}
            cursorColor={eos.ember}
            keyboardAppearance="dark"
            maxFontSizeMultiplier={1.4}
            style={[textStyle('input', lang), styles.bio]}
          />
        </View>

        <View>
          <View style={styles.labelRow}>
            <AppText variant="label">{t('profile.country')}</AppText>
            <AppText variant="caption" color={countryValid ? eos.dust : semantic.danger} style={styles.counter}>
              {countryValid ? t('profile.country_hint') : t('profile.country_invalid')}
            </AppText>
          </View>
          <Input
            testID="profile-editor-country"
            accessibilityLabel={t('profile.country')}
            value={country}
            onChangeText={(v) => setCountry(v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}
            maxLength={2}
            placeholder="UA"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
          />
        </View>

        {err ? (
          <AppText variant="caption" color={semantic.danger} testID="profile-editor-error">
            {err}
          </AppText>
        ) : null}

      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.shade },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[2],
    paddingRight: layout.gutter,
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: layout.gutter, gap: space[5], paddingTop: space[2] },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space[1.5], gap: space[2] },
  counter: { fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  bio: {
    minHeight: 104,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: graphite[800],
    backgroundColor: eos.well,
    boxShadow: [...shadows.well],
    paddingHorizontal: layout.inputPaddingX,
    paddingTop: space[3],
    paddingBottom: space[3],
    textAlignVertical: 'top',
  },
  title: { flex: 1 },
});
