export function DataTable({ columns, rows, empty }: {
  columns: string[];
  rows: (string | number)[][];
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{empty || 'No data'}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map(c => (
              <th key={c} className="px-4 py-3 text-left font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 hover:bg-muted/20">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}