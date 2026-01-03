import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicBooking } from '@/components/public-booking';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiService {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration: number;
  active: boolean;
}

export default function AgendamentoPublico() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: services, isLoading } = useQuery<ApiService[]>({
    queryKey: ['/api/services'],
    enabled: !!user,
  });

  const formattedServices = useMemo(
    () =>
      (services ?? [])
        .filter((service) => service.active)
        .map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description || '',
          price: Number.parseFloat(service.price),
          duration: service.duration,
        })),
    [services]
  );

  const publicUrl = useMemo(() => {
    // Usar tenantSlug se disponível, caso contrário usar publicSlug, ou 'chamadospro' como padrão
    const slug = user.tenantSlug || user.publicSlug || 'chamadospro';
    return `https://www.clicksync.com.br/${slug}`;
  }, [user.tenantSlug, user.publicSlug]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'O link público foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao copiar',
        description: 'No foi possvel copiar o link.',
      });
    }
  };

  const handleOpenInNewTab = () => {
    window.open(publicUrl, '_blank');
  };

  return (
    <div className='space-y-6'>
      {/* Public Link Card */}
      {publicUrl && (
        <Card>
          <CardContent className='pt-6'>
            <div className='space-y-3'>
              <div>
                <h3 className='font-semibold text-lg mb-1'>
                  Seu Link de Agendamento Público
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Compartilhe este link com seus clientes para que eles possam
                  agendar serviços
                </p>
              </div>
              <div className='flex gap-2'>
                <Input
                  value={publicUrl}
                  readOnly
                  className='font-mono text-sm'
                  data-testid='input-public-url'
                />
                <Button
                  variant='outline'
                  size='icon'
                  onClick={handleCopy}
                  data-testid='button-copy-url'
                  title='Copiar link'
                >
                  {copied ? (
                    <Check className='w-4 h-4 text-green-600' />
                  ) : (
                    <Copy className='w-4 h-4' />
                  )}
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={handleOpenInNewTab}
                  data-testid='button-open-url'
                  title='Abrir em nova aba'
                >
                  <ExternalLink className='w-4 h-4' />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Booking Preview */}
      <PublicBooking
        services={formattedServices}
        userId={user.id}
        isLoadingServices={isLoading}
      />
    </div>
  );
}
