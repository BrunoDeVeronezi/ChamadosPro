import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReceiptData {
  company: {
    name: string;
    // logoUrl?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    phone?: string | null;
    address?: string;
  };
  client: {
    name: string;
    document?: string | null;
  };
  ticket: {
    id: string;
    serviceName: string;
    serviceItems?: Array<{ name: string; amount: number }>;
    date: string;
    amount: number;
    discount?: number;
    kmTotal?: number;
    kmRate?: number;
    extraExpenses?: number;
    description?: string;
    warranty?: string | null;
  };
  pix?: {
    key: string;
    payload: string;
    qrCodeDataUrl?: string;
    accountHolder?: string;
  };
}

export const generateReceiptPDF = async (data: ReceiptData) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  const finalAmountRaw = Number(data.ticket.amount);
  const finalAmount = Number.isFinite(finalAmountRaw) ? finalAmountRaw : 0;
  const discountRaw = Number(data.ticket.discount ?? 0);
  const discountAmount =
    Number.isFinite(discountRaw) && discountRaw > 0 ? discountRaw : 0;
  const originalAmount = finalAmount + discountAmount;

  // Header background
  doc.setFillColor(245, 247, 248);
  doc.rect(0, 0, 210, 40, 'F');

  // Logo
  if (data.company.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = data.company.logoUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', margin, 10, 20, 20);
    } catch (e) {
      console.warn('Could not load company logo for receipt', e);
    }
  }

  // Company Name
  doc.setFontSize(18);
  doc.setTextColor(56, 128, 245);
  doc.setFont('helvetica', 'bold');
  doc.text(data.company.name.toUpperCase(), data.company.logoUrl ? 45 : margin, 20);

  // Receipt Title
  doc.setFontSize(22);
  doc.setTextColor(17, 20, 24);
  doc.text('RECIBO DE PAGAMENTO', 105, 55, { align: 'center' });

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, 65, 190, 65);

  y = 80;

  // Amount
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Valor:', margin, y);
  doc.setFont('helvetica', 'bold');
  if (discountAmount > 0) {
    const originalStr = formatCurrency(originalAmount);
    doc.setTextColor(107, 114, 128);
    doc.text(originalStr, 60, y);
    const originalWidth = doc.getTextWidth(originalStr);
    doc.setDrawColor(107, 114, 128);
    doc.line(60, y - 2, 60 + originalWidth, y - 2);
    doc.setFontSize(9);
    doc.text('Desconto', 60 + originalWidth + 4, y);
    y += 7;
    doc.setFontSize(14);
    doc.setTextColor(17, 20, 24);
    doc.text(formatCurrency(finalAmount), 60, y);
  } else {
    doc.setTextColor(17, 20, 24);
    doc.text(formatCurrency(finalAmount), 60, y);
  }

  y += 10;

  // Received From
  doc.setFont('helvetica', 'normal');
  doc.text('Recebemos de:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.client.name, 60, y);

  y += 10;

  // Reference
  const rawServiceItems = Array.isArray(data.ticket.serviceItems)
    ? data.ticket.serviceItems
    : [];
  const kmTotal = Number(data.ticket.kmTotal ?? 0);
  const kmRate = Number(data.ticket.kmRate ?? 0);
  const extraExpenses = Number(data.ticket.extraExpenses ?? 0);
  const kmValue = kmTotal * kmRate;
  const hasKmItem = rawServiceItems.some((item) => {
    const name = String(item.name || '').toLowerCase();
    return name.includes('km') || name.includes('desloc');
  });
  const hasExtraItem = rawServiceItems.some((item) => {
    const name = String(item.name || '').toLowerCase();
    return (
      name.includes('adicional') || name.includes('despesa') || name.includes('extra')
    );
  });
  const extraServiceItems: Array<{ name: string; amount: number }> = [];
  if (kmValue > 0 && !hasKmItem) {
    extraServiceItems.push({
      name: `Deslocamento (${kmTotal} km x ${formatCurrency(kmRate)})`,
      amount: kmValue,
    });
  }
  if (extraExpenses > 0 && !hasExtraItem) {
    extraServiceItems.push({ name: 'Custo adicional', amount: extraExpenses });
  }
  const serviceItems = [...rawServiceItems, ...extraServiceItems];
  const hasServiceItems = serviceItems.length > 0;

  doc.setFont('helvetica', 'normal');
  doc.text('Referente a:', margin, y);

  if (hasServiceItems) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    serviceItems.forEach((item, index) => {
      const name = item.name || `Servico ${index + 1}`;
      const rawAmount =
        typeof item.amount === 'number' ? item.amount : Number(item.amount);
      const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
      const nameLines = doc.splitTextToSize(name, 120);
      doc.text(nameLines, margin + 2, y);
      doc.text(formatCurrency(amount), 190, y, { align: 'right' });
      y += nameLines.length * 5 + 2;
    });
    y += 3;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(data.ticket.serviceName, 60, y);
    y += 15;
  }

  // Description
  if (data.ticket.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitDesc = doc.splitTextToSize(`Descrição: ${data.ticket.description}`, 170);
    doc.text(splitDesc, margin, y);
    y += splitDesc.length * 5 + 5;
  }

  // Warranty
  if (data.ticket.warranty) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`GARANTIA: ${data.ticket.warranty}`, margin, y);
    y += 10;
    doc.setTextColor(107, 114, 128); // Reset color
  }

  // Date and ID
  y = Math.max(y, 130);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  const formattedDate = format(new Date(data.ticket.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Data do serviço: ${formattedDate}`, margin, y);
  doc.text(`ID do chamado: ${data.ticket.id}`, 190, y, { align: 'right' });

  y += 10;

  if (data.pix?.key) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 20, 24);
    doc.text('Pagamento via PIX', margin, y);
    y += 6;

    if (data.pix.qrCodeDataUrl) {
      doc.addImage(data.pix.qrCodeDataUrl, 'PNG', margin, y, 40, 40);
    } else {
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('[QR Code indisponivel]', margin, y + 10);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    const detailsX = margin + 48;
    let detailsY = y + 6;
    if (data.pix.accountHolder) {
      doc.text(`Recebedor: ${data.pix.accountHolder}`, detailsX, detailsY);
      detailsY += 5;
    }
    doc.text(`Chave PIX: ${data.pix.key}`, detailsX, detailsY);
    detailsY += 5;
    doc.setTextColor(107, 114, 128);
    doc.text('Copia e cola:', detailsX, detailsY);
    detailsY += 5;
    doc.setFontSize(8);
    const payloadLines = doc.splitTextToSize(data.pix.payload, 120);
    doc.text(payloadLines, detailsX, detailsY);

    y += 50;
  }

  y += 20;

  // Signature line
  doc.setDrawColor(0, 0, 0);
  doc.line(55, y, 155, y);
  y += 5;
  doc.setFontSize(12);
  doc.setTextColor(17, 20, 24);
  doc.text(data.company.name, 105, y, { align: 'center' });
  
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  const companyDoc = data.company.cnpj || data.company.cpf || '';
  if (companyDoc) doc.text(companyDoc, 105, y, { align: 'center' });

  // Footer / Company Details
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  const footerY = 280;
  const companyInfo = [
    data.company.address,
    data.company.phone ? `Telefone: ${data.company.phone}` : '',
  ].filter(Boolean).join(' | ');
  doc.text(companyInfo, 105, footerY, { align: 'center' });

  // Save the PDF
  doc.save(`recibo-${data.ticket.id}.pdf`);
};
