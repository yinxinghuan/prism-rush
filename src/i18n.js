const dictionaries = {
  en: {
    time: 'Time',
    score: 'Score',
    kicker: '3D light tunnel',
    title: 'Prism Rush',
    startCopy: 'Thread the glow, skim the gates, keep the prism singing.',
    metricRun: 'sprint',
    metricLanes: 'lanes',
    metricCombo: 'combo',
    runnerReady: 'Runner ready',
    readyHint: 'Dodge red gates. Chase clean lines.',
    start: 'Launch',
    best: 'Best',
    maxCombo: 'Max Combo',
    chooseRunner: 'Choose runner',
    selected: 'Selected',
    leaderboard: 'Leaderboard',
    leaders: 'Leaders',
    leaderboardKicker: 'Global rank',
    leaderboardTitle: 'Prism Leaders',
    loadingRank: 'Loading rank...',
    noScores: 'No scores yet. Be first through the tunnel.',
    openInAlterU: 'Open in AlterU to view the leaderboard.',
    downloadAlterU: 'Get AlterU',
    you: 'YOU',
    champion: '#1',
    character_student: 'Student',
    character_teen: 'Teen',
    character_punk: 'Punk',
    character_cowboy: 'Cowboy',
    character_nurse: 'Nurse',
    character_cat: 'Cat',
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
    metricRun: '冲刺',
    metricLanes: '轨道',
    metricCombo: '连击',
    runnerReady: '角色就绪',
    readyHint: '避开红门，追出干净路线。',
    start: '启动',
    best: '最高',
    maxCombo: '最大连击',
    chooseRunner: '选择角色',
    selected: '已选择',
    leaderboard: '排行榜',
    leaders: '排行榜',
    leaderboardKicker: '全服排行',
    leaderboardTitle: '棱镜榜',
    loadingRank: '排行榜加载中...',
    noScores: '还没有成绩，先穿出隧道吧。',
    openInAlterU: '在 AlterU 中打开即可查看排行榜。',
    downloadAlterU: '下载 AlterU',
    you: '你',
    champion: '#1',
    character_student: '学生',
    character_teen: '少年',
    character_punk: '朋克',
    character_cowboy: '牛仔',
    character_nurse: '护士',
    character_cat: '猫',
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
