// next/font only exists under Next's compiler.
const font = ({ variable }: { variable?: string }) => ({
  className: "font",
  variable: variable ?? "",
  style: { fontFamily: "font" },
});

export const Geist = font;
export const Geist_Mono = font;
