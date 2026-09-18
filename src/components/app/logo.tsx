import { cn } from "cn";

export interface LogoProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
  className?: string;
}

/**
 * OpportunityOS mark: a radar sweep over concentric rings with one detected
 * target. Built from primitives so it stays crisp at 16px and inherits the
 * surrounding text colour, with the target in the brand signal colour.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <circle cx="16" cy="16" r="13" className="stroke-current opacity-25" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="7.5" className="stroke-current opacity-40" strokeWidth="1.4" />
      <path d="M16 3A13 13 0 0 1 29 16H16Z" className="fill-primary opacity-15" />
      <path d="M16 16 25.2 6.8" className="stroke-primary" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="22.2" cy="10.6" r="3" className="fill-primary" />
      <circle cx="16" cy="16" r="1.9" className="fill-current" />
    </svg>
  );
}

export interface WordmarkProps {
  /** Hide the text on small screens while keeping it available to readers. */
  responsive?: boolean;
  className?: string;
}

export function Wordmark({ responsive = false, className }: WordmarkProps) {
  return (
    <span className={cn("font-heading text-sm leading-none font-semibold tracking-tight whitespace-nowrap", responsive && "hidden sm:inline", className)}>
      Opportunity<span className="text-primary">OS</span>
    </span>
  );
}

export interface BrandLockupProps {
  size?: number;
  className?: string;
  /** Hide the wordmark (icon-only rail). */
  iconOnly?: boolean;
}

/** Mark + wordmark, used in the sidebar, auth card and marketing header. */
export function BrandLockup({ size = 24, className, iconOnly = false }: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={size} />
      {iconOnly ? <span className="sr-only">OpportunityOS</span> : <Wordmark />}
    </span>
  );
}
