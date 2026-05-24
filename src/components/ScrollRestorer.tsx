import React from 'react';

export const scrollPositionsCache: Record<string, number> = {};

export default function ScrollRestorer({ screenName }: { screenName: string }) {
  React.useLayoutEffect(() => {
    const pos = scrollPositionsCache[screenName] || 0;
    window.scrollTo({ top: pos, behavior: 'instant' });
  }, [screenName]);
  return null;
}
