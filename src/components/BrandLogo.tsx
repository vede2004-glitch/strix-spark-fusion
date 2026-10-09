export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <>
      <img src="/stirix-logo.png" alt="Stirix.ro" className={`brand-on-dark ${className}`} />
      <img src="/stirix-logo-dark.png" alt="Stirix.ro" className={`brand-on-light ${className}`} />
    </>
  );
}
