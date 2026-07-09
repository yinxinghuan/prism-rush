const dictionaries = {
  en: {
    time: 'Time',
    score: 'Score',
    kicker: '3D light tunnel',
    title: 'Prism Rush',
    startCopy: 'Thread the glow, skim the gates, keep the prism singing.',
    start: 'Launch',
    best: 'Best',
    maxCombo: 'Max Combo',
    again: 'Again',
    home: 'Home',
    win: 'Tunnel clear',
    lose: 'Gate crash',
    collectLines: ['Clean line!', 'Prism!', 'Nice skim!', 'Still glowing!'],
    winLines: ['The tunnel opens.', 'Light held steady.'],
    loseLines: ['Gate bite.', 'Prism cracked.'],
  },
  zh: {
    time: '时间',
    score: '分数',
    kicker: '3D 光隧道',
    title: 'Prism Rush',
    startCopy: '穿过光线、擦过闸门，让棱镜一路发亮。',
    start: '启动',
    best: '最高',
    maxCombo: '最大连击',
    again: '再来一次',
    home: '返回首页',
    win: '穿出隧道',
    lose: '撞上闸门',
    collectLines: ['线很干净！', '棱镜到手！', '擦边漂亮！', '还在发光！'],
    winLines: ['隧道打开了。', '光线稳住了。'],
    loseLines: ['闸门咬住了。', '棱镜裂了。'],
  },
};

export function detectLocale() {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const locale = detectLocale();

export function t(key, vars) {
  const value = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (Array.isArray(value)) return value[0] ?? key;
  if (!vars) return value;
  return Object.entries(vars).reduce((text, [name, next]) => {
    return text.replaceAll(`{${name}}`, String(next));
  }, value);
}

export function randomLine(key) {
  const value = dictionaries[locale][key] ?? dictionaries.en[key] ?? [];
  if (!Array.isArray(value) || value.length === 0) return '';
  return value[Math.floor(Math.random() * value.length)];
}
