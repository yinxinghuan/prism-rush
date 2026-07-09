import { t } from './i18n.js';

const ALTERU_APP_URL = 'https://alteru.app';
const POSTER_URL = 'https://yinxinghuan.github.io/prism-rush/poster.svg';
const POSTER_PROMPT = 'A glowing low-poly runner rides a prism board through a cyan and violet 3D neon tunnel.';

let championPill;
let championAvatar;
let championName;
let championScore;
let overlay;
let list;
let closeButton;
let rankButton;

let lbData = { rows: [], meId: '' };
let preRunBest = 0;
let leaderboardLoaded = false;

function A() {
  return window.Aigram || null;
}

function normalizeRows(response) {
  const raw = Array.isArray(response) ? response : (response && response.data) || [];
  return raw
    .map((row, index) => ({
      ...row,
      rank: Number(row.rank) || index + 1,
      score: Number(row.score) || 0,
      user_id: row.user_id == null ? '' : String(row.user_id),
      user_name: row.user_name || row.name || '',
      head_url: row.head_url || row.userAvatarUrl || '',
    }))
    .sort((a, b) => a.rank - b.rank);
}

function shortName(name, fallback = '?') {
  const value = String(name || fallback).trim() || fallback;
  return value.length > 10 ? `${value.slice(0, 10)}...` : value;
}

function initial(name) {
  return (String(name || '?').trim().charAt(0) || '?').toUpperCase();
}

function avatarNode(row, className) {
  if (row && row.head_url) {
    const img = document.createElement('img');
    img.className = className;
    img.src = row.head_url;
    img.alt = '';
    img.draggable = false;
    img.onerror = () => img.replaceWith(initialNode(row.user_name, className));
    return img;
  }
  return initialNode(row && row.user_name, className);
}

function initialNode(name, className) {
  const span = document.createElement('span');
  span.className = `${className} ${className}--fallback`;
  span.textContent = initial(name);
  return span;
}

function renderChampion(rows = lbData.rows, meId = lbData.meId) {
  if (!championPill) return;
  const top = rows[0] || null;
  championAvatar.innerHTML = '';
  championScore.textContent = '';

  if (!top) {
    championAvatar.textContent = '★';
    championAvatar.className = 'pr-champion__avatar pr-champion__avatar--fallback';
    championName.textContent = t('leaders');
    championScore.textContent = '';
    championPill.classList.add('is-visible');
    return;
  }

  const isMe = String(top.user_id) === String(meId);
  championAvatar.className = 'pr-champion__avatar';
  if (isMe) {
    championAvatar.textContent = t('champion');
  } else {
    championAvatar.appendChild(avatarNode(top, 'pr-champion__img'));
  }
  championName.textContent = isMe ? t('you') : shortName(top.user_name);
  championScore.textContent = String(top.score);
  championPill.classList.add('is-visible');
}

function renderDownloadState() {
  lbData = { rows: [], meId: '' };
  renderChampion([], '');
  list.innerHTML = '';

  const state = document.createElement('div');
  state.className = 'pr-lb-state pr-lb-state--download';

  const mark = document.createElement('span');
  mark.className = 'pr-lb-state__mark';
  mark.textContent = '★';

  const copy = document.createElement('span');
  copy.className = 'pr-lb-state__copy';
  copy.textContent = t('openInAlterU');

  const link = document.createElement('a');
  link.className = 'pr-lb-state__link';
  link.href = ALTERU_APP_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = t('downloadAlterU');

  state.append(mark, copy, link);
  list.appendChild(state);
}

function renderLoadingState() {
  list.innerHTML = '';
  const state = document.createElement('div');
  state.className = 'pr-lb-state';
  state.textContent = t('loadingRank');
  list.appendChild(state);
}

function renderEmptyState() {
  list.innerHTML = '';
  const state = document.createElement('div');
  state.className = 'pr-lb-state';
  state.textContent = t('noScores');
  list.appendChild(state);
}

function renderRows(rows, meId) {
  list.innerHTML = '';
  if (!rows.length) {
    renderEmptyState();
    return;
  }
  rows.forEach((row) => {
    const isMe = String(row.user_id) === String(meId);
    const el = document.createElement(isMe ? 'div' : 'button');
    el.className = `pr-lb-row${isMe ? ' is-me' : ''}`;
    if (!isMe) {
      el.type = 'button';
      el.addEventListener('click', () => {
        const api = A();
        if (api && api.isInAigram && row.user_id) api.openAigramProfile(row.user_id);
      });
    }

    const rank = document.createElement('span');
    rank.className = 'pr-lb-row__rank';
    rank.textContent = `#${row.rank}`;
    el.appendChild(rank);

    if (isMe) {
      const you = document.createElement('span');
      you.className = 'pr-lb-row__you';
      you.textContent = t('you');
      el.appendChild(you);
    } else {
      el.appendChild(avatarNode(row, 'pr-lb-row__avatar'));
      const name = document.createElement('span');
      name.className = 'pr-lb-row__name';
      name.textContent = row.user_name || '?';
      el.appendChild(name);
    }

    const score = document.createElement('span');
    score.className = 'pr-lb-row__score';
    score.textContent = String(row.score);
    el.appendChild(score);

    list.appendChild(el);
  });
}

function setOverlay(open) {
  overlay.classList.toggle('is-visible', open);
  overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
}

export function openLeaderboard() {
  const api = A();
  if (!api || !api.canRank) {
    renderDownloadState();
    setOverlay(true);
    return;
  }

  setOverlay(true);
  if (lbData.rows.length) renderRows(lbData.rows, lbData.meId);
  else renderLoadingState();
  refreshLeaderboard();
}

export async function refreshLeaderboard() {
  const api = A();
  if (!api || !api.canRank) {
    renderChampion([], '');
    if (overlay && overlay.classList.contains('is-visible')) renderDownloadState();
    return [];
  }

  try {
    const response = await api.callAigramAPI(
      `/note/aigram/ai/game/rank/score/list/by/session_id?session_id=${encodeURIComponent(api.gameUuid)}`,
      'GET',
    );
    const rows = normalizeRows(response);
    const meId = String(api.telegramId || '');
    lbData = { rows, meId };
    leaderboardLoaded = true;
    renderChampion(rows, meId);
    if (overlay && overlay.classList.contains('is-visible')) renderRows(rows, meId);
    return rows;
  } catch {
    return lbData.rows;
  }
}

export function snapshotPreRunBest() {
  const api = A();
  if (api && api.canRank && !leaderboardLoaded) {
    preRunBest = Number.POSITIVE_INFINITY;
    return;
  }
  const meId = api && api.telegramId ? String(api.telegramId) : '';
  const me = meId ? lbData.rows.find((row) => String(row.user_id) === meId) : null;
  preRunBest = me ? Number(me.score) || 0 : 0;
}

async function submitScore(score) {
  const api = A();
  if (!api || !api.canRank) return;
  await api.callAigramAPI('/note/aigram/ai/game/rank/score/save', 'POST', {
    session_id: api.gameUuid,
    score: Math.round(score),
  });
}

async function sendBeatNotify(myScore) {
  const api = A();
  if (!api || !api.canRank || !api.telegramId) return;
  if (myScore <= preRunBest) return;
  try {
    const rows = await refreshLeaderboard();
    const meId = String(api.telegramId);
    const beaten = rows
      .filter((row) => String(row.user_id) !== meId)
      .map((row) => ({ id: String(row.user_id), score: Number(row.score) || 0 }))
      .filter((row) => row.score < myScore && row.score > preRunBest)
      .sort((a, b) => b.score - a.score)[0];
    if (!beaten) return;
    api.postAigramAPI('/note/aigram/ai/game/record/play', {
      session_id: api.gameUuid,
      event: 'score_beat',
      config_json: {
        actions: [{
          type: 'notify',
          target_user_id: beaten.id,
          image: {
            ref_url: POSTER_URL,
            prompt: POSTER_PROMPT,
          },
          message: {
            template: `{sender_name} just beat your record — ${Math.round(myScore)} pts on Prism Rush.`,
            variables: ['sender_name'],
          },
        }],
      },
    });
  } catch {
    // Notification must never block the game-over flow.
  }
}

export function submitFinalScore(score) {
  const finalScore = Math.round(Number(score) || 0);
  if (finalScore <= 0) return;
  submitScore(finalScore)
    .then(() => sendBeatNotify(finalScore))
    .catch(() => {})
    .finally(() => {
      window.setTimeout(() => {
        refreshLeaderboard().catch(() => {});
      }, 1200);
    });
}

export function initLeaderboard() {
  championPill = document.getElementById('championPill');
  championAvatar = document.getElementById('championAvatar');
  championName = document.getElementById('championName');
  championScore = document.getElementById('championScore');
  overlay = document.getElementById('leaderboardOverlay');
  list = document.getElementById('leaderboardList');
  closeButton = document.getElementById('leaderboardClose');
  rankButton = document.getElementById('rankButton');

  championPill.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openLeaderboard();
  });
  rankButton.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    openLeaderboard();
  });
  closeButton.addEventListener('click', () => setOverlay(false));
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) setOverlay(false);
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') setOverlay(false);
  });

  renderChampion([], '');
  refreshLeaderboard().catch(() => {});
}
