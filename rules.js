(function (root) {
  'use strict';

  var MAX_LEN = 2000;

  var TYPES = {
    secret_code:   { sev: 'critical', weight: 10, label: 'Просьба назвать код или пароль',
      why: 'Одноразовый код, пароль и CVV — это «подпись» под операцией. Настоящий банк и госорганы никогда не просят их назвать.',
      tip: 'Никому не называйте коды из SMS, пароли и CVV — даже «сотруднику банка».' },
    safe_account:  { sev: 'critical', weight: 10, label: '«Безопасный счёт»',
      why: 'Банк не просит переводить деньги на «безопасный», «защищённый» или «резервный» счёт — такого сервиса не существует.',
      tip: 'Не переводите деньги «для сохранности»: безопасных счетов для спасения средств не бывает.' },
    remote_access: { sev: 'critical', weight: 10, label: 'Установка программы / удалённый доступ',
      why: 'Через программы удалённого доступа и неизвестные приложения мошенники получают контроль над телефоном и банком.',
      tip: 'Не устанавливайте программы и не включайте демонстрацию экрана по просьбе собеседника.' },
    money_transfer:{ sev: 'strong', weight: 2, label: 'Просьба перевести или снять деньги',
      why: 'Просьба перевести, снять наличные или оформить кредит «под диктовку» — типичный шаг мошеннической схемы.',
      tip: 'Не совершайте переводов и не снимайте наличные по чьей-то инструкции.' },
    urgency:       { sev: 'strong', weight: 2, label: 'Давление срочностью или угрозой блокировки',
      why: 'Спешка и угроза блокировки нужны, чтобы вы не успели подумать и проверить. Настоящие банки так не давят.',
      tip: 'Спешка — повод остановиться. На проверку всегда есть время.' },
    authority:     { sev: 'strong', weight: 2, label: 'Ссылка на «авторитет»',
      why: 'Упоминание ЦБ, следователя, службы безопасности банка — приём, чтобы вызвать доверие и страх.',
      tip: 'Положите трубку и сами позвоните в организацию по номеру с официального сайта.' },
    secrecy:       { sev: 'strong', weight: 2, label: 'Просьба держать в секрете',
      why: 'Просьба никому не говорить об «операции» изолирует вас от тех, кто мог бы остановить обман.',
      tip: 'Расскажите близким: если просят молчать — это почти всегда обман.' },
    personal_data: { sev: 'strong', weight: 2, label: 'Запрос личных или карточных данных',
      why: 'Банк не запрашивает данные карты, паспорт или логин в сообщениях и звонках.',
      tip: 'Не сообщайте данные карты и документов по запросу в сообщении или звонке.' },
    link_suspicious:{ sev: 'strong', weight: 2, label: 'Подозрительный адрес ссылки',
      why: 'Адрес ссылки устроен так, как часто делают сайты-двойники. Это структурный признак; репутацию домена мы не проверяли.',
      tip: 'Не открывайте ссылку. Адрес банка вводите вручную или заходите через приложение.' },
    ai_manipulation:{ sev: 'strong', weight: 2, label: 'Попытка управлять проверяющим ИИ',
      why: 'В тексте есть команды, адресованные нейросети. Мы считаем такой текст данными и не выполняем эти команды.',
      tip: 'Сообщение, которое пытается «договориться» с проверкой, стоит считать подозрительным.' },
    link:          { sev: 'weak', weight: 1, label: 'Ссылка в неожиданном сообщении',
      why: 'Ссылки в неожиданных сообщениях — частый способ увести на поддельный сайт. Сама по себе ссылка не доказывает обман.',
      tip: 'Не переходите по ссылке из неожиданного сообщения.' },
    call_to_action:{ sev: 'weak', weight: 1, label: 'Просьба позвонить по указанному номеру',
      why: 'Звонок «по номеру из сообщения» может привести не в банк. Сам по себе признак слабый.',
      tip: 'Звоните только по номеру с карты или с официального сайта.' },
    masked_text:   { sev: 'weak', weight: 1, label: 'Маскировка символов',
      why: 'В словах смешаны латинские и кириллические буквы или спрятаны невидимые символы — так обходят фильтры.',
      tip: 'Текст с «подменными» буквами — повод усомниться в отправителе.' }
  };

  var CODEW = '(?:код|парол|пин-?код|cvv|cvc)';
  var RULES = [
    { type: 'secret_code', neg: true, re: [
      /(?:назов|назва|назыв|сообщ|скаж|продиктуй|продиктов|пришл|отправ|передай|передат|введ|говор|укаж|сфотографир)[а-я]*[^.!?\n]{0,50}?(?:код|парол|пин-?код|cvv|cvc|одноразов)/g,
      /(?:код|парол|пин-?код|cvv|cvc)[а-я]*[^.!?\n]{0,25}?(?:из|от|в)\s*(?:смс|sms|пуш|push|сообщен|уведомлен|приложен)/g,
      /(?:трех|3)\s*-?\s*значн[а-я]*\s+код|код\s+на\s+обороте|(?:смс|sms)\s*-?\s*код/g
    ] },
    { type: 'safe_account', re: [
      /(?:безопасн|защищенн|резервн|специальн|страхов|сохранн)[а-я]*\s+(?:банковск[а-я]*\s+)?(?:счет|счета|счету|счетом|ячейк)/g
    ] },
    { type: 'remote_access', re: [
      /anydesk|any\s+desk|teamviewer|team\s+viewer|rustdesk|airdroid|quicksupport|ammyy|alpemix/g,
      /удаленн[а-я]*\s+(?:доступ|управлен|подключен)/g,
      /(?:установ|скача|загруз)[а-я]*[^.!?\n]{0,30}(?:приложен|программ|apk|утилит|антивирус)/g,
      /\.apk(?![a-z])/g,
      /(?:демонстраци|трансляци)[а-я]*\s+экран/g
    ] },
    { type: 'money_transfer', re: [
      /перев(?:ед|ест)[а-я]*[^.!?\n]{0,40}(?:деньг|средств|накоплен|сбережен|сумм|\d[\d\s]*(?:₽|руб))/g,
      /перев(?:ед|ест)[а-я]*[^.!?\n]{0,30}(?:на|в)\s+(?:другой|новый|чужой|указанн[а-я]*|названн[а-я]*)\s+(?:счет|карт)/g,
      /(?:снимит|снять|обналичь|обналичит)[а-я]*[^.!?\n]{0,30}(?:налич|деньг|средств)/g,
      /(?:положит|внесит|пополнит)[а-я]*[^.!?\n]{0,30}(?:на\s+(?:счет|карт)|через\s+банкомат)/g,
      /(?:оформит|возьмит|взять|оформить)[а-я]*[^.!?\n]{0,15}кредит/g
    ] },
    { type: 'urgency', re: [
      /срочн|немедленн|незамедлительн|безотлагательн|прямо\s+сейчас|сейчас\s+же|успе(?:й|ть|те)(?![а-я])|последн[а-я]*\s+шанс/g,
      /(?:в\s+течение|через|осталось)\s+\d+\s*(?:минут|мин|час|ч(?![а-я])|сек)/g,
      /(?:будет|будут|может\s+быть)\s+(?:заблокирован|ограничен|списан|аннулирован|закрыт)[а-я]*/g,
      /(?:заблокирован|заморожен|приостановлен)[а-я]*\s+(?:счет|карт|доступ|аккаунт|операци)/g,
      /(?:счет|карт[а-я]*|доступ|аккаунт)\s+(?:будет\s+)?(?:заблокирован|заморожен|приостановлен|ограничен)[а-я]*/g,
      /подозрительн[а-я]*\s+(?:операци|вход|активност|перевод|попытк)|несанкционированн[а-я]*/g,
      /(?:иначе|в\s+противном\s+случае)[^.!?\n]{0,40}(?:заблокир|штраф|списан|ответственност|арест)/g
    ] },
    { type: 'authority', neg: true, re: [
      /центральн[а-я]*\s+банк|цб\s*рф|центробанк|(?<![а-я])цб(?![а-я])|банк[а-я]*\s+россии|следовател|следственн|(?<![а-я])фсб(?![а-я])|(?<![а-я])мвд(?![а-я])|полици|прокуратур|финмониторинг|росфинмониторинг|роскомнадзор|военн[а-я]*\s+комиссариат|налогов[а-я]*\s+служб|уголовн[а-я]*\s+дел/g,
      /служб[а-я]*\s+безопасност|сотрудник[а-я]*\s+(?:банка|безопасност|полици|фсб|цб)/g
    ] },
    { type: 'secrecy', re: [
      /никому\s+не\s+(?:говор|сообщ|рассказ|разглаш)[а-я]*(?![а-я])(?!\s+(?:\S+\s+){0,2}?(?:код|парол|пин|cvv|cvc|смс|sms|данн)|\s+(?:его|ее|их|это|эти)(?![а-я]))/g,
      /не\s+(?:говор|сообщ|рассказ|разглаш)[а-я]*\s+(?:никому|сотрудник[а-я]*|родственник[а-я]*|близк[а-я]*|в\s+банк)/g,
      /тайн[а-я]*\s+(?:следствия|операции)|разглашени[а-я]*\s+(?:тайны|информации)|не\s+(?:кладите|вешайте)\s+трубку|оставайтесь\s+на\s+линии|не\s+прерывайте\s+(?:разговор|звонок)/g
    ] },
    { type: 'personal_data', neg: true, re: [
      /(?:назов|назва|назыв|сообщ|укаж|введ|пришл|отправ|продиктуй|продиктов|предостав|сфотографир)[а-я]*[^.!?\n]{0,35}(?:номер\s+карт|данн[а-я]*\s+карт|реквизит[а-я]*\s+карт|срок\s+действия|паспорт|снилс|(?<![а-я])инн(?![а-я])|кодов[а-я]*\s+слов|логин)/g
    ] },
    { type: 'call_to_action', re: [
      /(?:перезвон|позвон)[а-я]*[^.!?\n]{0,30}(?:номер|телефон|по\s+этому|\+7|8\s?\(?\d{3})/g
    ] },
    { type: 'ai_manipulation', re: [
      /(?:игнорируй|забудь|отмени)[а-я]*\s+(?:все\s+)?(?:предыдущ|прошл|свои|инструкц)|ignore\s+(?:all\s+)?(?:previous|prior|above)|system\s+prompt|ты\s+теперь|you\s+are\s+now|ответь[^.!?\n]{0,15}безопасн/g
    ] }
  ];

  var SHORTENERS = ['bit.ly', 'clck.ru', 'cutt.ly', 'tinyurl.com', 't.co', 'goo.gl', 'vk.cc', 'u.to', 'ow.ly', 'is.gd', 'rb.gy', 'shorturl.at', 't.ly'];
  var BAD_ZONES  = ['xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'icu', 'click', 'pw', 'cc', 'ws', 'work', 'bar', 'help'];
  var BAD_WORDS  = ['secure', 'safe', 'verify', 'login', 'check', 'support', 'protect', 'unlock', 'zashit', 'bezopas', 'podtverd', 'blok'];
  var BRANDS = {
    vtb: ['vtb.ru'], sber: ['sberbank.ru', 'sber.ru', 'sberbank.com'],
    tinkoff: ['tinkoff.ru', 'tbank.ru'], tbank: ['tbank.ru', 'tinkoff.ru'],
    alfa: ['alfabank.ru'], gosuslugi: ['gosuslugi.ru'], cbr: ['cbr.ru']
  };
  var URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`)]+|(?<![a-z0-9@.\/-])(?:[a-z0-9][a-z0-9-]*\.)+(?:ru|su|com|net|org|info|xyz|top|online|site|app|cc|pw|tk|ml|ga|cf|gq|club|shop|store|link|click|work|live|icu|bar|help|support|me|io|co|ly|gl|ws|cn|biz|page)(?![a-z0-9-])(?:\/[^\s<>"'`)]*)?/g;

  function isOfficial(host) {
    return Object.keys(BRANDS).some(function (b) {
      return BRANDS[b].some(function (d) { return host === d || host.slice(-d.length - 1) === '.' + d; });
    });
  }

  function hostReasons(url) {
    var r = [];
    var noScheme = url.replace(/^https?:\/\//, '');
    var authority = noScheme.split(/[\/?#]/)[0];
    if (authority.indexOf('@') > -1) r.push('в адресе есть «@» — настоящий сайт стоит после него');
    var host = authority.split('@').pop().replace(/:\d+$/, '').replace(/^www\./, '');
    if (SHORTENERS.indexOf(host) > -1) r.push('сокращённая ссылка прячет настоящий адрес');
    if (host.indexOf('xn--') > -1) r.push('адрес записан в punycode (часто так маскируют похожие символы)');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) r.push('вместо названия сайта — IP-адрес');
    Object.keys(BRANDS).forEach(function (b) {
      if (host.indexOf(b) > -1 && !isOfficial(host)) r.push('в адресе есть «' + b + '», но домен не из официального списка (' + BRANDS[b][0] + ')');
    });
    var parts = host.split('.');
    var zone = parts[parts.length - 1];
    if (BAD_ZONES.indexOf(zone) > -1) r.push('доменная зона .' + zone + ' нетипична для банков');
    if (host.indexOf('-') > -1 && BAD_WORDS.some(function (w) { return host.indexOf(w) > -1; })) r.push('в адресе дефисы и слова вроде «secure/login/verify»');
    return { host: host, reasons: r.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
  }

  function clean(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\r\n?/g, '\n')
      .slice(0, MAX_LEN);
  }

  var ZERO = /[\u200B-\u200F\u2060\uFEFF\u00AD]/;
  var LOOK = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в' };

  function normalize(text) {
    var out = '', map = [], hadZero = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ZERO.test(ch)) { hadZero = true; continue; }
      ch = ch.toLowerCase();
      if (ch === 'ё') ch = 'е';
      if (ch.length !== 1) ch = ch.charAt(0);
      out += ch; map.push(i);
    }
    return { s: out, map: map, hadZero: hadZero };
  }

  function negWarn(s, start) {
    var pre = s.slice(Math.max(0, start - 30), start);
    return /(?:^|\s)(?:не|даже)\s+(?:[а-я]+\s+){0,2}$/.test(pre) || /никому\s+(?:не\s+)?$/.test(pre);
  }

  function analyze(raw) {
    var text = clean(raw);
    var n = normalize(text);
    var s = n.s, map = n.map;
    var signals = [];

    function add(type, a, b, why) {
      var o0 = map[a], o1 = map[b - 1] + 1;
      var same = 0;
      for (var i = 0; i < signals.length; i++) {
        if (signals[i].type !== type) continue;
        same++;
        if (signals[i].start < o1 && o0 < signals[i].end) return;
      }
      if (same >= 3) return;
      signals.push({ type: type, sev: TYPES[type].sev, source: 'rules', start: o0, end: o1,
        quote: text.slice(o0, o1), why: why || TYPES[type].why });
    }

    var urls = [], urlSpans = [], m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s))) {
      var u = m[0].replace(/[.,;:!?]+$/, '');
      if (!u) continue;
      urlSpans.push([m.index, m.index + u.length]);
      var info = hostReasons(u);
      urls.push({ url: text.slice(map[m.index], map[m.index + u.length - 1] + 1), host: info.host, reasons: info.reasons, official: isOfficial(info.host) });
      if (info.reasons.length) {
        add('link_suspicious', m.index, m.index + u.length,
          'Адрес «' + info.host + '»: ' + info.reasons.join('; ') + '. Это структурный признак — репутацию домена мы не проверяли.');
      } else if (!isOfficial(info.host)) {
        add('link', m.index, m.index + u.length);
      }
    }

    var chars = s.split('');
    var wre = /[a-zа-я0-9]+/g, w, masked = [];
    while ((w = wre.exec(s))) {
      var inUrl = urlSpans.some(function (sp) { return w.index >= sp[0] && w.index < sp[1]; });
      if (inUrl) continue;
      if (/[a-z]/.test(w[0]) && /[а-я]/.test(w[0])) {
        masked.push([w.index, w.index + w[0].length]);
        for (var k = 0; k < w[0].length; k++) { var c = w[0][k]; if (LOOK[c]) chars[w.index + k] = LOOK[c]; }
      }
    }
    s = chars.join('');
    masked.slice(0, 2).forEach(function (sp) { add('masked_text', sp[0], sp[1]); });
    if (n.hadZero && !masked.length && s.length) {
      signals.push({ type: 'masked_text', sev: 'weak', source: 'rules', start: 0, end: 0, quote: '', why: TYPES.masked_text.why });
    }

    RULES.forEach(function (rule) {
      rule.re.forEach(function (re) {
        re.lastIndex = 0;
        var mm;
        while ((mm = re.exec(s))) {
          if (!mm[0].length) { re.lastIndex++; continue; }
          if (rule.neg && negWarn(s, mm.index)) continue;
          add(rule.type, mm.index, mm.index + mm[0].length);
        }
      });
    });

    signals.sort(function (a, b) { return a.start - b.start; });
    var words = text.split(/\s+/).filter(Boolean).length;
    return { text: text, words: words, signals: signals, urls: urls };
  }

  function typesOf(signals) {
    var t = {};
    signals.forEach(function (x) { t[x.type] = 1; });
    return Object.keys(t);
  }

  function decide(signals, words) {
    var types = typesOf(signals), crit = 0, score = 0;
    types.forEach(function (t) { score += TYPES[t].weight; if (TYPES[t].sev === 'critical') crit++; });
    var onlyAmbiguous = types.length > 0 && types.every(function (t) { return t === 'urgency' || t === 'call_to_action'; });
    if (crit > 0 || score >= 5) return 'high';
    if (!types.length) return words < 3 ? 'uncertain' : 'none_found';
    if (words <= 8 && onlyAmbiguous) return 'uncertain';
    return 'suspicious';
  }

  var LEVELS = {
    high: {
      title: 'Похоже на опасный сценарий',
      summary: 'В тексте есть запрос, который настоящие банки и госорганы не делают, либо сразу несколько признаков давления. Остановитесь и проверьте через официальный канал.',
      actions: [
        'Не выполняйте просьбу из сообщения и не переходите по ссылке.',
        'Не называйте коды, пароли и CVV — настоящий банк их не спрашивает.',
        'Откройте приложение банка сами или позвоните по номеру с обратной стороны карты / с официального сайта.',
        'Если секрет уже передан — сразу позвоните в банк по официальному номеру и заблокируйте карту.'
      ],
      limitation: 'Это оценка по содержанию текста. Она не подтверждает личность отправителя и не гарантирует, что найдены все признаки.'
    },
    suspicious: {
      title: 'Есть признаки, которые нужно проверить',
      summary: 'Критичного запроса нет, но в тексте есть признаки, которые часто встречаются в обмане. Легитимные сообщения тоже бывают срочными — поэтому нужна независимая проверка.',
      actions: [
        'Не отвечайте и не переходите по ссылке, пока не проверите отправителя сами.',
        'Откройте официальное приложение банка или сайт, набрав адрес вручную.',
        'Если сообщение просит деньги, код или вход в аккаунт — считайте его опасным.'
      ],
      limitation: 'Признаки указывают на возможный риск, но не доказывают обман.'
    },
    none_found: {
      title: 'Явных признаков не найдено',
      summary: 'Но это не значит, что сообщение безопасно: новые схемы могут не распознаваться, а подлинность отправителя мы не проверяли.',
      actions: [
        'Если сообщение просит деньги, код или вход — проверьте его отдельно через официальный канал.',
        'Не переходите по незнакомым ссылкам, даже если признаков не найдено.'
      ],
      limitation: 'Отсутствие признаков — не гарантия безопасности. Мы не называем сообщение безопасным.'
    },
    uncertain: {
      title: 'Недостаточно данных для оценки',
      summary: 'Текст слишком короткий или неоднозначный, чтобы надёжно его оценить. Неопределённость — тоже честный результат.',
      actions: [
        'Не совершайте финансовых действий по этому сообщению.',
        'Проверьте отправителя независимым способом: позвоните ему по известному вам номеру или в официальный банк.',
        'Вставьте сообщение целиком — с контекстом оценка будет точнее.'
      ],
      limitation: 'Мы не можем надёжно оценить такой текст.'
    }
  };

  function tipsFor(signals) {
    var order = typesOf(signals).sort(function (a, b) { return TYPES[b].weight - TYPES[a].weight; });
    return order.slice(0, 3).map(function (t) { return TYPES[t].tip; });
  }

  function verdict(signals, words) {
    var level = decide(signals, words), L = LEVELS[level];
    return { level: level, title: L.title, summary: L.summary, actions: L.actions.slice(),
             tips: tipsFor(signals), limitation: L.limitation };
  }

  function cleanNote(x) {
    return String(x == null ? '' : x).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function mergeAI(text, base, aiSignals) {
    var out = base.slice(), added = 0;
    var low = text.toLowerCase();
    if (low.length !== text.length) low = text;
    (Array.isArray(aiSignals) ? aiSignals : []).forEach(function (x) {
      if (added >= 4 || !x || typeof x.type !== 'string' || !TYPES[x.type] || typeof x.quote !== 'string') return;
      var q = x.quote.trim();
      if (q.length < 3 || q.length > 200) return;
      var i = low.indexOf(q.toLowerCase());
      if (i < 0) return;
      var j = i + q.length;
      if (out.some(function (s) { return s.type === x.type && s.start < j && i < s.end; })) return;
      out.push({ type: x.type, sev: TYPES[x.type].sev, source: 'ai', start: i, end: j,
                 quote: text.slice(i, j), why: cleanNote(x.why) || TYPES[x.type].why });
      added++;
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  var api = { MAX_LEN: MAX_LEN, TYPES: TYPES, analyze: analyze, verdict: verdict, decide: decide,
              mergeAI: mergeAI, typesOf: typesOf, cleanNote: cleanNote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PauseRules = api;
})(typeof self !== 'undefined' ? self : this);
