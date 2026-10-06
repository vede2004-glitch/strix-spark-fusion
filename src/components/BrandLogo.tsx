type BrandLogoProps = {
  className: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={`relative block ${className}`} aria-hidden="true">
      <img src="/stirix-logo.png" alt="" className="brand-logo-dark absolute inset-0 size-full object-contain object-left" />
      <img src="/stirix-logo-light.png" alt="" className="brand-logo-light absolute inset-0 size-full object-contain object-left" />
    </span>
  );
}