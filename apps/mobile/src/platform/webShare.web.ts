import { Share } from 'react-native';

import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';

// react-native-web's Share needs navigator.share, which most desktop
// browsers lack: there it would fail silently. Fall back to copying the
// message (it carries the link off iOS) and say so in a toast.
const g = globalThis as { __ttShare?: boolean };
if (!g.__ttShare) {
  g.__ttShare = true;
  const native = Share.share.bind(Share);
  Share.share = (async (content: Parameters<typeof Share.share>[0], options?: Parameters<typeof Share.share>[1]) => {
    const nav = navigator as { share?: unknown; clipboard: Clipboard };
    if (typeof nav.share === 'function') return native(content, options);
    const c = content as { message?: string; url?: string };
    const text = [c.message, c.url].filter(Boolean).join(' ');
    await nav.clipboard.writeText(text);
    toast.show({ title: translatorFor(appStore.getState().settings.language).t('shell.copied') });
    return { action: Share.sharedAction };
  }) as typeof Share.share;
}
