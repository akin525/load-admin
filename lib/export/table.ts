type ExportRow = Record<string, unknown>;

export type ExportColumn<T extends ExportRow = ExportRow> = {
  key: string;
  label: string;
  value?: (row: T, index: number) => unknown;
};

type ExportTableOptions<T extends ExportRow = ExportRow> = {
  filenameBase: string;
  format: "csv" | "xlsx";
  rows: T[];
  columns: ExportColumn<T>[];
  sheetName?: string;
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "export";

const normalizeCellValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
};

const buildNormalizedRows = <T extends ExportRow>(rows: T[], columns: ExportColumn<T>[]) =>
  rows.map((row, index) =>
    columns.reduce<Record<string, string | number | boolean>>((accumulator, column) => {
      const value = column.value ? column.value(row, index) : row[column.key];
      accumulator[column.label] = normalizeCellValue(value);
      return accumulator;
    }, {}),
  );

const escapeCsvCell = (value: string | number | boolean) => {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const exportAsCsv = <T extends ExportRow>(options: ExportTableOptions<T>) => {
  const normalizedRows = buildNormalizedRows(options.rows, options.columns);
  const header = options.columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = normalizedRows
    .map((row) => options.columns.map((column) => escapeCsvCell(row[column.label] ?? "")).join(","))
    .join("\r\n");
  const csv = `\ufeff${header}\r\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${sanitizeFilename(options.filenameBase)}.csv`);
};

const exportAsExcel = async <T extends ExportRow>(options: ExportTableOptions<T>) => {
  const ExcelJs = await import("exceljs");
  const normalizedRows = buildNormalizedRows(options.rows, options.columns);
  const workbook = new ExcelJs.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName || "Export");

  worksheet.columns = options.columns.map((column) => ({
    header: column.label,
    key: column.label,
    width: Math.min(Math.max(column.label.length + 4, 16), 36),
  }));

  normalizedRows.forEach((row) => {
    worksheet.addRow(row);
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };

  worksheet.columns.forEach((column) => {
    let maxLength = String(column.header ?? "").length;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const length = String(cell.value ?? "").length;
      if (length > maxLength) {
        maxLength = length;
      }
    });

    column.width = Math.min(Math.max(maxLength + 2, 16), 42);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${sanitizeFilename(options.filenameBase)}.xlsx`);
};

export const exportTableRows = async <T extends ExportRow>(options: ExportTableOptions<T>) => {
  if (options.format === "csv") {
    exportAsCsv(options);
    return;
  }

  await exportAsExcel(options);
};
