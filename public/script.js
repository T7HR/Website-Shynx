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

const soundButton = document.getElementById('sound');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const volumeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/>';
let soundEnabled = false;
let volume = 50;
let lastNonZeroVolume = 50;
let soundRevision = 0;
let audioContext;
let masterGain;
let ambienceStarted = false;
let music;

function paintSound() {
  soundButton.innerHTML = volumeIcon + (soundEnabled ? (volume <= 50 ? '<path d="M15 8a6 6 0 0 1 0 8"/>' : '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>') : '<path d="m16 9 5 6m0-6-5 6"/>') + '</svg>';
  const label = soundEnabled ? 'Turn sound off' : 'Turn sound on';
  soundButton.setAttribute('aria-label', label);
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.title = label;
  volumeSlider.value = volume;
  volumeSlider.style.setProperty('--volume', `${volume}%`);
  volumeSlider.setAttribute('aria-valuetext', `${volume}%${soundEnabled ? '' : ' (muted)'}`);
  volumeSlider.title = `Volume ${volume}%`;
  volumeValue.value = `${volume}%`;
  document.getElementById('sound-caption').textContent = soundEnabled ? `volume ${volume}%` : 'sound off';
}

async function setSound(enabled) {
  const revision = ++soundRevision;
  enabled = enabled && volume > 0;
  try {
    if (config.music_url) {
      if (!music) { music = new Audio(config.music_url); music.loop = true; }
      music.volume = volume / 100;
      if (enabled) await music.play(); else music.pause();
    } else {
      if (enabled) {
        audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        if (revision !== soundRevision) return;
        if (!ambienceStarted) {
          masterGain = audioContext.createGain();
          masterGain.gain.value = 0;
          masterGain.connect(audioContext.destination);
          // Quiet, original ambient chord. A personal audio file can replace it in config.json.
          [130.81, 196, 261.63, 329.63, 392].forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = 'sine'; oscillator.frequency.value = frequency;
            oscillator.detune.value = index % 2 ? 3 : -3;
            gain.gain.value = 0.18 / (index + 1);
            oscillator.connect(gain); gain.connect(masterGain); oscillator.start();
          });
          ambienceStarted = true;
        }
      }
      if (masterGain) {
        const now = audioContext.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(enabled ? (volume / 100) * 0.32 : 0, now, .08);
      }
    }
    if (revision !== soundRevision) return;
    soundEnabled = enabled;
  } catch {
    if (revision !== soundRevision) return;
    soundEnabled = false;
    paintSound();
    document.getElementById('sound-caption').textContent = 'audio unavailable';
    return;
  }
  paintSound();
}

let entered = false;
document.getElementById('entry').addEventListener('click', () => {
  if (entered) return;
  entered = true;
  document.body.classList.add('entered');
  const site = document.getElementById('site');
  site.inert = false; site.removeAttribute('aria-hidden');
  document.getElementById('entry').setAttribute('aria-hidden', 'true');
  document.getElementById('entry').tabIndex = -1;
  soundButton.focus({ preventScroll: true });
  setSound(true);
});
soundButton.addEventListener('click', () => {
  if (!soundEnabled && volume === 0) volume = lastNonZeroVolume;
  setSound(!soundEnabled);
});
volumeSlider.addEventListener('input', () => {
  volume = Number(volumeSlider.value);
  if (volume > 0) lastNonZeroVolume = volume;
  paintSound();
  setSound(volume > 0);
});
paintSound();

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
