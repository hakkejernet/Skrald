// Genererer én kompakt PDF pr. CSV-fil - flere stop pr. side, ingen tabeller
// (bare tætpakket tekst), så en hel dags rute fylder få sider.

function buildStopsPDF(stops, sourceName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const marginTop = 14;
  const marginBottom = 12;
  const contentWidth = pageWidth - marginX * 2;

  const nameSize = 11;
  const addrSize = 10;
  const nameLineHeight = 4.6;
  const addrLineHeight = 4.2;
  const stopGap = 3;

  let y = marginTop;

  stops.forEach((stop, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameSize);
    const nameText = `${i + 1}. ${stop.name || '(intet navn)'}`;
    const nameLines = doc.splitTextToSize(nameText, contentWidth);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(addrSize);
    const addrText = [stop.street, stop.cityLine].filter(Boolean).join(', ') || ' ';
    const addrLines = doc.splitTextToSize(addrText, contentWidth);

    const blockHeight = nameLines.length * nameLineHeight + addrLines.length * addrLineHeight;

    if (y + blockHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameSize);
    nameLines.forEach((line) => {
      doc.text(line, marginX, y);
      y += nameLineHeight;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(addrSize);
    addrLines.forEach((line) => {
      doc.text(line, marginX, y);
      y += addrLineHeight;
    });

    if (i < stops.length - 1) {
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.15);
      doc.line(marginX, y + stopGap / 2, pageWidth - marginX, y + stopGap / 2);
    }

    y += stopGap;
  });

  const filename = (sourceName || 'ruteliste').replace(/\.csv$/i, '') + '.pdf';
  doc.save(filename);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildStopsPDF };
}
