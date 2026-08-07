import { jsPDF } from "jspdf";

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

  let imgData = "";
  let paidStampData = "";
  try {
    imgData = await getBase64ImageFromUrl("/invoice-bg.png");
  } catch (err) {
    console.error("Failed to load invoice background image:", err);
  }

  // Load paid stamp only if it is a completed invoice
  if (!isQuotation && invoice.payment_status?.toLowerCase() === "paid") {
    try {
      paidStampData = await getBase64ImageFromUrl("/paid-stamp.png");
    } catch (err) {
      console.error("Failed to load paid stamp image:", err);
    }
  }

  const drawPageBackground = () => {
    if (imgData) {
      doc.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
  };

  // Draw background for the first page
  drawPageBackground();

  // Handle Quotation Layout Masking & Text Overrides
  if (isQuotation) {
    // 1. Cover top-left pre-printed "INVOICE" and write "QUOTATION"
    doc.setFillColor(255, 255, 255);
    doc.rect(14.0, 10.0, 56.0, 20.0, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(40, 40, 40);
    doc.text("QUOTATION", 15.0, 24.6);

    // 2. Cover top-right "INVOICE #" label and write "QUOTATION #"
    doc.setFillColor(255, 255, 255);
    doc.rect(118.0, 12.0, 28.0, 4.0, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("QUOTATION #", 145.0, 14.7, { align: "right" });

    // 3. Cover top-right "INVOICE DATE" label and write "QUOTATION DATE"
    doc.setFillColor(255, 255, 255);
    doc.rect(118.0, 17.0, 28.0, 4.0, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("QUOTATION DATE", 145.0, 19.7, { align: "right" });

    // 4. Cover "P.O. #" row entirely (P.O. # doesn't apply to quotes)
    doc.setFillColor(255, 255, 255);
    doc.rect(130.0, 22.0, 60.0, 5.0, "F");
  }

  // 1. Overlay Header Details (Top Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  // ID Value
  const idValue = isQuotation ? `QT-${invoice.id}` : (invoice.invoice_id || "N/A");
  doc.text(idValue, 150.0, 14.7);

  // Date
  doc.setFont("helvetica", "normal");
  doc.text(formatDateYYYYMMDD(invoice.date), 150.0, 19.7);

  // P.O. Number (Invoices only)
  if (!isQuotation) {
    doc.text(invoice.po_number || "N/A", 150.0, 24.6);
  }

  // 2. Client & Delivery Info
  const clientName = invoice.client_name || invoice.user_email || invoice.email || "Client Name N/A";
  const clientEmail = invoice.user_email || invoice.email || "";

  // Billed To Column (Left)
  let billY = 50.0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(clientName, 17.0, billY);
  billY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (clientEmail && clientEmail !== clientName) {
    doc.text(clientEmail, 17.0, billY);
    billY += 4.0;
  }
  if (invoice.billing_address) {
    const addressLines: string[] = doc.splitTextToSize(invoice.billing_address, 65);
    addressLines.forEach(line => {
      doc.text(line, 17.0, billY);
      billY += 3.8;
    });
  }

  // Shipped To Column (Right)
  let shipY = 50.0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(clientName, 87.0, shipY);
  shipY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (invoice.billing_address) {
    const addressLines: string[] = doc.splitTextToSize(invoice.billing_address, 65);
    addressLines.forEach(line => {
      doc.text(line, 87.0, shipY);
      shipY += 3.8;
    });
  } else {
    doc.text("Same as Billing", 87.0, shipY);
  }

  // 3. Table Rows
  let yPos = 118.0;
  const items = invoice.items || [];
  const currencyLabel = invoice.currency === "LKR" ? "Rs." : (invoice.currency || "LKR");

  items.forEach((item: any, idx: number) => {
    // If we are about to overflow, insert a page break
    if (yPos > 195.0) {
      doc.addPage();
      drawPageBackground();
      yPos = 118.0;
    }

    const desc = item.description || "Untitled Item";
    const price = parseFloat(item.price || item.rate || 0);
    const qty = parseFloat(item.quantity || 1);
    const total = parseFloat(item.total || price * qty);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    // Handle long descriptions by splitting them and wrapping lines
    const descLines: string[] = doc.splitTextToSize(desc, 90);
    const itemHeight = descLines.length * 4.2;

    if (yPos + itemHeight > 198.0) {
      doc.addPage();
      drawPageBackground();
      yPos = 118.0;
    }

    // Draw description lines
    descLines.forEach((line, lineIdx) => {
      doc.text(line, 18.4, yPos + (lineIdx * 4.2));
    });

    const priceStr = `${currencyLabel} ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const qtyStr = qty.toString();
    const totalStr = `${currencyLabel} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    doc.text(priceStr, 134.0, yPos, { align: "right" });
    doc.text(qtyStr, 155.0, yPos, { align: "right" });
    doc.text(totalStr, 185.0, yPos, { align: "right" });

    yPos += Math.max(itemHeight, 7.0);
  });

  // 4. Summary & Calculations (On Last Page)
  if (yPos > 195.0) {
    doc.addPage();
    drawPageBackground();
    yPos = 118.0;
  }

  const subtotal = parseFloat(invoice.subtotal != null ? invoice.subtotal : invoice.amount || 0);
  const discount = parseFloat(invoice.discount || 0);
  const advance = parseFloat(invoice.advance || 0);
  const total = parseFloat(invoice.total != null ? invoice.total : subtotal - discount);
  const totalDue = parseFloat(invoice.total_due != null ? invoice.total_due : total - advance);

  // Subtotal value overlay
  const subtotalStr = `${currencyLabel} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(subtotalStr, 185.0, 203.0, { align: "right" });

  // Optional Discount and Advance Paid overlays in the space
  let summaryY = 207.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (discount > 0) {
    doc.text("Discount:", 123.3, summaryY);
    const discountStr = `-${currencyLabel} ${discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    doc.text(discountStr, 185.0, summaryY, { align: "right" });
    summaryY += 4.2;
  }
  if (advance > 0) {
    if (isQuotation) {
        doc.text("Advance:", 123.3, summaryY);
    } else {
        doc.text("Advance Paid:", 123.3, summaryY);
    }
    const advanceStr = `-${currencyLabel} ${advance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    doc.text(advanceStr, 185.0, summaryY, { align: "right" });
    summaryY += 4.2;
  }

  // Cover the pre-printed total due/invoice total label and value area
  doc.setFillColor(255, 255, 255);
  doc.rect(120.0, 212.0, 70.0, 10.0, "F");

  // Print the correct total label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(40, 40, 40);
  const totalLabel = isQuotation ? "TOTAL" : "TOTAL";
  doc.text(totalLabel, 123.3, 220.0);

  // Print the grand total value
  const totalStr = `${currencyLabel} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(193, 30, 47); // Accent red color
  doc.text(totalStr, 185.0, 220.0, { align: "right" });

  // 5. Due Date Calculation & Overlay
  const invDate = invoice.date ? new Date(invoice.date) : new Date();
  const dueDate = new Date(invDate);
  dueDate.setDate(invDate.getDate() + 14);
  const dueDateStr = formatDateYYYYMMDD(dueDate.toISOString());

  // Mask pre-printed sample due date with a white rectangle
  doc.setFillColor(255, 255, 255);
  doc.rect(30.0, 205.5, 24.0, 4.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text(dueDateStr, 30.8, 209.0);



  // 7. PAID Stamp Overlay (Invoices only)
  if (!isQuotation && paidStampData) {
    doc.addImage(paidStampData, "PNG", 82.0, 195.0, 35.0, 35.0, undefined, "FAST");
  }

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
