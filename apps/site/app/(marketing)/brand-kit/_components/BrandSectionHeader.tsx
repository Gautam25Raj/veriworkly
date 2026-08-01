import { LucideIcon } from "lucide-react";

interface BrandSectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

const BrandSectionHeader = ({ icon: Icon, title, description }: BrandSectionHeaderProps) => (
  <div className="space-y-2">
    <div className="flex items-center gap-3">
      <div className="bg-accent/10 flex size-10 items-center justify-center rounded-lg">
        <Icon className="text-accent size-5" aria-hidden="true" />
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
    </div>

    {description && <p className="text-muted max-w-2xl text-sm leading-relaxed">{description}</p>}
  </div>
);

export default BrandSectionHeader;
