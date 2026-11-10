// auth area, ru. Translated from en (uk as a second reference); same keys and
// order as auth.en.ts. Edit only your area's files.
import type { Dict } from '../types';

export const authRu: Dict = {
  'auth.login': 'Войти',
  'auth.register': 'Зарегистрироваться',
  'auth.nickname': 'Ник',
  'auth.password': 'Пароль',
  'auth.repeat': 'Повтори пароль',
  'auth.no_account': 'Еще нет аккаунта?',
  'auth.have_account': 'Уже есть аккаунт?',
  'auth.create_account': 'Создать аккаунт',
  'auth.creating': 'Создание…',
  'auth.logging_in': 'Вход…',
  'auth.rule_nick_len': '3–20 символов',
  'auth.rule_nick_chars': 'Буквы, цифры, _ или -',
  'auth.rule_nick_doubles': 'Без двойных _ или -',
  'auth.rule_pw_len': 'Минимум 8 символов',
  'auth.rule_pw_letter': 'Содержит букву',
  'auth.rule_pw_digit': 'Содержит цифру',
  'auth.rule_pw_match': 'Пароли должны совпадать',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'auth.err_invalid': 'Неверный никнейм или пароль',
  'auth.err_required': 'Введи никнейм и пароль',
  'auth.err_network': 'Нет связи с сервером. Проверь соединение.',
  'auth.err_timeout': 'Сервер отвечает слишком долго. Попробуй еще раз.',
  'auth.err_generic': 'Что-то пошло не так. Попробуй еще раз.',
  'auth.err_taken': 'Этот никнейм уже занят',
};
