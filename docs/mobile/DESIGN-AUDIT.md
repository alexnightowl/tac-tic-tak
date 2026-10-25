<!-- Owner-facing (Ukrainian), like OWNER-QUESTIONS.md. Source: design canvas https://claude.ai/code/artifact/6e1c9a2c-6619-402b-ae58-5b6f4252d104, audited 2026-10-26 on mobile@5e9642b. §6 is the English developer appendix. -->

# Звірка застосунку з дизайном (канвас Claude Design)

## 1. Короткий підсумок

Кольори, розміри кнопок і полів, сегментований перемикач, механіка повзунка складності й фігури Classic/Ember збігаються з дизайном. Компонування екранів відрізняється майже скрізь: із 22 реалізованих артбордів більшість мають суттєві розбіжності. Головні системні проблеми такі:

- немає спільних компонентів, які є в дизайні: згрупований список, третинна, ghost і danger кнопки, тост, діалог, смуги прогресу, пігулки;
- картки скрізь отримали рамку й тінь, а базовий текст дрібніший за дизайн;
- набір вкладок і будова налаштувань у дизайні й у застосунку різні.

Канвас теж має прогалини. Приблизно 20 екранів застосунку не мають жодного артборду. Дизайн суперечить сам собі щодо таб-бару, дошки, перемикачів і шапок. Ці питання треба вирішити до перефарбування.

---

## 2. Що виправити в застосунку

### 2.0 Спершу рішення власника (структурні конфлікти)

Ці пункти не можна просто «виправити», бо треба обрати, хто правий: дизайн чи застосунок.

| # | Конфлікт | Дизайн | Застосунок |
|---|---|---|---|
| а | Вкладки | Артборди екранів: Home · Play · Review · Board · Stats · Settings. Аркуш компонентів: Train · Stats · Ranks · Profile. Екрана «Board» не існує | Home · Play · Review · Stats · Social, налаштування відкриваються з аватара |
| б | Налаштування | Вкладка з трьома підрозділами: Profile / Gameplay / App | Список із шести підекранів: звук, сповіщення, акаунт, «Про застосунок» у три підрозділи не вміщаються |
| в | Вибір теми в Play | Список одразу на екрані | Окремий аркуш |
| г | Досягнення | Список в одну колонку | Сітка у дві колонки |
| ґ | Лідерборд | Простий список, №1 позначено ember-плитою | П'єдестал топ-3 і закріплений рядок «я» |
| д | Редактор профілю | Форма прямо на сторінці | Аркуш |
| е | Сесія | Кнопки Hint / Skip і смужка з 10 сегментів | Лічильники «розв'язано / рейтинг / помилки». На вебі підказок у сесії на час не було, а сесія не має фіксованої кількості задач |
| є | Головна | Hero одразу запускає останній сетап | «Почати» веде на Play, плюс окремий рядок «Швидкий старт» |
| ж | Дошка | Session: червоні підсвітки, Classic, поверхня Tiles. BoardStudio: синьо-бірюзові (відтінок 190), Ember, поверхня Stone | Синій відтінок із вебу, Classic, Tiles |
| з | Статистика | Профіль тем як список зі смугами, без картки «Рекомендований фокус» | Радар-діаграма плюс картка «Рекомендований фокус» |

### 2.1 Дизайн-система (діє на всі екрани)

- 🔴 **Кнопки-плити без іконки.** Основні кнопки мають мати іконку «play» 18px зліва від тексту: «Start», «Start session», «Let's go», «Resume», «Play again».
- 🔴 **Немає третинної, ghost, danger та іконкових кнопок.** Екрани малюють кожен свій варіант. Треба зробити їх за дизайном:
  - третинна: 44px, радіус 6, рамка seam;
  - ghost: прозора, текст bone;
  - danger: ember-контур, текст #d07771;
  - іконкові: 44×44 і круглі 36×36.
- 🔴 **Тост.** За дизайном це один рядок із ember-смужкою зліва, іконка 18px і хрестик закриття 28px. Зараз це велика картка з плиткою-іконкою, надзаголовком «ACHIEVEMENT/NOTICE» та описом.
- 🔴 **Діалог.** Дизайн має власний діалог: заголовок Cinzel 20, кнопки Ghost «Keep going» і Danger «End session». Застосунок показує системне вікно iOS.
- 🟡 **Типографіка.** Розбіжності за стилями:
  - Body: дизайн Manrope 500 16/24, застосунок 400 14/20, тобто весь звичайний текст дрібніший і тонший;
  - Display: дизайн 40/48 з трекінгом 0.5, застосунок 44/46;
  - Heading: дизайн Cinzel 600 22/30, застосунок 700 без висоти рядка.
- 🟡 **Картки.** Дизайн: радіус 10, без рамки, лише внутрішній відблиск. Застосунок: радіус 12, рамка й тінь.
- 🟡 **Віньєтка.** Кожен артборд має легке затемнення країв екрана. Застосунок не малює його ніде, хоча токен уже є.
- 🟡 **Згруповані списки.** Дизайн усюди використовує одну картку з тонкими роздільниками #353339: Головна, Review, досягнення, лідерборд, профіль, налаштування. Застосунок малює окремі картки. Один спільний компонент виправить це на всіх екранах одразу.
- 🟡 **Рядки списків.** Дизайн: заголовок 14/700, підказка 12 кольору dust. Застосунок: 16/400 і підказка кольору ash. Стосується налаштувань та імен у лідерборді.
- 🟡 **Перемикач.** Дизайн: 46×26, повзунок 20, вимкнений трек кольору rise, підпис праворуч. Застосунок: 48×28, повзунок 24, вимкнений трек темний well.
- 🟡 **Відсутні компоненти:**
  - чекбокс; радіо (зараз намальоване окремо на кожному екрані);
  - вкладки з підкресленням;
  - чіпи тем;
  - пігулки рейтингу й дельти (зараз це просто кольоровий текст);
  - смуга прогресу 10px з градієнтом #592628→#a64241 (зараз 6px, однотонна);
  - сегменти кроків сесії;
  - плитка статистики;
  - банери «правильно / неправильно».
- 🟡 **Поле вводу.** У фокусі має бути ember-рамка плюс зовнішнє кільце 4px. Окремо потрібен варіант пошуку: пігулка 48px з лупою зліва.
- 🟡 **Стани кнопок-плит:**
  - неактивна в дизайні темніша й сіріша;
  - під час завантаження спінер стоїть поруч із текстом, а не замість нього;
  - внутрішні бічні відступи зараз приблизно на 16px ширші.
- 🟡 **Бейдж стріка.** За дизайном це пігулка 26px з ember-тлом і числом #d8847c. Зараз це бурштиновий вогник без пігулки. Потрібні токени вже існують.
- 🟡 **Кольори поза токенами.** Дизайн використовує кольори, яких немає в токенах ядра: #262428, #2b292e, #e4a6a0, #bccbb5, кольори станів кнопок і danger, градієнт прогресу. Їх треба спершу додати в токени.

### 2.2 Шапка й таб-бар

- 🔴 **Набір вкладок:** див. рішення 2.0а.
- 🟡 **Шапка вкладених екранів.** Дизайн: 56px, тло shade зі швом знизу, кнопка «назад» 40×40, заголовок Cinzel 17 по центру. Зараз стандартна шапка iOS: тло ink, без шва, Cinzel 18.
- 🟡 **Шапка вкладок.** Праворуч мають бути пігулка стріка й аватар. Зараз лише аватар.

### 2.3 Вхід

- 🔴 Поля й кнопка мають стояти прямо на тлі, без картки.
- 🟡 Блок вирівняний догори, відступи 72/24/32 за дизайном. Зараз він по центру екрана.
- 🟡 Назва «tac·tic·tak»: Cinzel 30, трекінг 1.5. Зараз 34 без трекінгу.
- 🟡 Підзаголовок має бути «Tactics, one session at a time.», зараз «Log in».

### 2.4 Реєстрація

- 🔴 Нагорі шапка зі стрілкою назад і заголовком «Create account». Логотипа й назви застосунку там немає.
- 🔴 Форма без картки.
- 🟡 Плейсхолдери: «Pick a nickname», «At least 8 characters», «Same again».
- 🟡 Можливий баг: з порожнім ніком два правила вже світяться зеленим.

### 2.5 Онбординг

- 🔴 Верхня панель: лише «Skip» праворуч. Зараз там «Step 1 of 5», хрестик і ще одне «Skip» унизу.
- 🔴 Ілюстрація займає слот 240×240. Зараз плитка 64px з іконкою. Самих ілюстрацій ще немає й у дизайні.
- 🟡 Текст вирівняний ліворуч. Надзаголовок «STEP 1 OF 5», заголовок Cinzel 26/32, текст 15/23.
- 🟡 Точки: висота 8, активна 28 ember, решта колір seam. Розташовані між ілюстрацією й текстом.
- 🟡 Кнопки внизу на всю ширину: Back (slate) і Next (ember). На останньому кроці «Let's go» з іконкою.

### 2.6 Головна

- 🔴 **Стрік.** Пігулка в шапці біля аватара, без підпису. Зараз він у тілі екрана, бурштиновий, з підписом.
- 🔴 **Hero.** Має показувати сетап, наприклад «Blitz · 10 minutes», опис і одну кнопку, що одразу запускає сесію. Див. рішення 2.0є.
- 🔴 **Плитка рейтингу.** Знизу «Norm 1655», праворуч дельта, де дельта = рейтинг − норма. Зараз дельта показує зміну з останнього візиту.
- 🔴 **Останні сесії.** Одна згрупована картка, рядок має вигляд «Blitz · 9 solved / Today, 14:52 · 82% accuracy» плюс пігулка дельти. Зараз це окремі картки з іншим вмістом.
- 🟡 Плитки рейтингу без рамки й тіні, проміжок 10.
- 🟡 Заголовок «Recent sessions» шрифтом Cinzel 16, посилання «See all» з ember-підкресленням.

### 2.7 Play: нова сесія

- 🔴 **Вибір теми:** див. рішення 2.0в.
- 🟡 Кнопка «Start» стоїть усередині картки, на всю ширину, з іконкою. Зараз вона закріплена над таб-баром і без іконки.
- 🟡 Кожна вкладка стилю має іконку 18px і чип «?0/5» усередині кнопки.
- 🟡 Тексти калібрування за дизайном:
  - підказка над повзунком: «…the rating picker unlocks once calibration finishes.»;
  - картка калібрування: «A few sessions to tune the puzzles…».
- 🟡 Картка калібрування: радіус 10, напівпрозоре тло, смуга кольору ember. Зараз смуга золота, а радіус 16.
- 🟡 **Список тем (у будь-якому розміщенні).** Стиль має бути за дизайном:
  - вкладки Weakest/Popular/All: активна кольору rise з текстом bone, за замовчуванням All;
  - рядок 48px, плитка 30, іконка 22;
  - статистика без іконок: Weakest «38%» рожевим, Popular «48 tries».
- 🟡 Пошук тем: висота 44, лупа зліва.
- 🟡 Заголовок «New session»: Cinzel 20, зараз 22.

### 2.8 Сесія (дошка)

- 🔴 **Hint/Skip і смужка з 10 сегментів:** див. рішення 2.0е.
- 🔴 **Рядок ходу.** Без картки: квадратик кольору сторони, «Your turn» Cinzel 20, підзаголовок, праворуч «RATING 1612». Зараз це картка з диском короля, а рейтинг унизу.
- 🟡 **Верхня панель.** Ghost-кнопка «Exit» з хрестиком, чип таймера 24px з годинником, іконка паузи 40px. Зараз скляні пігулки, «EXIT» великими літерами, великий таймер по центру.
- 🟡 **Дошка.** Відступи 16px з боків, радіус 6, тінь за дизайном. Зараз дошка на всю ширину екрана.
- 🟡 **Картка калібрування.** Розташована під дошкою, смуга з градієнтом. Зараз вона над дошкою.
- 🟡 **Колір підсвіток:** див. рішення 2.0ж.

### 2.9 Пауза

- 🔴 Під «Resume» має бути кнопка «End session». Зараз завершити сесію можна лише через «Exit».
- 🔴 Композиція: непрозорий екран з ember-сяйвом і диском паузи 72px. Зараз розмита дошка.
- 🟡 Залишок часу шрифтом Manrope 44/800. Зараз засічковий Cinzel.
- 🟡 Заголовок «Paused» 28, підказка 15/22.
- 🟡 «Resume» на всю ширину, з іконкою.

### 2.10 Підсумок сесії

- 🔴 **Блок рейтингу.** Надзаголовок «BLITZ · 10 MIN», велике «1612», чип «+32», підпис «Blitz rating». Зараз нічого з цього немає.
- 🔴 **Смужка результатів по задачах.** 10 сегментів: зелений розв'язано, ember помилка.
- 🟡 Кнопки внизу в один ряд: «HOME» (slate) і «PLAY AGAIN» (ember з іконкою), обидві 52px.
- 🟡 Картка Review простіша: «2 puzzles went to Review — drill them without the clock.», без кнопки.
- 🟡 Плитки: SOLVED зеленим, FAILED рожевим, значення 26/800.
- 🟡 Картка підвищення рівня: іконка й заголовок рожеві #d8847c, золоте сяйво. Зараз вони кольору ember.

### 2.11 Дошка (BoardStudio)

- 🟡 **Поверхня, набір фігур за замовчуванням, відтінок підсвіток:** див. рішення 2.0ж.
- 🟡 **Стрілки.** Дизайн: пласка фігура з тоншим древком і світінням, починається за 0.22 клітинки від центру. Зараз стрілка товща, без світіння, від центру до центру.

### 2.12 Review

- 🔴 **Hero «IN REVIEW 12».** Загальна кількість і кнопка «Drill all». Технічно це вже можливо.
- 🔴 **Список «BY PATTERN».** Одна згрупована картка без іконок. Зараз окремі картки з іконками.
- 🔴 **Смужки «до очищення патерну».** П'ять сегментів і підпис під списком. Потрібне нове поле з бекенду.
- 🟡 Назва патерну Manrope 14/700. Зараз Cinzel капітеллю. Підпис «4 puzzles waiting» без мінімального рейтингу.
- 🟡 Шапка: «Review» по центру, без логотипа.
- 🟡 Підзаголовок має друге речення: «No clock, no rating — just the positions you missed.»

### 2.13 Review drill

- 🔴 **Дошка занадто низько.** Верх дошки приблизно на 286pt, за дизайном приблизно на 141pt. Над дошкою порожньо близько 75pt.
- 🔴 **Ширина дошки.** Має бути з відступами 16px, зараз на всю ширину.
- 🔴 **Кнопки внизу.** Slate-плита «Hint» з лампочкою і ghost «Skip». Зараз скляна пігулка, Skip немає (рішення 2.0е).
- 🔴 **Верхня панель.** Текстова кнопка «Back», праворуч пігулки «Missed» і «1 / 2». Зараз хрестик і назва теми.
- 🟡 Прогрес сегментами, по одному на задачу.
- 🟡 Рядок ходу без картки, як у сесії.
- 🟡 Лічильник «✓ 0 ✕ 0 · 2 left» у тренуванні теми. Зараз його немає.
- 🟡 Рядка тем під заголовком у дизайні немає.

### 2.14 Статистика

- 🔴 **Профіль тем:** див. рішення 2.0з.
- 🔴 **Рядки тем.** Лише назва, смуга (ember для слабких, зелений для сильних) і відсоток успіху. Зараз іконки, рейтинг, бурштинові кольори поза палітрою, а смуга показує слабкість.
- 🔴 **Шапка й перемикач.** «Statistics» по центру, перемикач Stats/Achievements як вкладки з підкресленням. Зараз ember-сегмент.
- 🟡 Фільтр стилю: висота 38, іконки стилів.
- 🟡 Теплова карта за пів року, клітинки 10, без підписів днів і місяців, без прокрутки. Підказка: «…over the past half year.»
- 🟡 Графік рейтингу: пунктирна сітка, лише лінії, без заливки й точок, проста легенда.
- 🟡 Плитки «ALL-TIME»: радіус 10, без тіні, значення 22.

### 2.15 Досягнення

- 🔴 Список в одну колонку, згрупований за категоріями (рішення 2.0г).
- 🔴 Відкриті досягнення: ember-плита 40px. Зараз золото.
- 🔴 Закриті показують прогрес «86 / 100». Потрібні дані з бекенду.
- 🔴 Hero: «Achievements 11 / 21» і смуга прогресу з градієнтом.
- 🟡 Закриті: плитка rise із замком, у тій самій картці. Зараз окреме темне тло.
- 🟡 Дата: «Oct 13, 2026», праворуч, колір dust. Зараз золотими великими літерами.
- 🟡 Каталог: у дизайні є «Star gazer», немає «Splash of colour» і «New board». Узгодити.
- 🟡 Шапка й перемикач як у статистиці.

### 2.16 Лідерборд

- 🔴 **Розміщення.** Дизайн: окремий екран зі стрілкою назад, відкривається зі Stats. Див. 2.0а.
- 🔴 Одна згрупована картка замість окремих карток.
- 🔴 Без п'єдесталу: №1 як ember-плита, №2–3 як диски (рішення 2.0ґ).
- 🔴 Іконки у вкладках Rapid/Blitz/Bullet.
- 🟡 Перемикач Global/Friends на всю ширину, висота 38.
- 🟡 Мій рядок: легке ember-тло 0.12 і мітка «YOU». Текст для неї вже є.
- 🟡 Рейтинг просто числом 15/800, без іконки.
- 🟡 Ім'я 14/700, без @ніку. Країна як чип «UA» після імені.

### 2.17 Профіль

- 🔴 **Шапка.** «Profile» по центру, праворуч «Edit». Зараз ім'я, що з'являється при прокрутці, і кнопка «Поділитися».
- 🔴 **Одна кнопка «Friends · 2»** з кількістю друзів. Зараз дві кнопки, FRIENDS та EDIT.
- 🔴 **Картки рейтингу.** Норма й дельта: «Norm 1655» плюс «−15».
- 🔴 **Останні сесії й теплова карта** як на Головній і в статистиці (див. вище).
- 🟡 Графік рейтингу без заливки й точок.
- 🟡 Чипи «Peak 1664» і стрік-пігулка під «Joined…». Зараз рядок з іконками, стрік золотий.
- 🟡 Hero: аватар 64, порядок блоків за дизайном.

### 2.18 Налаштування

- 🔴 **Структура й редактор профілю:** див. рішення 2.0б і 2.0д.
- 🔴 **Профіль.** Під «Save changes» кнопки «Change password» (slate) і «Log out» (danger).
- 🔴 **Gameplay, рядки й групування.**
  - Без заголовків секцій.
  - Фігури в окремій картці, решта рядків в одній.
  - Звук, форма стрілки й автоперехід у застосунку свідомо прибрані: у дизайні їх треба позначити, а не додавати в застосунок (див. розділ 5).
- 🟡 Рядок аватара: ім'я й @нік, кнопка «Change avatar» праворуч.
- 🟡 Поле країни: лічильник «2/2», підказка під полем.
- 🟡 Кнопка «Save changes» велика, на всю ширину.
- 🟡 Плитки фігур на текстурі мармуру й сланцю, підпис «Classic» звичайним регістром.
- 🟡 Тексти підказок Focus, Streak і Mirror за дизайном.
- 🟡 Повтор онбордингу: картка з кнопкою «Show me». Скидання прогресу: картка з рожевим заголовком і danger-кнопкою. Текст скидання без «theme».

### 2.19 Сповіщення

- 🔴 **Час нагадування.** Чип «20:00» у тому ж рядку, що й перемикач. Зараз сітка з 24 годин.
- 🟡 Група «REMINDERS», рядок «Streak at risk / Only if you haven't played that day».
- 🟡 Шапка: тут дизайн суперечить іншим екранам (заголовок ліворуч, Cinzel 22). Треба обрати один варіант.

### 2.20 Низький пріоритет ⚪ (коротко)

- **Типографіка й форма:**
  - мітки 13px з трекінгом 1.5;
  - числа 28/800;
  - мітка поля 12px на відстані 8px;
  - рамка поля з помилкою кольору ember;
  - неактивне поле без загальної прозорості.
- **Сегменти й таб-бар:**
  - сегмент 40px з іконками, перемикається миттєво;
  - таб-бар 72px;
  - неактивна іконка Home ще й знебарвлена;
  - власна іконка Stats.
- **Логотип і вхід:**
  - сяйво логотипа на вході згасає в колір ink;
  - посилання «Create account» з ember-підкресленням;
  - плейсхолдери на вході;
  - менше сяйво логотипа в шапці, трекінг назви.
- **Головна й онбординг:**
  - лише 3 останні сесії замість 5;
  - пробіл у тисячах «1 664»;
  - зайві речення в текстах онбордингу.
- **Повзунок складності:**
  - градієнт зони комфорту;
  - заштрихована заблокована частина;
  - радіальний градієнт повзунка й ореол;
  - темне кільце мітки «floor»;
  - розміри підписів і легенди;
  - числа норми й ліміту кольору dust.
- **Сесія й дошка:**
  - коордінати 9px/800, розмір 0.16 клітинки;
  - віньєтка на дошці;
  - колір крапок ходів;
  - посадка коня в Classic.
- **Підсумок:** картки «Norm dropped» і «So close» мають радіус 14 і пульсацію рамки, заголовок 28.
- **Статистика й досягнення:**
  - кольори рівнів теплової карти;
  - типографіка міток карток;
  - скорочені назви тем;
  - типографський апостроф у «You've got a friend».
- **Лідерборд і профіль:** розміри рядків, аватар 34, номер місця кольору ash 14/800.
- **Налаштування:**
  - сегмент 34px, відступи рядків 14;
  - висота рядка поля біографії 22;
  - мітка «LANGUAGE» у картці;
  - відступи сторінок.

---

## 3. Яких екранів і станів немає в дизайні (додати в канвас)

Нові артборди:

| Екран / стан | Що показати | Сторінка канваса | Приклад стилю |
|---|---|---|---|
| Сплеш | Кінь із сяйвом на тлі ink, без тексту, плюс адаптивна іконка Android | Screens › Auth & onboarding | Блок логотипа з Login |
| Меню акаунта (аркуш) | Рядок «я», Profile / Friends / Settings, мова EN/УКР, Log out | Screens › Settings (якщо вкладки лишаються як у застосунку) | Аркуш радіус 16, рядки як у LIST ROWS |
| Аркуш стріка | Велике число з вогником, стан дня, заморозка, правила | Screens › Core loop | Картки SessionComplete |
| Аркуш виходу з сесії | «End session?», кнопки Save / Discard / Keep playing | Screens › Core loop, поруч із Paused | Як Paused, із завісою над дошкою |
| Церемонія рангу | Вгору й вниз, смуги рангів (tomoe / mangekyo / final), рішення щодо Share | Screens › Core loop, між Session і SessionComplete | Розділ CEREMONY із SoundLab |
| Історія сесій | Групи за днями, свайп для видалення, смуга Undo, порожній стан | Screens › Progress & social | Рядки «Recent sessions» з Головної |
| Деталі сесії | Плитки статистики, CTA «Review mistakes», список спроб | Screens › Progress & social | Сітка SessionComplete |
| Перегляд задачі | Дошка, кроки розв'язку з повзунком, Try again, посилання на Lichess, «не знайдено» | Screens › Progress & social | Правило розміщення з ReviewDrill |
| Аркуш досягнення | Відкрите й закрите, критерій, дата або прогрес | Screens › Progress & social | Як аркуш стріка |
| Друзі | Вхідні, надіслані, друзі, свайп «прийняти / відхилити», порожній стан | Screens › Progress & social | Рядки лідерборду |
| Пошук гравців (аркуш) | Поле пошуку, Add / Requested / Accept / Friends | Screens › Progress & social | Поле пошуку з Components |
| Індекс налаштувань | Згруповані рядки зі стрілками | Screens › Settings | Картки shade, NavRow |
| Звук і вібрація | Перемикачі, гучність, варіанти звуку подій | Screens › Settings | Рядки SettingsGameplay, повзунок із Play |
| Акаунт і видалення акаунта | Зміна пароля, вийти скрізь, видалення (вимога App Store) | Screens › Settings | Поля SettingsProfile плюс Danger |
| «Про застосунок» | Версія, ліцензії, конфіденційність | Screens › Settings | Блок бренду плюс рядки |
| Помилка / «нічого немає» | Текст і кнопки Retry / Home | Новий розділ System states | Ember- і slate-плити |
| Вибір фігури при перетворенні | Колонка з 4 фігур, обидва набори | Board (BoardStudio) | Набори Classic і Ember |
| Тост досягнення, офлайн-банер, блок «порожньо / завантаження / помилка», бейдж запитів на вкладці | Специмени | UI kit (Components) | TOAST, Navigation |
| Українська типографіка | Зразок кирилиці (Cinzel її не має) | Foundations | Шкала типографіки |

Стани, які краще додати як перемикачі на наявних артбордах:

| Артборд | Що додати |
|---|---|
| Login / Register | Стани idle, завантаження («Logging in…» / «Creating…»), помилка з трусінням; чекліст правил і неактивна кнопка; показати або сховати пароль |
| Home | Картка продовження сесії (Resume / Finish / Discard); новий користувач; стрік (зараховано / під загрозою / немає); офлайн; завантаження, помилка, порожньо; позначка верифікації |
| Play | Режим після калібрування з карткою «Next level up»; погана форма («Lower to…»); свій час; помилка старту; аркуш вибору теми, якщо він лишиться |
| Session | Смуга прогресу до підвищення рівня (3 критерії, «ready to unlock»); стани ходу (завантаження / хід суперника / серія / серію перервано); хід чорних; пульсація таймера; стани дошки (шах, підказки, спалахи, іскри, перетягування) |
| Paused | Текст після відновлення сесії |
| SessionComplete | Ранній вихід, комфортна сесія, калібрування завершено, важка сесія, тематична сесія; чип стріка (почато / продовжено / заморожено / скинуто) |
| Review | Порожній стан, скелетон, помилка; посилання «Session history» |
| ReviewDrill | Розв'язано, підказка, «Not quite — resetting…», готово, помилка; джерело (тема або помилки сесії) |
| Statistics | Підказки при прокрутці карти й графіка; порожні стани й помилки; радар і рекомендований фокус, якщо лишаються |
| Achievements | Мітка «NEW», завантаження, помилка |
| Profile | Чужий профіль: Add friend / pending / friend; «не знайдено»; немає сесій |
| Leaderboard | Закріплений рядок «я», порожній список друзів |
| SettingsApp | Підтвердження скидання прогресу |
| NotifSettings | Стан «зараз»: лише нагадування про стрік, вибір години, дозвіл заборонено, рядок наступного нагадування |

---

## 4. Що є в дизайні, але ще не реалізовано

- **Grow, щоденне:** ціль дня (кільце), щоденна задача (3 спроби, друзі), результат зі шер-карткою. Бекенду немає.
- **Puzzle Storm:** старт, забіг (комбо, життя), результат.
- **Виклики:** створення, вхідний виклик, гонка, спільна дошка, результат. Потрібен realtime.
- **Чат:** список розмов, тред із позиціями, надсилання позиції.
- **Офлайн-пакети:** завантаження, розв'язування з замороженим рейтингом, синхронізація.
- **Віддалені пуші:** виклики, повідомлення, щоденна задача, побитий рекорд, кнопки дій; тихі години в налаштуваннях сповіщень. Зараз є лише локальне нагадування про стрік.
- **У наявних екранах:** «Drill all» і смужки очищення в Review; прогрес закритих досягнень; Hint/Skip і смужка задач у сесії (після рішення); кнопка Share у церемонії рангу (є в SoundLab).
- **Лендинги (десктоп і мобільний):** це веб, фаза 12, не застосунок.

---

## 5. Рекомендація: один канвас чи окремий мобільний файл

**Один універсальний канвас.** Він уже орієнтований на телефон: усі екрани мають ширину 390. Окремий мобільний файл роздвоїть Foundations і Components, і вони почнуть розходитися.

Як організувати:

1. **Сторінки:**
   - Foundations;
   - UI kit (Components);
   - Board;
   - Screens з розділами Auth & onboarding · Core loop · Progress & social · Settings · System states;
   - Feel (лабораторія);
   - Grow, позначена як «майбутнє»;
   - Landing (веб).
2. **Спершу закрити суперечності всередині дизайну:**
   - один таб-бар (зараз 4 вкладки на аркуші компонентів і 6 на екранах);
   - одна специфікація дошки (Session проти BoardStudio);
   - один перемикач (46×26 проти 44×26);
   - одна шапка (по центру 17 проти ліворуч 22);
   - один варіант hero-картки й завіси.
3. **Позначити елементи «тільки веб»** прямо на артбордах, а не видаляти їх: «Install to Home Screen», форма стрілки коня, автоперехід у Review, малювання стрілок на дошці.
4. **Відмінності iOS і Android** показувати перемикачами або примітками (системний аркуш дій, хваталка аркуша, кнопка «назад» Android), а не окремими фреймами.
5. **Стани додавати перемикачами** на наявних артбордах. Нові фрейми лише для екранів із таблиці розділу 3.
6. **Окремий мобільний файл не потрібен.** Виняток: якщо колись з'явиться планшетний макет, його варто винести окремою сторінкою.

---

## 6. Developer appendix (high/medium, with files)

Paths are relative to the repo root (`apps/mobile/src/...` unless stated).

**Design system / primitives**
- PlateButton: no icon slot; disabled veil, loading and inner padding differ from the design: `ui/PlateButton.tsx:26-27,65-85,125,138-163,180-183`
- Missing primitives (tertiary/ghost/danger/icon button, checkbox, radio, underline tabs, chip, pill, progress, steps, stat tile, grouped list, banner, dialog, pushed header): `ui/index.ts`. Hand-rolled copies: `features/home/HomeScreen.tsx:261`, `features/social/MiniButton.tsx:59-68`, `features/home/ResumeCard.tsx:98-127`, `shell/AccountMenu.tsx:85-93,128-136`, `features/settings/GameplayScreen.tsx:177`, `features/settings/SoundScreen.tsx:171`, `features/settings/NotificationsScreen.tsx:92`
- Toast: `shell/toast/ToastHost.tsx:154-218`
- Dialog: native Alert at `features/home/ResumeCard.tsx:57`, `features/social/actions.ts`, `features/profile/ProfileEditorSheet.tsx`, `features/profile/avatarUpload.ts`
- Typography: `packages/core/src/tokens/type.ts:80-100`, `ui/AppText.tsx:63`
- Card surface: `ui/Surfaces.tsx:49-69`, `packages/core/src/tokens/layout.ts:12`, `packages/core/src/tokens/shadows.ts:25-33`
- Vignette unused: `packages/core/src/tokens/colors.ts:106`
- Input focus ring and search variant: `ui/Input.tsx:45-58,133-142`, `features/social/UserSearchSheet.tsx:58,186`
- Toggle: `ui/Toggle.tsx:67-82`, `packages/core/src/tokens/layout.ts:71`, `packages/core/src/tokens/colors.ts:131`, `packages/core/src/tokens/shadows.ts:42`
- StreakBadge pill: `features/social/StreakBadge.tsx:27-41` (tokens at `colors.ts:141-142`)
- ProgressBar: `features/play/ui.tsx:64-85`. Rank gradient: `colors.ts:145`
- NoteCard / feedback banners: `features/play/ui.tsx:33-39,82`
- Delta pills: `features/home/StyleRatingCard.tsx:36-46`, `features/sessions/SessionRow.tsx:176-183`
- Settings row typography: `features/settings/parts.tsx:99-111,248-267`. Leaderboard names: `features/social/UserIdentity.tsx:20-30`
- Missing tokens: #262428, #2b292e, #e4a6a0, #bccbb5, the button and danger state colours, the #592628→#a64241 gradient and the ember 0.12 tint. All go in `packages/core/src/tokens/colors.ts`.

**Shell**
- Tab set: `shell/tabs.ts:3-9`, `app/(app)/(tabs)/_layout.tsx:28-32`, `shell/TabBar.tsx` (DECISIONS #3 PROVISIONAL)
- Pushed header: `app/(app)/_layout.tsx:38-51`
- Tab header streak pill: `shell/ShellHeader.tsx:41-49`

**Auth / onboarding**
- Login card, layout, wordmark and subtitle: `features/auth/LoginScreen.tsx:64-138`
- Register header, card and placeholders: `features/auth/RegisterScreen.tsx:74-138`. Possible bug: the rules show as met on an empty nickname (`RegisterScreen.tsx:101,148-161`)
- Onboarding top bar, illustration, text, dots and buttons: `features/onboarding/OnboardingScreen.tsx:36-45,103-168,194-248`

**Home**
- Streak: `features/home/HomeScreen.tsx:125`, `features/home/HomeStreak.tsx:51-75`
- Hero / quick start: `features/home/HomeScreen.tsx:130-156,239-251`
- Rating tile delta and styling: `features/home/StyleRatingCard.tsx:19-56`, `HomeScreen.tsx:252`
- Recent sessions list and heading: `features/sessions/SessionRow.tsx:130-226`, `HomeScreen.tsx:181-223`

**Play setup**
- Inline theme list vs sheet: `features/play/setup/PlaySetupScreen.tsx:348-368`, `features/play/themes/ThemePickerSheet.tsx`
- Calibrated preview: `features/play/setup/Previews.tsx:21-96`
- Start dock: `PlaySetupScreen.tsx:391-409`. Style tab icons: `PlaySetupScreen.tsx:174-181,415-441`, `ui/Segmented.tsx:20`
- Calibration hint: `PlaySetupScreen.tsx:206-213`. Title: `PlaySetupScreen.tsx:166`
- Theme sub-tabs, rows and search: `ThemePickerSheet.tsx:43,132-162,186-195,234-249`

**Session runner / pause / summary**
- Hint/Skip and step strip (product decision): `features/play/runner/RunnerScreen.tsx:166-175`, `features/play/runner/parts.tsx:102-137`, `features/play/runner/progress.tsx:26`
- Turn header: `parts.tsx:55-83,154-173`
- Top bar and timer: `RunnerScreen.tsx:120-136`, `runner/Countdown.tsx:126-140`
- Board gutter and shadow: `RunnerScreen.tsx:149-158,234-236`, `board/Board.tsx:1040`
- Calibration card: `RunnerScreen.tsx:146,213-222`, `progress.tsx:14-32,86-94`
- Pause End session, composition, typography and Resume: `features/play/runner/overlays.tsx:24-47,117`
- Summary hero, strip, buttons, review card and tiles: `features/play/runner/Summary.tsx:35-44,130-132,154-231`
- Rise card: `features/play/runner/outcomeCards.tsx:90-118,160-166`, `features/play/ui.tsx:36`

**Board**
- Highlights: `packages/core/src/tokens/colors.ts:157-160`, `board/Layers.tsx:371-372`
- Arrows: `packages/core/src/board/arrows.ts:10-14`, `board/Layers.tsx:354-367`, `colors.ts:167`
- Surface and default set: `board/assets.ts:40`, `tools/assets/bake-board.py:3`, `stores/appStore.ts:28`

**Review / drill**
- Hero, grouped list, row typography and title: `features/review/ReviewTabScreen.tsx:87-97,243-257`
- Clearing bars need data: `packages/core/src/runner/modes/selectors.ts:21` (additive backend field)
- Subtitle: `packages/core/src/i18n/areas/review.en.ts:8`
- Board y position: `packages/core/src/tokens/layout.ts:58`, `features/review/DrillScreen.tsx:207`, `features/sessions/MistakesScreen.tsx:200`
- Board width: `features/review/practice/PracticeBoard.tsx:77`
- Hint plate / Skip: `features/review/practice/parts.tsx:110-132,220-235`
- Top bar: `DrillScreen.tsx:158-177`, `MistakesScreen.tsx:131-158,201-203`
- Turn row and themes line: `features/review/practice/parts.tsx:50-108`
- Tally: `MistakesScreen.tsx:162-179` (missing in DrillScreen)

**Stats / achievements**
- Radar vs bars, theme rows, recommend card: `features/stats/StatsView.tsx:54-58,153-177,258-365,404-405`
- Header / underline tabs: `features/stats/StatsScreen.tsx:22-33`
- Style filter: `StatsView.tsx:94-101`
- Heatmap: `features/stats/ActivityHeatmap.tsx:28-37,228-243`, `StatsView.tsx:127`
- Rating chart: `features/stats/RatingHistoryChart.tsx:41-47,198-298,352`
- All-time tiles: `StatsView.tsx:204-250,374-375`
- Achievements list, ember plates and header card: `features/achievements/AchievementsGrid.tsx:136-207,239-313`
- Progress data: `packages/core/src/catalogs/achievements.ts:18-24` (additive backend field)
- Catalogue: `features/achievements/api.ts:16`

**Social / profile / settings / notifications**
- Leaderboard placement: `features/social/SocialScreen.tsx:27-36`, `shell/tabs.ts:8`
- Leaderboard rows, podium and self row: `features/social/LeaderboardView.tsx:67-91,169-297`
- Leaderboard YOU tag: unused key at `packages/core/src/i18n/areas/social.en.ts:29`
- Profile header and share: `features/profile/ProfileScreen.tsx:99-118,213-228`
- Profile actions, norm delta, recent, meta and hero: `ProfileScreen.tsx:173,258-315,343-386,399-408`
- Settings IA: `features/settings/SettingsIndexScreen.tsx:40-209`, `shell/AccountMenu.tsx:66`
- Settings profile and editor: `features/settings/ProfileScreen.tsx:34-68`, `features/profile/ProfileEditorSheet.tsx:139-223`
- Settings account: `features/settings/AccountScreen.tsx:51`
- Gameplay rows, grouping, piece tiles and copy: `features/settings/GameplayScreen.tsx:18-95,183-225`
- Notifications time chip and copy: `features/settings/NotificationsScreen.tsx:28-30,83-110,165-177`

**App screenshots**
- Auth / Home / menu / onboarding: `/private/tmp/claude-501/-Users-alexkolesnik-tac-tic-tak/343a2bab-243f-40fb-b381-267136575a43/scratchpad/fc/` (`login_s.png`, `register_s.png`, `home_s.png`, `menu_s.png`, `onb1_s.png`)
- Play / session / summary: `/private/tmp/claude-501/-Users-alexkolesnik-tac-tic-tak/343a2bab-243f-40fb-b381-267136575a43/scratchpad/flows/shots-play/`
- Review / stats / achievements: `/private/tmp/claude-501/-Users-alexkolesnik-tac-tic-tak/343a2bab-243f-40fb-b381-267136575a43/scratchpad/rv/png/`
- Social / profile / settings: `/private/tmp/claude-501/-Users-alexkolesnik-tac-tic-tak/343a2bab-243f-40fb-b381-267136575a43/scratchpad/mine/` (`lb.png`, `prof.png`, `set.png`, `game.png`)