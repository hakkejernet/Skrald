// Genererer én stor-format PDF pr. CSV-fil - ét stop pr. side, ingen tabeller,
// kun kundenavn / vej+husnr / postnr+by med rigelig luft mellem hvert stop.

function buildStopsPDF(stops, sourceName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  stops.forEach((stop, i) => {
    if (i > 0) doc.addPage();

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Stop ${i + 1} af ${stops.length}`, centerX, 18, { align: 'center' });

    const centerY = pageHeight / 2;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.text(stop.name || ' ', centerX, centerY - 40, { align: 'center', maxWidth: pageWidth - 30 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(30);
    doc.text(stop.street || ' ', centerX, centerY + 10, { align: 'center', maxWidth: pageWidth - 30 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(stop.cityLine || ' ', centerX, centerY + 55, { align: 'center', maxWidth: pageWidth - 30 });
  });

  const filename = (sourceName || 'ruteliste').replace(/\.csv$/i, '') + '.pdf';
  doc.save(filename);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildStopsPDF };
}
