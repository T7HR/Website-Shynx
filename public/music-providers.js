'use strict';

// Public oEmbed metadata and the services' official players. No stream extraction.
const musicProvider = url => {
  try {
    const parsed = new URL(url, location.href);
    if (parsed.protocol !== 'https:') return null;
    if (['open.spotify.com', 'spotify.link'].includes(parsed.hostname)) return 'spotify';
    if (['soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com'].includes(parsed.hostname)) return 'soundcloud';
  } catch { /* A local file or an invalid URL is handled by the regular audio player. */ }
  return null;
};

const createExternalMusicPlayer = (() => {
  let soundCloudApi;
  let spotifyApi;

  function loadScript(src, ready) {
    return new Promise((resolve, reject) => {
      if (ready()) { resolve(ready()); return; }
      const script = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('Player API timed out')), 15000);
      script.src = src;
      script.onload = () => { clearTimeout(timer); const api = ready(); api ? resolve(api) : reject(new Error('Player API unavailable')); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('Player API unavailable')); };
      document.head.append(script);
    });
  }

  function spotifyReady() {
    if (!spotifyApi) {
      spotifyApi = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Spotify API timed out')), 15000);
        window.onSpotifyIframeApiReady = api => { clearTimeout(timer); resolve(api); };
        const script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.onerror = () => { clearTimeout(timer); reject(new Error('Spotify API unavailable')); };
        document.head.append(script);
      }).catch(error => { spotifyApi = null; throw error; });
    }
    return spotifyApi;
  }

  return (track, host, callbacks) => {
    const provider = musicProvider(track.url);
    const abort = new AbortController();
    let disposed = false;
    let controller;
    let frame;
    const emit = value => { if (!disposed) callbacks.state(value); };
    const player = {
      provider, currentTime: 0, duration: NaN,
      capabilities: { seek: provider === 'soundcloud', volume: provider === 'soundcloud', repeat: provider === 'soundcloud' },
      play: () => controller?.play(),
      pause: () => controller?.pause(),
      seek: seconds => controller?.seekTo(seconds * 1000),
      setVolume: value => controller?.setVolume(value),
      destroy() { disposed = true; abort.abort(); controller?.destroy?.(); host.replaceChildren(); },
    };

    function createFrame(src, height) {
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = `${provider === 'spotify' ? 'Spotify' : 'SoundCloud'} music player`;
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.height = `${height}px`;
      host.replaceChildren(iframe);
      frame = iframe;
      return iframe;
    }

    player.ready = (async () => {
      const endpoint = provider === 'spotify' ? 'https://open.spotify.com/oembed' : 'https://soundcloud.com/oembed';
      const apiUrl = new URL(endpoint);
      apiUrl.searchParams.set('url', track.url);
      apiUrl.searchParams.set('format', 'json');
      let data = {};
      try {
        const response = await fetch(apiUrl, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error('Track metadata unavailable');
        data = await response.json();
      } catch (error) {
        if (disposed) throw error;
        // Still show the official player if oEmbed is temporarily unavailable.
      }
      if (disposed) return;
      callbacks.metadata({ title: data.title, artist: data.author_name || (provider === 'spotify' ? 'Spotify' : 'SoundCloud'), cover: data.thumbnail_url });
      const document = new DOMParser().parseFromString(data.html || '', 'text/html');
      let embed;
      try {
        const candidate = new URL(data.iframe_url || document.querySelector('iframe')?.getAttribute('src'));
        const expectedHost = provider === 'spotify' ? 'open.spotify.com' : 'w.soundcloud.com';
        if (candidate.protocol === 'https:' && candidate.hostname === expectedHost) embed = candidate;
      } catch { /* Construct an official embed URL below. */ }

      if (provider === 'soundcloud') {
        embed ||= new URL('https://w.soundcloud.com/player/');
        if (!embed.searchParams.has('url')) embed.searchParams.set('url', track.url);
        for (const [key, value] of Object.entries({ auto_play: 'false', visual: 'false', show_artwork: 'true', show_comments: 'false', show_user: 'true', color: '#8c65ff' })) embed.searchParams.set(key, value);
        createFrame(embed.href, 166);
        soundCloudApi ||= loadScript('https://w.soundcloud.com/player/api.js', () => window.SC).catch(error => { soundCloudApi = null; throw error; });
        const SC = await soundCloudApi;
        if (disposed) return;
        controller = SC.Widget(frame);
        const events = SC.Widget.Events;
        controller.bind(events.PLAY, () => emit({ playing: true, loading: false, failed: false }));
        controller.bind(events.PAUSE, () => emit({ playing: false, loading: false }));
        controller.bind(events.PLAY_PROGRESS, event => { player.currentTime = event.currentPosition / 1000; if (!disposed) callbacks.progress(); });
        controller.bind(events.SEEK, event => { player.currentTime = event.currentPosition / 1000; if (!disposed) callbacks.progress(); });
        controller.bind(events.FINISH, () => { if (!disposed) callbacks.ended(); });
        controller.bind(events.ERROR, () => emit({ failed: true, playing: false, loading: false }));
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('SoundCloud player timed out')), 15000);
          controller.bind(events.READY, () => { clearTimeout(timer); resolve(); });
        });
        if (disposed) return;
        controller.getDuration(milliseconds => { player.duration = milliseconds / 1000; if (!disposed) callbacks.progress(); });
        controller.getCurrentSound(sound => { if (!disposed && sound) callbacks.metadata({ title: sound.title, artist: sound.user?.username || data.author_name || 'SoundCloud', cover: sound.artwork_url || sound.user?.avatar_url || data.thumbnail_url }); });
      } else {
        if (!embed) {
          const parsed = new URL(track.url);
          const path = parsed.pathname.replace(/^\/intl-[^/]+/, '');
          if (parsed.hostname !== 'open.spotify.com' || !/^\/(track|album|playlist|episode|show|artist)\/[A-Za-z0-9]+\/?$/.test(path)) throw new Error('Use a full open.spotify.com track link');
          embed = new URL(`https://open.spotify.com/embed${path}`);
        }
        const height = data.type === 'video' ? 352 : 152;
        createFrame(embed.href, height);
        try {
          const api = await spotifyReady();
          if (disposed) return;
          const mount = window.document.createElement('div');
          host.replaceChildren(mount);
          controller = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Spotify player timed out')), 15000);
            api.createController(mount, { uri: track.url, width: '100%', height }, value => { clearTimeout(timer); resolve(value); });
          });
          if (disposed) { controller.destroy(); return; }
          controller.addListener('playback_update', event => {
            player.currentTime = event.data.position / 1000;
            player.duration = event.data.duration / 1000;
            emit({ playing: !event.data.isPaused, loading: !!event.data.isBuffering, failed: false });
            if (!disposed) callbacks.progress();
          });
          const spotifyController = controller;
          controller = { play: () => spotifyController.play(), pause: () => spotifyController.pause(), destroy: () => spotifyController.destroy() };
        } catch {
          if (!disposed) createFrame(embed.href, height);
        }
      }
      if (!disposed) emit({ loading: false });
    })();
    // A metadata request can start before the visitor presses play.
    player.ready.catch(() => { if (!disposed) emit({ failed: true, playing: false, loading: false }); });
    return player;
  };
})();
