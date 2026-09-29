import { MARK_SIZE, markRects } from "./mark";

/**
 * The brand mark as an inline SVG.
 *
 * Inline rather than an <img> so the header carries no extra request, and driven by the same
 * matrix as the favicon so the two cannot disagree.
 *
 * NOTE THE FILENAME. This is BrandMark.tsx, not Mark.tsx, and that is deliberate: it used to sit
 * beside mark.ts, and on WSL those two paths differ only in the case of one letter. The project
 * lives on /mnt/c, which is a case-insensitive Windows drive, so TypeScript resolved
 * "@/components/brand/Mark" to mark.ts — the data module, which has no default export — and the
 * build failed with TS1192. Two files whose names differ only in case must never share a
 * directory here.
 */
export default function BrandMark({
  className,
  label = "Kinetype",
}: {
  className?: string;
  /** Pass null when the mark sits next to the wordmark and would only repeat it. */
  label?: string | null;
}) {
  return (
    <svg
      viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
      className={className}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {markRects().map((r) => (
        <rect key={`${r.x}:${r.y}:${r.fill}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  );
}
