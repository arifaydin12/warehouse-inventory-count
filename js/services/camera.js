// Optional camera barcode scanning using the BarcodeDetector API (Chromium-based browsers).
// Hardware scanners and manual entry always work; this is a progressive enhancement.

import { h } from '../ui/dom.js';
import { openDialog } from '../ui/components.js';
import { t } from '../i18n.js';

const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

export function cameraScanSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Opens a dialog with the camera preview and calls `onCode(value)` for every new code detected.
 * The same code is ignored for 1.5 s so one scan is not counted several times.
 */
export async function openCameraScanner({ onCode }) {
  const status = h('p', { class: 'muted', role: 'status' }, t('camera.starting'));
  const video = h('video', { class: 'camera-video', playsinline: true, muted: true, autoplay: true, 'aria-label': t('camera.preview') });
  let stream = null;
  let stopped = false;
  let timer = null;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
  };

  const dialog = openDialog({
    title: t('camera.title'),
    body: h('div', { class: 'camera' }, video, status),
    actions: [h('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, t('common.close'))],
    onClose: stop,
  });

  try {
    const supported = await window.BarcodeDetector.getSupportedFormats?.();
    const formats = supported ? WANTED_FORMATS.filter((f) => supported.includes(f)) : WANTED_FORMATS;
    const detector = new window.BarcodeDetector({ formats });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (stopped) {
      stop();
      return dialog;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    status.textContent = t('camera.hint');

    let lastValue = '';
    let lastAt = 0;
    const tick = async () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2) {
          const found = await detector.detect(video);
          const value = found[0]?.rawValue;
          const now = Date.now();
          if (value && (value !== lastValue || now - lastAt > 1500)) {
            lastValue = value;
            lastAt = now;
            await onCode(value);
          }
        }
      } catch {
        /* a failed frame is not fatal */
      }
      timer = setTimeout(tick, 200);
    };
    tick();
  } catch (error) {
    stop();
    status.textContent = error?.name === 'NotAllowedError' ? t('camera.denied') : t('camera.error');
    status.classList.add('text-danger');
  }
  return dialog;
}
