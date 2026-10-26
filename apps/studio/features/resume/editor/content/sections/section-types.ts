export interface BaseSectionProps {
  isOpen: boolean;
  /** Called with the section key: the section id, or `custom:<id>` for a custom section. */
  onToggle: (sectionKey: string) => void;
}
