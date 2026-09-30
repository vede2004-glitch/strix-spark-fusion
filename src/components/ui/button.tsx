import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        outline: "border border-border bg-card text-foreground hover:border-primary/50",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className = "", variant, size, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}