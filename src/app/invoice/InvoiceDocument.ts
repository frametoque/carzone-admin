import { jsPDF } from "jspdf";

const formatDateYYYYMMDD = (dStr: string) => {
  if (!dStr) return "N/A";
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export async function generateInvoicePDF(invoice: any, isQuotation = false): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const primaryNavy = [0, 47, 76]; // #002f4c
  const darkSlate = [15, 23, 42];  // #0f172a
  const textMuted = [100, 116, 139]; // #64748b
  const bgLight = [248, 250, 252]; // #f8fafc

  const drawHeader = () => {
    // Top Navy Accent Bar
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(0, 0, 210, 8, "F");

    // Company Brand Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("CARZ ONE", 15, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("Premium Automotive Dealership & Services", 15, 27);
    doc.text("499 Sunethradevi Rd, Nugegoda, Sri Lanka", 15, 31);
    doc.text("Phone: +94 70 173 6077 | Email: info@carzone.lk", 15, 35);

    // Document Title & Reference Box (Right side)
    const docTitle = isQuotation ? "QUOTATION" : "INVOICE";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(docTitle, 195, 22, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`${isQuotation ? "Quote #" : "Invoice #"}`, 140, 31);
    doc.text("Date:", 140, 36);

    doc.setFont("helvetica", "semibold");
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    const idVal = isQuotation ? `QT-${invoice.id || invoice.quotation_number}` : (invoice.invoice_id || `INV-${invoice.id}`);
    doc.text(idVal, 195, 31, { align: "right" });
    doc.text(formatDateYYYYMMDD(invoice.date), 195, 36, { align: "right" });

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 42, 195, 42);
  };

  drawHeader();

  // Billed To & Info Card
  let infoY = 48;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(15, infoY, 180, 24, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, infoY, 180, 24, "S");

  const clientName = invoice.client_name || invoice.user_email || "Valued Client";
  const clientEmail = invoice.user_email || "";
  const billingAddr = invoice.billing_address || "Colombo, Sri Lanka";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("BILLED TO / RECIPIENT:", 20, infoY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(clientName, 20, infoY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  if (clientEmail && clientEmail !== clientName) {
    doc.text(clientEmail, 20, infoY + 16);
  }
  doc.text(billingAddr, 20, infoY + 20);

  // Right Side Info: Payment Details / Status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("PAYMENT DETAILS:", 115, infoY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Method: ${invoice.payment_method || "Bank Transfer"}`, 115, infoY + 11);

  const paymentStatus = (invoice.payment_status || "paid").toUpperCase();
  doc.setFont("helvetica", "bold");
  if (paymentStatus === "PAID") {
    doc.setTextColor(21, 128, 61); // Green
  } else if (paymentStatus === "UNPAID" || paymentStatus === "OVERDUE") {
    doc.setTextColor(185, 28, 28); // Red
  } else {
    doc.setTextColor(147, 51, 234); // Purple
  }
  doc.text(`Status: ${paymentStatus}`, 115, infoY + 16);

  // Items Table Header
  let tableY = 78;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(15, tableY, 180, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRIPTION / ITEM DETAILS", 20, tableY + 5.5);
  doc.text("QTY", 125, tableY + 5.5, { align: "right" });
  doc.text("UNIT PRICE (LKR)", 160, tableY + 5.5, { align: "right" });
  doc.text("TOTAL (LKR)", 190, tableY + 5.5, { align: "right" });

  let rowY = tableY + 8;
  const items = invoice.items || [];
  const currencyLabel = invoice.currency === "LKR" ? "Rs." : (invoice.currency || "LKR");

  items.forEach((item: any, idx: number) => {
    if (rowY > 240) {
      doc.addPage();
      drawHeader();
      tableY = 48;
      rowY = tableY;
    }

    const desc = item.description || "Untitled Item";
    const price = parseFloat(item.price || item.unit_price || item.rate || 0);
    const qty = parseFloat(item.quantity || 1);
    const itemTotal = parseFloat(item.total || price * qty);

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, rowY, 180, 8, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

    const descLines = doc.splitTextToSize(desc, 95);
    doc.text(descLines[0], 20, rowY + 5.5);

    doc.text(qty.toString(), 125, rowY + 5.5, { align: "right" });
    doc.text(`${currencyLabel} ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 160, rowY + 5.5, { align: "right" });
    doc.text(`${currencyLabel} ${itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, rowY + 5.5, { align: "right" });

    rowY += 8;
  });

  // Table Bottom Line
  doc.setDrawColor(226, 232, 240);
  doc.line(15, rowY, 195, rowY);
  rowY += 6;

  // Summary Box (Right Aligned)
  const subtotal = parseFloat(invoice.subtotal != null ? invoice.subtotal : invoice.amount || 0);
  const discount = parseFloat(invoice.discount || 0);
  const advance = parseFloat(invoice.advance || 0);
  const total = parseFloat(invoice.total != null ? invoice.total : subtotal - discount);
  const totalDue = parseFloat(invoice.total_due != null ? invoice.total_due : total - advance);

  const summaryStartX = 120;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Subtotal:", summaryStartX, rowY);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`${currencyLabel} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, rowY, { align: "right" });
  rowY += 5;

  if (discount > 0) {
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("Discount:", summaryStartX, rowY);
    doc.setTextColor(185, 28, 28);
    doc.text(`-${currencyLabel} ${discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, rowY, { align: "right" });
    rowY += 5;
  }

  if (advance > 0) {
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(isQuotation ? "Advance Required:" : "Advance Paid:", summaryStartX, rowY);
    doc.setTextColor(21, 128, 61);
    doc.text(`-${currencyLabel} ${advance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, rowY, { align: "right" });
    rowY += 5;
  }

  // Grand Total & Total Due Highlight
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(summaryStartX - 2, rowY, 77, 12, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(summaryStartX - 2, rowY, 77, 12, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text("Total Due:", summaryStartX + 2, rowY + 7.5);
  doc.setFontSize(11);
  doc.text(`${currencyLabel} ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, rowY + 7.5, { align: "right" });

  // Footer & Terms
  const footerY = 275;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, footerY, 195, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Thank you for choosing Carz One. All vehicle transactions are subject to standard dealership sales terms.", 105, footerY + 5, { align: "center" });
  doc.text("Carz One (Pvt) Ltd. • Registered Company in Sri Lanka", 105, footerY + 9, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
