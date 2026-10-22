import { useEffect, useRef, useState, type ReactNode } from 'react';
import { embedSnippet } from '../core/export';
import type { Demo } from '../core/types';
import { mountPlayer } from '../player/player';
import { exportHtml, exportProject, exportZip, previewDemo } from './exporting';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
}

function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

export function PreviewModal({ demo, onClose }: { demo: Demo; onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    previewDemo(demo).then(
      ({ demo: playerDemo, release }) => {
        if (cancelled || !container.current) return release();
        const player = mountPlayer(container.current, playerDemo);
        (container.current.shadowRoot?.querySelector('.root') as HTMLElement | null)?.focus();
        cleanup = () => {
          player.destroy();
          release();
        };
      },
      (e: unknown) => setError(String(e)),
    );
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [demo]);

  return (
    <Overlay onClose={onClose}>
      <button className="btn preview-close" onClick={onClose}>
        Close preview <span className="kbd">Esc</span>
      </button>
      <div className="preview-wrap">
        {error ? <div className="error">{error}</div> : <div ref={container} />}
      </div>
    </Overlay>
  );
}

type Job = 'html' | 'zip' | 'project';

export function ExportModal({ demo, onClose }: { demo: Demo; onClose: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('https://example.com/demo/');
  const [copied, setCopied] = useState(false);
  const snippet = embedSnippet(url, demo, demo.settings.showProgress);

  const run = async (kind: Job) => {
    setJob(kind);
    setError('');
    const onProgress = (done: number, total: number) => setProgress(`Preparing screenshots… ${done}/${total}`);
    try {
      if (kind === 'html') await exportHtml(demo, onProgress);
      else if (kind === 'zip') await exportZip(demo, onProgress);
      else await exportProject(demo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setJob(null);
      setProgress('');
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">Export “{demo.title}”</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error" role="alert">{error}</div>}
          <div className="option">
            <h3>Single HTML file</h3>
            <p>Everything in one file. Open it offline, send it, or upload it to any website. Hidden areas are pixelated for good.</p>
            <div className="row">
              <button className="btn primary" disabled={!!job || demo.steps.length === 0} onClick={() => void run('html')}>
                Download .html
              </button>
              {job === 'html' && <span className="progress-note">{progress}</span>}
            </div>
          </div>
          <div className="option">
            <h3>Folder for your website</h3>
            <p>A .zip with index.html and optimized images. Upload it (for example to GitHub Pages) and embed it with an iframe:</p>
            <div className="row">
              <button className="btn" disabled={!!job || demo.steps.length === 0} onClick={() => void run('zip')}>
                Download .zip
              </button>
              {job === 'zip' && <span className="progress-note">{progress}</span>}
            </div>
            <label className="label" htmlFor="embed-url" style={{ marginTop: 4 }}>Where you will upload it</label>
            <input id="embed-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
            <textarea className="code" readOnly rows={3} value={snippet} onFocus={(e) => e.target.select()} />
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(snippet).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? 'Copied ✓' : 'Copy embed code'}
              </button>
            </div>
          </div>
          <div className="option">
            <h3>Project file</h3>
            <p>A backup you can import again here or in another browser. It contains the original screenshots, without the blur applied.</p>
            <div className="row">
              <button className="btn" disabled={!!job} onClick={() => void run('project')}>
                Download project
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
