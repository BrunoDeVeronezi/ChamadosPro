import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Mail } from 'lucide-react';
import { ChamadosProLogo } from '@/components/chamados-pro-logo';

export default function RecuperarSenha() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Implementar chamada à API de recuperação de senha
      // Por enquanto, simulando uma resposta de sucesso
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir sua senha.',
        });
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao enviar email de recuperação');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Ocorreu um erro. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='relative flex min-h-screen w-full flex-col bg-[#0f172a] dark:bg-[#0f172a] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <div className='flex flex-1'>
          <div className='w-full min-h-screen flex items-center justify-center p-4 sm:p-8'>
            <div className='flex flex-col max-w-[480px] flex-1'>
              {/* Botão Voltar */}
              <button
                onClick={() => setLocation('/login')}
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
                Recuperar Senha
              </h1>
              <p className='text-gray-400 text-base text-center mb-8'>
                Insira o e-mail associado à sua conta e enviaremos um link para
                redefinir sua senha.
              </p>

              {/* Mensagem de sucesso */}
              {isSuccess ? (
                <div className='mb-6'>
                  <Alert className='bg-green-500/10 border-green-500/20 text-green-400'>
                    <AlertTitle>Email enviado com sucesso!</AlertTitle>
                    <AlertDescription className='text-green-300'>
                      Verifique sua caixa de entrada. Se não encontrar o email,
                      verifique também a pasta de spam.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className='flex flex-col gap-5 w-full mb-6'
                >
                  {/* Campo de Email */}
                  <div>
                    <Label
                      className='block text-sm font-medium text-white mb-2'
                      htmlFor='email'
                    >
                      E-mail
                    </Label>
                    <div className='relative'>
                      <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <Input
                        className='block w-full h-12 pl-12 pr-4 rounded-lg border-gray-600 bg-gray-800 text-white placeholder:text-gray-500 focus:ring-[#3880f5] focus:border-[#3880f5]'
                        id='email'
                        placeholder='seuemail@exemplo.com'
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Botão Enviar Link */}
                  <Button
                    type='submit'
                    disabled={isSubmitting}
                    className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-[#3880f5] text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#2d6bd8] transition-colors disabled:opacity-50'
                  >
                    <span className='truncate'>
                      {isSubmitting ? 'Enviando...' : 'Enviar Link'}
                    </span>
                  </Button>
                </form>
              )}

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





