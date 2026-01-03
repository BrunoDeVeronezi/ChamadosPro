import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Upload } from 'lucide-react';
import { Link } from 'wouter';

// Função para gerar slug a partir do nome da empresa
function slugify(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export default function Perfil() {
  const { toast } = useToast();
  const { user, requirePassword } = useAuth();

  // Buscar dados do usuário diretamente com useQuery para garantir que sempre temos os dados mais recentes
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch user');
      }
      return await res.json();
    },
    staleTime: 0, // Sempre buscar dados frescos
    refetchOnMount: true, // Sempre refetch quando o componente monta
    refetchOnWindowFocus: false,
  });

  // Usar userData se disponível, caso contrário usar user do useAuth
  const currentUser = userData || user;
  const isCompany = currentUser?.role === 'company';
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    publicSlug: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null); // Preview local da imagem
  const [previewLogo, setPreviewLogo] = useState<string | null>(null); // Preview local da logo
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [lastInitializedUserId, setLastInitializedUserId] = useState<
    string | null
  >(null);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Forçar refetch dos dados do usuário quando o componente monta ou quando a página ganha foco
  useEffect(() => {
    console.log('[Perfil] 🔄 Componente montado, forçando refetch');
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });

    // Também refetch quando a janela ganha foco (usuário volta para a aba)
    const handleFocus = () => {
      console.log('[Perfil] 🔄 Janela ganhou foco, refetching dados');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Inicializar formulário sempre que currentUser mudar ou quando voltar à página
  useEffect(() => {
    if (currentUser && currentUser.id) {
      // Se já foi inicializado com este usuário, verificar se os dados mudaram
      if (isInitialized && lastInitializedUserId === currentUser.id) {
        // Verificar se os dados mudaram comparando com os dados do servidor
        const email = currentUser.email || '';
        const emailParts = email.split('+');
        const originalEmail =
          emailParts.length > 1
            ? `${emailParts[0]}@${email.split('@')[1]}`
            : email;

        const serverFormData = {
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          companyName: currentUser.companyName || '',
          email: originalEmail,
          publicSlug:
            currentUser.publicSlug || slugify(currentUser.companyName || ''),
        };

        // Só atualizar se os dados do servidor mudaram E o usuário não editou
        // Mas sempre atualizar firstName e lastName se estiverem vazios no formulário mas disponíveis no servidor
        if (!hasUserEdited) {
          const hasChanged =
            formData.firstName !== serverFormData.firstName ||
            formData.lastName !== serverFormData.lastName ||
            formData.companyName !== serverFormData.companyName ||
            formData.email !== serverFormData.email ||
            formData.publicSlug !== serverFormData.publicSlug;

          if (hasChanged) {
            console.log(
              '[Perfil] 📝 Dados do servidor mudaram, atualizando formulário'
            );
            setFormData(serverFormData);
          }
        } else {
          // Se o usuário editou, mas firstName ou lastName estão vazios no formulário e disponíveis no servidor, preencher
          const shouldUpdateFirstName =
            !formData.firstName && serverFormData.firstName;
          const shouldUpdateLastName =
            !formData.lastName && serverFormData.lastName;

          if (shouldUpdateFirstName || shouldUpdateLastName) {
            console.log(
              '[Perfil] 📝 Preenchendo campos vazios com dados do servidor'
            );
            setFormData((prev) => ({
              ...prev,
              firstName: shouldUpdateFirstName
                ? serverFormData.firstName
                : prev.firstName,
              lastName: shouldUpdateLastName
                ? serverFormData.lastName
                : prev.lastName,
            }));
          }
        }
        return;
      }

      // Primeira inicialização ou mudança de usuário
      console.log(
        '[Perfil] 📝 Inicializando formulário com dados do usuário:',
        {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          companyName: currentUser.companyName,
          email: currentUser.email,
          publicSlug: currentUser.publicSlug,
          profileImageUrl: currentUser.profileImageUrl,
          companyLogoUrl: currentUser.companyLogoUrl,
        }
      );

      // Obter email original (sem o sufixo +role)
      const email = currentUser.email || '';
      const emailParts = email.split('+');
      const originalEmail =
        emailParts.length > 1
          ? `${emailParts[0]}@${email.split('@')[1]}`
          : email;

      const formDataToSet = {
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        companyName: currentUser.companyName || '',
        email: originalEmail,
        publicSlug:
          currentUser.publicSlug || slugify(currentUser.companyName || ''),
      };

      console.log(
        '[Perfil] 📋 Dados do formulário a serem definidos:',
        formDataToSet
      );

      setFormData(formDataToSet);

      // Atualizar previews com as URLs do servidor
      if (currentUser.profileImageUrl) {
        console.log(
          '[Perfil] 🖼️ Definindo preview da imagem:',
          currentUser.profileImageUrl
        );
        setPreviewImage(currentUser.profileImageUrl);
      } else {
        setPreviewImage(null);
      }
      if (currentUser.companyLogoUrl) {
        console.log(
          '[Perfil] 🖼️ Definindo preview da logo:',
          currentUser.companyLogoUrl
        );
        setPreviewLogo(currentUser.companyLogoUrl);
      } else {
        setPreviewLogo(null);
      }

      setIsInitialized(true);
      setLastInitializedUserId(currentUser.id);
      setHasUserEdited(false);
    }
  }, [
    currentUser?.id,
    currentUser?.firstName,
    currentUser?.lastName,
    currentUser?.companyName,
    currentUser?.email,
    currentUser?.publicSlug,
    isInitialized,
    lastInitializedUserId,
    hasUserEdited,
  ]);

  // Atualizar apenas os previews quando as imagens mudarem (sem resetar o formulário)
  useEffect(() => {
    if (
      currentUser &&
      isInitialized &&
      lastInitializedUserId === currentUser.id
    ) {
      // Apenas atualizar previews se mudaram, sem resetar o formulário
      if (
        currentUser.profileImageUrl &&
        currentUser.profileImageUrl !== previewImage
      ) {
        setPreviewImage(currentUser.profileImageUrl);
      } else if (!currentUser.profileImageUrl && previewImage) {
        setPreviewImage(null);
      }
      if (
        currentUser.companyLogoUrl &&
        currentUser.companyLogoUrl !== previewLogo
      ) {
        setPreviewLogo(currentUser.companyLogoUrl);
      } else if (!currentUser.companyLogoUrl && previewLogo) {
        setPreviewLogo(null);
      }
    }
  }, [
    currentUser?.profileImageUrl,
    currentUser?.companyLogoUrl,
    isInitialized,
    lastInitializedUserId,
  ]);

  // Gerar slug automaticamente quando o nome da empresa mudar
  useEffect(() => {
    if (formData.companyName && isInitialized) {
      const generatedSlug = slugify(formData.companyName);
      if (generatedSlug && generatedSlug !== formData.publicSlug) {
        setFormData((prev) => ({
          ...prev,
          publicSlug: generatedSlug,
        }));
      }
    }
  }, [formData.companyName, isInitialized, formData.publicSlug]);

  // Limpa preview quando o upload é bem-sucedido e o usuário é atualizado
  // Mas só limpa se a URL do servidor for diferente do preview
  useEffect(() => {
    if (currentUser?.profileImageUrl && previewImage && !isUploading) {
      // Aguarda um pouco para garantir que a imagem foi salva no servidor
      const timer = setTimeout(() => {
        // Só limpa o preview se a URL do servidor estiver disponível
        if (
          currentUser.profileImageUrl &&
          currentUser.profileImageUrl !== previewImage
        ) {
          setPreviewImage(null);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.profileImageUrl, isUploading, previewImage]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[Perfil] 💾 Salvando dados:', data);

      // Incluir companyName para todos os tipos de usuário
      const payload: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        publicSlug: data.publicSlug,
        companyName: data.companyName, // Agora disponível para técnicos também
      };

      // Incluir email se fornecido
      if (data.email) {
        payload.email = data.email;
      }

      console.log('[Perfil] 📤 Payload enviado:', payload);

      const response = await apiRequest('PATCH', '/api/user/profile', payload);
      const result = await response.json();

      console.log('[Perfil] ✅ Resposta recebida:', result);

      return result;
    },
    onSuccess: async (updatedUser) => {
      console.log('[Perfil] ✅ onSuccess chamado com:', updatedUser);

      // Sempre refetch os dados do servidor para garantir que temos os dados mais recentes
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });

      // Obter dados atualizados do cache ou usar o retorno do mutation
      const userData =
        (queryClient.getQueryData(['/api/auth/user']) as any) || updatedUser;

      if (userData) {
        // Obter email original (sem o sufixo +role)
        const email = userData.email || '';
        const emailParts = email.split('+');
        const originalEmail =
          emailParts.length > 1
            ? `${emailParts[0]}@${email.split('@')[1]}`
            : email;

        const finalUserData = {
          ...userData,
          email: originalEmail,
        };

        console.log('[Perfil] 📝 Atualizando cache e formulário com:', {
          firstName: finalUserData.firstName,
          lastName: finalUserData.lastName,
          companyName: finalUserData.companyName,
          email: finalUserData.email,
          publicSlug: finalUserData.publicSlug,
          profileImageUrl: finalUserData.profileImageUrl,
          companyLogoUrl: finalUserData.companyLogoUrl,
        });

        // Atualizar cache
        queryClient.setQueryData(['/api/auth/user'], finalUserData);

        // Atualizar formData com os dados retornados do servidor (NÃO limpar campos)
        setFormData({
          firstName: finalUserData.firstName || '',
          lastName: finalUserData.lastName || '',
          companyName: finalUserData.companyName || '',
          email: originalEmail,
          publicSlug:
            finalUserData.publicSlug ||
            slugify(finalUserData.companyName || ''),
        });

        // Atualizar previews se disponíveis (preservar logo e imagem de perfil)
        if (finalUserData.profileImageUrl) {
          console.log(
            '[Perfil] 🖼️ Atualizando preview da imagem:',
            finalUserData.profileImageUrl
          );
          setPreviewImage(finalUserData.profileImageUrl);
        }
        if (finalUserData.companyLogoUrl) {
          console.log(
            '[Perfil] 🖼️ Preservando logo após salvar perfil:',
            finalUserData.companyLogoUrl
          );
          setPreviewLogo(finalUserData.companyLogoUrl);
        }
      }

      // Resetar flag de edição após salvar
      setHasUserEdited(false);

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar perfil',
        description: error.message || 'Não foi possível atualizar o perfil.',
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault(); // Previne qualquer comportamento padrão
    e.stopPropagation(); // Para propagação do evento

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

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/gif', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Apenas JPG, GIF ou PNG são permitidos.',
      });
      return;
    }

    // Criar preview local imediatamente
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String); // Atualiza preview local
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      // Converter arquivo para base64 novamente para upload
      const uploadReader = new FileReader();
      uploadReader.onloadend = async () => {
        try {
          const base64String = uploadReader.result as string;

          const response = await apiRequest('POST', '/api/user/profile-image', {
            image: base64String,
          });
          const userData = await response.json();

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

          queryClient.setQueryData(['/api/auth/user'], userDataWithEmail);

          // NÃO resetar o formulário - apenas atualizar o preview da imagem
          // O formulário mantém os dados que o usuário digitou

          toast({
            title: 'Imagem atualizada',
            description: 'Sua foto de perfil foi atualizada com sucesso.',
          });
        } catch (error: any) {
          // Em caso de erro, remove o preview
          setPreviewImage(null);
          toast({
            variant: 'destructive',
            title: 'Erro ao fazer upload',
            description:
              error.message || 'Não foi possível fazer upload da imagem.',
          });
        } finally {
          setIsUploading(false);
        }
      };

      uploadReader.onerror = () => {
        setPreviewImage(null);
        toast({
          variant: 'destructive',
          title: 'Erro ao ler arquivo',
          description: 'Não foi possível ler o arquivo selecionado.',
        });
        setIsUploading(false);
      };

      uploadReader.readAsDataURL(file);
    } catch (error: any) {
      setPreviewImage(null);
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer upload',
        description:
          error.message || 'Não foi possível fazer upload da imagem.',
      });
      setIsUploading(false);
    }

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  // Handler para upload de logo da empresa
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.target.files?.[0];
    if (!file) {
      console.log('[Perfil] ❌ Nenhum arquivo selecionado');
      return;
    }

    console.log('[Perfil] 📤 Iniciando upload de logo:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (file.size > 800 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 800KB.',
      });
      return;
    }

    // Validar tipo de arquivo
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
      // Converter arquivo para base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          if (!base64String || typeof base64String !== 'string') {
            throw new Error('Erro ao converter arquivo para base64');
          }

          console.log(
            '[Perfil] 📤 Base64 gerado, tamanho:',
            base64String.length
          );

          // Criar preview local imediatamente
          setPreviewLogo(base64String);

          console.log(
            '[Perfil] 📤 Enviando requisição para /api/user/company-logo'
          );

          const response = await apiRequest('POST', '/api/user/company-logo', {
            image: base64String,
          });

          console.log(
            '[Perfil] ✅ Resposta recebida:',
            response.status,
            response.statusText
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[Perfil] ❌ Erro na resposta:', errorText);
            throw new Error(
              errorText || `Erro ${response.status}: ${response.statusText}`
            );
          }

          const userData = await response.json();
          console.log('[Perfil] ✅ Dados do usuário recebidos:', {
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

          queryClient.setQueryData(['/api/auth/user'], userDataWithEmail);

          // Invalidar e refetch para garantir que todos os componentes vejam a atualização
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });

          // Atualizar preview com a URL do servidor se disponível
          if (userDataWithEmail.companyLogoUrl) {
            console.log(
              '[Perfil] 🖼️ Atualizando preview com URL do servidor:',
              userDataWithEmail.companyLogoUrl
            );
            setPreviewLogo(userDataWithEmail.companyLogoUrl);
          }

          toast({
            title: 'Logo atualizada',
            description: 'A logo da empresa foi atualizada com sucesso.',
          });
        } catch (error: any) {
          console.error('[Perfil] ❌ Erro ao fazer upload da logo:', error);

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

      reader.onerror = (error) => {
        console.error('[Perfil] ❌ Erro ao ler arquivo:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao ler arquivo',
          description: 'Não foi possível ler o arquivo selecionado.',
        });
        setIsUploadingLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('[Perfil] ❌ Erro geral no upload:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer upload',
        description: error.message || 'Não foi possível fazer upload da logo.',
      });
      setIsUploadingLogo(false);
    }
  };

  const initials =
    currentUser?.firstName && currentUser?.lastName
      ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase()
      : currentUser?.email?.[0].toUpperCase() || '';

  // Mostrar loading enquanto os dados estão sendo carregados pela primeira vez
  if (isLoadingUser && !currentUser) {
    return (
      <div className='mx-auto max-w-4xl'>
        <div className='flex flex-col gap-6 p-6'>
          <div>
            <h1 className='text-3xl font-bold text-[#111418] dark:text-white'>
              Meu Perfil
            </h1>
            <p className='text-[#60708a] dark:text-gray-400 mt-1'>
              Carregando seus dados...
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
        <Link
          href='/configuracoes'
          className='text-[#60708a] dark:text-gray-400 hover:text-primary dark:hover:text-primary text-base font-medium leading-normal'
        >
          Configurações
        </Link>
        <span className='text-[#60708a] dark:text-gray-500 text-base font-medium leading-normal'>
          /
        </span>
        <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
          {isCompany ? 'Perfil da Empresa' : 'Meu Perfil'}
        </span>
      </div>

      <div className='mb-8'>
        <div className='flex flex-wrap justify-between gap-3'>
          <div className='flex min-w-72 flex-col gap-2'>
            <p className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
              {isCompany ? 'Perfil da Empresa' : 'Meu Perfil'}
            </p>
            <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              {isCompany
                ? 'Visualize e edite as informações da sua empresa'
                : 'Visualize e edite suas informações pessoais'}
            </p>
          </div>
        </div>
      </div>

      <Card className='bg-white dark:bg-gray-900/50 dark:border dark:border-white/10 p-6 md:p-8 rounded-xl shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-center border-b border-gray-200 dark:border-white/10 pb-8 mb-8'>
          <div className='flex w-full flex-col gap-4 md:flex-row md:items-center'>
            <div className='flex gap-4 items-center'>
              {isCompany ? (
                // Logo da Empresa
                <div className='flex flex-col gap-4'>
                  <div className='relative'>
                    {user?.companyLogoUrl ? (
                      <img
                        src={user.companyLogoUrl}
                        alt={user.companyName || 'Logo da Empresa'}
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
              ) : (
                // Avatar do Técnico
                <>
                  <Avatar className='h-24 w-24 md:h-32 md:w-32 flex-shrink-0'>
                    {previewImage || user?.profileImageUrl ? (
                      <AvatarImage
                        src={previewImage || user?.profileImageUrl}
                        alt={user?.email || 'Avatar'}
                        key={previewImage || user?.profileImageUrl}
                      />
                    ) : (
                      <AvatarFallback className='bg-primary/20 text-primary text-2xl'>
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className='flex flex-col justify-center gap-1'>
                    <p className='text-[#111418] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]'>
                      Alterar Imagem
                    </p>
                    <p className='text-[#60708a] dark:text-gray-400 text-sm font-normal leading-normal'>
                      JPG, GIF ou PNG. Tamanho máximo de 800K
                    </p>
                    <label className='mt-2'>
                      <input
                        type='file'
                        accept='image/jpeg,image/jpg,image/gif,image/png'
                        onChange={handleImageUpload}
                        className='hidden'
                        disabled={isUploading}
                        id='profile-image-input'
                      />
                      <Button
                        type='button'
                        variant='link'
                        className='text-sm font-medium text-[#3880f5] hover:underline self-start p-0 h-auto'
                        disabled={isUploading}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const input = document.getElementById(
                            'profile-image-input'
                          ) as HTMLInputElement;
                          if (input) {
                            input.click();
                          }
                        }}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                            Carregando...
                          </>
                        ) : (
                          'Carregar imagem'
                        )}
                      </Button>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {isCompany ? (
            // Campos para Empresa
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <label className='flex flex-col md:col-span-2'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Nome da Empresa
                </p>
                <Input
                  value={formData.companyName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, companyName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Nome da Empresa'
                  required
                />
              </label>
              <label className='flex flex-col'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Nome do Responsável
                </p>
                <Input
                  value={formData.firstName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, firstName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Nome'
                />
              </label>
              <label className='flex flex-col'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Sobrenome do Responsável
                </p>
                <Input
                  value={formData.lastName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, lastName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Sobrenome'
                />
              </label>
            </div>
          ) : (
            // Campos para Técnico
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <label className='flex flex-col md:col-span-2'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Nome da Empresa
                </p>
                <Input
                  value={formData.companyName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, companyName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Nome da Empresa (usado em cobranças e agendamentos)'
                />
                <p className='text-sm text-[#60708a] dark:text-gray-400 mt-1'>
                  Este nome será usado nas cobranças e no link de agendamento
                  público
                </p>
              </label>
              <label className='flex flex-col'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Nome
                </p>
                <Input
                  value={formData.firstName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, firstName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Nome'
                />
              </label>
              <label className='flex flex-col'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Sobrenome
                </p>
                <Input
                  value={formData.lastName}
                  onChange={(e) => {
                    setHasUserEdited(true);
                    setFormData({ ...formData, lastName: e.target.value });
                  }}
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                  placeholder='Sobrenome'
                />
              </label>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <label className='flex flex-col'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                Email
              </p>
              <Input
                type='email'
                value={formData.email}
                onChange={(e) => {
                  setHasUserEdited(true);
                  setFormData({ ...formData, email: e.target.value });
                }}
                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-white/20 bg-white dark:bg-gray-900 focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal transition-all'
                placeholder='seu@email.com'
                required
              />
            </label>
            {!isCompany && (
              <div className='flex flex-col'>
                <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                  Função
                </p>
                <div className='flex items-center h-14'>
                  <Badge className='inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20'>
                    {user?.role === 'technician'
                      ? 'Técnico'
                      : user?.role || 'Técnico'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {isCompany && (
            <div className='flex flex-col'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                Link de Agendamento Público
              </p>
              <div className='flex items-center gap-2'>
                <span className='text-[#60708a] dark:text-gray-400 text-base font-normal whitespace-nowrap'>
                  www.clicksync.com.br/
                </span>
                <Input
                  value={formData.publicSlug || user?.publicSlug || ''}
                  readOnly
                  disabled
                  className='flex-1 min-w-0 rounded-lg text-gray-500 dark:text-gray-400 focus:outline-0 focus:ring-0 border border-[#dbdfe6] dark:border-white/20 bg-gray-100 dark:bg-gray-800 h-14 placeholder:text-[#60708a] p-[15px] text-base font-normal leading-normal cursor-not-allowed'
                  placeholder='-'
                />
              </div>
              <p className='text-sm text-[#60708a] dark:text-gray-400 mt-2'>
                O link público é gerado automaticamente a partir do nome da
                empresa. Você pode editá-lo se necessário.
              </p>
            </div>
          )}

          <div className='flex justify-end pt-4 border-t border-gray-200 dark:border-white/10'>
            <Button
              type='submit'
              disabled={updateMutation.isPending}
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
            {(currentUser?.requirePassword || requirePassword) && (
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
