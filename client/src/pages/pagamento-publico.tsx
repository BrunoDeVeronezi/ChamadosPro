import { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/masks';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, Share2 } from 'lucide-react';

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

type PublicPaymentInfo = {
  ticketRef?: string | null;
  amount: number;
  dueDate?: string | null;
  description?: string | null;
  recordStatus?: string | null;
  client?: {
    name?: string | null;
    email?: string | null;
    document?: string | null;
    phone?: string | null;
  };
  company?: {
    name?: string | null;
    logoUrl?: string | null;
  };
  mercadoPago?: {
    connected: boolean;
    status?: string | null;
    publicKey?: string | null;
  };
};

const loadMercadoPagoSdk = () =>
  new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o Mercado Pago'));
    document.body.appendChild(script);
  });

export default function PagamentoPublico() {
  const { toast } = useToast();
  const [, params] = useRoute('/pagamento/:token');
  const token = params?.token || '';
  const brickControllerRef = useRef<any>(null);
  const payerEmailRef = useRef('');
  const payerDocumentRef = useRef('');
  const pixRequestKeyRef = useRef('');
  const [sdkReady, setSdkReady] = useState(false);
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocument, setPayerDocument] = useState('');
  const [brickError, setBrickError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'card'>('pix');
  const [pixResult, setPixResult] = useState<any>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isSharingPix, setIsSharingPix] = useState(false);

  const { data, isLoading } = useQuery<PublicPaymentInfo>({
    queryKey: ['/api/public/payment-links', token],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/public/payment-links/${token}`,
        undefined
      );
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    setPayerEmail(data.client?.email || '');
    setPayerDocument(data.client?.document || '');
  }, [data]);

  useEffect(() => {
    payerEmailRef.current = payerEmail;
  }, [payerEmail]);

  useEffect(() => {
    payerDocumentRef.current = payerDocument;
  }, [payerDocument]);

  useEffect(() => {
    if (!data?.mercadoPago?.connected || !data?.mercadoPago?.publicKey) return;
    if (selectedMethod !== 'card') return;
    loadMercadoPagoSdk()
      .then(() => setSdkReady(true))
      .catch((error) => {
        console.error(error);
        setBrickError('Nao foi possivel carregar o Mercado Pago.');
      });
  }, [
    data?.mercadoPago?.connected,
    data?.mercadoPago?.publicKey,
    selectedMethod,
  ]);

  useEffect(() => {
    if (
      !sdkReady ||
      !data?.mercadoPago?.publicKey ||
      !data?.mercadoPago?.connected
    ) {
      return;
    }
    if (data.recordStatus === 'paid') {
      return;
    }
    if (selectedMethod !== 'card') {
      return;
    }

    let isCancelled = false;
    const initBrick = async () => {
      if (brickControllerRef.current?.unmount) {
        await brickControllerRef.current.unmount();
      }
      setBrickError(null);
      const mp = new window.MercadoPago(data.mercadoPago.publicKey, {
        locale: 'pt-BR',
      });
      const bricksBuilder = mp.bricks();
      try {
        const controller = await bricksBuilder.create(
          'payment',
          'paymentBrick_container',
          {
            initialization: {
              amount: Number(data.amount || 0),
              payer: payerEmail ? { email: payerEmail } : undefined,
            },
            customization: {
              visual: {
                style: {
                  theme: 'default',
                },
              },
              paymentMethods: {
                creditCard: 'all',
                debitCard: 'all',
                bankTransfer: [],
              },
            },
            callbacks: {
              onReady: () => {},
              onSubmit: ({ formData }: { formData: any }) => {
                const currentEmail = payerEmailRef.current.trim();
                const currentDocument = payerDocumentRef.current.trim();
                if (!currentEmail || !currentDocument) {
                  setBrickError('Informe email e CPF/CNPJ para continuar.');
                  return Promise.reject();
                }
                setIsSubmitting(true);
                setBrickError(null);
                const normalizedFormData = {
                  ...(formData || {}),
                  email: currentEmail,
                  document: currentDocument,
                };
                return apiRequest(
                  'POST',
                  `/api/public/payment-links/${token}/mercadopago`,
                  { formData: normalizedFormData }
                )
                  .then((response) => response.json())
                  .then((responseData) => {
                    if (isCancelled) return;
                    if (responseData?.pixPayload || responseData?.qrCodeDataUrl) {
                      setPixResult(responseData);
                    }
                    if (
                      responseData?.status === 'approved' ||
                      responseData?.status === 'accredited'
                    ) {
                      toast({
                        title: 'Pagamento aprovado',
                        description: 'Obrigado! Seu pagamento foi confirmado.',
                      });
                    }
                    return responseData;
                  })
                  .catch((error: any) => {
                    if (isCancelled) return;
                    setBrickError(
                      error?.message || 'Nao foi possivel processar o pagamento.'
                    );
                    return Promise.reject(error);
                  })
                  .finally(() => {
                    if (!isCancelled) setIsSubmitting(false);
                  });
              },
              onError: (error: any) => {
                console.error('[Payment Brick] Error:', error);
                setBrickError(
                  'Nao foi possivel carregar o formulario de pagamento.'
                );
              },
            },
          }
        );

        if (isCancelled) {
          await controller.unmount();
          return;
        }
        brickControllerRef.current = controller;
      } catch (error) {
        console.error(error);
        setBrickError(
          'Nao foi possivel inicializar o pagamento. Tente novamente.'
        );
      }
    };

    initBrick();

    return () => {
      isCancelled = true;
      if (brickControllerRef.current?.unmount) {
        brickControllerRef.current.unmount();
      }
    };
  }, [
    sdkReady,
    data?.mercadoPago?.connected,
    data?.mercadoPago?.publicKey,
    data?.amount,
    data?.recordStatus,
    toast,
    token,
    selectedMethod,
  ]);

  useEffect(() => {
    if (selectedMethod !== 'pix') return;
    if (!data?.mercadoPago?.connected) return;
    if (data.recordStatus === 'paid') return;
    const currentEmail = payerEmailRef.current.trim();
    const rawDocument = payerDocumentRef.current.trim();
    const currentDocument = rawDocument.replace(/\D/g, '');
    if (!currentEmail || !currentEmail.includes('@')) return;
    if (![11, 14].includes(currentDocument.length)) return;
    if (isGeneratingPix) return;
    const requestKey = `${currentEmail}|${currentDocument}`;
    if (pixRequestKeyRef.current === requestKey && pixResult?.pixPayload) {
      return;
    }
    pixRequestKeyRef.current = requestKey;
    setIsGeneratingPix(true);
    setPixError(null);

    apiRequest(
      'POST',
      `/api/public/payment-links/${token}/mercadopago`,
      {
        formData: {
          payment_method_id: 'pix',
          email: currentEmail,
          document: currentDocument,
        },
      }
    )
      .then((response) => response.json())
      .then((responseData) => {
        setPixResult(responseData);
        if (responseData?.status === 'approved') {
          toast({
            title: 'Pagamento aprovado',
            description: 'Obrigado! Seu pagamento foi confirmado.',
          });
        }
      })
      .catch((error: any) => {
        pixRequestKeyRef.current = '';
        setPixError(error?.message || 'Nao foi possivel gerar o PIX.');
      })
      .finally(() => {
        setIsGeneratingPix(false);
      });
  }, [
    selectedMethod,
    data?.mercadoPago?.connected,
    data?.recordStatus,
    payerEmail,
    payerDocument,
    isGeneratingPix,
    pixResult?.pixPayload,
    toast,
    token,
  ]);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950'>
        <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
      </div>
    );
  }

  if (!data) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950'>
        <Card className='p-6 text-center'>
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            Link de pagamento invalido ou expirado.
          </p>
        </Card>
      </div>
    );
  }

  const alreadyPaid = data.recordStatus === 'paid';
  const showBrick = data.mercadoPago?.connected && !alreadyPaid;
  const pixPayload = pixResult?.pixPayload || '';
  const qrCodeDataUrl = pixResult?.qrCodeDataUrl || '';
  const hasPixResult = Boolean(pixPayload || qrCodeDataUrl);

  const copyPixPayload = async () => {
    if (!pixPayload) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(pixPayload);
      toast({
        title: 'PIX copiado',
        description: 'Cole o codigo no app do banco.',
      });
      return;
    }
    window.prompt('Copie o codigo PIX:', pixPayload);
  };

  const sharePixPayload = async () => {
    if (!pixPayload) return;
    if (!navigator.share) {
      await copyPixPayload();
      return;
    }
    setIsSharingPix(true);
    try {
      const shareData: ShareData = {
        title: 'Pagamento PIX',
        text: `PIX copia e cola:\n${pixPayload}`,
      };
      if (qrCodeDataUrl) {
        const response = await fetch(qrCodeDataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'pix-qrcode.png', {
          type: blob.type || 'image/png',
        });
        if (navigator.canShare?.({ files: [file] })) {
          shareData.files = [file];
        }
      }
      await navigator.share(shareData);
    } finally {
      setIsSharingPix(false);
    }
  };

  const sendPixByEmail = () => {
    const currentEmail = payerEmailRef.current.trim();
    if (!currentEmail) {
      toast({
        title: 'Email obrigatorio',
        description: 'Informe um email valido para enviar.',
      });
      return;
    }
    const subject = encodeURIComponent(
      `Pagamento PIX - ${data.company?.name || 'ChamadosPro'}`
    );
    const bodyLines = [
      `Ola, segue o PIX para pagamento.`,
      '',
      `Codigo copia e cola:`,
      pixPayload || '(ainda nao gerado)',
      '',
      `Link de pagamento: ${window.location.href}`,
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    window.location.href = `mailto:${currentEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10'>
      <div className='mx-auto max-w-2xl space-y-6'>
        <Card className='p-6 space-y-4'>
          <div className='flex items-center gap-4'>
            {data.company?.logoUrl ? (
              <img
                src={data.company.logoUrl}
                alt={data.company?.name || 'Empresa'}
                className='h-12 w-12 rounded-xl object-cover'
              />
            ) : (
              <div className='h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-semibold'>
                MP
              </div>
            )}
            <div>
              <p className='text-sm text-slate-500'>Cobranca</p>
              <h1 className='text-lg font-semibold text-slate-900 dark:text-slate-100'>
                {data.company?.name || 'ChamadosPro'}
              </h1>
              {data.ticketRef && (
                <p className='text-sm text-slate-500'>
                  Chamado {data.ticketRef}
                </p>
              )}
            </div>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='text-sm text-slate-500'>Valor</p>
              <p className='text-2xl font-bold text-slate-900 dark:text-white'>
                {formatCurrency(data.amount || 0)}
              </p>
            </div>
            {data.dueDate && (
              <div className='text-right'>
                <p className='text-sm text-slate-500'>Vencimento</p>
                <p className='text-sm font-medium text-slate-700 dark:text-slate-200'>
                  {data.dueDate}
                </p>
              </div>
            )}
          </div>
          {data.client?.name && (
            <p className='text-sm text-slate-600 dark:text-slate-300'>
              Cliente: {data.client.name}
            </p>
          )}
          {alreadyPaid && (
            <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'>
              Pagamento ja confirmado. Obrigado!
            </div>
          )}
          {!data.mercadoPago?.connected && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
              Este link ainda nao esta pronto para pagamento. Solicite ao
              emissor que conecte o Mercado Pago.
            </div>
          )}
        </Card>

        {showBrick && (
          <Card className='p-6 space-y-4 overflow-hidden'>
            <h2 className='text-base font-semibold text-slate-900 dark:text-slate-100'>
              Escolha como pagar
            </h2>
            <div className='grid gap-3 sm:grid-cols-2'>
              <button
                type='button'
                onClick={() => setSelectedMethod('card')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selectedMethod === 'card'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                }`}
              >
                <p className='text-sm font-semibold'>Cartao</p>
                <p className='text-xs text-slate-500'>
                  Credito ou debito, com confirmacao imediata.
                </p>
              </button>
              <button
                type='button'
                onClick={() => setSelectedMethod('pix')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selectedMethod === 'pix'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                }`}
              >
                <p className='text-sm font-semibold'>PIX</p>
                <p className='text-xs text-slate-500'>
                  QR Code e copia e cola na hora.
                </p>
              </button>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='payer-email'>Email do pagador</Label>
                <Input
                  id='payer-email'
                  value={payerEmail}
                  onChange={(event) => setPayerEmail(event.target.value)}
                  placeholder='email@cliente.com'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='payer-document'>CPF ou CNPJ</Label>
                <Input
                  id='payer-document'
                  value={payerDocument}
                  onChange={(event) => setPayerDocument(event.target.value)}
                  placeholder='Somente numeros'
                />
              </div>
            </div>

            {selectedMethod === 'card' && brickError && (
              <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                {brickError}
              </div>
            )}

            {selectedMethod === 'card' && isSubmitting && (
              <div className='flex items-center gap-2 text-sm text-slate-500'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Processando pagamento...
              </div>
            )}

            {selectedMethod === 'card' && (
              <div id='paymentBrick_container' className='w-full min-w-0' />
            )}

            {selectedMethod === 'pix' && (
              <div className='space-y-3'>
                {!hasPixResult && !isGeneratingPix && (
                  <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'>
                    Preencha email e CPF/CNPJ para gerar o PIX automaticamente.
                  </div>
                )}
                {pixError && (
                  <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                    {pixError}
                  </div>
                )}
                {isGeneratingPix && (
                  <div className='flex items-center gap-2 text-sm text-slate-500'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Gerando PIX...
                  </div>
                )}
                {hasPixResult && (
                  <div className='flex justify-end'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={sendPixByEmail}
                    >
                      Enviar por email
                    </Button>
                  </div>
                )}
              </div>
            )}

            {selectedMethod === 'pix' && hasPixResult && (
              <div className='rounded-lg border border-slate-200 p-4'>
                <div className='grid gap-4 md:grid-cols-[1fr_auto] md:items-start'>
                  <div className='space-y-3'>
                    <p className='text-sm font-medium text-slate-700'>
                      PIX copia e cola
                    </p>
                    <Textarea
                      value={pixPayload}
                      readOnly
                      className='min-h-[96px] resize-none text-xs leading-5'
                    />
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={copyPixPayload}
                        className='gap-2'
                      >
                        <Copy className='h-4 w-4' />
                        Copiar PIX
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={sharePixPayload}
                        disabled={isSharingPix}
                        className='gap-2'
                      >
                        {isSharingPix ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <Share2 className='h-4 w-4' />
                        )}
                        Compartilhar
                      </Button>
                    </div>
                    <p className='text-xs text-slate-500'>
                      No celular, toque em Compartilhar para abrir o app do
                      banco, se estiver disponivel.
                    </p>
                  </div>
                  {qrCodeDataUrl && (
                    <div className='text-center'>
                      <p className='text-sm font-medium text-slate-700'>
                        QR Code PIX
                      </p>
                      <img
                        src={qrCodeDataUrl}
                        alt='QR Code PIX'
                        className='mx-auto mt-3 h-40 w-40'
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
