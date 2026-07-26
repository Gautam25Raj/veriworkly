import { FEATURE_ROWS, VERIWORKLY_MATRIX, type Competitor } from "@/config/compare";
import MatrixValueCell from "./MatrixValueCell";

const FeatureMatrixTable = ({ competitor }: { competitor: Competitor }) => {
  return (
    <div className="border-border/40 bg-card/30 overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-140 border-collapse text-left">
          <thead>
            <tr className="border-border/40 border-b">
              <th className="text-muted p-4 font-mono text-[10px] font-bold tracking-widest uppercase">
                Feature
              </th>
              <th className="text-accent bg-accent/5 w-40 p-4 font-mono text-[10px] font-bold tracking-widest uppercase">
                VeriWorkly
              </th>
              <th className="text-muted w-40 p-4 font-mono text-[10px] font-bold tracking-widest uppercase">
                {competitor.shortName}
              </th>
            </tr>
          </thead>

          <tbody>
            {FEATURE_ROWS.map((row, index) => (
              <tr key={row.key} className={index % 2 === 0 ? "bg-transparent" : "bg-muted/3"}>
                <td className="text-foreground p-4 text-sm font-medium">{row.label}</td>
                <td className="bg-accent/5 p-4">
                  <MatrixValueCell value={VERIWORKLY_MATRIX[row.key]} emphasize />
                </td>
                <td className="p-4">
                  <MatrixValueCell value={competitor.matrix[row.key]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeatureMatrixTable;
