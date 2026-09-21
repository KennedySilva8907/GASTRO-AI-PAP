const DONE_HOLD = 1400;
const FAIL_HOLD = 2200;

export function createPdfButton(button, { onHold = setTimeout } = {}) {
  const label = button.querySelector('.control-label');
  const idleLabel = label.textContent;

  let fill = button.querySelector('.pdf-progress');
  if (!fill) {
    fill = document.createElement('span');
    fill.className = 'pdf-progress';
    fill.setAttribute('aria-hidden', 'true');
    button.prepend(fill);
  }

  let holdTimer = null;

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function setState(state) {
    button.classList.remove('is-working', 'is-counting', 'is-done', 'is-failed');
    if (state) button.classList.add(state);
  }

  function reset() {
    clearHold();
    setState(null);
    fill.style.width = '';
    label.textContent = idleLabel;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }

  return {
    start() {
      clearHold();
      setState('is-working');
      fill.style.width = '';
      label.textContent = 'A preparar';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    },

    setProgress(percent) {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)));
      setState('is-counting');
      fill.style.width = `${clamped}%`;
      label.textContent = `${clamped}%`;
    },

    succeed() {
      clearHold();
      setState('is-done');
      fill.style.width = '100%';
      label.textContent = 'Pronto';
      button.removeAttribute('aria-busy');
      holdTimer = onHold(reset, DONE_HOLD);
    },

    fail() {
      clearHold();
      setState('is-failed');
      fill.style.width = '';
      label.textContent = 'Falhou';
      button.removeAttribute('aria-busy');
      holdTimer = onHold(reset, FAIL_HOLD);
    },

    reset,
  };
}

export async function readWithProgress(response, onProgress) {
  const declared = Number(response.headers.get('Content-Length'));
  const total = Number.isFinite(declared) && declared > 0 ? declared : 0;

  if (!response.body?.getReader) {
    const blob = await response.blob();
    onProgress(100);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total ? (received / total) * 100 : 100);
  }

  onProgress(100);
  return new Blob(chunks, { type: response.headers.get('Content-Type') || 'application/pdf' });
}
