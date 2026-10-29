'use strict';

const config = JSON.parse(document.getElementById('site-config').textContent);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const tabTitle = Array.from(String(config.tab_title || config.title || '').trim().replace(/^@+/, ''));
let titleIndex = 0;
let deletingTitle = false;
let titleTimer;

function typeTabTitle() {
  if (document.hidden || motionPreference.matches || !tabTitle.length) return;
  titleIndex += deletingTitle ? -1 : 1;
  document.title = '@' + tabTitle.slice(0, titleIndex).join('');
  let delay = deletingTitle ? 65 : 500;
  if (titleIndex === tabTitle.length) { deletingTitle = true; delay = 1400; }
  else if (titleIndex === 0) { deletingTitle = false; delay = 1500; }
  titleTimer = setTimeout(typeTabTitle, delay);
}

function syncTabTitle() {
  clearTimeout(titleTimer);
  if (motionPreference.matches || !tabTitle.length) {
    document.title = '@' + tabTitle.join('');
  } else if (!document.hidden) {
    titleTimer = setTimeout(typeTabTitle, 500);
  }
}

document.title = motionPreference.matches ? '@' + tabTitle.join('') : '@';
syncTabTitle();
motionPreference.addEventListener('change', syncTabTitle);
document.addEventListener('visibilitychange', syncTabTitle);

let entered = false;
document.getElementById('entry').addEventListener('click', () => {
  if (entered) return;
  entered = true;
  document.body.classList.add('entered');
  const site = document.getElementById('site');
  site.inert = false; site.removeAttribute('aria-hidden');
  document.getElementById('entry').setAttribute('aria-hidden', 'true');
  document.getElementById('entry').tabIndex = -1;
  document.getElementById('music-launcher').focus({ preventScroll: true });
  document.dispatchEvent(new Event('site:entered'));
});

if (!motionPreference.matches) {
  const letterRain = document.querySelector('.letter-rain');
  Array.from('abcdefghijklmnopqrstuvwxyz').forEach((character, index) => {
    const letter = document.createElement('span');
    letter.className = 'falling-letter';
    letter.textContent = character;
    letter.style.cssText = `--left:${(index + Math.random()) * 100 / 26}%;--duration:${14 + Math.random() * 16}s;--delay:-${Math.random() * 30}s;--size:${14 + Math.random() * 7}px;--drift:${Math.random() * 90 - 45}px;--rotation:${Math.random() * 40 - 20}deg`;
    letterRain.append(letter);
  });
}

function renderProfile(profile) {
  const card = document.querySelector(`[data-profile-id="${profile.id}"]`);
  if (!card) return;
  const displayName = (profile.display_name || '').trim() || profile.name;
  card.setAttribute('aria-label', displayName);
  card.querySelector('.profile-name').textContent = displayName;
  card.querySelector('.discord-name').textContent = profile.username || profile.name;
  card.querySelector('.handle').textContent = profile.username ? `@${profile.username}` : `discord · ${profile.id}`;
  card.querySelector('.activity').textContent = profile.activity;
  card.querySelector('.activity').title = profile.activity;
  card.querySelector('.socials').setAttribute('aria-label', `Social links for ${displayName}`);
  card.querySelector('.discord-box').setAttribute('aria-label', `Open ${displayName} on Discord`);
  const status = card.querySelector('.presence-dot');
  status.dataset.status = profile.status;
  status.title = profile.status === 'unknown' ? 'Status unavailable' : profile.status;
  if (profile.avatar) {
    card.querySelectorAll('.avatar').forEach(avatar => {
      if (avatar.getAttribute('src') !== profile.avatar) {
        const fallback = avatar.getAttribute('src');
        avatar.onerror = () => { avatar.onerror = null; avatar.src = fallback; };
        avatar.src = profile.avatar;
      }
      if (avatar.classList.contains('main-avatar')) avatar.alt = `${displayName}'s Discord avatar`;
    });
  }
  card.querySelector('.connection-note').textContent = !profile.connected ? 'ยังไม่มีข้อมูล Discord · รอเชื่อมต่อ' : profile.stale ? 'reconnecting to Discord…' : '';
}

let refreshInProgress = false;
async function refreshProfiles() {
  if (refreshInProgress || document.hidden) return;
  refreshInProgress = true;
  try {
    const response = await fetch('/api/profiles', { signal: AbortSignal.timeout(14000) });
    if (!response.ok) throw new Error('Profile service unavailable');
    const data = await response.json();
    data.profiles.forEach(renderProfile);
  } catch {
    document.querySelectorAll('.connection-note').forEach(note => { note.textContent = 'เชื่อมต่อไม่ได้ · กำลังลองใหม่'; });
    document.querySelectorAll('.activity').forEach(activity => { activity.textContent = 'connection unavailable'; });
    document.querySelectorAll('.presence-dot').forEach(dot => { dot.dataset.status = 'unknown'; dot.title = 'Status unavailable'; });
  } finally { refreshInProgress = false; }
}
refreshProfiles();
setInterval(refreshProfiles, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProfiles(); });
