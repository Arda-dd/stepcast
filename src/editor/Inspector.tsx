import type { Demo, DemoSettings, Step } from '../core/types';

const SWATCHES = ['#6d5efc', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#111827'];

interface Props {
  demo: Demo;
  step: Step | null;
  selectedBlur: number | null;
  onStep: (patch: Partial<Step>) => void;
  onSettings: (patch: Partial<DemoSettings>) => void;
  onSelectBlur: (index: number | null) => void;
}

export function Inspector({ demo, step, selectedBlur, onStep, onSettings, onSelectBlur }: Props) {
  const { settings } = demo;
  return (
    <aside className="inspector" aria-label="Settings">
      {step && (
        <section className="panel">
          <h2>Step</h2>
          <div>
            <label className="label" htmlFor="tooltip">Tooltip</label>
            <textarea
              id="tooltip"
              className="input"
              value={step.tooltip}
              placeholder="What should the viewer do or notice here?"
              onChange={(e) => onStep({ tooltip: e.target.value })}
            />
          </div>
          <label className="switch">
            Hotspot
            <input
              type="checkbox"
              checked={!!step.hotspot}
              onChange={(e) => onStep({ hotspot: e.target.checked ? { x: 0.5, y: 0.5 } : null, zoom: e.target.checked ? step.zoom : 1 })}
            />
          </label>
          <p className="hint" style={{ marginTop: -8 }}>
            {step.hotspot ? 'Viewers click the pulsing dot to continue.' : 'Shown as a centered text card, e.g. for an intro.'}
          </p>
          <div>
            <label className="label" htmlFor="zoom">Zoom into hotspot</label>
            <div className="range">
              <input
                id="zoom"
                type="range"
                min={1}
                max={2.5}
                step={0.1}
                value={step.zoom}
                disabled={!step.hotspot}
                onChange={(e) => onStep({ zoom: Number(e.target.value) })}
              />
              <output htmlFor="zoom">{step.zoom.toFixed(1)}×</output>
            </div>
          </div>
          <div>
            <span className="label">Hidden areas</span>
            {step.blurs.length === 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                Pick the Blur tool and drag over emails, names or keys. They are pixelated in every export.
              </p>
            ) : (
              <div className="blur-list">
                {step.blurs.map((_, i) => (
                  <div key={i} className="blur-item" style={selectedBlur === i ? { outline: '2px solid var(--accent)' } : undefined}>
                    <button className="btn ghost" style={{ padding: 0 }} onClick={() => onSelectBlur(i)}>
                      Area {i + 1}
                    </button>
                    <button
                      className="btn ghost icon"
                      aria-label={`Remove area ${i + 1}`}
                      onClick={() => {
                        onStep({ blurs: step.blurs.filter((_, j) => j !== i) });
                        onSelectBlur(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {step.url && (
            <div>
              <span className="label">Recorded on</span>
              <div className="url">{step.url}</div>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Demo</h2>
        <div>
          <span className="label">Accent color</span>
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                className={`swatch ${settings.color.toLowerCase() === c ? 'on' : ''}`}
                style={{ background: c }}
                aria-label={`Use ${c}`}
                onClick={() => onSettings({ color: c })}
              />
            ))}
            <input type="color" value={settings.color} aria-label="Custom color" onChange={(e) => onSettings({ color: e.target.value })} />
          </div>
        </div>
        <label className="switch">
          Progress bar
          <input type="checkbox" checked={settings.showProgress} onChange={(e) => onSettings({ showProgress: e.target.checked })} />
        </label>
        <label className="switch">
          Button on the last screen
          <input
            type="checkbox"
            checked={!!settings.cta}
            onChange={(e) => onSettings({ cta: e.target.checked ? { text: 'Get started', url: 'https://' } : null })}
          />
        </label>
        {settings.cta && (
          <>
            <div>
              <label className="label" htmlFor="cta-text">Button text</label>
              <input id="cta-text" className="input" value={settings.cta.text} onChange={(e) => onSettings({ cta: { ...settings.cta!, text: e.target.value } })} />
            </div>
            <div>
              <label className="label" htmlFor="cta-url">Link</label>
              <input id="cta-url" className="input" type="url" value={settings.cta.url} onChange={(e) => onSettings({ cta: { ...settings.cta!, url: e.target.value } })} />
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Shortcuts</h2>
        <div className="hint" style={{ margin: 0, display: 'grid', gap: 6 }}>
          <span><span className="kbd">H</span> hotspot tool · <span className="kbd">B</span> blur tool</span>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> previous / next step</span>
          <span><span className="kbd">Del</span> remove the selected area</span>
          <span><span className="kbd">P</span> preview</span>
        </div>
      </section>
    </aside>
  );
}
