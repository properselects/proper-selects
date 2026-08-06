import React from 'react';
import { parseArtist } from '../lib/parseArtist.js';

export default function PreviewModal({ set, onClose }) {
  if (!set) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)', zIndex: 2000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(720px, 94vw)', background: '#0a0a0e',
        border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, overflow: 'hidden',
        zIndex: 2001, boxShadow: '0 30px 80px rgba(0,0,0,.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parseArtist(set.artist || set.title)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {set.festival_name || 'Discovered'}{set.city ? ` · ${set.city}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#EDEAE2', fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
          <iframe
            src={`https://www.youtube.com/embed/${set.video_id}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    </>
  );
}
