'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { DisplayMetricsSnapshot } from '@biltekmyo/shared-types';
import { applyTheme, ThemeSwitcher, themes, useActiveTheme } from '@biltekmyo/theme';
import { CommandPalette } from './command-palette';
import type { PaletteEntry } from './command-palette';
import { ContentEditor } from './content-editor';
import { BrandLockup, Icon } from './icons';
import { AnalyticsView, ContentView, DevicesView, DisplaysView, Overview, ScheduleView } from './sections';
import type { MetricSample, StreamState } from './sections';
import { ConfirmDialog, Modal, Toasts } from './ui';
import type { ConfirmRequest, Toast } from './ui';
import { api, apiUrl, contentStatus, errorMessage, jsonInit, playerUrl, sections, UnauthorizedError } from './domain';
import type { AiBox, Content, Display, Section } from './domain';

type EditorState = { item?: Content } | undefined;
type DisplayForm = { id?: string; name: string; location: string; enabled: boolean } | undefined;
const sampleLimit = 180;

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api('/auth/login', jsonInit('POST', { username, password })); setPassword(''); onSignedIn(); }
    catch (cause) { setError(errorMessage(cause, 'Giriş yapılamadı.')); }
    finally { setBusy(false); }
  }
  return (
    <main className="auth-screen">
      <section className="auth-brand">
        <BrandLockup />
        <div className="auth-pitch">
          <h2>Okulun tüm ekranları, tek bir yerden.</h2>
          <p>Duyuruyu yazın, zamanını seçin, hedef ekranları işaretleyin. Gerisi saniyeler içinde ekrana yansır.</p>
        </div>
        <ul className="auth-points">
          <li><Icon name="calendar" size={17} />Zamanlanmış yayın</li>
          <li><Icon name="alert" size={17} />Tek tıkla acil duyuru</li>
          <li><Icon name="shield" size={17} />Anonim, cihazda kalan analiz</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h1>Tekrar hoş geldiniz</h1>
          <p className="auth-copy">Yönetim paneline erişmek için giriş yapın.</p>
          <form className="login-form" onSubmit={signIn}>
            <label className="field">Kullanıcı adı<input autoComplete="username" autoFocus onChange={(event) => setUsername(event.target.value)} required value={username} /></label>
            <label className="field">Parola
              <span className="password-field">
                <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} />
                <button aria-label={showPassword ? 'Parolayı gizle' : 'Parolayı göster'} onClick={() => setShowPassword((value) => !value)} type="button"><Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} /></button>
              </span>
            </label>
            {error && <p className="form-error" role="alert"><Icon name="alert" size={16} />{error}</p>}
            <button className="button button-primary button-block" disabled={busy} type="submit">{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
          </form>
          <small className="auth-footnote">Giriş bilgileri sunucu ortam değişkenlerinde yönetilir.</small>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  const [auth, setAuth] = useState<'checking' | 'signed-out' | 'signed-in'>('checking');
  const [section, setSection] = useState<Section>('overview');
  const [displays, setDisplays] = useState<Display[]>([]);
  const [aiBoxes, setAiBoxes] = useState<AiBox[]>([]);
  const [metricsSnapshot, setMetricsSnapshot] = useState<DisplayMetricsSnapshot>();
  const [metricsStreamState, setMetricsStreamState] = useState<StreamState>('connecting');
  const [samples, setSamples] = useState<MetricSample[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'connected' | 'error'>('loading');
  const [loaded, setLoaded] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [editor, setEditor] = useState<EditorState>();
  const [displayForm, setDisplayForm] = useState<DisplayForm>();
  const [displayError, setDisplayError] = useState('');
  const [previewDisplay, setPreviewDisplay] = useState<Display>();
  const [confirm, setConfirm] = useState<ConfirmRequest>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeTheme = useActiveTheme();
  const [displayTheme, setDisplayTheme] = useState('auto');
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  const applyMetrics = useCallback((snapshot: DisplayMetricsSnapshot) => {
    setMetricsSnapshot(snapshot);
    if (!snapshot.cameras.length) return;
    const at = Date.parse(snapshot.generatedAt);
    const total = snapshot.cameras.reduce((sum, metric) => sum + metric.peopleCount, 0);
    setSamples((current) => current[current.length - 1]?.at === at ? current : [...current, { at, total }].slice(-sampleLimit));
  }, []);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const [displayResponse, contentResponse, boxResponse, metricsResponse, themeResponse] = await Promise.all([
        api('/displays'), api('/content'), api('/edge/ai-boxes'), api('/edge/display-metrics'), api('/display-theme'),
      ]);
      const nextDisplays = await displayResponse.json() as Display[];
      setDisplays(nextDisplays);
      setContents(await contentResponse.json() as Content[]);
      setAiBoxes(await boxResponse.json() as AiBox[]);
      applyMetrics(await metricsResponse.json() as DisplayMetricsSnapshot);
      setDisplayTheme((await themeResponse.json() as { theme: string }).theme);
      setSelectedDisplay((current) => nextDisplays.some((item) => item.id === current) ? current : nextDisplays[0]?.id ?? '');
      setLoadError(''); setLoadState('connected'); setLoaded(true); setNow(Date.now());
    } catch (error) {
      if (error instanceof UnauthorizedError) { setAuth('signed-out'); return; }
      setLoadError(errorMessage(error, 'Veriler alınamadı.'));
      setLoadState('error');
    }
  }, [applyMetrics]);

  useEffect(() => {
    api('/auth/session').then(() => setAuth('signed-in')).catch(() => setAuth('signed-out'));
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);
  useEffect(() => { if (auth === 'signed-in') void refresh(); }, [auth, refresh]);
  useEffect(() => {
    if (auth !== 'signed-in') return;
    const ticker = window.setInterval(() => setNow(Date.now()), 20_000);
    const events = new EventSource(`${apiUrl}/edge/display-metrics/events`);
    events.onopen = () => setMetricsStreamState('live');
    events.onmessage = (event) => {
      try { applyMetrics(JSON.parse(event.data) as DisplayMetricsSnapshot); } catch { void refresh(); }
    };
    events.onerror = () => setMetricsStreamState('offline');
    return () => { window.clearInterval(ticker); events.close(); };
  }, [applyMetrics, auth, refresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem('biltekmyo-theme', next); } catch { /* Theme still applies for this visit. */ }
  }
  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuth('signed-out'); setSection('overview');
  }
  const openEditor = useCallback((item?: Content) => setEditor({ item }), []);
  const go = useCallback((next: Section) => { setSection(next); window.scrollTo({ top: 0 }); }, []);

  async function mutate(action: () => Promise<unknown>, success: string, failure: string) {
    try { await action(); await refresh(); notify(success); }
    catch (error) { notify(errorMessage(error, failure), 'error'); }
  }
  function removeContent(item: Content) {
    setConfirm({ title: 'İçerik silinsin mi?', detail: `“${item.title}” kalıcı olarak silinecek ve ekranlardan kalkacak.`, action: 'Sil', run: () => mutate(() => api(`/content/${encodeURIComponent(item.id)}`, { method: 'DELETE' }), 'İçerik silindi.', 'İçerik silinemedi.') });
  }
  function endContent(item: Content) {
    setConfirm({ title: 'Yayın bitirilsin mi?', detail: `“${item.title}” ekranlardan hemen kalkacak. İçerik kütüphanede kalır.`, action: 'Yayını bitir', run: () => mutate(() => api(`/content/${encodeURIComponent(item.id)}`, jsonInit('PUT', { ...item, schedule: { ...item.schedule, endsAt: new Date().toISOString() } })), 'Yayın sonlandırıldı.', 'Yayın sonlandırılamadı.') });
  }
  function duplicateContent(item: Content) {
    void mutate(() => api('/content', jsonInit('POST', { ...item, id: `content-${crypto.randomUUID()}`, title: `${item.title} (kopya)`.slice(0, 140) })), 'Kopya oluşturuldu.', 'Kopya oluşturulamadı.');
  }
  async function saveDisplay(event: FormEvent) {
    event.preventDefault();
    if (!displayForm) return;
    setDisplayError('');
    const { id, ...body } = displayForm;
    try {
      await api(`/displays${id ? `/${encodeURIComponent(id)}` : ''}`, jsonInit(id ? 'PUT' : 'POST', body));
      setDisplayForm(undefined); await refresh(); notify(id ? 'Ekran güncellendi.' : 'Ekran eklendi.');
    } catch (error) { setDisplayError(errorMessage(error, 'Ekran kaydedilemedi.')); }
  }
  function removeDisplay(display: Display) {
    setConfirm({ title: 'Ekran kaldırılsın mı?', detail: `“${display.name}” ve bu ekrana yapılan içerik atamaları kaldırılacak.`, action: 'Kaldır', run: () => mutate(() => api(`/displays/${encodeURIComponent(display.id)}`, { method: 'DELETE' }), 'Ekran kaldırıldı.', 'Ekran kaldırılamadı.') });
  }
  function toggleDisplay(display: Display) {
    const { id, ...body } = display;
    void mutate(() => api(`/displays/${encodeURIComponent(id)}`, jsonInit('PUT', { ...body, enabled: !display.enabled })), display.enabled ? 'Ekran kapatıldı.' : 'Ekran açıldı.', 'Ekran durumu değiştirilemedi.');
  }
  const playerLink = (display: Display) => `${playerUrl}/?display=${encodeURIComponent(display.id)}`;
  const previewLink = (display: Display) => `${playerLink(display)}&theme=${activeTheme.id}`;
  function changeDisplayTheme(theme: string) {
    void mutate(() => api('/display-theme', jsonInit('PUT', { theme })), theme === 'auto' ? 'Ekranlar otomatik temaya geçti.' : 'Ekran teması değiştirildi.', 'Ekran teması değiştirilemedi.');
  }
  async function copyPlayerLink(display: Display) {
    try { await navigator.clipboard.writeText(playerLink(display)); notify('Oynatıcı bağlantısı kopyalandı.'); }
    catch { notify('Bağlantı kopyalanamadı.', 'error'); }
  }

  const liveCount = useMemo(() => contents.filter((item) => contentStatus(item, now) === 'live').length, [contents, now]);
  const paletteEntries = useMemo<PaletteEntry[]>(() => [
    { id: 'new', label: 'Yeni içerik', hint: 'Oluştur', icon: 'plus', run: () => openEditor() },
    ...sections.map((item): PaletteEntry => ({ id: item.id, label: item.label, hint: 'Sayfa', icon: item.icon, run: () => go(item.id) })),
    ...displays.map((display): PaletteEntry => ({ id: display.id, label: display.name, hint: display.location, icon: 'monitor', run: () => setPreviewDisplay(display) })),
    ...contents.map((item): PaletteEntry => ({ id: item.id, label: item.title, hint: 'İçerik', icon: 'layers', run: () => openEditor(item) })),
    ...themes.map((theme): PaletteEntry => ({ id: `theme-${theme.id}`, label: theme.label, hint: 'Tema', icon: 'layers', run: () => applyTheme(theme) })),
  ], [contents, displays, go, openEditor]);

  if (auth === 'checking') return <main className="auth-loading"><span className="orbit-loader" /><p>Oturum kontrol ediliyor…</p></main>;
  if (auth === 'signed-out') return <Login onSignedIn={() => setAuth('signed-in')} />;

  return (
    <main className="app-shell">
      <header className="site-header">
        <button aria-label="Genel Bakış" className="brand-home" onClick={() => go('overview')} type="button"><BrandLockup /></button>
        <nav aria-label="Ana gezinme" className="site-nav">
          {sections.map((item) => (
            <button aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'nav-item active' : 'nav-item'} key={item.id} onClick={() => go(item.id)} type="button">
              {item.label}
              {item.id === 'content' && liveCount > 0 && <i className="nav-count" title={`${liveCount} içerik yayında`}>{liveCount}</i>}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeSwitcher triggerClassName="header-button" />
          <button aria-label="Ara (Ctrl K)" className="header-button" onClick={() => setPaletteOpen(true)} title="Ara (Ctrl K)" type="button"><Icon name="search" size={17} /></button>
          <button aria-label="Yenile" className="header-button header-optional" onClick={() => void refresh()} title="Yenile" type="button"><Icon name="refresh" size={17} /></button>
          <button aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'} className="header-button theme-toggle" onClick={toggleTheme} title="Tema" type="button"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
          <button aria-label="Oturumu kapat" className="header-button" onClick={() => void signOut()} title="Oturumu kapat" type="button"><Icon name="logout" size={17} /></button>
        </div>
      </header>
      <section className="main-area">
        <div className={section === 'overview' ? 'page-content page-home' : 'page-content'} key={section}>
          {loadError && <div className="banner" role="alert"><Icon name="alert" size={18} /><div><strong>Bağlantı kurulamadı</strong><small>{loadError}</small></div><button className="button button-light" onClick={() => void refresh()} type="button">Yeniden dene</button></div>}
          {section === 'overview' && <Overview aiBoxes={aiBoxes} contents={contents} displays={displays} go={go} loading={!loaded} metrics={metricsSnapshot} now={now} onCreate={() => openEditor()} onEdit={openEditor} onEnd={endContent} onPreview={setPreviewDisplay} streamState={metricsStreamState} />}
          {section === 'displays' && <DisplaysView contents={contents} displays={displays} displayTheme={displayTheme} now={now} onDisplayTheme={changeDisplayTheme} onAdd={() => { setDisplayError(''); setDisplayForm({ name: '', location: '', enabled: true }); }} onCopyLink={(display) => void copyPlayerLink(display)} onEdit={(display) => { setDisplayError(''); setDisplayForm(display); }} onPlan={(display) => { setSelectedDisplay(display.id); go('schedule'); }} onPreview={setPreviewDisplay} onRemove={removeDisplay} onToggle={toggleDisplay} />}
          {section === 'content' && <ContentView contents={contents} displays={displays} now={now} onCreate={() => openEditor()} onDuplicate={duplicateContent} onEdit={openEditor} onEnd={endContent} onRemove={removeContent} />}
          {section === 'schedule' && <ScheduleView contents={contents} displays={displays} now={now} onCreate={() => openEditor()} onEdit={openEditor} onSelect={setSelectedDisplay} selected={selectedDisplay} />}
          {section === 'devices' && <DevicesView aiBoxes={aiBoxes} metrics={metricsSnapshot} now={now} />}
          {section === 'analytics' && <AnalyticsView metrics={metricsSnapshot} samples={samples} streamState={metricsStreamState} />}
        </div>
      </section>
      <footer className="site-footer">
        <span><Icon name="shield" size={16} />Kamera görüntüleri cihazda kalır, yalnızca anonim sayaçlar işlenir.</span>
        <span className={`system-state ${loadState}`} title={loadError || undefined}><i />{loadState === 'connected' ? 'Sistem bağlı' : loadState === 'error' ? 'Bağlantı sorunu' : 'Bağlanıyor'}</span>
      </footer>

      {editor && <ContentEditor displays={displays} item={editor.item} key={editor.item?.id ?? 'new'} onClose={() => setEditor(undefined)} onSaved={async (message) => { setEditor(undefined); await refresh(); notify(message); }} />}
      {displayForm && (
        <Modal description="Oynatıcı bu kayda bağlanarak yayın alır." onClose={() => setDisplayForm(undefined)} title={displayForm.id ? 'Ekranı düzenle' : 'Yeni ekran'}>
          <form className="modal-form" onSubmit={saveDisplay}>
            <label className="field">Ekran adı<input onChange={(event) => setDisplayForm({ ...displayForm, name: event.target.value })} placeholder="Örn. Kütüphane" required value={displayForm.name} /></label>
            <label className="field">Konum<input onChange={(event) => setDisplayForm({ ...displayForm, location: event.target.value })} placeholder="Örn. Zemin kat" required value={displayForm.location} /></label>
            {displayError && <p className="form-error" role="alert"><Icon name="alert" size={16} />{displayError}</p>}
            <div className="modal-actions"><button className="button button-ghost" onClick={() => setDisplayForm(undefined)} type="button">Vazgeç</button><button className="button button-primary" type="submit">{displayForm.id ? 'Kaydet' : 'Ekran ekle'}</button></div>
          </form>
        </Modal>
      )}
      {previewDisplay && (
        <Modal description={previewDisplay.location} onClose={() => setPreviewDisplay(undefined)} title={previewDisplay.name} wide>
          <div className="player-frame"><iframe src={previewLink(previewDisplay)} tabIndex={-1} title={`${previewDisplay.name} canlı önizleme`} /></div>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => void copyPlayerLink(previewDisplay)} type="button"><Icon name="link" size={16} />Bağlantıyı kopyala</button>
            <a className="button button-primary" href={playerLink(previewDisplay)} rel="noreferrer" target="_blank">Oynatıcıyı aç</a>
          </div>
        </Modal>
      )}
      {paletteOpen && <CommandPalette entries={paletteEntries} onClose={() => setPaletteOpen(false)} />}
      {confirm && <ConfirmDialog onClose={() => setConfirm(undefined)} request={confirm} />}
      <Toasts onDismiss={dismissToast} toasts={toasts} />
      <nav aria-label="Alt gezinme" className="bottom-nav">
        {sections.map((item) => <button aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'active' : ''} key={item.id} onClick={() => go(item.id)} type="button"><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}
      </nav>
    </main>
  );
}
