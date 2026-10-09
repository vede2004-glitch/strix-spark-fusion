import { useLang } from "@/lib/lang";

export function BrandLogo({ className = "" }: { className?: string }) {
  const lang = useLang();
  const hu = lang === "hu";
  return (
    <>
      <img src={hu ? "/hirx-logo.png" : "/stirix-logo.png"} alt={hu ? "HirX.ro" : "Stirix.ro"} className={`brand-on-dark scale-[0.8] ${className}`} />
      <img src={hu ? "/hirx-logo-dark.png" : "/stirix-logo-dark.png"} alt={hu ? "HirX.ro" : "Stirix.ro"} className={`brand-on-light scale-[0.8] ${className}`} />
    </>
  );
}
