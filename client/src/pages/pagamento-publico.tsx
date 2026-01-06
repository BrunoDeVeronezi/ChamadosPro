import { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/masks';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
  const [sdkReady, setSdkReady] = useState(false);
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocument, setPayerDocument] = useState('');
  const [brickError, setBrickError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

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
    loadMercadoPagoSdk()
      .then(() => setSdkReady(true))
      .catch((error) => {
        console.error(error);
        setBrickError('Nao foi possivel carregar o Mercado Pago.');
      });
  }, [data?.mercadoPago?.connected, data?.mercadoPago?.publicKey]);

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
                bankTransfer: ['pix'],
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
                    setPaymentResult(responseData);
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
          <Card className='p-6 space-y-4'>
            <h2 className='text-base font-semibold text-slate-900 dark:text-slate-100'>
              Escolha como pagar
            </h2>
            <div className='grid gap-4 md:grid-cols-2'>
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

            {brickError && (
              <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                {brickError}
              </div>
            )}

            {isSubmitting && (
              <div className='flex items-center gap-2 text-sm text-slate-500'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Processando pagamento...
              </div>
            )}

            <div id='paymentBrick_container' />

            {paymentResult?.qrCodeDataUrl && (
              <div className='rounded-lg border border-slate-200 p-4 text-center'>
                <p className='text-sm font-medium text-slate-700'>
                  QR Code PIX
                </p>
                <img
                  src={paymentResult.qrCodeDataUrl}
                  alt='QR Code PIX'
                  className='mx-auto mt-3 h-48 w-48'
                />
                {paymentResult.pixPayload && (
                  <Button
                    className='mt-3'
                    variant='outline'
                    onClick={() =>
                      navigator.clipboard.writeText(
                        paymentResult.pixPayload || ''
                      )
                    }
                  >
                    Copiar codigo PIX
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
