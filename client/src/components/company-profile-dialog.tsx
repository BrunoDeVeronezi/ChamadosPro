import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import {
  maskCNPJ,
  unmaskCNPJ,
  maskPhone,
  unmaskPhone,
  isValidCNPJ,
} from '@/lib/masks';

interface CompanyData {
  id: string;
  userId: string;
  companyName: string;
  cnpj: string | null;
  cnpjClean: string | null;
  bankName: string | null;
  bankCode: string | null;
  accountType: string | null;
  agency: string | null;
  agencyDigit: string | null;
  account: string | null;
  accountDigit: string | null;
  commercialPhone: string | null;
  commercialEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompanyProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyProfileDialog({
  isOpen,
  onClose,
}: CompanyProfileDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar dados da empresa
  const { data: companyData, isLoading: isLoadingData } =
    useQuery<CompanyData | null>({
      queryKey: ['/api/company/data'],
      queryFn: async () => {
        const res = await apiRequest('GET', '/api/company/data', undefined);
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch company data');
        }
        return await res.json();
      },
      enabled: isOpen, // Só buscar quando o modal estiver aberto
      staleTime: 0,
      refetchOnMount: true,
    });

  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    bankName: '',
    bankCode: '',
    accountType: 'CONTA_CORRENTE',
    agency: '',
    agencyDigit: '',
    account: '',
    accountDigit: '',
    commercialPhone: '',
    commercialEmail: '',
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  // Inicializar formulário com dados da empresa
  useEffect(() => {
    if (!isOpen) {
      // Resetar quando o modal fechar
      setIsInitialized(false);
      return;
    }

    // Se ainda está carregando, aguardar
    if (isLoadingData) {
      return;
    }

    // Quando o carregamento terminar, sempre inicializar
    // Se há dados da empresa, usar eles
    if (companyData) {
      setFormData({
        companyName: companyData.companyName || '',
        cnpj: companyData.cnpj ? maskCNPJ(companyData.cnpj) : '',
        bankName: companyData.bankName || '',
        bankCode: companyData.bankCode || '',
        accountType: companyData.accountType || 'CONTA_CORRENTE',
        agency: companyData.agency || '',
        agencyDigit: companyData.agencyDigit || '',
        account: companyData.account || '',
        accountDigit: companyData.accountDigit || '',
        commercialPhone: companyData.commercialPhone
          ? maskPhone(companyData.commercialPhone)
          : '',
        commercialEmail: companyData.commercialEmail || '',
      });
    } else {
      // Se não há dados, inicializar com nome da empresa do usuário (se existir)
      setFormData((prev) => ({
        ...prev,
        companyName: user?.companyName || prev.companyName || '',
      }));
    }

    // Sempre marcar como inicializado quando o carregamento terminar
    setIsInitialized(true);
  }, [companyData, isLoadingData, user?.companyName, isOpen]);

  // Atualizar preview da logo quando user mudar ou modal abrir
  useEffect(() => {
    if (isOpen && user?.companyLogoUrl) {
      setPreviewLogo(user.companyLogoUrl);
    } else if (isOpen && !user?.companyLogoUrl) {
      setPreviewLogo(null);
    }
  }, [user?.companyLogoUrl, isOpen]);

  // Função para buscar dados da empresa pelo CNPJ
  const fetchCnpjData = async (cnpj: string) => {
    const cleanCnpj = unmaskCNPJ(cnpj);

    // Validar CNPJ antes de buscar
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return;
    }

    if (!isValidCNPJ(cnpj)) {
      toast({
        title: 'CNPJ inválido',
        description: 'Por favor, verifique o CNPJ informado.',
        variant: 'destructive',
      });
      return;
    }

    setIsFetchingCnpj(true);
    try {
      console.log(
        '[CompanyProfileDialog] 🔍 Buscando dados do CNPJ:',
        cleanCnpj
      );

      const response = await fetch(`/api/cnpj/${cleanCnpj}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[CompanyProfileDialog] 📡 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (response.status === 404) {
        const errorText = await response.text();
        console.error(
          '[CompanyProfileDialog] ❌ CNPJ não encontrado:',
          errorText
        );
        toast({
          title: 'CNPJ não encontrado',
          description: 'Não foi possível encontrar dados para este CNPJ.',
          variant: 'destructive',
        });
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CompanyProfileDialog] ❌ Erro na resposta:', errorText);

        let errorMessage = 'Erro ao buscar dados do CNPJ';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          // Se não for JSON, usar o texto como está
          if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
            errorMessage =
              'Endpoint não encontrado. Verifique se o servidor está rodando corretamente.';
          } else {
            errorMessage = errorText || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      const cnpjData = await response.json();
      console.log('[CompanyProfileDialog]   Dados recebidos:', cnpjData);

      // Preencher campos automaticamente
      setFormData((prev) => ({
        ...prev,
        companyName: cnpjData.companyName || prev.companyName,
        commercialPhone: cnpjData.phone
          ? maskPhone(cnpjData.phone)
          : prev.commercialPhone,
        commercialEmail: cnpjData.email || prev.commercialEmail,
        // Manter CNPJ como está (já está mascarado)
        cnpj: prev.cnpj,
      }));

      toast({
        title: 'Dados da empresa carregados',
        description: 'Os dados foram preenchidos automaticamente.',
      });
    } catch (error: any) {
      console.error('[CompanyProfileDialog] Erro ao buscar CNPJ:', error);

      // Mensagens mais específicas para diferentes tipos de erro
      let errorTitle = 'Erro ao buscar dados';
      let errorDescription =
        error.message || 'Não foi possível buscar os dados do CNPJ.';

      if (
        error.message?.includes('RATE_LIMIT') ||
        error.message?.includes('temporariamente indisponível')
      ) {
        errorTitle = 'Serviço temporariamente indisponível';
        errorDescription =
          'A API de consulta de CNPJ está com muitas requisições. Tente novamente em alguns instantes.';
      } else if (
        error.message?.includes('503') ||
        error.message?.includes('SERVICE_UNAVAILABLE')
      ) {
        errorTitle = 'Serviço indisponível';
        errorDescription =
          'O serviço de consulta de CNPJ está temporariamente fora do ar. Tente novamente mais tarde.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validar CNPJ se fornecido
      if (data.cnpj && !isValidCNPJ(data.cnpj)) {
        throw new Error('CNPJ inválido');
      }

      // Atualizar dados da empresa
      const companyPayload = {
        companyName: data.companyName,
        cnpj: data.cnpj ? maskCNPJ(data.cnpj) : null,
        bankName: data.bankName || null,
        bankCode: data.bankCode || null,
        accountType: data.accountType || null,
        agency: data.agency || null,
        agencyDigit: data.agencyDigit || null,
        account: data.account || null,
        accountDigit: data.accountDigit || null,
        commercialPhone: data.commercialPhone
          ? unmaskPhone(data.commercialPhone)
          : null,
        commercialEmail: data.commercialEmail || null,
      };

      const companyResponse = await apiRequest(
        'PATCH',
        '/api/company/data',
        companyPayload
      );
      if (!companyResponse.ok) {
        const error = await companyResponse.json();
        throw new Error(error.message || 'Failed to update company data');
      }

      // IMPORTANTE: Atualizar também o companyName no perfil do usuário
      // Isso vai gerar o slug automaticamente e atualizar o nome no sistema
      if (data.companyName && data.companyName.trim() !== '') {
        const userPayload = {
          companyName: data.companyName,
          // Não passar publicSlug - deixar o storage gerar automaticamente baseado no companyName
        };

        const userResponse = await apiRequest(
          'PATCH',
          '/api/user/profile',
          userPayload
        );
        if (!userResponse.ok) {
          console.warn(
            '[CompanyProfileDialog] ⚠️ Erro ao atualizar nome da empresa no perfil do usuário'
          );
          // Não falhar o processo todo se apenas o nome não atualizar
        } else {
          console.log(
            '[CompanyProfileDialog]   Nome da empresa atualizado no perfil do usuário'
          );
        }
      }

      return await companyResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Dados atualizados',
        description: 'Os dados da empresa foram salvos com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description:
          error.message || 'Não foi possível atualizar os dados da empresa.',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 800KB.',
      });
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/gif', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Apenas JPG, GIF ou PNG são permitidos.',
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      // Criar preview local imediatamente
      const previewReader = new FileReader();
      previewReader.onloadend = () => {
        const base64Preview = previewReader.result as string;
        setPreviewLogo(base64Preview);
      };
      previewReader.readAsDataURL(file);

      // Converter arquivo para base64 para upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          if (!base64String || typeof base64String !== 'string') {
            throw new Error('Erro ao converter arquivo para base64');
          }

          console.log(
            '[CompanyProfileDialog] 📤 Enviando requisição para /api/user/company-logo'
          );

          const response = await apiRequest('POST', '/api/user/company-logo', {
            image: base64String,
          });

          console.log(
            '[CompanyProfileDialog]   Resposta recebida:',
            response.status,
            response.statusText
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              '[CompanyProfileDialog] ❌ Erro na resposta:',
              errorText
            );
            throw new Error(
              errorText || `Erro ${response.status}: ${response.statusText}`
            );
          }

          const userData = await response.json();
          console.log('[CompanyProfileDialog]   Dados do usuário recebidos:', {
            id: userData.id,
            companyLogoUrl: userData.companyLogoUrl,
          });

          // Atualizar cache com os dados retornados
          const email = userData.email || '';
          const emailParts = email.split('+');
          const originalEmail =
            emailParts.length > 1
              ? `${emailParts[0]}@${email.split('@')[1]}`
              : email;

          const userDataWithEmail = {
            ...userData,
            email: originalEmail,
          };

          // Atualizar cache imediatamente
          queryClient.setQueryData(['/api/auth/user'], userDataWithEmail);

          // Invalidar e refetch para garantir que todos os componentes vejam a atualização
          // Forçar refetch mesmo com staleTime: Infinity
          queryClient.invalidateQueries({
            queryKey: ['/api/auth/user'],
            exact: true,
          });

          // Refetch imediatamente
          await queryClient.refetchQueries({
            queryKey: ['/api/auth/user'],
            exact: true,
          });

          // Atualizar preview com a URL do servidor se disponível
          if (userDataWithEmail.companyLogoUrl) {
            console.log(
              '[CompanyProfileDialog] 🖼️ Atualizando preview com URL do servidor:',
              userDataWithEmail.companyLogoUrl
            );
            setPreviewLogo(userDataWithEmail.companyLogoUrl);
          }

          // Forçar atualização do sidebar também
          console.log(
            '[CompanyProfileDialog]   // Logo atualizada, cache atualizado:',
            userDataWithEmail.companyLogoUrl
          );

          toast({
            title: 'Logo atualizada',
            description: 'A logo da empresa foi atualizada com sucesso.',
          });
        } catch (error: any) {
          console.error(
            '[CompanyProfileDialog] ❌ Erro ao fazer upload da logo:',
            error
          );

          // Em caso de erro, remover o preview
          setPreviewLogo(null);

          let errorMessage = 'Não foi possível fazer upload da logo.';
          if (error.message) {
            errorMessage = error.message;
          } else if (
            error instanceof TypeError &&
            error.message.includes('fetch')
          ) {
            errorMessage =
              'Erro de conexão. Verifique sua internet e tente novamente.';
          }

          toast({
            variant: 'destructive',
            title: 'Erro ao fazer upload',
            description: errorMessage,
          });
        } finally {
          setIsUploadingLogo(false);
        }
      };

      reader.onerror = () => {
        console.error('[CompanyProfileDialog] ❌ Erro ao ler arquivo');
        setPreviewLogo(null);
        toast({
          variant: 'destructive',
          title: 'Erro ao ler arquivo',
          description: 'Não foi possível ler o arquivo selecionado.',
        });
        setIsUploadingLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      setPreviewLogo(null);
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer upload',
        description: error.message || 'Não foi possível fazer upload da logo.',
      });
      setIsUploadingLogo(false);
    }

    e.target.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-4xl max-h-[90vh] overflow-y-auto'
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className='text-2xl font-bold'>
            Perfil da Empresa
          </DialogTitle>
          <DialogDescription>
            Gerencie os dados da sua empresa para integrações e outras
            funcionalidades
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-primary' />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Logo da Empresa */}
            <div className='flex flex-col gap-4 border-b border-gray-200 dark:border-white/10 pb-6'>
              <div className='flex gap-4 items-center'>
                <div className='relative'>
                  {previewLogo || user?.companyLogoUrl ? (
                    <img
                      src={previewLogo || user?.companyLogoUrl}
                      alt={user?.companyName || 'Logo da Empresa'}
                      className='h-24 w-24 md:h-32 md:w-32 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2'
                    />
                  ) : (
                    <div className='h-24 w-24 md:h-32 md:w-32 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'>
                      <span className='text-gray-400 text-sm'>Sem Logo</span>
                    </div>
                  )}
                </div>
                <div className='flex flex-col justify-center gap-1'>
                  <p className='text-[#111418] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]'>
                    Alterar Logo
                  </p>
                  <p className='text-[#60708a] dark:text-gray-400 text-sm font-normal leading-normal'>
                    JPG, GIF ou PNG. Tamanho máximo de 800K
                  </p>
                  <label className='mt-2'>
                    <input
                      type='file'
                      accept='image/jpeg,image/jpg,image/gif,image/png'
                      onChange={handleLogoUpload}
                      className='hidden'
                      disabled={isUploadingLogo}
                      id='company-logo-input'
                    />
                    <Button
                      type='button'
                      variant='link'
                      className='text-sm font-medium text-[#3880f5] hover:underline self-start p-0 h-auto'
                      disabled={isUploadingLogo}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const input = document.getElementById(
                          'company-logo-input'
                        ) as HTMLInputElement;
                        if (input) {
                          input.click();
                        }
                      }}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                          Carregando...
                        </>
                      ) : (
                        'Carregar logo'
                      )}
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            {/* Dados Básicos */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                Dados Básicos
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <label className='flex flex-col md:col-span-2'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Nome da Empresa *
                  </p>
                  <Input
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='Nome da Empresa'
                    required
                  />
                  <p className='text-sm text-[#60708a] dark:text-gray-400 mt-1'>
                    Este nome será usado nas cobranças
                  </p>
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    CNPJ
                  </p>
                  <div className='relative'>
                    <Input
                      value={formData.cnpj}
                      onChange={(e) => {
                        const masked = maskCNPJ(e.target.value);
                        setFormData({ ...formData, cnpj: masked });
                      }}
                      onBlur={(e) => {
                        // Buscar dados da empresa quando o usuário sair do campo
                        if (
                          formData.cnpj &&
                          formData.cnpj.replace(/\D/g, '').length === 14
                        ) {
                          fetchCnpjData(formData.cnpj);
                        }
                      }}
                      disabled={isFetchingCnpj}
                      className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                      placeholder='00.000.000/0000-00'
                      maxLength={18}
                    />
                    {isFetchingCnpj && (
                      <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                        <Loader2 className='h-5 w-5 animate-spin text-primary' />
                      </div>
                    )}
                  </div>
                  <p className='text-sm text-[#60708a] dark:text-gray-400 mt-1'>
                    CNPJ será usado nas cobranças. Os dados da empresa serão
                    preenchidos automaticamente ao sair do campo.
                  </p>
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Telefone Comercial (WhatsApp Business)
                  </p>
                  <Input
                    value={formData.commercialPhone}
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      setFormData({ ...formData, commercialPhone: masked });
                    }}
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='(00) 00000-0000'
                    maxLength={15}
                  />
                </label>

                <label className='flex flex-col md:col-span-2'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Email Comercial
                  </p>
                  <Input
                    type='email'
                    value={formData.commercialEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commercialEmail: e.target.value,
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='contato@empresa.com.br'
                  />
                </label>

                <label className='flex flex-col md:col-span-2'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Link de Agendamento Público
                  </p>
                  <div className='flex items-center gap-2'>
                    <span className='text-[#60708a] dark:text-gray-400 text-base font-normal whitespace-nowrap'>
                      www.clicksync.com.br/
                    </span>
                    <Input
                      value={user?.publicSlug || ''}
                      readOnly
                      disabled
                      className='flex-1 min-w-0 rounded-lg text-gray-500 dark:text-gray-400 focus:outline-0 focus:ring-0 border border-[#dbdfe6] dark:border-white/20 bg-gray-100 dark:bg-gray-800 h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal cursor-not-allowed'
                      placeholder='-'
                    />
                  </div>
                  <p className='text-sm text-[#60708a] dark:text-gray-400 mt-2'>
                    O link público é gerado automaticamente a partir do nome da
                    empresa.
                  </p>
                </label>
              </div>
            </div>

            {/* Dados Bancários */}
            <div className='space-y-4 pt-6 border-t border-gray-200 dark:border-white/10'>
              <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                Dados Bancários
              </h3>
              <p className='text-sm text-[#60708a] dark:text-gray-400'>
                Dados bancários para recebimento
              </p>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Nome do Banco
                  </p>
                  <Input
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='Ex: Banco do Brasil'
                  />
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Código do Banco
                  </p>
                  <Input
                    value={formData.bankCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankCode: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='Ex: 001'
                    maxLength={10}
                  />
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Tipo de Conta
                  </p>
                  <select
                    value={formData.accountType}
                    onChange={(e) =>
                      setFormData({ ...formData, accountType: e.target.value })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  >
                    <option value='CONTA_CORRENTE'>Conta Corrente</option>
                    <option value='CONTA_POUPANCA'>Conta Poupança</option>
                    <option value='CONTA_SALARIO'>Conta Salário</option>
                  </select>
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Agência
                  </p>
                  <Input
                    value={formData.agency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        agency: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='0000'
                    maxLength={10}
                  />
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Dígito da Agência
                  </p>
                  <Input
                    value={formData.agencyDigit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        agencyDigit: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 2),
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='0'
                    maxLength={2}
                  />
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Conta
                  </p>
                  <Input
                    value={formData.account}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='00000'
                    maxLength={20}
                  />
                </label>

                <label className='flex flex-col'>
                  <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Dígito da Conta
                  </p>
                  <Input
                    value={formData.accountDigit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accountDigit: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 2),
                      })
                    }
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                    placeholder='0'
                    maxLength={2}
                  />
                </label>
              </div>
            </div>

            <div className='flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10'>
              <Button
                type='button'
                variant='outline'
                onClick={onClose}
                className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 text-sm font-bold leading-normal tracking-[0.015em]'
              >
                Cancelar
              </Button>
              <Button
                type='submit'
                disabled={updateMutation.isPending || !isInitialized}
                className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[#3880f5] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90'
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}