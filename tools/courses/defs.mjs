// Course definitions: chapters, puzzle selection rules and every word the
// player reads (tips, intros, diagram captions) in English and Ukrainian.
// build.mjs selects the puzzles; check.mjs is the gate. README.md has the rules.

const L = (en, uk) => ({ en, uk });
const mv = (from, to) => ({ from, to, kind: 'move' });
const th = (from, to) => ({ from, to, kind: 'threat' });

/** Tags that say nothing about the tactic: never count against a "clean" example. */
export const STRUCTURAL = new Set([
  'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
  'oneMove', 'short', 'long', 'veryLong',
  'opening', 'middlegame', 'endgame',
  'crushing', 'advantage', 'equality',
  'master', 'masterVsMaster', 'superGM',
]);

/** Endgame-phase tags: structural inside the Endgames course only. */
export const ENDGAME_PHASE = new Set([
  'pawnEndgame', 'rookEndgame', 'knightEndgame', 'bishopEndgame', 'queenEndgame', 'queenRookEndgame',
]);

/** Descriptive rather than a second motif: count half. */
export const SOFT = new Set([
  'kingsideAttack', 'queensideAttack', 'exposedKing', 'advancedPawn', 'castling', 'enPassant',
  'backRankMate', 'smotheredMate', 'anastasiaMate', 'arabianMate', 'bodenMate', 'hookMate',
  'dovetailMate', 'doubleBishopMate', 'epauletteMate', 'balestraMate', 'blindSwineMate', 'cornerMate',
  'killBoxMate', 'morphysMate', 'operaMate', 'pillsburysMate', 'swallowstailMate', 'triangleMate',
  'vukovicMate',
]);

/** Quality floors, strictest first; a chapter steps down only when it cannot fill. */
export const FLOORS = [
  { popularity: 92, nbPlays: 800, ratingDeviation: 80 },
  { popularity: 90, nbPlays: 500, ratingDeviation: 80 },
  { popularity: 88, nbPlays: 300, ratingDeviation: 80 },
];

export const CHAPTER_SIZE = 15;
export const EXAM_SIZE = 30;
export const PASS_MARK = 24;

const PATTERNS = [
  'smotheredMate', 'anastasiaMate', 'arabianMate', 'bodenMate',
  'hookMate', 'dovetailMate', 'doubleBishopMate', 'epauletteMate',
];

// Chapter fields: id, theme (icon + exam breakdown), band [lo, hi], optional
// select (theme slugs any of which qualifies; default [theme]), free (tags
// that do not count against cleanliness), prefer (tags that rank a candidate
// up), variety (spread picks over the select slugs), then the words.

export const COURSES = [
  {
    id: 'basic',
    band: [400, 1400],
    chapters: [
      {
        id: 'basic-hanging',
        theme: 'hangingPiece',
        band: [400, 1300],
        title: L('Hanging piece', 'Висяча фігура'),
        tip: L('First the simple check: what is left undefended?', 'Спершу проста перевірка: що стоїть без захисту?'),
        intro: {
          text: L(
            'A hanging piece is one that nobody defends. Before you look for anything clever, check every enemy piece: can you simply take one for free? And before your own move, make sure you are not leaving anything of yours unprotected.',
            'Висяча фігура — та, яку ніхто не захищає. Перш ніж шукати щось хитре, переглянь усі фігури суперника: чи не можна якусь просто забрати задарма? А перед власним ходом переконайся, що сам нічого не залишаєш без захисту.',
          ),
          fen: '6k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1',
          arrows: [mv('d1', 'd5')],
          caption: L('Rxd5: the knight on d5 had no defender — a free piece.', 'Rxd5: кінь на d5 без захисту — фігура дістається задарма.'),
        },
      },
      {
        id: 'basic-mate1',
        theme: 'mateIn1',
        band: [400, 1300],
        title: L('Mate in 1', 'Мат в 1 хід'),
        tip: L('Try every check: one of them ends the game.', 'Перебери всі шахи — один із них закінчує партію.'),
        intro: {
          text: L(
            'Checkmate is a check with no way out: the king cannot step away, block or capture the checking piece. Here one move is enough. Look at every check you have and ask where the king could go.',
            'Мат — це шах, від якого немає порятунку: король не може відійти, закритися чи побити фігуру, що шахує. Тут вистачає одного ходу. Переглянь усі свої шахи й подивися, куди може піти король.',
          ),
          fen: 'r5k1/5p1p/6pQ/8/8/8/1B3PPP/6K1 w - - 0 1',
          arrows: [mv('h6', 'g7'), th('b2', 'g7')],
          caption: L('Qg7#: the bishop on b2 guards the queen, and the king has nowhere to go.', 'Qg7#: слон з b2 захищає ферзя, а королю нікуди відступити.'),
        },
      },
      {
        id: 'basic-fork',
        theme: 'fork',
        band: [500, 1400],
        title: L('Fork', 'Вилка'),
        tip: L('One piece, two targets. Look for checks first.', 'Одна фігура — дві цілі. Почни з шахів.'),
        intro: {
          text: L(
            'One piece attacks two targets at once. Your opponent can save only one — the other is yours. Knights are the classic forkers, but any piece can do it.',
            'Одна фігура нападає одразу на дві цілі. Суперник встигне врятувати лише одну — друга дістанеться тобі. Класичні майстри вилки — коні, але її може зробити будь-яка фігура.',
          ),
          fen: 'r3k3/7p/8/3N4/8/8/6PP/4K3 w - - 0 1',
          arrows: [mv('d5', 'c7'), th('c7', 'a8'), th('c7', 'e8')],
          caption: L('Nc7+ hits the king and the rook — Black must move the king, and the rook falls.', 'Nc7+ нападає на короля й туру — чорні мусять відійти королем, і тура гине.'),
        },
      },
      {
        id: 'basic-pin',
        theme: 'pin',
        band: [500, 1400],
        title: L('Pin', 'Зв’язка'),
        tip: L('A pinned piece cannot run. Attack it again.', 'Зв’язана фігура не може втекти — атакуй її ще раз.'),
        intro: {
          text: L(
            'A pin holds a piece in place: if it moves, a more valuable piece behind it is exposed. When the piece behind is the king, the pinned piece may not move off the line at all. Pin it, then attack it again.',
            'Зв’язка прикуває фігуру до місця: якщо вона зрушить, відкриється цінніша фігура позаду. Коли позаду король, зв’язаній фігурі взагалі не можна зійти з лінії. Зв’яжи її — і атакуй ще раз.',
          ),
          fen: '6k1/pb4pp/8/3q4/8/1P6/6PP/2Q2BK1 w - - 0 1',
          arrows: [mv('f1', 'c4'), th('c4', 'g8')],
          caption: L('Bc4 pins the queen to the king: it cannot leave the diagonal, and Black loses the queen for a bishop.', 'Bc4 зв’язує ферзя з королем: зійти з діагоналі він не може, і чорні віддають ферзя за слона.'),
        },
      },
      {
        id: 'basic-skewer',
        theme: 'skewer',
        band: [500, 1400],
        title: L('Skewer', 'Лінійний удар'),
        tip: L('Attack the bigger piece; collect the one behind it.', 'Атакуй цінну фігуру — і забирай ту, що за нею.'),
        intro: {
          text: L(
            'A skewer is a pin turned around: you attack a valuable piece, it steps aside, and you take the piece standing behind it. It works best with a check, because the king has to move.',
            'Лінійний удар — це зв’язка навпаки: ти нападаєш на цінну фігуру, вона відходить, а ти забираєш ту, що стояла позаду. Найкраще він працює з шахом, бо король мусить піти.',
          ),
          fen: 'r7/8/2k5/7p/8/8/5P1P/4KB2 w - - 0 1',
          arrows: [mv('f1', 'g2'), th('g2', 'a8')],
          caption: L('Bg2+: the king has to step off the diagonal, and the rook on a8 falls.', 'Bg2+: король мусить зійти з діагоналі — і тура на a8 гине.'),
        },
      },
      {
        id: 'basic-discovered',
        theme: 'discoveredAttack',
        band: [500, 1400],
        title: L('Discovered attack', 'Відкритий напад'),
        tip: L('Move one piece, and the one behind it strikes.', 'Зрушиш одну фігуру — вдарить та, що позаду.'),
        intro: {
          text: L(
            'In a discovered attack you move one piece out of the way and uncover an attack by another. Now two threats land at once: the piece that moved can attack or give check, and the one behind it strikes too. The opponent can rarely meet both.',
            'У відкритому нападі ти відводиш одну фігуру з лінії й відкриваєш атаку іншої. Тепер загроз дві одночасно: фігура, що зробила хід, може напасти чи дати шах, а та, що позаду, б’є теж. Відбити обидві суперникові рідко вдається.',
          ),
          fen: '6k1/4qppp/8/8/4B3/8/5PPP/4R1K1 w - - 0 1',
          arrows: [mv('e4', 'h7'), th('h7', 'g8'), th('e1', 'e7')],
          caption: L('Bxh7+ checks the king and opens the e-file: the queen on e7 falls.', 'Bxh7+ шахує короля й відкриває вертикаль e: ферзь на e7 гине.'),
        },
      },
      {
        id: 'basic-backrank',
        theme: 'backRankMate',
        band: [500, 1400],
        title: L('Back-rank mate', 'Мат на останній горизонталі'),
        tip: L('King boxed in by its own pawns? Check the back rank.', 'Король замкнений власними пішаками? Перевір останню горизонталь.'),
        intro: {
          text: L(
            'A king behind an unmoved row of pawns has no way out. A rook or queen landing on the back rank gives mate unless something guards it. Look for checks on the last rank, and remove the defender first if you have to.',
            'Король за нерухомим рядом пішаків не має куди відступити. Тура чи ферзь, що вриваються на останню горизонталь, ставлять мат, якщо її ніхто не захищає. Шукай шахи по останній горизонталі, а коли треба — спершу прибери захисника.',
          ),
          fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
          arrows: [mv('d1', 'd8')],
          caption: L('Rd8#: the pawns on f7, g7 and h7 lock their own king in.', 'Rd8#: пішаки f7, g7 і h7 замикають власного короля.'),
        },
      },
      {
        id: 'basic-trapped',
        theme: 'trappedPiece',
        band: [500, 1400],
        title: L('Trapped piece', 'Ловля фігури'),
        tip: L('No safe squares? Attack it, and it is yours.', 'Фігурі нікуди йти? Атакуй — і вона твоя.'),
        intro: {
          text: L(
            'A piece is trapped when every square it can go to is covered. Then you do not have to chase it: take away its last exits and win it next move. Pieces that wander deep into enemy territory are the usual victims.',
            'Фігура спіймана, коли всі поля, куди вона може піти, під боєм. Ганятися за нею не треба: забери останні виходи, і наступним ходом вона твоя. Найчастіше в пастку потрапляють фігури, що забралися глибоко в табір суперника.',
          ),
          fen: '6k1/5pp1/7p/8/8/8/bPP2PPP/3R2K1 w - - 0 1',
          arrows: [mv('b2', 'b3'), th('d1', 'b1')],
          caption: L('b3 shuts the bishop in: b1 is covered by the rook, and the bishop on a2 will be lost.', 'b3 замикає слона: поле b1 б’є тура, і слон на a2 пропаде.'),
        },
      },
      {
        id: 'basic-defender',
        theme: 'capturingDefender',
        band: [600, 1400],
        title: L('Remove the defender', 'Знищення захисника'),
        tip: L('What holds the position together? Take that piece first.', 'Що тримає позицію? Спершу знищ цю фігуру.'),
        intro: {
          text: L(
            'Sometimes the target is protected, but only once. Capture the defender — even if it costs you something — and the target is left hanging. Ask yourself what each enemy piece is guarding.',
            'Буває, що ціль захищена, але лише одним захисником. Побий його, навіть якщо це чогось коштує, — і ціль залишиться беззахисною. Питай себе, що саме охороняє кожна фігура суперника.',
          ),
          fen: '6k1/5ppp/5n2/3b2B1/8/8/5PPP/3R2K1 w - - 0 1',
          arrows: [mv('g5', 'f6'), th('d1', 'd5')],
          caption: L('Bxf6 removes the knight that guarded d5 — the bishop there is lost.', 'Bxf6 знищує коня, що захищав d5, — слон на d5 пропадає.'),
        },
      },
      {
        id: 'basic-mate2',
        theme: 'mateIn2',
        band: [600, 1400],
        title: L('Mate in 2', 'Мат у 2 ходи'),
        tip: L('Find the move after which mate cannot be stopped. Checks first, then quiet moves.', 'Знайди хід, після якого мат неминучий. Спершу шахи, потім тихі ходи.'),
        intro: {
          text: L(
            'Mate in two: after your first move the opponent can no longer stop the mate. Often that first move is a check that drives the king into a net; sometimes it is a quiet move that takes away its last escape. Check every reply before you play.',
            'Мат у 2 ходи: після першого ходу суперник уже не може захиститися від мату. Часто перший хід — шах, що заганяє короля в сітку, а часом — тихий хід, який забирає останню втечу. Перш ніж ходити, перевір усі відповіді суперника.',
          ),
          fen: '6k1/8/8/8/8/8/8/RR4K1 w - - 0 1',
          arrows: [mv('a1', 'a7'), th('b1', 'b8')],
          caption: L('Ra7 locks the king on the back rank; next move the other rook mates on b8.', 'Ra7 замикає короля на останній горизонталі; наступним ходом друга тура ставить мат на b8.'),
        },
      },
    ],
  },

  {
    id: 'intermediate',
    band: [1100, 1900],
    chapters: [
      {
        id: 'intermediate-attraction',
        theme: 'attraction',
        band: [1100, 1900],
        title: L('Attraction', 'Заманювання'),
        tip: L('Give something to pull a piece onto the wrong square.', 'Пожертвуй, щоб заманити фігуру на погане поле.'),
        intro: {
          text: L(
            'Attraction is a sacrifice that forces an enemy piece — often the king — onto a square where a fork, a pin or a mate is waiting. The opponent has to take, and that is exactly the point. Ask which square you would like their piece to stand on.',
            'Заманювання — це жертва, яка змушує фігуру суперника, часто короля, стати на поле, де на неї чекає вилка, зв’язка чи мат. Суперник мусить брати — у цьому й задум. Подумай, на якому полі тобі хотілося б бачити його фігуру.',
          ),
          fen: '3q2k1/5p1p/6p1/3N4/8/8/1B3PPP/4R1K1 w - - 0 1',
          arrows: [mv('e1', 'e8'), th('d5', 'f6')],
          caption: L('Re8+ drags the queen to e8, where a knight fork from f6 is waiting.', 'Re8+ заманює ферзя на e8 — а там на нього чекає вилка конем з f6.'),
        },
      },
      {
        id: 'intermediate-deflection',
        theme: 'deflection',
        band: [1100, 1900],
        title: L('Deflection', 'Відволікання'),
        tip: L('Find the defender, then give it a reason to leave.', 'Знайди захисника — і дай йому привід піти.'),
        intro: {
          text: L(
            'Deflection drives a defender away from the square or piece it must guard. Offer it a capture or hit it with a threat; once it leaves, whatever it was holding collapses. Typical targets: the piece that guards the back rank or a key square near the king.',
            'Відволікання змушує захисника покинути поле чи фігуру, яку він мусить охороняти. Запропонуй йому взяття або нападай на нього — щойно він піде, захист розвалиться. Типові цілі: фігура, що тримає останню горизонталь, або важливе поле біля короля.',
          ),
          fen: '3q1rk1/ppp2ppp/5n2/6N1/4P3/7Q/PPP2PPP/4R1K1 w - - 0 1',
          arrows: [mv('e4', 'e5'), th('e5', 'f6'), th('h3', 'h7')],
          caption: L('e5 hits the knight that guards h7: once it moves, the queen mates on h7.', 'e5 нападає на коня, що захищає h7: щойно він піде, ферзь поставить мат на h7.'),
        },
      },
      {
        id: 'intermediate-doublecheck',
        theme: 'doubleCheck',
        band: [1100, 1900],
        title: L('Double check', 'Подвійний шах'),
        tip: L('Two checks at once: only the king can move.', 'Два шахи разом — рятуватися може лише король.'),
        intro: {
          text: L(
            'A double check is a discovered check in which the moving piece gives check too. No block or capture can answer two checks at once, so the king must move — and if it has no square, it is mate. The checking pieces may even stand where they can be taken.',
            'Подвійний шах — це відкритий шах, коли фігура, що ходить, теж шахує. Закритися чи побити від двох шахів одночасно не можна, тож король мусить піти, а якщо нікуди — це мат. Фігури, що дають шах, можуть навіть стояти під боєм.',
          ),
          fen: '3qkb2/p2p1ppp/8/8/4N3/8/5PPP/4R1K1 w - - 0 1',
          arrows: [mv('e4', 'd6'), th('d6', 'e8'), th('e1', 'e8')],
          caption: L('Nd6#: knight and rook both give check; the king cannot move, and no one can capture two checkers.', 'Nd6#: шахують і кінь, і тура; королю нікуди піти, а побити обидві фігури, що шахують, неможливо.'),
        },
      },
      {
        id: 'intermediate-intermezzo',
        theme: 'intermezzo',
        band: [1100, 1900],
        title: L('In-between move', 'Проміжний хід'),
        tip: L('Before the obvious recapture, look for a stronger move.', 'Перш ніж брати назад, пошукай сильніший хід.'),
        intro: {
          text: L(
            'An in-between move is played instead of the move everyone expects, usually a recapture. A check or a bigger threat comes first; the recapture can wait, because it is not going anywhere. Before taking back, always ask: is there a check first?',
            'Проміжний хід робиться замість очевидного, найчастіше замість взяття у відповідь. Спершу шах або сильніша загроза, а відбити фігуру можна й потім — вона нікуди не дінеться. Перш ніж брати назад, спитай себе: а чи немає спершу шаху?',
          ),
          fen: '3r2k1/5pp1/7p/8/8/8/4qPPP/3RR1K1 w - - 0 1',
          arrows: [mv('d1', 'd8'), th('e1', 'e2')],
          caption: L('Rxd8+ first: after the king steps away, the rook on e1 takes the queen and White is a rook up.', 'Спершу Rxd8+: король відходить, тура з e1 забирає ферзя — і в білих зайва тура.'),
        },
      },
      {
        id: 'intermediate-clearance',
        theme: 'clearance',
        band: [1100, 1900],
        title: L('Clearance', 'Звільнення лінії'),
        tip: L('Your own piece is in the way? Move it with a threat.', 'Власна фігура заважає? Прибери її із загрозою.'),
        intro: {
          text: L(
            'Sometimes your own piece blocks the line or square another piece needs. Clearance moves it out of the way, ideally with a check or a threat, so the opponent has no time to react. The square it leaves is often more important than the one it goes to.',
            'Буває, що власна фігура перекриває лінію чи поле, потрібне іншій. Звільнення лінії прибирає її з дороги, найкраще з шахом або загрозою, щоб суперник не встиг відреагувати. Поле, яке вона звільняє, часто важливіше за те, куди вона йде.',
          ),
          fen: '6k1/pp3ppp/8/3N4/8/8/P4PPP/3Q2K1 w - - 0 1',
          arrows: [mv('d5', 'e7'), th('e7', 'g8'), th('d1', 'd8')],
          caption: L('Ne7+ clears the d-file with check — next the queen mates on d8.', 'Ne7+ звільняє вертикаль d із шахом — далі ферзь ставить мат на d8.'),
        },
      },
      {
        id: 'intermediate-interference',
        theme: 'interference',
        band: [1100, 1900],
        title: L('Interference', 'Перекриття'),
        tip: L('Drop a piece between a defender and what it guards.', 'Постав фігуру між захисником і тим, що він охороняє.'),
        intro: {
          text: L(
            'Interference cuts a line of defence. You place a piece on the path between an enemy defender and the square it protects; even if it can be captured, taking it costs the defence. Look for the lines that hold the opponent’s position together.',
            'Перекриття розриває лінію захисту. Ти ставиш фігуру на шляху між захисником суперника й полем, яке він охороняє; навіть якщо її можна побити, взяття руйнує захист. Шукай лінії, на яких тримається позиція суперника.',
          ),
          fen: 'r7/4P1kp/6p1/8/8/8/5PPP/3R2K1 w - - 0 1',
          arrows: [mv('d1', 'd8'), th('e7', 'e8')],
          caption: L('Rd8 cuts the rook on a8 off from e8 — the pawn queens whatever Black does.', 'Rd8 перекриває турі a8 шлях до e8 — пішак у будь-якому разі стане ферзем.'),
        },
      },
      {
        id: 'intermediate-f7',
        theme: 'attackingF2F7',
        band: [1100, 1900],
        title: L('Attacking f2 and f7', 'Удар на f2 і f7'),
        tip: L('Early in the game, f7 and f2 are guarded only by the king.', 'На початку партії f7 і f2 захищає лише король.'),
        intro: {
          text: L(
            'In the opening, f7 (and f2 for White) is the weakest square: only the king defends it. A bishop on c4 and a queen or knight joining in can strike there, often with check. Keep an eye on it from both sides of the board.',
            'У дебюті f7 (а для білих f2) — найслабше поле: його захищає лише король. Слон із c4 разом із ферзем чи конем можуть ударити туди, часто з шахом. Стеж за цим полем з обох боків дошки.',
          ),
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w - - 0 4',
          arrows: [mv('h5', 'f7'), th('c4', 'f7')],
          caption: L('Qxf7#: f7 was guarded only by the king, and the bishop backs up the queen.', 'Qxf7#: поле f7 захищав лише король, а слон підтримує ферзя.'),
        },
      },
      {
        id: 'intermediate-promotion',
        theme: 'promotion',
        band: [1100, 1900],
        free: ['advancedPawn'],
        title: L('Promotion', 'Перетворення пішака'),
        tip: L('One step from queening? Find the move that clears the way.', 'Пішакові лишився крок? Знайди хід, що розчистить йому шлях.'),
        intro: {
          text: L(
            'A pawn on the seventh rank is worth almost a queen, and the opponent knows it. The tactics here clear the promotion square: deflect the blocker, cut off the defender or promote with check. Count what happens once the new queen appears.',
            'Пішак на сьомій горизонталі вартий майже ферзя, і суперник це знає. Тактика тут розчищає поле перетворення: відволічи фігуру, що заступає дорогу, відріж захисника або перетвори пішака з шахом. Порахуй, що буде, коли з’явиться новий ферзь.',
          ),
          fen: '2r5/2P2pk1/1P5p/8/8/8/6PP/3R2K1 w - - 0 1',
          arrows: [mv('d1', 'd8'), th('d8', 'c8'), th('c7', 'd8')],
          caption: L('Rd8 attacks the rook in the pawn’s way: if it takes, the pawn recaptures on d8 and becomes a queen.', 'Rd8 нападає на туру, що стоїть на шляху пішака: якщо вона візьме, пішак б’є на d8 і стає ферзем.'),
        },
      },
      {
        id: 'intermediate-defence',
        theme: 'defensiveMove',
        band: [1100, 1900],
        title: L('Defence', 'Захист'),
        tip: L('First ask what your opponent is threatening.', 'Спершу спитай себе, чим загрожує суперник.'),
        intro: {
          text: L(
            'Not every puzzle is an attack. Here your opponent has a threat, and you must find the move that holds — often the only one that does not lose. Before looking for your own ideas, ask what the opponent wants to do next.',
            'Не кожна задача — атака. Тут у суперника є загроза, і треба знайти хід, що втримає позицію, — часто єдиний, що не програє. Перш ніж шукати власні ідеї, спитай себе, що суперник хоче зробити далі.',
          ),
          fen: '3r2k1/1R3ppp/8/8/P7/1p6/5PPP/6K1 w - - 0 1',
          arrows: [mv('h2', 'h3')],
          caption: L('h3 gives the king a square: a rook check on the back rank is no longer mate.', 'h3 дає королю вільне поле: шах турою по першій горизонталі вже не мат.'),
        },
      },
      {
        id: 'intermediate-patterns',
        theme: 'smotheredMate',
        band: [1000, 1900],
        select: PATTERNS,
        free: PATTERNS,
        variety: true,
        title: L('Mating patterns', 'Матові візерунки'),
        tip: L('Learn the picture: the same mating net turns up again and again.', 'Запам’ятай малюнок: ця матова сітка повторюється знову й знову.'),
        intro: {
          text: L(
            'Some mates have names because they keep coming back: the smothered mate, Anastasia’s, the Arabian, Boden’s and more. Each is a picture — a few pieces in a fixed arrangement around the king. Once you know the picture, you will spot it in your own games.',
            'Деякі мати мають назви, бо трапляються знову й знову: спертий мат, мат Анастасії, арабський, мат Бодена та інші. Кожен із них — це малюнок: кілька фігур у певному розташуванні навколо короля. Знаючи малюнок, ти помітиш його й у своїх партіях.',
          ),
          fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
          arrows: [mv('g5', 'f7'), th('f7', 'h8')],
          caption: L('Nf7#: the king is walled in by its own pieces — a smothered mate.', 'Nf7#: король замурований власними фігурами — спертий мат.'),
        },
      },
      {
        id: 'intermediate-mate3',
        theme: 'mateIn3',
        band: [1000, 1900],
        title: L('Mate in 3', 'Мат у 3 ходи'),
        tip: L('Forcing moves first: checks, captures, threats.', 'Спершу форсовані ходи: шахи, взяття, загрози.'),
        intro: {
          text: L(
            'Mate in three asks you to see a little further: three of your moves, with the opponent’s replies in between. Start with the most forcing moves — checks and sacrifices — because they leave the fewest replies to calculate.',
            'Мат у 3 ходи вимагає бачити трохи далі: три твої ходи й відповіді суперника між ними. Починай із найбільш форсованих — шахів і жертв, — бо після них найменше відповідей треба прорахувати.',
          ),
          fen: '5rk1/pp3ppp/8/3N3Q/8/4R3/5PPP/6K1 w - - 0 1',
          arrows: [mv('d5', 'e7'), th('e7', 'g8'), th('h5', 'h7')],
          caption: L('Ne7+ drives the king to h8; then a queen sacrifice on h7, and the rook mates on the h-file.', 'Ne7+ заганяє короля на h8; далі жертва ферзя на h7 — і тура ставить мат по вертикалі h.'),
        },
      },
    ],
  },

  {
    id: 'advanced',
    band: [1800, 2600],
    chapters: [
      {
        id: 'advanced-quiet',
        theme: 'quietMove',
        band: [1800, 2600],
        title: L('Quiet move', 'Тихий хід'),
        tip: L('No check, no capture — just a move they cannot answer.', 'Без шаху й без взяття — просто хід, на який немає відповіді.'),
        intro: {
          text: L(
            'A quiet move gives no check and captures nothing, which is why it is so easy to miss. It prepares a threat the opponent cannot parry, or takes away their last defensive resource. When the forcing moves fail, look for the calm one.',
            'Тихий хід не дає шаху й нічого не б’є — тому його так легко пропустити. Він готує загрозу, від якої немає захисту, або забирає в суперника останній ресурс. Коли форсовані ходи не працюють, пошукай спокійний.',
          ),
          fen: 'r5k1/p4p1p/5Bp1/8/8/8/P2Q1PPP/6K1 w - - 0 1',
          arrows: [mv('d2', 'h6'), th('h6', 'g7')],
          caption: L('Qh6 gives no check and takes nothing, but mate on g7 cannot be stopped.', 'Qh6 не шахує й нічого не б’є, але мат на g7 не зупинити.'),
        },
      },
      {
        id: 'advanced-xray',
        theme: 'xRayAttack',
        band: [1800, 2600],
        title: L('X-ray', 'Рентген'),
        tip: L('A piece can attack — or defend — through another piece.', 'Фігура може атакувати чи захищати крізь іншу фігуру.'),
        intro: {
          text: L(
            'An x-ray works through a piece standing in the way. A rook or bishop behind an enemy piece still controls the squares beyond it: the moment that piece moves or is exchanged, the line opens. When you count attackers and defenders, include the ones hiding behind others.',
            'Рентген діє крізь фігуру, що стоїть на шляху. Тура чи слон за фігурою суперника все одно контролюють поля позаду неї: щойно вона рушить чи розміняється, лінія відкривається. Рахуючи нападників і захисників поля, враховуй і тих, що сховалися за іншими.',
          ),
          fen: '3r2k1/5ppp/8/Q7/3r4/8/5PPP/3R2K1 w - - 0 1',
          arrows: [mv('a5', 'd8'), th('d1', 'd8')],
          caption: L('Qxd8+: the rook on d1 backs up the queen through the black rook on d4 — after the recapture, the rook mates on d8.', 'Qxd8+: тура d1 підтримує ферзя крізь чорну туру на d4 — після взяття у відповідь тура ставить мат на d8.'),
        },
      },
      {
        id: 'advanced-king',
        theme: 'kingsideAttack',
        band: [1800, 2600],
        prefer: ['sacrifice'],
        title: L('Attack on the king', 'Атака на короля'),
        tip: L('Count your attackers near the king before you sacrifice.', 'Перед жертвою порахуй, скільки твоїх фігур атакує короля.'),
        intro: {
          text: L(
            'When your pieces outnumber the defenders around the enemy king, a sacrifice can tear its shelter apart. The classic is the bishop on h7, but rooks and knights go in too. What matters is what comes next: every move after the sacrifice must keep the attack going.',
            'Коли біля ворожого короля твоїх фігур більше, ніж захисників, жертва може зруйнувати його укриття. Класика — слон на h7, але в хід ідуть і тури, і коні. Головне — що далі: кожен хід після жертви має підтримувати атаку.',
          ),
          fen: '3q1rk1/pp3ppp/4p3/3pP3/1b1P4/2PB1N2/PP3PPP/3Q1RK1 w - - 0 1',
          arrows: [mv('d3', 'h7'), th('h7', 'g8'), th('f3', 'g5')],
          caption: L('Bxh7+: the bishop is sacrificed to strip the king; the knight and the queen follow.', 'Bxh7+: слона жертвують, щоб оголити короля; слідом вриваються кінь і ферзь.'),
        },
      },
      {
        id: 'advanced-long',
        theme: 'veryLong',
        band: [1800, 2600],
        title: L('Long combinations', 'Довгі комбінації'),
        tip: L('Keep every move forcing, and check the best reply each time.', 'Нехай кожен хід буде форсованим, і щоразу перевіряй найкращу відповідь.'),
        intro: {
          text: L(
            'Long combinations are chains of forcing moves — checks, captures and threats, each leaving the opponent few choices. You do not need to see every branch at once: find a forcing first move, then the best defence, then your next blow. Patience in calculation pays off here.',
            'Довгі комбінації — це ланцюжки форсованих ходів: шахів, взять і загроз, кожен із яких залишає суперникові мало вибору. Не обов’язково бачити всі розгалуження одразу: знайди форсований перший хід, потім найкращий захист, потім наступний удар. Тут терпіння в розрахунку окупається.',
          ),
          fen: '5r1k/pp3pR1/5B1p/8/8/8/PPP5/2K5 w - - 0 1',
          arrows: [mv('g7', 'f7'), th('f6', 'h8')],
          caption: L('Rxf7+ starts a windmill: the bishop gives check, the rook returns to g7 and takes the next piece.', 'Rxf7+ запускає «млин»: шахує слон, тура повертається на g7 і забирає наступну фігуру.'),
        },
      },
      {
        id: 'advanced-defence',
        theme: 'defensiveMove',
        band: [1800, 2600],
        title: L('Only defence', 'Єдиний захист'),
        tip: L('Find their threat first, then the one move that meets it.', 'Спершу знайди загрозу суперника, потім — хід, що її відбиває.'),
        intro: {
          text: L(
            'At this level, defence is calculation too. The opponent has a real threat, and most moves lose; one holds. The best defensive moves often come with a counter-threat, so that the opponent has to answer you.',
            'На цьому рівні захист — це теж розрахунок. У суперника реальна загроза, і більшість ходів програє; рятує лише один. Найкращі захисні ходи часто несуть зустрічну загрозу, і тоді вже суперникові доводиться відповідати тобі.',
          ),
          fen: '5rk1/pp3ppp/3b4/8/7q/8/PP1N1PPP/3Q1RK1 w - - 0 1',
          arrows: [mv('d2', 'f3'), th('f3', 'h4'), th('f3', 'h2')],
          caption: L('Nf3 guards h2 and hits the queen: the mate threat is gone, with tempo.', 'Nf3 захищає h2 й нападає на ферзя: загрозу мату знято з темпом.'),
        },
      },
      {
        id: 'advanced-intermezzo',
        theme: 'intermezzo',
        band: [1800, 2600],
        title: L('In-between move', 'Проміжний хід'),
        tip: L('The recapture can wait. Is there a check or a capture first?', 'Взяття у відповідь почекає. Чи немає спершу шаху чи взяття?'),
        intro: {
          text: L(
            'Strong players do not recapture on autopilot. An in-between move — a check, a capture or a threat that must be answered — can come first and change the balance of the whole exchange. It works for the defender too: the opponent’s expected recapture is a moment to look for your own move.',
            'Сильні шахісти не беруть назад машинально. Спершу може бути проміжний хід — шах, взяття чи загроза, на яку треба відповісти, — і він змінює баланс усього розміну. Це працює й для того, хто захищається: момент очікуваного взяття — привід пошукати свій хід.',
          ),
          fen: '5rk1/pp2bppp/8/3N4/8/8/PP3PPP/R2q1RK1 w - - 0 1',
          arrows: [mv('d5', 'e7'), th('e7', 'g8'), th('a1', 'd1')],
          caption: L('Nxe7+ first, then the rook takes back on d1: White wins a whole bishop.', 'Спершу Nxe7+, а потім тура відбирає на d1: білі виграють цілого слона.'),
        },
      },
      {
        id: 'advanced-mate4',
        theme: 'mateIn4',
        band: [1800, 2600],
        select: ['mateIn4', 'mateIn5'],
        title: L('Mate in 4 and more', 'Мат у 4+ ходи'),
        tip: L('Picture the final mate first, then find the checks that lead there.', 'Спершу уяви фінальний мат, потім знайди шахи, що ведуть до нього.'),
        intro: {
          text: L(
            'Long mates are built backwards: picture the final mating position, then find the forcing moves that drive the king into it. Checks keep the opponent’s choices to a minimum, and a queen sacrifice is often the key that locks the door.',
            'Довгі мати будують із кінця: уяви фінальну матову позицію, а потім знайди форсовані ходи, що заженуть туди короля. Шахи зводять вибір суперника до мінімуму, а жертва ферзя часто стає ключем, що замикає двері.',
          ),
          fen: '4r2k/pp4pp/8/6N1/2Q5/3b4/6PP/5RK1 w - - 0 1',
          arrows: [mv('g5', 'f7'), th('f7', 'h8'), th('c4', 'g8')],
          caption: L('Nf7+ starts a mate in four: two knight checks, a queen sacrifice on g8, then a smothered mate.', 'Nf7+ починає мат у 4 ходи: два шахи конем, жертва ферзя на g8 — і спертий мат.'),
        },
      },
    ],
  },

  {
    id: 'endgames',
    band: [800, 2300],
    endgame: true,
    chapters: [
      {
        id: 'endgames-pawn',
        theme: 'pawnEndgame',
        band: [800, 2300],
        free: ['advancedPawn'],
        title: L('Pawn endings', 'Пішакові закінчення'),
        tip: L('Count the moves to the queening square — for both sides.', 'Рахуй ходи до поля перетворення — за обидві сторони.'),
        intro: {
          text: L(
            'In pawn endings every tempo matters, and the king is a fighting piece. Opposition, the square of the pawn and pawn breakthroughs decide most of them. Count precisely: one move too slow is the difference between a win and a loss.',
            'У пішакових закінченнях вирішує кожен темп, а король — повноцінна бойова фігура. Більшість із них вирішують опозиція, правило квадрата й пішаковий прорив. Рахуй точно: запізнення на один хід — це різниця між виграшем і поразкою.',
          ),
          fen: '7k/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
          arrows: [mv('b5', 'b6'), th('b6', 'a7'), th('b6', 'c7')],
          caption: L('b6! breaks through: whichever pawn takes, one of White’s pawns runs through to queen.', 'b6! — прорив: хоч би яким пішаком чорні взяли, один із білих пішаків пройде у ферзі.'),
        },
      },
      {
        id: 'endgames-rook',
        theme: 'rookEndgame',
        band: [800, 2300],
        title: L('Rook endings', 'Турні закінчення'),
        tip: L('Rooks belong behind passed pawns — and active.', 'Місце тури — позаду прохідного пішака, і вона має бути активною.'),
        intro: {
          text: L(
            'Rook endings are the most common endings of all. Activity beats material here: an active rook, a king close to the pawns and well-timed checks decide most positions. Watch for skewers along ranks and files — they are everywhere in rook endings.',
            'Турні закінчення трапляються найчастіше з усіх. Тут активність важить більше за матеріал: активна тура, король біля пішаків і вчасні шахи вирішують більшість позицій. Стеж за лінійними ударами по горизонталях і вертикалях — у турних закінченнях вони на кожному кроці.',
          ),
          fen: 'R7/P3k3/8/8/8/6K1/8/r7 w - - 0 1',
          arrows: [mv('a8', 'h8'), th('a7', 'a8')],
          caption: L('Rh8 clears the way for the pawn; if the black rook takes a7, a check from h7 skewers it.', 'Rh8 звільняє шлях пішакові; якщо чорна тура візьме a7, шах з h7 лінійним ударом забере її.'),
        },
      },
      {
        id: 'endgames-knight',
        theme: 'knightEndgame',
        band: [800, 2300],
        title: L('Knight endings', 'Кінні закінчення'),
        tip: L('Knights are slow: count their jumps.', 'Кінь повільний: рахуй його стрибки.'),
        intro: {
          text: L(
            'Knight endings play like pawn endings with an extra piece: the knight cannot lose a tempo and needs several jumps to change sides. Forks and deflections decide most of them. Check where each knight can get to in one and in two moves.',
            'Кінні закінчення схожі на пішакові з додатковою фігурою: кінь не вміє втрачати темп і довго перебирається з флангу на фланг. Більшість із них вирішують вилки та відволікання. Перевіряй, куди кожен кінь дістанеться за один і за два ходи.',
          ),
          fen: '2K5/1P6/n5k1/3N4/8/8/8/8 w - - 0 1',
          arrows: [mv('d5', 'c7'), th('c7', 'a6'), th('b7', 'b8')],
          caption: L('Nc7 hits the only defender of b8 — whatever the black knight does, the pawn queens.', 'Nc7 нападає на єдиного захисника поля b8 — хоч що зробить чорний кінь, пішак стане ферзем.'),
        },
      },
      {
        id: 'endgames-bishop',
        theme: 'bishopEndgame',
        band: [800, 2300],
        title: L('Bishop endings', 'Слонові закінчення'),
        tip: L('Watch the colour of the squares: a bishop sees only half the board.', 'Стеж за кольором полів: слон бачить лише половину дошки.'),
        intro: {
          text: L(
            'A bishop controls only squares of its own colour, and that decides bishop endings. Put your pawns on the other colour, bring your king where the bishop cannot help, and look for ways to block its diagonal. With bishops of opposite colours, even two extra pawns may not be enough.',
            'Слон контролює лише поля свого кольору, і це вирішує слонові закінчення. Став пішаків на поля іншого кольору, веди короля туди, де слон не допоможе, і шукай, як перекрити його діагональ. З різнопольними слонами навіть двох зайвих пішаків може не вистачити.',
          ),
          fen: '8/1P6/2K5/B3b2k/8/8/8/8 w - - 0 1',
          arrows: [mv('a5', 'c7'), th('b7', 'b8')],
          caption: L('Bc7 blocks the black bishop’s diagonal; if it takes, the king takes back and the pawn queens.', 'Bc7 перекриває діагональ чорного слона; якщо він візьме, король відбере, і пішак стане ферзем.'),
        },
      },
      {
        id: 'endgames-queen',
        theme: 'queenEndgame',
        band: [800, 2300],
        title: L('Queen endings', 'Ферзеві закінчення'),
        tip: L('Look for checks that win the queen or force mate.', 'Шукай шахи, що виграють ферзя або ведуть до мату.'),
        intro: {
          text: L(
            'With queens on the board every check matters: one careless king move, and a fork or a skewer wins the queen. Keep your own king sheltered, and look for checks that land on a line with the enemy queen. A far-advanced passed pawn is often worth more than any other material.',
            'Коли на дошці ферзі, кожен шах важливий: один необережний хід королем — і вилка чи лінійний удар забирають ферзя. Тримай свого короля в укритті й шукай шахи, що потрапляють на одну лінію з ворожим ферзем. Далекий прохідний пішак тут часто вартий більше за будь-який інший матеріал.',
          ),
          fen: '5Q2/8/2k5/6K1/8/8/8/7q w - - 0 1',
          arrows: [mv('f8', 'a8'), th('a8', 'h1')],
          caption: L('Qa8+ checks along the long diagonal: once the king steps aside, the queen on h1 is lost.', 'Qa8+ шахує по великій діагоналі: щойно король відійде, ферзь на h1 пропаде.'),
        },
      },
      {
        id: 'endgames-promotion',
        theme: 'promotion',
        band: [800, 2300],
        free: ['advancedPawn'],
        title: L('Promotion', 'Перетворення пішака'),
        tip: L('A passed pawn wants to run. Find what holds it back — and remove it.', 'Прохідний пішак рветься вперед. Знайди, що його тримає, — і прибери це.'),
        intro: {
          text: L(
            'In the endgame a passed pawn is often the most valuable piece on the board. Promotion tactics remove the blocker, deflect the defender or win the race by a single tempo. Before you push, check what the opponent can do the moment the new queen appears.',
            'У закінченні прохідний пішак часто найцінніша фігура на дошці. Тактика перетворення прибирає фігуру, що заступає дорогу, відволікає захисника або виграє перегони на один темп. Перш ніж просувати пішака, перевір, що зможе зробити суперник, щойно з’явиться новий ферзь.',
          ),
          fen: '2r5/P7/4k3/3N4/8/6K1/5P1P/8 w - - 0 1',
          arrows: [mv('a7', 'a8'), th('d5', 'c7')],
          caption: L('a8=Q! If the rook takes, a knight check from c7 forks the king and the rook.', 'a8=Q! Якщо тура візьме, шах конем з c7 — вилка королю й турі.'),
        },
      },
      {
        id: 'endgames-zugzwang',
        theme: 'zugzwang',
        band: [800, 2300],
        title: L('Zugzwang', 'Цугцванг'),
        tip: L('Sometimes the best move changes nothing — except whose turn it is.', 'Іноді найкращий хід нічого не змінює — крім того, чия черга ходити.'),
        intro: {
          text: L(
            'Zugzwang means every move makes things worse, yet a move must be made. In endings it decides more games than anything else: when the kings stand face to face, the side to move often has to give way. A spare pawn move or a quiet king step that passes the turn can be the whole solution.',
            'Цугцванг — це коли будь-який хід погіршує позицію, але ходити все одно треба. У закінченнях він вирішує більше партій, ніж будь-що інше: коли королі стоять один навпроти одного, той, хто ходить, часто мусить поступитися. Часто весь розв’язок — запасний хід пішаком чи тихий хід королем, який передає чергу суперникові.',
          ),
          fen: '8/3k4/8/3K4/p2P4/8/P7/8 w - - 0 1',
          arrows: [mv('a2', 'a3')],
          caption: L('a3! passes the move: the black pawn is stuck, so the king has to step aside and let White’s king through.', 'a3! передає хід: чорний пішак заблокований, тож король мусить поступитися й пропустити білого короля.'),
        },
      },
    ],
  },
];
