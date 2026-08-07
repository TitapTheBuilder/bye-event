import { PLATFORM_CREDIT } from "@repo/shared/constants";

/**
 * The one mark that's fixed across every white-label deployment. This is a
 * stylized monogram placeholder standing in for the University of Tehran
 * crest -- swap the SVG for the official asset file when one is available;
 * the important invariant is that this component never reads from
 * event_settings.
 */
export function UTMark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 opacity-90 ${className ?? ""}`} title={PLATFORM_CREDIT}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-label={PLATFORM_CREDIT}
      >
        <title>{PLATFORM_CREDIT}</title>
        <path
          d="M12 2 2 7l10 5 8-4v6h1V7L12 2Z"
          fill="currentColor"
        />
        <path
          d="M6 10.5V16c0 2 2.7 4 6 4s6-2 6-4v-5.5l-6 3-6-3Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
      <span className="hidden text-xs font-medium tracking-wide text-text-secondary sm:inline">
        {PLATFORM_CREDIT}
      </span>
    </div>
  );
}
