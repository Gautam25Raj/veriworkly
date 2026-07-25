import { Palette } from "lucide-react";

import BrandSectionHeader from "./BrandSectionHeader";
import BrandColorSwatch from "./BrandColorSwatch";

const COLORS = [
  {
    hex: "#F5F4EF",
    name: "Background",
    variable: "--background",
    description: "Primary page background",
  },
  {
    hex: "#171717",
    name: "Foreground",
    variable: "--foreground",
    description: "Main text color",
  },
  {
    hex: "#2563EB",
    name: "Accent (Blue)",
    variable: "--accent",
    description: "Primary action color — use for links, CTAs, and highlights",
  },
  {
    name: "Card",
    hex: "#FFFFFF",
    variable: "--card",
    description: "Component surfaces",
  },
  {
    name: "Muted",
    hex: "#5F5C54",
    variable: "--muted",
    description: "Secondary text and details",
  },
  {
    name: "Border",
    variable: "--border",
    hex: "#1717171F",
    description: "Subtle dividers (rgba(23,23,23,0.12))",
  },
  {
    name: "Destructive",
    hex: "#DC2626",
    variable: "--destructive",
    description: "Error and danger states",
  },
  {
    name: "Accent FG",
    hex: "#F8FBFF",
    variable: "--accent-foreground",
    description: "Text on accent-colored backgrounds",
  },
];

const ColorSection = () => {
  return (
    <section id="colors" className="scroll-mt-24 space-y-8">
      <BrandSectionHeader
        icon={Palette}
        title="Colors"
        description="The full token set lives in the design system. These are the ones you'll reach for most often when referencing the brand externally."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {COLORS.map((color) => (
          <BrandColorSwatch key={color.variable} {...color} />
        ))}
      </div>
    </section>
  );
};

export default ColorSection;
