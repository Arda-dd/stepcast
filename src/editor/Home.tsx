import { useEffect, useRef, useState } from 'react';
import { deleteDemo, listDemos } from '../core/storage';
import type { Demo } from '../core/types';
import { demoFromFiles, importProject, inExtension, navigate, REPO_URL, timeAgo, useImageUrl } from './lib';

function DemoCard({ demo, onDelete }: { demo: Demo; onDelete: () => void }) {
  const thumb = useImageUrl(demo.steps[0]?.imageId);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const open = () => navigate(`/demo/${demo.id}`);
  return (
    <article className="card">
      <button className="thumb" onClick={open} aria-label={`Open ${demo.title}`}>
        {thumb && <img src={thumb} alt="" />}
      </button>
      <div className="meta">
        <div>
          <div className="title" title={demo.title}>{demo.title}</div>
          <div className="sub">
            {demo.steps.length} step{demo.steps.length === 1 ? '' : 's'} · {timeAgo(demo.updatedAt)}
          </div>
        </div>
        <button
          className={`btn danger ${armed ? 'armed' : 'ghost'}`}
          onClick={() => (armed ? onDelete() : setArmed(true))}
          aria-label={armed ? `Confirm deleting ${demo.title}` : `Delete ${demo.title}`}
        >
          {armed ? 'Delete?' : '🗑'}
        </button>
      </div>
    </article>
  );
}

export function Home() {
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const refresh = () => listDemos().then(setDemos, (e: unknown) => setError(String(e)));
  useEffect(() => {
    void refresh();
  }, []);

  const fromFiles = async (files: File[]) => {
    if (!files.some((f) => f.type.startsWith('image/'))) return;
    setBusy(true);
    setError('');
    try {
      const demo = await demoFromFiles(files);
      navigate(`/demo/${demo.id}`);
    } catch (e) {
      setError(`Could not read the screenshots: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const fromProject = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const demo = await importProject(await file.text());
      navigate(`/demo/${demo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openSample = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('./sample/orbit.stepcast.json');
      if (!response.ok) throw new Error(`Could not load the sample (HTTP ${response.status}).`);
      const demo = await importProject(await response.text());
      navigate(`/demo/${demo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`home ${dragging ? 'drop' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void fromFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="home-top">
        <a className="brand" href="#/">
          <span className="logo">▶</span> Stepcast
        </a>
        <span className="spacer" />
        <button className="btn" onClick={() => projectInput.current?.click()} disabled={busy}>
          Import project
        </button>
        <button className="btn primary" onClick={() => filesInput.current?.click()} disabled={busy}>
          {busy ? 'Working…' : 'New from screenshots'}
        </button>
        <input ref={filesInput} type="file" accept="image/*" multiple hidden onChange={(e) => void fromFiles([...(e.target.files ?? [])])} />
        <input
          ref={projectInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && void fromProject(e.target.files[0])}
        />
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <section className="hero">
        <div>
          <h1>Interactive product demos, without the subscription.</h1>
          <p>
            Click through your product once and share a demo people can click through themselves. Open source, and everything stays in
            your browser.
          </p>
          <div className="actions">
            {inExtension ? (
              <span className="hint">Click the Stepcast button in the toolbar on any website to start recording.</span>
            ) : (
              <>
                <a className="btn primary" href={`${REPO_URL}#install-the-recorder`} target="_blank" rel="noreferrer">
                  Get the Chrome recorder
                </a>
                <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </>
            )}
          </div>
        </div>
        <ol>
          <li>{inExtension ? 'Start recording from the toolbar and click through your app.' : 'Record clicks with the Chrome extension, or drop screenshots here.'}</li>
          <li>Edit the text, move hotspots, zoom in, and blur anything private.</li>
          <li>Export one HTML file and embed it anywhere with an iframe.</li>
        </ol>
      </section>

      {!inExtension && (
        <section className="sample">
          <div className="sample-head">
            <h2 className="section-title">Try it: a demo made with Stepcast</h2>
            <button className="btn" disabled={busy} onClick={() => void openSample()}>
              Open this demo in the editor
            </button>
          </div>
          <iframe className="sample-frame" src="./sample/orbit.html" title="Sample interactive demo" loading="lazy" />
        </section>
      )}

      <h2 className="section-title">Your demos</h2>
      {demos === null ? null : demos.length === 0 ? (
        <div className="empty">No demos yet. {inExtension ? 'Record one from the toolbar' : 'Drop screenshots anywhere on this page'} to get started.</div>
      ) : (
        <div className="grid">
          {demos.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              onDelete={() => void deleteDemo(demo).then(refresh)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
