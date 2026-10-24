import { PageSection } from "@/components/marketing/PageLayout";

import { DATA_RETENTION_MATRIX } from "../../data";

const COLUMNS = [
  { key: "storageLocation", label: "Where it lives" },
  { key: "retentionPeriod", label: "How long" },
  { key: "deletionMethod", label: "How it is deleted" },
  { key: "encryption", label: "Protection" },
] as const;

export const DataRetentionSection = () => (
  <PageSection
    id="retention"
    tone="card"
    title="How long we keep it."
    lede="Every place your data can sit, how long it stays there, and how you remove it. We do not monetise your data or hold it indefinitely."
  >
    <div className="reveal bg-background hidden overflow-hidden rounded-3xl md:block">
      <table className="w-full border-collapse text-left text-base">
        <caption className="sr-only">
          Where each kind of data lives, how long, and how it is deleted
        </caption>
        <thead>
          <tr className="text-muted text-sm">
            <th scope="col" className="w-[22%] p-5 font-semibold lg:p-6">
              Data
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="p-5 font-semibold lg:p-6">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATA_RETENTION_MATRIX.map((row) => (
            <tr key={row.platformArea} className="border-border border-t align-top">
              <th scope="row" className="p-5 font-semibold lg:p-6">
                {row.platformArea}
              </th>
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={
                    column.key === "retentionPeriod"
                      ? "p-5 leading-7 font-medium lg:p-6"
                      : "text-muted p-5 leading-7 lg:p-6"
                  }
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <ul className="space-y-4 md:hidden">
      {DATA_RETENTION_MATRIX.map((row) => (
        <li key={row.platformArea} className="bg-background rounded-3xl p-6">
          <h3 className="text-xl font-bold tracking-tight">{row.platformArea}</h3>
          <dl className="mt-4 space-y-4 text-base leading-7">
            {COLUMNS.map((column) => (
              <div key={column.key}>
                <dt className="text-muted text-sm font-semibold">{column.label}</dt>
                <dd className="mt-0.5">{row[column.key]}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  </PageSection>
);

export default DataRetentionSection;
