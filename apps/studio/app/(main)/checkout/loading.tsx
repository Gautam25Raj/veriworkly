import { LoaderCircle } from "lucide-react";

/**
 * The same card `CheckoutRedirect` shows while it opens the payment page, so reading the
 * account and starting the checkout look like one step rather than two different loaders.
 */
export default function CheckoutLoading() {
  return (
    <main className="bg-background grid min-h-dvh place-items-center p-5">
      <section
        role="status"
        className="border-border bg-card w-full max-w-lg rounded-3xl border p-7 text-center shadow-sm sm:p-10"
      >
        <LoaderCircle className="text-accent mx-auto size-10 animate-spin" aria-hidden="true" />
        <h1 className="mt-6 text-2xl font-black tracking-tight">Opening secure checkout</h1>
        <p className="text-muted mt-3 text-sm leading-6">Checking your account first.</p>
      </section>
    </main>
  );
}
