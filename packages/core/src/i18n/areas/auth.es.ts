// auth area, es. Translated from en (uk as a second reference); same keys and
// order as auth.en.ts. Edit only your area's files.
import type { Dict } from '../types';

export const authEs: Dict = {
  'auth.login': 'Entrar',
  'auth.register': 'Registrarse',
  'auth.nickname': 'Apodo',
  'auth.password': 'Contraseña',
  'auth.repeat': 'Repite la contraseña',
  'auth.no_account': '¿No tienes cuenta?',
  'auth.have_account': '¿Ya tienes cuenta?',
  'auth.create_account': 'Crear cuenta',
  'auth.creating': 'Creando…',
  'auth.logging_in': 'Entrando…',
  'auth.rule_nick_len': '3–20 caracteres',
  'auth.rule_nick_chars': 'Letras, cifras, _ o -',
  'auth.rule_nick_doubles': 'Sin _ o - seguidos',
  'auth.rule_pw_len': 'Al menos 8 caracteres',
  'auth.rule_pw_letter': 'Contiene una letra',
  'auth.rule_pw_digit': 'Contiene una cifra',
  'auth.rule_pw_match': 'Las contraseñas deben coincidir',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'auth.err_invalid': 'Apodo o contraseña incorrectos',
  'auth.err_required': 'Escribe tu apodo y contraseña',
  'auth.err_network': 'No se puede conectar con el servidor. Revisa tu conexión.',
  'auth.err_timeout': 'El servidor tarda demasiado. Inténtalo de nuevo.',
  'auth.err_generic': 'Algo salió mal. Inténtalo de nuevo.',
  'auth.err_taken': 'Ese apodo ya está en uso',
};
