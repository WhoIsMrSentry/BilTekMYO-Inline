import { Icon } from './icons';
import { typeMeta } from './domain';
import type { ContentType } from './domain';

type ScreenPreviewProps = { type?: ContentType; title?: string; text?: string; mediaUrl?: string; mediaKind?: 'image' | 'video' | 'document' | 'stream'; idle?: string };

/** Small stand-in for the player's slide; it follows the same layout rules. */
export function ScreenPreview({ type, title, text, mediaUrl, mediaKind, idle = 'Aktif yayın yok' }: ScreenPreviewProps) {
  if (!type) return <div className="screen screen-idle"><span>{idle}</span></div>;
  const hasMedia = Boolean(mediaKind);
  return (
    <div className={`screen ${type === 'emergency' ? 'screen-emergency' : ''} ${hasMedia ? 'screen-media' : ''}`}>
      {mediaKind === 'image' && mediaUrl && <img alt="" src={mediaUrl} />}
      {mediaKind && mediaKind !== 'image' && <span className="screen-media-icon"><Icon name={mediaKind === 'document' ? 'file' : 'video'} size={26} /></span>}
      <div className="screen-copy">
        <span className="screen-chip">{type === 'emergency' ? 'ACİL DUYURU' : typeMeta[type].label}</span>
        <strong>{title || 'Başlık burada görünecek'}</strong>
        {text && <p>{text}</p>}
      </div>
    </div>
  );
}
