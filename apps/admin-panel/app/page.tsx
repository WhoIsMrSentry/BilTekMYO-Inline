'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { DisplayMetricsSnapshot } from '@biltekmyo/shared-types';

type Display = { id: string; name: string; location: string; enabled: boolean };
type AiBox = { id: string; name: string; cameraIds: [string, string]; lastHeartbeatAt?: string; lastMetricsAt?: string };
type Content = {
  id: string; type: 'announcement' | 'image' | 'video' | 'school-info' | 'metrics' | 'emergency';
  title: string; payload: Record<string, string>; durationSeconds: number; priority: number;
  schedule: { displayIds: string[]; startsAt: string; endsAt: string; daysOfWeek?: number[] };
};
type Section = 'overview' | 'displays' | 'content' | 'schedule' | 'devices' | 'analytics';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const weekdays = [{ value: 1, label: 'Pzt' }, { value: 2, label: 'Sal' }, { value: 3, label: 'Çar' }, { value: 4, label: 'Per' }, { value: 5, label: 'Cum' }, { value: 6, label: 'Cmt' }, { value: 0, label: 'Paz' }];

function localDateTimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.message ?? `İstek başarısız (${response.status})`);
  }
  return response;
}

export default function DashboardPage() {
  const [auth, setAuth] = useState<'checking' | 'signed-out' | 'signed-in'>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [displays, setDisplays] = useState<Display[]>([]);
  const [aiBoxes, setAiBoxes] = useState<AiBox[]>([]);
  const [metricsSnapshot, setMetricsSnapshot] = useState<DisplayMetricsSnapshot>();
  const [metricsStreamState, setMetricsStreamState] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [contents, setContents] = useState<Content[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'connected' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Content['type']>('announcement');
  const [text, setText] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [duration, setDuration] = useState(12);
  const [startsAt, setStartsAt] = useState(() => localDateTimeValue(new Date()));
  const [endsAt, setEndsAt] = useState(() => { const end = new Date(); end.setHours(end.getHours() + 1); return localDateTimeValue(end); });
  const [targetDisplays, setTargetDisplays] = useState<string[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [attachment, setAttachment] = useState<File>();
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayLocation, setDisplayLocation] = useState('');
  const [displayError, setDisplayError] = useState('');
  const [selectedDisplay, setSelectedDisplay] = useState('');

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const [displayResponse, contentResponse, boxResponse, metricsResponse] = await Promise.all([
        api('/displays'), api('/content'), api('/edge/ai-boxes'), api('/edge/display-metrics'),
      ]);
      const nextDisplays = await displayResponse.json() as Display[];
      setDisplays(nextDisplays);
      setContents(await contentResponse.json() as Content[]);
      setAiBoxes(await boxResponse.json() as AiBox[]);
      setMetricsSnapshot(await metricsResponse.json() as DisplayMetricsSnapshot);
      setSelectedDisplay((current) => nextDisplays.some((item) => item.id === current) ? current : nextDisplays[0]?.id ?? '');
      setLoadError('');
      setLoadState('connected');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Veriler alınamadı.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    api('/auth/session').then(() => { setAuth('signed-in'); }).catch(() => setAuth('signed-out'));
  }, []);
  useEffect(() => { if (auth === 'signed-in') void refresh(); }, [auth, refresh]);
  useEffect(() => { if (!targetDisplays.length && displays.length) setTargetDisplays([displays[0].id]); }, [displays, targetDisplays.length]);
  useEffect(() => {
    if (auth !== 'signed-in') return;
    const events = new EventSource(`${apiUrl}/edge/display-metrics/events`);
    events.onopen = () => setMetricsStreamState('live');
    events.onmessage = (event) => {
      try { setMetricsSnapshot(JSON.parse(event.data) as DisplayMetricsSnapshot); } catch { void refresh(); }
    };
    events.onerror = () => setMetricsStreamState('offline');
    return () => events.close();
  }, [auth, refresh]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setLoginError('');
    try {
      await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      setPassword(''); setAuth('signed-in');
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Giriş yapılamadı.'); }
  }
  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuth('signed-out'); setSection('overview');
  }

  function resetContent() {
    setEditingId(undefined); setTitle(''); setKind('announcement'); setText(''); setStreamUrl(''); setDuration(12);
    setStartsAt(localDateTimeValue(new Date())); const end = new Date(); end.setHours(end.getHours() + 1); setEndsAt(localDateTimeValue(end));
    setTargetDisplays(displays[0] ? [displays[0].id] : []); setDaysOfWeek([]); setAttachment(undefined); setAttachmentUrl(''); setAttachmentName(''); setFormError('');
  }
  function editContent(item: Content) {
    setEditingId(item.id); setTitle(item.title); setKind(item.type); setText(item.payload.text ?? ''); setDuration(item.durationSeconds);
    setStreamUrl(item.payload.videoUrl ?? '');
    setStartsAt(localDateTimeValue(new Date(item.schedule.startsAt))); setEndsAt(localDateTimeValue(new Date(item.schedule.endsAt)));
    setTargetDisplays(item.schedule.displayIds); setDaysOfWeek(item.schedule.daysOfWeek ?? []); setAttachment(undefined);
    setAttachmentUrl(item.payload.attachmentUrl ?? ''); setAttachmentName(item.payload.attachmentName ?? ''); setFormError(''); setSection('content');
  }
  async function saveContent(event: FormEvent) {
    event.preventDefault(); setFormError(''); setSaving(true);
    try {
      if (!targetDisplays.length) throw new Error('En az bir ekran seçmelisiniz.');
      const start = new Date(startsAt); const end = new Date(endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Bitiş zamanı başlangıçtan sonra olmalı.');
      let normalizedStreamUrl = '';
      if (streamUrl.trim()) {
        let parsedStreamUrl: URL;
        try { parsedStreamUrl = new URL(streamUrl.trim()); }
        catch { throw new Error('Geçerli bir HTTPS yayın adresi girin.'); }
        if (parsedStreamUrl.protocol !== 'https:' || parsedStreamUrl.username || parsedStreamUrl.password) {
          throw new Error('Yayın adresi HTTPS olmalı ve kullanıcı bilgisi içermemeli.');
        }
        if (!/\.(?:m3u8|mp4)$/i.test(parsedStreamUrl.pathname)) {
          throw new Error('Yayın adresi .m3u8 (HLS) veya .mp4 olmalı.');
        }
        normalizedStreamUrl = parsedStreamUrl.toString();
      }
      let uploadedUrl = attachmentUrl; let uploadedName = attachmentName;
      if (attachment) {
        const form = new FormData(); form.append('file', attachment);
        const uploadResponse = await api('/media/upload', { method: 'POST', body: form });
        const uploaded = await uploadResponse.json() as { url: string; name: string };
        uploadedUrl = uploaded.url; uploadedName = uploaded.name;
      }
      const content: Content = {
        id: editingId ?? `content-${crypto.randomUUID()}`, type: kind, title: title.trim(),
        payload: { ...(text.trim() ? { text: text.trim() } : {}), ...(normalizedStreamUrl ? { videoUrl: normalizedStreamUrl } : {}), ...(uploadedUrl ? { attachmentUrl: uploadedUrl, attachmentName: uploadedName } : {}) },
        durationSeconds: duration, priority: kind === 'emergency' ? 100 : 1,
        schedule: { displayIds: targetDisplays, startsAt: start.toISOString(), endsAt: end.toISOString(), daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined },
      };
      await api(`/content${editingId ? `/${encodeURIComponent(editingId)}` : ''}`, {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content),
      });
      await refresh(); resetContent();
    } catch (error) { setFormError(error instanceof Error ? error.message : 'İçerik kaydedilemedi.'); }
    finally { setSaving(false); }
  }
  async function removeContent(id: string) {
    if (!window.confirm('Bu içeriği silmek istediğinize emin misiniz?')) return;
    try { await api(`/content/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); }
    catch (error) { setFormError(error instanceof Error ? error.message : 'Silinemedi.'); }
  }
  async function addDisplay(event: FormEvent) {
    event.preventDefault(); setDisplayError('');
    try {
      await api('/displays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: displayName, location: displayLocation, enabled: true }) });
      setDisplayName(''); setDisplayLocation(''); await refresh();
    } catch (error) { setDisplayError(error instanceof Error ? error.message : 'Ekran eklenemedi.'); }
  }
  async function removeDisplay(id: string) {
    if (!window.confirm('Bu ekranı kaldırmak istediğinize emin misiniz? İçerik atamaları da kaldırılır.')) return;
    try { await api(`/displays/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); }
    catch (error) { setDisplayError(error instanceof Error ? error.message : 'Ekran kaldırılamadı.'); }
  }

  const todayCount = useMemo(() => contents.filter((item) => Date.now() >= Date.parse(item.schedule.startsAt) && Date.now() < Date.parse(item.schedule.endsAt)).length, [contents]);
  const cameraMetrics = metricsSnapshot?.cameras ?? [];
  const latestMetric = cameraMetrics[0];
  const currentTitle = ({ overview: 'Genel Bakış', displays: 'Ekranlar', content: 'İçerikler', schedule: 'Yayın Planı', devices: 'Cihazlar', analytics: 'Analitik' } as const)[section];
  const nav: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Genel Bakış', icon: 'overview' }, { id: 'displays', label: 'Ekranlar', icon: 'displays' },
    { id: 'content', label: 'İçerikler', icon: 'content' }, { id: 'schedule', label: 'Yayın Planı', icon: 'schedule' },
    { id: 'devices', label: 'Cihazlar', icon: 'devices' }, { id: 'analytics', label: 'Analitik', icon: 'analytics' },
  ];

  if (auth === 'checking') return <main className="auth-screen"><div className="auth-card"><span className="brand-mark">B</span><p>Güvenli oturum kontrol ediliyor…</p></div></main>;
  if (auth === 'signed-out') return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-lockup"><span className="brand-mark">B</span><div><strong>BilTekMYO</strong><small>İnline yönetim</small></div></div>
        <p className="eyebrow">Yayın yönetimi</p><h1>Tekrar hoş geldiniz</h1><p className="auth-copy">Okul ekranlarınızı ve duyurularınızı yönetmek için giriş yapın.</p>
        <form className="login-form" onSubmit={signIn}>
          <label>Kullanıcı adı<input autoComplete="username" onChange={(event) => setUsername(event.target.value)} required value={username} /></label>
          <label>Parola<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          {loginError && <p className="error-message">{loginError}</p>}
          <button className="button button-primary" type="submit">Giriş yap <span>→</span></button>
        </form>
        <small className="auth-footnote">Giriş bilgileri sunucu ortam değişkenlerinde yönetilir.</small>
      </section>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark">B</span><div><strong>BilTekMYO</strong><small>İnline yayın ağı</small></div></div>
        <div className="workspace-label">Yönetim</div>
        <nav className="main-nav" aria-label="Ana gezinme">
          {nav.map((item) => <button className={section === item.id ? 'nav-item active' : 'nav-item'} key={item.id} onClick={() => setSection(item.id)}><span className="nav-icon"><NavigationIcon name={item.icon} /></span>{item.label}{item.id === 'devices' && <i className="nav-count">{aiBoxes.length}</i>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="privacy-note"><span>⌁</span><div><strong>Yerel ve anonim</strong><small>Kamera görüntüleri cihazda kalır.</small></div></div><button className="profile-button" onClick={signOut}><span className="avatar">A</span><span><strong>Yönetici</strong><small>Oturumu kapat</small></span><span className="logout-icon">↗</span></button></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>BilTekMYO</span><b>/</b><strong>{currentTitle}</strong></div><div className="topbar-actions"><span className="api-indicator"><i className={loadState === 'connected' ? 'dot dot-green' : loadState === 'error' ? 'dot dot-red' : 'dot dot-gray'} />{loadState === 'connected' ? 'Sistem bağlı' : loadState === 'error' ? 'Bağlantı sorunu' : 'Bağlanıyor'}</span><button className="icon-button" aria-label="Yenile" onClick={() => void refresh()}>↻</button><span className="top-avatar">A</span></div></header>
        <div className="page-content">
          {loadError && <div className="banner banner-error"><span>Bağlantı kurulamadı</span><small>{loadError}</small><button onClick={() => void refresh()}>Yeniden dene</button></div>}
          {section === 'overview' && <>
            <section className="page-heading"><div><p className="eyebrow">Okul yayın ağı</p><h1>Yayın kontrol merkezi</h1><p className="lead">Ekranlar, duyurular ve canlı kamera sonuçları.</p></div><button className="button button-primary" onClick={() => { resetContent(); setSection('content'); }}>＋ Yeni duyuru</button></section>
            <section className="metric-grid dashboard-metric-grid" aria-label="Yayın ağı özeti">
              <article className="metric-card"><div className="metric-top"><span>Kayıtlı ekran</span></div><strong>{displays.length}</strong><small>Yayın ağına tanımlı</small></article>
              <article className="metric-card"><div className="metric-top"><span>Aktif yayın</span></div><strong>{todayCount}</strong><small>Şu an yayın aralığında</small></article>
              <article className="metric-card"><div className="metric-top"><span>İçerik</span></div><strong>{contents.length}</strong><small>Kütüphanedeki duyurular</small></article>
              <article className="metric-card"><div className="metric-top"><span>AI Box</span></div><strong>{aiBoxes.length}</strong><small>{aiBoxes[0]?.lastHeartbeatAt ? `Son sinyal ${new Date(aiBoxes[0].lastHeartbeatAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Henüz sinyal alınmadı'}</small></article>
              <article className="metric-card people-metric-card"><div className="metric-top"><span>Algılanan kişi</span></div><strong>{latestMetric ? latestMetric.peopleCount : '—'}</strong><small>{latestMetric ? latestMetric.cameraId : 'Model sonucu bekleniyor'}</small></article>
            </section>
            <div className="overview-grid">
              <section className="surface-card"><div className="card-heading"><div><p className="eyebrow">Yayın noktaları</p><h2>Ekranlar</h2></div><button className="text-button" onClick={() => setSection('displays')}>Tüm ekranlar <span>→</span></button></div>
                {displays.length ? <div className="screen-list">{displays.slice(0, 4).map((display) => <button className="screen-row" key={display.id} onClick={() => { setSelectedDisplay(display.id); setSection('displays'); }}><span className="screen-thumb">▣</span><span className="screen-info"><strong>{display.name}</strong><small>{display.location}</small></span><span className="screen-state"><i className="dot dot-gray" />Durum alınmıyor</span><span className="row-arrow">→</span></button>)}</div> : <Empty title="Henüz ekran eklenmemiş" detail="Ekranlar bölümünden ilk yayın noktanızı ekleyin." action="Ekran ekle" onAction={() => setSection('displays')} />}
              </section>
              <section className="surface-card"><div className="card-heading"><div><p className="eyebrow">İçerik akışı</p><h2>Son duyurular</h2></div><button className="text-button" onClick={() => setSection('content')}>Kütüphaneye git <span>→</span></button></div>
                {contents.length ? <div className="recent-list">{contents.slice(0, 5).map((item) => <div className="recent-row" key={item.id}><span className={item.type === 'emergency' ? 'content-mark emergency-mark' : 'content-mark'}>{item.type === 'emergency' ? '!' : '▤'}</span><span className="recent-info"><strong>{item.title}</strong><small>{new Date(item.schedule.startsAt).toLocaleDateString('tr-TR')} · {item.schedule.displayIds.length} ekran</small></span><span className="content-pill">{item.type === 'emergency' ? 'Acil' : 'Duyuru'}</span></div>)}</div> : <Empty title="Henüz duyuru yok" detail="Bir duyuru ekleyip hangi ekranda ve ne zaman yayınlanacağını seçin." action="Duyuru oluştur" onAction={() => { resetContent(); setSection('content'); }} />}
              </section>
            </div>
            <section className="surface-card dashboard-analytics-card">
              <div className="card-heading"><div><p className="eyebrow">Canlı görüntü işleme</p><h2>Kamera sonuçları</h2></div><span className={`analytics-live ${metricsStreamState}`}><i className="dot" />{metricsStreamState === 'live' ? 'Canlı güncelleme' : metricsStreamState === 'offline' ? 'Bağlantı yok' : 'Bağlanıyor'}</span></div>
              <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Kamera</th><th>Algılanan kişi</th><th>Giriş</th><th>Çıkış</th><th>Tahmini doluluk</th><th>Son ölçüm</th></tr></thead><tbody>
                {cameraMetrics.length ? cameraMetrics.map((metric) => <tr key={`${metric.aiBoxId}:${metric.cameraId}`}><td><span className="camera-indicator" />{metric.cameraId}</td><td className="analytics-count">{metric.peopleCount}</td><td>{metric.entries}</td><td>{metric.exits}</td><td>{metric.estimatedOccupancy}</td><td>{new Date(metric.capturedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td></tr>) : <tr><td className="analytics-empty" colSpan={6}>Gerçek model ölçümü bekleniyor. AI Box ilk sonucu gönderdiğinde burada görünecek.</td></tr>}
              </tbody></table></div>
            </section>
          </>}
          {section === 'displays' && <>
            <section className="page-heading"><div><p className="eyebrow">Yayın noktaları</p><h1>Ekranlar</h1><p className="lead">Ekran kayıtlarını yönetin ve her birinin yayınını önizleyin.</p></div><span className="soft-counter">{displays.length} ekran</span></section>
            <section className="surface-card display-manager"><div className="card-heading"><div><p className="eyebrow">Ekran kayıtları</p><h2>Yayın noktaları</h2></div></div>
              {displays.length ? <div className="display-grid">{displays.map((display) => <article className="display-card" key={display.id}><div className="display-card-head"><span className="screen-preview">BilTekMYO<span>Yayın önizlemesi</span></span><span className="state-badge state-unknown">Durum bilinmiyor</span></div><div className="display-details"><h3>{display.name}</h3><p>⌖ {display.location}</p><small>{display.id}</small></div><div className="display-card-foot"><button className="text-button" onClick={() => { setSelectedDisplay(display.id); setSection('schedule'); }}>Yayın planı <span>→</span></button><button className="danger-link" onClick={() => void removeDisplay(display.id)}>Ekranı kaldır</button></div></article>)}</div> : <Empty title="Henüz ekran yok" detail="İlk yayın noktanızı aşağıdaki formdan ekleyin." />}
            </section>
            <section className="surface-card compact-card"><div className="card-heading"><div><p className="eyebrow">Yeni yayın noktası</p><h2>Ekran ekle</h2></div></div><form className="inline-form" onSubmit={addDisplay}><label>Ekran adı<input onChange={(event) => setDisplayName(event.target.value)} placeholder="Örn. Kütüphane" required value={displayName} /></label><label>Konum<input onChange={(event) => setDisplayLocation(event.target.value)} placeholder="Örn. Zemin kat" required value={displayLocation} /></label><button className="button button-dark" type="submit">Ekran kaydet</button></form>{displayError && <p className="error-message">{displayError}</p>}</section>
          </>}
          {section === 'content' && <>
            <section className="page-heading"><div><p className="eyebrow">İçerik yönetimi</p><h1>{editingId ? 'Duyuruyu düzenle' : 'Duyurular ve içerikler'}</h1><p className="lead">Metin, görsel, video, canlı yayın veya Office belgesi ekleyin.</p></div>{editingId ? <button className="button button-light" onClick={resetContent}>Vazgeç</button> : <span className="soft-counter">{contents.length} içerik</span>}</section>
            <div className="content-layout"><section className="surface-card editor-card"><div className="card-heading"><div><p className="eyebrow">İçerik oluştur</p><h2>Yayın bilgileri</h2></div><span className="required-hint">* Zorunlu alanlar</span></div>
              <form className="editor-form" onSubmit={saveContent}>
                <div className="form-grid"><label className="span-two">Başlık *<input maxLength={140} onChange={(event) => setTitle(event.target.value)} placeholder="Duyurunun başlığı" required value={title} /></label><label>İçerik türü<select onChange={(event) => setKind(event.target.value as Content['type'])} value={kind}><option value="announcement">Duyuru</option><option value="school-info">Okul bilgisi</option><option value="image">Görsel</option><option value="video">Video</option><option value="emergency">Acil duyuru</option></select></label><label>Gösterim süresi<input min="1" onChange={(event) => setDuration(Number(event.target.value))} type="number" value={duration} /></label><label className="span-two">Açıklama<textarea onChange={(event) => setText(event.target.value)} placeholder="Ekranda gösterilecek metni yazın…" rows={4} value={text} /></label></div>
                <div className="upload-zone"><label className="upload-button">＋ Dosya ekle<input accept=".pptx,.docx,.pdf,.png,.jpg,.jpeg,.webp,.mp4,application/pdf,image/png,image/jpeg,image/webp,video/mp4,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setAttachment(event.target.files?.[0])} type="file" /></label><div><strong>{attachment?.name ?? attachmentName ?? 'Duyuruya dosya ekleyin'}</strong><small>PPTX, DOCX, PDF, görsel veya MP4 · En fazla 40 MB</small></div>{attachmentUrl && <a className="text-button" href={`${apiUrl}${attachmentUrl}`} rel="noreferrer" target="_blank">Önizle ↗</a>}</div>
                <label className="span-two stream-url-field">Canlı yayın URL’si<input autoComplete="url" onChange={(event) => { setStreamUrl(event.target.value); if (event.target.value.trim()) setKind('video'); }} placeholder="https://…/playlist.m3u8" type="url" value={streamUrl} /><small>HLS (.m3u8) veya MP4 · HTTPS adresi. Yayın cihazda oynatılır; sunucuya aktarılmaz.</small></label>
                <div className="divider" /><div className="form-section-heading"><div><h3>Yayın planı</h3><p>Başlangıç, bitiş ve hedef ekranları belirleyin.</p></div></div>
                <div className="form-grid"><label>Başlangıç *<input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label>Bitiş *<input onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label></div>
                <fieldset className="choice-field"><legend>Hedef ekranlar *</legend><div className="choice-grid">{displays.map((display) => <label className="check-card" key={display.id}><input checked={targetDisplays.includes(display.id)} onChange={(event) => setTargetDisplays((current) => event.target.checked ? [...current, display.id] : current.filter((id) => id !== display.id))} type="checkbox" /><span><strong>{display.name}</strong><small>{display.location}</small></span></label>)}</div>{!displays.length && <small>Önce Ekranlar bölümünden bir ekran ekleyin.</small>}</fieldset>
                <fieldset className="choice-field"><legend>Yayın günleri</legend><div className="weekday-choice">{weekdays.map((day) => <label key={day.value}><input checked={daysOfWeek.includes(day.value)} onChange={(event) => setDaysOfWeek((current) => event.target.checked ? [...current, day.value] : current.filter((value) => value !== day.value))} type="checkbox" /><span>{day.label}</span></label>)}</div><small>Seçim yapılmazsa her gün yayınlanır.</small></fieldset>
                {formError && <p className="error-message">{formError}</p>}<div className="form-actions"><button className="button button-primary" disabled={saving || !displays.length} type="submit">{saving ? 'Kaydediliyor…' : editingId ? 'Değişiklikleri kaydet' : 'Duyuruyu kaydet'} <span>→</span></button></div>
              </form>
            </section>
            <section className="surface-card library-card"><div className="card-heading"><div><p className="eyebrow">Kütüphane</p><h2>İçerikler</h2></div><span className="soft-counter">{contents.length}</span></div>{contents.length ? <div className="library-list">{contents.map((item) => <article className="library-row" key={item.id}><span className={item.type === 'emergency' ? 'content-mark emergency-mark' : 'content-mark'}>{item.type === 'emergency' ? '!' : '▤'}</span><div className="library-info"><strong>{item.title}</strong><small>{item.schedule.displayIds.map((id) => displays.find((display) => display.id === id)?.name ?? id).join(', ')}</small>{item.payload.attachmentName && <small className="attachment-line">▧ {item.payload.attachmentName}</small>}</div><div className="library-actions"><button className="icon-button" aria-label="Düzenle" onClick={() => editContent(item)}>✎</button><button className="icon-button danger-icon" aria-label="Sil" onClick={() => void removeContent(item.id)}>×</button></div></article>)}</div> : <Empty title="Henüz içerik yok" detail="İlk duyurunuzu formdan oluşturun." />}</section></div>
          </>}
          {section === 'schedule' && <><section className="page-heading"><div><p className="eyebrow">Yayın kontrolü</p><h1>Yayın Planı</h1><p className="lead">Ekran bazında yayın sırasını ve zaman aralıklarını inceleyin.</p></div><select className="select-display" onChange={(event) => setSelectedDisplay(event.target.value)} value={selectedDisplay}>{displays.map((display) => <option key={display.id} value={display.id}>{display.name}</option>)}</select></section><section className="surface-card schedule-card"><div className="card-heading"><div><p className="eyebrow">{displays.find((item) => item.id === selectedDisplay)?.location ?? 'Ekran seçin'}</p><h2>{displays.find((item) => item.id === selectedDisplay)?.name ?? 'Yayın noktası yok'}</h2></div><span className="soft-counter">{contents.filter((item) => item.schedule.displayIds.includes(selectedDisplay)).length} içerik</span></div>{contents.filter((item) => item.schedule.displayIds.includes(selectedDisplay)).length ? <div className="timeline">{contents.filter((item) => item.schedule.displayIds.includes(selectedDisplay)).sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt)).map((item) => <div className="timeline-row" key={item.id}><span className="timeline-date">{new Date(item.schedule.startsAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}<small>{new Date(item.schedule.startsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</small></span><span className={item.type === 'emergency' ? 'timeline-marker emergency-marker' : 'timeline-marker'} /><div className="timeline-content"><strong>{item.title}</strong><small>{new Date(item.schedule.endsAt).toLocaleString('tr-TR')} bitiş · {item.durationSeconds} sn gösterim</small></div><button className="text-button" onClick={() => editContent(item)}>Düzenle</button></div>)}</div> : <Empty title="Bu ekranda planlanmış içerik yok" detail="İçerikler bölümünden hedef ekran ve yayın zamanı seçin." action="İçerik ekle" onAction={() => { resetContent(); setSection('content'); }} />}</section></>}
          {section === 'devices' && <><section className="page-heading"><div><p className="eyebrow">AI Box bağlantısı</p><h1>Cihazlar</h1><p className="lead">AI Box ve kameraların son bağlantı bilgileri.</p></div><span className="soft-counter">{aiBoxes.length} AI Box</span></section>{aiBoxes.length ? aiBoxes.map((box) => <section className="surface-card device-panel" key={box.id}><div className="card-heading"><div><p className="eyebrow">AI Box</p><h2>{box.name}</h2></div><span className="state-badge state-unknown">{box.lastHeartbeatAt ? 'Heartbeat alındı' : 'Sinyal alınmadı'}</span></div><p className="device-meta">{box.id} · Son heartbeat: {box.lastHeartbeatAt ? new Date(box.lastHeartbeatAt).toLocaleString('tr-TR') : 'Henüz yok'}</p><div className="camera-cards">{box.cameraIds.map((camera) => <article key={camera}><span className="metric-icon violet">◉</span><div><strong>{camera}</strong><small>Durum verisi bekleniyor</small></div><span className="dot dot-gray" /></article>)}</div></section>) : <section className="surface-card"><Empty title="AI Box henüz kayıtlı değil" detail="Agent API’ye kaydolduğunda cihaz ve kamera bilgileri burada görünür." /></section>}</>}
          {section === 'analytics' && <><section className="page-heading"><div><p className="eyebrow">Anonim raporlama</p><h1>Analitik</h1><p className="lead">Toplu ve anonim metriklerin özeti.</p></div></section><section className="surface-card"><Empty title="Analitik servisi henüz bağlı değil" detail="Metrik raporları API ve eşik politikaları tamamlandığında burada gösterilecek." /></section></>}
        </div>
      </section>
    </main>
  );
}

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: 'M3.5 10.5 12 3.8l8.5 6.7M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6',
    displays: 'M3.5 5.5h17v11h-17zM8 20h8M12 16.5V20',
    content: 'M5 5.5h14M5 10.5h14M5 15.5h9M5 19h14',
    schedule: 'M12 3.5v2M5 5.5l1.5 1.5M19 5.5l-1.5 1.5M4 12h2M18 12h2M12 8v4l2.5 1.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    devices: 'M4 4.5h16v6H4zM4 13.5h16v6H4zM7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6',
    analytics: 'M4 19.5h16M6.5 16v-4M11.5 16V6M16.5 16V9',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.overview} /></svg>;
}

function Empty({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span>⌑</span><strong>{title}</strong><small>{detail}</small>{action && <button className="text-button" onClick={onAction}>{action} →</button>}</div>;
}



