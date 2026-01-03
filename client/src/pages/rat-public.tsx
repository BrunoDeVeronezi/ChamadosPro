import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature-pad';
import { Loader2 } from 'lucide-react';

type ServiceOrderComponent = {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  rows?: number;
  defaultValue?: string;
  width?: string;
  height?: string;
  x?: number;
  y?: number;
  rotation?: number;
  page?: number;
  binding?: string;
};

type ServiceOrderPayload = {
  order: {
    id: string;
    templateSnapshot: any;
    fieldValues?: Record<string, any> | null;
    status?: string | null;
    signatureData?: string | null;
    signedBy?: string | null;
    signedAt?: string | null;
    technicianSignatureData?: string | null;
    technicianSignedBy?: string | null;
    technicianSignedAt?: string | null;
    clientSignatureData?: string | null;
    clientSignedBy?: string | null;
    clientSignedAt?: string | null;
  };
  company?: {
    companyName?: string | null;
    companyLogoUrl?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  client?: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export default function RatPublic() {
  const { toast } = useToast();
  const [, params] = useRoute('/rat/:token');
  const token = params?.token || '';
  const technicianSignatureRef = useRef<SignaturePadHandle>(null);
  const clientSignatureRef = useRef<SignaturePadHandle>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [technicianSignatureData, setTechnicianSignatureData] = useState('');
  const [clientSignatureData, setClientSignatureData] = useState('');
  const [technicianSignedBy, setTechnicianSignedBy] = useState('');
  const [clientSignedBy, setClientSignedBy] = useState('');
  const [hasSigned, setHasSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery<ServiceOrderPayload>({
    queryKey: ['/api/service-orders/public', token],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/service-orders/public/${token}`,
        undefined
      );
      return response.json();
    },
    enabled: !!token,
  });

  const order = data?.order;
  const hasTechnicianSignature = Boolean(
    technicianSignatureData || order?.technicianSignatureData
  );
  const hasClientSignature = Boolean(
    clientSignatureData || order?.clientSignatureData || order?.signatureData
  );
  const usesNewSignatures = Boolean(
    technicianSignatureData ||
      clientSignatureData ||
      order?.technicianSignatureData ||
      order?.clientSignatureData
  );
  const isSigned =
    hasSigned ||
    order?.status === 'signed' ||
    (usesNewSignatures
      ? hasTechnicianSignature && hasClientSignature
      : !!order?.signatureData);

  const { components, layoutMode } = useMemo(() => {
    const snapshot = order?.templateSnapshot || {};
    const rawComponents: ServiceOrderComponent[] = Array.isArray(snapshot)
      ? snapshot
      : snapshot.components || [];
    const resolvedLayoutMode = Array.isArray(snapshot)
      ? 'flow'
      : snapshot.layoutMode || 'flow';
    return {
      components: rawComponents,
      layoutMode: resolvedLayoutMode,
    };
  }, [order?.templateSnapshot]);

  const isFreeLayout = layoutMode === 'free';
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 10;
  const MM_TO_PX = 96 / 25.4;
  const pageWidthPx = Math.round(A4_WIDTH_MM * MM_TO_PX);
  const pageHeightPx = Math.round(A4_HEIGHT_MM * MM_TO_PX);
  const pageMarginPx = Math.round(PAGE_MARGIN_MM * MM_TO_PX);
  const contentWidthPx = pageWidthPx - pageMarginPx * 2;
  const contentHeightPx = pageHeightPx - pageMarginPx * 2;

  useEffect(() => {
    if (order?.fieldValues) {
      setFieldValues(order.fieldValues);
    }
    if (order?.technicianSignatureData) {
      setTechnicianSignatureData(order.technicianSignatureData);
    }
    if (order?.technicianSignedBy) {
      setTechnicianSignedBy(order.technicianSignedBy);
    }
    if (order?.clientSignatureData || order?.signatureData) {
      setClientSignatureData(
        order?.clientSignatureData || order?.signatureData || ''
      );
    }
    if (order?.clientSignedBy || order?.signedBy) {
      setClientSignedBy(order?.clientSignedBy || order?.signedBy || '');
    }
    setHasSigned(order?.status === 'signed');
  }, [
    order?.fieldValues,
    order?.technicianSignatureData,
    order?.technicianSignedBy,
    order?.clientSignatureData,
    order?.clientSignedBy,
    order?.signatureData,
    order?.signedBy,
    order?.status,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1' && order) {
      setTimeout(() => window.print(), 300);
    }
  }, [order]);

  const updateField = (id: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleSign = async () => {
    if (!technicianSignatureData && !clientSignatureData) {
      toast({
        variant: 'destructive',
        title: 'Assinatura obrigatoria',
        description: 'Desenhe ao menos uma assinatura antes de salvar.',
      });
      return;
    }
    if (!order) return;

    const legacySignatureData = clientSignatureData || technicianSignatureData;
    const legacySignedBy = clientSignedBy || technicianSignedBy;

    setIsSubmitting(true);
    try {
      await apiRequest('POST', `/api/service-orders/public/${token}/sign`, {
        technicianSignatureData: technicianSignatureData || null,
        technicianSignedBy: technicianSignedBy || null,
        clientSignatureData: clientSignatureData || null,
        clientSignedBy: clientSignedBy || null,
        signatureData: legacySignatureData || null,
        signedBy: legacySignedBy || null,
        fieldValues,
      });
      setHasSigned(
        Boolean(
          (technicianSignatureData || order?.technicianSignatureData) &&
            (clientSignatureData ||
              order?.clientSignatureData ||
              order?.signatureData)
        )
      );
      toast({
        title: 'RAT atualizada',
        description: 'Assinatura(s) salva(s) com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao assinar',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50'>
        <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
      </div>
    );
  }

  if (!order) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50'>
        <Card className='p-8 text-center'>
          <p className='text-slate-700'>RAT nao encontrada.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-slate-50 px-4 py-6'>
      <div className='mx-auto max-w-3xl space-y-6'>
        <Card className='p-6'>
          <div className='flex items-center gap-4'>
            {data?.company?.companyLogoUrl ? (
              <img
                src={data.company.companyLogoUrl}
                alt={data.company.companyName || 'Logo'}
                className='h-12 w-12 rounded-md object-contain bg-white p-1 border'
              />
            ) : (
              <div className='h-12 w-12 rounded-md bg-slate-200' />
            )}
            <div>
              <h1 className='text-xl font-bold text-slate-900'>
                {data?.company?.companyName || 'RAT'}
              </h1>
              <p className='text-sm text-slate-500'>Relatorio de atendimento</p>
            </div>
          </div>
        </Card>

        <Card className={isFreeLayout ? 'p-6 overflow-x-auto' : 'p-6'}>
          <div
            className={
              isFreeLayout ? 'relative' : 'flex flex-wrap gap-4 items-start'
            }
            style={
              isFreeLayout
                ? {
                    width: `${contentWidthPx}px`,
                    height: `${contentHeightPx}px`,
                  }
                : undefined
            }
          >
            {components.map((component) => {
              const value =
                fieldValues[component.id] ?? component.defaultValue ?? '';
              const containerStyle: CSSProperties = {
                width: component.width || '100%',
                ...(component.height ? { height: component.height } : {}),
                ...(isFreeLayout
                  ? {
                      position: 'absolute',
                      left: component.x ?? 0,
                      top: component.y ?? 0,
                      transform: `rotate(${component.rotation ?? 0}deg)`,
                      transformOrigin: 'center',
                    }
                  : {}),
              };

              if (component.type === 'divider') {
                return (
                  <div
                    key={component.id}
                    style={containerStyle}
                    className='flex-none'
                  >
                    <hr className='border-slate-200' />
                  </div>
                );
              }
              if (component.type === 'logo') {
                return (
                  <div
                    key={component.id}
                    style={containerStyle}
                    className='flex flex-col flex-none'
                  >
                    <div className='flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 min-h-[96px]'>
                      {data?.company?.companyLogoUrl ? (
                        <img
                          src={data.company.companyLogoUrl}
                          alt={data.company.companyName || 'Logo'}
                          className='max-h-20 w-auto object-contain'
                        />
                      ) : (
                        'Logo da empresa'
                      )}
                    </div>
                  </div>
                );
              }
              if (component.type === 'table') {
                return (
                  <div
                    key={component.id}
                    style={containerStyle}
                    className='flex flex-col flex-none'
                  >
                    <div className='border border-slate-200 rounded-lg overflow-hidden min-h-[120px]'>
                      <table className='w-full text-sm'>
                        <thead className='bg-slate-100'>
                          <tr>
                            <th className='px-3 py-2 text-left'>Coluna 1</th>
                            <th className='px-3 py-2 text-left'>Coluna 2</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className='px-3 py-2 border-t'>Linha 1</td>
                            <td className='px-3 py-2 border-t'>Linha 1</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }
              if (component.type === 'signature') {
                const signatureRole =
                  component.binding === 'signature.technician'
                    ? 'technician'
                    : component.binding === 'signature.client'
                    ? 'client'
                    : 'client';
                const signatureValue =
                  signatureRole === 'technician'
                    ? technicianSignatureData ||
                      order.technicianSignatureData ||
                      ''
                    : clientSignatureData ||
                      order.clientSignatureData ||
                      order.signatureData ||
                      '';
                const signatureRef =
                  signatureRole === 'technician'
                    ? technicianSignatureRef
                    : clientSignatureRef;
                const handleSignatureChange =
                  signatureRole === 'technician'
                    ? setTechnicianSignatureData
                    : setClientSignatureData;
                const signatureLabel =
                  component.label ||
                  (signatureRole === 'technician'
                    ? 'Assinatura do tecnico'
                    : 'Assinatura do cliente');
                return (
                  <div
                    key={component.id}
                    style={containerStyle}
                    className='flex flex-col flex-none space-y-3'
                  >
                    <p className='text-sm font-medium text-slate-700'>
                      {signatureLabel}
                    </p>
                    {signatureValue ? (
                      <div className='rounded-md border border-slate-200 bg-white p-3'>
                        <img
                          src={signatureValue}
                          alt='Signature'
                          className='max-h-40'
                        />
                      </div>
                    ) : (
                      <SignaturePad
                        ref={signatureRef}
                        value={signatureValue}
                        onChange={handleSignatureChange}
                        disabled={isSigned}
                      />
                    )}
                    {!isSigned && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => handleSignatureChange('')}
                      >
                        Limpar assinatura
                      </Button>
                    )}
                  </div>
                );
              }
              if (component.type === 'text-block') {
                return (
                  <div
                    key={component.id}
                    style={containerStyle}
                    className='flex flex-col flex-none'
                  >
                    <p className='text-sm text-slate-700 whitespace-pre-wrap'>
                      {value}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  key={component.id}
                  style={containerStyle}
                  className='flex flex-col flex-none space-y-2'
                >
                  <label className='text-sm font-medium text-slate-700'>
                    {component.label}
                    {component.required ? ' *' : ''}
                  </label>
                  {component.type === 'textarea' ? (
                    <div className='flex-1 flex items-stretch'>
                      <Textarea
                        value={value}
                        placeholder={component.placeholder}
                        rows={component.rows || 4}
                        disabled={isSigned}
                        className='w-full h-full'
                        onChange={(e) =>
                          updateField(component.id, e.target.value)
                        }
                      />
                    </div>
                  ) : component.type === 'select' ? (
                    <div className='flex-1 flex items-stretch'>
                      <select
                        className='w-full h-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm'
                        value={value}
                        disabled={isSigned}
                        onChange={(e) => updateField(component.id, e.target.value)}
                      >
                        <option value=''>
                          {component.placeholder || 'Select'}
                        </option>
                        {(component.options || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : component.type === 'checkbox' ? (
                    <label className='flex items-center gap-2 text-sm text-slate-600'>
                      <input
                        type='checkbox'
                        checked={Boolean(value)}
                        disabled={isSigned}
                        onChange={(e) =>
                          updateField(component.id, e.target.checked)
                        }
                      />
                      {component.placeholder || component.label}
                    </label>
                  ) : component.type === 'datetime' ? (
                    <div className='flex-1 flex items-stretch'>
                      <Input
                        type='datetime-local'
                        value={value}
                        disabled={isSigned}
                        className='w-full h-full'
                        onChange={(e) =>
                          updateField(component.id, e.target.value)
                        }
                      />
                    </div>
                  ) : (
                    <div className='flex-1 flex items-stretch'>
                      <Input
                        type={component.type === 'number' ? 'number' : 'text'}
                        value={value}
                        placeholder={component.placeholder}
                        disabled={isSigned}
                        className='w-full h-full'
                        onChange={(e) =>
                          updateField(component.id, e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className='p-6 space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>
                Assinatura do tecnico
              </p>
              <Input
                value={technicianSignedBy}
                disabled={isSigned}
                placeholder='Nome do tecnico'
                onChange={(e) => setTechnicianSignedBy(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>
                Assinatura do cliente
              </p>
              <Input
                value={clientSignedBy}
                disabled={isSigned}
                placeholder='Nome do cliente'
                onChange={(e) => setClientSignedBy(e.target.value)}
              />
            </div>
          </div>

          {!isSigned && (
            <Button
              className='w-full'
              onClick={handleSign}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar assinaturas'}
            </Button>
          )}
          {isSigned && (
            <p className='text-sm text-slate-500'>
              Esta RAT ja foi assinada.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
