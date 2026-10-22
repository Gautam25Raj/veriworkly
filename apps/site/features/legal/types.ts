export interface LegalSubsection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
  orderedList?: string[];
}

export interface LegalSection {
  id: string;
  title: string;
  intro?: string[];
  subsections?: LegalSubsection[];
}

export interface LegalTopic {
  title: string;
  description: string;
}

export interface LegalTopicsGridProps {
  title: string;
  lede?: string;
  topics: LegalTopic[];
}

export interface LegalContactBannerProps {
  title: string;
  description: string;
  primaryActionText: string;
  primaryActionEmail: string;
  secondaryActionText: string;
  secondaryActionHref: string;
}
