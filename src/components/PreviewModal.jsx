import React, { useState, useEffect, useRef } from 'react';
import { parseArtist } from '../lib/parseArtist.js';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';
import IdRadar from './IdRadar.jsx';
import { ytSeek } from '../lib/ytPostMessage.js';

export default function PreviewModal({ set, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const playerFrame = useRef(null);

  // Reset to expanded when a new set is opened
  useEffect(() => { if (set) setMinimized(false); }, [set?.video_id]);

  // Single-player coordination: when previewing, stop other surfaces; and let
  // others close this preview (which unmounts the iframe and stops audio).
  useEffect(() => {
    if (!set) return;
    startExclusive('preview');
    registerPlayer('preview', () => onClose?.());
    return () => unregisterPlayer('preview');
  }, [set?.video_id]);

  if (!set) return null;

  // Minimized: small floating bottom-right player, no backdrop, site stays interactive
  if (minimized) {
    return (
      <div style={{
        position: 'fixed', bottom: 76, right: 12, zIndex: 2001,
        width: 320, maxWidth: 'calc(100vw - 24px)',
        background: '#0a0a0e', border: '1px solid rgba(244,169,60,.4)',
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parseArtist(set.artist || set.title)}
            </div>
            <div style={{ fontSize: 9, opacity: 0.5 }}>
              {set.festival_name || 'Discovered'}{set.city ? ` · ${set.city}` : ''}
            </div>
          </div>
          <button onClick={() => setMinimized(false)} title="Expand" style={{ background: 'none', border: 'none', color: '#F4A93C', fontSize: 12, cursor: 'pointer', padding: 4, lineHeight: 1 }}>⤢</button>
          <button onClick={onClose} title="Close" style={{ background: 'none', border: 'none', color: '#EDEAE2', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
          <iframe
            key={set.video_id}
            src={`https://www.youtube.com/embed/${set.video_id}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    );
  }

  // Expanded modal with backdrop
  return (
    <>
      <div onClick={() => setMinimized(true)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)', zIndex: 2000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(720px, 94vw)', background: '#0a0a0e',
        border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, overflow: 'hidden',
        maxHeight: '92vh', overflowY: 'auto',
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
          <button
            onClick={() => setMinimized(true)}
            title="Minimize — keep playing while browsing"
            style={{ background: 'rgba(244,169,60,.15)', border: '1px solid rgba(244,169,60,.4)', color: '#F4A93C', fontSize: 12, cursor: 'pointer', padding: '5px 10px', borderRadius: 6, marginRight: 8, fontWeight: 700 }}
          >
            ⤓ Minimize
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#EDEAE2', fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
          <iframe
            key={set.video_id}
            ref={playerFrame}
            src={`https://www.youtube.com/embed/${set.video_id}?autoplay=1&rel=0&enablejsapi=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        <div style={{ padding: '0 14px' }}>
          <IdRadar videoId={set.video_id} onSeek={(s) => ytSeek(playerFrame.current, s)} />
        </div>
        <div style={{ padding: '10px 14px', fontSize: 11, opacity: 0.65, textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 3 }}>📺 Cast or AirPlay to a screen near you</div>
          <div style={{ opacity: 0.65 }}>Tap the ⋮ menu inside the player — quality auto-adjusts to the screen</div>
          <div style={{ opacity: 0.5, marginTop: 4, fontSize: 10 }}>Or tap outside to keep it playing while you browse</div>
        </div>
      </div>
    </>
  );
}
