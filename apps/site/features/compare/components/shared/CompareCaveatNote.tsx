import { PRICING_VERIFIED_AT } from "../../data";

interface CompareCaveatNoteProps {
  /** One competitor's name, or omitted for a note that covers all of them. */
  competitorName?: string;
  className?: string;
}

export const CompareCaveatNote = ({ competitorName, className }: CompareCaveatNoteProps) => {
  const who = competitorName ?? "each builder";
  const site = competitorName ? `${competitorName}'s website` : "each provider's website";

  return (
    <p className={`text-muted max-w-3xl text-sm leading-6 ${className ?? ""}`}>
      Pricing and features for {who} were checked in {PRICING_VERIFIED_AT} against the
      provider&apos;s public pricing and product pages. Prices change, so check {site} for the
      latest numbers.
    </p>
  );
};

export default CompareCaveatNote;
