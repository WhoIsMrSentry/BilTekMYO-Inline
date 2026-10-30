'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { Icon } from './icons';
import { ScreenPreview } from './screen-preview';
import { useEscape } from './ui';
import { api, apiUrl, errorMessage, formatBytes, formatDateTime, formatDays, jsonInit, localDateTimeValue, maxUploadBytes, typeMeta, weekdays } from './domain';
import type { Content, ContentType, Display } from './domain';

const editorTypes: ContentType[] = ['announcement', 'school-info', 'image', 'video', 'camera-stream', 'emergency'];
const durationPresets = [8, 12, 20, 30];
const uploadAccept = '.pptx,.docx,.pdf,.png,.jpg,.jpeg,.webp,.mp4,application/pdf,image/png,image/jpeg,image/webp,video/mp4,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const hour = 3_600_000;

function endOfToday(start: Date): Date { const end = new Date(start); end.setHours(23, 59, 0, 0); return end; }
const rangePresets: { label: string; end: (start: Date) => Date }[] = [
  { label: '1 saat', end: (start) => new Date(start.getTime() + hour) },
  { label: 'Gün sonu', end: endOfToday },
  { label: '1 hafta', end: (start) => new Date(start.getTime() + 7 * 24 * hour) },
  { label: '1 ay', end: (start) => { const end = new Date(start); end.setMonth(end.getMonth() + 1); return end; } },
];
const dayPresets = [{ label: 'Her gün', days: [] as number[] }, { label: 'Hafta içi', days: [1, 2, 3, 4, 5] }, { label: 'Hafta sonu', days: [6, 0] }];

function mediaKindOf(name: string, streamUrl: string): 'image' | 'video' | 'document' | 'stream' | undefined {
  if (streamUrl) return 'stream';
  if (/\.(png|jpe?g|webp)(?:\?|$)/i.test(name)) return 'image';
  if (/\.mp4(?:\?|$)/i.test(name)) return 'video';
  return name ? 'document' : undefined;
}

type ContentEditorProps = {
  item?: Content;
  displays: Display[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
};

type ActivationMode = 'rotation' | 'interval' | 'motion';

export function ContentEditor({ item, displays, onClose, onSaved }: ContentEditorProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [kind, setKind] = useState<ContentType>(item?.type ?? 'announcement');
  const [text, setText] = useState(item?.payload.text ?? '');
  const [streamUrl, setStreamUrl] = useState(item?.payload.videoUrl ?? '');
  const [duration, setDuration] = useState(item?.durationSeconds ?? 12);
  const [startsAt, setStartsAt] = useState(() => localDateTimeValue(item ? new Date(item.schedule.startsAt) : new Date()));
  const [endsAt, setEndsAt] = useState(() => localDateTimeValue(item ? new Date(item.schedule.endsAt) : new Date(Date.now() + hour)));
  const [targetDisplays, setTargetDisplays] = useState<string[]>(item?.schedule.displayIds ?? (displays[0] ? [displays[0].id] : []));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(item?.schedule.daysOfWeek ?? []);
  const [activationMode, setActivationMode] = useState<ActivationMode>((item?.payload.activationMode as ActivationMode) ?? 'rotation');
  const [intervalMinutes, setIntervalMinutes] = useState(Number(item?.payload.intervalSeconds ?? 300) / 60);
  const [motionCooldownSeconds, setMotionCooldownSeconds] = useState(Number(item?.payload.motionCooldownSeconds ?? 15));
  const [attachment, setAttachment] = useState<File>();
  const [attachmentUrl, setAttachmentUrl] = useState(item?.payload.attachmentUrl ?? '');
  const [attachmentName, setAttachmentName] = useState(item?.payload.attachmentName ?? '');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDirty(true); }, [title, kind, text, streamUrl, duration, startsAt, endsAt, targetDisplays, daysOfWeek, activationMode, intervalMinutes, motionCooldownSeconds, attachment, attachmentUrl]);
  useEffect(() => { setDirty(false); }, []);
  useEffect(() => { if (kind === 'camera-stream' && activationMode === 'rotation') setActivationMode('motion'); }, [kind, activationMode]);

  const localPreview = useMemo(() => attachment?.type.startsWith('image/') ? URL.createObjectURL(attachment) : '', [attachment]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const close = () => { if (!dirty || window.confirm('Kaydedilmemiş değişiklikler silinecek. Çıkılsın mı?')) onClose(); };
  useEscape(close);

  function chooseFile(file?: File) {
    if (!file) return;
    if (file.size > maxUploadBytes) { setError(`${file.name} 40 MB sınırını aşıyor (${formatBytes(file.size)}).`); return; }
    setError(''); setAttachment(file);
    if (file.type.startsWith('image/') && kind === 'announcement') setKind('image');
    if (file.type === 'video/mp4' && kind === 'announcement') setKind('video');
  }
  function dropFile(event: DragEvent) { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }
  function clearAttachment() { setAttachment(undefined); setAttachmentUrl(''); setAttachmentName(''); }
  function toggle<T>(list: T[], value: T, on: boolean): T[] { return on ? [...list, value] : list.filter((entry) => entry !== value); }
  function applyRange(end: (start: Date) => Date) {
    const start = new Date(startsAt);
    const base = Number.isNaN(start.getTime()) ? new Date() : start;
    const next = end(base);
    setEndsAt(localDateTimeValue(next > base ? next : new Date(base.getTime() + hour)));
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      if (!targetDisplays.length) throw new Error('En az bir ekran seçmelisiniz.');
      const start = new Date(startsAt); const end = new Date(endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Bitiş zamanı başlangıçtan sonra olmalı.');
      if (activationMode === 'interval' && (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440 || intervalMinutes * 60 < duration)) throw new Error('Tekrar aralığı 1–1.440 dakika olmalı ve gösterim süresinden uzun olmalı.');
      if (activationMode === 'motion' && (!Number.isFinite(motionCooldownSeconds) || motionCooldownSeconds < 5 || motionCooldownSeconds > 300)) throw new Error('Hareket sonrası etkinlik 5–300 saniye arasında olmalı.');
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
        id: item?.id ?? `content-${crypto.randomUUID()}`, type: kind, title: title.trim(),
        payload: {
          ...(text.trim() ? { text: text.trim() } : {}), ...(normalizedStreamUrl ? { videoUrl: normalizedStreamUrl } : {}),
          ...(uploadedUrl ? { attachmentUrl: uploadedUrl, attachmentName: uploadedName } : {}),
          activationMode, activationAnchor: start.toISOString(),
          ...(activationMode === 'interval' ? { intervalSeconds: String(Math.round(intervalMinutes * 60)) } : {}),
          ...(activationMode === 'motion' ? { motionCooldownSeconds: String(motionCooldownSeconds) } : {}),
        },
        durationSeconds: kind === 'camera-stream' && activationMode === 'motion' ? motionCooldownSeconds : duration, priority: kind === 'emergency' ? 100 : 1,
        schedule: { displayIds: targetDisplays, startsAt: start.toISOString(), endsAt: end.toISOString(), daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined },
      };
      await api(`/content${item ? `/${encodeURIComponent(item.id)}` : ''}`, jsonInit(item ? 'PUT' : 'POST', content));
      await onSaved(item ? 'Değişiklikler kaydedildi.' : 'İçerik yayın planına eklendi.');
    } catch (cause) { setError(errorMessage(cause, 'İçerik kaydedilemedi.')); }
    finally { setSaving(false); }
  }

  const fileName = attachment?.name || attachmentName;
  const mediaKind = mediaKindOf(fileName, streamUrl.trim());
  const previewUrl = localPreview || (!attachment && mediaKind === 'image' ? `${apiUrl}${attachmentUrl}` : '');
  const selectedNames = displays.filter((display) => targetDisplays.includes(display.id)).map((display) => display.name);
  const allSelected = displays.length > 0 && targetDisplays.length === displays.length;

  return (
    <div className="overlay overlay-drawer">
      <form aria-label={item ? 'İçeriği düzenle' : 'Yeni içerik'} aria-modal="true" className="drawer" onSubmit={save} role="dialog">
        <header className="drawer-head">
          <div><h2>{item ? 'İçeriği düzenle' : 'Yeni içerik'}</h2><p>Sağdaki önizleme ekranda görünecek hali gösterir.</p></div>
          <button aria-label="Kapat" className="icon-button" onClick={close} type="button"><Icon name="close" /></button>
        </header>
        <div className="drawer-body">
          <div className="drawer-form">
            <section className="form-block">
              <h3><span>1</span>İçerik</h3>
              <div className="type-grid" role="radiogroup" aria-label="İçerik türü">
                {(kind === 'metrics' ? [...editorTypes, 'metrics' as const] : editorTypes).map((type) => (
                  <button aria-checked={kind === type} className={`type-tile ${kind === type ? 'active' : ''} ${type === 'emergency' ? 'type-emergency' : ''}`} key={type} onClick={() => setKind(type)} role="radio" type="button">
                    <Icon name={typeMeta[type].icon} /><strong>{typeMeta[type].label}</strong><small>{typeMeta[type].hint}</small>
                  </button>
                ))}
              </div>
              {kind === 'emergency' && <p className="inline-alert"><Icon name="alert" size={16} />Acil duyuru, süresi boyunca seçili ekranlardaki tüm diğer yayınları durdurur.</p>}
              {kind === 'camera-stream' && <p className="field-note">Tetiklenince işlenmiş kamera görüntüsü duyuruların bulunduğu ana yayın alanını kaplar. Tetikleme bitince duyuru döngüsü kaldığı yerden devam eder.</p>}
              <label className="field">Başlık<input autoFocus maxLength={140} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. Bahar şenliği 12 Mayıs’ta başlıyor" required value={title} /><small className="field-count">{title.length}/140</small></label>
              {kind !== 'camera-stream' && <label className="field">Açıklama<textarea onChange={(event) => setText(event.target.value)} placeholder="Ekranda gösterilecek metin" rows={3} value={text} /></label>}
            </section>

            {kind !== 'camera-stream' && <section className="form-block">
              <h3><span>2</span>Medya <em>isteğe bağlı</em></h3>
              {fileName ? (
                <div className="file-row">
                  <span className="file-icon"><Icon name={mediaKind === 'image' ? 'image' : mediaKind === 'video' ? 'video' : 'file'} /></span>
                  <div><strong>{fileName}</strong><small>{attachment ? formatBytes(attachment.size) : 'Yüklü dosya'}</small></div>
                  {attachmentUrl && !attachment && <a className="text-button" href={`${apiUrl}${attachmentUrl}`} rel="noreferrer" target="_blank">Aç</a>}
                  <button aria-label="Dosyayı kaldır" className="icon-button" onClick={clearAttachment} type="button"><Icon name="trash" size={16} /></button>
                </div>
              ) : (
                <label className={dragging ? 'dropzone dragging' : 'dropzone'} onDragLeave={() => setDragging(false)} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDrop={dropFile}>
                  <Icon name="upload" size={22} />
                  <strong>Dosyayı buraya bırakın ya da seçin</strong>
                  <small>PPTX, DOCX, PDF, görsel veya MP4 · En fazla 40 MB</small>
                  <input accept={uploadAccept} onChange={(event) => chooseFile(event.target.files?.[0])} type="file" />
                </label>
              )}
              <label className="field">Canlı yayın adresi<input autoComplete="url" onChange={(event) => { setStreamUrl(event.target.value); if (event.target.value.trim()) setKind('video'); }} placeholder="https://…/playlist.m3u8" type="url" value={streamUrl} /><small>HLS (.m3u8) veya MP4, HTTPS. Yayın cihazda oynatılır, sunucuya aktarılmaz.</small></label>
            </section>}

            <section className="form-block">
              <h3><span>3</span>Zamanlama</h3>
              <div className="field-grid">
                <label className="field">Başlangıç<input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label>
                <label className="field">Bitiş<input min={startsAt} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label>
              </div>
              <div className="chip-row"><span>Süre</span>{rangePresets.map((preset) => <button className="chip" key={preset.label} onClick={() => applyRange(preset.end)} type="button">{preset.label}</button>)}</div>
              <fieldset className="field-set">
                <legend>Yayın günleri</legend>
                <div className="weekday-row">
                  {weekdays.map((day) => <label className="weekday" key={day.value}><input checked={daysOfWeek.includes(day.value)} onChange={(event) => setDaysOfWeek((current) => toggle(current, day.value, event.target.checked))} type="checkbox" /><span>{day.label}</span></label>)}
                </div>
                <div className="chip-row">{dayPresets.map((preset) => <button className="chip" key={preset.label} onClick={() => setDaysOfWeek(preset.days)} type="button">{preset.label}</button>)}</div>
              </fieldset>
              {!(kind === 'camera-stream' && activationMode === 'motion') && <div className="chip-row">
                <span>Ekranda kalma</span>
                {durationPresets.map((value) => <button className={duration === value ? 'chip active' : 'chip'} key={value} onClick={() => setDuration(value)} type="button">{value} sn</button>)}
                <label className="chip-input"><input aria-label="Gösterim süresi (saniye)" min="1" onChange={(event) => setDuration(Number(event.target.value))} required type="number" value={duration} /><span>sn</span></label>
              </div>}
              <label className="field">Gösterim tetikleyicisi<select onChange={(event) => setActivationMode(event.target.value as ActivationMode)} value={activationMode}>{kind !== 'camera-stream' && <option value="rotation">Sürekli döngüde</option>}<option value="interval">Belirli aralıkla</option><option value="motion">Hareket algılanınca</option></select><small>{kind === 'camera-stream' ? 'Kamera görüntüsü tam ekran gösterilir; yayın süresi hareket tetikleyicisindeki bekleme süresidir.' : 'Aralıklı ve hareket tetiklemeli yayınlar için AI Box kamera ölçümü gerekir.'}</small></label>
              {activationMode === 'interval' && <label className="field">Tekrar aralığı (dakika)<input min="1" max="1440" onChange={(event) => setIntervalMinutes(Number(event.target.value))} required type="number" value={intervalMinutes} /></label>}
              {activationMode === 'motion' && <label className="field">Hareket sonrası etkinlik (saniye)<input min="5" max="300" onChange={(event) => setMotionCooldownSeconds(Number(event.target.value))} required type="number" value={motionCooldownSeconds} /><small>Hareket algılandıktan sonra içerik bu süre boyunca döngüye katılır.</small></label>}
            </section>

            <section className="form-block">
              <div className="block-head"><h3><span>4</span>Hedef ekranlar</h3>{displays.length > 1 && <button className="text-button" onClick={() => setTargetDisplays(allSelected ? [] : displays.map((display) => display.id))} type="button">{allSelected ? 'Seçimi temizle' : 'Tümünü seç'}</button>}</div>
              {displays.length ? (
                <div className="target-grid">
                  {displays.map((display) => (
                    <label className="target-card" key={display.id}>
                      <input checked={targetDisplays.includes(display.id)} onChange={(event) => setTargetDisplays((current) => toggle(current, display.id, event.target.checked))} type="checkbox" />
                      <span className="target-check"><Icon name="check" size={13} /></span>
                      <span><strong>{display.name}</strong><small>{display.location}{display.enabled ? '' : ' · Kapalı'}</small></span>
                    </label>
                  ))}
                </div>
              ) : <p className="field-note">Önce Ekranlar bölümünden bir ekran ekleyin.</p>}
            </section>
          </div>

          <aside className="drawer-preview">
            <p className="eyebrow">Canlı önizleme</p>
            <ScreenPreview mediaKind={mediaKind} mediaUrl={previewUrl} text={text} title={title} type={kind} />
            <dl className="summary">
              <div><dt><Icon name="clock" size={15} />Zaman</dt><dd>{startsAt && endsAt ? `${formatDateTime(startsAt)} → ${formatDateTime(endsAt)}` : '—'}</dd></div>
              <div><dt><Icon name="calendar" size={15} />Günler</dt><dd>{formatDays(daysOfWeek)}</dd></div>
              <div><dt><Icon name="monitor" size={15} />Ekranlar</dt><dd>{selectedNames.length ? selectedNames.join(', ') : 'Seçilmedi'}</dd></div>
              <div><dt><Icon name="play" size={15} />Gösterim</dt><dd>{kind === 'camera-stream' && activationMode === 'motion' ? `${motionCooldownSeconds} saniye` : `${duration} saniye`}</dd></div>
              <div><dt><Icon name="calendar" size={15} />Tetikleyici</dt><dd>{activationMode === 'motion' ? 'Hareket algılanınca' : activationMode === 'interval' ? `Her ${intervalMinutes} dk` : 'Sürekli döngü'}</dd></div>
            </dl>
          </aside>
        </div>
        <footer className="drawer-foot">
          {error ? <p className="form-error" role="alert"><Icon name="alert" size={16} />{error}</p> : <span />}
          <button className="button button-ghost" onClick={close} type="button">Vazgeç</button>
          <button className={kind === 'emergency' ? 'button button-danger' : 'button button-primary'} disabled={saving || !displays.length} type="submit">{saving ? 'Kaydediliyor…' : item ? 'Değişiklikleri kaydet' : kind === 'emergency' ? 'Acil duyuruyu yayınla' : 'Kaydet ve planla'}</button>
        </footer>
      </form>
    </div>
  );
}
