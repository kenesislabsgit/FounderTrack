/**
 * Skeuomorphic Glass Variant System
 *
 * Extends HeroUI v3 base variants with a premium tactile aesthetic:
 * gold gradients, glass surfaces, 3D button treatments, and ambient glows.
 *
 * Requirements: 17.16–17.24, 17.49, 17.50
 */

import { tv, buttonVariants, cardVariants, badgeVariants } from "@heroui/styles";

// ---------------------------------------------------------------------------
// Shared interaction classes
// ---------------------------------------------------------------------------

/** Hover: lift 0.5px + ambient glow (150ms) */
const hoverLift =
  "hover:-translate-y-[0.5px] hover:shadow-[0_0_12px_hsla(var(--accent),0.25)] transition-all duration-150 will-change-transform";

/** Press: sink 0.5px + inset shadow (150ms) — applied via data-pressed */
const pressSink =
  "data-[pressed=true]:translate-y-[0.5px] data-[pressed=true]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-150";

const interactions = `${hoverLift} ${pressSink}`;

// ---------------------------------------------------------------------------
// skeuButtonVariants  (Req 17.16–17.19, 17.21, 17.49, 17.50)
// ---------------------------------------------------------------------------

export const skeuButtonVariants = tv({
  extend: buttonVariants,
  variants: {
    variant: {
      // Primary: gold gradient, inset top highlight, bottom shadow
      primary: [
        "bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)]",
        "text-white font-semibold",
        "shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]",
        interactions,
      ].join(" "),

      // Ghost: subtle gradient, minimal shadow, same micro-interactions
      ghost: [
        "bg-gradient-to-b from-[hsla(var(--accent),0.08)] to-[hsla(var(--accent),0.04)]",
        "text-[hsl(var(--text-primary))]",
        "shadow-[inset_0_1px_0_0_hsla(0,0%,100%,0.06),0_1px_2px_rgba(0,0,0,0.08)]",
        interactions,
      ].join(" "),

      // Secondary: muted accent surface
      secondary: [
        "bg-[hsl(var(--bg-elevated))]",
        "text-[hsl(var(--text-primary))]",
        "border border-[hsl(var(--border-default))]",
        "shadow-[inset_0_1px_0_0_hsla(0,0%,100%,0.08),0_1px_3px_rgba(0,0,0,0.12)]",
        interactions,
      ].join(" "),

      // Tertiary: minimal, text-like
      tertiary: [
        "bg-transparent",
        "text-[hsl(var(--text-secondary))]",
        "hover:bg-[hsla(var(--accent),0.08)]",
        pressSink,
        "transition-all duration-150",
      ].join(" "),

      // Danger: red gradient with same 3D treatment
      danger: [
        "bg-gradient-to-b from-[hsl(0,72%,58%)] to-[hsl(0,72%,48%)]",
        "text-white font-semibold",
        "shadow-[inset_0_1px_0_0_hsla(0,80%,75%,0.35),0_2px_4px_rgba(0,0,0,0.25)]",
        interactions,
      ].join(" "),
    },
    size: {
      sm: "h-8 px-3 text-xs rounded-md",
      md: "h-10 px-4 text-sm rounded-lg",
      lg: "h-12 px-6 text-base rounded-xl",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

// ---------------------------------------------------------------------------
// glassCardVariants  (Req 17.22)
// ---------------------------------------------------------------------------

export const glassCardVariants = tv({
  extend: cardVariants,
  variants: {
    variant: {
      glass: {
        base: "glass rounded-xl overflow-hidden",
      },
      elevated: {
        base: "glass-elevated rounded-xl overflow-hidden",
      },
      inset: {
        base: "inset-well rounded-xl overflow-hidden",
      },
      flat: {
        base: "bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] rounded-xl overflow-hidden",
      },
    },
    size: {
      sm: { base: "p-3 text-sm" },
      md: { base: "p-4 text-base" },
      lg: { base: "p-6 text-lg" },
    },
  },
  defaultVariants: {
    variant: "glass",
    size: "md",
  },
});

// ---------------------------------------------------------------------------
// badgeVariants  (Req 17.23)
// ---------------------------------------------------------------------------

export const skeuBadgeVariants = tv({
  extend: badgeVariants,
  variants: {
    color: {
      // Default: gold accent
      default: {
        base: "bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)]",
        label: "text-white font-medium",
      },
      // Success: emerald
      success: {
        base: "bg-gradient-to-b from-[hsl(145,70%,50%)] to-[hsl(145,70%,42%)]",
        label: "text-white font-medium",
      },
      // Warning: amber
      warning: {
        base: "bg-gradient-to-b from-[hsl(38,92%,55%)] to-[hsl(38,92%,45%)]",
        label: "text-white font-medium",
      },
      // Danger: red
      danger: {
        base: "bg-gradient-to-b from-[hsl(0,72%,58%)] to-[hsl(0,72%,48%)]",
        label: "text-white font-medium",
      },
      // Muted: subtle gray
      muted: {
        base: "bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))]",
        label: "text-[hsl(var(--text-muted))] font-medium",
      },
    },
    size: {
      sm: { label: "text-[10px] px-1.5 py-0.5" },
      md: { label: "text-xs px-2 py-0.5" },
      lg: { label: "text-sm px-2.5 py-1" },
    },
  },
  defaultVariants: {
    color: "default",
    size: "md",
  },
});

// Re-export tv for convenience
export { tv } from "@heroui/styles";
