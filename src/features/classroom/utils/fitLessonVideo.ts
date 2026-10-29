/**
 * The lesson document shares our origin. Keep embedded video controls within its
 * viewport, including when the Classroom sidebar or focus mode changes its size.
 * A stylesheet uses the iframe's viewport units, so no resize listener is needed.
 */
export function fitLessonVideo(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (!doc?.head || doc.getElementById('classroom-video-fit')) return;
    const style = doc.createElement('style');
    style.id = 'classroom-video-fit';
    style.textContent = `
      .marco.video {
        width: 100%;
        max-width: min(var(--wide, 1100px), calc(max(120px, 100dvh - 100px) * 16 / 9));
        aspect-ratio: 16 / 9;
      }
      .marco.video iframe { width: 100%; height: 100%; }
    `;
    doc.head.appendChild(style);
  } catch {
    // A redirected cross-origin lesson remains usable with its original layout.
  }
}
