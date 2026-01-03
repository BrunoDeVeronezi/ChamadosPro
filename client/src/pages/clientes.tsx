import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useSocket } from '@/hooks/use-socket';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  User,
  Building2,
  Edit,
  Edit3,
  Trash2,
  MessageCircle,
  Loader2,
  ArrowLeft,
  Users,
  FileCode,
  FileText,
  Image,
  Ticket,
  CheckCircle2,
  MapPin,
  SearchX,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  maskCurrency,
  unmaskCPF,
  unmaskCNPJ,
  unmaskPhone,
  unmaskCEP,
  unmaskCurrency,
} from '@/lib/masks';
import { fetchCnpjData } from '@/services/CnpjService';
import { fetchCepData } from '@/services/CepService';
import { fetchCpfData } from '@/services/CpfService';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { CreateTicketModal } from '@/components/create-ticket-modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePaidAccess } from '@/hooks/use-paid-access';

interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  document: string;
  ratTemplateId?: string | null;
  email: string;
  phone: string;
  // logoUrl?: string | null;
  address?: string | null;
  city: string;
  state: string;
  // EMPRESA_PARCEIRA specific fields
  legalName?: string | null;
  municipalRegistration?: string | null;
  stateRegistration?: string | null;
  zipCode?: string | null;
  streetAddress?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  paymentCycleStartDay?: number | null;
  paymentCycleEndDay?: number | null;
  paymentDueDay?: number | null;
  defaultTicketValue?: string | null;
  defaultHoursIncluded?: number | null;
  defaultKmRate?: string | null;
  defaultAdditionalHourRate?: string | null;
  monthlySpreadsheet: boolean;
  spreadsheetEmail?: string | null;
  spreadsheetDay?: number | null;
}

interface ServiceOrderTemplate {
  id: string;
  name: string;
}

export default function Clientes() {
  // Habilitar atualizações em tempo real
  useSocket();

  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [createTicketClientId, setCreateTicketClientId] = useState<
    string | null
  >(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isSavingRef = useRef(false); // Flag para indicar que está salvando (evita confirmação de cancelamento)
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [showFields, setShowFields] = useState(false); // Campos aparecem após clicar em "Avançar"
  const [showTypeModal, setShowTypeModal] = useState(false); // Modal para escolher PJ ou EMPRESA_PARCEIRA
  const [activeTab, setActiveTab] = useState<'PF' | 'PJ' | 'EMPRESA_PARCEIRA'>('PF'); // Aba ativa no formulário
  const [existingClient, setExistingClient] = useState<Client | null>(null); // Cliente já cadastrado
  const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ' | null>(null); // Tipo do documento detectado
  const [isCheckingClient, setIsCheckingClient] = useState(false); // Verificando se cliente existe
  const [isProcessingXml, setIsProcessingXml] = useState(false); // Processando XML
  const typeModalOpenedForDocument = useRef<string | null>(null); // Rastreia para qual documento o modal já foi aberto
  const isOpeningTypeModal = useRef<boolean>(false); // Flag para evitar múltiplas aberturas simultâneas
  const [duplicateClientModal, setDuplicateClientModal] = useState<{
    open: boolean;
    clientData: any;
    existingClient: Client | null;
    index: number;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null); // Modal para confirmar sobrescrita de cliente duplicado
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [importData, setImportData] = useState('');
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Função para detectar se o nome é de uma empresa
  const detectCompanyType = (name: string): 'PF' | 'EMPRESA_PARCEIRA' => {
    if (!name || name === 'N/C') return 'PF';

    const upperName = name.toUpperCase().trim();
    const words = upperName.split(/\s+/).filter((w) => w.length > 0);

    // Palavras-chave que indicam empresa jurídica
    const companyKeywords = [
      'LTDA',
      'EIRELI',
      'S.A.',
      'SA',
      'ME',
      'EPP',
      'SOCIEDADE',
      'TECNOLOGIA',
      'TECH',
      'TECHNOLOGY',
      'SISTEMAS',
      'SYSTEMS',
      'SYSTEM',
      'SERVICOS',
      'SERVIÇOS',
      'SERVICES',
      'SERVICE',
      'COMERCIO',
      'COMÉRCIO',
      'INDUSTRIA',
      'INDÚSTRIA',
      'CONSULTORIA',
      'ASSESSORIA',
      'SOLUCOES',
      'SOLUÇÕES',
      'SOLUTIONS',
      'BRASIL',
      'BRASILEIRA',
      'NACIONAL',
      'INTERNACIONAL',
      'GROUP',
      'GRUPO',
      'CORP',
      'CORPORATION',
      'INC',
      'TELECOM',
      'TELECOMUNICACOES',
      'TELECOMUNICAÇÕES',
      'DIGITAL',
      'SOFTWARE',
      'HARDWARE',
      'INFORMATICA',
      'INFORMÁTICA',
      'NETWORK',
      'NETWORKS',
      'TOTEMS',
      'TOTEM',
      'INSTITUTO',
      'INSTITUTE',
      'FUNDACAO',
      'FUNDAÇÃO',
      'EMPRESA',
      'ENTERPRISE',
      'BUSINESS',
      'NEGOCIOS',
      'NEGÓCIOS',
    ];

    // Verifica se contém palavras-chave de empresa
    for (const keyword of companyKeywords) {
      if (upperName.includes(keyword)) {
        return 'EMPRESA_PARCEIRA';
      }
    }

    // Nomes próprios comuns (geralmente são PF)
    const commonNames = [
      'SILVA',
      'SANTOS',
      'OLIVEIRA',
      'SOUZA',
      'RODRIGUES',
      'FERREIRA',
      'ALMEIDA',
      'PEREIRA',
      'LIMA',
      'COSTA',
      'RIBEIRO',
      'MARTINS',
      'CARVALHO',
      'ALVES',
      'GOMES',
      'JOAO',
      'JOSÉ',
      'MARIA',
      'ANTONIO',
      'FRANCISCO',
    ];

    // Se todas as palavras são nomes comuns, provavelmente é PF
    const allCommonNames = words.every((word) =>
      commonNames.some(
        (common) => word.includes(common) || common.includes(word)
      )
    );

    if (allCommonNames && words.length <= 3) {
      return 'PF';
    }

    // Se tem mais de 2 palavras, provavelmente é empresa
    if (words.length > 2) {
      return 'EMPRESA_PARCEIRA';
    }

    // Se tem 2 palavras e não são nomes próprios comuns, provavelmente é empresa
    if (words.length === 2) {
      // Verifica se a primeira palavra é muito curta (artigo/preposição) ou se são palavras compostas
      const firstWord = words[0];
      const secondWord = words[1];

      // Se ambas palavras têm mais de 3 letras, provavelmente é empresa
      if (firstWord.length > 3 && secondWord.length > 3) {
        return 'EMPRESA_PARCEIRA';
      }
    }

    // Se tem apenas 1 palavra e é longa ou tem caracteres especiais, pode ser empresa
    if (words.length === 1) {
      const singleWord = words[0];
      // Nomes de empresas geralmente têm mais de 6 caracteres
      if (singleWord.length > 6) {
        return 'EMPRESA_PARCEIRA';
      }
    }

    // Por padrão, se não tem documento e não conseguiu detectar, assume PF
    return 'PF';
  };

  // Função para tratar dados antes de inserir no banco
  const treatClientData = (rawData: any, index: number, total: number): any => {
    const treatedData = { ...rawData };

    // 1. Normaliza nome (remove espaços extras, capitaliza)
    if (treatedData.name) {
      treatedData.name = treatedData.name.trim().replace(/\s+/g, ' ');
    }
    if (treatedData.legalName) {
      treatedData.legalName = treatedData.legalName.trim().replace(/\s+/g, ' ');
    }

    // 2. Normaliza email (lowercase, remove espaços)
    if (treatedData.email) {
      treatedData.email = treatedData.email.trim().toLowerCase();
    } else {
      // Garante que sempre exista um valor de email para passar na validação/Zod
      // Para imports em massa, é melhor ter um placeholder do que bloquear todo o lote
      treatedData.email = 'sem-email@placeholder.local';
    }

    // 3. Normaliza telefone (remove caracteres inválidos, mantém apenas números e parênteses/hífens)
    if (treatedData.phone) {
      treatedData.phone = treatedData.phone.trim();
    }

    // 4. Normaliza documento (remove caracteres não numéricos para validação)
    if (treatedData.document) {
      const cleanDoc = treatedData.document.replace(/\D/g, '');
      if (cleanDoc.length === 11) {
        treatedData.document = maskCPF(treatedData.document);
        treatedData.type = 'PF';
      } else if (cleanDoc.length === 14) {
        treatedData.document = maskCNPJ(treatedData.document);
        if (!treatedData.type || treatedData.type === 'PF') {
          treatedData.type = 'EMPRESA_PARCEIRA';
        }
      }
    }

    // 5. Normaliza endereço (remove espaços extras)
    if (treatedData.streetAddress) {
      treatedData.streetAddress = treatedData.streetAddress
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (treatedData.neighborhood) {
      treatedData.neighborhood = treatedData.neighborhood
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (treatedData.city) {
      treatedData.city = treatedData.city.trim();
    }
    if (treatedData.state) {
      treatedData.state = treatedData.state.trim().toUpperCase();
    }

    // 6. Normaliza CEP
    if (treatedData.zipCode) {
      treatedData.zipCode = maskCEP(treatedData.zipCode);
    }

    // 7. Determina tipo se não foi definido
    if (!treatedData.type || treatedData.type === 'PF') {
      // Se não tem documento, tenta detectar pelo nome
      if (!treatedData.document) {
        const detectedType = detectCompanyType(treatedData.name);
        treatedData.type = detectedType;
      } else {
        // Se tem documento mas tipo não foi definido, mantém PF
        treatedData.type = 'PF';
      }
    }
    // 7. Nome obrigatório - regras específicas para PF e EMPRESA_PARCEIRA
    if (!treatedData.name || treatedData.name === 'N/C') {
      if (treatedData.type === 'PF') {
        // Para PF, tenta usar parte local do email ou o próprio CPF formatado
        if (treatedData.email && treatedData.email.includes('@')) {
          treatedData.name = treatedData.email.split('@')[0];
        } else if (treatedData.document) {
          treatedData.name = `CPF ${treatedData.document}`;
        } else {
          treatedData.name = 'Cliente PF';
        }
      } else {
        treatedData.name = treatedData.legalName || 'N/C';
      }
    }
    if (treatedData.type === 'EMPRESA_PARCEIRA' && !treatedData.name) {
      treatedData.name = 'N/C';
    }

    // 8. Remove máscaras para preparar dados finais
    const unmaskedData = {
      ...treatedData,
      document: treatedData.document
        ? treatedData.type === 'PF'
          ? unmaskCPF(treatedData.document)
          : unmaskCNPJ(treatedData.document)
        : '',
      phone: treatedData.phone ? unmaskPhone(treatedData.phone) : '',
      zipCode: treatedData.zipCode ? unmaskCEP(treatedData.zipCode) : '',
      // Correção: valores monetarios sempre como string (formato "120.00" com ponto).
      // O backend espera string para campos decimal do PostgreSQL.
      defaultTicketValue: treatedData.defaultTicketValue
        ? typeof treatedData.defaultTicketValue === 'number'
          ? treatedData.defaultTicketValue.toString()
          : typeof treatedData.defaultTicketValue === 'string' && treatedData.defaultTicketValue.includes(',')
          ? unmaskCurrency(treatedData.defaultTicketValue)
          : String(treatedData.defaultTicketValue)
        : '',
      defaultKmRate: treatedData.defaultKmRate
        ? typeof treatedData.defaultKmRate === 'number'
          ? treatedData.defaultKmRate.toString()
          : typeof treatedData.defaultKmRate === 'string' && treatedData.defaultKmRate.includes(',')
          ? unmaskCurrency(treatedData.defaultKmRate)
          : String(treatedData.defaultKmRate)
        : '',
      defaultAdditionalHourRate: treatedData.defaultAdditionalHourRate
        ? typeof treatedData.defaultAdditionalHourRate === 'number'
          ? treatedData.defaultAdditionalHourRate.toString()
          : typeof treatedData.defaultAdditionalHourRate === 'string' && treatedData.defaultAdditionalHourRate.includes(',')
          ? unmaskCurrency(treatedData.defaultAdditionalHourRate)
          : String(treatedData.defaultAdditionalHourRate)
        : '',
    };

    return unmaskedData;
  };

  const [formData, setFormData] = useState({
    name: '',
    type: 'PF' as 'PF' | 'PJ' | 'EMPRESA_PARCEIRA',
    document: '',
    email: '',
    phone: '',
    // logoUrl: '',
    address: '',
    city: '',
    state: '',
    ratTemplateId: '',
    // EMPRESA_PARCEIRA specific fields
    legalName: '',
    municipalRegistration: '',
    stateRegistration: '',
    zipCode: '',
    streetAddress: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    paymentCycleStartDay: 1,
    paymentCycleEndDay: 30,
    paymentDueDay: 5,
    defaultTicketValue: '120,00',
    defaultHoursIncluded: 3,
    defaultKmRate: '1,00',
    defaultAdditionalHourRate: '20,00',
    monthlySpreadsheet: false,
    spreadsheetEmail: '',
    spreadsheetDay: 1,
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Garante que o campo de documento mantenha o foco após efeitos automáticos
  // Preserva a posição do cursor na última posição do texto
  const restoreDocumentFocus = () => {
    if (typeof window === 'undefined') return;

    // Usa requestAnimationFrame + setTimeout para garantir que o React terminou de renderizar
    // e que o DOM foi atualizado completamente
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(
          'document'
        ) as HTMLInputElement | null;
        if (!el) return;

        // Preserva o valor atual e a posição do cursor
        const currentValue = el.value || '';
        const cursorPosition = currentValue.length;

        // Verifica se o elemento ainda está no DOM e visível
        if (!el.offsetParent && el.style.display === 'none') {
          return;
        }

        // Evita scroll brusco ao focar
        try {
          (el as any).focus({ preventScroll: true });
        } catch {
          el.focus();
        }

        // Restaura o cursor na última posição (ou na posição onde estava)
        if (cursorPosition > 0) {
          try {
            el.setSelectionRange(cursorPosition, cursorPosition);
          } catch {
            // Ignora se não suportado
          }
        }
      }, 10); // Pequeno delay para garantir que todas as atualizações de estado terminaram
    });
  };

  const {
    data: clients,
    isLoading,
    refetch: refetchClients,
  } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });

  const { data: serviceOrderTemplates = [] } = useQuery<ServiceOrderTemplate[]>({
    queryKey: ['/api/service-order-templates'],
    staleTime: 5 * 60 * 1000,
  });

 // Correção: Debounce para invalidações (evita múltiplas requisições)
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedInvalidate = useCallback(() => {
    if (invalidateTimeoutRef.current) {
      clearTimeout(invalidateTimeoutRef.current);
    }
    invalidateTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    }, 300); // 300ms de debounce
  }, []);

  // Calcula contadores por tipo de cliente
  const clientCounts = {
    PF: (clients?.filter((c) => c.type === 'PF') || []).length,
    PJ: (clients?.filter((c) => c.type === 'PJ') || []).length,
    EMPRESA_PARCEIRA: (clients?.filter((c) => c.type === 'EMPRESA_PARCEIRA') || []).length,
  };

  type ClientTypeKey = 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';

  // Mutação padrão: usada para criação manual/automática de um único cliente (fecha modal, mostra toast)
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/clients', data);
    },
    onSuccess: () => {
      debouncedInvalidate(); // Correção: Usar debounce ao invés de invalidação imediata
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: 'Cliente criado',
        description: 'O cliente foi cadastrado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar cliente',
        description: error.message,
      });
    },
  });

  // Mutação silenciosa: usada em imports (XML, múltiplas imagens) para não fechar o modal nem disparar toast padrão
  const bulkCreateClientMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/clients', data);
    },
    onError: (error: any) => {
      console.error('Erro ao criar cliente (bulk):', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      isSavingRef.current = true; // Marca que está salvando
      return await apiRequest('PATCH', `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      debouncedInvalidate(); // Correção: Usar debounce ao invés de invalidação imediata
      resetForm();
      // Fecha o modal primeiro
      setEditingClient(null);
      setIsCreateOpen(false);
      // Reseta a flag após um pequeno delay para garantir que o modal feche
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
      // Mostra toast de sucesso
      toast({
        title: (
          <div className='flex items-center gap-2'>
            <CheckCircle2 className='h-5 w-5 text-green-500 flex-shrink-0' />
            <span>Salvo com sucesso!</span>
          </div>
        ),
        description: 'As alterações do cliente foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      isSavingRef.current = false; // Reseta a flag em caso de erro
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar cliente',
        description: error.message,
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({
      clientIds,
      email,
      reason,
    }: {
      clientIds: string[];
      email: string;
      reason: string;
    }) => {
      const payload = {
        clientIds,
        email,
        reason,
      };

      try {
        const response = await apiRequest(
          'POST',
          '/api/clients/bulk-delete',
          payload
        );
        return await response.json();
      } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : '';
        if (message.startsWith('404')) {
          const results = await Promise.all(
            clientIds.map(async (clientId) => {
              try {
                await apiRequest('DELETE', `/api/clients/${clientId}`, {
                  reason,
                });
                return { clientId, ok: true };
              } catch (deleteError: any) {
                return {
                  clientId,
                  ok: false,
                  message: deleteError?.message || 'Failed to delete client',
                };
              }
            })
          );

          const errors = results
            .filter((result) => !result.ok)
            .map((result) => ({
              clientId: result.clientId,
              message: result.message || 'Failed to delete client',
            }));
          const deletedCount = results.length - errors.length;
          return {
            deletedCount,
            errors,
            message:
              deletedCount > 0
                ? `${deletedCount} cliente(s) excluido(s) com sucesso.`
                : 'Nenhum cliente foi excluido.',
            fallback: true,
          };
        }
        throw error;
      }
    },
    onSuccess: async (data: any, variables) => {
      const resolvedIds = Array.isArray(variables?.clientIds)
        ? variables.clientIds
        : [];

      if (data.errors && data.errors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Atenção',
          description: `${data.deletedCount || 0} cliente(s) excluído(s), mas ${data.errors.length} falharam.`,
        });
      }

      await refetchClients();
      debouncedInvalidate();

      setSelectedClients(new Set());
      setShowDeleteConfirm(false);
      setDeleteReason('');
      setDeleteEmail('');

      if (data.deletedCount > 0) {
        toast({
          title: 'Clientes excluídos',
          description:
            data.message ||
            `${data.deletedCount} cliente(s) excluído(s) com sucesso.`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Erro ao excluir clientes:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir clientes',
        description: error.message || 'Não foi possível excluir os clientes.',
      });
    },
  });

  // Função para buscar CEP e preencher endereço (PF)
  const handleSearchCep = async () => {
    const cleanCep = unmaskCEP(formData.zipCode || '');
    if (cleanCep.length !== 8) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'Digite um CEP válido com 8 dígitos.',
      });
      return;
    }

    try {
      const cepData = await fetchCepData(cleanCep);
      if (cepData) {
        setFormData((prev) => ({
          ...prev,
          zipCode: maskCEP(cepData.cep || cleanCep),
          streetAddress: cepData.street || prev.streetAddress || '',
          neighborhood: cepData.neighborhood || prev.neighborhood || '',
          city: cepData.city || prev.city || '',
          state: cepData.state ? cepData.state.toUpperCase() : prev.state || '',
          addressComplement: cepData.complement || prev.addressComplement || '',
        }));
        toast({
          title: 'CEP encontrado!',
          description: 'Os campos de endereço foram preenchidos automaticamente.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Não foi possível encontrar o endereço para este CEP.',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o CEP. Tente novamente.',
      });
    } finally {
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'PF',
      document: '',
      email: '',
      phone: '',
      // logoUrl: '',
      address: '',
      city: '',
      state: '',
      ratTemplateId: '',
      legalName: '',
      municipalRegistration: '',
      stateRegistration: '',
      zipCode: '',
      streetAddress: '',
      addressNumber: '',
      addressComplement: '',
      neighborhood: '',
      paymentCycleStartDay: 1,
      paymentCycleEndDay: 30,
      paymentDueDay: 5,
      defaultTicketValue: '120,00',
      defaultHoursIncluded: 3,
      defaultKmRate: '1,00',
      defaultAdditionalHourRate: '20,00',
      monthlySpreadsheet: false,
      spreadsheetEmail: '',
      spreadsheetDay: 1,
    });
    setFormErrors({});
  };

  // Upload de logo/foto do cliente para o backend (Google Drive) a partir de um data URL
  const uploadLogoToServer = async (dataUrl: string, fileName?: string) => {
    try {
      setIsUploadingLogo(true);
      const res = await fetch('/api/clients/upload-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          fileName,
        }),
      });

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }

      const json = await res.json();

      setFormData((prev) => ({
        ...prev,
        // logoUrl: json.downloadUrl || json.webViewUrl || dataUrl,
      }));
    } catch (error: any) {
      console.error('Erro ao enviar logo do cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar logo',
        description:
          error?.message ||
          'Não foi possível enviar a imagem do cliente. Tente novamente.',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Selecione uma imagem válida (PNG, JPG, etc).',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;

      // Atualiza preview imediatamente
      setFormData((prev) => ({
        ...prev,
        // logoUrl: dataUrl,
      }));

      await uploadLogoToServer(dataUrl, file.name);
    };

    reader.readAsDataURL(file);
    // Permite selecionar novamente o mesmo arquivo no futuro
    event.target.value = '';
  };

  // Função para buscar cliente existente por documento
  const searchExistingClient = async (
    document: string
  ): Promise<Client | null> => {
    try {
      const response = await apiRequest(
        'GET',
        `/api/clients/search/document?document=${encodeURIComponent(document)}`,
        undefined
      );
      return (await response.json()) as Client;
    } catch (error: any) {
      // 404 é esperado quando o cliente não existe - não é um erro real
      if (
        error.status === 404 ||
        error.message?.includes('404') ||
        error.message?.includes('Client not found')
      ) {
        return null; // Cliente não existe, retorna null silenciosamente
      }
      // Apenas loga erros reais (não 404)
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
  };

  const getDocumentConfig = (
    type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA'
  ) => {
    const isPf = type === 'PF';
    return {
      label: isPf ? 'CPF' : 'CNPJ',
      placeholder: isPf ? 'Digite CPF' : 'Digite CNPJ',
      maxDigits: isPf ? 11 : 14,
    };
  };

  const formatDocumentInput = (
    value: string,
    type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA'
  ) => {
    const { maxDigits } = getDocumentConfig(type);
    const cleanValue = value.replace(/\D/g, '').slice(0, maxDigits);
    return type === 'PF' ? maskCPF(cleanValue) : maskCNPJ(cleanValue);
  };

  const applyCnpjType = async (
    nextType: 'PJ' | 'EMPRESA_PARCEIRA',
    documentValue: string
  ) => {
    const cleanCnpj = documentValue.replace(/\D/g, '');
    const maskedCnpj = maskCNPJ(cleanCnpj);

    setDocumentType('CNPJ');
    setFormData((prev) => ({
      ...prev,
      type: nextType,
      document: maskedCnpj,
    }));
    setActiveTab(nextType);
    setShowTypeModal(false);
    typeModalOpenedForDocument.current = null;
    isOpeningTypeModal.current = false;

    if (cleanCnpj.length === 14) {
      setIsLoadingCnpj(true);
      try {
        const found = await fetchAndFillCnpjData(maskedCnpj);
        if (found) {
          toast({
            title: 'Dados encontrados!',
            description:
              'Os dados da empresa foram preenchidos automaticamente.',
          });
        }
      } catch (error) {
        console.error('Erro ao buscar CNPJ:', error);
      } finally {
        setIsLoadingCnpj(false);
      }
    }

    setShowFields(true);
  };

  // Função para processar CPF/CNPJ quando clicar em "Avançar"
  const handleAdvance = async () => {
    const documentConfig = getDocumentConfig(activeTab);
    if (!formData.document) {
      toast({
        variant: 'destructive',
        title: 'Documento obrigatório',
        description: `Digite o ${documentConfig.label} do cliente.`,
      });
      return;
    }

    // Remove formatação
    const cleanDocument = formData.document.replace(/\D/g, '');

    // Verifica se é um documento válido
    if (cleanDocument.length !== documentConfig.maxDigits) {
      toast({
        variant: 'destructive',
        title: 'Documento inválido',
        description: `Digite um ${documentConfig.label} (${documentConfig.maxDigits} digitos) valido.`,
      });
      return;
    }

    setIsCheckingClient(true);
    try {
      // Verifica se cliente já existe
      const existing = await searchExistingClient(cleanDocument);

      if (existing) {
        setExistingClient(existing);
        setShowFields(false);
        toast({
          variant: 'destructive',
          title: 'Cliente já cadastrado',
          description: `O cliente "${
            existing.name || existing.legalName
          }" já está cadastrado no sistema.`,
        });
        setIsCheckingClient(false);
        return;
      }

      setExistingClient(null);

      // Identifica tipo de documento
      if (activeTab === 'PF') {
        // CPF - define como PF e busca dados da API
        setDocumentType('CPF');
        setFormData((prev) => ({ ...prev, type: 'PF' }));

        // Busca dados do CPF na API
        try {
          const cpfData = await fetchCpfData(cleanDocument);

          if (cpfData) {
            // Preenche os campos com os dados retornados
            setFormData((prev) => ({
              ...prev,
              type: 'PF',
              document: maskCPF(cleanDocument),
              name: cpfData.name || prev.name,
              // Endereço
              address: cpfData.address?.street || prev.address,
              addressNumber: cpfData.address?.number || prev.addressNumber,
              addressComplement:
                cpfData.address?.complement || prev.addressComplement,
              neighborhood: cpfData.address?.neighborhood || prev.neighborhood,
              city: cpfData.address?.city || prev.city,
              state: cpfData.address?.state || prev.state,
              zipCode: cpfData.address?.zipCode
                ? maskCEP(cpfData.address.zipCode)
                : prev.zipCode,
            }));

            toast({
              title: 'Dados do CPF encontrados',
              description: 'Os campos foram preenchidos automaticamente.',
            });
          } else {
            // CPF não encontrado na API, mas continua o cadastro normalmente
            setFormData((prev) => ({
              ...prev,
              type: 'PF',
              document: maskCPF(cleanDocument),
            }));
          }
        } catch (error: any) {
          console.error('Erro ao buscar dados do CPF:', error);
          // Em caso de erro, continua o cadastro normalmente sem os dados da API
          setFormData((prev) => ({
            ...prev,
            type: 'PF',
            document: maskCPF(cleanDocument),
          }));

          // Só mostra toast se não for erro de serviço não configurado
          if (!error.message?.includes('não configurado')) {
            toast({
              variant: 'default',
              title: 'Aviso',
              description:
                'Não foi possível buscar dados do CPF. Você pode preencher manualmente.',
            });
          }
        }

        setShowFields(true);
      } else {
        await applyCnpjType(
          activeTab === 'EMPRESA_PARCEIRA' ? 'EMPRESA_PARCEIRA' : 'PJ',
          cleanDocument
        );
      }
    } catch (error) {
      console.error('Erro ao verificar cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível processar o documento. Tente novamente.',
      });
    } finally {
      setIsCheckingClient(false);
    }
  };

  const handleCreate = () => {
    // Abre diretamente o formulário tradicional
    handleManualCreate();
  };

  const handleManualCreate = () => {
    resetForm();
    // Padrão: campos ocultos até clicar em "Avançar"
    setShowFields(false);
    setShowTypeModal(false);
    setExistingClient(null);
    setDocumentType(null);
    // Limpa o rastreamento do modal ao criar novo cliente
    typeModalOpenedForDocument.current = null;
    isOpeningTypeModal.current = false;
    setIsCreateOpen(true);
  };

  const handleEdit = async (client: Client) => {
    console.log('[handleEdit] 🚀 Carregando dados do cliente para edição:', {
      id: client.id,
      name: client.name,
      type: client.type,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      state: client.state,
      streetAddress: client.streetAddress,
      addressNumber: client.addressNumber,
      addressComplement: client.addressComplement,
      neighborhood: client.neighborhood,
      zipCode: client.zipCode,
      // logoUrl: client.logoUrl,
      allFields: Object.keys(client),
    });

 // Correção: Buscar cliente completo individualmente para garantir todos os campos
    let clientData = client;
    try {
      const res = await apiRequest(
        'GET',
        `/api/clients/${client.id}`,
        undefined
      );
      clientData = (await res.json()) as Client;
      console.log('[handleEdit] Cliente completo carregado:', {
        id: clientData.id,
        allFields: Object.keys(clientData),
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        streetAddress: clientData.streetAddress,
        addressNumber: clientData.addressNumber,
        addressComplement: clientData.addressComplement,
        neighborhood: clientData.neighborhood,
        zipCode: clientData.zipCode,
      });
    } catch (error) {
      console.warn(
        '[handleEdit] ⚠️ Erro ao buscar cliente completo, usando dados da lista:',
        error
      );
      // Se falhar, usa os dados da lista mesmo
    }

    // Apply masks to values from backend for consistent UX
    const maskedDocument = clientData.document
      ? clientData.type === 'PF'
        ? maskCPF(clientData.document)
        : maskCNPJ(clientData.document)
      : '';

    // Carrega TODOS os dados do banco, incluindo campos que podem estar null
    const formDataToSet = {
      name: clientData.name || '',
      type: clientData.type || 'PF', // Garante que sempre tenha um tipo
      document: maskedDocument,
      email: clientData.email || '',
      phone: clientData.phone ? maskPhone(clientData.phone) : '',
      // logoUrl: clientData.logoUrl || '', // Adicionar logoUrl que estava faltando
      address: clientData.address || '',
      city: clientData.city || '',
      state: clientData.state || '',
      ratTemplateId: clientData.ratTemplateId || '',
      // Campos EMPRESA_PARCEIRA - todos os campos, mesmo se null
      legalName: clientData.legalName || '',
      municipalRegistration: clientData.municipalRegistration || '',
      stateRegistration: clientData.stateRegistration || '',
      zipCode: clientData.zipCode ? maskCEP(clientData.zipCode) : '',
      streetAddress: clientData.streetAddress || '',
      addressNumber: clientData.addressNumber || '',
      addressComplement: clientData.addressComplement || '',
      neighborhood: clientData.neighborhood || '',
      // Campos de ciclo de pagamento
      paymentCycleStartDay: clientData.paymentCycleStartDay ?? 1,
      paymentCycleEndDay: clientData.paymentCycleEndDay ?? 30,
      paymentDueDay: clientData.paymentDueDay ?? 5,
      // Campos de valores padrão
 // Correção: Converter número decimal (ex: 120.00) para formato de centavos (ex: "12000")
      // maskCurrency espera receber uma string de números sem formatação que representa centavos
      defaultTicketValue: clientData.defaultTicketValue
        ? maskCurrency(
            Math.round(Number(clientData.defaultTicketValue) * 100).toString()
          )
        : '',
      defaultHoursIncluded: clientData.defaultHoursIncluded ?? 3,
      defaultKmRate: clientData.defaultKmRate
        ? maskCurrency(
            Math.round(Number(clientData.defaultKmRate) * 100).toString()
          )
        : '',
      defaultAdditionalHourRate: clientData.defaultAdditionalHourRate
        ? maskCurrency(
            Math.round(
              Number(clientData.defaultAdditionalHourRate) * 100
            ).toString()
          )
        : '',
      // Campos de planilha mensal
      monthlySpreadsheet: clientData.monthlySpreadsheet ?? false,
      spreadsheetEmail: clientData.spreadsheetEmail || '',
      spreadsheetDay: clientData.spreadsheetDay ?? 1,
    };

    console.log(
      '[handleEdit] 📋 Dados do formulário que serão aplicados:',
      formDataToSet
    );

    setFormData(formDataToSet);

    // Garante que os campos sejam mostrados na edição
    setShowFields(true);

    // Se está editando PF e tem CEP/endereço, mostrar campos de endereço
    if (clientData.type === 'PF' && (clientData.zipCode || clientData.streetAddress || clientData.city)) {
    }
    
    // Define a aba ativa baseado no tipo do cliente
    setActiveTab(clientData.type || 'PF');
    setEditingClient(clientData);

    // Limpa estados de cadastro automático
    setExistingClient(null);
    setDocumentType(null);
  };

  // Busca de CNPJ agora é feita manualmente através do botão "Avançar"
  // Este useEffect foi desabilitado para não fazer busca automática

  /**
   * Função auxiliar para buscar dados do CNPJ na API e preencher campos
   * Retorna true se encontrou dados, false caso contrário
   */
  const fetchAndFillCnpjData = async (cnpj: string): Promise<boolean> => {
    // Remove a máscara para buscar
    const cleanCnpj = unmaskCNPJ(cnpj);

    // Valida se tem 14 dígitos
    if (cleanCnpj.length !== 14) {
      return false;
    }

    try {
      const data = await fetchCnpjData(cleanCnpj);

      if (data) {
        // Debug: log dos dados recebidos
        console.log('[CNPJ API] Dados recebidos:', {
          email: data.email,
          complemento: data.complemento,
          qsa: data.qsa,
        });

        // Auto-preenche os campos apenas se estiverem vazios
        setFormData((prev) => {
          const updated = { ...prev };

          // Razão Social (legalName)
          if (
            data.razao_social &&
            (!prev.legalName || prev.legalName.trim() === '')
          ) {
            updated.legalName = data.razao_social;
          }

          // Nome Fantasia (name) - se não vier da API, usa Razão Social antes de cair em "N/C"
          if (!prev.name || prev.name.trim() === '') {
            const fantasia = data.nome_fantasia?.trim();
            const razao = data.razao_social?.trim();

            if (fantasia) {
              updated.name = fantasia;
            } else if (razao) {
              // Quando não existe nome fantasia, usamos a razão social também como nome de exibição
              updated.name = razao;
            } else {
              updated.name = 'N/C';
            }
          }

          // CEP (apenas preenche o campo, endereço será buscado depois)
          if (data.cep && (!prev.zipCode || prev.zipCode.trim() === '')) {
            updated.zipCode = maskCEP(data.cep);
          }

          // Complemento - vem direto do CNPJ
          if (data.complemento) {
            const complementoValue = String(data.complemento).trim();
            if (
              complementoValue &&
              (!prev.addressComplement || prev.addressComplement.trim() === '')
            ) {
              updated.addressComplement = complementoValue;
              console.log(
                '[CNPJ API] Complemento preenchido:',
                complementoValue
              );
            }
          }

          // Número
          if (
            data.numero &&
            (!prev.addressNumber || prev.addressNumber.trim() === '')
          ) {
            updated.addressNumber = data.numero;
          }

          // Telefone (combina DDD + telefone se disponível)
          if (
            data.ddd_telefone_1 &&
            (!prev.phone || prev.phone.trim() === '')
          ) {
            // A API pode retornar já formatado ou separado
            let phoneValue = data.ddd_telefone_1;
            // Se não tem formatação, adiciona
            if (!phoneValue.includes('(') && !phoneValue.includes(')')) {
              // Tenta extrair DDD e número
              const phoneDigits = phoneValue.replace(/\D/g, '');
              if (phoneDigits.length >= 10) {
                const ddd = phoneDigits.slice(0, 2);
                const number = phoneDigits.slice(2);
                if (number.length === 8) {
                  phoneValue = `(${ddd}) ${number.slice(0, 4)}-${number.slice(
                    4
                  )}`;
                } else if (number.length === 9) {
                  phoneValue = `(${ddd}) ${number.slice(0, 5)}-${number.slice(
                    5
                  )}`;
                }
              }
            }
            updated.phone = maskPhone(phoneValue);
          }

          // Email - preenche se vier da API e estiver vazio
          // A API da BrasilAPI geralmente retorna email como null, mas pode vir em alguns casos
          // Verifica primeiro no campo direto, depois no QSA (quadro de sócios)
          if (!prev.email || prev.email.trim() === '') {
            if (data.email && data.email !== null && data.email.trim() !== '') {
              updated.email = data.email.trim();
            } else if (
              data.qsa &&
              Array.isArray(data.qsa) &&
              data.qsa.length > 0
            ) {
              // Busca email no primeiro sócio que tiver email
              const socioComEmail = data.qsa.find(
                (socio: any) =>
                  socio.email &&
                  socio.email !== null &&
                  socio.email.trim() !== ''
              );
              if (socioComEmail?.email) {
                updated.email = socioComEmail.email.trim();
              }
            }
          }

          return updated;
        });

        // Depois de atualizar o CEP, tenta completar endereço via BrasilAPI
        if (data.cep) {
          try {
            const cepInfo = await fetchCepData(data.cep);
            if (cepInfo) {
              setFormData((prev) => {
                const updated = { ...prev };
                if (!prev.streetAddress || prev.streetAddress.trim() === '') {
                  updated.streetAddress = cepInfo.street;
                }
                if (!prev.neighborhood || prev.neighborhood.trim() === '') {
                  updated.neighborhood = cepInfo.neighborhood;
                }
                if (!prev.city || prev.city.trim() === '') {
                  updated.city = cepInfo.city;
                }
                if (!prev.state || prev.state.trim() === '') {
                  updated.state = cepInfo.state.toUpperCase();
                }
                // Complemento - preenche se vier da API e estiver vazio
                if (
                  cepInfo.complement &&
                  (!prev.addressComplement ||
                    prev.addressComplement.trim() === '')
                ) {
                  updated.addressComplement = cepInfo.complement;
                }
                return updated;
              });
            }
          } catch (error) {
            console.error('Erro ao buscar CEP na BrasilAPI após CNPJ:', error);
            // Se der erro, mantemos apenas os dados do CNPJ (já aplicados acima se existirem)
          }
        } else {
          // Sem CEP: usa apenas dados retornados pelo CNPJ
          setFormData((prev) => {
            const updated = { ...prev };
            if (
              data.logradouro &&
              (!prev.streetAddress || prev.streetAddress.trim() === '')
            ) {
              updated.streetAddress = data.logradouro;
            }
            if (
              data.bairro &&
              (!prev.neighborhood || prev.neighborhood.trim() === '')
            ) {
              updated.neighborhood = data.bairro;
            }
            if (data.municipio && (!prev.city || prev.city.trim() === '')) {
              updated.city = data.municipio;
            }
            if (data.uf && (!prev.state || prev.state.trim() === '')) {
              updated.state = data.uf.toUpperCase();
            }
            return updated;
          });
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      return false;
    }
  };

  /**
   * Handler para buscar dados do CNPJ quando o usuário sair do campo
   */
  const handleCnpjBlur = async () => {
    // Só busca se for PJ ou EMPRESA_PARCEIRA
    if (formData.type !== 'PJ' && formData.type !== 'EMPRESA_PARCEIRA') {
      return;
    }

    // Pega o valor atual do campo CNPJ (já está mascarado)
    const cnpjValue = formData.document;

    if (!cnpjValue || cnpjValue.trim() === '') {
      return;
    }

    // Remove a máscara para buscar
    const cleanCnpj = unmaskCNPJ(cnpjValue);

    // Valida se tem 14 dígitos
    if (cleanCnpj.length !== 14) {
      return;
    }

    setIsLoadingCnpj(true);

    try {
      const found = await fetchAndFillCnpjData(cnpjValue);

      if (found) {
        toast({
          title: 'Dados encontrados!',
          description: 'Os dados da empresa foram preenchidos automaticamente.',
        });
      } else {
        toast({
          title: 'CNPJ não encontrado',
          description:
            'Não foi possível encontrar dados para este CNPJ. Preencha manualmente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      toast({
        title: 'Erro ao buscar CNPJ',
        description:
          'Ocorreu um erro ao buscar os dados. Tente novamente ou preencha manualmente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};

    // Validação de campos obrigatórios básicos
    if (!formData.name?.trim()) errors.name = true;
    if (!formData.phone?.trim()) errors.phone = true;
    if (!formData.city?.trim()) errors.city = true;
    if (!formData.state?.trim()) errors.state = true;

    // Se for PJ ou EMPRESA_PARCEIRA, outros campos podem ser obrigatórios dependendo da regra de negócio
    // mas por enquanto focamos nos básicos comuns.

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: 'Por favor, preencha todos os campos destacados em vermelho.',
      });
      return;
    }

    setFormErrors({});

    // Unmask values before sending to API
    // IMPORTANTE: Construir objeto explicitamente garantindo tipos corretos
    // Campos obrigatórios: name, type, phone, city, state (com defaults)
    // Campos opcionais: enviar null se vazio (não string vazia)
    const baseData: any = {
      // Campos obrigatórios - sempre presentes
      name: (formData.name?.trim() || '').trim(),
      type: formData.type,
      phone: (unmaskPhone(formData.phone) || '').trim(),
      city: (formData.city?.trim() || '').trim(),
      state: (formData.state?.trim() || '').trim(),
      // Campos opcionais básicos - null se vazio
      document: formData.document
        ? formData.type === 'PF'
          ? unmaskCPF(formData.document)
          : unmaskCNPJ(formData.document)
        : null,
      email: formData.email?.trim() || null,
      // logoUrl: formData.logoUrl?.trim() || null,
      address: formData.address?.trim() || null,
      zipCode: formData.zipCode ? unmaskCEP(formData.zipCode) : null,
      streetAddress: formData.streetAddress?.trim() || null,
      addressNumber: formData.addressNumber?.trim() || null,
      addressComplement: formData.addressComplement?.trim() || null,
      neighborhood: formData.neighborhood?.trim() || null,
    };

    // Campos específicos de PJ/EMPRESA_PARCEIRA - só incluir se não for PF
    if (formData.type !== 'PF') {
      baseData.legalName = formData.legalName?.trim() || null;
      baseData.municipalRegistration = formData.municipalRegistration?.trim() || null;
      baseData.stateRegistration = formData.stateRegistration?.trim() || null;
      baseData.ratTemplateId =
        formData.type === 'EMPRESA_PARCEIRA'
          ? formData.ratTemplateId || null
          : null;
      baseData.paymentCycleStartDay = formData.paymentCycleStartDay || null;
      baseData.paymentCycleEndDay = formData.paymentCycleEndDay || null;
      baseData.paymentDueDay = formData.paymentDueDay || null;
      baseData.defaultHoursIncluded = formData.defaultHoursIncluded || null;
      baseData.monthlySpreadsheet = formData.monthlySpreadsheet || false;
      baseData.spreadsheetEmail = formData.spreadsheetEmail?.trim() || null;
      baseData.spreadsheetDay = formData.spreadsheetDay || null;
      // Valores monetários: enviar null se vazio, string se preenchido (formato "120.00" com ponto)
      baseData.defaultTicketValue = formData.defaultTicketValue && formData.defaultTicketValue.trim()
        ? unmaskCurrency(String(formData.defaultTicketValue))
        : null;
      baseData.defaultKmRate = formData.defaultKmRate && formData.defaultKmRate.trim()
        ? unmaskCurrency(String(formData.defaultKmRate))
        : null;
      baseData.defaultAdditionalHourRate = formData.defaultAdditionalHourRate && formData.defaultAdditionalHourRate.trim()
        ? unmaskCurrency(String(formData.defaultAdditionalHourRate))
        : null;
    }

    const dataToSubmit = baseData;

    if (editingClient) {
      await updateMutation.mutateAsync({
        id: editingClient.id,
        data: dataToSubmit,
      });
    } else {
      await createMutation.mutateAsync(dataToSubmit);
    }
  };

  // Função parseClientText removida - funcionalidade de texto colado desativada
  const parseClientText_DISABLED = () => {
    console.log('[DEBUG] ========================================');
    console.log('[DEBUG] 🚀 INICIANDO PARSE DE TEXTO');
    console.log(
      '[DEBUG] Texto original (primeiros 500 chars):',
      (rawClientText || '').substring(0, 500)
    );

    // Limpa o texto: remove caracteres invisíveis e normaliza quebras de linha
    const cleanedText = (rawClientText || '')
      .replace(/\r\n/g, '\n') // Normaliza quebras de linha Windows
      .replace(/\r/g, '\n') // Normaliza quebras de linha Mac
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .trim();
    const text = cleanedText;
    const lowered = text.toLowerCase();
    const lines = text.split(/\n/).map((l) => l.trim());

    console.log(
      '[DEBUG] Texto limpo (primeiros 500 chars):',
      text.substring(0, 500)
    );
    console.log('[DEBUG] Total de linhas:', lines.length);
    console.log('[DEBUG] Primeiras 20 linhas:', lines.slice(0, 20));
    console.log('[DEBUG] ========================================');

    // Palavras e frases que devem ser ignoradas no preenchimento, mas usadas como marcadores
    const ignoredTerms = [
      'cliente',
      'dados de contato',
      'dados',
      'contato',
      'informações fiscais',
      'informações',
      'fiscais',
      'endereço',
      'endereco',
      'nome',
      'e-mail',
      'email',
      'telefone',
      'cpf',
      'cnpj',
      'cep',
      'rua / logradouro',
      'rua/logradouro',
      'rua logradouro',
      'rua',
      'logradouro',
      'número',
      'numero',
      'nº',
      'n░',
      'complemento',
      'bairro / distrito',
      'bairro/distrito',
      'bairro',
      'distrito',
      'cidade',
      'uf / estado',
      'uf/estado',
      'uf',
      'estado',
      'município',
      'municipio',
    ];

    // Termos relacionados a endereço que devem ser rejeitados no campo nome
    const addressRelatedTerms = [
      'torre',
      'apto',
      'apartamento',
      'bloco',
      'sala',
      'andar',
      'casa',
      'lote',
      'quadra',
      'avenida',
      'rua',
      'estrada',
      'rodovia',
      'praça',
      'travessa',
      'alameda',
      'viela',
      'passagem',
      'logradouro',
      'protásio',
      'protasio',
      'alves',
      'morro',
      'santana',
      'porto',
      'alegre',
    ];

    // Função auxiliar para verificar se uma linha contém termos de endereço
    const containsAddressTerms = (line: string): boolean => {
      const normalized = line.toLowerCase();
      return addressRelatedTerms.some((term) => normalized.includes(term));
    };

    // Função auxiliar para verificar se uma linha é um termo ignorado
    const isIgnoredTerm = (line: string): boolean => {
      const normalized = line.toLowerCase().trim();
      return ignoredTerms.some((term) => {
        // Verifica se a linha é exatamente o termo ou começa com o termo seguido de ":" ou "-"
        return (
          normalized === term ||
          normalized === `${term}:` ||
          normalized === `${term}-` ||
          normalized.match(
            new RegExp(
              `^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\-]?$`,
              'i'
            )
          )
        );
      });
    };

    // Email
    const emailMatch = text.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );

    // Telefone
    const phoneMatch = text.replace(/[^\d]/g, '').match(/(\d{10,13})/);

    // Extrair razão social PRIMEIRO para poder ignorá-la na busca de documento
    // (será definida mais abaixo, mas declaramos aqui para usar na busca de documento)
    let legalNameMatch = null;

    // Tipo de cliente
    const detectedType =
      lowered.includes('empresa parceira') || lowered.includes('parceira')
        ? 'EMPRESA_PARCEIRA'
        : lowered.includes('pj') ||
          lowered.includes('jurídica') ||
          lowered.includes('juridica')
        ? 'PJ'
        : 'PF';

    // Estado (UF) - melhorado para detectar após "UF", "Estado", ou padrão comum
    // Também detecta quando o label está em uma linha e o valor na próxima
    let stateMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.match(/^(?:uf\s*\/?\s*estado|uf|estado)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.match(/^[A-Z]{2}$/)) {
            stateMatch = nextLine;
            break;
          }
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta os padrões originais
    if (!stateMatch) {
      stateMatch =
        text.match(
          /\b(?:uf\s*\/?\s*estado|uf|estado)[:\-]?\s*([A-Z]{2})\b/i
        )?.[1] ||
        text.match(
          /\b([A-Z]{2})\b(?=\s*(?:$|\n|,|\.|;|Cidade|Bairro|CEP|Endereço))/i
        )?.[1] ||
        text.match(/\b([A-Z]{2})\b(?!\w)/)?.[1];
    }

    // Cidade - melhorado para detectar após "Cidade" ou padrões comuns
    // Também detecta quando o label está em uma linha e o valor na próxima
    let cityMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.match(/^(?:cidade|município|municipio)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (
            nextLine &&
            !isIgnoredTerm(nextLine) &&
            !nextLine.match(
              /^(?:uf|estado|cep|bairro|distrito|número|numero)/i
            ) &&
            !nextLine.match(/^[A-Z]{2}$/) // Não é só uma UF
          ) {
            cityMatch = nextLine;
            break;
          }
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta os padrões originais
    if (!cityMatch) {
      cityMatch =
        text.match(
          /(?:cidade|município|municipio)[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\n]|$)/i
        )?.[1] ||
        text.match(
          /(?:cidade|município|municipio)[:\-]?\s*([A-Za-zÀ-ÿ\s]+)/i
        )?.[1];
    }

    // CEP - formato 00000-000 ou 00000000
    // Também detecta quando o label está em uma linha e o valor na próxima
    let cepMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.match(/^(?:cep)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.match(/^\d{5}-?\d{3}$/)) {
            cepMatch = nextLine;
            break;
          }
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta os padrões originais
    if (!cepMatch) {
      cepMatch =
        text.match(/\b(?:cep)[:\-]?\s*(\d{5}-?\d{3})\b/i)?.[1] ||
        text.match(/\b(\d{5}-?\d{3})\b/)?.[1] ||
        text.match(/\b(\d{8})\b/)?.[1];
    }

    // Nome Fantasia - PRIORIDADE 0: Detecção direta quando encontra label "Nome fantasia"
    // Esta é a forma mais confiável - quando o label está presente, pega a próxima linha
    let nomeFantasiaMatch = null;
    console.log('[DEBUG] 🔍 INICIANDO BUSCA POR NOME FANTASIA');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');
      const isNomeFantasiaLabel =
        normalizedLine === 'nome fantasia' ||
        normalizedLine === 'nome fantasia:' ||
        normalizedLine === 'nome fantasia-' ||
        normalizedLine.match(/^(?:nome\s*fantasia)[:\-]?$/i);

      if (isNomeFantasiaLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        console.log(
          `[DEBUG] Label "Nome fantasia" encontrado na linha ${i}, próxima linha: "${nextLine}"`
        );
        if (
          nextLine &&
          nextLine.length >= 3 &&
          !isIgnoredTerm(nextLine) &&
          !nextLine.match(
            /^(?:razão\s*social|razao\s*social|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          nomeFantasiaMatch = nextLine;
          console.log(
            `[DEBUG] Nome fantasia detectado diretamente após label: "${nomeFantasiaMatch}"`
          );
          break;
        }
      }
    }

    // Se não encontrou por label, tenta regex no texto completo
    if (!nomeFantasiaMatch) {
      const nomeFantasiaPatterns = [
        /(?:nome\s*fantasia)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+?)(?:\s*\n|$)/i,
        /(?:nome\s*fantasia)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+)/i,
      ];

      for (const pattern of nomeFantasiaPatterns) {
        const match = text.match(pattern);
        if (match && match[1]?.trim()) {
          const candidate = match[1].trim();
          if (
            candidate.length >= 3 &&
            !isIgnoredTerm(candidate) &&
            !candidate.match(
              /^(?:razão\s*social|razao\s*social|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
            ) &&
            /[A-Za-zÀ-ÿ]/.test(candidate)
          ) {
            nomeFantasiaMatch = candidate;
            console.log(
              `[DEBUG] Nome fantasia detectado por regex: "${nomeFantasiaMatch}"`
            );
            break;
          }
        }
      }
    }

    // Razão Social - PRIORIDADE 0: Detecção direta quando encontra label "Razão social"
    // Esta é a forma mais confiável - quando o label está presente, pega a próxima linha
    console.log('[DEBUG] 🔍 INICIANDO BUSCA POR RAZÃO SOCIAL');
    console.log('[DEBUG] Total de linhas:', lines.length);
    console.log('[DEBUG] Primeiras 20 linhas:', lines.slice(0, 20));

    // legalNameMatch já foi declarado acima (linha 1515)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');

      console.log(
        `[DEBUG] Linha ${i}: "${line}" | Normalizada: "${normalizedLine}"`
      );

      const isRazaoSocialLabel =
        normalizedLine === 'razão social' ||
        normalizedLine === 'razao social' ||
        normalizedLine === 'razão social:' ||
        normalizedLine === 'razao social:' ||
        normalizedLine === 'razão social-' ||
        normalizedLine === 'razao social-' ||
        normalizedLine.match(/^(?:razão\s*social|razao\s*social)[:\-]?$/i);

      console.log(
        `[DEBUG] Linha ${i} é label de razão social?`,
        isRazaoSocialLabel
      );

      if (isRazaoSocialLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        console.log(
          `[DEBUG] Label "Razão social" encontrado na linha ${i}, próxima linha: "${nextLine}"`
        );
        console.log(`[DEBUG] Validações da próxima linha:`, {
          exists: !!nextLine,
          length: nextLine?.length,
          minLength: nextLine?.length >= 3,
          isIgnoredTerm: isIgnoredTerm(nextLine),
          hasLetters: /[A-Za-zÀ-ÿ]/.test(nextLine),
          matchesOtherLabel: nextLine?.match(
            /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ),
        });

        // Validação: aceita linha que não seja um label e tenha conteúdo válido
        if (
          nextLine &&
          nextLine.length >= 3 &&
          !isIgnoredTerm(nextLine) &&
          !nextLine.match(
            /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          // Aceita se contém palavras (não é só números ou símbolos)
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          legalNameMatch = nextLine;
          console.log(
            `[DEBUG] Razão social detectada diretamente após label: "${legalNameMatch}"`
          );
          break;
        } else {
          console.log(`[DEBUG] ❌ Próxima linha rejeitada: "${nextLine}"`, {
            length: nextLine?.length,
            isIgnoredTerm: isIgnoredTerm(nextLine),
            hasLetters: /[A-Za-zÀ-ÿ]/.test(nextLine),
            matchesLabel: nextLine?.match(
              /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)/i
            ),
          });
        }
      }
    }

    console.log(
      '[DEBUG] Resultado da busca por label:',
      legalNameMatch || '(não encontrado)'
    );

    // PRIORIDADE 1: Se não encontrou por label, tenta regex no texto completo
    if (!legalNameMatch) {
      console.log('[DEBUG] Tentando regex patterns para razão social...');
      const razaoSocialPatterns = [
        /(?:razão\s*social|razao\s*social)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+?)(?:\s*\n|$)/i,
        /(?:razão\s*social|razao\s*social)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+)/i,
      ];

      for (
        let patternIndex = 0;
        patternIndex < razaoSocialPatterns.length;
        patternIndex++
      ) {
        const pattern = razaoSocialPatterns[patternIndex];
        console.log(`[DEBUG] Testando padrão ${patternIndex + 1}:`, pattern);
        const match = text.match(pattern);
        console.log(`[DEBUG] Match encontrado?`, match);

        if (match && match[1]?.trim()) {
          const candidate = match[1].trim();
          console.log(`[DEBUG] Candidato encontrado: "${candidate}"`);
          console.log(`[DEBUG] Validações do candidato:`, {
            length: candidate.length,
            minLength: candidate.length >= 3,
            isIgnoredTerm: isIgnoredTerm(candidate),
            hasLetters: /[A-Za-zÀ-ÿ]/.test(candidate),
            matchesOtherLabel: candidate.match(
              /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
            ),
          });

          // Valida que não é um label ou termo ignorado
          if (
            candidate.length >= 3 &&
            !isIgnoredTerm(candidate) &&
            !candidate.match(
              /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
            ) &&
            /[A-Za-zÀ-ÿ]/.test(candidate)
          ) {
            legalNameMatch = candidate;
            console.log(
              `[DEBUG] Razão social detectada por regex: "${legalNameMatch}"`
            );
            break;
          } else {
            console.log(`[DEBUG] ❌ Candidato rejeitado: "${candidate}"`);
          }
        }
      }
    }

    console.log(
      '[DEBUG] 🎯 RESULTADO FINAL - Razão social:',
      legalNameMatch || '(NÃO ENCONTRADO)'
    );

    // CPF/CNPJ - Extrair DEPOIS da razão social para poder ignorá-la
    // Priorizar CNPJ quando encontrado, ignorar CPF na razão social
    let docMatch = null;

    // Função auxiliar para verificar se um documento está na razão social
    const isDocumentInRazaoSocial = (doc: string): boolean => {
      if (!legalNameMatch) return false;
      const docDigits = doc.replace(/\D/g, '');
      const razaoSocialDigits = legalNameMatch.replace(/\D/g, '');
      return razaoSocialDigits.includes(docDigits);
    };

    // PRIORIDADE 1: Procurar CNPJ próximo ao label "CNPJ" (mais confiável)
    let cnpjNearLabel = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.match(/^(?:cnpj)[:\-]?$/)) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Aceita CNPJ formatado ou sem formatação
          const cnpjFormatted = nextLine.match(
            /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/
          );
          if (cnpjFormatted) {
            cnpjNearLabel = cnpjFormatted[0];
            break;
          }
          const digits14 = nextLine.replace(/\D/g, '');
          if (digits14.length === 14) {
            cnpjNearLabel = nextLine;
            break;
          }
        }
      }
    }

    if (cnpjNearLabel && !isDocumentInRazaoSocial(cnpjNearLabel)) {
      docMatch = [cnpjNearLabel];
      console.log(
        '[DEBUG] CNPJ encontrado próximo ao label CNPJ:',
        docMatch[0]
      );
    } else {
      // PRIORIDADE 2: Procurar CNPJ formatado (XX.XXX.XXX/XXXX-XX) no texto completo
      const allCnpjMatches = text.match(
        /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g
      );
      if (allCnpjMatches) {
        // Filtra CNPJs que não estão na razão social
        const validCnpj = allCnpjMatches.find(
          (cnpj) => !isDocumentInRazaoSocial(cnpj)
        );
        if (validCnpj) {
          docMatch = [validCnpj];
          console.log(
            '[DEBUG] CNPJ formatado encontrado (fora da razão social):',
            docMatch[0]
          );
        }
      }

      if (!docMatch) {
        // PRIORIDADE 3: Procurar CNPJ sem formatação (14 dígitos) - mas não na razão social
        const all14DigitMatches = text.match(/\b\d{14}\b/g);
        if (all14DigitMatches) {
          // Filtra CNPJs que não estão na razão social
          const validCnpj = all14DigitMatches.find(
            (cnpj) => !isDocumentInRazaoSocial(cnpj)
          );
          if (validCnpj) {
            docMatch = [validCnpj];
            console.log(
              '[DEBUG] CNPJ sem formatação encontrado (fora da razão social):',
              docMatch[0]
            );
          }
        }
      }

      if (!docMatch) {
        // PRIORIDADE 4: Procurar CPF formatado (XXX.XXX.XXX-XX) - mas não na razão social
        const allCpfMatches = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g);
        if (allCpfMatches) {
          // Filtra CPFs que não estão na razão social
          const validCpf = allCpfMatches.find(
            (cpf) => !isDocumentInRazaoSocial(cpf)
          );
          if (validCpf) {
            docMatch = [validCpf];
            console.log(
              '[DEBUG] CPF formatado encontrado (fora da razão social):',
              docMatch[0]
            );
          }
        }
      }

      if (!docMatch) {
        // PRIORIDADE 5: Procurar CPF sem formatação (11 dígitos) - mas não na razão social
        const all11DigitMatches = text.match(/\b\d{11}\b/g);
        if (all11DigitMatches) {
          // Filtra CPFs que não estão na razão social
          const validCpf = all11DigitMatches.find(
            (cpf) => !isDocumentInRazaoSocial(cpf)
          );
          if (validCpf) {
            docMatch = [validCpf];
            console.log(
              '[DEBUG] CPF sem formatação encontrado (fora da razão social):',
              docMatch[0]
            );
          }
        }
      }
    }

    if (!docMatch) {
      console.log('[DEBUG] ⚠️ Nenhum documento (CPF/CNPJ) encontrado no texto');
    }

    // Rua/Logradouro - Sistema de scoring baseado em análise contextual
    let addressMatch = null;
    let bestAddressScore = 0;

    // Função para calcular score de probabilidade de ser um endereço (rua/logradouro)
    const calculateAddressScore = (line: string, index: number): number => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) return 0;

      let score = 0;

      // Deve ter pelo menos 2 palavras
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 2) return 0;
      score += words.length * 3;

      // Bonus por conter palavras-chave de endereço
      const addressKeywords = [
        'avenida',
        'av',
        'rua',
        'estrada',
        'rodovia',
        'praça',
        'travessa',
        'alameda',
        'viela',
        'passagem',
        'logradouro',
        'protásio',
        'protasio',
        'alves',
        'brig',
        'faria',
        'lima',
        'são',
        'paulo',
        'santos',
        'silva',
        'oliveira',
      ];
      const hasAddressKeyword = addressKeywords.some((keyword) =>
        trimmed.toLowerCase().includes(keyword)
      );
      if (hasAddressKeyword) {
        score += 30; // Bonus alto por ter palavra-chave de endereço
      }

      // Deve ter pelo menos 50% de letras (endereços podem ter números)
      const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
      const letterRatio = letterCount / trimmed.length;
      if (letterRatio >= 0.5) {
        score += letterRatio * 15;
      } else {
        return 0; // Rejeita se tiver muitos números/caracteres especiais
      }

      // Penalidades
      if (isIgnoredTerm(trimmed)) return 0;
      if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
      if (/^\d+$/.test(trimmed)) return 0; // Rejeita só números
      if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF
      if (
        trimmed.match(
          /^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento)/i
        )
      )
        return 0;

      // Bonus por contexto: se está após label de rua/logradouro
      const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
      const normalizedPrevLine = prevLine.replace(/\s+/g, ' ');
      const isAfterRuaLabel =
        normalizedPrevLine === 'rua / logradouro' ||
        normalizedPrevLine === 'rua/logradouro' ||
        normalizedPrevLine === 'rua logradouro' ||
        normalizedPrevLine.match(/^rua\s*\/\s*logradouro$/i) ||
        (normalizedPrevLine.includes('rua') &&
          normalizedPrevLine.includes('logradouro'));

      if (isAfterRuaLabel) {
        score += 50; // Bonus máximo se está após label de rua
      } else if (prevLine.match(/^(?:endereço|endereco)[:\-]?$/)) {
        score += 20; // Bonus se está após label de endereço
      }

      // Penalidade se está após labels de outros campos (mas não rejeita completamente)
      if (
        prevLine.match(
          /^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|complemento|bairro|distrito|cidade|uf|estado)$/
        )
      ) {
        score -= 50; // Penalidade reduzida (não rejeita completamente)
      }

      // Bonus especial: se contém "Avenida" ou "Av" e tem pelo menos 2 palavras, é muito provável que seja endereço
      if (
        trimmed.toLowerCase().match(/\b(?:avenida|av\.?)\b/) &&
        words.length >= 2
      ) {
        score += 25; // Bonus alto para endereços com "Avenida"
      }

      // Verifica se a próxima linha é um label (indica que esta linha é um valor)
      const nextLine =
        index < lines.length - 1 ? lines[index + 1].toLowerCase().trim() : '';
      if (nextLine && isIgnoredTerm(nextLine)) {
        score += 5;
      }

      return score;
    };

    // PRIORIDADE 0: Detecção direta quando encontra label "Rua / Logradouro"
    // Esta é a forma mais confiável - quando o label está presente, pega a próxima linha
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');
      const isRuaLabel =
        normalizedLine === 'rua / logradouro' ||
        normalizedLine === 'rua/logradouro' ||
        normalizedLine === 'rua logradouro' ||
        normalizedLine.match(/^rua\s*\/\s*logradouro$/i) ||
        (normalizedLine.includes('rua') &&
          normalizedLine.includes('logradouro'));

      if (isRuaLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        console.log(
          `[DEBUG] Label "Rua / Logradouro" encontrado na linha ${i}, próxima linha: "${nextLine}"`
        );
        // Validação mais permissiva - aceita qualquer linha que não seja um label
        if (
          nextLine &&
          nextLine.length >= 3 && // Reduzido de 5 para 3
          !isIgnoredTerm(nextLine) &&
          !nextLine.match(
            /^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento|endereço|endereco|rua|logradouro|e-mail|email|telefone|cpf|cnpj)/i
          ) &&
          // Aceita se contém palavras (não é só números ou símbolos)
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          addressMatch = nextLine;
          console.log(
            `[DEBUG] Endereço detectado diretamente após label: "${addressMatch}"`
          );
          break;
        } else {
          console.log(`[DEBUG] ❌ Próxima linha rejeitada: "${nextLine}"`, {
            length: nextLine?.length,
            isIgnoredTerm: isIgnoredTerm(nextLine),
            hasLetters: /[A-Za-zÀ-ÿ]/.test(nextLine),
            matchesLabel: nextLine?.match(
              /^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento|endereço|endereco|rua|logradouro|e-mail|email|telefone|cpf|cnpj)/i
            ),
          });
        }
      }
    }

    // PRIORIDADE 1: Análise contextual com scoring - procura o melhor candidato
    if (!addressMatch) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || isIgnoredTerm(line)) continue;

        const score = calculateAddressScore(line, i);
        // Debug: log para verificar scores
        if (
          line.toLowerCase().includes('avenida') ||
          line.toLowerCase().includes('protásio') ||
          line.toLowerCase().includes('protasio')
        ) {
          console.log(
            `[DEBUG] Endereço candidato: "${line}" - Score: ${score}`
          );
        }
        if (score > bestAddressScore && score > 10) {
          // Threshold mínimo reduzido para 10 pontos
          bestAddressScore = score;
          addressMatch = line;
        }
      }

      // Debug: log do resultado
      if (addressMatch) {
        console.log(
          `[DEBUG] Endereço detectado pelo scoring: "${addressMatch}" - Score: ${bestAddressScore}`
        );
      } else {
        console.log('[DEBUG] Nenhum endereço detectado pelo scoring');
      }
    }

    // PRIORIDADE 2: Se não encontrou, tenta padrões regex no texto completo
    if (!addressMatch) {
      const ruaLogradouroMatch = text.match(
        /(?:rua\s*\/\s*logradouro|rua\/logradouro|^rua\s*$)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*\n|$)/i
      );
      if (ruaLogradouroMatch && ruaLogradouroMatch[1]?.trim()) {
        addressMatch = ruaLogradouroMatch[1].trim();
        console.log(
          `[DEBUG] Endereço detectado por regex (rua/logradouro): "${addressMatch}"`
        );
      } else {
        // Procura por padrões de endereço começando com "Avenida", "Av", "Rua", etc.
        const addressPatterns = [
          /\b(?:avenida|av\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
          /\b(?:rua|r\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
          /(?:logradouro)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*\n|$)/i,
          /(?:endereço|endereco)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*[,\n]|$)/i,
        ];

        for (const pattern of addressPatterns) {
          const match = text.match(pattern);
          if (match && match[1]?.trim()) {
            const candidate = match[1].trim();
            // Valida que não é um label ou termo ignorado
            if (
              candidate.length >= 5 &&
              !isIgnoredTerm(candidate) &&
              !candidate.match(
                /^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento)/i
              )
            ) {
              addressMatch = candidate;
              console.log(
                `[DEBUG] Endereço detectado por regex: "${addressMatch}"`
              );
              break;
            }
          }
        }
      }
    }

    // Limpa o resultado
    if (addressMatch) {
      addressMatch = addressMatch.trim();
      if (
        addressMatch.length < 3 ||
        isIgnoredTerm(addressMatch) ||
        addressMatch.match(
          /^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento)/i
        )
      ) {
        addressMatch = null;
      }
    }

    // Número do endereço - Sistema de scoring melhorado
    let addressNumberMatch = null;
    let bestNumberScore = 0;

    // Função para calcular score de probabilidade de ser um número de endereço
    const calculateNumberScore = (line: string, index: number): number => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 1) return 0;

      let score = 0;

      // Deve ser principalmente números (pode ter letras no final, ex: "123A")
      const hasNumbers = /\d/.test(trimmed);
      if (!hasNumbers) return 0;

      // Bonus se é um número simples (ex: "8201")
      if (/^\d+[A-Za-z]?$/.test(trimmed)) {
        score += 30;
      }

      // Bonus se tem formato comum de número de endereço (1-5 dígitos + letra opcional)
      if (/^\d{1,5}[A-Za-z]?$/.test(trimmed)) {
        score += 20;
      }

      // Penalidades
      if (isIgnoredTerm(trimmed)) return 0;
      if (
        trimmed.match(
          /^(?:complemento|cep|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)/i
        )
      )
        return 0;
      if (/^\d{5,}$/.test(trimmed)) score -= 20; // Penaliza números muito longos (provavelmente CEP ou outro)

      // Bonus por contexto: se está após label de número
      const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
      if (prevLine.match(/^(?:número|numero|nº|n░|num\.?)[:\-]?$/)) {
        score += 50; // Bonus máximo se está após label de número
      }

      // Penalidade se está após labels de outros campos
      if (
        prevLine.match(
          /^(?:e-mail|email|telefone|cpf|cnpj|cep|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)$/
        )
      ) {
        score -= 100;
      }

      return score;
    };

    // PRIORIDADE 1: Análise contextual com scoring
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const score = calculateNumberScore(line, i);
      if (score > bestNumberScore && score > 10) {
        // Threshold mínimo de 10 pontos
        bestNumberScore = score;
        addressNumberMatch = line;
      }
    }

    // PRIORIDADE 2: Se não encontrou, tenta os padrões originais
    if (!addressNumberMatch) {
      addressNumberMatch =
        text
          .match(
            /(?:número|numero|nº|n░|num\.?)[:\-]?\s*([A-Za-z0-9\/\-]+?)(?:\s*[,\n]|$)/i
          )?.[1]
          ?.trim() ||
        text.match(/\b(?:nº|n░|num\.?)\s*([A-Za-z0-9\/\-]+)\b/i)?.[1]?.trim() ||
        text.match(/,\s*(\d+[A-Za-z]?)(?:\s*[,\n]|$)/)?.[1]?.trim() ||
        text.match(/,\s*(\d+[A-Za-z]?)\s/)?.[1]?.trim();
    }

    // Complemento - Sistema de scoring melhorado
    let complementMatch = null;
    let bestComplementScore = 0;

    // Função para calcular score de probabilidade de ser um complemento
    const calculateComplementScore = (line: string, index: number): number => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) return 0;

      let score = 0;

      // Bonus por conter palavras-chave de complemento
      const complementKeywords = [
        'torre',
        'apto',
        'apartamento',
        'bloco',
        'sala',
        'andar',
        'box',
      ];
      const hasComplementKeyword = complementKeywords.some((keyword) =>
        trimmed.toLowerCase().includes(keyword)
      );
      if (hasComplementKeyword) {
        score += 40; // Bonus alto por ter palavra-chave de complemento
      }

      // Bonus por conter números (complementos geralmente têm números)
      if (/\d/.test(trimmed)) {
        score += 20;
      }

      // Deve ter no máximo 5 palavras (complementos são geralmente curtos)
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length <= 5) {
        score += 10;
      } else {
        score -= 20; // Penaliza se for muito longo
      }

      // Penalidades
      if (isIgnoredTerm(trimmed)) return 0;
      if (
        trimmed.match(
          /^(?:bairro|distrito|cidade|uf|estado|cep|número|numero|endereço|endereco|rua|logradouro)/i
        )
      )
        return 0;
      if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
      if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF

      // Bonus por contexto: se está após label de complemento
      const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
      if (
        prevLine.match(
          /^(?:complemento|apto|apartamento|bloco|sala|andar)[:\-]?$/
        )
      ) {
        score += 50; // Bonus máximo se está após label de complemento
      }

      // Penalidade se está após labels de outros campos
      if (
        prevLine.match(
          /^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)$/
        )
      ) {
        score -= 100;
      }

      return score;
    };

    // PRIORIDADE 1: Análise contextual com scoring
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const score = calculateComplementScore(line, i);
      if (score > bestComplementScore && score > 20) {
        // Threshold mínimo de 20 pontos
        bestComplementScore = score;
        complementMatch = line;
      }
    }

    // PRIORIDADE 2: Procura padrões de complemento no texto (Torre 5 Apto 810, etc.)
    if (!complementMatch) {
      // Padrão: "Torre 5 Apto 810" ou "Apto 810" ou "Bloco A Sala 5"
      const complementPatterns = [
        /\b(?:torre|bloco)\s+[\dA-Za-z]+\s+(?:apto|apartamento|sala|andar)\s+[\dA-Za-z]+/i,
        /\b(?:apto|apartamento|apt\.?)\s+[\dA-Za-z]+(?:\s+torre\s+[\dA-Za-z]+)?/i,
        /\b(?:bloco|bl\.?)\s+[\dA-Za-z]+(?:\s+sala\s+[\dA-Za-z]+)?/i,
        /\b(?:sala|andar)\s+[\dA-Za-z]+/i,
        /\b(?:box)\s+[\dA-Za-z]+/i,
      ];

      for (const pattern of complementPatterns) {
        const match = text.match(pattern);
        if (match && match[0]) {
          complementMatch = match[0].trim();
          break;
        }
      }
    }

    // PRIORIDADE 3: Se não encontrou, tenta os padrões originais
    if (!complementMatch) {
      complementMatch =
        text
          .match(
            /(?:complemento|apto|apartamento|bloco|sala|andar)[:\-]?\s*([A-Za-z0-9\s\/\-]+?)(?:\s*[,\n]|$)/i
          )?.[1]
          ?.trim() ||
        text
          .match(
            /\b(?:apto|apartamento|bloco|sala|andar)\s*([A-Za-z0-9\s\/\-]+)\b/i
          )?.[1]
          ?.trim() ||
        text
          .match(/\b(?:apt\.?|apto|bl\.?|bloco)\s*([A-Za-z0-9\s\/\-]+)\b/i)?.[1]
          ?.trim();
    }

    // Bairro - Sistema de scoring melhorado
    let neighborhoodMatch = null;
    let bestNeighborhoodScore = 0;

    // Função para calcular score de probabilidade de ser um bairro
    const calculateNeighborhoodScore = (
      line: string,
      index: number
    ): number => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) return 0;

      let score = 0;

      // Deve ter pelo menos 1 palavra
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 1) return 0;
      score += words.length * 5;

      // Deve ter pelo menos 70% de letras
      const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
      const letterRatio = letterCount / trimmed.length;
      if (letterRatio >= 0.7) {
        score += letterRatio * 20;
      } else {
        return 0;
      }

      // Bonus por conter palavras-chave comuns de bairros
      const neighborhoodKeywords = [
        'vila',
        'jardim',
        'parque',
        'centro',
        'bairro',
        'distrito',
        'morro',
        'santana',
      ];
      const hasNeighborhoodKeyword = neighborhoodKeywords.some((keyword) =>
        trimmed.toLowerCase().includes(keyword)
      );
      if (hasNeighborhoodKeyword) {
        score += 15;
      }

      // Penalidades
      if (isIgnoredTerm(trimmed)) return 0;
      if (
        trimmed.match(
          /^(?:cidade|uf|estado|cep|número|numero|endereço|endereco|complemento|rua|logradouro)/i
        )
      )
        return 0;
      if (/^\d+$/.test(trimmed)) return 0;
      if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
      if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF

      // Bonus por contexto: se está após label de bairro
      const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
      if (
        prevLine.match(
          /^(?:bairro\s*\/?\s*distrito|bairro|distrito|vila|jardim|parque)[:\-]?$/
        )
      ) {
        score += 50; // Bonus máximo se está após label de bairro
      }

      // Penalidade se está após labels de outros campos
      if (
        prevLine.match(
          /^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|complemento|cidade|uf|estado|endereço|endereco|rua|logradouro)$/
        )
      ) {
        score -= 100;
      }

      return score;
    };

    // PRIORIDADE 1: Análise contextual com scoring
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || isIgnoredTerm(line)) continue;

      const score = calculateNeighborhoodScore(line, i);
      if (score > bestNeighborhoodScore && score > 15) {
        // Threshold mínimo de 15 pontos
        bestNeighborhoodScore = score;
        neighborhoodMatch = line;
      }
    }

    // PRIORIDADE 2: Se não encontrou, tenta os padrões originais
    if (!neighborhoodMatch) {
      neighborhoodMatch =
        text
          .match(
            /(?:bairro\s*\/?\s*distrito|bairro|distrito|vila|jardim|parque)[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\n]|$)/i
          )?.[1]
          ?.trim() ||
        text
          .match(
            /(?:bairro\s*\/?\s*distrito|bairro|distrito|vila|jardim|parque)[:\-]?\s*([A-Za-zÀ-ÿ\s]+)/i
          )?.[1]
          ?.trim() ||
        text
          .match(
            /\b(?:bairro|distrito|vila|jardim|parque)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\n]|$)/i
          )?.[1]
          ?.trim();
    }

    // Nome - Estratégia baseada em análise contextual e scoring
    let nameMatch = null;
    let bestNameScore = 0;

    // Função para calcular score de probabilidade de ser um nome próprio
    const calculateNameScore = (line: string, index: number): number => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) return 0;

      let score = 0;

      // Deve ter pelo menos 2 palavras (score base)
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 2) return 0;
      score += words.length * 5; // Mais palavras = maior score

      // Cada palavra deve começar com letra maiúscula (padrão de nome próprio)
      const wordsWithCapital = words.filter((word) => {
        const firstChar = word[0];
        return /[A-ZÀ-ÁÂÃÉÊÍÓÔÕÚÇ]/.test(firstChar);
      });
      const capitalRatio = wordsWithCapital.length / words.length;
      score += capitalRatio * 30; // Bonus por palavras com maiúscula

      // Deve ter pelo menos 70% de letras
      const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
      const letterRatio = letterCount / trimmed.length;
      if (letterRatio >= 0.7) {
        score += letterRatio * 20;
      } else {
        return 0; // Rejeita se tiver muitos números/caracteres especiais
      }

      // Penalidades
      if (containsAddressTerms(trimmed)) return 0; // Rejeita termos de endereço
      if (isIgnoredTerm(trimmed)) return 0; // Rejeita termos ignorados
      if (/\d{2,}/.test(trimmed)) score -= 50; // Penaliza números significativos
      if (trimmed.includes('@')) return 0; // Rejeita emails
      if (/^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(trimmed)) return 0; // Rejeita telefones
      if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed)) return 0; // Rejeita CPF
      if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(trimmed)) return 0; // Rejeita CNPJ
      if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP

      // Bonus por contexto: se está no início do texto (antes de seções)
      if (index < 5) score += 15; // Bonus por estar no início

      // Bonus por contexto: se a linha anterior é um label de seção ou vazia
      const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
      if (!prevLine || prevLine === '') {
        score += 10; // Bonus se linha anterior está vazia
      } else if (
        prevLine.match(/^(?:cliente|dados de contato|informações fiscais)$/)
      ) {
        score += 20; // Bonus se está após seção conhecida
      } else if (prevLine.match(/^(?:nome)[:\-]?$/)) {
        score += 50; // Bonus máximo se está após label "Nome"
      }

      // Penalidade se está após labels de outros campos
      if (
        prevLine.match(
          /^(?:e-mail|email|telefone|cpf|cnpj|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)$/
        )
      ) {
        score -= 100; // Penalidade alta
      }

      // Verifica se a próxima linha é um label (indica que esta linha é um valor)
      const nextLine =
        index < lines.length - 1 ? lines[index + 1].toLowerCase().trim() : '';
      if (nextLine && isIgnoredTerm(nextLine)) {
        score += 5; // Bonus se próxima linha é um label
      }

      return score;
    };

    // PRIORIDADE 0: Análise contextual com scoring - procura o melhor candidato
    // Analisa todas as linhas e escolhe a com maior score
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || isIgnoredTerm(line)) continue;

      const score = calculateNameScore(line, i);
      if (score > bestNameScore && score > 20) {
        // Threshold mínimo de 20 pontos
        bestNameScore = score;
        nameMatch = line;
      }
    }

    // PRIORIDADE 1: Procura por "Nome:" seguido de valor na mesma linha ou próxima
    const nomeLabelMatch = text.match(/nome[:\-]?\s*(.+?)(?:\n|$)/i);
    if (nomeLabelMatch && nomeLabelMatch[1]) {
      const candidate = nomeLabelMatch[1].trim();
      // Validação mais rigorosa: deve ter pelo menos 2 palavras e não ser só números
      const hasMultipleWords = candidate.split(/\s+/).length >= 2;
      const isMostlyLetters =
        candidate.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length >=
        candidate.length * 0.6;
      // Valida que não é um termo ignorado, label, palavra comum ou termo de endereço
      if (
        candidate &&
        candidate.length >= 5 && // Nome deve ter pelo menos 5 caracteres
        hasMultipleWords && // Deve ter pelo menos 2 palavras
        isMostlyLetters && // Deve ser principalmente letras
        !isIgnoredTerm(candidate) &&
        !containsAddressTerms(candidate) && // Não contém termos de endereço
        !candidate.match(/^\d+$/) && // Não é só números
        !candidate.match(/^\d{3,}$/) && // Não é número de 3+ dígitos
        !candidate.includes('@') &&
        !candidate.match(
          /\b(?:torre|apto|apartamento|bloco|sala|andar|número|numero|nº|n░)\b/i
        ) // Não contém palavras de complemento/número
      ) {
        nameMatch = candidate;
      }
    }

    // PRIORIDADE 2: Procura quando "Nome" está em uma linha e o valor na próxima
    if (!nameMatch) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        if (line.match(/^(?:nome)[:\-]?$/)) {
          if (i + 1 < lines.length && lines[i + 1]) {
            const nextLine = lines[i + 1].trim();
            const hasMultipleWords = nextLine.split(/\s+/).length >= 2;
            const isMostlyLetters =
              nextLine.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length >=
              nextLine.length * 0.6;
            if (
              nextLine &&
              nextLine.length >= 5 && // Nome deve ter pelo menos 5 caracteres
              hasMultipleWords && // Deve ter pelo menos 2 palavras
              isMostlyLetters && // Deve ser principalmente letras
              !isIgnoredTerm(nextLine) &&
              !containsAddressTerms(nextLine) && // Não contém termos de endereço
              !nextLine.match(/^\d+$/) && // Não é só números
              !nextLine.match(/^\d{3,}$/) && // Não é número de 3+ dígitos
              !nextLine.includes('@') &&
              !nextLine.match(
                /(?:rua|avenida|av\.?|endereço|endereco|logradouro)/i
              ) &&
              !nextLine.match(
                /\b(?:torre|apto|apartamento|bloco|sala|andar|número|numero|nº|n░)\b/i
              ) // Não contém palavras de complemento/número
            ) {
              nameMatch = nextLine;
              break;
            }
          }
        }
      }
    }

    // PRIORIDADE 3: Procura a primeira linha válida que não seja label, email, telefone, CPF, etc.
    // Usa "Dados de contato" e outras seções como marcadores para encontrar o nome antes delas
    if (!nameMatch) {
      // Procura por seções como "Dados de contato", "Cliente", etc. e pega a linha anterior
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        // Se encontrou uma seção conhecida, verifica a linha anterior
        if (
          line.match(
            /^(?:dados de contato|cliente|informações fiscais|endereço|endereco)[:\-]?$/i
          )
        ) {
          // Procura para trás até encontrar uma linha válida de nome
          for (let j = i - 1; j >= 0; j--) {
            const candidateLine = lines[j].trim();
            // Validação mais rigorosa: deve ter pelo menos 2 palavras e não ser só números
            const hasMultipleWords = candidateLine.split(/\s+/).length >= 2;
            const isMostlyLetters =
              candidateLine.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length >=
              candidateLine.length * 0.6; // Pelo menos 60% letras
            if (
              candidateLine &&
              candidateLine.length >= 5 && // Nome deve ter pelo menos 5 caracteres
              hasMultipleWords && // Deve ter pelo menos 2 palavras
              isMostlyLetters && // Deve ser principalmente letras
              !isIgnoredTerm(candidateLine) &&
              !containsAddressTerms(candidateLine) && // Não contém termos de endereço
              !candidateLine.includes('@') &&
              !candidateLine.match(/^\d+$/) && // Não é só números
              !candidateLine.match(/^\d{3,}$/) && // Não é número de 3+ dígitos
              !candidateLine.match(/\d{5,}/) && // Não contém sequência longa de números
              !candidateLine.match(
                /(?:rua|avenida|av\.?|endereço|endereco|logradouro)/i
              ) &&
              !candidateLine.match(/(?:bairro|distrito|cep|número|numero)/) &&
              !candidateLine.match(/^\(\d{2}\)\s*\d{4,5}-?\d{4}$/) && // Não é telefone
              !candidateLine.match(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/) && // Não é CPF
              !candidateLine.match(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/) && // Não é CNPJ
              !candidateLine.match(/^\d{5}-?\d{3}$/) && // Não é CEP
              !candidateLine.match(
                /\b(?:torre|apto|apartamento|bloco|sala|andar|número|numero|nº|n░)\b/i
              ) // Não contém palavras de complemento/número
            ) {
              nameMatch = candidateLine;
              break;
            }
          }
          if (nameMatch) break;
        }
      }

      // Se ainda não encontrou, procura a primeira linha válida geral
      if (!nameMatch) {
        nameMatch = lines.find((l) => {
          const line = l.toLowerCase();
          const hasMultipleWords = l.split(/\s+/).length >= 2;
          const isMostlyLetters =
            l.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length >= l.length * 0.6;
          return (
            l &&
            l.length >= 5 && // Nome deve ter pelo menos 5 caracteres
            hasMultipleWords && // Deve ter pelo menos 2 palavras
            isMostlyLetters && // Deve ser principalmente letras
            !isIgnoredTerm(l) &&
            !containsAddressTerms(l) && // Não contém termos de endereço
            !line.includes('@') &&
            !line.match(/^\d+$/) && // Não é só números
            !line.match(/^\d{3,}$/) && // Não é número de 3+ dígitos
            !line.match(/\d{5,}/) &&
            !line.match(/(?:rua|avenida|av\.?|endereço|endereco|logradouro)/) &&
            !line.match(/(?:bairro|distrito|cep|número|numero)/) &&
            !line.match(/^\(\d{2}\)\s*\d{4,5}-?\d{4}$/) && // Não é telefone
            !line.match(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/) && // Não é CPF
            !line.match(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/) && // Não é CNPJ
            !line.match(/^\d{5}-?\d{3}$/) && // Não é CEP
            !line.match(
              /\b(?:torre|apto|apartamento|bloco|sala|andar|número|numero|nº|n░)\b/i
            ) // Não contém palavras de complemento/número
          );
        });
      }
    }

    // Detecção inteligente de endereço completo em formato comum brasileiro
    // Formato: "Rua/Av X, 123 - Bairro Y - Cidade/UF - CEP"
    // Também detecta formatos como "Rua X, 123, Bairro Y, Cidade/UF, CEP"
    const fullAddressMatch = text.match(
      /(?:rua|avenida|av\.?|r\.?|estrada|rodovia|praça|travessa)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:,\s*(\d+[A-Za-z]?))?(?:\s*[-–—,]\s*([A-Za-zÀ-ÿ\s]+?))?(?:\s*[-–—,]\s*([A-Za-zÀ-ÿ\s]+?))?(?:\s*[-–—,]\s*([A-Za-zÀ-ÿ\s]+?))?(?:\s*[-–—,]\s*(\d{5}-?\d{3}))?/i
    );

    // PRIORIDADE: Se encontrou addressMatch (detecção linha por linha), usa ele
    // Caso contrário, tenta fullAddressMatch (regex no texto completo)
    // Isso garante que a detecção específica de "Rua / Logradouro" tenha prioridade
    const finalAddress = addressMatch?.trim() || fullAddressMatch?.[1]?.trim();

    // Debug: log do endereço final antes de atribuir
    console.log('[DEBUG] 🔍 Endereço final calculado:', {
      addressMatch: addressMatch?.trim() || '(não encontrado)',
      fullAddressMatch: fullAddressMatch?.[1]?.trim() || '(não encontrado)',
      finalAddress: finalAddress || '(não encontrado)',
      hasAddressMatch: !!addressMatch,
      hasFullAddressMatch: !!fullAddressMatch?.[1],
    });
    const finalNumber =
      fullAddressMatch?.[2]?.trim() || addressNumberMatch?.trim();
    const finalNeighborhood =
      fullAddressMatch?.[3]?.trim() || neighborhoodMatch?.trim();
    const finalCityState = fullAddressMatch?.[4]?.trim() || null;
    const finalCepFromAddress = fullAddressMatch?.[6]?.replace(/\D/g, '');

    // Log de resumo de todas as detecções (após todas as variáveis serem processadas)
    console.log('[DEBUG] 📋 RESUMO DETECÇÕES:', {
      nomeFantasia: nomeFantasiaMatch || '(não encontrado)',
      name: nameMatch || '(não encontrado)',
      legalName: legalNameMatch || '(não encontrado)',
      email: emailMatch ? emailMatch[0] : '(não encontrado)',
      phone: phoneMatch ? phoneMatch[0] : '(não encontrado)',
      document: docMatch ? docMatch[0] : '(não encontrado)',
      cep: cepMatch || finalCepFromAddress || '(não encontrado)',
      address: finalAddress || addressMatch || '(não encontrado)',
      number: finalNumber || addressNumberMatch || '(não encontrado)',
      complement: complementMatch || '(não encontrado)',
      neighborhood:
        finalNeighborhood || neighborhoodMatch || '(não encontrado)',
      city: cityMatch || '(não encontrado)',
      state: stateMatch || '(não encontrado)',
      type: detectedType,
    });

    setFormData((prev) => {
      // Extrai cidade e estado do campo combinado se existir
      let extractedCity = cityMatch?.trim() || prev.city;
      let extractedState = stateMatch?.toUpperCase() || prev.state;

      if (finalCityState) {
        const cityStateMatch = finalCityState.match(
          /([A-Za-zÀ-ÿ\s]+?)(?:\s*\/\s*([A-Z]{2}))?/i
        );
        if (cityStateMatch) {
          extractedCity = cityStateMatch[1]?.trim() || extractedCity;
          extractedState = cityStateMatch[2]?.toUpperCase() || extractedState;
        }
      }

      const updated = {
        ...prev,
        // Nome: prioriza Nome Fantasia, depois nameMatch, depois Razão Social, depois valor anterior
        name:
          nomeFantasiaMatch && nomeFantasiaMatch.trim()
            ? nomeFantasiaMatch.trim()
            : nameMatch &&
              nameMatch.trim() &&
              nameMatch.trim().toLowerCase() !== 'cliente'
            ? nameMatch.trim()
            : legalNameMatch && legalNameMatch.trim()
            ? legalNameMatch.trim() // Se não tem nome fantasia, usa razão social como nome
            : prev.name || '',
        // Razão Social: preenche se detectado no texto e remove CPF se presente
        legalName:
          legalNameMatch && legalNameMatch.trim()
            ? (() => {
                let finalLegalName = legalNameMatch.trim();

                // Remover CPF da razão social (formato XXX.XXX.XXX-XX ou 11 dígitos)
                // Remove CPF formatado (XXX.XXX.XXX-XX)
                finalLegalName = finalLegalName
                  .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '')
                  .trim();

                // Remove CPF sem formatação (11 dígitos consecutivos no final da string)
                // Procura por 11 dígitos no final da string (pode ter espaços antes)
                finalLegalName = finalLegalName
                  .replace(/\s+\d{11}$/g, '')
                  .trim();

                // Remove qualquer sequência de 11 dígitos que esteja isolada (com espaços antes e depois)
                finalLegalName = finalLegalName
                  .replace(/\s+\d{11}\s+/g, ' ')
                  .trim();

                // Remove espaços extras que possam ter ficado
                finalLegalName = finalLegalName.replace(/\s+/g, ' ').trim();

                console.log(
                  '[DEBUG] 🎯 Razão social original:',
                  legalNameMatch.trim()
                );
                console.log(
                  '[DEBUG] 🎯 Razão social limpa (sem CPF):',
                  finalLegalName
                );
                return finalLegalName;
              })()
            : (() => {
                console.log(
                  '[DEBUG] ⚠️ legalName não foi preenchido. Valor anterior:',
                  prev.legalName || '(vazio)'
                );
                return prev.legalName || '';
              })(),
        email: emailMatch ? emailMatch[0] : prev.email,
        phone: phoneMatch ? maskPhone(phoneMatch[0]) : prev.phone,
        document: docMatch
          ? detectedType === 'PF'
            ? maskCPF(docMatch[0])
            : maskCNPJ(docMatch[0])
          : prev.document,
        city: extractedCity || prev.city,
        state: extractedState || prev.state,
        type: detectedType as 'PF' | 'PJ' | 'EMPRESA_PARCEIRA',
        // Dados de endereço - só atualiza se encontrou valores válidos
        zipCode: finalCepFromAddress
          ? maskCEP(finalCepFromAddress)
          : cepMatch
          ? maskCEP(cepMatch.replace(/\D/g, ''))
          : prev.zipCode || '',
        streetAddress:
          finalAddress && finalAddress.trim()
            ? finalAddress.trim()
            : prev.streetAddress || '',
        // Também preenche o campo address (usado para PF/PJ) se estiver vazio
        address:
          finalAddress && finalAddress.trim()
            ? finalAddress.trim()
            : prev.address || '',
        // Preenche o campo address também quando o CEP é consultado
        // (será preenchido pela consulta do CEP se estiver vazio)
        // Debug: log do endereço atribuído
        // console.log('[DEBUG] Endereço atribuído ao formulário:', {
        //   finalAddress,
        //   prevStreetAddress: prev.streetAddress,
        //   result: finalAddress && finalAddress.trim() ? finalAddress.trim() : prev.streetAddress || '',
        // Debug: log do endereço atribuído
        // console.log('[DEBUG] Endereço atribuído ao formulário:', finalAddress);
        addressNumber:
          finalNumber && finalNumber.trim()
            ? finalNumber.trim()
            : prev.addressNumber || '',
        addressComplement:
          complementMatch && complementMatch.trim()
            ? complementMatch.trim()
            : prev.addressComplement || '',
        neighborhood:
          finalNeighborhood && finalNeighborhood.trim()
            ? finalNeighborhood.trim()
            : prev.neighborhood || '',
      };

      // Se detectou CPF/CNPJ no texto, mostra os campos e verifica se cliente existe
      // Mas NÃO abre modal se estiver editando um cliente
      if (updated.document && !editingClient) {
        const cleanDoc = updated.document.replace(/\D/g, '');
        if (cleanDoc.length === 11) {
          // CPF - mostra campos PF
          updated.type = 'PF';
          setShowFields(true);
        } else if (cleanDoc.length === 14) {
          // CNPJ - mostra modal para escolher tipo apenas se ainda não foi aberto para este documento
          // E se NÃO estiver editando um cliente
          if (
            !showTypeModal &&
            !isOpeningTypeModal.current &&
            !editingClient &&
            typeModalOpenedForDocument.current !== cleanDoc
          ) {
            isOpeningTypeModal.current = true;
            typeModalOpenedForDocument.current = cleanDoc;
            setShowTypeModal(true);
            // Reseta a flag após um pequeno delay para permitir que o modal abra
            setTimeout(() => {
              isOpeningTypeModal.current = false;
            }, 1000);
          }
        }
      }

      // Se detectou CEP no texto, consulta a API de CEP para preencher endereço automaticamente
      // IMPORTANTE: Usa setTimeout para não interferir com o setFormData atual
      if (updated.zipCode && updated.zipCode.replace(/\D/g, '').length === 8) {
        const cleanCep = updated.zipCode.replace(/\D/g, '');
        console.log(`[DEBUG] CEP detectado: ${cleanCep}, consultando API...`);
        // Consulta CEP apenas se ainda não tiver endereço completo
        // Usa setTimeout para garantir que o setFormData atual termine primeiro
        setTimeout(() => {
          setFormData((prev) => {
            // Verifica se ainda precisa preencher algum campo
            const needsStreet =
              !prev.streetAddress || prev.streetAddress.trim() === '';
            const needsNeighborhood =
              !prev.neighborhood || prev.neighborhood.trim() === '';
            const needsCity = !prev.city || prev.city.trim() === '';
            const needsState = !prev.state || prev.state.trim() === '';

            console.log(`[DEBUG] Verificando necessidade de preenchimento:`, {
              needsStreet,
              needsNeighborhood,
              needsCity,
              needsState,
              currentStreet: prev.streetAddress,
              currentNeighborhood: prev.neighborhood,
              currentCity: prev.city,
              currentState: prev.state,
            });

            // SEMPRE consulta o CEP se foi detectado, mesmo que alguns campos já estejam preenchidos
            // Isso garante que todos os campos sejam preenchidos corretamente
            fetchCepData(cleanCep)
              .then((cepInfo) => {
                console.log(`[DEBUG] Dados do CEP recebidos:`, cepInfo);
                if (cepInfo) {
                  setFormData((prevForm) => {
                    const updatedForm = { ...prevForm };
                    // Preenche apenas campos vazios para não sobrescrever dados já preenchidos
                    if (
                      !prevForm.streetAddress ||
                      prevForm.streetAddress.trim() === ''
                    ) {
                      updatedForm.streetAddress = cepInfo.street || '';
                      console.log(
                        `[DEBUG] Preenchendo rua: ${updatedForm.streetAddress}`
                      );
                    } else {
                      console.log(
                        `[DEBUG] Rua já preenchida, mantendo: ${prevForm.streetAddress}`
                      );
                    }
                    if (
                      !prevForm.neighborhood ||
                      prevForm.neighborhood.trim() === ''
                    ) {
                      updatedForm.neighborhood = cepInfo.neighborhood || '';
                      console.log(
                        `[DEBUG] Preenchendo bairro: ${updatedForm.neighborhood}`
                      );
                    } else {
                      console.log(
                        `[DEBUG] Bairro já preenchido, mantendo: ${prevForm.neighborhood}`
                      );
                    }
                    if (!prevForm.city || prevForm.city.trim() === '') {
                      updatedForm.city = cepInfo.city || '';
                      console.log(
                        `[DEBUG] Preenchendo cidade: ${updatedForm.city}`
                      );
                    }
                    if (!prevForm.state || prevForm.state.trim() === '') {
                      updatedForm.state = cepInfo.state?.toUpperCase() || '';
                      console.log(
                        `[DEBUG] Preenchendo estado: ${updatedForm.state}`
                      );
                    }
                    // Complemento - preenche se vier da API e estiver vazio
                    if (
                      cepInfo.complement &&
                      (!prevForm.addressComplement ||
                        prevForm.addressComplement.trim() === '')
                    ) {
                      updatedForm.addressComplement = cepInfo.complement;
                      console.log(
                        `[DEBUG] Preenchendo complemento: ${updatedForm.addressComplement}`
                      );
                    }
                    return updatedForm;
                  });
                } else {
                  console.log('[DEBUG] ❌ CEP não retornou dados válidos');
                }
              })
              .catch((error) => {
                console.error(
                  '[DEBUG] ❌ Erro ao buscar CEP na BrasilAPI:',
                  error
                );
              });
            return prev; // Retorna o estado atual sem alterações
          });
        }, 100); // Delay de 100ms para garantir que o setFormData atual termine
      }

      return updated;
    });
  };

  const handleExportSpreadsheet = async (clientId: string) => {
    if (
      !requirePaid({
        feature: 'Exportacao de planilhas',
        description: 'Exportacoes estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const response = await fetch(
        `/api/clients/${clientId}/financial/export?month=${currentMonth}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export spreadsheet');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planilha_${currentMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Planilha exportada',
        description: 'O arquivo foi baixado com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: 'Não foi possível exportar a planilha.',
      });
    }
  };

  const handleShareEmail = (client: Client) => {
    if (!client.spreadsheetEmail) {
      toast({
        variant: 'destructive',
        title: 'Email não configurado',
        description:
          'Configure um email para envio de planilhas nas configurações do cliente.',
      });
      return;
    }

    const subject = encodeURIComponent(`Planilha Mensal - ${client.name}`);
    const body = encodeURIComponent(
      `Olá,\n\nSegue anexa a planilha mensal de chamados.\n\nAtenciosamente,\nChamadosPro`
    );
    window.open(
      `mailto:${client.spreadsheetEmail}?subject=${subject}&body=${body}`,
      '_blank'
    );

    toast({
      title: 'Abrindo cliente de email',
      description: 'Anexe a planilha exportada ao email.',
    });
  };

  const handleShareWhatsApp = (client: Client) => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    const phone = unmaskPhone(client.phone);
    const message = encodeURIComponent(
      `Olá! Segue a planilha mensal de chamados de ${client.name}. Por favor, baixe o arquivo anexo.`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');

    toast({
      title: 'Abrindo WhatsApp',
      description: 'Envie a planilha exportada pelo WhatsApp.',
    });
  };

  const handleSendWhatsApp = (client: Client) => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!client.phone) {
      toast({
        variant: 'destructive',
        title: 'Telefone não informado',
        description: 'O cliente não possui telefone cadastrado.',
      });
      return;
    }

    const phone = unmaskPhone(client.phone);
    const message = encodeURIComponent(
      `Olá ${client.name}! Como podemos ajudar?`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handleImportClients = async () => {
    if (
      !requirePaid({
        feature: 'Importacao de clientes',
        description: 'Importacoes estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!importData.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro ao importar',
        description: 'Por favor, cole os dados para importar.',
      });
      return;
    }
    const res = await apiRequest('POST', '/api/clients/import', {
      format: importFormat,
      data: importData,
    });
    if (!res.ok) {
      const msg = (await res.text()) || 'Erro ao importar';
      toast({
        variant: 'destructive',
        title: 'Falha na importação',
        description: msg,
      });
      return;
    }
    const json = await res.json();
    toast({
      title: 'Importação concluída',
      description: `Importados: ${json.imported}. Ignorados: ${
        json.skipped.length || 0
      }.`,
    });
    setImportData('');
    setIsImportDialogOpen(false);
    debouncedInvalidate(); // Correção: Usar debounce ao invés de invalidação imediata
  };

  const handleExportClients = async (format: 'csv' | 'json') => {
    if (
      !requirePaid({
        feature: 'Exportacao de clientes',
        description: 'Exportacoes estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    const res = await fetch(`/api/clients/export?format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar clientes',
        description: 'Não foi possível exportar os clientes. Tente novamente.',
      });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'csv' ? 'clientes.csv' : 'clientes.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exportação concluída',
      description: `Arquivo ${format.toUpperCase()} baixado com sucesso.`,
    });
  };

  type ClientTypeFilter = 'ALL' | ClientTypeKey;
  const [clientTypeFilter, setClientTypeFilter] =
    useState<ClientTypeFilter>('ALL');

  const filteredClients = clients?.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);

    const matchesType =
      clientTypeFilter === 'ALL' || client.type === clientTypeFilter;

    return matchesSearch && matchesType;
  });

  const visibleClients = filteredClients || [];

  const recentClients = useMemo(() => {
    if (!clients) return [];
    const sorted = [...clients].sort((a, b) => {
      const aTime = new Date((a as any).createdAt || 0).getTime();
      const bTime = new Date((b as any).createdAt || 0).getTime();
      return bTime - aTime;
    });
    return sorted.slice(0, 6);
  }, [clients]);

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleSelectAllClients = () => {
    if (selectedClients.size === visibleClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(visibleClients.map((client) => client.id)));
    }
  };

  useEffect(() => {
    if (!clients) return;
    const validIds = new Set(clients.map((client) => client.id));
    setSelectedClients((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next;
    });
  }, [clients]);

  // DEBUG: verificar largura dos cards x largura da viewport (pode remover depois)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const viewportWidth = window.innerWidth;
    const cards = document.querySelectorAll<HTMLElement>(
      '[data-testid^="card-client-"]'
    );

    cards.forEach((card) => {
      console.log('[DEBUG][Clientes][CardWidth]', {
        id: card.dataset.testid,
        viewportWidth,
        clientWidth: card.clientWidth,
        scrollWidth: card.scrollWidth,
      });
    });
  }, [filteredClients?.length]);

  return (
    <div className='space-y-6 px-4 sm:px-0 pb-20 sm:pb-0'>
      {/* Header Moderno */}
      <PageHeader>
        <div className='px-4 sm:px-0'>
          <div className='flex flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2.5 bg-primary/10 rounded-xl sm:rounded-2xl shrink-0 ring-1 ring-primary/20'>
                <Users className='h-6 w-6 sm:h-8 sm:w-8 text-primary stroke-[2.5px]' />
              </div>
              <div className='min-w-0'>
                <h1 className='text-xl sm:text-4xl font-black leading-none tracking-tight text-slate-900 dark:text-white truncate'>
                  Clientes
                </h1>
                <p className='hidden xs:block text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mt-1 line-clamp-1'>
                  Gerencie sua base de contatos e parceiros
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <Button
                onClick={handleCreate}
                data-testid='button-new-client'
                className='h-11 sm:h-12 px-4 sm:px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2'
              >
                <Plus className='h-4 w-4 stroke-[3px]' />
                <span className='hidden sm:inline'>Novo Cliente</span>
                <span className='inline sm:hidden'>Novo</span>
              </Button>
            </div>
          </div>
        </div>
      </PageHeader>

      {/* Busca e Filtros - Estilo App Moderno */}
      <div className='flex flex-col gap-4'>
        {/* SearchBar Otimizada */}
        <div className='flex flex-col sm:flex-row items-center gap-3'>
          <div className='relative flex-1 w-full group'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5' />
            <Input
              placeholder='Buscar por nome ou documento...'
              className='pl-12 h-12 sm:h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base placeholder:text-slate-400'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid='input-search-clients'
            />
          </div>
          
          <div className='flex items-center gap-2 w-full sm:w-auto'>
            <Button
              variant='outline'
              onClick={() => setIsImportDialogOpen(true)}
              className='flex-1 sm:flex-none h-12 rounded-xl border-slate-200 dark:border-slate-800 gap-2 font-bold'
            >
              <FileCode className='h-4 w-4' />
              Importar
            </Button>
            <Button
              variant='outline'
              onClick={() => handleExportClients('csv')}
              className='flex-1 sm:flex-none h-12 rounded-xl border-slate-200 dark:border-slate-800 gap-2 font-bold'
            >
              <FileText className='h-4 w-4' />
              CSV
            </Button>
          </div>
        </div>

        {/* Filtros em Estilo Segmented Control */}
        <TooltipProvider delayDuration={2000}>
          <div className='bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl flex items-center gap-1 w-full ring-1 ring-slate-200 dark:ring-slate-800'>
            {[
              {
                id: 'ALL',
                label: 'Todos',
                count: clients?.length || 0,
                tooltip: 'Mostra todos os tipos de clientes.',
              },
              {
                id: 'PF',
                label: 'Pessoa Fisica',
                count: clientCounts.PF,
                tooltip: 'Pessoa fisica: cliente final identificado por CPF.',
              },
              {
                id: 'PJ',
                label: 'Pessoa Juridica',
                count: clientCounts.PJ,
                tooltip: 'Pessoa juridica: empresa identificada por CNPJ.',
              },
              {
                id: 'EMPRESA_PARCEIRA',
                label: 'Parceira',
                count: clientCounts.EMPRESA_PARCEIRA,
                tooltip:
                  'Empresa parceira: fornecedor ou parceiro comercial vinculado.',
              },
            ].map((item) => {
              const isActive = clientTypeFilter === item.id;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      onClick={() => setClientTypeFilter(item.id as any)}
                      className={cn(
                        'flex-1 flex items-center justify-center py-2.5 sm:h-10 gap-2 rounded-xl transition-all duration-200 font-black text-[9px] sm:text-xs min-w-0',
                        isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                          : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                      )}
                    >
                      <span className='truncate'>{item.label}</span>
                      <span
                        className={cn(
                          'text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[20px]',
                          isActive
                            ? 'bg-white/20'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {item.count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side='top'
                    className='max-w-[220px] text-xs leading-relaxed'
                  >
                    {item.tooltip}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {visibleClients.length > 0 && (
        <div className='flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3'>
          <div className='flex items-center gap-3'>
            <Checkbox
              checked={
                selectedClients.size === visibleClients.length &&
                visibleClients.length > 0
              }
              onCheckedChange={toggleSelectAllClients}
              id='select-all-clients'
            />
            <Label
              htmlFor='select-all-clients'
              className='text-sm font-semibold cursor-pointer'
            >
              Selecionar todos ({selectedClients.size} selecionados)
            </Label>
          </div>
          {selectedClients.size > 0 && (
            <Button
              variant='destructive'
              onClick={() => {
                setDeleteReason('');
                setDeleteEmail('');
                setShowDeleteConfirm(true);
              }}
              className='flex items-center gap-2'
            >
              <Trash2 className='h-4 w-4' />
              Excluir ({selectedClients.size})
            </Button>
          )}
        </div>
      )}
      {/* Dialog de Importação */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Importar / Exportar clientes</DialogTitle>
            <DialogDescription>
              Use CSV ou JSON para migrar clientes entre plataformas.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
              <div className='space-y-2 flex-1'>
                <Label>Formato da importação</Label>
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    variant={importFormat === 'csv' ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setImportFormat('csv')}
                  >
                    CSV
                  </Button>
                  <Button
                    type='button'
                    variant={importFormat === 'json' ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setImportFormat('json')}
                  >
                    JSON
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>
                  CSV: primeira linha cabeçalho. Campos sugeridos: name, email,
                  phone, type, city, state, document.
                </p>
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Dados para importar</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={
                  importFormat === 'csv'
                    ? 'name,email,phone,type,city,state,document\nMaria,maria@email.com,11999999999,PF,São Paulo,SP,123.456.789-00'
                    : '[{"name":"Maria","email":"maria@email.com","phone":"11999999999","type":"PF"}]'
                }
                className='min-h-[200px] font-mono text-sm'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsImportDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleImportClients}>Importar clientes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Client List */}
      {isLoading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className='p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'>
              <div className='flex items-center gap-4'>
                <Skeleton className='h-14 w-14 rounded-2xl' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-5 w-3/4 rounded-lg' />
                  <Skeleton className='h-4 w-1/2 rounded-lg' />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : !filteredClients || filteredClients.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] transition-all duration-300'>
          <div className='relative mb-6'>
            <div className='absolute inset-0 bg-primary/10 blur-2xl rounded-full' />
            <div className='relative p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl ring-1 ring-slate-200 dark:ring-slate-700 shadow-xl'>
              <SearchX className='h-12 w-12 text-slate-400 dark:text-slate-500' />
            </div>
          </div>
          <h3 className='text-xl sm:text-2xl font-black text-slate-900 dark:text-white text-center mb-2'>
            {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className='text-slate-500 dark:text-slate-400 text-center max-w-md font-medium text-sm sm:text-base mb-8'>
            {searchTerm 
              ? 'Não encontramos nenhum resultado para sua busca atual. Tente mudar os termos ou filtros.'
              : 'Sua base de clientes está vazia. Comece adicionando seu primeiro contato agora mesmo!'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={handleCreate}
              className='h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 gap-2'
            >
              <Plus className='h-5 w-5 stroke-[3px]' />
              // Novo Cliente
            </Button>
          )}
        </div>
       ) : (
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500'>
                Lista de clientes
              </h3>
              <span className='text-xs font-bold text-slate-400 dark:text-slate-500'>
                {filteredClients.length} clientes
              </span>
            </div>
            <div className='space-y-3'>
              {filteredClients.map((client) => (
                <Card
                  key={client.id}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-3xl border bg-white dark:bg-slate-900 p-4 sm:flex-row sm:items-center sm:gap-6 transition-all duration-200 hover:shadow-lg',
                    client.type === 'PF'
                      ? 'border-blue-100/60 dark:border-blue-900/30 hover:border-blue-400'
                      : client.type === 'PJ'
                      ? 'border-purple-100/60 dark:border-purple-900/30 hover:border-purple-400'
                      : 'border-emerald-100/60 dark:border-emerald-900/30 hover:border-emerald-400',
                    selectedClients.has(client.id) && 'ring-2 ring-primary/40'
                  )}
                  data-testid={`card-client-${client.id}`}
                  onClick={() => setViewingClient(client)}
                >
                  <div
                    className='absolute left-4 top-4 z-10 rounded-lg bg-white/90 dark:bg-slate-800/90 p-1 shadow-sm'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onCheckedChange={() => toggleClientSelection(client.id)}
                      data-testid={`checkbox-client-${client.id}`}
                    />
                  </div>

                  <div className='flex items-center gap-4 flex-1 min-w-0 pl-10'>
                    <div className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-4 ring-white dark:ring-slate-800 shadow-lg',
                      client.type === 'PF'
                        ? 'bg-blue-50 text-blue-500'
                        : client.type === 'PJ'
                        ? 'bg-purple-50 text-purple-500'
                        : 'bg-emerald-50 text-emerald-500'
                    )}>
                      {client.type === 'PF' ? (
                        <User className='h-7 w-7' />
                      ) : client.type === 'PJ' ? (
                        <Building2 className='h-7 w-7' />
                      ) : (
                        <Users className='h-7 w-7' />
                      )}
                    </div>

                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='font-black text-slate-900 dark:text-white text-lg truncate' data-testid={`text-client-name-${client.id}`}>
                          {client.name}
                        </h3>
                        <Badge
                          variant='outline'
                          className={cn(
                            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none rounded-md',
                            client.type === 'PF'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : client.type === 'PJ'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {client.type === 'PF'
                            ? 'Pessoa Fisica'
                            : client.type === 'PJ'
                            ? 'Pessoa Juridica'
                            : 'Empresa Parceira'}
                        </Badge>
                      </div>
                      <p className='text-xs text-slate-500 dark:text-slate-400 truncate'>
                        {client.email || 'E-mail nao informado'}
                      </p>
                      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400'>
                        <span className='flex items-center gap-2'>
                          <MessageCircle className='h-3.5 w-3.5' />
                          {client.phone ? maskPhone(client.phone) : 'Sem telefone'}
                        </span>
                        <span className='flex items-center gap-2'>
                          <FileText className='h-3.5 w-3.5' />
                          {client.document
                            ? client.type === 'PF'
                              ? maskCPF(client.document)
                              : maskCNPJ(client.document)
                            : 'Sem documento'}
                        </span>
                        <span className='flex items-center gap-2'>
                          <MapPin className='h-3.5 w-3.5' />
                          {client.city ? `${client.city}, ${client.state}` : 'Endereco nao informado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 sm:pl-4 sm:border-l border-slate-100 dark:border-slate-800'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-green-500 hover:text-white transition-all'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendWhatsApp(client);
                      }}
                      title='Enviar WhatsApp'
                    >
                      <MessageCircle className='h-5 w-5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-primary hover:text-white transition-all'
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreateTicketClientId(client.id);
                      }}
                      title='Novo Chamado'
                    >
                      <Ticket className='h-5 w-5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all'
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleEdit(client);
                        setIsCreateOpen(true);
                      }}
                      title='Editar'
                    >
                      <Edit className='h-5 w-5' />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {recentClients.length > 0 && (
            <div className='space-y-3'>
              <Card className='rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5'>
                <div className='flex items-center justify-between mb-4'>
                  <div>
                    <p className='text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500'>
                      Ultimos clientes adicionados
                    </p>
                    <p className='text-sm font-bold text-slate-900 dark:text-white'>
                      Recentes
                    </p>
                  </div>
                  <Badge className='bg-primary/10 text-primary border-none text-[10px] uppercase tracking-widest font-black'>
                    Novo
                  </Badge>
                </div>

                <div className='flex flex-wrap gap-2 mb-4'>
                  {recentClients.map((client) => (
                    <Avatar key={`recent-avatar-${client.id}`} className='h-10 w-10 rounded-xl ring-2 ring-white dark:ring-slate-800 shadow'>
                      {client.logoUrl ? (
                        <AvatarImage src={client.logoUrl} className='object-cover' />
                      ) : (
                        <AvatarFallback className={cn(
                          'rounded-xl font-black text-sm',
                          client.type === 'PF'
                            ? 'bg-blue-50 text-blue-500'
                            : client.type === 'PJ'
                            ? 'bg-purple-50 text-purple-500'
                            : 'bg-emerald-50 text-emerald-500'
                        )}>
                          {client.name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  ))}
                </div>

                <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                  {recentClients.map((client) => (
                    <button
                      type='button'
                      key={`recent-${client.id}`}
                      className='w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl px-2 transition-colors'
                      onClick={() => setViewingClient(client)}
                    >
                      <Avatar className='h-9 w-9 rounded-xl ring-2 ring-white dark:ring-slate-800'>
                        {client.logoUrl ? (
                          <AvatarImage src={client.logoUrl} className='object-cover' />
                        ) : (
                          <AvatarFallback className={cn(
                            'rounded-xl font-black text-xs',
                            client.type === 'PF'
                              ? 'bg-blue-50 text-blue-500'
                              : client.type === 'PJ'
                              ? 'bg-purple-50 text-purple-500'
                              : 'bg-emerald-50 text-emerald-500'
                          )}>
                            {client.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-bold text-slate-900 dark:text-white truncate'>
                          {client.name}
                        </p>
                        <p className='text-xs text-slate-500 dark:text-slate-400 truncate'>
                          {client.email || 'E-mail nao informado'}
                        </p>
                      </div>

                      <Badge
                        variant='outline'
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none rounded-md',
                          client.type === 'PF'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : client.type === 'PJ'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {client.type === 'PF'
                          ? 'PF'
                          : client.type === 'PJ'
                          ? 'PJ'
                          : 'Parceira'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Client Details Dialog */}
      <Dialog
        open={!!viewingClient}
        onOpenChange={(open) => !open && setViewingClient(null)}
      >
        <DialogContent className='max-w-4xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-[2.5rem]'>
          <DialogHeader className='sr-only'>
            <DialogTitle>Detalhes do cliente</DialogTitle>
            <DialogDescription>
              Informacoes completas do cliente selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-6'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-primary/10 rounded-xl'>
                <User className='h-5 w-5 text-primary' />
              </div>
              <h2 className='text-xl font-black text-slate-900 dark:text-white'>
                Detalhes do Cliente
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                onClick={async () => {
                  await handleEdit(viewingClient!);
                  setViewingClient(null);
                }}
                className='h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-2'
                data-testid='button-details-edit'
              >
                <Edit3 className='h-4 w-4' />
                <span className='hidden sm:inline'>Editar</span>
              </Button>
            </div>
          </div>

          {viewingClient && (
            <div className='flex-1 overflow-y-auto custom-scrollbar'>
              <div className='p-6'>
                <div className='flex flex-col sm:flex-row items-center gap-6 mb-8'>
                  <div className='relative'>
                    <div className='absolute inset-0 bg-primary/20 blur-2xl rounded-full' />
                    {viewingClient.logoUrl ? (
                      <Avatar className='h-24 w-24 sm:h-32 sm:w-32 rounded-3xl ring-4 ring-white dark:ring-slate-800 shadow-2xl shrink-0'>
                        <AvatarImage src={viewingClient.logoUrl} className='object-cover' />
                        <AvatarFallback className='rounded-3xl font-black text-3xl bg-primary/10 text-primary'>
                          {viewingClient.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className='flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-800 shadow-2xl shrink-0'>
                        {viewingClient.type === 'PF' ? <User className='h-12 w-12 text-blue-500' /> :
                         viewingClient.type === 'PJ' ? <Building2 className='h-12 w-12 text-purple-500' /> :
                         <Users className='h-12 w-12 text-emerald-500' />}
                      </div>
                    )}
                  </div>

                  <div className='flex-1 text-center sm:text-left min-w-0'>
                    <h2 className='text-3xl font-black text-slate-900 dark:text-white truncate mb-2'>
                      {viewingClient.name}
                    </h2>
                    <div className='flex flex-wrap justify-center sm:justify-start gap-2 mb-3'>
                      <Badge className={cn(
                        'text-[10px] font-black uppercase tracking-widest px-3 py-1 border-none rounded-full',
                        viewingClient.type === 'PF' ? 'bg-blue-500 text-white' :
                        viewingClient.type === 'PJ' ? 'bg-purple-500 text-white' :
                        'bg-emerald-500 text-white'
                      )}>
                        {viewingClient.type === 'PF' ? 'Pessoa Física' : 
                         viewingClient.type === 'PJ' ? 'Pessoa Jurídica' : 
                         'Empresa Parceira'}
                      </Badge>
                      {(viewingClient as any).createdAt && (
                        <Badge variant='outline' className='text-[10px] font-bold border-slate-200 dark:border-slate-700 text-slate-500'>
                          Desde {new Date((viewingClient as any).createdAt).toLocaleDateString('pt-BR')}
                        </Badge>
                      )}
                    </div>
                    <p className='text-slate-500 dark:text-slate-400 font-medium'>
                      {viewingClient.email || 'E-mail não informado'}
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {[
                    { label: 'Documento', value: viewingClient.type === 'PF' ? maskCPF(viewingClient.document) : maskCNPJ(viewingClient.document), icon: FileText },
                    { label: 'Telefone', value: maskPhone(viewingClient.phone), icon: MessageCircle },
                    { label: 'Cidade/Estado', value: viewingClient.city ? `${viewingClient.city}, ${viewingClient.state}` : 'N/A', icon: MapPin },
                    { label: 'CEP', value: viewingClient.zipCode || 'N/A', icon: MapPin },
                    { label: 'Endereço', value: viewingClient.address || 'N/A', icon: MapPin, full: true },
                  ].map((field, idx) => (
                    <div key={idx} className={cn(
                      'p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800',
                      field.full && 'sm:col-span-2 lg:col-span-3'
                    )}>
                      <div className='flex items-center gap-2 mb-1'>
                        <field.icon className='h-3.5 w-3.5 text-slate-400' />
                        <span className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
                          {field.label}
                        </span>
                      </div>
                      <p className='text-sm font-bold text-slate-900 dark:text-white'>
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className='p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3'>
            <Button
              variant='outline'
              onClick={() => setViewingClient(null)}
              className='flex-1 h-12 rounded-2xl font-bold border-slate-200 dark:border-slate-800'
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (!requirePaid({
                  feature: 'Envio por WhatsApp',
                  description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
                })) {
                  return;
                }
                const phone = unmaskPhone(viewingClient!.phone);
                const message = encodeURIComponent(`Olá ${viewingClient!.name}! Como posso ajudar?`);
                window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
              }}
              className='flex-[2] h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black gap-2 shadow-lg shadow-green-500/20'
            >
              <MessageCircle className='h-5 w-5' />
              Enviar WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para confirmar sobrescrita de cliente duplicado */}
      <AlertDialog
        open={duplicateClientModal?.open === true}
        onOpenChange={(open) => {
          // Quando o modal fecha (por exemplo, após confirmar), apenas limpamos o estado.
          // A lógica de cancelar já é tratada explicitamente no botão "Não".
          if (!open) {
            setDuplicateClientModal(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente já cadastrado</AlertDialogTitle>
            <AlertDialogDescription className='space-y-2'>
              <p>
                O cliente{' '}
                <strong>
                  {duplicateClientModal?.clientData?.name ||
                    duplicateClientModal?.existingClient?.name}
                </strong>{' '}
                já está cadastrado no sistema.
              </p>
              <div className='mt-4 space-y-2'>
                <div>
                  <strong>Cliente existente:</strong>
                  <ul className='list-disc list-inside ml-2 mt-1 text-sm'>
                    <li>
                      Nome:{' '}
                      {duplicateClientModal?.existingClient?.name ||
                        duplicateClientModal?.existingClient?.legalName}
                    </li>
                    <li>
                      Email:{' '}
                      {duplicateClientModal?.existingClient?.email ||
                        'Não informado'}
                    </li>
                    <li>
                      Telefone:{' '}
                      {duplicateClientModal?.existingClient?.phone ||
                        'Não informado'}
                    </li>
                  </ul>
                </div>
                <div>
                  <strong>Dados do XML:</strong>
                  <ul className='list-disc list-inside ml-2 mt-1 text-sm'>
                    <li>
                      Nome:{' '}
                      {duplicateClientModal?.clientData?.name ||
                        duplicateClientModal?.clientData?.legalName}
                    </li>
                    <li>
                      Email:{' '}
                      {duplicateClientModal?.clientData?.email ||
                        'Não informado'}
                    </li>
                    <li>
                      Telefone:{' '}
                      {duplicateClientModal?.clientData?.phone ||
                        'Não informado'}
                    </li>
                  </ul>
                </div>
              </div>
              <p className='mt-4'>
                Deseja sobrescrever os dados do cliente existente com os dados
                do XML?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => duplicateClientModal?.onCancel()}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => duplicateClientModal?.onConfirm()}
              className='bg-green-600 hover:bg-green-700'
            >
              Sim, sobrescrever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para escolher tipo quando CNPJ é detectado */}
      <Dialog
        open={showTypeModal}
        onOpenChange={(open) => {
          if (!open) {
            // Se fechar sem escolher, limpa o modal mas mantém o documento
            setShowTypeModal(false);
            typeModalOpenedForDocument.current = null;
            isOpeningTypeModal.current = false;
            setShowFields(false);
            // Não limpa o documento, apenas reseta o estado do modal
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione o tipo de cliente</DialogTitle>
            <DialogDescription>
              Este CNPJ pertence a uma empresa. Selecione o tipo de cliente:
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-4'>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-start h-auto p-4'
                            onClick={async () => {
                await applyCnpjType('PJ', formData.document);
              }}
            >
              <Building2 className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-semibold'>Cliente Final</div>
                <div className='text-sm text-muted-foreground'>
                  Empresa que contrata serviços (PJ)
                </div>
              </div>
            </Button>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-start h-auto p-4'
                            onClick={async () => {
                await applyCnpjType('EMPRESA_PARCEIRA', formData.document);
              }}
            >
              <Building2 className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-semibold'>Empresa Parceira</div>
                <div className='text-sm text-muted-foreground'>
                  Empresa parceira com ciclo de pagamento e planilha mensal
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingClient}
        onOpenChange={(open) => {
          // Se está salvando, fecha diretamente sem mostrar confirmação
          if (!open && !isSavingRef.current) {
            setShowCancelConfirm(true);
          } else if (!open && isSavingRef.current) {
            // Se estava salvando, apenas fecha
            setEditingClient(null);
            setIsCreateOpen(false);
          }
        }}
      >
        <DialogContent
          className='max-w-[95vw] sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto'
          onInteractOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div className='flex items-center gap-4'>
                  {editingClient && (
                    <div className='flex flex-col items-center gap-1'>
                      <Avatar className='h-16 w-16 sm:h-20 sm:w-20'>
                        {formData.logoUrl ? (
                          <AvatarImage
                            src={formData.logoUrl}
                            alt={formData.name || 'Logo do cliente'}
                          />
                        ) : (
                          <AvatarFallback>
                            {(formData.name || 'NC')
                              .trim()
                              .split(' ')
                              .map((part) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className='flex flex-col items-center gap-1'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          className='h-7 px-2 text-[11px]'
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                        >
                          {isUploadingLogo
                            ? 'Enviando...'
                            : 'Adicionar foto/logo'}
                        </Button>
                        <input
                          ref={logoInputRef}
                          type='file'
                          accept='image/*'
                          className='hidden'
                          onChange={handleLogoFileChange}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <DialogTitle
                      className='text-[#111418] dark:text-white text-3xl font-bold leading-tight tracking-tight'
                      data-testid='text-dialog-title'
                    >
                      {editingClient
                        ? 'Cadastro/Edição de Cliente'
                        : 'Cadastro/Edição de Cliente'}
                    </DialogTitle>
                    <DialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
                      {editingClient
                        ? 'Preencha ou edite os dados do cliente.'
                        : 'Preencha os dados do novo cliente.'}
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className='space-y-5 sm:space-y-6 py-4 sm:py-6'>
              {/* Abas de Tipo de Cliente - Sempre visíveis */}
              {(() => {
                const showEmpresaParceiraFields =
                  formData.type === 'EMPRESA_PARCEIRA' || showFields || editingClient;
                const showMonthlySpreadsheet = formData.type === 'EMPRESA_PARCEIRA';
                const isMonthlySpreadsheetChecked = formData.monthlySpreadsheet === true;
                return (
                  <>
              <Tabs
                  value={activeTab}
                  onValueChange={(value) => {
                    const tabType = value as 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
                    setActiveTab(tabType);
                    setFormData((prev) => {
                      const cleanDocument = prev.document.replace(/\D/g, '');
                      const expectedDigits = tabType === 'PF' ? 11 : 14;
                      const nextDocument = cleanDocument.length
                        ? cleanDocument.length === expectedDigits
                          ? formatDocumentInput(cleanDocument, tabType)
                          : ''
                        : '';
                      return { ...prev, type: tabType, document: nextDocument };
                    });
                  }}
                  className='w-full'
                >
                  <TabsList className='grid w-full grid-cols-3 mb-6'>
                    <TabsTrigger
                      value='PF'
                      className='data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                    >
                      <span className='flex items-center gap-2'>
                        Pessoa Física
                        <span className='text-[10px] font-semibold opacity-70'>{clientCounts.PF}</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='PJ'
                      className='data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                    >
                      <span className='flex items-center gap-2'>
                        Pessoa Jurídica
                        <span className='text-[10px] font-semibold opacity-70'>{clientCounts.PJ}</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='EMPRESA_PARCEIRA'
                      className='data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                    >
                      <span className='flex items-center gap-2'>
                        Empresa Parceira
                        <span className='text-[10px] font-semibold opacity-70'>{clientCounts.EMPRESA_PARCEIRA}</span>
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Aba: Pessoa Física */}
                  <TabsContent value='PF' className='space-y-6'>
                    {/* Campo CPF/CNPJ (auto) */}
                    {!editingClient && formData.type !== 'PF' && (
                      <div className='space-y-2'>
                        <Label htmlFor='document-pf'>CPF *</Label>
                        <div className='flex gap-2'>
                          <div className='relative flex-1'>
                            <Input
                              id='document-pf'
                              value={formData.document}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  document: formatDocumentInput(e.target.value, 'PF'),
                                });
                              }}
                              onBlur={async (e) => {
                                const cleanDocument = e.currentTarget.value.replace(/\D/g, '');
                                if (cleanDocument.length === 11) {
                                  await handleAdvance();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAdvance();
                                }
                              }}
                              placeholder='Digite CPF'
                              data-testid='input-document-pf'
                              disabled={isCheckingClient}
                              className='pr-10'
                              maxLength={18}
                              type='text'
                              inputMode='numeric'
                            />
                            {isCheckingClient && (
                              <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
                            )}
                          </div>
                        </div>
                        {existingClient && (
                          <div className='p-3 rounded-md border border-red-500 bg-red-50 dark:bg-red-950'>
                            <p className='text-sm text-red-700 dark:text-red-400 font-medium'>
                              ⚠️ Cliente já cadastrado:{' '}
                              {existingClient.name || existingClient.legalName}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {(showFields || editingClient || formData.type === 'PF') && (
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Dados Pessoais
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Nome *
                            </p>
                            <Input
                              id='name'
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-name'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal transition-all',
                                formErrors.name && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CPF *
                            </p>
                            <Input
                              id='document-pf'
                              value={formData.document}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  document: formatDocumentInput(e.target.value, 'PF'),
                                })
                              }
                              onBlur={async (e) => {
                                if (editingClient) return;
                                const cleanDocument = e.currentTarget.value.replace(/\D/g, '');
                                if (cleanDocument.length === 11) {
                                  await handleAdvance();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (editingClient) return;
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAdvance();
                                }
                              }}
                              placeholder='000.000.000-00'
                              data-testid='input-document-pf'
                              disabled={isCheckingClient}
                              required
                              maxLength={14}
                              type='text'
                              inputMode='numeric'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='email'
                              name='email'
                              type='email'
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              data-testid='input-email'
                              placeholder='contato@email.com'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Telefone *
                            </p>
                            <Input
                              id='telefone'
                              name='telefone'
                              type='tel'
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                              data-testid='input-telefone'
                              placeholder='(00) 00000-0000'
                              maxLength={15}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>

                        {/* Endereço - apenas para PF */}
                        <div className='space-y-6 mt-6'>
                          <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                            Endereço
                          </h3>
                          
                          {/* CEP - sempre visível, primeiro campo */}
                          <div className='flex gap-3'>
                            <label className='flex flex-col flex-1'>
                              <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                CEP *
                              </p>
                              <Input
                                id='zipCode'
                                value={formData.zipCode || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const masked = maskCEP(value);
                                  setFormData({
                                    ...formData,
                                    zipCode: masked,
                                  });
                                }}
                                onBlur={handleSearchCep}
                                placeholder='00000-000'
                                data-testid='input-zip-code'
                                maxLength={9}
                                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                              />
                            </label>
                          </div>

                          {/* Campos de endereco */}
                            <div className='space-y-4'>
                              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                <label className='flex flex-col md:col-span-2'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Rua / Logradouro
                                  </p>
                                  <Input
                                    id='streetAddress'
                                    value={formData.streetAddress || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        streetAddress: e.target.value,
                                      })
                                    }
                                    data-testid='input-street-address'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Número
                                  </p>
                                  <Input
                                    id='addressNumber'
                                    value={formData.addressNumber || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        addressNumber: e.target.value,
                                      })
                                    }
                                    data-testid='input-address-number'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Complemento
                                  </p>
                                  <Input
                                    id='addressComplement'
                                    value={formData.addressComplement || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        addressComplement: e.target.value,
                                      })
                                    }
                                    data-testid='input-address-complement'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Bairro / Distrito
                                  </p>
                                  <Input
                                    id='neighborhood'
                                    value={formData.neighborhood || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        neighborhood: e.target.value,
                                      })
                                    }
                                    data-testid='input-neighborhood'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Cidade
                                  </p>
                                  <Input
                                    id='city'
                                    value={formData.city || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        city: e.target.value,
                                      })
                                    }
                                    data-testid='input-city'
                                    className={cn(
                                      'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal transition-all',
                                      formErrors.city && 'input-error'
                                    )}
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Estado
                                  </p>
                                  <Input
                                    id='state'
                                    value={formData.state || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        state: e.target.value,
                                      })
                                    }
                                    maxLength={2}
                                    placeholder='SP'
                                    data-testid='input-state'
                                    className={cn(
                                      'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal transition-all',
                                      formErrors.state && 'input-error'
                                    )}
                                  />
                                </label>
                              </div>
                            </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Aba: Pessoa Jurídica (Cliente Final) */}
                  <TabsContent value='PJ' className='space-y-6'>
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Dados da Empresa
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CNPJ *
                            </p>
                            <div className='relative'>
                              <Input
                                id='document'
                                value={formData.document}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    document: maskCNPJ(e.target.value),
                                  })
                                }
                                onBlur={async (e) => {
                                  if (editingClient) return;
                                  const cleanDocument = e.currentTarget.value.replace(/\D/g, '');
                                  if (cleanDocument.length === 14) {
                                    await handleAdvance();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAdvance();
                                  }
                                }}
                                placeholder='00.000.000/0000-00'
                                data-testid='input-document'
                                maxLength={18}
                                disabled={isCheckingClient}
                                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal pr-10'
                                type='text'
                                inputMode='numeric'
                              />
                              {(isCheckingClient || isLoadingCnpj) && (
                                <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
                              )}
                            </div>
                          </label>
                          {existingClient && (
                            <div className='md:col-span-2 p-3 rounded-md border border-red-500 bg-red-50 dark:bg-red-950'>
                              <p className='text-sm text-red-700 dark:text-red-400 font-medium'>
                                ⚠️ Cliente já cadastrado:{' '}
                                {existingClient.name || existingClient.legalName}
                              </p>
                            </div>
                          )}
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Razão Social *
                            </p>
                            <Input
                              id='legalName'
                              value={formData.legalName}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  legalName: e.target.value,
                                })
                              }
                              data-testid='input-legal-name'
                              required
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Nome Fantasia
                            </p>
                            <Input
                              id='name'
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-name'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>


                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscrição Estadual
                            </p>
                            <Input
                              id='stateRegistration'
                              value={formData.stateRegistration}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  stateRegistration: e.target.value,
                                })
                              }
                              data-testid='input-state-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          {formData.type === 'EMPRESA_PARCEIRA' && (
                            <label className='flex flex-col'>
                              <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                Modelo RAT/OS
                              </p>
                              <select
                                id='ratTemplateId'
                                value={formData.ratTemplateId || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    ratTemplateId: e.target.value,
                                  })
                                }
                                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 px-4 text-base font-normal leading-normal'
                              >
                                <option value=''>Nenhum</option>
                                {serviceOrderTemplates.map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='email'
                              name='email'
                              type='email'
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              required
                              data-testid='input-email'
                              placeholder='contato@empresa.com'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Telefone *
                            </p>
                            <Input
                              id='telefone'
                              name='telefone'
                              type='tel'
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                              data-testid='input-telefone'
                              placeholder='(00) 00000-0000'
                              maxLength={15}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>
                      {/* Seção: Endereço */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Endereço
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CEP
                            </p>
                            <Input
                              id='zipCode'
                              value={formData.zipCode}
                              onChange={(e) => {
                                const value = e.target.value;
                                const masked = maskCEP(value);
                                setFormData({
                                  ...formData,
                                  zipCode: masked,
                                });
                              }}
                              onBlur={async () => {
                                const cleanCep = formData.zipCode.replace(
                                  /\D/g,
                                  ''
                                );
                                if (cleanCep.length !== 8) return;
                                try {
                                  const cepData = await fetchCepData(cleanCep);
                                  if (cepData) {
                                    setFormData((prev) => ({
                                      ...prev,
                                      zipCode: maskCEP(cepData.cep || cleanCep),
                                      streetAddress:
                                        prev.streetAddress?.trim() ||
                                        cepData.street ||
                                        '',
                                      neighborhood:
                                        prev.neighborhood?.trim() ||
                                        cepData.neighborhood ||
                                        '',
                                      city:
                                        prev.city?.trim() || cepData.city || '',
                                      state:
                                        prev.state?.trim() ||
                                        (cepData.state
                                          ? cepData.state.toUpperCase()
                                          : ''),
                                      addressComplement:
                                        prev.addressComplement?.trim() ||
                                        cepData.complement ||
                                        '',
                                    }));
                                  }
                                } catch (error) {
                                  console.error(
                                    'Erro ao buscar CEP no blur:',
                                    error
                                  );
                                }
                              }}
                              placeholder='00000-000'
                              data-testid='input-zip-code'
                              maxLength={9}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col md:col-span-2'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Rua
                            </p>
                            <Input
                              id='rua'
                              name='rua'
                              value={formData.streetAddress}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  streetAddress: e.target.value,
                                })
                              }
                              data-testid='input-rua'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Número
                            </p>
                            <Input
                              id='addressNumber'
                              value={formData.addressNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressNumber: e.target.value,
                                })
                              }
                              data-testid='input-address-number'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Complemento
                            </p>
                            <Input
                              id='addressComplement'
                              value={formData.addressComplement}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressComplement: e.target.value,
                                })
                              }
                              data-testid='input-address-complement'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Bairro / Distrito
                            </p>
                            <Input
                              id='neighborhood'
                              value={formData.neighborhood}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  neighborhood: e.target.value,
                                })
                              }
                              data-testid='input-neighborhood'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Estado
                            </p>
                            <Input
                              id='state'
                              value={formData.state}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  state: e.target.value,
                                })
                              }
                              maxLength={2}
                              placeholder='SP'
                              data-testid='input-state'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Cidade
                            </p>
                            <Input
                              id='city'
                              value={formData.city}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  city: e.target.value,
                                })
                              }
                              data-testid='input-city'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>

                  </TabsContent>

                  {/* Aba: Empresa Parceira */}
                  <TabsContent value='EMPRESA_PARCEIRA' className='space-y-6'>
                    {/* Campo CPF/CNPJ (auto) */}
                    {!editingClient && (
                      <div className='space-y-2'>
                        <Label htmlFor='document-empresa'>CNPJ *</Label>
                        <div className='flex gap-2'>
                          <div className='relative flex-1'>
                            <Input
                              id='document-empresa'
                              value={formData.document}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  document: formatDocumentInput(e.target.value, 'EMPRESA_PARCEIRA'),
                                });
                              }}
                              onBlur={async (e) => {
                                const cleanDocument = e.currentTarget.value.replace(/\D/g, '');
                                if (cleanDocument.length === 14) {
                                  await handleAdvance();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAdvance();
                                }
                              }}
                              placeholder='Digite CNPJ'
                              data-testid='input-document-empresa'
                              disabled={isCheckingClient}
                              className='pr-10'
                              maxLength={18}
                              type='text'
                              inputMode='numeric'
                            />
                            {isCheckingClient && (
                              <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
                            )}
                          </div>
                        </div>
                        {existingClient && (
                          <div className='p-3 rounded-md border border-red-500 bg-red-50 dark:bg-red-950'>
                            <p className='text-sm text-red-700 dark:text-red-400 font-medium'>
                              ⚠️ Cliente já cadastrado:{' '}
                              {existingClient.name || existingClient.legalName}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {showEmpresaParceiraFields && (
                      <>
                        {/* Seção: Informações Fiscais */}
                        <div className='space-y-6'>
                          <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                            Dados da Empresa
                          </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Empresa (Nome Fantasia)
                            </p>
                            <Input
                              id='name'
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-name'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Razão Social *
                            </p>
                            <Input
                              id='legalName'
                              value={formData.legalName}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  legalName: e.target.value,
                                })
                              }
                              data-testid='input-legal-name'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CNPJ *
                            </p>
                            <Input
                              id='document'
                              value={formData.document}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  document: maskCNPJ(e.target.value),
                                })
                              }
                              placeholder='00.000.000/0000-00'
                              data-testid='input-document'
                              maxLength={18}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscrição Municipal
                            </p>
                            <Input
                              id='municipalRegistration'
                              value={formData.municipalRegistration}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  municipalRegistration: e.target.value,
                                })
                              }
                              data-testid='input-municipal-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscrição Estadual
                            </p>
                            <Input
                              id='stateRegistration'
                              value={formData.stateRegistration}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  stateRegistration: e.target.value,
                                })
                              }
                              data-testid='input-state-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='email'
                              name='email'
                              type='email'
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              data-testid='input-email'
                              placeholder='contato@empresa.com'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>

                      {/* Seção: Endereço */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Endereço
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CEP
                            </p>
                            <Input
                              id='zipCode'
                              value={formData.zipCode}
                              onChange={(e) => {
                                const value = e.target.value;
                                const masked = maskCEP(value);
                                setFormData({
                                  ...formData,
                                  zipCode: masked,
                                });
                              }}
                              onBlur={async () => {
                                const cleanCep = formData.zipCode.replace(
                                  /\D/g,
                                  ''
                                );
                                if (cleanCep.length !== 8) return;
                                try {
                                  const cepData = await fetchCepData(cleanCep);
                                  if (cepData) {
                                    setFormData((prev) => ({
                                      ...prev,
                                      zipCode: maskCEP(cepData.cep || cleanCep),
                                      streetAddress:
                                        prev.streetAddress?.trim() ||
                                        cepData.street ||
                                        '',
                                      neighborhood:
                                        prev.neighborhood?.trim() ||
                                        cepData.neighborhood ||
                                        '',
                                      city:
                                        prev.city?.trim() || cepData.city || '',
                                      state:
                                        prev.state?.trim() ||
                                        (cepData.state
                                          ? cepData.state.toUpperCase()
                                          : ''),
                                      addressComplement:
                                        prev.addressComplement?.trim() ||
                                        cepData.complement ||
                                        '',
                                    }));
                                  }
                                } catch (error) {
                                  console.error(
                                    'Erro ao buscar CEP no blur:',
                                    error
                                  );
                                }
                              }}
                              placeholder='00000-000'
                              data-testid='input-zip-code'
                              maxLength={9}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col md:col-span-2'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Rua
                            </p>
                            <Input
                              id='rua'
                              name='rua'
                              value={formData.streetAddress}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  streetAddress: e.target.value,
                                })
                              }
                              data-testid='input-rua'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Número
                            </p>
                            <Input
                              id='addressNumber'
                              value={formData.addressNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressNumber: e.target.value,
                                })
                              }
                              data-testid='input-address-number'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Complemento
                            </p>
                            <Input
                              id='addressComplement'
                              value={formData.addressComplement}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressComplement: e.target.value,
                                })
                              }
                              data-testid='input-address-complement'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Bairro / Distrito
                            </p>
                            <Input
                              id='neighborhood'
                              value={formData.neighborhood}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  neighborhood: e.target.value,
                                })
                              }
                              data-testid='input-neighborhood'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Estado
                            </p>
                            <Input
                              id='state'
                              value={formData.state}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  state: e.target.value,
                                })
                              }
                              maxLength={2}
                              placeholder='SP'
                              data-testid='input-state'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Cidade
                            </p>
                            <Input
                              id='city'
                              value={formData.city}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  city: e.target.value,
                                })
                              }
                              data-testid='input-city'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>

                      {/* Seção: Ciclo de Pagamento */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Ciclo de Pagamento
                        </h3>
                        <p className='text-sm text-[#60708a] dark:text-gray-400'>
                          Define o período de fechamento mensal e data de
                          pagamento
                        </p>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Início do Ciclo (dia)
                            </p>
                            <Input
                              id='paymentCycleStartDay'
                              type='number'
                              min='1'
                              max='31'
                              value={formData.paymentCycleStartDay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  paymentCycleStartDay:
                                    parseInt(e.target.value) || 1,
                                })
                              }
                              data-testid='input-payment-cycle-start'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Fim do Ciclo (dia)
                            </p>
                            <Input
                              id='paymentCycleEndDay'
                              type='number'
                              min='1'
                              max='31'
                              value={formData.paymentCycleEndDay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  paymentCycleEndDay:
                                    parseInt(e.target.value) || 30,
                                })
                              }
                              data-testid='input-payment-cycle-end'
                            />
                          </label>
                          <div className='space-y-2'>
                            <Label htmlFor='paymentDueDay'>
                              Pagamento (dia mês seguinte)
                            </Label>
                            <Input
                              id='paymentDueDay'
                              type='number'
                              min='1'
                              max='31'
                              value={formData.paymentDueDay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  paymentDueDay: parseInt(e.target.value) || 5,
                                })
                              }
                              data-testid='input-payment-due-day'
                            />
                          </div>
                        </div>
                      </div>

                      {/* Seção: Valores Padrão */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Valores Padrão
                        </h3>
                        <p className='text-sm text-[#60708a] dark:text-gray-400'>
                          Estes valores serão pré-preenchidos automaticamente ao
                          criar chamados
                        </p>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor Chamado (R$)
                            </p>
                            <Input
                              id='defaultTicketValue'
                              value={formData.defaultTicketValue}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  defaultTicketValue: maskCurrency(
                                    e.target.value
                                  ),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-ticket-value'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Até x Horas
                            </p>
                            <Input
                              id='defaultHoursIncluded'
                              type='number'
                              min='1'
                              value={formData.defaultHoursIncluded}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  defaultHoursIncluded:
                                    parseInt(e.target.value) || 3,
                                })
                              }
                              placeholder='3'
                              data-testid='input-default-hours-included'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor Hora Adicional (R$)
                            </p>
                            <Input
                              id='defaultAdditionalHourRate'
                              value={formData.defaultAdditionalHourRate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  defaultAdditionalHourRate: maskCurrency(
                                    e.target.value
                                  ),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-additional-hour-rate'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor KM (R$/km)
                            </p>
                            <Input
                              id='defaultKmRate'
                              value={formData.defaultKmRate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  defaultKmRate: maskCurrency(e.target.value),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-km-rate'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>

              {/* Monthly Spreadsheet (EMPRESA_PARCEIRA only) */}
              {showMonthlySpreadsheet && (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between p-4 rounded-lg border border-black/20 dark:border-border bg-white dark:bg-card shadow-sm'>
                      <div className='space-y-0.5'>
                        <Label
                          htmlFor='monthly-spreadsheet'
                          className='text-base'
                        >
                          Planilha Mensal
                        </Label>
                        <p className='text-sm text-muted-foreground'>
                          Gerar planilha automática de chamados mensalmente
                        </p>
                      </div>
                      <Switch
                        id='monthly-spreadsheet'
                        checked={isMonthlySpreadsheetChecked}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            monthlySpreadsheet: checked,
                          });
                        }}
                        data-testid='switch-monthly-spreadsheet'
                      />
                    </div>

                    {/* Conditional fields when spreadsheet is enabled */}
                    {formData.monthlySpreadsheet && (
                      <div className='p-4 rounded-lg border border-black/20 dark:border-border bg-white dark:bg-muted/30 shadow-sm'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                          <div className='space-y-2'>
                            <Label htmlFor='spreadsheet-day'>
                              Dia de Envio
                            </Label>
                            <Input
                              id='spreadsheet-day'
                              type='number'
                              min='1'
                              max='31'
                              value={formData.spreadsheetDay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  spreadsheetDay: parseInt(e.target.value) || 1,
                                })
                              }
                              placeholder='1'
                              data-testid='input-spreadsheet-day'
                            />
                            <p className='text-xs text-muted-foreground'>
                              Dia do mês para envio automático (1-31)
                            </p>
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='spreadsheet-email'>
                              Email para Envio
                            </Label>
                            <Input
                              id='spreadsheet-email'
                              type='email'
                              value={formData.spreadsheetEmail}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  spreadsheetEmail: e.target.value,
                                })
                              }
                              placeholder='financeiro@empresa.com'
                              data-testid='input-spreadsheet-email'
                            />
                            <p className='text-xs text-muted-foreground'>
                              Email que receberá a planilha mensal
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
              )}
                  </>
                );
              })()}
            </div>

            <div className='flex justify-end gap-4 pt-6 border-t dark:border-gray-700'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowCancelConfirm(true)}
                data-testid='button-cancel'
                disabled={createMutation.isPending || updateMutation.isPending}
                className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
              >
                <span className='truncate'>Cancelar</span>
              </Button>

              <Button
                type='submit'
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid='button-save'
                className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-white dark:bg-white text-gray-900 dark:text-gray-900 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-200'
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Salvando...'
                  : editingClient
                  ? 'Salvar Alterações'
                  : 'Cadastrar Cliente'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Você está prestes a excluir {selectedClients.size} cliente(s). Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='delete-reason'>Motivo da Exclusão *</Label>
              <Textarea
                id='delete-reason'
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder='Digite o motivo da exclusão...'
                required
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='delete-email'>Email de Confirmação *</Label>
              <Input
                id='delete-email'
                type='email'
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder='Digite seu email para confirmar'
                required
              />
              <p className='text-xs text-muted-foreground'>
                É necessário informar seu email cadastrado para excluir clientes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteReason('');
                setDeleteEmail('');
              }}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (!deleteReason.trim()) {
                  toast({
                    variant: 'destructive',
                    title: 'Campos obrigatórios',
                    description:
                      'Preencha o motivo da exclusão para continuar.',
                  });
                  return;
                }

                if (!deleteEmail.trim()) {
                  toast({
                    variant: 'destructive',
                    title: 'Campos obrigatórios',
                    description: 'Preencha o email para continuar.',
                  });
                  return;
                }

                if (selectedClients.size === 0) {
                  toast({
                    variant: 'destructive',
                    title: 'Nenhum cliente selecionado',
                    description: 'Selecione ao menos um cliente para excluir.',
                  });
                  return;
                }

                bulkDeleteMutation.mutate({
                  clientIds: Array.from(selectedClients),
                  email: deleteEmail.trim(),
                  reason: deleteReason.trim(),
                });
              }}
              disabled={
                bulkDeleteMutation.isPending ||
                !deleteReason.trim() ||
                !deleteEmail.trim() ||
                selectedClients.size === 0
              }
            >
              {bulkDeleteMutation.isPending
                ? 'Excluindo...'
                : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight'>
              Cancelar alterações?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Tem certeza que deseja cancelar? Todas as alterações serão
              perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel
              data-testid='button-cancel-no'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsCreateOpen(false);
                setEditingClient(null);
                resetForm();
                setShowCancelConfirm(false);
              }}
              data-testid='button-cancel-yes'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Criação de Chamado */}
      <CreateTicketModal
        open={!!createTicketClientId}
        onOpenChange={(open) => {
          if (!open) {
            setCreateTicketClientId(null);
          }
        }}
        preselectedClientId={createTicketClientId}
      />
    </div>
  );
}
