import { useEffect, useRef } from 'react';

export function useScrollLock(isOpen: boolean) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save the original body overflow style
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleWheel = (e: WheelEvent) => {
      let target = e.target as HTMLElement | null;
      let isScrollableChild = false;

      // Climb up the DOM tree from the event target to find if any element is scrollable
      while (target && target !== backdropRef.current) {
        const style = window.getComputedStyle(target);
        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && target.scrollHeight > target.clientHeight;
        if (isScrollable) {
          // Check if we can scroll in the desired direction
          const delta = e.deltaY;
          const scrollTop = target.scrollTop;
          const maxScrollTop = target.scrollHeight - target.clientHeight;
          
          const atTop = delta < 0 && scrollTop <= 0;
          const atBottom = delta > 0 && scrollTop >= maxScrollTop;
          
          // If we are not at the boundaries of the scroll container, let the scroll event proceed
          if (!atTop && !atBottom) {
            isScrollableChild = true;
            break;
          }
        }
        target = target.parentElement;
      }

      // If we are not scrolling a scrollable child (or we hit a boundary causing scroll chaining), prevent default
      if (!isScrollableChild) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      let isScrollableChild = false;

      while (target && target !== backdropRef.current) {
        const style = window.getComputedStyle(target);
        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && target.scrollHeight > target.clientHeight;
        if (isScrollable) {
          isScrollableChild = true;
          break;
        }
        target = target.parentElement;
      }

      if (!isScrollableChild) {
        e.preventDefault();
      }
    };

    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.addEventListener('wheel', handleWheel, { passive: false });
      backdrop.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (backdrop) {
        backdrop.removeEventListener('wheel', handleWheel);
        backdrop.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [isOpen]);

  return backdropRef;
}
