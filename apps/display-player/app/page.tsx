'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayContent, DisplayMetricsSnapshot, PlaylistSnapshot } from '@biltekmyo/shared-types';
import { LocalStorageSnapshotStorage, PlaylistCache, PlaybackQueue } from '../src/index';
import { StreamVideo } from './stream-video';

type ConnectionState = 'loading' | 'live' | 'offline';

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

  useEffect(() => {
    void loadPlaylist();
    const refresh = window.setInterval(() => void loadPlaylist(), 30_000);
    const events = new EventSource(`${apiUrl}/playlists/${encodeURIComponent(displayId)}/events`);
    events.onmessage = () => { void loadPlaylist(); };
    return () => {
      window.clearInterval(refresh);
      events.close();
    };
  }, [loadPlaylist]);

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
  const current = orderedItems[currentIndex % Math.max(orderedItems.length, 1)];
  const cameraMetrics = metricsSnapshot?.cameras ?? [];
  const latestMetric = cameraMetrics[0];

  useEffect(() => {
    if (!current) return;
    if (/\.m3u8(?:$|[?#])/i.test(current.payload.videoUrl ?? '')) return;
    const timer = window.setTimeout(
      () => setCurrentIndex((index) => (index + 1) % orderedItems.length),
      current.durationSeconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [current, orderedItems.length]);

  return (
    <main className={`display ${current?.type === 'emergency' ? 'emergency' : ''}`}>
      <div className="display-layout">
        <section className="slide">
        {current ? (
          <>
            <p className="content-type">{current.type === 'emergency' ? 'ACİL DUYURU' : current.type.toUpperCase()}</p>
            <h1>{current.title}</h1>
            {current.payload.attachmentUrl && /\.pdf(?:\?|$)/i.test(current.payload.attachmentUrl) && (
              <iframe className="content-document" src={`${apiUrl}${current.payload.attachmentUrl}`} title={current.payload.attachmentName ?? current.title} />
            )}
            {current.payload.attachmentUrl && /\.(png|jpe?g|webp)(?:\?|$)/i.test(current.payload.attachmentUrl) && (
              <img className="content-media" src={`${apiUrl}${current.payload.attachmentUrl}`} alt={current.payload.attachmentName ?? current.title} />
            )}
            {current.payload.attachmentUrl && /\.mp4(?:\?|$)/i.test(current.payload.attachmentUrl) && (
              <video autoPlay className="content-media" loop muted playsInline src={`${apiUrl}${current.payload.attachmentUrl}`} />
            )}
            {current.payload.imageUrl && (
              <img className="content-media" src={current.payload.imageUrl} alt={current.title} />
            )}
            {current.payload.videoUrl && (
              <StreamVideo src={current.payload.videoUrl} title={current.title} />
            )}
            {current.payload.text && <p className="content-text">{current.payload.text}</p>}
            {current.payload.attachmentName && <span className="attachment-caption">{current.payload.attachmentName}</span>}
          </>
        ) : (
          <>
            <p className="content-type">YAYIN BEKLENİYOR</p>
            <h1>BilTekMYO İnline</h1>
            <p className="content-text">Bu ekran için aktif bir içerik bulunmuyor.</p>
          </>
        )}
        </section>
        <aside className="metrics-panel" aria-label="Canlı görüntü işleme sonuçları">
          <div className="metrics-heading">
            <div>
              <p className="metrics-eyebrow">BİLTEKMYO · AI BOX</p>
              <h2>Canlı analiz</h2>
            </div>
            <span className={`metrics-connection ${metricsConnection}`}>
              <span className="dot" />
              {metricsConnection === 'live' ? 'BAĞLI' : metricsConnection === 'offline' ? 'ÇEVRİMDIŞI' : 'BAĞLANIYOR'}
            </span>
          </div>
          <div className="metrics-hero">
            <div>
              <span className="metrics-label">SON ALGILAMA</span>
              <p>{latestMetric?.cameraId ?? 'Kamera verisi bekleniyor'}</p>
            </div>
            <strong>{latestMetric ? latestMetric.peopleCount : '—'}</strong>
            <span className="metrics-unit">kişi</span>
          </div>
          <div className="metrics-table-heading">
            <div>
              <h3>Kamera sonuçları</h3>
              <p>Her kamera için son anonim ölçüm</p>
            </div>
            <span className="camera-count">{cameraMetrics.length} kamera</span>
          </div>
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr><th>Kamera</th><th>Kişi</th><th>Giriş</th><th>Çıkış</th><th>Doluluk</th></tr>
              </thead>
              <tbody>
                {cameraMetrics.length ? cameraMetrics.map((metric) => (
                  <tr key={`${metric.aiBoxId}:${metric.cameraId}`}>
                    <td><span className="camera-indicator" />{metric.cameraId}</td>
                    <td className="metric-number">{metric.peopleCount}</td>
                    <td>{metric.entries}</td>
                    <td>{metric.exits}</td>
                    <td>{metric.estimatedOccupancy}</td>
                  </tr>
                )) : (
                  <tr><td className="metrics-empty" colSpan={5}>
                    {metricsConnection === 'offline' ? 'Metrik sunucusuna ulaşılamıyor.' : 'Gerçek model çıktısı geldiğinde burada görünecek.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="metrics-footer">
            <span>Son ölçüm</span>
            <strong>{latestMetric ? new Date(latestMetric.capturedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</strong>
            <span className="privacy-label">Anonim sayaçlar · görüntü saklanmaz</span>
          </div>
        </aside>
      </div>
      <div className={`player-status ${connection}`} aria-live="polite">
        <span className="dot" />
        {connection === 'live' ? 'CANLI' : connection === 'offline' ? 'BAĞLANTI YOK' : 'BAĞLANIYOR'}
        <span className="status-display">{displayId}</span>
      </div>
      <button className="fullscreen-toggle" type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'} title={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'}>
        {fullscreen ? '⤢' : '⛶'}
      </button>
    </main>
  );
}



