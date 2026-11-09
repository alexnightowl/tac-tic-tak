import { localeFor } from '@tac/core/format';
import { semantic } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Check, LogOut, MonitorSmartphone } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { meQuery, resetAll } from '@/features/auth/session';
import { DeleteSheet, LogoutAllSheet } from '@/features/settings/AccountScreen';
import { ACCOUNT_DELETE, ACCOUNT_LOGOUT_ALL } from '@/features/settings/flags';
import { usePasswordChange } from '@/features/settings/usePasswordChange';
import { feel } from '@/feel';
import { useAuthStore } from '@/stores/authStore';
import { useLang, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Card, DText, GhostButton, Label } from '../kit';
import { dx } from '../tokens';
import { DxSettingsFrame } from './DXSettings';
import { DxField, FieldLabel, PaneTitle, RowsCard, SettingRow } from './parts';

/**
 * DXSettingsAccount (/settings/account): change password (the phone form:
 * live rules, a wrong current password stays inline), log out, and the
 * server-pending log-out-everywhere / delete rows, shown the way the phone
 * shows them (flagged; disabled previews in dev builds).
 */
export function DxSettingsAccount() {
  const t = useT();
  const { lang } = useLang();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const authed = useAuthStore((s) => s.status === 'authed');
  const me = useQuery({ ...meQuery, enabled: authed });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const showPending = __DEV__;
  const created = me.data ? new Date(me.data.createdAt).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <DxSettingsFrame pane="account">
      <PaneTitle>{t('settings.account')}</PaneTitle>
      <DText size={13.5} color={dx.ash} style={styles.mt4} testID="account-who">
        {created ? t('dx.account.account_line', { nickname, date: created }) : t('settings.account.signed_in_as', { nickname })}
      </DText>

      <PasswordCard />

      <RowsCard style={styles.mt16}>
        <SettingRow first title={t('dx.account.logout_title')} hint={t('dx.account.logout_hint')}>
          <GhostButton testID="account-logout" accessibilityLabel={t('logout')} icon={LogOut} label={t('dx.account.logout_cta')} onPress={() => void resetAll()} />
        </SettingRow>
        {ACCOUNT_LOGOUT_ALL || showPending ? (
          <SettingRow
            title={t('settings.account.logout_all')}
            hint={ACCOUNT_LOGOUT_ALL ? t('settings.account.logout_all_hint') : t('settings.account.needs_server')}
          >
            <GhostButton
              testID="account-logout-all"
              accessibilityLabel={t('settings.account.logout_all')}
              icon={MonitorSmartphone}
              label={t('dx.account.logout_cta')}
              disabled={!ACCOUNT_LOGOUT_ALL}
              onPress={() => {
                feel.emit('exitSheet');
                setLogoutAllOpen(true);
              }}
            />
          </SettingRow>
        ) : null}
        {ACCOUNT_DELETE || showPending ? (
          <SettingRow
            title={t('settings.account.delete')}
            hint={ACCOUNT_DELETE ? t('settings.account.delete_hint') : t('settings.account.needs_server')}
          >
            <GhostButton
              testID="account-delete"
              accessibilityLabel={t('settings.account.delete')}
              label={t('dx.account.delete_cta')}
              danger
              disabled={!ACCOUNT_DELETE}
              onPress={() => {
                feel.emit('exitSheet');
                setDeleteOpen(true);
              }}
            />
          </SettingRow>
        ) : null}
      </RowsCard>

      <LogoutAllSheet visible={logoutAllOpen} onClose={() => setLogoutAllOpen(false)} />
      <DeleteSheet visible={deleteOpen} nickname={nickname} onClose={() => setDeleteOpen(false)} />
    </DxSettingsFrame>
  );
}

function PasswordCard() {
  const t = useT();
  const f = usePasswordChange();
  const rules = [
    { ok: f.rules.len, label: t('dx.account.rule_len') },
    { ok: f.rules.letter, label: t('dx.account.rule_letter') },
    { ok: f.rules.digit, label: t('dx.account.rule_digit') },
  ];
  return (
    <Card style={styles.pw} testID="account-password-form">
      <Label>{t('profile.change_password')}</Label>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <FieldLabel label={t('profile.current_password')} />
          <DxField
            testID="account-current"
            accessibilityLabel={t('profile.current_password')}
            value={f.current}
            onChangeText={f.setCurrent}
            secret
            autoCapitalize="none"
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </View>
        <View style={styles.cell} />
        <View style={styles.cell}>
          <FieldLabel label={t('profile.new_password')} />
          <DxField
            testID="account-new"
            accessibilityLabel={t('profile.new_password')}
            value={f.next}
            onChangeText={f.setNext}
            secret
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </View>
        <View style={styles.cell}>
          <FieldLabel label={t('profile.repeat_new_password')} note={f.mismatch ?? undefined} noteColor={semantic.danger} />
          <DxField
            testID="account-repeat"
            accessibilityLabel={t('profile.repeat_new_password')}
            value={f.repeat}
            onChangeText={f.setRepeat}
            secret
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="••••••••"
            error={!!f.mismatch}
            onSubmitEditing={() => void f.submit()}
          />
        </View>
      </View>
      <View style={styles.foot}>
        {rules.map((r) => (
          <View key={r.label} style={styles.rule} testID={`account-rule-${r.ok ? 'ok' : 'no'}`}>
            <Check size={13} color={r.ok ? dx.sage : dx.dust} strokeWidth={2.2} />
            <DText size={12} color={r.ok ? dx.sage : dx.dust}>
              {r.label}
            </DText>
          </View>
        ))}
        <View style={styles.flex} />
        <PlateButton testID="account-password-save" label={t('common.save')} size="sm" disabled={!f.valid} loading={f.saving} onPress={() => void f.submit()} style={styles.save} />
      </View>
      {f.error ? (
        <DText size={13} color={semantic.danger} style={styles.mt12} testID="account-password-error" accessibilityLiveRegion="polite">
          {f.error}
        </DText>
      ) : null}
      {f.ok ? (
        <DText size={13} color={dx.sage} style={styles.mt12} testID="account-password-ok" accessibilityLiveRegion="polite">
          {t('profile.password_changed')}
        </DText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt4: { marginTop: 4 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  pw: { marginTop: 16, padding: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  cell: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { minWidth: 160 },
});
