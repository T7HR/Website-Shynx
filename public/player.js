'use strict';

(() => {
  const widget = document.getElementById('music-widget');
  const panel = document.getElementById('music-panel');
  const launcher = document.getElementById('music-launcher');
  const closeButton = document.getElementById('player-close');
  const playButton = document.getElementById('music-play');
  const muteButton = document.getElementById('sound');
  const volumeSlider = document.getElementById('volume');
  const seek = document.getElementById('music-seek');
  const statusText = document.getElementById('player-status-text');
  const previousButton = document.getElementById('music-previous');
  const nextButton = document.getElementById('music-next');
  const shuffleButton = document.getElementById('music-shuffle');
  const repeatButton = document.getElementById('music-repeat');
  const defaultCover = config.music_cover || '/assets/logo-sx.png';
  const configuredTracks = Array.isArray(config.music_tracks) ? config.music_tracks.filter(track => track && typeof track.url === 'string' && track.url.trim()) : [];
  const tracks = configuredTracks.length ? configuredTracks : config.music_url ? [{ url: config.music_url, title: config.music_title, artist: config.music_artist, cover: config.music_cover }] : [];
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';
  const volumeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/>';
  let audio;
  let external;
  let context;
  let gain;
  let currentTrack = 0;
  let playing = false;
  let loading = false;
  let failed = false;
  let started = false;
  let muted = false;
  let repeat = true;
  let shuffle = false;
  let volume = 50;
  let lastVolume = 50;
  let revision = 0;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function updateProgress() {
    const source = external || audio;
    const duration = source?.duration;
    const current = source?.currentTime || 0;
    const seekable = (!external || external.capabilities.seek) && Number.isFinite(duration) && duration > 0;
    const progress = seekable ? Math.min(100, current / duration * 100) : 0;
    seek.disabled = !seekable;
    seek.value = progress;
    seek.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`);
    document.getElementById('waveform').style.setProperty('--progress', `${progress}%`);
    document.getElementById('music-current').textContent = formatTime(current);
    document.getElementById('music-duration').textContent = formatTime(duration);
  }

  function paintPlayback() {
    const spinning = playing && !loading && !failed;
    widget.classList.toggle('is-playing', spinning);
    widget.classList.toggle('has-error', failed);
    statusText.textContent = failed ? 'Audio unavailable' : loading ? 'Loading…' : playing ? 'Playing' : external && started ? 'Press play below' : started ? 'Paused' : 'Ready';
    playButton.innerHTML = playing ? pauseIcon : playIcon;
    playButton.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    playButton.setAttribute('aria-pressed', String(playing));
    widget.querySelector('.launcher-play').innerHTML = playing ? pauseIcon : playIcon;
    previousButton.disabled = tracks.length < 2;
    nextButton.disabled = tracks.length < 2;
    shuffleButton.disabled = tracks.length < 2;
    shuffleButton.title = tracks.length < 2 ? 'Add more music_tracks to enable shuffle' : 'Shuffle';
    shuffleButton.setAttribute('aria-pressed', String(shuffle));
    repeatButton.setAttribute('aria-pressed', String(repeat));
    repeatButton.disabled = !tracks.length || (external && !external.capabilities.repeat);
    muteButton.disabled = !!external && !external.capabilities.volume;
    volumeSlider.disabled = muteButton.disabled;
    paintVolume();
  }

  function paintVolume() {
    const silent = muted || volume === 0;
    muteButton.innerHTML = volumeIcon + (silent ? '<path d="m16 9 5 6m0-6-5 6"/>' : '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>') + '</svg>';
    const label = silent ? 'Unmute music' : 'Mute music';
    muteButton.setAttribute('aria-label', label);
    muteButton.setAttribute('aria-pressed', String(silent));
    muteButton.title = label;
    volumeSlider.value = volume;
    volumeSlider.style.setProperty('--volume', `${volume}%`);
    volumeSlider.setAttribute('aria-valuetext', `${volume}%${silent ? ' (muted)' : ''}`);
    document.getElementById('volume-value').value = `${volume}%`;
    document.getElementById('sound-caption').textContent = failed ? 'audio unavailable' : !playing ? 'sound paused' : silent ? 'sound muted' : `volume ${volume}%`;
  }

  function applyVolume() {
    if (audio) { audio.volume = volume / 100; audio.muted = muted; }
    external?.setVolume(muted ? 0 : volume);
    if (gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(playing && !muted ? volume / 100 * .32 : 0, now, .08);
    }
    paintVolume();
  }

  function updateTrack() {
    const track = tracks[currentTrack] || {};
    const title = track.metadata?.title || track.title || config.music_title || 'Shynx Radio';
    const artist = track.metadata?.artist || track.artist || config.music_artist || config.title;
    document.getElementById('player-title').textContent = title;
    document.getElementById('player-title').title = title;
    document.getElementById('player-artist').textContent = artist;
    launcher.title = `${title} · Open music player`;
    widget.querySelectorAll('.player-cover').forEach(image => {
      image.onerror = () => { image.onerror = null; image.src = '/assets/logo-sx.png'; };
      image.src = track.metadata?.cover || track.cover || defaultCover;
    });
  }

  function prepareExternal() {
    const track = tracks[currentTrack];
    const provider = track && musicProvider(track.url);
    widget.dataset.provider = provider || 'file';
    widget.classList.toggle('is-external', !!provider);
    const host = document.getElementById('provider-player');
    const note = document.getElementById('provider-note');
    host.hidden = !provider;
    note.hidden = !provider;
    if (!provider) return;
    const link = document.getElementById('provider-link');
    link.href = track.url;
    link.textContent = provider === 'spotify' ? 'Open in Spotify' : 'Open in SoundCloud';
    external = createExternalMusicPlayer(track, host, {
      metadata(value) { track.metadata = { ...track.metadata, ...value }; updateTrack(); },
      state(value) {
        if ('playing' in value) playing = value.playing;
        if ('loading' in value) loading = value.loading;
        if ('failed' in value) failed = value.failed;
        paintPlayback();
      },
      progress: updateProgress,
      ended() {
        if (repeat) { external.seek(0); external.play(); }
        else if (tracks.length > 1) changeTrack(1, true);
        else { playing = false; paintPlayback(); }
      },
    });
    external.ready.then(() => { applyVolume(); updateProgress(); paintPlayback(); }).catch(() => {});
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = repeat;
    audio.src = tracks[currentTrack].url;
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'emptied']) audio.addEventListener(event, updateProgress);
    audio.addEventListener('playing', () => { playing = true; loading = false; failed = false; paintPlayback(); });
    audio.addEventListener('pause', () => { playing = false; loading = false; paintPlayback(); });
    audio.addEventListener('waiting', () => { loading = true; paintPlayback(); });
    audio.addEventListener('error', () => { failed = true; playing = false; loading = false; paintPlayback(); });
    audio.addEventListener('ended', () => {
      if (tracks.length > 1) changeTrack(1, true);
      else { playing = false; paintPlayback(); }
    });
    applyVolume();
    return audio;
  }

  async function setPlaying(enabled) {
    const operation = ++revision;
    started = true;
    failed = false;
    try {
      if (external) {
        loading = true;
        paintPlayback();
        await external.ready;
        if (operation !== revision) return;
        if (enabled) external.play(); else external.pause();
        loading = false;
        // Playback events from the service confirm whether audio actually started.
        paintPlayback();
        return;
      } else if (tracks.length) {
        const media = ensureAudio();
        if (enabled) {
          loading = true;
          paintPlayback();
          await media.play();
        } else media.pause();
      } else if (enabled) {
        context ??= new (window.AudioContext || window.webkitAudioContext)();
        await context.resume();
        if (operation !== revision) return;
        if (!gain) {
          gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
          [130.81, 196, 261.63, 329.63, 392].forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const voiceGain = context.createGain();
            oscillator.frequency.value = frequency;
            oscillator.detune.value = index % 2 ? 3 : -3;
            voiceGain.gain.value = .18 / (index + 1);
            oscillator.connect(voiceGain); voiceGain.connect(gain); oscillator.start();
          });
        }
      }
      if (operation !== revision) return;
      playing = enabled;
      loading = false;
      applyVolume();
    } catch (error) {
      if (operation !== revision) return;
      playing = false;
      loading = false;
      failed = error.name !== 'NotAllowedError';
    }
    paintPlayback();
  }

  function changeTrack(direction, continuePlaying = playing) {
    if (tracks.length < 2) return;
    revision++;
    const next = shuffle && direction > 0 ? (currentTrack + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length : (currentTrack + direction + tracks.length) % tracks.length;
    audio?.pause();
    external?.destroy();
    external = null;
    currentTrack = next;
    playing = false;
    loading = false;
    if (audio && !musicProvider(tracks[currentTrack].url)) { audio.src = tracks[currentTrack].url; audio.load(); }
    prepareExternal();
    failed = false;
    updateTrack();
    updateProgress();
    paintPlayback();
    if (continuePlaying) setPlaying(true);
  }

  function setExpanded(expanded, restoreFocus = true) {
    widget.classList.toggle('is-expanded', expanded);
    launcher.setAttribute('aria-expanded', String(expanded));
    panel.inert = !expanded;
    panel.setAttribute('aria-hidden', String(!expanded));
    if (expanded) closeButton.focus({ preventScroll: true });
    else if (restoreFocus) launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => setExpanded(true));
  closeButton.addEventListener('click', () => setExpanded(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && widget.classList.contains('is-expanded')) setExpanded(false); });
  document.addEventListener('pointerdown', event => { if (widget.classList.contains('is-expanded') && !widget.contains(event.target)) setExpanded(false, false); });
  document.addEventListener('site:entered', () => setPlaying(true));
  playButton.addEventListener('click', () => setPlaying(!playing));
  muteButton.addEventListener('click', () => {
    if (volume === 0) { volume = lastVolume; muted = false; }
    else muted = !muted;
    applyVolume();
  });
  volumeSlider.addEventListener('input', () => {
    volume = Number(volumeSlider.value);
    if (volume > 0) { lastVolume = volume; muted = false; }
    else muted = true;
    applyVolume();
  });
  seek.addEventListener('input', () => {
    const source = external || audio;
    if (source && Number.isFinite(source.duration) && source.duration > 0) {
      const seconds = Number(seek.value) / 100 * source.duration;
      if (external) external.seek(seconds); else audio.currentTime = seconds;
      updateProgress();
    }
  });
  previousButton.addEventListener('click', () => changeTrack(-1));
  nextButton.addEventListener('click', () => changeTrack(1));
  shuffleButton.addEventListener('click', () => { shuffle = !shuffle; paintPlayback(); });
  repeatButton.addEventListener('click', () => { repeat = !repeat; if (audio) audio.loop = repeat; paintPlayback(); });

  updateTrack();
  prepareExternal();
  updateProgress();
  paintPlayback();
})();
