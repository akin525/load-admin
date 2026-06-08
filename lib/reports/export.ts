export type ReportKey = "financial" | "loanPerformance" | "profitLoss" | "revenue";

export type ReportFilters = {
  fromDate: string;
  toDate: string;
};

type ReportMetric = {
  label: string;
  value: string;
};

type ReportSection = {
  key: ReportKey;
  title: string;
  subtitle: string;
  payload: unknown;
};

const REPORT_META: Record<ReportKey, { title: string; subtitle: string; sheetName: string }> = {
  financial: {
    title: "Financial Report",
    subtitle: "Balance, movement, and operating figures",
    sheetName: "Financial",
  },
  loanPerformance: {
    title: "Loan Performance Report",
    subtitle: "Portfolio quality, repayments, and exposure",
    sheetName: "Loan Performance",
  },
  profitLoss: {
    title: "Profit and Loss Report",
    subtitle: "Income, expenses, and operating result",
    sheetName: "Profit and Loss",
  },
  revenue: {
    title: "Revenue Report",
    subtitle: "Collections, fees, and earnings summary",
    sheetName: "Revenue",
  },
};

const BRAND = {
  blue: "069AFF",
  blueDark: "083D70",
  slate: "1E293B",
  line: "D9E2EC",
  soft: "EEF7FF",
  white: "FFFFFF",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumericLike = (value: unknown) =>
  typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));

const unwrapPayload = (payload: unknown): unknown => {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

const extractRows = (payload: unknown): Record<string, unknown>[] => {
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

  const list = Object.values(value).find(Array.isArray);
  return Array.isArray(list) ? list.filter(isRecord) : [];
};

const formatLabel = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);

    if (!Number.isNaN(numeric) && value.trim().length <= 16) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
    }

    return value;
  }

  return "0";
};

const formatCurrency = (value: unknown): string => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numeric)) {
    return formatValue(value);
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatDate = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number") {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatFieldValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (isRecord(value)) {
    return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  }

  if (/(date|at)$/i.test(key) || /date/i.test(key)) {
    return formatDate(value);
  }

  if (isNumericLike(value)) {
    return /(amount|revenue|profit|loss|income|expense|interest|balance|payable|paid|outstanding|disbursed|collection|fee|earning)/i.test(key)
      ? formatCurrency(value)
      : formatValue(value);
  }

  return String(value);
};

const extractReportMetrics = (payload: unknown): ReportMetric[] => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [];
  }

  const metrics: ReportMetric[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (metrics.length >= 6) {
      return;
    }

    if (isNumericLike(value)) {
      metrics.push({ label: formatLabel(key), value: formatFieldValue(key, value) });
      return;
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, childValue]) => {
        if (metrics.length >= 6 || !isNumericLike(childValue)) {
          return;
        }

        metrics.push({
          label: `${formatLabel(key)} ${formatLabel(childKey)}`,
          value: formatFieldValue(childKey, childValue),
        });
      });
    }
  });

  return metrics;
};

const extractReportDetails = (payload: unknown) => {
  const data = unwrapPayload(payload);
  if (!isRecord(data)) {
    return [] as Array<{ label: string; value: string }>;
  }

  const details: Array<{ label: string; value: string }> = [];

  Object.entries(data).forEach(([key, value]) => {
    if (details.length >= 10) {
      return;
    }

    if (Array.isArray(value) || isRecord(value) || isNumericLike(value)) {
      return;
    }

    details.push({ label: formatLabel(key), value: formatFieldValue(key, value) });
  });

  return details;
};

const getReportColumns = (rows: Record<string, unknown>[]) => {
  const firstRow = rows[0];
  if (!firstRow) {
    return [] as string[];
  }

  return Object.keys(firstRow).filter((key) => !isRecord(firstRow[key]) && !Array.isArray(firstRow[key])).slice(0, 6);
};

const getReportLead = (payload: unknown) => {
  const metrics = extractReportMetrics(payload);
  if (metrics.length) {
    return metrics[0];
  }

  return {
    label: "Records",
    value: formatValue(extractRows(payload).length),
  };
};

const getSections = (reports: Partial<Record<ReportKey, unknown>>): ReportSection[] =>
  (Object.keys(REPORT_META) as ReportKey[]).map((key) => ({
    key,
    title: REPORT_META[key].title,
    subtitle: REPORT_META[key].subtitle,
    payload: reports[key],
  }));

let cachedLogoPromise: Promise<string> | null = null;

const loadLogoDataUrl = async () => {
  if (cachedLogoPromise) {
    return cachedLogoPromise;
  }

  cachedLogoPromise = (async () => {
    const response = await fetch("/eazy-logo.svg");
    if (!response.ok) {
      throw new Error("Unable to load report logo.");
    }

    const svg = await response.text();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new window.Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Unable to render report logo."));
        element.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.width || 280;
      canvas.height = image.height || 58;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to create report logo canvas.");
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();

  return cachedLogoPromise;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const buildFileName = (prefix: string, filters: ReportFilters, extension: string) => {
  const dateRange = [filters.fromDate || "start", filters.toDate || "end"].join("_to_");
  return `${prefix}_${dateRange}.${extension}`;
};

export const getReportHighlights = (reports: Partial<Record<ReportKey, unknown>>) => ({
  financial: getReportLead(reports.financial),
  loanPerformance: getReportLead(reports.loanPerformance),
  profitLoss: getReportLead(reports.profitLoss),
  revenue: getReportLead(reports.revenue),
});

export const exportReportsToExcel = async (reports: Partial<Record<ReportKey, unknown>>, filters: ReportFilters) => {
  const [ExcelJS, logoDataUrl] = await Promise.all([
    import("exceljs"),
    loadLogoDataUrl(),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EazyCredit Admin";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Management Reports";
  workbook.title = "EazyCredit Management Report Pack";

  const logoId = workbook.addImage({
    base64: logoDataUrl,
    extension: "png",
  });

  const overview = workbook.addWorksheet("Overview", {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  overview.mergeCells("C2:F2");
  overview.getCell("C2").value = "EazyCredit Management Report Pack";
  overview.getCell("C2").font = { size: 20, bold: true, color: { argb: BRAND.slate } };
  overview.getCell("C3").value = `Reporting period: ${filters.fromDate || "N/A"} to ${filters.toDate || "N/A"}`;
  overview.getCell("C3").font = { size: 11, color: { argb: "64748B" } };
  overview.addImage(logoId, {
    tl: { col: 0.35, row: 1.1 },
    ext: { width: 180, height: 37 },
  });

  overview.getCell("A6").value = "Report";
  overview.getCell("B6").value = "Primary Highlight";
  overview.getCell("C6").value = "Value";
  overview.getRow(6).font = { bold: true, color: { argb: BRAND.white } };
  ["A6", "B6", "C6"].forEach((cell) => {
    overview.getCell(cell).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.blue },
    };
    overview.getCell(cell).border = {
      top: { style: "thin", color: { argb: BRAND.line } },
      left: { style: "thin", color: { argb: BRAND.line } },
      bottom: { style: "thin", color: { argb: BRAND.line } },
      right: { style: "thin", color: { argb: BRAND.line } },
    };
  });

  const highlights = getReportHighlights(reports);
  const overviewRows = [
    ["Financial Report", highlights.financial.label, highlights.financial.value],
    ["Loan Performance Report", highlights.loanPerformance.label, highlights.loanPerformance.value],
    ["Profit and Loss Report", highlights.profitLoss.label, highlights.profitLoss.value],
    ["Revenue Report", highlights.revenue.label, highlights.revenue.value],
  ];

  overviewRows.forEach((row) => {
    const added = overview.addRow(row);
    added.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.line } },
        left: { style: "thin", color: { argb: BRAND.line } },
        bottom: { style: "thin", color: { argb: BRAND.line } },
        right: { style: "thin", color: { argb: BRAND.line } },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
  });

  overview.columns = [
    { key: "report", width: 28 },
    { key: "metric", width: 30 },
    { key: "value", width: 22 },
    { key: "spacerOne", width: 4 },
    { key: "spacerTwo", width: 4 },
    { key: "spacerThree", width: 4 },
  ];

  getSections(reports).forEach((section) => {
    const sheet = workbook.addWorksheet(REPORT_META[section.key].sheetName);
    const metrics = extractReportMetrics(section.payload);
    const details = extractReportDetails(section.payload);
    const rows = extractRows(section.payload);
    const columns = getReportColumns(rows);

    sheet.addImage(logoId, {
      tl: { col: 0.35, row: 0.6 },
      ext: { width: 150, height: 31 },
    });

    sheet.mergeCells("C2:G2");
    sheet.getCell("C2").value = section.title;
    sheet.getCell("C2").font = { size: 18, bold: true, color: { argb: BRAND.slate } };
    sheet.getCell("C3").value = section.subtitle;
    sheet.getCell("C3").font = { size: 11, color: { argb: "64748B" } };
    sheet.getCell("C4").value = `Period: ${filters.fromDate || "N/A"} to ${filters.toDate || "N/A"}`;
    sheet.getCell("C4").font = { size: 10, color: { argb: "64748B" } };

    let cursor = 6;

    if (metrics.length) {
      sheet.getCell(`A${cursor}`).value = "Key Metrics";
      sheet.getCell(`A${cursor}`).font = { bold: true, color: { argb: BRAND.blueDark } };
      cursor += 1;

      metrics.forEach((metric) => {
        sheet.getCell(`A${cursor}`).value = metric.label;
        sheet.getCell(`B${cursor}`).value = metric.value;
        sheet.getCell(`A${cursor}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.soft },
        };
        sheet.getCell(`A${cursor}`).font = { bold: true, color: { argb: BRAND.slate } };
        cursor += 1;
      });

      cursor += 1;
    }

    if (details.length) {
      sheet.getCell(`A${cursor}`).value = "Context";
      sheet.getCell(`A${cursor}`).font = { bold: true, color: { argb: BRAND.blueDark } };
      cursor += 1;

      details.forEach((detail) => {
        sheet.getCell(`A${cursor}`).value = detail.label;
        sheet.getCell(`B${cursor}`).value = detail.value;
        cursor += 1;
      });

      cursor += 1;
    }

    if (rows.length && columns.length) {
      sheet.getCell(`A${cursor}`).value = "Data Table";
      sheet.getCell(`A${cursor}`).font = { bold: true, color: { argb: BRAND.blueDark } };
      cursor += 1;

      const headerRow = sheet.addRow(columns.map((column) => formatLabel(column)));
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: BRAND.white } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.blue },
        };
        cell.border = {
          top: { style: "thin", color: { argb: BRAND.line } },
          left: { style: "thin", color: { argb: BRAND.line } },
          bottom: { style: "thin", color: { argb: BRAND.line } },
          right: { style: "thin", color: { argb: BRAND.line } },
        };
      });

      rows.forEach((row) => {
        const added = sheet.addRow(columns.map((column) => formatFieldValue(column, row[column])));
        added.eachCell((cell) => {
          cell.alignment = { vertical: "top", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: BRAND.line } },
            left: { style: "thin", color: { argb: BRAND.line } },
            bottom: { style: "thin", color: { argb: BRAND.line } },
            right: { style: "thin", color: { argb: BRAND.line } },
          };
        });
      });
    }

    sheet.columns = [
      { width: 28 },
      { width: 30 },
      { width: 24 },
      { width: 24 },
      { width: 24 },
      { width: 24 },
    ];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    buildFileName("eazycredit-report-pack", filters, "xlsx"),
  );
};

export const exportReportsToPdf = async (reports: Partial<Record<ReportKey, unknown>>, filters: ReportFilters) => {
  const [{ jsPDF }, autoTableModule, logoDataUrl] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadLogoDataUrl(),
  ]);

  const autoTable = autoTableModule.default;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const drawPageHeader = (title: string, subtitle: string, periodText: string) => {
    doc.setFillColor("#F8FBFF");
    doc.roundedRect(margin, margin, pageWidth - margin * 2, 88, 16, 16, "F");
    doc.addImage(logoDataUrl, "PNG", margin + 18, margin + 22, 122, 25);
    doc.setTextColor(`#${BRAND.slate}`);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, margin + 18, margin + 62);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor("#64748B");
    doc.text(subtitle, margin + 18, margin + 79);
    doc.text(periodText, pageWidth - margin - 180, margin + 62);
  };

  drawPageHeader(
    "EazyCredit Report Pack",
    "Management reporting export",
    `Period: ${filters.fromDate || "N/A"} to ${filters.toDate || "N/A"}`,
  );

  const summaryRows = [
    ["Financial Report", ...Object.values(getReportLead(reports.financial))],
    ["Loan Performance Report", ...Object.values(getReportLead(reports.loanPerformance))],
    ["Profit and Loss Report", ...Object.values(getReportLead(reports.profitLoss))],
    ["Revenue Report", ...Object.values(getReportLead(reports.revenue))],
  ];

  autoTable(doc, {
    startY: 156,
    head: [["Report", "Primary Highlight", "Value"]],
    body: summaryRows,
    theme: "grid",
    headStyles: { fillColor: `#${BRAND.blue}`, textColor: "#FFFFFF", fontStyle: "bold" },
    bodyStyles: { textColor: `#${BRAND.slate}` },
    alternateRowStyles: { fillColor: "#F8FBFF" },
    styles: { fontSize: 9.5, cellPadding: 7, lineColor: `#${BRAND.line}` },
    margin: { left: margin, right: margin },
  });

  getSections(reports).forEach((section, index) => {
    doc.addPage();
    drawPageHeader(
      section.title,
      section.subtitle,
      `Period: ${filters.fromDate || "N/A"} to ${filters.toDate || "N/A"}`,
    );

    const metrics = extractReportMetrics(section.payload);
    const details = extractReportDetails(section.payload);
    const rows = extractRows(section.payload);
    const columns = getReportColumns(rows);

    let y = 150;

    if (metrics.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(`#${BRAND.blueDark}`);
      doc.text("Key Metrics", margin, y);
      y += 18;

      metrics.forEach((metric, metricIndex) => {
        const cardWidth = (pageWidth - margin * 2 - 12) / 2;
        const cardX = metricIndex % 2 === 0 ? margin : margin + cardWidth + 12;
        const cardY = y + Math.floor(metricIndex / 2) * 54;
        doc.setFillColor("#F8FBFF");
        doc.roundedRect(cardX, cardY, cardWidth, 44, 12, 12, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor("#64748B");
        doc.text(metric.label, cardX + 12, cardY + 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(`#${BRAND.slate}`);
        doc.text(metric.value, cardX + 12, cardY + 33);
      });

      y += Math.ceil(metrics.length / 2) * 54 + 8;
    }

    if (details.length) {
      autoTable(doc, {
        startY: y,
        head: [["Context", "Value"]],
        body: details.map((detail) => [detail.label, detail.value]),
        theme: "grid",
        headStyles: { fillColor: `#${BRAND.blue}`, textColor: "#FFFFFF", fontStyle: "bold" },
        bodyStyles: { textColor: `#${BRAND.slate}` },
        alternateRowStyles: { fillColor: "#F8FBFF" },
        styles: { fontSize: 9, cellPadding: 6, lineColor: `#${BRAND.line}` },
        margin: { left: margin, right: margin },
      });

      y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;
    }

    if (rows.length && columns.length) {
      autoTable(doc, {
        startY: y,
        head: [columns.map((column) => formatLabel(column))],
        body: rows.map((row) => columns.map((column) => formatFieldValue(column, row[column]))),
        theme: "grid",
        headStyles: { fillColor: `#${BRAND.blue}`, textColor: "#FFFFFF", fontStyle: "bold" },
        bodyStyles: { textColor: `#${BRAND.slate}` },
        alternateRowStyles: { fillColor: "#F8FBFF" },
        styles: { fontSize: 8.5, cellPadding: 5.5, lineColor: `#${BRAND.line}` },
        margin: { left: margin, right: margin },
      });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor("#94A3B8");
    doc.text(`Section ${index + 1} of 4`, pageWidth - margin - 60, pageHeight - 24);
  });

  doc.save(buildFileName("eazycredit-report-pack", filters, "pdf"));
};
