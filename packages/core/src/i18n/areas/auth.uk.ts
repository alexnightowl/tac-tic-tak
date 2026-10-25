// auth area, uk. Keys from the web dict (apps/frontend/src/lib/i18n.ts) keep
// their web text verbatim; mobile-only keys follow. Edit only your area's files.
import type { Dict } from '../types';

export const authUk: Dict = {
  'auth.login': 'Увійти',
  'auth.register': 'Створити акаунт',
  'auth.nickname': 'Нік',
  'auth.password': 'Пароль',
  'auth.repeat': 'Повторіть пароль',
  'auth.no_account': 'Ще без акаунта?',
  'auth.have_account': 'Вже зареєстровані?',
  'auth.create_account': 'Реєстрація',
  'auth.creating': 'Створення…',
  'auth.logging_in': 'Вхід…',
  'auth.rule_nick_len': '3–20 символів',
  'auth.rule_nick_chars': 'Літери, цифри, _ або -',
  'auth.rule_nick_doubles': 'Без подвійних _ або -',
  'auth.rule_pw_len': 'Мінімум 8 символів',
  'auth.rule_pw_letter': 'Має містити літеру',
  'auth.rule_pw_digit': 'Має містити цифру',
  'auth.rule_pw_match': 'Паролі мають збігатись',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'auth.err_invalid': 'Невірний нікнейм або пароль',
  'auth.err_required': 'Введіть нікнейм і пароль',
  'auth.err_network': 'Немає зв’язку із сервером. Перевірте мережу.',
  'auth.err_timeout': 'Сервер відповідає надто довго. Спробуйте ще раз.',
  'auth.err_generic': 'Щось пішло не так. Спробуйте ще раз.',
  'auth.err_taken': 'Цей нікнейм уже зайнятий',
};
