import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Link } from 'wouter';
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

export default function PerfilEmpresa() {
  const { toast } = useToast();
  const { user, requirePassword } = useAuth();

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
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Inicializar formulário com dados da empresa
  useEffect(() => {
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
      setIsInitialized(true);
    } else if (companyData === null && !isLoadingData) {
      // Se não há dados, inicializar com nome da empresa do usuário
      setFormData((prev) => ({
        ...prev,
        companyName: user?.companyName || '',
      }));
      setIsInitialized(true);
    }
  }, [companyData, isLoadingData, user?.companyName]);

  // Atualizar preview da logo quando user mudar
  useEffect(() => {
    if (user?.companyLogoUrl) {
      setPreviewLogo(user.companyLogoUrl);
    }
  }, [user?.companyLogoUrl]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validar CNPJ se fornecido
      if (data.cnpj && !isValidCNPJ(data.cnpj)) {
        throw new Error('CNPJ inválido');
      }

      const payload = {
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

      const response = await apiRequest('PATCH', '/api/company/data', payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update company data');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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

  const setPasswordMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await apiRequest('POST', '/api/auth/set-password', {
        password: pwd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao definir senha');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Senha definida',
        description: 'Agora você pode entrar também com email e senha.',
      });
      setPasswordData({ password: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao definir senha',
        description: error.message || 'Não foi possível salvar a senha.',
      });
    },
  });

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }
    if (passwordData.password !== passwordData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas diferentes',
        description: 'Confirme a mesma senha nos dois campos.',
      });
      return;
    }
    await setPasswordMutation.mutateAsync(passwordData.password);
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
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          const response = await apiRequest('POST', '/api/user/company-logo', {
            image: base64String,
          });

          if (!response.ok) {
            throw new Error('Failed to upload logo');
          }

          const userData = await response.json();
          queryClient.setQueryData(['/api/auth/user'], userData);
          setPreviewLogo(userData.companyLogoUrl);

          toast({
            title: 'Logo atualizada',
            description: 'A logo da empresa foi atualizada com sucesso.',
          });
        } catch (error: any) {
          setPreviewLogo(null);
          toast({
            variant: 'destructive',
            title: 'Erro ao fazer upload',
            description:
              error.message || 'Não foi possível fazer upload da logo.',
          });
        } finally {
          setIsUploadingLogo(false);
        }
      };

      reader.onerror = () => {
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

  if (isLoadingData) {
    return (
      <div className='mx-auto max-w-4xl'>
        <div className='flex flex-col gap-6 p-6'>
          <div>
            <h1 className='text-3xl font-bold text-[#111418] dark:text-white'>
              Perfil da Empresa
            </h1>
            <p className='text-[#60708a] dark:text-gray-400 mt-1'>
              Carregando dados...
            </p>
          </div>
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-primary' />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl'>
      {/* Breadcrumb */}
      <div className='flex flex-wrap gap-2 mb-6'>
        <Link
          href='/'
          className='text-[#60708a] dark:text-gray-400 hover:text-primary dark:hover:text-primary text-base font-medium leading-normal'
        >
          Início
        </Link>
        <span className='text-[#60708a] dark:text-gray-500 text-base font-medium leading-normal'>
          /
        </span>
        <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
          Perfil da Empresa
        </span>
      </div>

      <div className='mb-8'>
        <div className='flex flex-wrap justify-between gap-3'>
          <div className='flex min-w-72 flex-col gap-2'>
            <p className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
              Perfil da Empresa
            </p>
            <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Gerencie os dados da sua empresa para integrações e outras
              funcionalidades
            </p>
          </div>
        </div>
      </div>

      <Card className='bg-white dark:bg-gray-900/50 dark:border dark:border-white/10 p-6 md:p-8 rounded-xl shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-center border-b border-gray-200 dark:border-white/10 pb-8 mb-8'>
          <div className='flex w-full flex-col gap-4 md:flex-row md:items-center'>
            <div className='flex gap-4 items-center'>
              {/* Logo da Empresa */}
              <div className='flex flex-col gap-4'>
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
                    />
                    <Button
                      type='button'
                      variant='link'
                      className='text-sm font-medium text-[#3880f5] hover:underline self-start p-0 h-auto'
                      disabled={isUploadingLogo}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept =
                          'image/jpeg,image/jpg,image/gif,image/png';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
                          if (file) {
                            const event = {
                              target: { files: [file] },
                            } as React.ChangeEvent<HTMLInputElement>;
                            handleLogoUpload(event);
                          }
                        };
                        input.click();
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
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
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
                <Input
                  value={formData.cnpj}
                  onChange={(e) => {
                    const masked = maskCNPJ(e.target.value);
                    setFormData({ ...formData, cnpj: masked });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='00.000.000/0000-00'
                  maxLength={18}
                />
                <p className='text-sm text-[#60708a] dark:text-gray-400 mt-1'>
                  CNPJ será usado nas cobranças
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

          <div className='flex justify-end pt-4 border-t border-gray-200 dark:border-white/10'>
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
      </Card>

      <Card className='p-6 shadow-sm border border-[#e9edf5] dark:border-white/10 dark:bg-[#0b1221] rounded-xl space-y-4 mt-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-lg font-semibold text-[#111418] dark:text-white'>
              Definir/Alterar Senha (login por email)
            </p>
            <p className='text-sm text-[#60708a] dark:text-white/70'>
              Use a mesma senha para entrar com o email da sua conta Google.
            </p>
            {(user?.requirePassword || requirePassword) && (
              <p className='text-sm text-orange-500 mt-1'>
                É necessário definir uma senha para habilitar o login por email.
              </p>
            )}
          </div>
        </div>

        <form className='space-y-4' onSubmit={handleSetPassword}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <label className='flex flex-col'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                Nova senha
              </p>
              <Input
                type='password'
                value={passwordData.password}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                placeholder='Crie uma senha'
              />
            </label>

            <label className='flex flex-col'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                Confirmar senha
              </p>
              <Input
                type='password'
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                placeholder='Repita a senha'
              />
            </label>
          </div>

          <div className='flex justify-end'>
            <Button
              type='submit'
              disabled={setPasswordMutation.isPending}
              className='flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[#3880f5] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90'
            >
              {setPasswordMutation.isPending ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Salvando...
                </>
              ) : (
                'Salvar Senha'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
