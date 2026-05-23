'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useState, useContext, useRef } from 'react';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const routeOrder: Record<string, number> = {
  '/login': 0,
  '/': 1,
  '/timeclock': 2,
};

function getRouteIndex(path: string) {
  return routeOrder[path] ?? 1;
}

const variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0.5,
    scale: 0.98,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0.5,
    scale: 0.98,
  }),
};

// Freezes the router context so the exiting page continues to show the old content
// instead of immediately rendering the new page's content and causing a flash.
function FrozenRouter({ children, segment }: { children: React.ReactNode; segment: string }) {
  const context = useContext(LayoutRouterContext);
  const pathname = usePathname();
  const isExiting = pathname !== segment;
  const frozen = useRef(context);

  if (!isExiting) {
    frozen.current = context;
  }

  return (
    <LayoutRouterContext.Provider value={isExiting ? frozen.current : context}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  const [direction, setDirection] = useState(1);

  if (pathname !== prevPath) {
    const currentIdx = getRouteIndex(pathname);
    const prevIdx = getRouteIndex(prevPath);
    setDirection(currentIdx >= prevIdx ? 1 : -1);
    setPrevPath(pathname);
  }

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={pathname}
        custom={direction}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute w-full h-full top-0 left-0"
      >
        <FrozenRouter segment={pathname}>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
