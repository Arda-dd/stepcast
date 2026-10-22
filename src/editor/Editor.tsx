import { useCallback, useEffect, useRef, useState } from 'react';
import { duplicateStep, moveStep, removeStep, touch, updateStep } from '../core/demo';
import { deleteImage, getDemo, saveDemo } from '../core/storage';
import type { Demo, DemoSettings, Step } from '../core/types';
import { Canvas, type Tool } from './Canvas';
import { Inspector } from './Inspector';
import { navigate, stepsFromFiles } from './lib';
import { ExportModal, PreviewModal } from './Modals';
import { StepList } from './StepList';

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

export function Editor({ id }: { id: string }) {
  const [demo, setDemo] = useState<Demo | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBlur, setSelectedBlur] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>('hotspot');
  const [modal, setModal] = useState<'preview' | 'export' | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void getDemo(id).then((d) => {
      setDemo(d ?? null);
      setSelectedId(d?.steps[0]?.id ?? null);
    });
  }, [id]);

  // Every change is saved shortly after it is made.
  const change = useCallback((next: Demo) => {
    setDemo(next);
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveDemo(next).then(() => setSaveState('saved')), 350);
  }, []);

  const step = demo?.steps.find((s) => s.id === selectedId) ?? null;
  const stepIndex = demo && step ? demo.steps.indexOf(step) : -1;

  const select = (stepId: string | null) => {
    setSelectedId(stepId);
    setSelectedBlur(null);
  };

  const onStep = (patch: Partial<Step>) => demo && step && change(updateStep(demo, step.id, patch));
  const onSettings = (patch: Partial<DemoSettings>) => demo && change(touch({ ...demo, settings: { ...demo.settings, ...patch } }));

  const onDelete = (stepId: string) => {
    if (!demo) return;
    const index = demo.steps.findIndex((s) => s.id === stepId);
    const removed = demo.steps[index];
    const next = removeStep(demo, stepId);
    change(next);
    if (removed && !next.steps.some((s) => s.imageId === removed.imageId)) void deleteImage(removed.imageId);
    if (stepId === selectedId) select(next.steps[Math.min(index, next.steps.length - 1)]?.id ?? null);
  };

  const onAddFiles = async (files: File[]) => {
    if (!demo) return;
    const steps = await stepsFromFiles(files);
    if (steps.length === 0) return;
    change(touch({ ...demo, steps: [...demo.steps, ...steps] }));
    select(steps[0]!.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!demo || modal || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') setTool('hotspot');
      else if (e.key === 'b' || e.key === 'B') setTool('blur');
      else if (e.key === 'p' || e.key === 'P') setModal('preview');
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const target = demo.steps[stepIndex + (e.key === 'ArrowDown' ? 1 : -1)];
        if (target) select(target.id);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && step && selectedBlur !== null) {
        onStep({ blurs: step.blurs.filter((_, i) => i !== selectedBlur) });
        setSelectedBlur(null);
      } else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (demo === undefined) return null;
  if (demo === null) {
    return (
      <div className="home">
        <div className="empty">
          This demo does not exist anymore. <a href="#/">Back to your demos</a>
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn ghost icon" onClick={() => navigate('/')} aria-label="Back to demos">←</button>
        <input
          className="title-input"
          value={demo.title}
          aria-label="Demo title"
          onChange={(e) => change(touch({ ...demo, title: e.target.value }))}
        />
        <span className="saved" aria-live="polite">{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
        <button className="btn" onClick={() => setModal('preview')} disabled={demo.steps.length === 0}>
          ▶ Preview
        </button>
        <button className="btn primary" onClick={() => setModal('export')} disabled={demo.steps.length === 0}>
          Export
        </button>
      </header>

      <div className="workspace">
        <StepList
          steps={demo.steps}
          selectedId={selectedId}
          onSelect={select}
          onMove={(stepId, to) => change(moveStep(demo, stepId, to))}
          onDuplicate={(stepId) => change(duplicateStep(demo, stepId))}
          onDelete={onDelete}
          onAddFiles={(files) => void onAddFiles(files)}
        />

        <main className="center">
          <div className="canvas-bar">
            <div className="seg" role="group" aria-label="Tool">
              <button className={tool === 'hotspot' ? 'on' : ''} aria-pressed={tool === 'hotspot'} onClick={() => setTool('hotspot')}>
                ◎ Hotspot
              </button>
              <button className={tool === 'blur' ? 'on' : ''} aria-pressed={tool === 'blur'} onClick={() => setTool('blur')}>
                ▦ Blur
              </button>
            </div>
            {step && (
              <span className="info">
                Step {stepIndex + 1} of {demo.steps.length}
                {tool === 'hotspot' ? ' · click to place the hotspot' : ' · drag over anything private'}
              </span>
            )}
          </div>
          {step ? (
            <Canvas
              key={step.id}
              step={step}
              tool={tool}
              color={demo.settings.color}
              selectedBlur={selectedBlur}
              onSelectBlur={setSelectedBlur}
              onChange={onStep}
            />
          ) : (
            <div className="no-steps">This demo has no steps. Add screenshots on the left.</div>
          )}
        </main>

        <Inspector
          demo={demo}
          step={step}
          selectedBlur={selectedBlur}
          onStep={onStep}
          onSettings={onSettings}
          onSelectBlur={setSelectedBlur}
        />
      </div>

      {modal === 'preview' && <PreviewModal demo={demo} onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal demo={demo} onClose={() => setModal(null)} />}
    </div>
  );
}
