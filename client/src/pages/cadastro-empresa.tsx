import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import {
  maskCNPJ,
  maskPhone,
  maskCEP,
  unmaskCNPJ,
  unmaskCEP,
} from '@/lib/masks';
import { consultarCNPJ, consultarCEP } from '@/lib/brasil-api';
import { CompanyLogo } from '@/components/company-logo';
import { getTrialDeviceId } from '@/lib/device-id';

export default function CadastroEmpresa() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [autoResponsibleEmail, setAutoResponsibleEmail] = useState('');
  const [formData, setFormData] = useState({
    cnpj: '',
    companyName: '',
    email: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    responsibleName: '',
    responsibleEmail: '',
    password: '',
    confirmPassword: '',
    userRole: 'ADMIN' as 'ADMIN' | 'ANALYST',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (data.password !== data.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }
      const payload = {
        ...data,
        trialDeviceId: getTrialDeviceId(),
      };
      const response = await apiRequest(
        'POST',
        '/api/companies/register',
        payload
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao cadastrar empresa');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Empresa cadastrada',
        description: 'O cadastro da empresa foi realizado com sucesso.',
      });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar empresa',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const slugifyName = (name: string) =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s.]+/g, '')
      .replace(/\s+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLowerCase();

  const generateResponsibleEmail = (
    name: string,
    currentEmail: string,
    companyEmail: string
  ) => {
    const slug = slugifyName(name);
    if (!slug) return '';

    const currentDomain = currentEmail.includes('@')
      ? currentEmail.split('@')[1]
      : '';
    const companyDomain = companyEmail.includes('@')
      ? companyEmail.split('@')[1]
      : '';

    const domain =
      currentDomain || companyDomain || 'empresa.com.br';

    return `${slug}@${domain}`.toLowerCase();
  };

  // Handler para consultar CNPJ
  const handleConsultarCNPJ = async (showError = true) => {
    const cnpjLimpo = unmaskCNPJ(formData.cnpj);

    if (cnpjLimpo.length !== 14) {
      if (showError) {
        toast({
          variant: 'destructive',
          title: 'CNPJ inválido',
          description: 'Por favor, digite um CNPJ válido com 14 dígitos.',
        });
      }
      return;
    }

    setIsLoadingCNPJ(true);
    try {
      const dados = await consultarCNPJ(cnpjLimpo);

      if (dados) {
        setFormData({
          ...formData,
          companyName: dados.razao_social || formData.companyName,
          cnpj: maskCNPJ(dados.cnpj),
          email: formData.email || '', // Mantém email se já preenchido
          phone:
            formData.phone ||
            (dados.ddd_telefone_1
              ? maskPhone(dados.ddd_telefone_1.replace(/\D/g, ''))
              : ''),
          // Preencher endereço se disponível
          cep: dados.cep ? maskCEP(dados.cep) : formData.cep,
          street: dados.logradouro || formData.street,
          number: dados.numero || formData.number,
          complement: dados.complemento || formData.complement,
          neighborhood: dados.bairro || formData.neighborhood,
          city: dados.municipio || formData.city,
          state: dados.uf || formData.state,
        });

        toast({
          title: 'CNPJ consultado com sucesso',
          description: `Dados da empresa "${dados.razao_social}" preenchidos automaticamente.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao consultar CNPJ',
        description:
          error.message ||
          'Não foi possível consultar o CNPJ. Verifique se o CNPJ está correto.',
      });
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  // Handler para consultar CEP
  const handleConsultarCEP = async (showError = true) => {
    const cepLimpo = unmaskCEP(formData.cep);

    if (cepLimpo.length !== 8) {
      if (showError) {
        toast({
          variant: 'destructive',
          title: 'CEP inválido',
          description: 'Por favor, digite um CEP válido com 8 dígitos.',
        });
      }
      return;
    }

    setIsLoadingCEP(true);
    try {
      const dados = await consultarCEP(cepLimpo);

      if (dados) {
        setFormData({
          ...formData,
          cep: maskCEP(dados.cep),
          street: dados.street || formData.street,
          neighborhood: dados.neighborhood || formData.neighborhood,
          city: dados.city || formData.city,
          state: dados.state || formData.state,
        });

        toast({
          title: 'CEP consultado com sucesso',
          description: `Endereço de ${dados.city}/${dados.state} preenchido automaticamente.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao consultar CEP',
        description:
          error.message ||
          'Não foi possível consultar o CEP. Verifique se o CEP está correto.',
      });
    } finally {
      setIsLoadingCEP(false);
    }
  };

  // Handler para mudança no campo CEP (apenas formatação)
  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoCep = maskCEP(e.target.value);
    setFormData({
      ...formData,
      cep: novoCep,
    });
    // A consulta será feita no onBlur quando o usuário sair do campo
  };

  return (
    <div className='relative flex min-h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#f0f2f5] dark:border-b-[#101722] px-10 py-3 bg-white dark:bg-gray-900/50 w-full'>
          <CompanyLogo size='sm' className='text-[#111418] dark:text-white' />
          <Button
            className='bg-[#3880f5] hover:bg-[#3880f5]/90'
            onClick={() => setLocation('/')}
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            Voltar ao Login
          </Button>
        </header>
        <main className='flex flex-1 justify-center py-5 sm:py-10 px-4'>
          <div className='layout-content-container flex flex-col max-w-4xl flex-1 space-y-8'>
            <div className='flex flex-wrap justify-between gap-3 p-4'>
              <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72'>
                Cadastro de Empresa
              </h1>
            </div>
            <form onSubmit={handleSubmit} className='flex flex-col gap-8'>
              {/* Informações da Empresa */}
              <Card className='flex flex-col gap-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 md:p-8'>
                <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                  Informações da Empresa
                </h2>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6'>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      CNPJ
                    </Label>
                    <div className='flex w-full flex-1 items-stretch rounded-lg'>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] focus:outline-0 focus:ring-0 border border-[#dbdfe6] bg-white focus:border-[#3880f5] h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                        placeholder='00.000.000/0000-00'
                        value={formData.cnpj}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cnpj: maskCNPJ(e.target.value),
                          })
                        }
                        onBlur={(e) => {
                          // Consultar CNPJ ao sair do campo se estiver completo
                          const cnpjLimpo = unmaskCNPJ(e.currentTarget.value);
                          if (cnpjLimpo.length === 14 && !isLoadingCNPJ) {
                            handleConsultarCNPJ(false); // false = não mostrar erro se CNPJ estiver incompleto
                          }
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Razão Social
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Insira a razão social da empresa'
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Email de Contato
                    </Label>
                    <Input
                      type='email'
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='contato@empresa.com.br'
                      value={formData.email}
                    onChange={(e) => {
                      const newEmail = e.target.value;
                      setFormData((prev) => {
                        const shouldSyncResponsible =
                          !prev.responsibleEmail ||
                          prev.responsibleEmail === autoResponsibleEmail;
                        const next = { ...prev, email: newEmail };
                        if (shouldSyncResponsible) {
                          const generated = generateResponsibleEmail(
                            prev.responsibleName,
                            prev.responsibleEmail,
                            newEmail
                          );
                          if (generated) {
                            next.responsibleEmail = generated;
                            setAutoResponsibleEmail(generated);
                          }
                        }
                        return next;
                      });
                    }}
                      required
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Telefone
                    </Label>
                    <Input
                      type='tel'
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='(00) 00000-0000'
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: maskPhone(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </Card>

              {/* Endereço */}
              <Card className='flex flex-col gap-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 md:p-8'>
                <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                  Endereço
                </h2>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6'>
                  <div className='flex flex-col md:col-span-1'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      CEP
                    </Label>
                    <div className='flex w-full flex-1 items-stretch rounded-lg'>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] focus:outline-0 focus:ring-0 border border-[#dbdfe6] bg-white focus:border-[#3880f5] h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                        placeholder='00000-000'
                        value={formData.cep}
                        onChange={handleCEPChange}
                        onBlur={(e) => {
                          // Consultar ao sair do campo se CEP estiver completo
                          const cepLimpo = unmaskCEP(e.currentTarget.value);
                          if (cepLimpo.length === 8 && !isLoadingCEP) {
                            handleConsultarCEP(false); // false = não mostrar erro se CEP estiver incompleto
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className='flex flex-col md:col-span-2'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      // Logradouro
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Avenida Principal'
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex flex-col md:col-span-1'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Número
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='123'
                      value={formData.number}
                      onChange={(e) =>
                        setFormData({ ...formData, number: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex flex-col md:col-span-2'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Complemento
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Sala 101, Bloco A'
                      value={formData.complement}
                      onChange={(e) =>
                        setFormData({ ...formData, complement: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Bairro
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Centro'
                      value={formData.neighborhood}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          neighborhood: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Cidade
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='São Paulo'
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Estado
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='SP'
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                    />
                  </div>
                </div>
              </Card>

              {/* Primeiro Usuário */}
              <Card className='flex flex-col gap-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 md:p-8'>
                <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                  Primeiro Usuário (Administrador)
                </h2>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6'>
                  <div className='flex flex-col w-full md:col-span-2'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Nome Completo do Responsável
                    </Label>
                    <Input
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Insira o nome completo'
                      value={formData.responsibleName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        const shouldSyncEmail =
                          !prev.responsibleEmail ||
                          prev.responsibleEmail === autoResponsibleEmail;
                        const next = { ...prev, responsibleName: value };
                        if (shouldSyncEmail) {
                          const generated = generateResponsibleEmail(
                            value,
                            prev.responsibleEmail,
                            prev.email
                          );
                          if (generated) {
                            next.responsibleEmail = generated;
                            setAutoResponsibleEmail(generated);
                          }
                        }
                        return next;
                      });
                    }}
                      required
                    />
                  </div>
                  <div className='flex flex-col w-full md:col-span-2'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Email do Responsável (será o login)
                    </Label>
                    <Input
                      type='email'
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='seu.email@empresa.com.br'
                      value={formData.responsibleEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, responsibleEmail: val });
                      // Se o usuário editar manualmente, parar de sobrepor
                      setAutoResponsibleEmail('');
                    }}
                      required
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Senha
                    </Label>
                    <Input
                      type='password'
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Crie uma senha forte'
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className='flex flex-col w-full'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal pb-2'>
                      Confirmação de Senha
                    </Label>
                    <Input
                      type='password'
                      className='h-14 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:border-[#3880f5]'
                      placeholder='Confirme a senha'
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className='flex flex-col gap-2 md:col-span-2'>
                    <Label className='text-[#111418] dark:text-gray-300 text-base font-medium leading-normal'>
                      Perfil do Usuário
                    </Label>
                    <RadioGroup
                      value={formData.userRole}
                      onValueChange={(value: 'ADMIN' | 'ANALYST') =>
                        setFormData({ ...formData, userRole: value })
                      }
                      className='flex flex-col sm:flex-row gap-4'
                    >
                      <label className='flex items-center gap-3 p-4 border rounded-lg flex-1 cursor-pointer border-gray-300 dark:border-gray-700 has-[:checked]:border-[#3880f5] has-[:checked]:bg-[#3880f5]/10'>
                        <RadioGroupItem
                          value='ADMIN'
                          className='text-[#3880f5]'
                        />
                        <span className='text-[#111418] dark:text-gray-300 font-medium'>
                          Administrador
                        </span>
                      </label>
                      <label className='flex items-center gap-3 p-4 border rounded-lg flex-1 cursor-pointer border-gray-300 dark:border-gray-700 has-[:checked]:border-[#3880f5] has-[:checked]:bg-[#3880f5]/10'>
                        <RadioGroupItem
                          value='ANALYST'
                          className='text-[#3880f5]'
                        />
                        <span className='text-[#111418] dark:text-gray-300 font-medium'>
                          Analista
                        </span>
                      </label>
                    </RadioGroup>
                  </div>
                </div>
              </Card>

              <div className='flex justify-end p-4'>
                <Button
                  type='submit'
                  className='flex min-w-[160px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-8 bg-[#3880f5] text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90'
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? 'Cadastrando...'
                    : 'Finalizar Cadastro'}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
