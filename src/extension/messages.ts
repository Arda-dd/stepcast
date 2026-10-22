export interface CaptureRequest {
  type: 'capture';
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  label: string;
  url: string;
  title: string;
  /**
   * True when nothing on the page changed since the last pre-captured frame. The click is then
   * recorded with that frame, which shows the page exactly as it was before the click.
   */
  useFrame: boolean;
}

/** Asks for a screenshot of the settled page, kept ready for the next click. */
export interface FrameRequest {
  type: 'frame';
}

export type Message =
  | { type: 'start'; tabId: number }
  | { type: 'stop' }
  | { type: 'status' }
  | { type: 'discard' }
  | CaptureRequest
  | FrameRequest;

export interface RecordingState {
  tabId: number;
  windowId: number;
  demoId: string;
  startedAt: number;
  title: string;
  steps: number;
}

export interface StatusResponse {
  recording: RecordingState | null;
}

export interface CaptureResponse {
  ok: boolean;
  steps: number;
  error?: string;
}
