import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { ChamadosProLogo } from '@/components/chamados-pro-logo';

export default function RedefinirSenha() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  useEffect(() => {
    // Extrair token da URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (!tokenFromUrl) {
      setTokenError('Token não fornecido na URL');
      setIsValidating(false);
      return;
    }

    setToken(tokenFromUrl);

    // Validar token
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${tokenFromUrl}`, {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();

        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenError(data.message || 'Token inválido ou expirado');
        }
      } catch (error: any) {
        setTokenError('Erro ao validar token. Tente novamente.');
        console.error('[REDEFINIR-SENHA] Erro ao validar token:', error);
      } finally {
        setIsValidating(false);
      }
    };

    // validateToken();
  }, []);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    
    // Validação em tempo real
    if (value.length > 0 && value.length < 6) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres');
    } else {
      setPasswordError(null);
    }
    
    // Validar confirmação novamente se houver valor
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError('As senhas não coincidem');
    } else if (confirmPassword) {
      setConfirmPasswordError(null);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    // Validação em tempo real
    if (value.length > 0 && value !== newPassword) {
      setConfirmPasswordError('As senhas não coincidem');
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPasswordError(null);
    setConfirmPasswordError(null);

    // Validações
    if (newPassword.length < 6) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres');
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('As senhas não coincidem');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Senha redefinida!',
          description: 'Sua senha foi redefinida com sucesso. Você já pode fazer login.',
        });

        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          setLocation('/login');
        }, 2000);
      } else {
        throw new Error(data.message || 'Erro ao redefinir senha');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao redefinir a senha. Tente novamente.',
      });
      
      // Se o erro for relacionado ao token, atualizar estado
      if (error.message?.toLowerCase().includes('token')) {
        setTokenError(error.message);
        setTokenValid(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mostrar loading enquanto valida token
  if (isValidating) {
    return (
      <div className='relative flex min-h-screen w-full flex-col bg-[#0f172a] dark:bg-[#0f172a] font-display overflow-x-hidden'>
        <div className='layout-container flex h-full grow flex-col'>
          <div className='flex flex-1'>
            <div className='w-full min-h-screen flex items-center justify-center p-4 sm:p-8'>
              <div className='flex flex-col max-w-[480px] flex-1 items-center'>
                <ChamadosProLogo size={80} showText={true} />
                <p className='text-gray-400 text-base text-center mt-4'>
                  // Validando token...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar erro se token inválido
  if (!tokenValid || tokenError) {
    return (
      <div className='relative flex min-h-screen w-full flex-col bg-[#0f172a] dark:bg-[#0f172a] font-display overflow-x-hidden'>
        <div className='layout-container flex h-full grow flex-col'>
          <div className='flex flex-1'>
            <div className='w-full min-h-screen flex items-center justify-center p-4 sm:p-8'>
              <div className='flex flex-col max-w-[480px] flex-1'>
                <button
                  onClick={() => setLocation('/recuperar-senha')}
                  className='flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 self-start'
                >
                  <ArrowLeft className='w-5 h-5' />
                  <span className='text-sm'>Voltar</span>
                </button>

                <div className='flex justify-center mb-8'>
                  <ChamadosProLogo size={80} showText={true} />
                </div>

                <div className='mb-6'>
                  <Alert variant='destructive'>
                    <AlertTitle>Token inválido ou expirado</AlertTitle>
                    <AlertDescription>
                      {tokenError || 'O link de recuperação é inválido ou expirou. Solicite um novo link.'}
                    </AlertDescription>
                  </Alert>
                </div>

                <Button
                  onClick={() => setLocation('/recuperar-senha')}
                  className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-[#3880f5] text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#2d6bd8] transition-colors'
                >
                  Solicitar novo link
                </Button>

                <div className='mt-8 text-center'>
                  <p className='text-gray-400 text-sm'>
                    Lembrou a senha?{' '}
                    <button
                      onClick={() => setLocation('/login')}
                      className='text-[#3880f5] hover:underline font-medium'
                    >
                      Fazer Login
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative flex min-h-screen w-full flex-col bg-[#0f172a] dark:bg-[#0f172a] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <div className='flex flex-1'>
          <div className='w-full min-h-screen flex items-center justify-center p-4 sm:p-8'>
            <div className='flex flex-col max-w-[480px] flex-1'>
              {/* Botão Voltar */}
              <button
                onClick={() => setLocation('/recuperar-senha')}
                className='flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 self-start'
              >
                <ArrowLeft className='w-5 h-5' />
                <span className='text-sm'>Voltar</span>
              </button>

              {/* Logo Chamados Pro */}
              <div className='flex justify-center mb-8'>
                <ChamadosProLogo size={80} showText={true} />
              </div>

              {/* Título e Subtítulo */}
              <h1 className='text-white text-3xl font-bold text-center mb-2'>
                Redefinir Senha
              </h1>
              <p className='text-gray-400 text-base text-center mb-8'>
                Digite sua nova senha abaixo. Certifique-se de usar uma senha forte.
              </p>

              <form onSubmit={handleSubmit} className='flex flex-col gap-5 w-full mb-6'>
                {/* Campo Nova Senha */}
                <div>
                  <Label
                    className='block text-sm font-medium text-white mb-2'
                    htmlFor='newPassword'
                  >
                    Nova Senha <span className='text-red-500'>*</span>
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                    <Input
                      className={`block w-full h-12 pl-12 pr-12 rounded-lg border bg-gray-800/50 text-white placeholder:text-gray-500 focus:ring-[#3880f5] focus:border-[#3880f5] ${
                        passwordError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-600'
                      }`}
                      id='newPassword'
                      placeholder='Digite sua nova senha (mínimo 6 caracteres)'
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
                    >
                      {showPassword ? (
                        <EyeOff className='w-5 h-5' />
                      ) : (
                        <Eye className='w-5 h-5' />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className='text-red-500 text-sm mt-1'>{passwordError}</p>
                  )}
                  {!passwordError && newPassword.length > 0 && newPassword.length < 6 && (
                    <p className='text-gray-400 text-sm mt-1'>
                      A senha deve ter pelo menos 6 caracteres
                    </p>
                  )}
                </div>

                {/* Campo Confirmar Nova Senha */}
                <div>
                  <Label
                    className='block text-sm font-medium text-white mb-2'
                    htmlFor='confirmPassword'
                  >
                    Confirmar Nova Senha <span className='text-red-500'>*</span>
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                    <Input
                      className={`block w-full h-12 pl-12 pr-12 rounded-lg border bg-gray-800/50 text-white placeholder:text-gray-500 focus:ring-[#3880f5] focus:border-[#3880f5] ${
                        confirmPasswordError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-600'
                      }`}
                      id='confirmPassword'
                      placeholder='Digite novamente sua nova senha'
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
                    >
                      {showConfirmPassword ? (
                        <EyeOff className='w-5 h-5' />
                      ) : (
                        <Eye className='w-5 h-5' />
                      )}
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <p className='text-red-500 text-sm mt-1'>{confirmPasswordError}</p>
                  )}
                </div>

                {/* Botão Redefinir Senha */}
                <Button
                  type='submit'
                  disabled={isSubmitting}
                  className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-[#3880f5] text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#2d6bd8] transition-colors disabled:opacity-50'
                >
                  <span className='truncate'>
                    {isSubmitting ? 'Redefinindo...' : 'Redefinir Senha'}
                  </span>
                </Button>
              </form>

              {/* Link para voltar ao login */}
              <div className='mt-8 text-center'>
                <p className='text-gray-400 text-sm'>
                  Lembrou a senha?{' '}
                  <button
                    onClick={() => setLocation('/login')}
                    className='text-[#3880f5] hover:underline font-medium'
                  >
                    Fazer Login
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}