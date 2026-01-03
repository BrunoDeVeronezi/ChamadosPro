import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { maskCurrency, unmaskCurrency } from '@/lib/masks';
import {
  ArrowLeft,
  ImagePlus,
  Info,
  ShieldCheck,
  Tag,
  Timer,
  Trash2,
} from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration: number;
  active: boolean;
  publicBooking: boolean;
  warranty?: string | null;
  imageUrl?: string | null;
  billingUnit?: string | null;
}

const billingUnitOptions = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'por_visita', label: 'Por visita' },
  { value: 'por_item', label: 'Por item' },
  { value: 'por_equipamento', label: 'Por equipamento' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'pacote', label: 'Pacote/Projeto' },
];

const MAX_IMAGE_SIZE = 800 * 1024;

const getBillingUnitLabel = (value?: string | null) => {
  if (!value) return 'Não definido';
  return billingUnitOptions.find((option) => option.value === value)?.label ?? value;
};

export default function EdicaoServico() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputId = 'service-image';

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const serviceId = pathSegments[1] || '';
  const isEdit = serviceId !== '' && serviceId !== 'novo';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '1',
    warranty: '',
    billingUnit: '',
    imageUrl: '',
    active: true,
    publicBooking: true,
  });
  const [rawServiceText, setRawServiceText] = useState('');

  const { data: service } = useQuery<Service>({
    queryKey: ['/api/services', serviceId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/services/${serviceId}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviço');
      return response.json();
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (service) {
      const priceValue = Number.parseFloat(String(service.price || '0'));
      const formattedPrice = Number.isFinite(priceValue)
        ? maskCurrency(priceValue.toFixed(2))
        : '';

      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: formattedPrice,
        duration: service.duration ? String(service.duration) : '1',
        warranty: service.warranty || '',
        billingUnit: service.billingUnit || '',
        imageUrl: service.imageUrl || '',
        active: service.active ?? true,
        publicBooking: service.publicBooking ?? true,
      });
    }
  }, [service]);

  const parseServiceText = () => {
    const cleanedText = (rawServiceText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();

    if (!cleanedText) {
      toast({
        variant: 'destructive',
        title: 'Texto vazio',
        description: 'Cole as informações do serviço antes de extrair.',
      });
      return;
    }

    const lines = cleanedText.split(/\n/).map((line) => line.trim());

    let nameMatch: string | undefined;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].toLowerCase();
      if (
        line.match(
          /^(?:nome|serviço|servico|nome do serviço|nome do servico)[:\-]?$/
        )
      ) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.length > 2) {
            nameMatch = nextLine;
            break;
          }
        }
      }
    }

    if (!nameMatch) {
      nameMatch =
        cleanedText
          .match(
            /^(?:nome|serviço|servico|nome do serviço|nome do servico)[:\-]?\s*(.+)/i
          )?.[1]
          ?.split(/[\n\r]/)[0]
          ?.trim() ||
        lines.find(
          (line) =>
            line &&
            line.length > 2 &&
            !line.match(
              /^(?:descrição|descricao|preço|preco|duração|duracao|valor|horas|h)/i
            )
        );
    }

    let descriptionMatch: string | undefined;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].toLowerCase();
      if (
        line.match(
          /^(?:descrição|descricao|desc|descrição do serviço|descricao do servico)[:\-]?$/
        )
      ) {
        const descriptionLines: string[] = [];
        for (let j = i + 1; j < lines.length; j += 1) {
          const nextLine = lines[j].trim();
          if (!nextLine) continue;
          if (
            nextLine.match(
              /^(?:preço|preco|valor|duração|duracao|horas|h|r\$)/i
            )
          ) {
            break;
          }
          descriptionLines.push(nextLine);
        }
        if (descriptionLines.length > 0) {
          descriptionMatch = descriptionLines.join('\n');
          break;
        }
      }
    }

    if (!descriptionMatch) {
      descriptionMatch =
        cleanedText
          .match(
            /(?:descrição|descricao|desc)[:\-]?\s*([\s\S]+?)(?=\n(?:preço|preco|valor|duração|duracao|horas|h|r\$)|$)/i
          )?.[1]
          ?.trim() ||
        cleanedText
          .match(/(?:descrição|descricao|desc)[:\-]?\s*([\s\S]+)/i)?.[1]
          ?.trim();
    }

    const pricePatterns = [
      /(?:preço|preco|valor|r\$|reais?)[:\-]?\s*R?\$?\s*([\d.,]+)/i,
      /R?\$?\s*([\d.,]+)\s*(?:reais?|r\$)/i,
      /\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:reais?|r\$)/i,
      /\bR?\$?\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\b/i,
    ];
    let priceMatch: string | undefined;
    for (const pattern of pricePatterns) {
      const match = cleanedText.match(pattern);
      if (match && match[1]) {
        priceMatch = match[1].replace(/\./g, '').replace(',', '.');
        break;
      }
    }

    const durationPatterns = [
      /(?:dura[çc][ãa]o|duracao|horas?|h|tempo)[:\-]?\s*(\d+)\s*(?:horas?|h|hora)?/i,
      /\b(\d+)\s*(?:horas?|h)\b/i,
      /(?:dura[çc][ãa]o|duracao)[:\-]?\s*(\d+)/i,
    ];
    let durationMatch: string | undefined;
    for (const pattern of durationPatterns) {
      const match = cleanedText.match(pattern);
      if (match && match[1]) {
        durationMatch = match[1];
        break;
      }
    }

    setFormData((prev) => {
      const updated = { ...prev };

      if (nameMatch) {
        updated.name = nameMatch.trim();
      }

      if (descriptionMatch) {
        updated.description = descriptionMatch.trim();
      }

      if (priceMatch) {
        const priceValue = Number.parseFloat(priceMatch);
        if (!Number.isNaN(priceValue) && priceValue >= 0) {
          updated.price = maskCurrency(priceValue.toFixed(2));
        }
      }

      if (durationMatch) {
        const durationValue = Number.parseInt(durationMatch, 10);
        if (!Number.isNaN(durationValue) && durationValue > 0) {
          updated.duration = durationValue.toString();
        }
      }

      return updated;
    });

    toast({
      title: 'Dados preenchidos!',
      description: 'Os dados do serviço foram extraídos automaticamente.',
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const unmaskedPrice = unmaskCurrency(data.price);
      const priceValue = Number.parseFloat(unmaskedPrice);
      const durationValue = Number.parseInt(data.duration, 10);

      const payload = {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        price: Number.isFinite(priceValue) ? priceValue.toFixed(2) : '0.00',
        duration: Number.isFinite(durationValue) ? durationValue : 0,
        warranty: data.warranty.trim() || undefined,
        billingUnit: data.billingUnit,
        imageUrl: data.imageUrl,
        active: data.active,
        publicBooking: data.publicBooking,
      };

      const response = isEdit
        ? await apiRequest('PUT', `/api/services/${serviceId}`, payload)
        : await apiRequest('POST', '/api/services', payload);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erro ao salvar serviço');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({
        title: isEdit ? 'Serviço atualizado' : 'Serviço criado',
        description: `O serviço foi ${
          isEdit ? 'atualizado' : 'criado'
        } com sucesso.`,
      });
      setLocation('/servicos');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar serviço',
        description: error.message,
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 800KB.',
      });
      event.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Use PNG, JPG ou WebP.',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result =
        typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar imagem',
          description: 'Tente novamente com outro arquivo.',
        });
        return;
      }
      setFormData((prev) => ({ ...prev, imageUrl: result }));
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'Erro ao ler arquivo',
        description: 'Não foi possível processar a imagem.',
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const billingUnitLabel = useMemo(
    () => getBillingUnitLabel(formData.billingUnit),
    [formData.billingUnit]
  );

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Link href='/servicos'>
                <a className='hover:text-primary transition-colors'>Serviços</a>
              </Link>
              <span>/</span>
              <span>{isEdit ? 'Editar' : 'Cadastrar'}</span>
            </div>
            <div className='flex items-center gap-3'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setLocation('/servicos')}
                className='gap-2'
              >
                <ArrowLeft className='h-4 w-4' />
                Voltar
              </Button>
              <h1 className='text-3xl font-black text-gray-900 dark:text-white'>
                {isEdit ? 'Editar serviço' : 'Cadastro de serviço'}
              </h1>
            </div>
            <p className='text-sm text-muted-foreground max-w-2xl'>
              Esses serviços aparecem na seleção de chamados para PF e PJ
              (cliente final). Para empresa parceira, a medição é feita de outra
              forma.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setLocation('/servicos')}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar serviço'}
            </Button>
          </div>
        </div>

        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
          <div className='space-y-6'>
            <Card className='p-6 space-y-6'>
              <div>
                <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
                  Identidade do serviço
                </h2>
                <p className='text-sm text-muted-foreground'>
                  Inclua a imagem do serviço e um nome claro para facilitar a
                  escolha no chamado.
                </p>
              </div>
              <div className='grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]'>
                <div className='space-y-3'>
                  <label
                    htmlFor={imageInputId}
                    className='group relative aspect-[4/3] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer'
                  >
                    {formData.imageUrl ? (
                      <img
                        src={formData.imageUrl}
                        alt='Imagem do serviço'
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <div className='flex flex-col items-center gap-2 text-gray-400'>
                        <ImagePlus className='h-6 w-6' />
                        <span className='text-xs font-medium'>
                          Adicione uma imagem
                        </span>
                      </div>
                    )}
                    <div className='absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-semibold opacity-0 transition group-hover:opacity-100'>
                      {formData.imageUrl ? 'Trocar imagem' : 'Selecionar imagem'}
                    </div>
                  </label>
                  <input
                    ref={fileInputRef}
                    id={imageInputId}
                    type='file'
                    accept='image/png,image/jpeg,image/webp'
                    onChange={handleImageChange}
                    className='hidden'
                  />
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Carregar imagem
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={handleRemoveImage}
                      disabled={!formData.imageUrl}
                      className='gap-1'
                    >
                      <Trash2 className='h-4 w-4' />
                      Remover
                    </Button>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    PNG, JPG ou WebP. Tamanho máximo 800KB. Proporção 4:3.
                  </p>
                </div>
                <div className='space-y-4'>
                  <label className='flex flex-col'>
                    <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                      Nome do serviço <span className='text-red-500'>*</span>
                    </span>
                    <Input
                      id='service-name'
                      value={formData.name}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder='Ex: Formatação de computador com backup'
                      required
                      className='h-12'
                    />
                    <span className='text-xs text-muted-foreground mt-2'>
                      Use um nome direto para facilitar a seleção no chamado.
                    </span>
                  </label>
                  <label className='flex flex-col'>
                    <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                      Descrição do serviço
                    </span>
                    <Textarea
                      id='service-description'
                      value={formData.description}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder='Detalhe o que está incluso, escopo e condições.'
                      rows={4}
                    />
                    <span className='text-xs text-muted-foreground mt-2'>
                      Foque em entregáveis, limites e o que não está incluso.
                    </span>
                  </label>
                </div>
              </div>
            </Card>

            <Card className='p-6 space-y-4'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
                    Importar informações
                  </h2>
                  <p className='text-sm text-muted-foreground'>
                    Cole orçamento, e-mail ou descrição e extraia os dados.
                  </p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={parseServiceText}
                  disabled={!rawServiceText.trim()}
                >
                  Extrair dados
                </Button>
              </div>
              <Textarea
                value={rawServiceText}
                onChange={(event) => setRawServiceText(event.target.value)}
                placeholder='Ex: Nome do serviço, descrição, preço e duração...'
                rows={5}
              />
              <p className='text-xs text-muted-foreground'>
                Dica: linhas separadas ajudam a identificar nome, preço e
                duração.
              </p>
            </Card>

            <Card className='p-6 space-y-6'>
              <div>
                <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
                  Preço e medição
                </h2>
                <p className='text-sm text-muted-foreground'>
                  Defina o valor padrão e como o serviço é medido para PF/PJ.
                </p>
              </div>
              <div className='grid gap-6 md:grid-cols-2'>
                <label className='flex flex-col'>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                    Valor do serviço (R$) <span className='text-red-500'>*</span>
                  </span>
                  <Input
                    id='service-price'
                    value={formData.price}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        price: maskCurrency(event.target.value),
                      }))
                    }
                    placeholder='0,00'
                    required
                    className='h-12'
                  />
                  <span className='text-xs text-muted-foreground mt-2'>
                    Valor base usado na abertura de chamados PF/PJ.
                  </span>
                </label>
                <label className='flex flex-col'>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                    Unidade de cobrança
                  </span>
                  <Select
                    value={formData.billingUnit || '__none__'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        billingUnit: value === '__none__' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger id='service-billing-unit' className='h-12'>
                      <SelectValue placeholder='Selecione a unidade' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Não definir</SelectItem>
                      {billingUnitOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className='text-xs text-muted-foreground mt-2'>
                    Ajuda o cliente a entender como o valor é calculado.
                  </span>
                </label>
                <label className='flex flex-col'>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                    Duração estimada (horas) <span className='text-red-500'>*</span>
                  </span>
                  <Input
                    id='service-duration'
                    type='number'
                    min='1'
                    max='24'
                    step='1'
                    value={formData.duration}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        duration: event.target.value,
                      }))
                    }
                    placeholder='Ex: 2'
                    required
                    className='h-12'
                  />
                  <span className='text-xs text-muted-foreground mt-2'>
                    Usado no planejamento da agenda e previsão do atendimento.
                  </span>
                </label>
                <label className='flex flex-col'>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-200 pb-2'>
                    Garantia padrão
                  </span>
                  <Input
                    id='service-warranty'
                    value={formData.warranty}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        warranty: event.target.value,
                      }))
                    }
                    placeholder='Ex: 90 dias'
                    className='h-12'
                  />
                  <span className='text-xs text-muted-foreground mt-2'>
                    Pode ser ajustada caso o chamado tenha condições especiais.
                  </span>
                </label>
              </div>
            </Card>

            <Card className='p-6 space-y-6'>
              <div>
                <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
                  Visibilidade
                </h2>
                <p className='text-sm text-muted-foreground'>
                  Configure a exibição do serviço.
                </p>
              </div>
              
              <div className='space-y-4'>
                <div className='flex items-center justify-between gap-4'>
                  <div>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-200'>
                      Serviço ativo
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Serviços inativos não aparecem para seleção.
                    </p>
                  </div>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, active: checked }))
                    }
                  />
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <div>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-200'>
                      Agendamento público
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Permitir que clientes agendem esse serviço publicamente.
                    </p>
                  </div>
                  <Switch
                    checked={formData.publicBooking}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        publicBooking: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className='space-y-6'>
            <Card className='p-5 space-y-4'>
              <div className='space-y-2'>
                <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                  Pré-visualização
                </p>
                <div className='relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900'>
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt='Pré-visualização'
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center text-gray-400'>
                      <ImagePlus className='h-6 w-6' />
                    </div>
                  )}
                </div>
              </div>
              <div className='space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
                    {formData.name || 'Nome do serviço'}
                  </h3>
                  <Badge
                    variant={formData.active ? 'default' : 'secondary'}
                    className='text-xs'
                  >
                    {formData.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className='text-sm text-muted-foreground line-clamp-3'>
                  {formData.description || 'Descreva o serviço para o cliente.'}
                </p>
              </div>
              <div className='grid gap-2 text-xs text-muted-foreground'>
                <div className='flex items-center gap-2'>
                  <Tag className='h-3.5 w-3.5' />
                  <span>Unidade: {billingUnitLabel}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Timer className='h-3.5 w-3.5' />
                  <span>Duração: {formData.duration || '0'}h</span>
                </div>
                <div className='flex items-center gap-2'>
                  <ShieldCheck className='h-3.5 w-3.5' />
                  <span>
                    Garantia: {formData.warranty || 'Não definida'}
                  </span>
                </div>
              </div>
              <div className='rounded-lg border border-gray-200 dark:border-gray-800 p-4'>
                <p className='text-xs text-muted-foreground'>Valor padrão</p>
                <p className='text-2xl font-black text-gray-900 dark:text-white'>
                  R$ {formData.price || '0,00'}
                </p>
              </div>
              {formData.publicBooking && (
                <p className='text-xs font-semibold text-emerald-600'>
                  Disponível no agendamento público
                </p>
              )}
            </Card>

            <Alert>
              <Info className='h-4 w-4' />
              <AlertTitle>Medição para empresa parceira</AlertTitle>
              <AlertDescription>
                A seleção do serviço é usada para PF e PJ cliente final. Para
                empresas parceiras, a medição segue a planilha/contrato.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => setLocation('/servicos')}
          >
            Cancelar
          </Button>
          <Button type='submit' disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar serviço'}
          </Button>
        </div>
      </form>
    </div>
  );
}
