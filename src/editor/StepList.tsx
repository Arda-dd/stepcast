import { useRef, useState } from 'react';
import type { Step } from '../core/types';
import { useImageUrl } from './lib';

interface Props {
  steps: Step[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAddFiles: (files: File[]) => void;
}

function Thumb({ step, index, selected, dragOver, dragging, ...handlers }: {
  step: Step;
  index: number;
  selected: boolean;
  dragOver: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const url = useImageUrl(step.imageId);
  return (
    <button
      className={`step ${selected ? 'selected' : ''} ${dragOver ? 'drag-over' : ''} ${dragging ? 'dragging' : ''}`}
      onClick={handlers.onSelect}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        handlers.onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        handlers.onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        handlers.onDrop();
      }}
      onDragEnd={handlers.onDragEnd}
      aria-label={`Step ${index + 1}${step.tooltip ? `: ${step.tooltip}` : ''}`}
      aria-current={selected ? 'step' : undefined}
    >
      {url && <img src={url} alt="" />}
      <span className="num">{index + 1}</span>
      {step.hotspot && <span className="dot" style={{ left: `${step.hotspot.x * 100}%`, top: `${step.hotspot.y * 100}%` }} />}
      <span className="tools">
        <span
          role="button"
          title="Duplicate step"
          onClick={(e) => {
            e.stopPropagation();
            handlers.onDuplicate();
          }}
        >
          ⧉
        </span>
        <span
          role="button"
          title="Delete step"
          onClick={(e) => {
            e.stopPropagation();
            handlers.onDelete();
          }}
        >
          ✕
        </span>
      </span>
    </button>
  );
}

export function StepList({ steps, selectedId, onSelect, onMove, onDuplicate, onDelete, onAddFiles }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <aside className="steps" aria-label="Steps">
      {steps.map((step, i) => (
        <Thumb
          key={step.id}
          step={step}
          index={i}
          selected={step.id === selectedId}
          dragOver={overIndex === i && dragId !== step.id}
          dragging={dragId === step.id}
          onSelect={() => onSelect(step.id)}
          onDuplicate={() => onDuplicate(step.id)}
          onDelete={() => onDelete(step.id)}
          onDragStart={() => setDragId(step.id)}
          onDragOver={() => setOverIndex(i)}
          onDrop={() => {
            if (dragId) onMove(dragId, i);
            setDragId(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverIndex(null);
          }}
        />
      ))}
      <button className="add-step" onClick={() => input.current?.click()}>
        + Add screenshots
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onAddFiles([...(e.target.files ?? [])])} />
    </aside>
  );
}
