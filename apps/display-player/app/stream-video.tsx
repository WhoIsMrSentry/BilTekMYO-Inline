'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

type StreamVideoProps = { src: string; title: string };

export function StreamVideo({ src, title }: StreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Yayına bağlanıyor…');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | undefined;
    let disposed = false;
    const isHls = /\.m3u8(?:$|[?#])/i.test(src);
    const onPlaying = () => setStatus('');
    const onWaiting = () => setStatus('Yayın yükleniyor…');
    const onVideoError = () => setStatus('Video kaynağı açılamadı. Yayın URL’sini ve bağlantıyı kontrol edin.');
    const play = () => {
      void video.play().catch(() => {
        if (!disposed) setStatus('Oynatmak için ekrana dokunun veya tıklayın.');
      });
    };

    setStatus('Yayına bağlanıyor…');
    video.muted = true;
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onVideoError);

    if (isHls && Hls.isSupported()) {
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || disposed) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus('Canlı yayına ulaşılamadı. Bağlantı yeniden deneniyor…');
          hls?.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus('Yayın biçimi toparlanıyor…');
          hls?.recoverMediaError();
        } else {
          setStatus('Bu canlı yayın oynatılamadı. Başka bir yayın adresi deneyin.');
          hls?.destroy();
          hls = undefined;
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      play();
    } else {
      setStatus('Bu tarayıcı HLS canlı yayınını desteklemiyor.');
    }

    return () => {
      disposed = true;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onVideoError);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  const isHls = /\.m3u8(?:$|[?#])/i.test(src);

  return (
    <div className="stream-player">
      <video
        ref={videoRef}
        autoPlay
        className="content-media stream-video"
        loop={!isHls}
        muted
        playsInline
        aria-label={title}
        onClick={(event) => {
          void event.currentTarget.play().then(() => setStatus('')).catch(() => {
            setStatus('Bu yayın başlatılamadı. Bağlantıyı ve tarayıcı izinlerini kontrol edin.');
          });
        }}
      />
      {status && <p className="stream-status" role="status">{status}</p>}
    </div>
  );
}
