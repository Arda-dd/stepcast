/** A point or rectangle in fractions (0–1) of the screenshot, so it survives any rendering size. */
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Step {
  id: string;
  /** Key of the screenshot in the image store. */
  imageId: string;
  /** Screenshot size in pixels. */
  width: number;
  height: number;
  /** Where the viewer should click; null shows the text as a centered card. */
  hotspot: Point | null;
  tooltip: string;
  /** 1 = no zoom. The view zooms into the hotspot. */
  zoom: number;
  /** Areas that are pixelated on export, e.g. emails or API keys. */
  blurs: Rect[];
  /** Page the step was recorded on. */
  url?: string;
  pageTitle?: string;
}

export interface DemoSettings {
  /** Accent color of hotspots, buttons and the progress bar. */
  color: string;
  showProgress: boolean;
  /** Optional call to action on the final card. */
  cta: { text: string; url: string } | null;
}

export interface Demo {
  version: 1;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  settings: DemoSettings;
  steps: Step[];
}

/** What the player needs: blurs are already burned into the images. */
export interface PlayerStep {
  image: string;
  width: number;
  height: number;
  hotspot: Point | null;
  tooltip: string;
  zoom: number;
}

export interface PlayerDemo {
  title: string;
  settings: DemoSettings;
  steps: PlayerStep[];
}
