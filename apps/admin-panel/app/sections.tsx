'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent } from 'react';
import type { DisplayMetricsSnapshot } from '@biltekmyo/shared-types';
import { rotationMinutes, themes } from '@biltekmyo/theme';
import { Icon } from './icons';
import type { IconName } from './icons';
import { ScreenPreview } from './screen-preview';
import { Empty, StatusBadge } from './ui';
import { contentStatus, formatClock, formatDateTime, formatDay, formatDays, formatRelative, formatTime, greeting, heartbeatState, normalizeSearch, nowPlaying, statusMeta, typeMeta } from './domain';
import type { AiBox, Content, ContentStatus, ContentType, Display, Section } from './domain';

export type MetricSample = { at: number; total: number };
export type StreamState = 'connecting' | 'live' | 'offline';

function PageHeading({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children?: React.ReactNode }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{lead}</p></div>{children}</section>;
}
function CardHeading({ title, detail, icon, children }: { title: string; detail?: string; icon?: IconName; children?: React.ReactNode }) {
  return <div className="card-heading"><div><h2>{icon && <Icon name={icon} size={19} />}{title}</h2>{detail && <p>{detail}</p>}</div>{children}</div>;
}
function StatTile({ label, value, detail, icon, onClick }: { label: string; value: string | number; detail: string; icon: IconName; onClick?: () => void }) {
  return <button className="stat-tile" disabled={!onClick} onClick={onClick} type="button"><span className="stat-top"><span>{label}</span><Icon name={icon} size={17} /></span><strong>{value}</strong><small>{detail}</small></button>;
}
function QuickTile({ label, value, icon, onClick }: { label: string; value: string | number; icon: IconName; onClick: () => void }) {
  return <button className="quick-tile" onClick={onClick} type="button"><Icon name={icon} size={46} /><strong>{value}</strong><span>{label}</span></button>;
}
type HeroSlide = { id: string; eyebrow: string; title: string; lead?: string; item?: Content };
function HeroCarousel({ slides, onCreate, onEdit }: { slides: HeroSlide[]; onCreate: () => void; onEdit: (item: Content) => void }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const active = slides[index % count]!;
  useEffect(() => {
    if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), 7000);
    return () => window.clearTimeout(timer);
  }, [count, index]);
  return (
    <section aria-label="Öne çıkanlar" className="hero">
      <div className="hero-slide" key={active.id}>
        <span className="hero-eyebrow">{active.eyebrow}</span>
        <h1>{active.title}</h1>
        {active.lead && <p className="hero-lead">{active.lead}</p>}
        {active.item
          ? <button className="button button-hero" onClick={() => onEdit(active.item!)} type="button"><Icon name="edit" size={16} />İçeriği düzenle</button>
          : <button className="button button-hero" onClick={onCreate} type="button"><Icon name="plus" size={17} />Yeni içerik</button>}
      </div>
      {count > 1 && <>
        <button aria-label="Önceki" className="hero-arrow prev" onClick={() => setIndex((value) => (value - 1 + count) % count)} type="button"><Icon name="chevronLeft" size={22} /></button>
        <button aria-label="Sonraki" className="hero-arrow next" onClick={() => setIndex((value) => (value + 1) % count)} type="button"><Icon name="chevronRight" size={22} /></button>
        <div className="hero-dots">{slides.map((slide, position) => <button aria-label={`${position + 1}. slayt`} className={position === index % count ? 'active' : ''} key={slide.id} onClick={() => setIndex(position)} type="button" />)}</div>
      </>}
    </section>
  );
}
function ContentMark({ type }: { type: ContentType }) {
  return <span className={type === 'emergency' ? 'content-mark emergency-mark' : 'content-mark'}><Icon name={typeMeta[type].icon} size={17} /></span>;
}
function previewProps(item?: Content) {
  if (!item) return {};
  const name = item.payload.attachmentUrl ?? '';
  const mediaKind = item.payload.videoUrl ? 'stream' as const : /\.(png|jpe?g|webp)(?:\?|$)/i.test(name) ? 'image' as const : /\.mp4(?:\?|$)/i.test(name) ? 'video' as const : name ? 'document' as const : undefined;
  return { type: item.type, title: item.title, text: item.payload.text, mediaKind };
}
function LiveTag({ state }: { state: StreamState }) {
  return <span className={`stream-tag ${state}`}><i />{state === 'live' ? 'Canlı' : state === 'offline' ? 'Bağlantı yok' : 'Bağlanıyor'}</span>;
}
function CameraTable({ cameras }: { cameras: DisplayMetricsSnapshot['cameras'] }) {
  const hasGenderOutput = cameras.some((metric) => (metric.genderDistribution?.female ?? 0) + (metric.genderDistribution?.male ?? 0) > 0);
  return (
    <>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Kamera</th><th className="numeric">Kişi</th><th className="numeric">Giriş</th><th className="numeric">Çıkış</th><th className="numeric">Kadın tahmini</th><th className="numeric">Erkek tahmini</th><th className="numeric">Belirsiz</th><th>Hareket</th><th>Son ölçüm</th></tr></thead>
        <tbody>{cameras.map((metric) => <tr key={`${metric.aiBoxId}:${metric.cameraId}`}><td className="strong">{metric.cameraId}</td><td className="numeric strong">{metric.peopleCount}</td><td className="numeric">{metric.entries}</td><td className="numeric">{metric.exits}</td><td className="numeric">{metric.genderDistribution?.female ?? '—'}</td><td className="numeric">{metric.genderDistribution?.male ?? '—'}</td><td className="numeric">{metric.genderDistribution?.unknown ?? '—'}</td><td>{metric.motionDetected ? 'Algılandı' : 'Yok'}</td><td>{formatClock(metric.capturedAt)}</td></tr>)}</tbody>
      </table></div>
      {cameras.length > 0 && !hasGenderOutput && <p className="field-note">Bağlı YOLOX modeli kişi algılar, cinsiyet sınıflandırmaz. Bu nedenle kişiler “belirsiz” sayılır; tahmini kadın/erkek değeri üretilmez.</p>}
    </>
  );
}

type OverviewProps = {
  now: number; displays: Display[]; contents: Content[]; aiBoxes: AiBox[]; metrics?: DisplayMetricsSnapshot; streamState: StreamState; loading: boolean;
  go: (section: Section) => void; onCreate: () => void; onEdit: (item: Content) => void; onPreview: (display: Display) => void; onEnd: (item: Content) => void;
};
export function Overview({ now, displays, contents, aiBoxes, metrics, streamState, loading, go, onCreate, onEdit, onPreview, onEnd }: OverviewProps) {
  const live = contents.filter((item) => contentStatus(item, now) === 'live');
  const upcoming = contents.filter((item) => contentStatus(item, now) === 'scheduled').sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt));
  const emergencies = live.filter((item) => item.type === 'emergency');
  const litDisplays = displays.filter((display) => nowPlaying(contents, display.id, now).length > 0).length;
  const cameras = metrics?.cameras ?? [];
  const date = new Date(now);
  const slides: HeroSlide[] = [
    { id: 'summary', eyebrow: date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }), title: `${greeting(date.getHours())}, ekranlarınız hazır`, lead: `${live.length ? `${litDisplays} ekranda ${live.length} içerik yayında.` : 'Şu anda yayında içerik yok.'}${upcoming[0] ? ` Sıradaki yayın ${formatRelative(upcoming[0].schedule.startsAt, now)}.` : ''}` },
    ...live.slice(0, 3).map((item): HeroSlide => ({ id: item.id, eyebrow: `Yayında · ${typeMeta[item.type].label}`, title: item.title, lead: item.payload.text, item })),
  ];
  return <>
    {emergencies.map((item) => <div className="emergency-banner" key={item.id} role="alert"><Icon name="alert" /><div><strong>Acil yayın sürüyor: {item.title}</strong><small>{item.schedule.displayIds.length} ekranda diğer yayınlar durduruldu · {formatRelative(item.schedule.endsAt, now)} sona erer</small></div><button className="button button-light" onClick={() => onEnd(item)} type="button"><Icon name="stop" size={15} />Yayını bitir</button></div>)}
    <svg aria-hidden="true" className="icon-defs"><defs><linearGradient id="icon-stroke" x1="0" x2="1" y1="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--icon-a)' }} /><stop offset="1" style={{ stopColor: 'var(--icon-b)' }} /></linearGradient></defs></svg>
    <HeroCarousel onCreate={onCreate} onEdit={onEdit} slides={slides} />
    <section className={loading ? 'quick-band loading' : 'quick-band'}>
      <QuickTile icon="monitor" label="Ekranlar" onClick={() => go('displays')} value={displays.length} />
      <QuickTile icon="play" label="Yayında" onClick={() => go('content')} value={live.length} />
      <QuickTile icon="calendar" label="Planlı yayın" onClick={() => go('schedule')} value={upcoming.length} />
      <QuickTile icon="cpu" label="AI Box" onClick={() => go('devices')} value={aiBoxes.length} />
      <QuickTile icon="users" label="Anlık kişi" onClick={() => go('analytics')} value={cameras.length ? cameras.reduce((total, metric) => total + metric.peopleCount, 0) : '—'} />
    </section>
    <div className="home-body">
    <div className="overview-grid">
      <section className="card">
        <CardHeading detail="Her ekranın şu anki yayını" icon="monitor" title="Ekranlarda ne var?"><button className="text-button" onClick={() => go('displays')} type="button">Tümü <Icon name="chevronRight" size={14} /></button></CardHeading>
        {displays.length ? <div className="now-list">{displays.slice(0, 4).map((display) => {
          const rotation = display.enabled ? nowPlaying(contents, display.id, now) : [];
          return <button className="now-row" key={display.id} onClick={() => onPreview(display)} type="button">
            <ScreenPreview {...previewProps(rotation[0])} idle={display.enabled ? 'Yayın yok' : 'Kapalı'} />
            <span className="now-info"><strong>{display.name}</strong><small>{display.location}</small><em>{rotation.length ? `${rotation[0].title}${rotation.length > 1 ? ` +${rotation.length - 1}` : ''}` : display.enabled ? 'Aktif içerik yok' : 'Ekran kapalı'}</em></span>
            <Icon className="row-arrow" name="eye" size={17} />
          </button>;
        })}</div> : <Empty action="Ekran ekle" detail="Yayın yapacağınız ilk ekranı tanımlayın." icon="monitor" onAction={() => go('displays')} title="Henüz ekran eklenmemiş" />}
      </section>
      <section className="card">
        <CardHeading detail="Sıraya göre sonraki içerikler" icon="calendar" title="Yaklaşan yayınlar"><button className="text-button" onClick={() => go('schedule')} type="button">Tümü <Icon name="chevronRight" size={14} /></button></CardHeading>
        {upcoming.length ? <div className="row-list">{upcoming.slice(0, 5).map((item) => <button className="list-row" key={item.id} onClick={() => onEdit(item)} type="button"><ContentMark type={item.type} /><span className="list-info"><strong>{item.title}</strong><small>{formatDateTime(item.schedule.startsAt)} · {item.schedule.displayIds.length} ekran</small></span><span className="list-time">{formatRelative(item.schedule.startsAt, now)}</span></button>)}</div> : <Empty action="İçerik oluştur" detail="Yeni bir içerik planlayın, burada sıraya girsin." icon="calendar" onAction={onCreate} title="Planlı yayın yok" />}
      </section>
    </div>
    <section className="card">
      <CardHeading detail="Görüntü işleme sonuçları anonim sayaçlardır" icon="camera" title="Kamera sonuçları"><LiveTag state={streamState} /></CardHeading>
      {cameras.length ? <CameraTable cameras={cameras} /> : <Empty detail="AI Box ilk ölçümü gönderdiğinde sonuçlar burada görünür." icon="camera" title="Model ölçümü bekleniyor" />}
    </section>
    </div>
  </>;
}

type DisplaysViewProps = {
  now: number; displays: Display[]; contents: Content[]; displayTheme: string; onDisplayTheme: (theme: string) => void;
  onAdd: () => void; onEdit: (display: Display) => void; onRemove: (display: Display) => void; onToggle: (display: Display) => void; onPreview: (display: Display) => void; onCopyLink: (display: Display) => void; onPlan: (display: Display) => void;
};
export function DisplaysView({ now, displays, contents, displayTheme, onDisplayTheme, onAdd, onEdit, onRemove, onToggle, onPreview, onCopyLink, onPlan }: DisplaysViewProps) {
  return <>
    <PageHeading eyebrow="Yayın noktaları" lead="Ekranları yönetin, oynatıcı bağlantısını alın ve canlı önizleyin." title="Ekranlar"><button className="button button-primary" onClick={onAdd} type="button"><Icon name="plus" size={17} />Ekran ekle</button></PageHeading>
    <section className="card">
      <CardHeading detail="Tüm ekranlara anında uygulanır" icon="monitor" title="Ekran teması">
        <select aria-label="Ekran teması" className="select" onChange={(event) => onDisplayTheme(event.target.value)} value={displayTheme}>
          <option value="auto">Otomatik: {rotationMinutes} dakikada bir</option>
          {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
        </select>
      </CardHeading>
    </section>
    {displays.length ? <div className="display-grid">{displays.map((display) => {
      const rotation = display.enabled ? nowPlaying(contents, display.id, now) : [];
      return <article className={display.enabled ? 'display-card' : 'display-card disabled'} key={display.id}>
        <button aria-label={`${display.name} önizle`} className="display-screen" onClick={() => onPreview(display)} type="button"><ScreenPreview {...previewProps(rotation[0])} idle={display.enabled ? 'Aktif yayın yok' : 'Ekran kapalı'} /><span className="display-screen-hover"><Icon name="eye" />Canlı önizle</span></button>
        <div className="display-body">
          <div className="display-title"><div><h3>{display.name}</h3><p><Icon name="mapPin" size={14} />{display.location}</p></div><label className="switch" title={display.enabled ? 'Ekranı kapat' : 'Ekranı aç'}><input aria-label={`${display.name} yayın durumu`} checked={display.enabled} onChange={() => onToggle(display)} type="checkbox" /><span /></label></div>
          <p className="display-now">{rotation.length ? `${rotation.length} içerik dönüyor` : display.enabled ? 'Aktif içerik yok' : 'Yayın kapalı, oynatıcı içerik almaz'}</p>
        </div>
        <footer className="display-foot">
          <button className="text-button" onClick={() => onPlan(display)} type="button">Yayın planı</button>
          <span>
            <button aria-label="Oynatıcı bağlantısını kopyala" className="icon-button" onClick={() => onCopyLink(display)} title="Oynatıcı bağlantısını kopyala" type="button"><Icon name="link" size={16} /></button>
            <button aria-label="Düzenle" className="icon-button" onClick={() => onEdit(display)} title="Düzenle" type="button"><Icon name="edit" size={16} /></button>
            <button aria-label="Ekranı kaldır" className="icon-button danger" onClick={() => onRemove(display)} title="Ekranı kaldır" type="button"><Icon name="trash" size={16} /></button>
          </span>
        </footer>
      </article>;
    })}</div> : <section className="card"><Empty action="Ekran ekle" detail="İlk yayın noktanızı ekleyerek başlayın." icon="monitor" onAction={onAdd} title="Henüz ekran yok" /></section>}
  </>;
}

type StatusFilter = 'all' | ContentStatus;
type ContentViewProps = { now: number; contents: Content[]; displays: Display[]; onCreate: () => void; onEdit: (item: Content) => void; onDuplicate: (item: Content) => void; onEnd: (item: Content) => void; onRemove: (item: Content) => void };
export function ContentView({ now, contents, displays, onCreate, onEdit, onDuplicate, onEnd, onRemove }: ContentViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [type, setType] = useState<ContentType | 'all'>('all');
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: contents.length, live: 0, scheduled: 0, ended: 0 };
    contents.forEach((item) => { result[contentStatus(item, now)] += 1; });
    return result;
  }, [contents, now]);
  const order: Record<ContentStatus, number> = { live: 0, scheduled: 1, ended: 2 };
  const visible = useMemo(() => {
    const needle = normalizeSearch(query);
    return contents
      .filter((item) => filter === 'all' || contentStatus(item, now) === filter)
      .filter((item) => type === 'all' || item.type === type)
      .filter((item) => !needle || normalizeSearch(`${item.title} ${item.payload.text ?? ''} ${item.payload.attachmentName ?? ''}`).includes(needle))
      .sort((a, b) => order[contentStatus(a, now)] - order[contentStatus(b, now)] || a.schedule.startsAt.localeCompare(b.schedule.startsAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contents, filter, now, query, type]);
  const displayName = (id: string) => displays.find((display) => display.id === id)?.name ?? id;
  const filters: StatusFilter[] = ['all', 'live', 'scheduled', 'ended'];
  return <>
    <PageHeading eyebrow="İçerik yönetimi" lead="Duyuru, görsel, video, canlı yayın ve belgeleri tek listeden yönetin." title="İçerikler"><button className="button button-primary" onClick={onCreate} type="button"><Icon name="plus" size={17} />Yeni içerik</button></PageHeading>
    <section className="toolbar">
      <div className="segmented" role="tablist" aria-label="Duruma göre filtrele">{filters.map((value) => <button aria-selected={filter === value} className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} role="tab" type="button">{value === 'all' ? 'Tümü' : statusMeta[value]}<i>{counts[value]}</i></button>)}</div>
      <label className="search-field"><Icon name="search" size={16} /><input aria-label="İçeriklerde ara" onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, metin veya dosya ara" type="search" value={query} /></label>
      <select aria-label="Türe göre filtrele" className="select" onChange={(event) => setType(event.target.value as ContentType | 'all')} value={type}><option value="all">Tüm türler</option>{Object.entries(typeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select>
    </section>
    <section className="card card-flush">
      {visible.length ? <div className="content-list">{visible.map((item) => {
        const status = contentStatus(item, now);
        return <article className="content-row" key={item.id}>
          <ContentMark type={item.type} />
          <button className="content-main" onClick={() => onEdit(item)} type="button">
            <strong>{item.title}</strong>
            <small>{typeMeta[item.type].label}{item.payload.text ? ` · ${item.payload.text}` : ''}{item.payload.attachmentName ? ` · ${item.payload.attachmentName}` : ''}</small>
          </button>
          <div className="content-targets"><Icon name="monitor" size={14} /><span>{item.schedule.displayIds.map(displayName).join(', ')}</span></div>
          <div className="content-when"><span>{formatDateTime(item.schedule.startsAt)}</span><small>{formatDateTime(item.schedule.endsAt)} · {formatDays(item.schedule.daysOfWeek)}</small></div>
          <StatusBadge status={status} />
          <div className="row-actions">
            {status === 'live' && <button aria-label="Yayını bitir" className="icon-button" onClick={() => onEnd(item)} title="Yayını şimdi bitir" type="button"><Icon name="stop" size={15} /></button>}
            <button aria-label="Kopyala" className="icon-button" onClick={() => onDuplicate(item)} title="Kopyasını oluştur" type="button"><Icon name="copy" size={15} /></button>
            <button aria-label="Düzenle" className="icon-button" onClick={() => onEdit(item)} title="Düzenle" type="button"><Icon name="edit" size={15} /></button>
            <button aria-label="Sil" className="icon-button danger" onClick={() => onRemove(item)} title="Sil" type="button"><Icon name="trash" size={15} /></button>
          </div>
        </article>;
      })}</div> : contents.length
        ? <Empty action="Filtreleri temizle" detail="Arama veya filtreyi değiştirip tekrar deneyin." icon="search" onAction={() => { setQuery(''); setFilter('all'); setType('all'); }} title="Eşleşen içerik yok" />
        : <Empty action="İçerik oluştur" detail="İlk duyurunuzu oluşturup yayın zamanını belirleyin." onAction={onCreate} title="İçerik kütüphanesi boş" />}
    </section>
  </>;
}

const dayMs = 86_400_000;
function ganttSegments(item: Content, windowStart: number): { left: number; width: number }[] {
  const start = Date.parse(item.schedule.startsAt); const end = Date.parse(item.schedule.endsAt);
  const days = item.schedule.daysOfWeek;
  const segments: { left: number; width: number }[] = [];
  for (let index = 0; index < 7; index += 1) {
    const dayStart = new Date(windowStart); dayStart.setDate(dayStart.getDate() + index);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    if (days?.length && !days.includes(dayStart.getDay())) continue;
    const from = Math.max(start, dayStart.getTime()); const to = Math.min(end, dayEnd.getTime());
    if (to <= from) continue;
    const left = (index + (from - dayStart.getTime()) / dayMs) / 7 * 100;
    const width = (to - from) / dayMs / 7 * 100;
    const previous = segments[segments.length - 1];
    if (previous && Math.abs(previous.left + previous.width - left) < 0.01) previous.width += width;
    else segments.push({ left, width });
  }
  return segments;
}

type ScheduleViewProps = { now: number; contents: Content[]; displays: Display[]; selected: string; onSelect: (id: string) => void; onCreate: () => void; onEdit: (item: Content) => void };
export function ScheduleView({ now, contents, displays, selected, onSelect, onCreate, onEdit }: ScheduleViewProps) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const windowStart = today.getTime();
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(today); day.setDate(day.getDate() + index); return day; });
  const display = displays.find((item) => item.id === selected);
  const assigned = contents.filter((item) => item.schedule.displayIds.includes(selected)).sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt));
  const rows = assigned.map((item) => ({ item, segments: ganttSegments(item, windowStart) })).filter((row) => row.segments.length);
  const nowOffset = (now - windowStart) / dayMs / 7 * 100;
  return <>
    <PageHeading eyebrow="Yayın kontrolü" lead="Bir ekranın önümüzdeki yedi gününü tek bakışta görün." title="Yayın Planı">
      {displays.length > 0 && <select aria-label="Ekran seç" className="select" onChange={(event) => onSelect(event.target.value)} value={selected}>{displays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
    </PageHeading>
    <section className="card">
      <CardHeading detail={display?.location} title={display?.name ?? 'Yayın noktası yok'}><span className="count-tag">{assigned.length} içerik</span></CardHeading>
      {rows.length ? <div className="gantt-scroll"><div className="gantt">
        <div className="gantt-head"><span />{days.map((day, index) => <span className={index === 0 ? 'today' : ''} key={day.getTime()}><b>{day.toLocaleDateString('tr-TR', { weekday: 'short' })}</b>{day.getDate()}</span>)}</div>
        {rows.map(({ item, segments }) => <div className="gantt-row" key={item.id}>
          <button className="gantt-label" onClick={() => onEdit(item)} title={item.title} type="button">{item.title}</button>
          <div className="gantt-track"><i className="gantt-now" style={{ left: `${nowOffset}%` }} />{segments.map((segment) => <button aria-label={`${item.title} düzenle`} className={`gantt-bar ${item.type === 'emergency' ? 'emergency' : ''}`} key={segment.left} onClick={() => onEdit(item)} style={{ left: `${segment.left}%`, width: `max(${segment.width}%, 6px)` }} title={`${item.title}\n${formatDateTime(item.schedule.startsAt)} → ${formatDateTime(item.schedule.endsAt)}`} type="button" />)}</div>
        </div>)}
      </div></div> : <Empty action="İçerik ekle" detail="Bu ekran için önümüzdeki 7 günde yayın görünmüyor." icon="calendar" onAction={onCreate} title="Bu hafta planlı içerik yok" />}
    </section>
    {assigned.length > 0 && <section className="card">
      <CardHeading detail="Bu ekrana atanmış tüm içerikler" title="Akış" />
      <div className="row-list">{assigned.map((item) => <button className="list-row" key={item.id} onClick={() => onEdit(item)} type="button"><ContentMark type={item.type} /><span className="list-info"><strong>{item.title}</strong><small>{formatDateTime(item.schedule.startsAt)} → {formatDateTime(item.schedule.endsAt)} · {formatDays(item.schedule.daysOfWeek)} · {item.durationSeconds} sn</small></span><StatusBadge status={contentStatus(item, now)} /></button>)}</div>
    </section>}
  </>;
}

export function DevicesView({ now, aiBoxes, metrics }: { now: number; aiBoxes: AiBox[]; metrics?: DisplayMetricsSnapshot }) {
  return <>
    <PageHeading eyebrow="Edge durumu" lead="AI Box cihazlarının bağlantısı ve kameralardan gelen son ölçümler." title="Cihazlar"><span className="count-tag">{aiBoxes.length} AI Box</span></PageHeading>
    {aiBoxes.length ? aiBoxes.map((box) => {
      const state = heartbeatState(box, now);
      return <section className="card" key={box.id}>
        <CardHeading detail={`${box.id} · Son sinyal: ${box.lastHeartbeatAt ? formatRelative(box.lastHeartbeatAt, now) : 'henüz yok'}`} title={box.name}><span className={`badge badge-${state.tone}`}><i />{state.label}</span></CardHeading>
        <div className="camera-grid">{box.cameraIds.map((camera) => {
          const metric = metrics?.cameras.find((item) => item.aiBoxId === box.id && item.cameraId === camera);
          return <article className="camera-card" key={camera}><span className="content-mark"><Icon name="camera" size={17} /></span><div><strong>{camera}</strong><small>{metric ? `Son ölçüm ${formatClock(metric.capturedAt)}` : 'Ölçüm bekleniyor'}</small></div>{metric && <b>{metric.peopleCount}<small>kişi</small></b>}</article>;
        })}</div>
      </section>;
    }) : <section className="card"><Empty detail="Agent API’ye kaydolduğunda cihaz ve kamera bilgileri burada görünür." icon="cpu" title="AI Box henüz kayıtlı değil" /></section>}
  </>;
}

function SessionChart({ samples }: { samples: MetricSample[] }) {
  const [hover, setHover] = useState<number>();
  const first = samples[0]?.at ?? 0; const span = Math.max((samples[samples.length - 1]?.at ?? 0) - first, 1);
  const peak = Math.max(4, ...samples.map((sample) => sample.total));
  const top = Math.ceil(peak / 2) * 2;
  const x = (at: number) => (at - first) / span * 100;
  const y = (value: number) => 100 - value / top * 100;
  const line = samples.map((sample, index) => `${index ? 'L' : 'M'}${x(sample.at).toFixed(2)} ${y(sample.total).toFixed(2)}`).join(' ');
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = first + (event.clientX - box.left) / box.width * span;
    let closest = 0;
    samples.forEach((sample, index) => { if (Math.abs(sample.at - at) < Math.abs((samples[closest]?.at ?? 0) - at)) closest = index; });
    setHover(closest);
  };
  const active = hover === undefined ? undefined : samples[hover];
  const last = samples[samples.length - 1];
  return (
    <div className="chart">
      <div className="chart-axis"><span>{top}</span><span>{top / 2}</span><span>0</span></div>
      <div className="chart-plot" onPointerLeave={() => setHover(undefined)} onPointerMove={onMove}>
        <svg aria-label={`Oturum boyunca kişi sayısı, son değer ${last?.total ?? 0}`} preserveAspectRatio="none" role="img" viewBox="0 0 100 100">
          {[0, 50, 100].map((value) => <line className="chart-grid" key={value} vectorEffect="non-scaling-stroke" x1="0" x2="100" y1={value} y2={value} />)}
          <path className="chart-area" d={`${line} L100 100 L0 100 Z`} />
          <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        {last && !active && <i className="chart-dot" style={{ left: '100%', top: `${y(last.total)}%` }} />}
        {active && <>
          <i className="chart-cross" style={{ left: `${x(active.at)}%` }} />
          <i className="chart-dot" style={{ left: `${x(active.at)}%`, top: `${y(active.total)}%` }} />
          <div className={x(active.at) > 70 ? 'chart-tip flip' : 'chart-tip'} style={{ left: `${x(active.at)}%` }}><strong>{active.total} kişi</strong><small>{formatClock(active.at)}</small></div>
        </>}
      </div>
    </div>
  );
}

export function AnalyticsView({ metrics, samples, streamState }: { metrics?: DisplayMetricsSnapshot; samples: MetricSample[]; streamState: StreamState }) {
  const cameras = metrics?.cameras ?? [];
  const sum = (pick: (metric: DisplayMetricsSnapshot['cameras'][number]) => number) => cameras.reduce((total, metric) => total + pick(metric), 0);
  return <>
    <PageHeading eyebrow="Anonim raporlama" lead="Kameralardan gelen toplu sayaçlar. Görüntü saklanmaz, kişi tanımlanmaz." title="Analitik"><LiveTag state={streamState} /></PageHeading>
    {cameras.length ? <>
      <section className="stat-grid">
        <StatTile detail={`${cameras.length} kamera toplamı`} icon="users" label="Anlık kişi" value={sum((metric) => metric.peopleCount)} />
        <StatTile detail="Sayaç başlangıcından beri" icon="arrowRight" label="Giriş" value={sum((metric) => metric.entries)} />
        <StatTile detail="Sayaç başlangıcından beri" icon="logout" label="Çıkış" value={sum((metric) => metric.exits)} />
        <StatTile detail="Giriş ve çıkıştan tahmin" icon="chart" label="Tahmini doluluk" value={sum((metric) => metric.estimatedOccupancy)} />
      </section>
      <section className="card">
        <CardHeading detail="Bu sayfa açıkken gelen ölçümler; geçmiş veri saklanmaz" title="Kişi sayısı akışı" />
        {samples.length > 1 ? <SessionChart samples={samples} /> : <p className="field-note">Grafik için ikinci ölçüm bekleniyor.</p>}
      </section>
      <section className="card"><CardHeading title="Kamera bazında" /><CameraTable cameras={cameras} /></section>
    </> : <section className="card"><Empty detail="AI Box ölçüm göndermeye başladığında toplu sayaçlar burada görünür." icon="chart" title="Henüz ölçüm yok" /></section>}
    <p className="foot-note"><Icon name="clock" size={14} />Son güncelleme: {metrics ? formatTime(metrics.generatedAt) : '—'} · {metrics ? formatDay(metrics.generatedAt) : ''}</p>
  </>;
}
