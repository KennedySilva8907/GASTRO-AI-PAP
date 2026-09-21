// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';

const { createPdfButton, readWithProgress } = await import('../../../src/chat/pdf-button.js');

function mountButton() {
  document.body.innerHTML = `
    <button id="export-button" class="control-button export-button">
      <span class="button-icon"></span>
      <span class="control-label">PDF</span>
    </button>`;
  return document.getElementById('export-button');
}

function fakeHold() {
  const calls = [];
  const hold = (fn) => {
    calls.push(fn);
    return calls.length;
  };
  hold.run = () => calls.forEach((fn) => fn());
  return hold;
}

describe('the PDF button says what it is doing', () => {
  let button;
  let hold;
  let pdf;

  beforeEach(() => {
    button = mountButton();
    hold = fakeHold();
    pdf = createPdfButton(button, { onHold: hold });
  });

  it('starts out saying PDF and nothing else', () => {
    expect(button.querySelector('.control-label').textContent).toBe('PDF');
    expect(button.className).not.toContain('is-');
  });

  it('says it is preparing while the server is still working', () => {
    pdf.start();

    expect(button.querySelector('.control-label').textContent).toBe('A preparar');
    expect(button.classList.contains('is-working')).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('counts up once the bytes start arriving', () => {
    pdf.start();
    pdf.setProgress(42.4);

    expect(button.querySelector('.control-label').textContent).toBe('42%');
    expect(button.querySelector('.pdf-progress').style.width).toBe('42%');
    expect(button.classList.contains('is-counting')).toBe(true);
    expect(button.classList.contains('is-working')).toBe(false);
  });

  it('never shows a percentage outside 0 and 100', () => {
    pdf.setProgress(-30);
    expect(button.querySelector('.control-label').textContent).toBe('0%');

    pdf.setProgress(420);
    expect(button.querySelector('.control-label').textContent).toBe('100%');
  });

  it('says Pronto and then goes back on its own', () => {
    pdf.start();
    pdf.succeed();

    expect(button.querySelector('.control-label').textContent).toBe('Pronto');
    expect(button.classList.contains('is-done')).toBe(true);
    expect(button.hasAttribute('aria-busy')).toBe(false);

    hold.run();

    expect(button.querySelector('.control-label').textContent).toBe('PDF');
    expect(button.className).not.toContain('is-');
    expect(button.disabled).toBe(false);
  });

  it('says Falhou and then goes back on its own', () => {
    pdf.start();
    pdf.fail();

    expect(button.querySelector('.control-label').textContent).toBe('Falhou');
    expect(button.classList.contains('is-failed')).toBe(true);

    hold.run();

    expect(button.querySelector('.control-label').textContent).toBe('PDF');
    expect(button.disabled).toBe(false);
  });

  it('cannot be clicked again while it is working', () => {
    pdf.start();
    expect(button.disabled).toBe(true);

    pdf.succeed();
    hold.run();
    expect(button.disabled).toBe(false);
  });

  it('reuses the progress bar instead of stacking a new one each time', () => {
    createPdfButton(button, { onHold: hold });
    createPdfButton(button, { onHold: hold });

    expect(button.querySelectorAll('.pdf-progress')).toHaveLength(1);
  });
});

describe('readWithProgress', () => {
  function streamingResponse(chunks, total) {
    let i = 0;
    return {
      headers: {
        get: (name) =>
          name === 'Content-Length'
            ? String(total)
            : name === 'Content-Type'
              ? 'application/pdf'
              : null,
      },
      body: {
        getReader: () => ({
          read: async () =>
            i < chunks.length
              ? { done: false, value: chunks[i++] }
              : { done: true, value: undefined },
        }),
      },
    };
  }

  it('reports progress as the bytes arrive', async () => {
    const seen = [];
    const chunks = [new Uint8Array(25), new Uint8Array(25), new Uint8Array(50)];

    await readWithProgress(streamingResponse(chunks, 100), (p) => seen.push(Math.round(p)));

    expect(seen).toEqual([25, 50, 100, 100]);
  });

  it('returns a blob with everything that arrived', async () => {
    const chunks = [new Uint8Array(10), new Uint8Array(30)];

    const blob = await readWithProgress(streamingResponse(chunks, 40), () => {});

    expect(blob.size).toBe(40);
    expect(blob.type).toBe('application/pdf');
  });

  it('jumps straight to 100 when the server sends no length', async () => {
    const seen = [];
    const response = streamingResponse([new Uint8Array(10)], 0);

    await readWithProgress(response, (p) => seen.push(Math.round(p)));

    expect(seen).toEqual([100, 100]);
  });

  it('falls back to blob when the response cannot be streamed', async () => {
    const seen = [];
    const response = {
      headers: { get: () => null },
      blob: async () => new Blob([new Uint8Array(5)]),
    };

    const blob = await readWithProgress(response, (p) => seen.push(p));

    expect(blob.size).toBe(5);
    expect(seen).toEqual([100]);
  });
});
