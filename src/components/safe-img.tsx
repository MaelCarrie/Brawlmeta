"use client";

import { useState } from "react";

/** <img> qui affiche un repli (initiales) si l'image ne charge pas. */
export function SafeImg({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`${className} flex items-center justify-center bg-surface-2 text-xs font-bold text-muted`}>
        {fallback ?? alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
