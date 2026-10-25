import { queryKeys } from '@tac/core/api';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import { create } from 'zustand';

import { feel } from '@/feel';
import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { AVATAR_REMOVE } from '@/features/social/flags';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { authStore } from '@/stores/authStore';
import { translatorFor } from '@/ui/lang';

// Avatar change (PLAN Phase 8, PROVISIONAL Q18): action sheet → system
// picker with the native 1:1 crop → 512 px JPEG at q0.8 → the existing
// base64 endpoint. The picked file shows at once (optimistic preview) and
// stays until the upload settles; a failure puts the old avatar back.

/** Output edge and JPEG quality (Q18: ~100 KB, under the 150 KB exit gate). */
const EDGE = 512;
const QUALITY = 0.8;

type UploadState = { previewUri: string | null; uploading: boolean };
export const useAvatarUpload = create<UploadState>(() => ({ previewUri: null, uploading: false }));

const tr = () => translatorFor(appStore.getState().settings.language).t;

type Source = 'camera' | 'library';

/** Native action sheet (iOS) / alert (Android): camera, library, remove. */
export function chooseAvatar(): void {
  const t = tr();
  const options: { label: string; run: () => void; destructive?: boolean }[] = [
    { label: t('profile.avatar_camera'), run: () => void pickAndUpload('camera') },
    { label: t('profile.avatar_library'), run: () => void pickAndUpload('library') },
  ];
  // No endpoint clears an avatar yet (AVATAR_REMOVE, backend list).
  if (AVATAR_REMOVE && authStore.getState().user?.avatarUrl) {
    options.push({ label: t('profile.avatar_remove'), run: () => {}, destructive: true });
  }
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), t('common.cancel')];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('profile.change_avatar'),
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: options.findIndex((o) => o.destructive),
        userInterfaceStyle: 'dark',
      },
      (i) => options[i]?.run(),
    );
    return;
  }
  Alert.alert(t('profile.change_avatar'), undefined, [
    ...options.map((o) => ({ text: o.label, onPress: o.run, style: o.destructive ? ('destructive' as const) : undefined })),
    { text: t('common.cancel'), style: 'cancel' as const },
  ]);
}

async function ensurePermission(source: Source): Promise<boolean> {
  const res =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (res.granted) return true;
  const t = tr();
  Alert.alert(t('profile.change_avatar'), t('profile.avatar_permission'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('profile.open_settings'), onPress: () => void Linking.openSettings() },
  ]);
  return false;
}

export async function pickAndUpload(source: Source): Promise<void> {
  if (useAvatarUpload.getState().uploading) return;
  if (!(await ensurePermission(source))) return;
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    shape: 'oval',
  };
  const picked =
    source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (picked.canceled || !picked.assets?.[0]) return;
  const asset = picked.assets[0];
  await uploadAvatar(asset.uri, asset.width, asset.height);
}

/** Square-crops (if the platform crop didn't), resizes and uploads one image. */
export async function uploadAvatar(uri: string, width?: number, height?: number): Promise<boolean> {
  const t = tr();
  useAvatarUpload.setState({ previewUri: uri, uploading: true });
  try {
    const ctx = ImageManipulator.manipulate(uri);
    if (width && height && width !== height) {
      const side = Math.min(width, height);
      ctx.crop({ originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side });
    }
    ctx.resize({ width: EDGE, height: EDGE });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
    if (!out.base64) throw new Error('encode failed');
    useAvatarUpload.setState({ previewUri: out.uri });
    const r = await apiClient.post<{ avatarUrl: string; achievementsUnlocked?: string[] }>('/users/me/avatar', {
      dataUrl: `data:image/jpeg;base64,${out.base64}`,
    }, { timeoutMs: 30_000 });
    const user = authStore.getState().user;
    if (user) authStore.getState().setUser({ ...user, avatarUrl: r.avatarUrl });
    toast.achievements(r.achievementsUnlocked, t);
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends() });
    // Keep the local preview until the profile carries the new URL, so the
    // hero never flashes the old photo between upload and refetch.
    if (user) {
      await queryClient
        .invalidateQueries({ queryKey: queryKeys.profile(user.nickname.toLowerCase()) })
        .catch(() => undefined);
    }
    return true;
  } catch {
    feel.emit('formError');
    toast.show({ title: t('profile.avatar_failed') });
    return false;
  } finally {
    useAvatarUpload.setState({ previewUri: null, uploading: false });
  }
}
