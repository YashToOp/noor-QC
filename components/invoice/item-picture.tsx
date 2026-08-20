"use client";

import { cn } from "@/lib/utils";
import type { Picture } from "@/lib/invoice";

/**
 * The item picture.
 *
 * Four cases, in the order Majlis resolves them, so the invoice shows the same
 * image the client saw when they ordered:
 *
 *   image     a real photograph, once `media_assets.url` holds an http(s) URL
 *   gradient  the two-stop block from `meta.gradient` — what the demo has
 *   solid     the colourway's own hex, when the style has no media row
 *   none      a neutral well, so the cell never collapses
 *
 * Plain `<img>` rather than next/image on purpose: this renders inside a
 * printable sheet, and next/image's wrapper and lazy loading fight the print
 * layout. The URLs are also arbitrary remote hosts, which next/image would
 * require configuring per domain.
 */
export function ItemPicture({
  picture,
  alt,
  className,
  size = 56,
}: {
  picture: Picture;
  alt: string;
  className?: string;
  size?: number;
}) {
  const frame = cn(
    "shrink-0 overflow-hidden rounded-md border-hairline border-line bg-well print:border-line",
    className,
  );
  const style = { width: size, height: size };

  if (picture.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture.url}
        alt={alt}
        style={style}
        className={cn(frame, "object-cover")}
        loading="eager"
      />
    );
  }

  if (picture.kind === "gradient") {
    const [from, to] = [picture.hexes[0], picture.hexes[1] ?? picture.hexes[0]];
    return (
      <div
        role="img"
        aria-label={alt}
        style={{
          ...style,
          // Printers drop background images unless asked to keep them.
          backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
        className={frame}
      />
    );
  }

  if (picture.kind === "solid") {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{
          ...style,
          background: picture.hex,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
        className={frame}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${alt} — no image on record`}
      style={style}
      className={cn(frame, "grid place-items-center")}
    >
      <span className="text-[10px] text-ink-sub">No image</span>
    </div>
  );
}
