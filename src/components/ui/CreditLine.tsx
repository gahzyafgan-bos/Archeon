import React, { useState } from "react";
import { CREDIT_LINE, TEAM_LOGO_PATH, TEAM_NAME } from "@/constants/credits";

/**
 * The team mark, if one has been supplied.
 *
 * Renders nothing at all until the file exists — a broken-image icon or an
 * empty reserved box next to a credit reads as an unfinished app, which is
 * worse than no logo. The <img> is removed from the DOM on the first error,
 * so a missing logo costs exactly one failed request and no layout.
 */
function TeamLogo({ size }: { size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={TEAM_LOGO_PATH}
      alt={TEAM_NAME}
      height={size}
      style={{ height: size, width: "auto", opacity: 0.75 }}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * "Museum Mpu Tantular Virtual — by Archeon", styled to be present without
 * competing with the museum's own name: smaller than body text (~0.8x) and
 * dimmer than it.
 */
export function CreditLine({
  className = "",
  logoSize = 18,
  style,
}: {
  className?: string;
  logoSize?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-museum-bone/70 ${className}`}
      style={{ fontSize: "0.7rem", letterSpacing: "0.06em", ...style }}
    >
      <TeamLogo size={logoSize} />
      <span>{CREDIT_LINE}</span>
    </div>
  );
}
