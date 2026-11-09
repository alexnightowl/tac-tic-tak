import { semantic } from '@tac/core/tokens';
import { Pencil } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/features/profile/Avatar';
import { chooseAvatar, useAvatarUpload } from '@/features/profile/avatarUpload';
import { BIO_MAX, NAME_MAX, useProfileForm, type ProfileFields } from '@/features/profile/useProfileForm';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { CloseButton, Dialog } from '../Dialog';
import { DText, GhostButton } from '../kit';
import { dx } from '../tokens';
import { DxField, FieldLabel } from './parts';

/**
 * DXProfileEdit: the profile editor as a centred dialog over the page
 * (560 px): avatar + Change avatar, display name and bio with counters,
 * the country code with its hint, Cancel / Save. The form is the phone
 * editor's (useProfileForm): explicit Save, a discard prompt on close.
 */
export function DxProfileEdit({ initial, onClose }: { initial: ProfileFields; onClose: () => void }) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const preview = useAvatarUpload((s) => s.previewUri);
  const uploading = useAvatarUpload((s) => s.uploading);
  const f = useProfileForm(initial, onClose);
  const close = () => f.requestClose(onClose);

  return (
    <Dialog onClose={close} width={560} testID="dx-profile-edit" style={styles.card}>
      <View style={styles.head}>
        <DText serif weight={700} size={22} style={styles.flex} accessibilityRole="header">
          {t('profile.edit_title')}
        </DText>
        <CloseButton onPress={close} testID="dx-profile-edit-close" />
      </View>

      <View style={styles.avatarRow}>
        <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} previewUri={preview} size={72} />
        <View>
          <GhostButton
            testID="dx-profile-edit-avatar"
            accessibilityLabel={t('profile.change_avatar')}
            label={uploading ? t('profile.avatar_uploading') : t('profile.change_avatar')}
            icon={Pencil}
            disabled={uploading}
            onPress={chooseAvatar}
            style={styles.start}
          />
          <DText size={12} color={dx.dust} style={styles.mt6}>
            {t('dx.account.avatar_hint')}
          </DText>
        </View>
      </View>

      <View style={styles.fields}>
        <View>
          <FieldLabel label={t('profile.display_name')} note={`${f.displayName.length}/${NAME_MAX}`} noteColor={f.nameValid ? undefined : semantic.danger} />
          <DxField
            testID="dx-profile-edit-name"
            accessibilityLabel={t('profile.display_name')}
            value={f.displayName}
            onChangeText={f.setDisplayName}
            maxLength={NAME_MAX}
            placeholder={user?.nickname}
            autoFocus
          />
        </View>
        <View>
          <FieldLabel label={t('profile.bio')} note={`${f.bio.length}/${BIO_MAX}`} noteColor={f.bioValid ? undefined : semantic.danger} />
          <DxField
            testID="dx-profile-edit-bio"
            accessibilityLabel={t('profile.bio')}
            value={f.bio}
            onChangeText={f.setBio}
            maxLength={BIO_MAX}
            placeholder={t('profile.bio_placeholder')}
            height={84}
          />
        </View>
        <View style={styles.countryRow}>
          <View style={styles.country}>
            <FieldLabel label={t('profile.country')} />
            <DxField
              testID="dx-profile-edit-country"
              accessibilityLabel={t('profile.country')}
              value={f.country}
              onChangeText={f.setCountry}
              maxLength={2}
              placeholder="UA"
              autoCapitalize="characters"
              autoComplete="off"
              error={!f.countryValid}
            />
          </View>
          <DText size={12} lh={17} color={f.countryValid ? dx.dust : semantic.danger} style={styles.countryHint}>
            {f.countryValid ? t('dx.account.country_hint') : t('profile.country_invalid')}
          </DText>
        </View>
      </View>

      {f.err ? (
        <DText size={12.5} color={semantic.danger} style={styles.mt12} testID="dx-profile-edit-error">
          {f.err}
        </DText>
      ) : null}

      <View style={styles.actions}>
        <GhostButton testID="dx-profile-edit-cancel" accessibilityLabel={t('common.cancel')} label={t('common.cancel')} onPress={close} />
        <PlateButton
          label={t('common.save')}
          size="sm"
          onPress={() => void f.save()}
          loading={f.saving}
          disabled={!f.dirty || !f.valid}
          testID="dx-profile-edit-save"
          style={styles.save}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  start: { alignSelf: 'flex-start' },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  fields: { gap: 16, marginTop: 22 },
  countryRow: { flexDirection: 'row', gap: 12 },
  country: { width: 140 },
  countryHint: { flex: 1, marginTop: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 24 },
  save: { minWidth: 150 },
});
