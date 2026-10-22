/** The visible name of a clicked element, used to write the default tooltip ("Click "Save""). */
export function elementLabel(target: Element | null): string {
  // Prefer the nearest interactive ancestor: a click on an icon inside a button is a click on the button.
  const el = target?.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], [role="link"], label, summary, input, select, textarea, [aria-label]') ?? target;
  if (!el) return '';
  const attr = (name: string) => el.getAttribute(name)?.trim() || '';
  const fromAria = attr('aria-label');
  if (fromAria) return clean(fromAria);
  const labelledBy = attr('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (text.trim()) return clean(text);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label = el.labels?.[0]?.textContent;
    if (label?.trim()) return clean(label);
    if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type) && el.value) return clean(el.value);
    const placeholder = attr('placeholder');
    if (placeholder) return clean(placeholder);
  }
  const text = (el as HTMLElement).innerText ?? el.textContent ?? '';
  if (text.trim()) return clean(text);
  return clean(attr('title') || attr('alt') || el.querySelector('img[alt]')?.getAttribute('alt') || '');
}

function clean(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}
