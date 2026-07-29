// Escaping `<` prevents a `</script>` breakout if the serialized data ever
// contains untrusted content (user-authored names/bios/links). Centralized
// here so every JSON-LD block gets it — previously only one call site
// remembered to escape and the rest didn't.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
