import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { usePlanAccess } from '@/hooks/use-plan-access';

interface UpgradeRequiredProps {
  feature: string;
  description?: string;
}

export function UpgradeRequired({ feature, description }: UpgradeRequiredProps) {
  const [, navigate] = useLocation();
  const { planStatus, trialDaysLeft, isTrial } = usePlanAccess(feature, true);

  const handleUpgrade = () => {
    navigate('/planos');
  };

  return (
    <div className='flex items-center justify-center min-h-[60vh] p-6'>
      <Card className='w-full max-w-2xl'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <div className='rounded-full bg-blue-100 dark:bg-blue-900/30 p-4'>
              <Lock className='h-8 w-8 text-blue-600 dark:text-blue-400' />
            </div>
          </div>
          <CardTitle className='text-2xl font-bold'>{feature}</CardTitle>
          <CardDescription className='text-base mt-2'>
            {description ||
              'Esta funcionalidade esta disponivel no plano pago.'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {isTrial && trialDaysLeft !== null && trialDaysLeft !== undefined && (
            <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
              <div className='flex items-center gap-2 text-blue-900 dark:text-blue-100'>
                <Sparkles className='h-5 w-5' />
                <p className='font-medium'>
                  {trialDaysLeft > 0
                    ? `Voce ainda tem ${trialDaysLeft} ${
                        trialDaysLeft === 1 ? 'dia' : 'dias'
                      } de trial restantes!`
                    : 'Seu trial esta prestes a expirar!'}
                </p>
              </div>
            </div>
          )}

          <div className='space-y-3'>
            <h3 className='font-semibold text-lg'>
              Plano Tecnico (R$ 35/mes) libera:
            </h3>
            <ul className='space-y-2 text-sm text-gray-700 dark:text-gray-300'>
              <li className='flex items-start gap-2'>
                <span className='text-green-500 mt-1'>?</span>
                <span>Exportacao e importacao de dados</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-green-500 mt-1'>?</span>
                <span>PDFs (RAT, recibos e relatorios)</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-green-500 mt-1'>?</span>
                <span>Envio por WhatsApp</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-green-500 mt-1'>?</span>
                <span>Relatorios avancados e analytics</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-green-500 mt-1'>?</span>
                <span>Integracao Google Calendar</span>
              </li>
            </ul>
          </div>

          <div className='flex flex-col sm:flex-row gap-3 pt-4'>
            <Button
              onClick={handleUpgrade}
              className='flex-1 bg-blue-600 hover:bg-blue-700 text-white'
              size='lg'
            >
              Ver Planos e Assinar
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant='outline'
              className='flex-1'
              size='lg'
            >
              Voltar ao Painel
            </Button>
          </div>

          <p className='text-xs text-center text-gray-500 dark:text-gray-400'>
            {planStatus === 'expired'
              ? 'Seu acesso esta bloqueado ate a assinatura.'
              : 'Voce pode assinar a qualquer momento.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
