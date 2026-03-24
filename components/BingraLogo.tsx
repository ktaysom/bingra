type BingraLogoVariant = "vertical" | "horizontal" | "badge";

const LOGO_SRC_BY_VARIANT: Record<BingraLogoVariant, string> = {
  horizontal: "/logos/bingra-horizontal.svg",
  vertical: "/logos/bingra-vertical.svg",
  badge: "/logos/bingra-badge.svg",
};

type BingraLogoProps = {
  variant?: BingraLogoVariant;
  className?: string;
  alt?: string;
};

function getDefaultLogoClassName(variant: BingraLogoVariant): string {
  if (variant === "badge") {
    // Give the badge stronger default visual weight when used in headers/surfaces.
    return "block h-9 w-9 object-contain sm:h-10 sm:w-10";
  }

  if (variant === "vertical") {
    return "block h-9 w-auto object-contain sm:h-10";
  }

  return "block h-8 w-auto object-contain sm:h-9";
}

export function BingraLogo({
  variant = "horizontal",
  className,
  alt = "Bingra logo",
}: BingraLogoProps) {
  const resolvedClassName = className
    ? `${getDefaultLogoClassName(variant)} ${className}`
    : getDefaultLogoClassName(variant);

  return (
    <img
      src={LOGO_SRC_BY_VARIANT[variant]}
      alt={alt}
      className={resolvedClassName}
      loading="eager"
    />
  );
}
