import { DxRegister } from '@/desktop/auth';
import { useDesktop } from '@/desktop/useDesktop';
import { RegisterScreen } from '@/features/auth/RegisterScreen';

export default function Register() {
  const desktop = useDesktop();
  return desktop ? <DxRegister /> : <RegisterScreen />;
}
