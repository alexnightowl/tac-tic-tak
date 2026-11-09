import { eos, graphite, layout, radii, semantic, shadows, space } from '@tac/core/tokens';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useAuthStore } from '@/stores/authStore';
import { AppText, textStyle } from '@/ui/AppText';
import { Input } from '@/ui/Input';
import { useLang, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { chooseAvatar, useAvatarUpload } from './avatarUpload';
import { Avatar } from './Avatar';
import { BIO_MAX, NAME_MAX, useProfileForm, type ProfileFields } from './useProfileForm';

export type { ProfileFields } from './useProfileForm';

/**
 * Profile editor (design v2 MobProfileEditor) as a native page sheet: ×,
 * Cinzel 15 title, Save plate; 64 pt avatar + Change avatar; display name,
 * bio and country with counters. Explicit Save
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
  const form = useProfileForm(initial, onClose);
  const { displayName, setDisplayName, bio, setBio, country, setCountry, saving, err, nameValid, bioValid, countryValid, dirty, save } = form;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  const close = () => form.requestClose(onClose);

  const counter = (n: number, max: number) => (
    <AppText variant="caption" color={n > max ? semantic.danger : eos.dust} style={styles.counter}>
      {`${n}/${max}`}
    </AppText>
  );

  return (
    // iOS presents a pageSheet below the status bar; Android draws the modal
    // edge to edge, so the bar needs the status-bar inset there.
    <View style={[styles.root, Platform.OS === 'android' && { paddingTop: insets.top }]} testID="profile-editor">
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
            style={styles.center}
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
            onChangeText={setCountry}
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
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  title: { flex: 1 },
  center: { alignSelf: 'center' },
});
