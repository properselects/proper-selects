// Ref-counted scroll lock for fullscreen player modals. While locked, the body
// and the tab scroll containers stop scrolling, so touch-drags on the modal's
// backdrop don't bleed through to the grid behind it.
let count = 0;

export function lockScroll() {
  count++;
  if (typeof document !== 'undefined') document.body.classList.add('modal-scroll-lock');
}

export function unlockScroll() {
  count = Math.max(0, count - 1);
  if (count === 0 && typeof document !== 'undefined') {
    document.body.classList.remove('modal-scroll-lock');
  }
}
