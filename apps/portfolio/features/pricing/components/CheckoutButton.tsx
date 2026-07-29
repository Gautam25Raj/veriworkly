import React from "react";
import Link from "next/link";

interface CheckoutButtonProps {
  children: React.ReactNode;
  className?: string;
  href: string;
  disabled?: boolean;
}

export function CheckoutButton({
  children,
  className = "",
  href,
  disabled = false,
}: CheckoutButtonProps) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition duration-300";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Checkout is temporarily disabled. Please check back soon."
        className={`${base} cursor-not-allowed opacity-50 grayscale ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} cursor-pointer hover:-translate-y-1 active:scale-[0.97] ${className}`}
    >
      {children}
    </Link>
  );
}
