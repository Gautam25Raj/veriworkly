export interface FeatureIndexItem {
  /** The id of the section on /features that this entry jumps to. */
  id: string;
  title: string;
  summary: string;
}

export interface FeatureComparisonRow {
  feature: string;
  veriworkly: string;
  competitor: string;
}

export interface ExportFormatItem {
  ext: string;
  name: string;
  desc: string;
}
