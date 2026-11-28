/**
 * Scrollbars are hidden app-wide (see index.css), so a sideways strip has
 * nothing to grab. This lets the ordinary mouse wheel move it: over a
 * horizontal-only scroller, wheel up/down scrolls it left/right until it hits
 * an end, and then the page takes over as usual. Trackpads that already send
 * sideways movement are left alone.
 */
function horizontalScroller(start: EventTarget | null): HTMLElement | null {
  let el = start instanceof Element ? start : null
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth) {
      const style = getComputedStyle(el)
      const sideways = style.overflowX === 'auto' || style.overflowX === 'scroll'
      const vertical =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      if (sideways && !vertical) return el
    }
    el = el.parentElement
  }
  return null
}

export function installWheelScroll(): void {
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.shiftKey) return
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      const strip = horizontalScroller(event.target)
      if (!strip) return
      const max = strip.scrollWidth - strip.clientWidth
      const atStart = strip.scrollLeft <= 0 && event.deltaY < 0
      const atEnd = strip.scrollLeft >= max - 1 && event.deltaY > 0
      if (atStart || atEnd) return
      event.preventDefault()
      strip.scrollLeft += event.deltaY
    },
    { passive: false },
  )
}
