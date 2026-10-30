'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayContent, DisplayMetricsSnapshot, PlaylistSnapshot } from '@biltekmyo/shared-types';
import { ThemeSwitcher, useDisplayTheme } from '@biltekmyo/theme';
import { LocalStorageSnapshotStorage, PlaylistCache, PlaybackQueue } from '../src/index';
import { StreamVideo } from './stream-video';

type ConnectionState = 'loading' | 'live' | 'offline';

const typeLabels: Record<DisplayContent['type'], string> = {
  announcement: 'Duyuru', image: 'Görsel', video: 'Video', 'school-info': 'Okul bilgisi', metrics: 'Canlı veri', emergency: 'Acil duyuru',
};

function titleSize(title: string): string {
  if (title.length <= 28) return 'title-xl';
  return title.length <= 64 ? 'title-lg' : 'title-md';
}

/** Lives apart from the page so the one-second tick does not re-render the slide. */
function Clock() {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [hours = '--', minutes = '--'] = now?.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).split(':') ?? [];
  return (
    <div className="clock">
      <strong>{hours}<i className="clock-colon">:</i>{minutes}</strong>
      <span>{now?.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  );
}

function Slide({ item, apiUrl }: { item: DisplayContent; apiUrl: string }) {
  const attachment = item.payload.attachmentUrl;
  const attachmentSrc = attachment ? `${apiUrl}${attachment}` : '';
  const isPdf = Boolean(attachment && /\.pdf(?:\?|$)/i.test(attachment));
  const isImage = Boolean(attachment && /\.(png|jpe?g|webp)(?:\?|$)/i.test(attachment));
  const isVideo = Boolean(attachment && /\.mp4(?:\?|$)/i.test(attachment));
  const imageSrc = isImage ? attachmentSrc : item.payload.imageUrl;
  const hasMedia = isPdf || isVideo || Boolean(imageSrc) || Boolean(item.payload.videoUrl);
  const emergency = item.type === 'emergency';

  if (!hasMedia) {
    return (
      <div className="slide-text">
        <span className="slide-chip">
          {emergency && <svg aria-hidden="true" fill="none" height="1.2em" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.200" viewBox="0 0 24 24" width="1.2em"><path d="M12 3.500 2.500 20h19L12 3.500ZM12 10v4.500M12 17.500h.01" /></svg>}
          {typeLabels[item.type]}
        </span>
        <h1 className={titleSize(item.title)}>{item.title}</h1>
        {item.payload.text && <p className="slide-body">{item.payload.text}</p>}
      </div>
    );
  }
  return (
    <div className={isPdf ? 'slide-media slide-document' : 'slide-media'}>
      <div className="media-stage">
        {imageSrc && <img alt="" className="media-backdrop" src={imageSrc} />}
        {imageSrc && <img alt={item.payload.attachmentName ?? item.title} className="media-fill" src={imageSrc} />}
        {isVideo && <video autoPlay className="media-fill" loop muted playsInline src={attachmentSrc} />}
        {isPdf && <iframe className="media-fill" src={attachmentSrc} title={item.payload.attachmentName ?? item.title} />}
        {item.payload.videoUrl && <StreamVideo src={item.payload.videoUrl} title={item.title} />}
      </div>
      <div className="media-caption">
        <span className="slide-chip">{typeLabels[item.type]}</span>
        <h1 className="title-sm">{item.title}</h1>
        {item.payload.text && <p className="slide-body">{item.payload.text}</p>}
      </div>
    </div>
  );
}

export default function DisplayPage() {
  const [snapshot, setSnapshot] = useState<PlaylistSnapshot>();
  const [metricsSnapshot, setMetricsSnapshot] = useState<DisplayMetricsSnapshot>();
  const [metricsConnection, setMetricsConnection] = useState<ConnectionState>('loading');
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayId, setDisplayId] = useState('display-01');
  const [hydrated, setHydrated] = useState(false);
  const playlistItemsKey = useRef('');
  const [fullscreen, setFullscreen] = useState(false);
  const [pointerIdle, setPointerIdle] = useState(true);
  const [commandedTheme, setCommandedTheme] = useState<string>();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  useDisplayTheme(commandedTheme);

  useEffect(() => {
    const requestedDisplay = new URLSearchParams(window.location.search).get('display');
    if (requestedDisplay && /^display-[a-zA-Z0-9-]{1,64}$/.test(requestedDisplay)) {
      setDisplayId(requestedDisplay);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  // Kiosk screens should not show a parked cursor or the corner controls.
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setPointerIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPointerIdle(true), 3000);
    };
    window.addEventListener('pointermove', wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Browser kiosk mode can still be used with F11 when Fullscreen API is blocked.
    }
  };

  const loadPlaylist = useCallback(async () => {
    const key = `playlist:${displayId}`;
    const storage = new LocalStorageSnapshotStorage();
    const cache = new PlaylistCache(storage, key);
    try {
      const response = await fetch(`${apiUrl}/playlists/${displayId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const next = await response.json() as PlaylistSnapshot;
      const nextItemsKey = JSON.stringify(next.items);
      if (playlistItemsKey.current !== nextItemsKey) {
        playlistItemsKey.current = nextItemsKey;
        setCurrentIndex(0);
      }
      cache.update(next);
      setSnapshot(next);
      setConnection('live');
    } catch {
      const cached = cache.current();
      if (cached) {
        setSnapshot(cached);
        setConnection('offline');
      } else {
        setConnection('offline');
      }
    }
  }, [apiUrl, displayId]);

  // An unreachable API keeps the last command, so a screen never loses its theme offline.
  const loadDisplayTheme = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/display-theme`, { cache: 'no-store' });
      if (!response.ok) return;
      const { theme } = await response.json() as { theme: string };
      setCommandedTheme(theme === 'auto' ? undefined : theme);
    } catch {
      // Retried with the next playlist refresh.
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadPlaylist();
    void loadDisplayTheme();
    const refresh = window.setInterval(() => { void loadPlaylist(); void loadDisplayTheme(); }, 30_000);
    const events = new EventSource(`${apiUrl}/playlists/${encodeURIComponent(displayId)}/events`);
    events.onmessage = () => { void loadPlaylist(); void loadDisplayTheme(); };
    return () => {
      window.clearInterval(refresh);
      events.close();
    };
  }, [loadDisplayTheme, loadPlaylist]);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/edge/display-metrics`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setMetricsSnapshot(await response.json() as DisplayMetricsSnapshot);
      setMetricsConnection('live');
    } catch {
      setMetricsConnection('offline');
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadMetrics();
    const refresh = window.setInterval(() => void loadMetrics(), 15_000);
    const events = new EventSource(`${apiUrl}/edge/display-metrics/events`);
    events.onmessage = (event) => {
      try {
        setMetricsSnapshot(JSON.parse(event.data) as DisplayMetricsSnapshot);
        setMetricsConnection('live');
      } catch {
        void loadMetrics();
      }
    };
    events.onerror = () => setMetricsConnection('offline');
    return () => {
      window.clearInterval(refresh);
      events.close();
    };
  }, [apiUrl, loadMetrics]);

  const items = snapshot?.items ?? [];
  const queue = new PlaybackQueue(
    new PlaylistCache(new LocalStorageSnapshotStorage(), `playlist:${displayId}`),
  );
  const cachedItems = hydrated ? queue.currentItems() : [];
  const orderedItems = cachedItems.length > 0 ? cachedItems : items;
  const slideIndex = currentIndex % Math.max(orderedItems.length, 1);
  const current = orderedItems[slideIndex];
  const cameraMetrics = metricsSnapshot?.cameras ?? [];
  const latestMetric = cameraMetrics[0];
  const isEmergency = current?.type === 'emergency';
  const isHoldingStream = /\.m3u8(?:$|[?#])/i.test(current?.payload.videoUrl ?? '');
  const upNext = orderedItems.length > 1
    ? Array.from({ length: Math.min(orderedItems.length - 1, 3) }, (_, offset) => orderedItems[(slideIndex + offset + 1) % orderedItems.length]!)
    : [];

  // Keyed on the slide, not the item object: the cached list is rebuilt on every
  // render, so depending on `current` would restart the timer on each metric update.
  const currentId = current?.id;
  const currentDuration = current?.durationSeconds;
  useEffect(() => {
    if (!currentId || !currentDuration || isHoldingStream) return;
    const timer = window.setTimeout(
      () => setCurrentIndex((index) => (index + 1) % orderedItems.length),
      currentDuration * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [currentId, currentDuration, slideIndex, isHoldingStream, orderedItems.length]);

  const connectionLabel = connection === 'live' ? 'Yayında' : connection === 'offline' ? 'Bağlantı yok' : 'Bağlanıyor';

  return (
    <main className={`display ${isEmergency ? 'emergency' : ''} ${pointerIdle ? 'pointer-idle' : ''}`}>
      <header className="display-bar">
        <div className="display-brand"><div><strong>Anadolu Üniversitesi</strong><span>Bilişim Teknolojileri Meslek Yüksekokulu</span></div></div>
        <div className={`player-status ${connection}`} aria-live="polite">
          <span className="dot" />{connectionLabel}
        </div>
        <Clock />
      </header>

      <div className="display-layout">
        <section className="stage">
          {current ? (
            <div className="slide" key={`${current.id}:${slideIndex}`}>
              <Slide apiUrl={apiUrl} item={current} />
            </div>
          ) : (
            <div className="slide">
              <div className="slide-text slide-idle">
                <span className="slide-chip">Yayın bekleniyor</span>
                <h1 className="title-xl">{connection === 'offline' ? 'Sunucuya ulaşılamıyor' : 'Hoş geldiniz'}</h1>
                <p className="slide-body">{connection === 'offline' ? 'Bağlantı geldiğinde yayın kendiliğinden başlar.' : 'Bu ekran için şu anda aktif içerik bulunmuyor.'}</p>
              </div>
            </div>
          )}
          {current && orderedItems.length > 1 && !isHoldingStream && (
            <div className="slide-progress" aria-hidden="true">
              <i key={`${current.id}:${slideIndex}`} style={{ animationDuration: `${current.durationSeconds}s` }} />
            </div>
          )}
        </section>

        {!isEmergency && (
          <aside className="rail" aria-label="Sıradaki yayınlar ve canlı sonuçlar">
            {orderedItems.length > 1 && (
              <section className="rail-block">
                <div className="rail-head"><h2>Sıradaki</h2><span>{slideIndex + 1} / {orderedItems.length}</span></div>
                <ol className="up-next">
                  {upNext.map((item, index) => <li key={`${item.id}:${index}`}><span>{typeLabels[item.type]}</span><strong>{item.title}</strong></li>)}
                </ol>
              </section>
            )}
            <section className="rail-block rail-metrics">
              <div className="rail-head">
                <h2>Canlı analiz</h2>
                <span className={`metrics-connection ${metricsConnection}`}><span className="dot" />{metricsConnection === 'live' ? 'Bağlı' : metricsConnection === 'offline' ? 'Çevrimdışı' : 'Bağlanıyor'}</span>
              </div>
              {latestMetric ? (
                <>
                  <div className="metrics-hero"><strong>{latestMetric.peopleCount}</strong><span>kişi<small>{latestMetric.cameraId}</small></span></div>
                  <table className="metrics-table">
                    <thead><tr><th>Kamera</th><th>Kişi</th><th>Giriş</th><th>Çıkış</th><th>Doluluk</th></tr></thead>
                    <tbody>
                      {cameraMetrics.map((metric) => (
                        <tr key={`${metric.aiBoxId}:${metric.cameraId}`}>
                          <td>{metric.cameraId}</td>
                          <td className="metric-number">{metric.peopleCount}</td>
                          <td>{metric.entries}</td>
                          <td>{metric.exits}</td>
                          <td>{metric.estimatedOccupancy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="metrics-empty">{metricsConnection === 'offline' ? 'Metrik sunucusuna ulaşılamıyor.' : 'Kamera verisi geldiğinde burada görünecek.'}</p>
              )}
              <p className="privacy-label">Anonim sayaçlar · görüntü saklanmaz{latestMetric ? ` · ${new Date(latestMetric.capturedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
            </section>
          </aside>
        )}
      </div>

      <div className="display-theme"><ThemeSwitcher placement="above" /></div>
      <button className="fullscreen-toggle" type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'} title={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'}>
        <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><path d={fullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} /></svg>
      </button>
    </main>
  );
}
