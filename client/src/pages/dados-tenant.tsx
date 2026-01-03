import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { fetchCepData } from '@/services/CepService';
import { maskCPF, maskCNPJ, maskPhone, maskCEP, unmaskCEP } from '@/lib/masks';
import { slugify } from '@/lib/slugify';
import {
  Loader2,
  Camera,
  MapPin,
  Lock,
  User,
  Mail,
  Building2,
  Shield,
  Copy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

export default function DadosTenant() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('dados');

  // Forçar refetch dos dados do usuário ao carregar a página
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
  }, []);

  // Estados principais
  const [document, setDocument] = useState('');
  const [documentType, setDocumentType] = useState<'cpf' | 'cnpj' | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);

  // Estados dos campos editáveis
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');

  // Estados de endereço
  const [zipCode, setZipCode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Estados de segurança
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  // Carregar dados do usuário ao montar o componente
  useEffect(() => {
    if (isLoadingUser) return;

    if (user) {
      // Preencher dados pessoais
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setCompanyName(user.companyName || '');

      // Preencher telefone
      const phoneValue = user.phone;
      if (phoneValue && phoneValue !== null && phoneValue.trim() !== '') {
        const trimmedPhone = phoneValue.trim();
        if (trimmedPhone.includes('(') || trimmedPhone.includes('-')) {
          setPhone(trimmedPhone);
        } else {
          setPhone(maskPhone(trimmedPhone));
        }
      } else {
        setPhone('');
      }

      // Preencher documento (verificar tanto cpf quanto cnpj)
      // Prioridade: cnpj primeiro (se existir), senão cpf
      const documentValue = (user as any).cnpj || (user as any).cpf;
      if (documentValue) {
        const cleanDoc = documentValue.replace(/\D/g, '');
        if (cleanDoc.length === 14) {
          // CNPJ tem 14 dígitos
          setDocument(maskCNPJ(cleanDoc));
          setDocumentType('cnpj');
        } else if (cleanDoc.length === 11) {
          // CPF tem 11 dígitos
          setDocument(maskCPF(cleanDoc));
          setDocumentType('cpf');
        } else {
          // Tamanho inválido, tentar detectar pelo formato
          setDocument(documentValue);
          setDocumentType(cleanDoc.length === 14 ? 'cnpj' : 'cpf');
        }
      } else {
        setDocument('');
        setDocumentType(null);
      }

      // Preencher endereço
      const safeValue = (val: any) => {
        if (val === null || val === undefined || val === '') return '';
        return String(val);
      };

      setZipCode(safeValue((user as any).zipCode || (user as any).zip_code));
      setStreetAddress(
        safeValue((user as any).streetAddress || (user as any).street_address)
      );
      setAddressNumber(
        safeValue((user as any).addressNumber || (user as any).address_number)
      );
      setAddressComplement(
        safeValue(
          (user as any).addressComplement || (user as any).address_complement
        )
      );
      setNeighborhood(safeValue((user as any).neighborhood));
      setCity(safeValue((user as any).city));
      setState(safeValue((user as any).state));

      // Preencher preview da logo
      if (user.companyLogoUrl) {
        setPreviewLogo(user.companyLogoUrl);
      } else {
        setPreviewLogo(null);
      }
    }
  }, [user, isLoadingUser]);

  // Detectar tipo de documento e aplicar máscara
  const handleDocumentChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length <= 11) {
      setDocumentType('cpf');
      setDocument(maskCPF(cleanValue));
    } else {
      setDocumentType('cnpj');
      setDocument(maskCNPJ(cleanValue));
    }
  };

  // Consultar API ao sair do campo de documento (apenas para CNPJ)
  const handleDocumentBlur = async () => {
    const cleanDoc = document.replace(/\D/g, '');

    if (cleanDoc.length === 14 && documentType === 'cnpj') {
      setIsConsulting(true);
      setError(null);

      try {
        const response = await apiRequest(
          'GET',
          `/api/document/${cleanDoc}`,
          undefined
        );
        const data = (await response.json()) as any;

        if (data.companyName && !companyName) {
          setCompanyName(data.companyName);
        } else if (data.tradeName && !companyName) {
          setCompanyName(data.tradeName);
        }

        if (data.phone && !phone) {
          setPhone(data.phone);
        }

        if (data.address) {
          if (data.address.zipCode && !zipCode)
            setZipCode(data.address.zipCode);
          if (data.address.street && !streetAddress)
            setStreetAddress(data.address.street);
          if (data.address.number && !addressNumber)
            setAddressNumber(data.address.number);
          if (data.address.complement && !addressComplement)
            setAddressComplement(data.address.complement);
          if (data.address.neighborhood && !neighborhood)
            setNeighborhood(data.address.neighborhood);
          if (data.address.city && !city) setCity(data.address.city);
          if (data.address.state && !state) setState(data.address.state);
        }
      } catch (err: any) {
        if (err?.status !== 404) {
          setError(
            'Erro ao consultar documento. Você pode preencher os dados manualmente.'
          );
        }
      } finally {
        setIsConsulting(false);
      }
    }
  };

  // Handler para upload de logo da empresa
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

          if (!base64String || typeof base64String !== 'string') {
            throw new Error('Erro ao converter arquivo para base64');
          }

          setPreviewLogo(base64String);

          const response = await apiRequest('POST', '/api/user/company-logo', {
            image: base64String,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Erro ao fazer upload');
          }

          const updatedUser = await response.json();
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

          toast({
            title: 'Logo atualizada',
            description: 'A logo da empresa foi atualizada com sucesso.',
          });

          if (updatedUser.companyLogoUrl) {
            setPreviewLogo(updatedUser.companyLogoUrl);
          }
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

  // Função para buscar CEP e preencher endereço
  const handleSearchCep = async () => {
    const cleanCep = unmaskCEP(zipCode || '');
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const cepData = await fetchCepData(cleanCep);
      if (cepData) {
        setZipCode(maskCEP(cepData.cep || cleanCep));
        setStreetAddress(cepData.street || streetAddress || '');
        setNeighborhood(cepData.neighborhood || neighborhood || '');
        setCity(cepData.city || city || '');
        setState(cepData.state || state || '');
        
        toast({
          title: 'Endereço encontrado',
          description: 'Os dados do endereço foram preenchidos.',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível carregar os dados do endereço.',
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanDoc = document.replace(/\D/g, '');
      const cleanPhone = phone.replace(/\D/g, '');

      if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        setError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
        setLoading(false);
        return;
      }

      if (!companyName.trim()) {
        setError('Nome da empresa é obrigatório');
        setLoading(false);
        return;
      }
      if (!cleanPhone || cleanPhone.length < 10) {
        setError('Telefone é obrigatório e deve ter pelo menos 10 dígitos');
        setLoading(false);
        return;
      }
      if (!zipCode.trim()) {
        setError('CEP é obrigatório');
        setLoading(false);
        return;
      }
      if (!streetAddress.trim()) {
        setError('Logradouro é obrigatório');
        setLoading(false);
        return;
      }
      if (!addressNumber.trim()) {
        setError('Número é obrigatório');
        setLoading(false);
        return;
      }
      if (!neighborhood.trim()) {
        setError('Bairro é obrigatório');
        setLoading(false);
        return;
      }
      if (!city.trim()) {
        setError('Cidade é obrigatória');
        setLoading(false);
        return;
      }
      if (!state.trim() || state.length !== 2) {
        setError('Estado (UF) é obrigatório e deve ter 2 caracteres');
        setLoading(false);
        return;
      }

      if (!previewLogo && !user?.companyLogoUrl) {
        setError('Logo da empresa é obrigatória');
        setLoading(false);
        return;
      }

      const tenantSlug = companyName ? slugify(companyName) : undefined;

      const payload = {
        firstName: firstName.trim() || user?.firstName || '',
        lastName: lastName.trim() || user?.lastName || '',
        companyName: companyName.trim(),
        tenantSlug: tenantSlug,
        phone: cleanPhone,
        cpf: documentType === 'cpf' ? cleanDoc : undefined,
        cnpj: documentType === 'cnpj' ? cleanDoc : undefined,
        zipCode: zipCode.trim() || '',
        streetAddress: streetAddress.trim() || '',
        addressNumber: addressNumber.trim() || '',
        addressComplement: addressComplement.trim() || '',
        neighborhood: neighborhood.trim() || '',
        city: city.trim() || '',
        state: state.trim().toUpperCase() || '',
      };

      const response = await apiRequest(
        'POST',
        '/api/profile/complete',
        payload
      );
      await response.json();

      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const verifyResponse = await apiRequest(
          'GET',
          '/api/profile/verify',
          undefined
        );
        const verifyData = await verifyResponse.json();

        if (verifyData.isComplete) {
          setSuccess(
            '  Dados salvos e confirmados no banco de dados com sucesso!'
          );
          toast({
            title: 'Dados confirmados no banco',
            description: `Todos os dados foram salvos e verificados no banco de dados. ${verifyData.message}`,
            duration: 5000,
          });
        } else {
          setError(
            `⚠️ Dados enviados, mas alguns campos não foram salvos: ${verifyData.missingFields.join(
              ', '
            )}. Por favor, tente novamente.`
          );
          toast({
            variant: 'destructive',
            title: 'Aviso',
            description: `Alguns dados não foram salvos: ${verifyData.missingFields.join(
              ', '
            )}`,
            duration: 5000,
          });
        }
      } catch (verifyError: any) {
        setSuccess(
          'Dados atualizados com sucesso! (Verificação não disponível)'
        );
        toast({
          title: 'Dados salvos',
          description:
            'Os dados foram enviados, mas não foi possível verificar no banco.',
          duration: 3000,
        });
      }

      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar dados');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError('Todos os campos são obrigatórios');
        setPasswordLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
        setPasswordLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('As senhas não coincidem');
        setPasswordLoading(false);
        return;
      }

      const response = await apiRequest('POST', '/api/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao alterar senha');
      }

      setPasswordSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso.',
      });

      setTimeout(() => {
        setPasswordSuccess(null);
        setPasswordError(null);
      }, 5000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Erro ao alterar senha');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    window.history.back();
  };

  // Formatar data para exibição no horário de Brasília (UTC-3)
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Não informado';
    try {
      // Garantir que a data seja interpretada como UTC
      // Se não termina com Z e não tem offset, adicionar Z
      let utcDateString = dateString;
      if (utcDateString.includes('T')) {
        // Se tem T mas não tem timezone (Z, + ou -), adicionar Z
        if (
          !utcDateString.endsWith('Z') &&
          !utcDateString.match(/[+-]\d{2}:\d{2}$/) &&
          !utcDateString.match(/[+-]\d{4}$/)
        ) {
          utcDateString = utcDateString.endsWith('Z')
            ? utcDateString
            : utcDateString + 'Z';
        }
      }

      const date = new Date(utcDateString);

      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        console.error('Data inválida:', dateString);
        return dateString;
      }

      // Usar Intl.DateTimeFormat para converter para Brasília (UTC-3)
      // O timezone 'America/Sao_Paulo' é UTC-3
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const day =
        parts.find((p) => p.type === 'day')?.value.padStart(2, '0') || '';
      const month =
        parts.find((p) => p.type === 'month')?.value.padStart(2, '0') || '';
      const year = parts.find((p) => p.type === 'year')?.value || '';
      const hour =
        parts.find((p) => p.type === 'hour')?.value.padStart(2, '0') || '';
      const minute =
        parts.find((p) => p.type === 'minute')?.value.padStart(2, '0') || '';

      // Debug: verificar conversão
      const utcTime = date.toISOString();
      const brasiliaTime = `${day}/${month}/${year} às ${hour}:${minute}`;
      console.log('[formatDate] Conversão:', {
        original: dateString,
        utc: utcTime,
        brasilia: brasiliaTime,
        dateObject: date.toString(),
      });

      return brasiliaTime;
    } catch (error) {
      console.error('Erro ao formatar data:', error, dateString);
      return dateString;
    }
  };

  if (isLoadingUser) {
    return (
      <div className='space-y-4 sm:space-y-6 px-4 sm:px-0'>
        <div className='flex items-center gap-4'>
          <div>
            <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
              Meus Dados
            </h1>
            <p className='text-sm text-muted-foreground mt-1'>
              Carregando seus dados...
            </p>
          </div>
        </div>
        <div className='max-w-3xl'>
          <Card className='border-0 shadow-lg'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4 sm:space-y-6 px-4 sm:px-0'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <div>
          <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
            Meus Dados
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Gerencie seus dados pessoais, empresariais e segurança da conta.
          </p>
        </div>
      </div>

      <div className='max-w-4xl'>
        <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
          <TabsList className='grid w-full grid-cols-2 mb-6'>
            <TabsTrigger value='dados' className='flex items-center gap-2'>
              <User className='w-4 h-4' />
              Dados Cadastrais
            </TabsTrigger>
            <TabsTrigger value='seguranca' className='flex items-center gap-2'>
              <Shield className='w-4 h-4' />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Aba: Dados Cadastrais */}
          <TabsContent value='dados'>
            <Card className='border-0 shadow-lg'>
              <CardHeader className='pb-6'>
                <CardTitle className='text-2xl font-bold tracking-tight flex items-center gap-2'>
                  <Building2 className='w-5 h-5' />
                  Dados Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className='pt-0'>
                <form className='space-y-6' onSubmit={handleSubmit}>
                  {/* Informações Pessoais */}
                  <div className='space-y-4 border-b pb-6'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <User className='w-5 h-5' />
                      Informações Pessoais
                    </h3>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label
                          htmlFor='firstName'
                          className='text-sm font-medium'
                        >
                          Primeiro Nome
                        </Label>
                        <Input
                          id='firstName'
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder='Seu primeiro nome'
                          className='h-11 text-base'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label
                          htmlFor='lastName'
                          className='text-sm font-medium'
                        >
                          Sobrenome
                        </Label>
                        <Input
                          id='lastName'
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder='Seu sobrenome'
                          className='h-11 text-base'
                        />
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <Label
                        htmlFor='email'
                        className='text-sm font-medium flex items-center gap-2'
                      >
                        <Mail className='w-4 h-4' />
                        E-mail
                      </Label>
                      <div className='relative'>
                        <Input
                          id='email'
                          type='email'
                          value={email}
                          disabled
                          className='h-11 text-base bg-muted pr-10'
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='absolute right-0 top-0 h-11 w-11 hover:bg-muted-foreground/10'
                          onClick={() => {
                            navigator.clipboard.writeText(email);
                            toast({
                              title: 'Email copiado!',
                              description: 'O email foi copiado para a área de transferência.',
                            });
                          }}
                          title='Copiar email'
                        >
                          <Copy className='h-4 w-4' />
                        </Button>
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        O e-mail não pode ser alterado
                      </p>
                    </div>
                  </div>

                  {/* Informações da Empresa */}
                  <div className='space-y-4 border-b pb-6'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Building2 className='w-5 h-5' />
                      Informações da Empresa
                    </h3>

                    {/* Campo CPF/CNPJ */}
                    <div className='space-y-2'>
                      <Label htmlFor='document' className='text-sm font-medium'>
                        CPF ou CNPJ <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='document'
                        value={document}
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        onBlur={handleDocumentBlur}
                        placeholder='Digite CPF ou CNPJ'
                        required
                        disabled={isConsulting}
                        className='h-11 text-base'
                      />
                      {isConsulting && (
                        <p className='text-xs text-muted-foreground mt-1.5'>
                          Consultando dados...
                        </p>
                      )}
                      {documentType && (
                        <p className='text-xs text-muted-foreground mt-1.5'>
                          Tipo detectado: {documentType.toUpperCase()}
                        </p>
                      )}
                    </div>

                    {/* Logo da empresa */}
                    <div className='space-y-2'>
                      <div className='flex items-center gap-4'>
                        <label
                          htmlFor='logo-upload'
                          className='relative flex-shrink-0 cursor-pointer'
                        >
                          <div className='w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden'>
                            {previewLogo ? (
                              <img
                                src={previewLogo}
                                alt='Logo da empresa'
                                className='w-full h-full object-contain p-2'
                              />
                            ) : (
                              <Camera className='w-8 h-8 text-gray-400' />
                            )}
                          </div>
                          <div className='absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm'>
                            <Camera className='w-3.5 h-3.5 text-white' />
                          </div>
                          {isUploadingLogo && (
                            <div className='absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center'>
                              <Loader2 className='w-5 h-5 animate-spin text-white' />
                            </div>
                          )}
                        </label>

                        <div className='flex-1 flex items-center gap-3'>
                          <span className='text-sm font-medium text-gray-700'>
                            // Logo da empresa
                          </span>
                          <label
                            htmlFor='logo-upload'
                            className='text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer'
                          >
                            {isUploadingLogo ? 'Enviando...' : 'Alterar logo'}
                          </label>
                        </div>

                        <input
                          id='logo-upload'
                          type='file'
                          accept='image/jpeg,image/jpg,image/png,image/gif'
                          onChange={handleLogoUpload}
                          className='hidden'
                          disabled={isUploadingLogo}
                        />
                      </div>
                      {!previewLogo && !user?.companyLogoUrl && (
                        <p className='text-xs text-destructive mt-1.5'>
                          * Logo da empresa é obrigatória
                        </p>
                      )}
                    </div>

                    {/* Nome da empresa */}
                    <div className='space-y-2'>
                      <Label
                        htmlFor='companyName'
                        className='text-sm font-medium'
                      >
                        Nome da Empresa{' '}
                        <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='companyName'
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder='Minha Empresa LTDA'
                        required
                        className='h-11 text-base'
                      />
                    </div>

                    {/* URL do sistema */}
                    {companyName && (
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium text-muted-foreground'>
                          URL do seu sistema
                        </Label>
                        <div className='h-11 px-3 rounded-md border border-gray-200 bg-gray-50 flex items-center text-sm text-gray-700 font-mono'>
                          www.clicksync.com.br/{slugify(companyName)}
                        </div>
                      </div>
                    )}

                    {/* Telefone */}
                    <div className='space-y-2'>
                      <Label htmlFor='phone' className='text-sm font-medium'>
                        Telefone (com DDD){' '}
                        <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='phone'
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        placeholder='(00) 00000-0000'
                        required
                        className='h-11 text-base'
                      />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className='space-y-5 border-b pb-6'>
                    <div className='flex items-center gap-2'>
                      <MapPin className='w-5 h-5 text-gray-600' />
                      <h3 className='text-lg font-semibold'>Endereço</h3>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                      <div className='space-y-2'>
                        <Label
                          htmlFor='zipCode'
                          className='text-sm font-medium'
                        >
                          CEP <span className='text-destructive'>*</span>
                        </Label>
                        <div className='relative'>
                          <Input
                            id='zipCode'
                            value={zipCode}
                            onChange={(e) => setZipCode(maskCEP(e.target.value))}
                            onBlur={handleSearchCep}
                            placeholder='00000-000'
                            required
                            className='h-11 text-base pr-10'
                            maxLength={9}
                          />
                          {isLoadingCep && (
                            <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
                          )}
                        </div>
                      </div>
                      <div className='sm:col-span-2 space-y-2'>
                        <Label
                          htmlFor='streetAddress'
                          className='text-sm font-medium'
                        >
                          // Logradouro <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                          id='streetAddress'
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                          placeholder='Rua, Avenida, etc.'
                          required
                          className='h-11 text-base'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                      <div className='space-y-2'>
                        <Label
                          htmlFor='addressNumber'
                          className='text-sm font-medium'
                        >
                          Número <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                          id='addressNumber'
                          value={addressNumber}
                          onChange={(e) => setAddressNumber(e.target.value)}
                          placeholder='123'
                          required
                          className='h-11 text-base'
                        />
                      </div>
                      <div className='sm:col-span-2 space-y-2'>
                        <Label
                          htmlFor='addressComplement'
                          className='text-sm font-medium'
                        >
                          Complemento
                        </Label>
                        <Input
                          id='addressComplement'
                          value={addressComplement}
                          onChange={(e) => setAddressComplement(e.target.value)}
                          placeholder='Apto, Sala, etc.'
                          className='h-11 text-base'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                      <div className='space-y-2'>
                        <Label
                          htmlFor='neighborhood'
                          className='text-sm font-medium'
                        >
                          Bairro <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                          id='neighborhood'
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          placeholder='Bairro'
                          required
                          className='h-11 text-base'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='city' className='text-sm font-medium'>
                          Cidade <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                          id='city'
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder='Cidade'
                          required
                          className='h-11 text-base'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='state' className='text-sm font-medium'>
                          Estado (UF){' '}
                          <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                          id='state'
                          value={state}
                          onChange={(e) =>
                            setState(e.target.value.toUpperCase())
                          }
                          placeholder='SP'
                          maxLength={2}
                          required
                          className='h-11 text-base'
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informações do Sistema (somente leitura) */}
                  <div className='space-y-4'>
                    <h3 className='text-lg font-semibold'>
                      Informações do Sistema
                    </h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium text-muted-foreground'>
                          Data de Criação
                        </Label>
                        <div className='h-11 px-3 rounded-md border border-gray-200 bg-gray-50 flex items-center text-sm text-gray-700'>
                          {formatDate((user as any)?.createdAt)}
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium text-muted-foreground'>
                          Última Atualização
                        </Label>
                        <div className='h-11 px-3 rounded-md border border-gray-200 bg-gray-50 flex items-center text-sm text-gray-700'>
                          {formatDate((user as any)?.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <Alert variant='destructive' className='mt-6'>
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className='mt-6'>
                      <AlertTitle>Sucesso</AlertTitle>
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className='flex gap-3 mt-6'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={handleCancel}
                      className='flex-1 h-12 text-base font-semibold'
                      disabled={loading || isConsulting || isUploadingLogo}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type='submit'
                      className='flex-1 h-12 text-base font-semibold'
                      disabled={loading || isConsulting || isUploadingLogo}
                    >
                      {loading ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Salvando...
                        </>
                      ) : (
                        'Salvar alterações'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Segurança */}
          <TabsContent value='seguranca'>
            <Card className='border-0 shadow-lg'>
              <CardHeader className='pb-6'>
                <CardTitle className='text-2xl font-bold tracking-tight flex items-center gap-2'>
                  <Shield className='w-5 h-5' />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className='pt-0'>
                <form className='space-y-6' onSubmit={handlePasswordSubmit}>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2 mb-4'>
                      <Lock className='w-5 h-5 text-primary' />
                      <h3 className='text-lg font-semibold'>Alterar Senha</h3>
                    </div>

                    <div className='space-y-2'>
                      <Label
                        htmlFor='currentPassword'
                        className='text-sm font-medium'
                      >
                        Senha Atual <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='currentPassword'
                        type='password'
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder='Digite sua senha atual'
                        required
                        className='h-11 text-base'
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label
                        htmlFor='newPassword'
                        className='text-sm font-medium'
                      >
                        Nova Senha <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='newPassword'
                        type='password'
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder='Digite sua nova senha (mínimo 6 caracteres)'
                        required
                        className='h-11 text-base'
                      />
                      <p className='text-xs text-muted-foreground'>
                        A senha deve ter pelo menos 6 caracteres
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <Label
                        htmlFor='confirmPassword'
                        className='text-sm font-medium'
                      >
                        Confirmar Nova Senha{' '}
                        <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='confirmPassword'
                        type='password'
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder='Digite novamente sua nova senha'
                        required
                        className='h-11 text-base'
                      />
                    </div>

                    {passwordError && (
                      <Alert variant='destructive'>
                        <AlertTitle>Erro</AlertTitle>
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}

                    {passwordSuccess && (
                      <Alert>
                        <AlertTitle>Sucesso</AlertTitle>
                        <AlertDescription>{passwordSuccess}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type='submit'
                      className='w-full h-12 text-base font-semibold'
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Alterando senha...
                        </>
                      ) : (
                        'Alterar Senha'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. Tem certeza que deseja sair? Todas
              as alterações serão descartadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}