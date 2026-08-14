import React, { useEffect, useRef, useState } from 'react';
import { loadYT } from '../lib/youtubePlayer.js';
import { parseArtist } from '../lib/parseArtist.js';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';

/**
 * YouTube player that fires onEnded when a set finishes, and auto-fires
 * onEnded after 3s if the video errors out (private / removed). Enables
 * true "set and forget" background listening.
 */
const IS_APPLE =
  typeof navigator !== 'undefined' &&
  (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent));

const PIP_SUPPORTED = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

export default function StagePlayer({ set, onEnded, seekRef, timeRef, controlsRef, onPlayingChange }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const screenRef = useRef(null);       // the video container we pop out
  const pipHomeRef = useRef(null);       // { parent, next } to restore on close
  const [state, setState] = useState('loading');
  const [pipActive, setPipActive] = useState(false);

  // Document Picture-in-Picture: pop the live player into a floating,
  // always-on-top window that keeps playing while you use other tabs/apps.
  // (The only web mechanism that works for a cross-origin YouTube embed —
  //  the video element itself is unreachable, so standard video-PiP can't be used.)
  async function togglePiP() {
    try {
      if (window.documentPictureInPicture?.window) {
        window.documentPictureInPicture.window.close();
        return;
      }
      const screen = screenRef.current;
      if (!screen) return;
      const pip = await window.documentPictureInPicture.requestWindow({ width: 480, height: 270 });
      // Carry over styles so the player renders correctly in the PiP window
      pip.document.body.style.margin = '0';
      pip.document.body.style.background = '#000';
      // Remember where it lived so we can put it back
      pipHomeRef.current = { parent: screen.parentNode, next: screen.nextSibling };
      pip.document.body.append(screen);
      setPipActive(true);
      pip.addEventListener('pagehide', () => {
        const home = pipHomeRef.current;
        if (home?.parent) home.parent.insertBefore(screen, home.next);
        setPipActive(false);
      });
    } catch {
      /* user dismissed or unsupported — no-op */
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: set.video_id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            try {
              e.target.playVideo();
            } catch {}
            if (seekRef) {
              seekRef.current = (sec) => {
                try {
                  e.target.seekTo(sec, true);
                  e.target.playVideo();
                } catch {}
              };
            }
            if (timeRef) {
              timeRef.current = () => {
                try {
                  return e.target.getCurrentTime() || 0;
                } catch {
                  return 0;
                }
              };
            }
            // Expose play/pause/toggle so the mini player can control playback
            if (controlsRef) {
              controlsRef.current = {
                play: () => { try { e.target.playVideo(); } catch {} },
                pause: () => { try { e.target.pauseVideo(); } catch {} },
                toggle: () => {
                  try {
                    const S = window.YT.PlayerState;
                    if (e.target.getPlayerState() === S.PLAYING) e.target.pauseVideo();
                    else e.target.playVideo();
                  } catch {}
                },
              };
            }
            // Register with the global bus so other surfaces can pause us
            registerPlayer('stage', () => { try { e.target.pauseVideo(); } catch {} });
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              setState('playing');
              onPlayingChange?.(true);
              startExclusive('stage'); // stop any other surface that's playing
            }
            else if (e.data === S.PAUSED) { setState('paused'); onPlayingChange?.(false); }
            else if (e.data === S.ENDED) onEnded();
          },
          onError: () => {
            setState('error');
            setTimeout(onEnded, 3000);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (controlsRef) controlsRef.current = null;
      unregisterPlayer('stage');
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, [set.video_id]);

  return (
    <div className="jb-player">
      <div ref={screenRef} className="jb-screen">
        <div ref={hostRef} className="jb-host" />
        {state === 'error' && (
          <div className="jb-err">
            <p>This set can't be embedded.</p>
            <button onClick={onEnded}>Next set →</button>
          </div>
        )}
      </div>
      {pipActive && (
        <div className="jb-pip-placeholder">
          ▢ Playing in floating window — <button className="jb-pip-return" onClick={togglePiP}>bring back</button>
        </div>
      )}
      <div className="jb-now-row">
        <div className="jb-now">
          {state === 'playing' ? 'Now playing' : state === 'error' ? 'Unavailable' : 'Cueing'} · {parseArtist(set.artist)}
          {set.festival_name && (
            <span className="jb-fest">
              — {set.festival_name}
              {set.city ? `, ${set.city}` : ''}
            </span>
          )}
        </div>
        {PIP_SUPPORTED && state !== 'error' && (
          <button
            className="jb-pip-btn"
            onClick={togglePiP}
            title="Pop out — keeps playing while you use other apps/tabs"
          >
            {pipActive ? '▢ Bring back' : '⧉ Pop out'}
          </button>
        )}
      </div>
    </div>
  );
}
