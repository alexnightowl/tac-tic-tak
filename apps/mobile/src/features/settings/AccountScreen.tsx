import { control, eos, layout, radii, semantic, space } from '@tac/core/tokens';
import { LogOut, MonitorSmartphone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { resetAll } from '@/features/auth/session';
import { useShake } from '@/features/auth/useShake';
import { feel } from '@/feel';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { Input, PasswordInput } from '@/ui/Input';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { changePassword, deleteAccount, formErrorKey, logoutAll } from './api';
import { ACCOUNT_DELETE, ACCOUNT_LOGOUT_ALL } from './flags';
import { BottomSheet, GroupBody, NavRow, Section, SettingsPage } from './parts';

// Settings › Account: change password (web ChangePasswordSection, with the
// wrong-current-password fix: an inline error, never a logout), log out,
// and the two server-pending actions behind flags (B4 logout-all, B10
// delete account).

/** Web rule set (register + change-password DTO). */
function rules(next: string) {
  return { len: next.length >= 8, letter: /[A-Za-z]/.test(next), digit: /[0-9]/.test(next) };
}

export function AccountScreen() {
  const t = useT();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  // Dev builds show the pending rows disabled so they can be reviewed.
  const showPending = __DEV__;

  return (
    <SettingsPage testID="screen-settings-account" title={t('settings.account')} keyboard>
      <AppText variant="caption" style={styles.who} testID="account-who">
        {t('settings.account.signed_in_as', { nickname })}
      </AppText>

      <Section title={t('profile.change_password')}>
        <GroupBody>
          <ChangePasswordForm />
        </GroupBody>
      </Section>

      <Section>
        <NavRow icon={LogOut} label={t('logout')} testID="account-logout" danger onPress={() => void resetAll()} />
        {ACCOUNT_LOGOUT_ALL || showPending ? (
          <NavRow
            icon={MonitorSmartphone}
            label={t('settings.account.logout_all')}
            hint={ACCOUNT_LOGOUT_ALL ? t('settings.account.logout_all_hint') : t('settings.account.needs_server')}
            testID="account-logout-all"
            danger
            disabled={!ACCOUNT_LOGOUT_ALL}
            onPress={() => {
              feel.emit('exitSheet');
              setLogoutAllOpen(true);
            }}
          />
        ) : null}
      </Section>

      {ACCOUNT_DELETE || showPending ? (
        <Section title={t('settings.section.danger')} footer={t('settings.account.delete_hint')}>
          <NavRow
            icon={Trash2}
            label={t('settings.account.delete')}
            hint={ACCOUNT_DELETE ? null : t('settings.account.needs_server')}
            testID="account-delete"
            danger
            disabled={!ACCOUNT_DELETE}
            onPress={() => {
              feel.emit('exitSheet');
              setDeleteOpen(true);
            }}
          />
        </Section>
      ) : null}

      <LogoutAllSheet visible={logoutAllOpen} onClose={() => setLogoutAllOpen(false)} />
      <DeleteSheet visible={deleteOpen} nickname={nickname} onClose={() => setDeleteOpen(false)} />
    </SettingsPage>
  );
}

function ChangePasswordForm() {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { style: shakeStyle, shake } = useShake();

  const r = rules(next);
  const matches = next.length > 0 && next === repeat;
  const valid = current.length > 0 && r.len && r.letter && r.digit && matches && next !== current;

  const submit = async () => {
    if (!valid || saving) return;
    setError(null);
    setOk(false);
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setOk(true);
    } catch (e) {
      feel.emit('formError');
      shake();
      setError(t(formErrorKey(e)));
    } finally {
      setSaving(false);
    }
  };

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
    if (ok) setOk(false);
  };

  const ruleText = [t('auth.rule_pw_len'), t('auth.rule_pw_letter'), t('auth.rule_pw_digit')].join(' · ');
  const mismatch = repeat.length > 0 && next !== repeat ? t('auth.rule_pw_match') : null;

  return (
    <Animated.View style={[styles.form, shakeStyle]} testID="account-password-form">
      <PasswordInput
        testID="account-current"
        accessibilityLabel={t('profile.current_password')}
        label={t('profile.current_password')}
        value={current}
        onChangeText={edit(setCurrent)}
        returnKeyType="next"
      />
      <PasswordInput
        kind="new"
        testID="account-new"
        accessibilityLabel={t('profile.new_password')}
        label={t('profile.new_password')}
        value={next}
        onChangeText={edit(setNext)}
        returnKeyType="next"
      />
      <PasswordInput
        kind="new"
        testID="account-repeat"
        accessibilityLabel={t('profile.repeat_new_password')}
        label={t('profile.repeat_new_password')}
        value={repeat}
        onChangeText={edit(setRepeat)}
        error={mismatch}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <AppText variant="caption" color={r.len && r.letter && r.digit ? eos.sage : eos.ash}>
        {ruleText}
      </AppText>
      {error ? (
        <AppText variant="body" color={semantic.danger} testID="account-password-error" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {ok ? (
        <AppText variant="body" color={eos.sage} testID="account-password-ok" accessibilityLiveRegion="polite">
          {t('profile.password_changed')}
        </AppText>
      ) : null}
      <PlateButton
        testID="account-password-save"
        label={t('common.save')}
        block
        disabled={!valid}
        loading={saving}
        onPress={() => void submit()}
      />
    </Animated.View>
  );
}

/** B4: logout-all (flagged off until the route exists). */
function LogoutAllSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    feel.emit('discard');
    setBusy(true);
    try {
      await logoutAll();
      onClose();
      await resetAll();
    } catch (e) {
      feel.emit('formError');
      setError(t(formErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="logout-all-sheet" closeLabel={t('common.cancel')}>
      <AppText variant="title">{t('settings.account.logout_all')}</AppText>
      <AppText variant="body" color={eos.ash}>
        {t('settings.account.logout_all_confirm')}
      </AppText>
      {error ? (
        <AppText variant="caption" color={semantic.danger}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.sheetButtons}>
        <DangerButton testID="logout-all-confirm" label={t('settings.account.logout_all')} busy={busy} onPress={() => void confirm()} />
        <PlateButton testID="logout-all-cancel" label={t('common.cancel')} variant="slate" block onPress={onClose} disabled={busy} />
      </View>
    </BottomSheet>
  );
}

/** B10: typed nickname + password, then resetAll (PLAN Phase 9). Flagged off until the route exists. */
function DeleteSheet({ visible, nickname, onClose }: { visible: boolean; nickname: string; onClose: () => void }) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nickOk = typed.trim() === nickname && nickname.length > 0;
  const close = () => {
    if (busy) return;
    setTyped('');
    setPassword('');
    setError(null);
    onClose();
  };
  const confirm = async () => {
    if (!nickOk || !password) return;
    feel.emit('discard');
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onClose();
      await resetAll();
    } catch (e) {
      feel.emit('formError');
      setError(t(formErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={close} testID="delete-sheet" closeLabel={t('common.cancel')}>
      <AppText variant="title" color={control.dangerText}>
        {t('settings.account.delete')}
      </AppText>
      <AppText variant="body" color={eos.ash}>
        {t('settings.account.delete_confirm')}
      </AppText>
      <Input
        testID="delete-nickname"
        accessibilityLabel={t('auth.nickname')}
        label={t('auth.nickname')}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={nickname}
        error={typed.length > 0 && !nickOk ? t('settings.account.delete_mismatch') : null}
      />
      <PasswordInput
        testID="delete-password"
        accessibilityLabel={t('auth.password')}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={error}
      />
      <View style={styles.sheetButtons}>
        <DangerButton
          testID="delete-confirm"
          label={t('settings.account.delete_cta')}
          busy={busy}
          disabled={!nickOk || !password}
          onPress={() => void confirm()}
        />
        <PlateButton testID="delete-cancel" label={t('common.cancel')} variant="slate" block onPress={close} disabled={busy} />
      </View>
    </BottomSheet>
  );
}

function DangerButton({
  testID,
  label,
  busy,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const off = busy || disabled;
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled }}
      disabled={off}
      onPress={onPress}
      style={[styles.danger, off && styles.dim]}
    >
      <AppText variant="plateLabel" color={control.dangerText}>
        {label}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  who: { paddingHorizontal: space[1] },
  form: { gap: space[3] },
  sheetButtons: { gap: space[2.5], marginTop: space[2] },
  danger: {
    height: layout.plateHeight.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: control.dangerBorder,
    backgroundColor: control.dangerPressBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
});
