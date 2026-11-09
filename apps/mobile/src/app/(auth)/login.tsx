import { DxLogin } from '@/desktop/auth';
import { useDesktop } from '@/desktop/useDesktop';
import { LoginScreen } from '@/features/auth/LoginScreen';

export default function Login() {
  const desktop = useDesktop();
  return desktop ? <DxLogin /> : <LoginScreen />;
}
