"use client";
import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/datagrid/DataGrid";

// ── Public type — all pages import this ──────────────────────────────────────
export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  wrap?: boolean;
  size?: number;
};

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  actions?: (row: T) => React.ReactNode;
  stickyHeader?: boolean;
  scrollContainerClass?: string;
  toolbar?: React.ReactNode;
  initialSearch?: string;
  title?: string;
  loading?: boolean;
  getRowId?: (row: T) => string;
  rowHeight?: number;
  enableRowSelection?: boolean;
}

// ── DataTable — now powered by DataGrid ──────────────────────────────────────
export function DataTable<T>({
  data,
  columns,
  actions,
  pageSize = 25,
  toolbar,
  title,
  loading = false,
  stickyHeader = false,
  getRowId,
  rowHeight,
  enableRowSelection = true,
}: DataTableProps<T>) {

  const gridColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = columns.map(col => {
      const colDef: ColumnDef<T> = {
        id: String(col.key),
        accessorKey: col.key as string,
        header: col.header,
        enableSorting: col.sortable !== false,
        meta: col.wrap ? { wrap: true } : undefined,
        ...(col.size ? { size: col.size, minSize: Math.min(col.size, 80), maxSize: col.size } : {}),
      };
      if (col.render) {
        colDef.cell = ({ row }) => col.render!(row.original);
      }
      return colDef;
    });

    if (actions) {
      cols.push({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            {actions(row.original)}
          </div>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 220,
        minSize: 170,
      });
    }

    return cols;
  }, [columns, actions]);

  return (
    <DataGrid
      data={data}
      columns={gridColumns}
      title={title}
      loading={loading}
      enableSearch
      enableFiltering
      enableExport
      enablePagination
      enableColumnResizing
      enableColumnVisibility
      enableSorting
      enableVisualization
      enableDateFilter
      enableColumnReordering
      paginationPageSize={pageSize}
      headerActions={toolbar}
      enableRowSelection={enableRowSelection}
      getRowId={getRowId as ((row: T) => string) | undefined ?? ((row: any) => String(row.id ?? row.ID ?? row.ItemID ?? row.LedgerID ?? row.CategoryID ?? row.ProcessID ?? row.ToolID ?? row.GangWorkOrderNo ?? ""))}
      className={stickyHeader ? "flex-1 min-h-0" : undefined}
      maxHeight={stickyHeader ? "100%" : undefined}
      rowHeight={rowHeight}
    />
  );
}
