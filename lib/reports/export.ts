"use client";

type ReportFilters = {
  fromDate: string;
  toDate: string;
};

type ReportCollection = Partial<Record<"financial" | "loanPerformance" | "profitLoss" | "revenue", unknown>>;

type RecordRow = Record<string, unknown>;

const REPORT_TITLES: Record<keyof ReportCollection, string> = {
  financial: "Financial Report",
  loanPerformance: "Loan Performance Report",
  profitLoss: "Profit and Loss Report",
  revenue: "Revenue Report",
};

const isRecord = (value: unknown): value is RecordRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

const extractRows = (payload: unknown): RecordRow[] => {
  const value = unwrapPayload(payload);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.data)) {
    return value.data.filter(isRecord);
  }

  const firstArray = Object.values(value).find(Array.isArray);
  return Array.isArray(firstArray) ? firstArray.filter(isRecord) : [];
};

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateLabel = (filters: ReportFilters) => {
  if (filters.fromDate && filters.toDate) {
    return `${filters.fromDate} to ${filters.toDate}`;
  }

  if (filters.fromDate) {
    return `From ${filters.fromDate}`;
  }

  if (filters.toDate) {
    return `Up to ${filters.toDate}`;
  }

  return "All available dates";
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return String(value);
};

const collectSummaryPairs = (payload: unknown): Array<[string, string]> => {
  const value = unwrapPayload(payload);

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([, entry]) => !Array.isArray(entry) && !isRecord(entry))
    .slice(0, 8)
    .map(([key, entry]) => [formatLabel(key), formatCellValue(entry)]);
};

const getColumns = (rows: RecordRow[]): string[] => {
  const seen = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
      }
    });
  });

  return Array.from(seen);
};

const buildTableBody = (rows: RecordRow[], columns: string[]) =>
  rows.map((row) => columns.map((column) => formatCellValue(row[column])));

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

const sanitizeBase64 = (dataUrl: string) => dataUrl.replace(/^data:image\/png;base64,/, "");

const loadLogoDataUrl = async (): Promise<string | null> => {
  try {
    const response = await fetch("/eazy-logo.svg");

    if (!response.ok) {
      return null;
    }

    const svgText = await response.text();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Unable to load report logo."));
        nextImage.src = blobUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(image.width, 240);
      canvas.height = Math.max(image.height, 56);

      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
};

export async function exportReportsToPdf(reports: ReportCollection, filters: ReportFilters) {
  const [{ default: JsPdf }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new JsPdf({ orientation: "portrait", unit: "pt", format: "a4" });
  const logoDataUrl = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let cursorY = 56;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 32, 140, 34, undefined, "FAST");
  } else {
    doc.setFontSize(24);
    doc.setTextColor(6, 154, 255);
    doc.text("eazycredit", margin, 56);
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(22);
  doc.text("Management Report Pack", margin, cursorY + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(formatDateLabel(filters), margin, cursorY + 58);

  cursorY += 96;

  (Object.keys(REPORT_TITLES) as Array<keyof ReportCollection>).forEach((key, index) => {
    const payload = reports[key];
    const rows = extractRows(payload);
    const summaryPairs = collectSummaryPairs(payload);

    if (index > 0) {
      doc.addPage();
      cursorY = 56;
    }

    doc.setDrawColor(6, 154, 255);
    doc.setFillColor(4, 22, 40);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 52, 12, 12, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(REPORT_TITLES[key], margin + 18, cursorY + 32);

    let sectionY = cursorY + 74;

    if (summaryPairs.length > 0) {
      autoTable(doc, {
        startY: sectionY,
        head: [["Metric", "Value"]],
        body: summaryPairs,
        theme: "grid",
        styles: {
          fontSize: 10,
          cellPadding: 8,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [6, 154, 255],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        margin: { left: margin, right: margin },
      });

      sectionY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? sectionY) + 18;
    }

    if (rows.length > 0) {
      const columns = getColumns(rows);
      autoTable(doc, {
        startY: sectionY,
        head: [columns.map(formatLabel)],
        body: buildTableBody(rows, columns),
        theme: "striped",
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249],
        },
        margin: { left: margin, right: margin },
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("No tabular records available for this report.", margin, sectionY + 8);
    }
  });

  doc.save(`eazycredit-reports-${Date.now()}.pdf`);
}

export async function exportReportsToExcel(reports: ReportCollection, filters: ReportFilters) {
  const ExcelJsModule = await import("exceljs");
  const ExcelJs = ExcelJsModule.default ?? ExcelJsModule;
  const workbook = new ExcelJs.Workbook();
  const logoDataUrl = await loadLogoDataUrl();

  workbook.creator = "EazyCredit Admin";
  workbook.created = new Date();
  workbook.modified = new Date();

  const overview = workbook.addWorksheet("Overview");
  overview.columns = [
    { header: "Report", key: "report", width: 28 },
    { header: "Rows", key: "rows", width: 12 },
    { header: "Date Range", key: "dateRange", width: 28 },
  ];

  overview.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  overview.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF069AFF" } };

  if (logoDataUrl) {
    const imageId = workbook.addImage({
      base64: sanitizeBase64(logoDataUrl),
      extension: "png",
    });

    overview.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 170, height: 40 },
    });
  }

  overview.mergeCells("A3:C3");
  overview.getCell("A3").value = "Management Report Pack";
  overview.getCell("A3").font = { size: 16, bold: true };
  overview.mergeCells("A4:C4");
  overview.getCell("A4").value = formatDateLabel(filters);
  overview.getCell("A4").font = { color: { argb: "FF475569" } };

  (Object.keys(REPORT_TITLES) as Array<keyof ReportCollection>).forEach((key) => {
    const rows = extractRows(reports[key]);
    overview.addRow({
      report: REPORT_TITLES[key],
      rows: rows.length,
      dateRange: formatDateLabel(filters),
    });
  });

  for (const key of Object.keys(REPORT_TITLES) as Array<keyof ReportCollection>) {
    const sheet = workbook.addWorksheet(REPORT_TITLES[key].replace(" Report", ""));
    const payload = reports[key];
    const rows = extractRows(payload);
    const summaryPairs = collectSummaryPairs(payload);

    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = REPORT_TITLES[key];
    sheet.getCell("A1").font = { size: 15, bold: true };

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = formatDateLabel(filters);
    sheet.getCell("A2").font = { color: { argb: "FF475569" } };

    let rowPointer = 4;

    if (summaryPairs.length > 0) {
      sheet.getCell(`A${rowPointer}`).value = "Summary";
      sheet.getCell(`A${rowPointer}`).font = { bold: true };
      rowPointer += 1;

      sheet.columns = [
        { key: "metric", width: 28 },
        { key: "value", width: 24 },
      ];

      summaryPairs.forEach(([metric, value]) => {
        sheet.addRow({ metric, value });
        rowPointer += 1;
      });

      rowPointer += 1;
    }

    if (rows.length > 0) {
      const columns = getColumns(rows);
      const headerRowIndex = rowPointer;

      sheet.spliceRows(headerRowIndex, 0, columns.map(formatLabel));
      const headerRow = sheet.getRow(headerRowIndex);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      rows.forEach((row) => {
        sheet.addRow(columns.map((column) => formatCellValue(row[column])));
      });

      columns.forEach((column, index) => {
        const maxLength = Math.max(
          formatLabel(column).length,
          ...rows.map((row) => formatCellValue(row[column]).length),
        );

        sheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 16), 36);
      });
    } else {
      sheet.getCell(`A${rowPointer}`).value = "No tabular records available for this report.";
      sheet.getCell(`A${rowPointer}`).font = { italic: true, color: { argb: "FF64748B" } };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `eazycredit-reports-${Date.now()}.xlsx`,
  );
}
