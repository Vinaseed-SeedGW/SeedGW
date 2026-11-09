type DataTableSkeletonProps = {
  columns: number;
  rows: number;
};

export function DataTableSkeleton({ columns, rows }: DataTableSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className="mt-3.5">
      <span className="sr-only">Đang tải dữ liệu</span>
      <div className="h-9 w-64 max-w-full animate-pulse rounded-md bg-surface-subtle" />
      <div className="mt-3 space-y-2.5" aria-hidden>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <div key={column} className="h-5 animate-pulse rounded-sm bg-surface-subtle" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
