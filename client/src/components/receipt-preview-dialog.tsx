import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Mail, 
  Share2, 
  Download, 
  Image,
  Loader2, 
  CheckCircle2,
  MoreHorizontal,
  MessageCircle,
  Printer,
  Building2
} from 'lucide-react';
import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { coerceServiceItems } from '@/utils/service-items';
import { maskCurrency, unmaskCurrency } from '@/lib/masks';
import QRCode from 'qrcode';
import { buildPixPayload } from '@shared/pix';

interface ReceiptData {
  company: {
    name: string;
    // logoUrl?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    phone?: string | null;
    address?: string;
    city?: string;
  };
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
  };
  ticket: {
    id: string;
    serviceName: string;
    serviceItems?: Array<{ name: string; amount: number }>;
    date: string;
    amount: number;
    discount?: number;
    kmChargeExempt?: boolean;
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

interface ReceiptPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData;
  autoShare?: 'whatsapp' | 'share' | null;
  shareMessage?: string;
  whatsappPhone?: string;
}

const normalizeTicketDate = (value?: string) => {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

const formatDateInputValue = (value?: string) => {
  if (!value) {
    return '';
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return format(parsed, 'yyyy-MM-dd');
};

export function ReceiptPreviewDialog({
  isOpen,
  onClose,
  data,
  autoShare = null,
  shareMessage,
  whatsappPhone,
}: ReceiptPreviewDialogProps) {
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const { data: integrationSettings, isLoading: isIntegrationLoading } =
    useQuery<{ pixKey?: string | null; pixAccountHolder?: string | null }>({
      queryKey: ['/api/integration-settings'],
      enabled: isOpen,
    });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);
  const [isSharingWhatsAppWeb, setIsSharingWhatsAppWeb] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const autoShareTriggeredRef = useRef(false);
  const [editableData, setEditableData] = useState<ReceiptData>(() => ({
    ...data,
    ticket: {
      ...data.ticket,
      date: normalizeTicketDate(data.ticket.date),
    },
  }));
  const receiptRef = useRef<HTMLDivElement | null>(null);

  // Sync state when data prop changes
  useEffect(() => {
    if (isOpen) {
      setEditableData({
        ...data,
        ticket: {
          ...data.ticket,
          date: normalizeTicketDate(data.ticket.date),
        },
      });
    }
  }, [isOpen, data]);

  const normalizedServiceItems = coerceServiceItems(
    editableData.ticket.serviceItems
  );
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  const numberToCurrencyString = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return Math.round(value * 100).toString();
  };
  const parseCurrencyValue = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      return parseFloat(unmaskCurrency(value)) || 0;
    }
    return 0;
  };
  const amountValue = parseCurrencyValue(editableData.ticket.amount);
  const discountValue = Math.max(
    0,
    parseCurrencyValue(editableData.ticket.discount)
  );
  const originalAmount = amountValue;
  const finalAmount = Math.max(0, amountValue - discountValue);
  const hasDiscount = discountValue > 0;
  const kmTotal = Number(editableData.ticket.kmTotal ?? 0);
  const kmRate = Number(editableData.ticket.kmRate ?? 0);
  const extraExpenses = Number(editableData.ticket.extraExpenses ?? 0);
  const isKmChargeExempt = Boolean(editableData.ticket.kmChargeExempt);
  const kmValue = kmTotal * kmRate;
  const hasKmItem = normalizedServiceItems.some((item) => {
    const name = String(item.name || '').toLowerCase();
    return name.includes('km') || name.includes('desloc');
  });
  const hasExtraItem = normalizedServiceItems.some((item) => {
    const name = String(item.name || '').toLowerCase();
    return (
      name.includes('adicional') ||
      name.includes('despesa') ||
      name.includes('extra')
    );
  });
  const extraServiceItems: Array<{ name: string; amount: number }> = [];
  if (kmValue > 0 && !hasKmItem && !isKmChargeExempt) {
    extraServiceItems.push({
      name: `Deslocamento (${kmTotal} km x ${formatCurrency(kmRate)})`,
      amount: kmValue,
    });
  }
  if (extraExpenses > 0 && !hasExtraItem) {
    extraServiceItems.push({
      name: 'Custo adicional',
      amount: extraExpenses,
    });
  }
  const displayServiceItems = [
    ...normalizedServiceItems,
    ...extraServiceItems,
  ];

  const normalizePhone = (value?: string | null) =>
    (value || '').replace(/\D/g, '');

  useEffect(() => {
    if (!isOpen) {
      autoShareTriggeredRef.current = false;
      return;
    }

    const pixKey = (integrationSettings?.pixKey || '').trim();
    if (!pixKey) {
      return;
    }

    let cancelled = false;
    const amountToCharge = Math.max(0, finalAmount);
    const merchantName =
      integrationSettings?.pixAccountHolder?.trim() ||
      editableData.company.name ||
      'RECEBEDOR';
    const merchantCity = editableData.company.city || 'BRASIL';
    const ticketId = editableData.ticket.id || '';
    const txidBase = `RECIBO${ticketId.replace(/[^A-Za-z0-9]/g, '')}`;
    const pixPayload = buildPixPayload({
      pixKey,
      amount: amountToCharge > 0 ? amountToCharge : undefined,
      merchantName,
      merchantCity,
      txid: txidBase.slice(0, 25),
      description: `Recibo ${ticketId.slice(0, 8) || 'sem-id'}`,
    });

    if (
      editableData.pix?.key === pixKey &&
      editableData.pix?.payload === pixPayload &&
      editableData.pix?.qrCodeDataUrl
    ) {
      return;
    }

    QRCode.toDataURL(pixPayload, { width: 220, margin: 1 })
      .then((qrCodeDataUrl) => {
        if (cancelled) return;
        setEditableData((prev) => {
          if (
            prev.pix?.key === pixKey &&
            prev.pix?.payload === pixPayload &&
            prev.pix?.qrCodeDataUrl === qrCodeDataUrl &&
            prev.pix?.accountHolder === merchantName
          ) {
            return prev;
          }
          return {
            ...prev,
            pix: {
              key: pixKey,
              payload: pixPayload,
              qrCodeDataUrl,
              accountHolder: merchantName,
            },
          };
        });
      })
      .catch((error) => {
        console.warn('Erro ao gerar QR Code PIX:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    integrationSettings?.pixKey,
    integrationSettings?.pixAccountHolder,
    editableData.company.city,
    editableData.company.name,
    editableData.ticket.id,
    finalAmount,
    editableData.pix?.key,
    editableData.pix?.payload,
    editableData.pix?.qrCodeDataUrl,
  ]);

  const captureReceiptImage = async (options?: { forceLight?: boolean }) => {
    if (!receiptRef.current) {
      throw new Error('receipt-preview-not-found');
    }

    const { default: html2canvas } = await import('html2canvas');
    const forceLight = options?.forceLight === true;
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      useCORS: true,
      // logging: false,
      backgroundColor: '#ffffff',
      ...(forceLight
        ? {
            onclone: (clonedDocument: Document) => {
              clonedDocument.documentElement.classList.remove('dark');
              if (clonedDocument.body) {
                clonedDocument.body.classList.remove('dark');
              }
              clonedDocument.documentElement.style.colorScheme = 'light';
            },
          }
        : {}),
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!blob) {
      throw new Error('receipt-image-blob');
    }

    return blob;
  };

  const saveReceiptImage = (blob: Blob, fileName: string) => {
    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(imageUrl);
  };

  const handleDownloadPDF = async () => {
    if (
      !requirePaid({
        feature: 'Geracao de PDF',
        description: 'Geracao de PDF esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }
    try {
      await generateReceiptPDF(editableData);
      toast({
        title: 'Sucesso',
        description: 'PDF do recibo gerado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível gerar o PDF do recibo.',
      });
    }
  };

  const handlePrintReceipt = async () => {
    if (isPrintingReceipt) {
      return;
    }

    setIsPrintingReceipt(true);
    try {
      const blob = await captureReceiptImage({ forceLight: true });
      const imageUrl = URL.createObjectURL(blob);
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        URL.revokeObjectURL(imageUrl);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Permita pop-ups para imprimir o recibo.',
        });
        return;
      }

      const cleanup = () => {
        URL.revokeObjectURL(imageUrl);
        printWindow.removeEventListener('afterprint', cleanup);
        printWindow.removeEventListener('beforeunload', cleanup);
      };

      printWindow.addEventListener('afterprint', cleanup);
      printWindow.addEventListener('beforeunload', cleanup);

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Recibo</title>
    <style>
      html, body { margin: 0; padding: 0; }
      body { display: flex; justify-content: center; padding: 24px; }
      img { max-width: 100%; height: auto; }
      @page { margin: 12mm; }
    </style>
  </head>
  <body>
    <img src="${imageUrl}" alt="Recibo" />
    <script>
      const img = document.querySelector('img');
      img.onload = () => { window.focus(); window.print(); };
      window.onafterprint = () => { window.close(); };
    </script>
  </body>
</html>`);
      printWindow.document.close();
    } catch (error) {
      console.error('Erro ao imprimir recibo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel preparar a impressao do recibo.',
      });
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const handleShareReceipt = async () => {
    if (
      !requirePaid({
        feature: 'Compartilhamento de recibo',
        description: 'Compartilhamento de recibos esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }

    if (isSharingReceipt) {
      return;
    }

    const fileName = `recibo-${editableData.ticket.id}.png`;
    const shareText = shareMessage?.trim();

    setIsSharingReceipt(true);
    try {
      const blob = await captureReceiptImage();
      const file = new File([blob], fileName, { type: 'image/png' });
      const shareData: ShareData = {
        files: [file],
        ...(shareText ? { text: shareText, title: 'Recibo' } : {}),
      };

      const navigatorAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };

      const canShare =
        typeof navigatorAny.share === 'function' &&
        (typeof navigatorAny.canShare === 'function'
          ? navigatorAny.canShare(shareData)
          : true);

      if (canShare && navigatorAny.share) {
        try {
          await navigatorAny.share(shareData);
          toast({
            title: 'Sucesso',
            description: 'Recibo compartilhado como imagem.',
          });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        }
      }

      saveReceiptImage(blob, fileName);

      toast({
        title: 'Imagem salva',
        description: 'Arquivo do recibo gerado. Abra o WhatsApp e anexe a imagem.',
      });
    } catch (error) {
      console.error('Erro ao compartilhar recibo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel gerar a imagem do recibo.',
      });
    } finally {
      setIsSharingReceipt(false);
    }
  };

  const handleShareWhatsAppWeb = async () => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }

    if (isSharingWhatsAppWeb) {
      return;
    }

    const fileName = `recibo-${editableData.ticket.id}.png`;
    const shareText = shareMessage?.trim();
    const normalizedPhone = normalizePhone(
      whatsappPhone || editableData.client.phone
    );
    const whatsappUrl = normalizedPhone
      ? `https://wa.me/55${normalizedPhone}${
          shareText ? `?text=${encodeURIComponent(shareText)}` : ''
        }`
      : shareText
        ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
        : 'https://web.whatsapp.com/';

    setIsSharingWhatsAppWeb(true);
    try {
      const blob = await captureReceiptImage();

      if (navigator.clipboard && 'ClipboardItem' in window) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          window.open(whatsappUrl, '_blank');
          toast({
            title: 'Imagem copiada',
            description: 'Abra o WhatsApp Web e cole com Ctrl+V.',
          });
          return;
        } catch (error) {
          console.warn('Falha ao copiar imagem:', error);
        }
      }

      saveReceiptImage(blob, fileName);
      window.open(whatsappUrl, '_blank');
      toast({
        title: 'Imagem salva',
        description: 'Arquivo do recibo gerado. No WhatsApp Web, anexe a imagem.',
      });
    } catch (error) {
      console.error('Erro ao compartilhar no WhatsApp Web:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel gerar a imagem do recibo.',
      });
    } finally {
      setIsSharingWhatsAppWeb(false);
    }
  };

  const handleDownloadImage = async () => {
    if (
      !requirePaid({
        feature: 'Download de imagem do recibo',
        description: 'Download de imagem esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }

    if (isDownloadingImage) {
      return;
    }

    const fileName = `recibo-${editableData.ticket.id}.png`;

    setIsDownloadingImage(true);
    try {
      const blob = await captureReceiptImage();
      saveReceiptImage(blob, fileName);
      toast({
        title: 'Imagem salva',
        description: 'Recibo salvo no computador.',
      });
    } catch (error) {
      console.error('Erro ao salvar recibo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel salvar a imagem do recibo.',
      });
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleSendEmail = async () => {
    if (!editableData.client.email) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Cliente não possui email cadastrado.',
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${editableData.ticket.id}/send-receipt`,
        { 
          email: editableData.client.email,
          receiptData: editableData
        }
      );

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: `Recibo enviado para ${editableData.client.email}`,
        });
      } else {
        throw new Error('Falha ao enviar email');
      }
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível enviar o recibo por email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const updateTicketField = (field: keyof ReceiptData['ticket'], value: any) => {
    setEditableData(prev => ({
      ...prev,
      ticket: { ...prev.ticket, [field]: value }
    }));
  };

  const updateClientField = (field: keyof ReceiptData['client'], value: any) => {
    setEditableData(prev => ({
      ...prev,
      client: { ...prev.client, [field]: value }
    }));
  };

  useEffect(() => {
    if (!isOpen) {
      autoShareTriggeredRef.current = false;
      return;
    }

    if (!autoShare || autoShareTriggeredRef.current) {
      return;
    }

    const pixKey = (integrationSettings?.pixKey || '').trim();
    const shouldWaitForPix =
      isIntegrationLoading ||
      (pixKey && !editableData.pix?.qrCodeDataUrl);

    if (shouldWaitForPix) {
      return;
    }

    autoShareTriggeredRef.current = true;

    const triggerShare = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (autoShare === 'whatsapp') {
        const canNativeShare =
          typeof navigator !== 'undefined' &&
          typeof (navigator as Navigator).share === 'function';
        if (canNativeShare) {
          await handleShareReceipt();
        } else {
          await handleShareWhatsAppWeb();
        }
      } else if (autoShare === 'share') {
        await handleShareReceipt();
      }
    };

    triggerShare().catch((error) => {
      console.warn('Erro ao compartilhar automaticamente:', error);
    });
  }, [
    isOpen,
    autoShare,
    isIntegrationLoading,
    integrationSettings?.pixKey,
    editableData.pix?.qrCodeDataUrl,
    shareMessage,
    whatsappPhone,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='bg-white dark:bg-slate-900 border-none shadow-2xl overflow-hidden !p-0 !flex !flex-col !left-3 !right-3 !top-3 !bottom-[calc(4.5rem+env(safe-area-inset-bottom)+var(--keyboard-inset))] !translate-x-0 !translate-y-0 !w-auto !max-w-none sm:!left-1/2 sm:!right-auto sm:!top-1/2 sm:!bottom-auto sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!w-full sm:!max-w-3xl sm:!max-h-[90vh]'>
        <DialogHeader className='p-4 sm:p-6 bg-primary/5 border-b border-primary/10'>
          <DialogTitle className='text-lg sm:text-xl font-bold flex items-center gap-2'>
            <FileText className='w-5 h-5 text-primary' />
            Edição e Visualização do Recibo
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Edite e visualize o recibo antes de compartilhar.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 min-h-0 p-4 sm:p-8 overflow-y-auto overflow-x-hidden space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 mb-4'>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome do Cliente</label>
              <Input 
                value={editableData.client.name} 
                onChange={(e) => updateClientField('name', e.target.value)}
                className="h-9 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Valor (R$)</label>
              <Input 
                type="number"
                value={amountValue}
                onChange={(e) => {
                  const nextValue = Number(e.target.value);
                  updateTicketField(
                    'amount',
                    Number.isFinite(nextValue) ? nextValue : 0
                  );
                }}
                className="h-9 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Desconto (R$)</label>
              <Input
                type="text"
                value={maskCurrency(numberToCurrencyString(discountValue))}
                onChange={(e) => {
                  const masked = maskCurrency(e.target.value);
                  updateTicketField(
                    'discount',
                    Math.max(0, parseFloat(unmaskCurrency(masked)) || 0)
                  );
                }}
                className="h-9 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Serviço</label>
              <Input 
                value={editableData.ticket.serviceName} 
                onChange={(e) => updateTicketField('serviceName', e.target.value)}
                className="h-9 bg-white dark:bg-slate-900"
              />
            </div>
            {displayServiceItems.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Servicos realizados
                </label>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1">
                  {displayServiceItems.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200"
                    >
                      <span>{item.name || `Servico ${index + 1}`}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Descrição Adicional</label>
              <Textarea 
                value={editableData.ticket.description || ''} 
                onChange={(e) => updateTicketField('description', e.target.value)}
                className="bg-white dark:bg-slate-900 min-h-[60px]"
                placeholder="Ex: Detalhes do serviço prestado..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Garantia</label>
              <Input 
                value={editableData.ticket.warranty || ''} 
                onChange={(e) => updateTicketField('warranty', e.target.value)}
                className="h-9 bg-white dark:bg-slate-900"
                placeholder="Ex: 90 dias"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Email do Cliente</label>
              <Input 
                value={editableData.client.email || ''} 
                onChange={(e) => updateClientField('email', e.target.value)}
                className="h-9 bg-white dark:bg-slate-900"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Telefone do Cliente</label>
              <Input 
                value={editableData.client.phone || ''} 
                onChange={(e) => updateClientField('phone', e.target.value)}
                className="h-9 bg-white dark:bg-slate-900"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Data do Servico</label>
              <Input
                type="date"
                value={formatDateInputValue(editableData.ticket.date)}
                onChange={(e) => updateTicketField('date', normalizeTicketDate(e.target.value))}
                className="h-9 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="text-center">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Pré-visualização</span>
          </div>

          {/* Receipt Content Preview */}
          <div
            ref={receiptRef}
            className='mx-auto w-full max-w-2xl border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-8 space-y-6 sm:space-y-8 bg-white dark:bg-slate-900 shadow-sm relative'
          >
            <div className='flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between'>
              {editableData.company.logoUrl ? (
                <img src={editableData.company.logoUrl} alt='Logo' className='h-10 sm:h-12 object-contain' />
              ) : (
                <div className='w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center'>
                  <Building2 className='w-5 h-5 sm:w-6 sm:h-6 text-primary' />
                </div>
              )}
              <div className='text-center sm:text-right'>
                <h3 className='font-bold text-base sm:text-lg text-primary'>{editableData.company.name}</h3>
                <p className='text-[11px] sm:text-xs text-muted-foreground'>
                  {editableData.company.cnpj || editableData.company.cpf}
                </p>
              </div>
            </div>

            <div className='text-center space-y-2'>
              <h2 className='text-xl sm:text-2xl font-black tracking-tight'>RECIBO</h2>
              <p className='text-xs sm:text-sm text-muted-foreground font-medium'>
                Nº {editableData.ticket.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <div className='space-y-6 text-sm leading-relaxed'>
              <p>
                Recebemos de <span className='font-bold text-slate-900 dark:text-white'>{editableData.client.name}</span>
                {editableData.client.document && ` (${editableData.client.document})`}, a importância de{' '}
                {hasDiscount ? (
                  <span className='inline-flex flex-col items-start gap-0.5'>
                    <span className='text-[10px] uppercase tracking-wider text-muted-foreground'>Desconto</span>
                    <span className='line-through text-slate-400'>{formatCurrency(originalAmount)}</span>
                    <span className='font-bold text-primary text-lg'>{formatCurrency(finalAmount)}</span>
                  </span>
                ) : (
                  <span className='font-bold text-primary text-lg'>
                    {formatCurrency(finalAmount)}
                  </span>
                )}
                .
              </p>

              <div className='bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800'>
                <p className='font-medium text-slate-500 mb-1 uppercase text-[10px] tracking-wider'>Referente a:</p>
                {displayServiceItems.length > 0 ? (
                  <div className='space-y-2'>
                    {displayServiceItems.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className='flex flex-wrap items-start justify-between gap-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white'
                      >
                        <span className='min-w-0 flex-1 break-words'>
                          {item.name || `Servico ${index + 1}`}
                        </span>
                        <span className='shrink-0'>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className='flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm font-bold text-slate-900 dark:text-white'>
                      <span>Total</span>
                      <span>{formatCurrency(finalAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <p className='font-bold text-slate-900 dark:text-white'>
                    {editableData.ticket.serviceName}
                  </p>
                )}
                {editableData.ticket.description && (
                  <p className='text-xs text-muted-foreground mt-2 italic'>"{editableData.ticket.description}"</p>
                )}
              </div>

              {editableData.pix?.key && (
                <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4'>
                  {editableData.pix.qrCodeDataUrl ? (
                    <img
                      src={editableData.pix.qrCodeDataUrl}
                      alt='QR Code PIX'
                      className='h-24 w-24 sm:h-32 sm:w-32 object-contain'
                    />
                  ) : (
                    <div className='h-24 w-24 sm:h-32 sm:w-32 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500'>
                      QR Code
                    </div>
                  )}
                  <div className='flex-1 min-w-0 space-y-2 text-[11px] sm:text-xs text-slate-700 dark:text-slate-200'>
                    <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400'>
                      Pagamento via PIX
                    </p>
                    {editableData.pix.accountHolder && (
                      <p>
                        <span className='font-semibold'>Recebedor:</span>{' '}
                        {editableData.pix.accountHolder}
                      </p>
                    )}
                    <p>
                      <span className='font-semibold'>Chave:</span>{' '}
                      {editableData.pix.key}
                    </p>
                    <p className='text-[10px] uppercase tracking-[0.2em] text-slate-400'>
                      Copia e cola
                    </p>
                    <p className='font-mono text-[10px] break-all'>
                      {editableData.pix.payload}
                    </p>
                  </div>
                </div>
              )}

              {editableData.ticket.warranty && (
                <div className='flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 p-2.5 sm:p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50'>
                  <CheckCircle2 className='w-4 h-4' />
                  <p className='text-[11px] sm:text-xs'>GARANTIA: {editableData.ticket.warranty}</p>
                </div>
              )}

              <p className='text-right text-muted-foreground'>
                {editableData.company.city || 'Brasil'}, {format(new Date(editableData.ticket.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            <div className='pt-6 sm:pt-10 flex flex-col items-center gap-2'>
              <div className='w-36 sm:w-48 h-[1px] bg-slate-200 dark:bg-slate-700' />
              <p className='text-xs font-bold uppercase tracking-widest'>{editableData.company.name}</p>
            </div>
          </div>
        </div>

        <DialogFooter className='p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 gap-2 !flex-col sm:!flex-row sm:flex-wrap sm:justify-end'>
          <div className='flex w-full items-center gap-2 sm:hidden'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  className='flex-1 rounded-xl border-slate-200'
                >
                  <MoreHorizontal className='w-4 h-4 mr-2 text-slate-500' />
                  Opcoes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                <DropdownMenuItem
                  onClick={handlePrintReceipt}
                  disabled={isPrintingReceipt}
                >
                  {isPrintingReceipt ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
                  ) : (
                    <Printer className='w-4 h-4 mr-2 text-slate-500' />
                  )}
                  Imprimir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <Download className='w-4 h-4 mr-2 text-slate-500' />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDownloadImage}
                  disabled={isDownloadingImage}
                >
                  {isDownloadingImage ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
                  ) : (
                    <Image className='w-4 h-4 mr-2 text-slate-500' />
                  )}
                  Imagem
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !editableData.client.email}
                >
                  {isSendingEmail ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
                  ) : (
                    <Mail className='w-4 h-4 mr-2 text-slate-500' />
                  )}
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleShareWhatsAppWeb}
                  disabled={isSharingWhatsAppWeb}
                >
                  {isSharingWhatsAppWeb ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin text-emerald-600' />
                  ) : (
                    <MessageCircle className='w-4 h-4 mr-2 text-emerald-600' />
                  )}
                  WhatsApp Web
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className='flex-1 rounded-xl shadow-lg shadow-primary/20'
              onClick={handleShareReceipt}
              disabled={isSharingReceipt}
            >
              {isSharingReceipt ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : (
                <Share2 className='w-4 h-4 mr-2' />
              )}
              Compartilhar
            </Button>
          </div>

          <div className='hidden w-full flex-wrap gap-2 sm:flex sm:justify-end'>
            <Button
              variant='outline'
              onClick={handlePrintReceipt}
              disabled={isPrintingReceipt}
              className='rounded-xl border-slate-200'
            >
              {isPrintingReceipt ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
              ) : (
                <Printer className='w-4 h-4 mr-2 text-slate-500' />
              )}
              Imprimir
            </Button>
            <Button
              variant='outline'
              onClick={handleDownloadPDF}
              className='rounded-xl border-slate-200'
            >
              <Download className='w-4 h-4 mr-2 text-slate-500' />
              PDF
            </Button>
            <Button
              variant='outline'
              onClick={handleDownloadImage}
              disabled={isDownloadingImage}
              className='rounded-xl border-slate-200'
            >
              {isDownloadingImage ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
              ) : (
                <Image className='w-4 h-4 mr-2 text-slate-500' />
              )}
              Imagem
            </Button>
            <Button
              variant='outline'
              onClick={handleSendEmail}
              disabled={isSendingEmail || !editableData.client.email}
              className='rounded-xl border-slate-200'
            >
              {isSendingEmail ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin text-slate-500' />
              ) : (
                <Mail className='w-4 h-4 mr-2 text-slate-500' />
              )}
              Email
            </Button>
            <Button
              variant='outline'
              onClick={handleShareWhatsAppWeb}
              disabled={isSharingWhatsAppWeb}
              className='rounded-xl border-emerald-200 text-emerald-700 hover:text-emerald-800'
            >
              {isSharingWhatsAppWeb ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin text-emerald-600' />
              ) : (
                <MessageCircle className='w-4 h-4 mr-2 text-emerald-600' />
              )}
              WhatsApp Web
            </Button>
            <Button
              className='rounded-xl shadow-lg shadow-primary/20'
              onClick={handleShareReceipt}
              disabled={isSharingReceipt}
            >
              {isSharingReceipt ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : (
                <Share2 className='w-4 h-4 mr-2' />
              )}
              Compartilhar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
