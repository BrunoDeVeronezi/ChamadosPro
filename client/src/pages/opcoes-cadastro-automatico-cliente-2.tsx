import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { X, Badge, FileText, Image, FileCode, Loader2 } from 'lucide-react';
import { maskCPF, maskCNPJ } from '@/lib/masks';
import { fetchCnpjData } from '@/services/CnpjService';

interface OpcoesCadastroAutomaticoCliente2Props {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated?: (clientId: string) => void;
}

export default function OpcoesCadastroAutomaticoCliente2({
  isOpen,
  onClose,
  onClientCreated,
}: OpcoesCadastroAutomaticoCliente2Props) {
  const { toast } = useToast();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createFromCpfCnpjMutation = useMutation({
    mutationFn: async (document: string) => {
      setIsLoading(true);
      try {
        const unmasked = document.replace(/[^\d]/g, '');
        const data = await fetchCnpjData(unmasked);
        const response = await apiRequest('POST', '/api/clients/auto', {
          source: 'cpf-cnpj',
          document: unmasked,
          data,
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erro ao cadastrar cliente');
        }
        return response.json();
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: 'Cliente cadastrado',
        description: 'O cliente foi cadastrado automaticamente com sucesso.',
      });
      if (onClientCreated) onClientCreated(data.id);
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar cliente',
        description: error.message,
      });
    },
  });

  const handleCpfCnpjSubmit = () => {
    if (!cpfCnpj) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, insira um CPF ou CNPJ.',
      });
      return;
    }
    createFromCpfCnpjMutation.mutate(cpfCnpj);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='w-full max-w-5xl bg-background-dark border border-white/10 shadow-2xl shadow-black/50 rounded-xl'>
        <DialogHeader>
          <div className='flex flex-wrap items-center justify-between gap-4 p-6 border-b border-white/10'>
            <div className='flex flex-col gap-1'>
              <DialogTitle className='text-xl font-bold text-white'>
                Opções de Cadastro Automático de Cliente
              </DialogTitle>
              <DialogDescription className='text-sm font-normal text-gray-400'>
                Selecione uma das opções abaixo para cadastrar um novo cliente
                de forma rápida e automática.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 p-6'>
          {/* Card 1: Por CPF/CNPJ */}
          <Card className='flex flex-col rounded-lg border border-white/10 bg-[#1a222c] p-6 gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Badge className='w-6 h-6' />
              </div>
              <div className='flex flex-col'>
                <p className='text-lg font-bold leading-tight tracking-[-0.015em] text-white'>
                  Por CPF/CNPJ
                </p>
                <p className='text-sm font-normal text-gray-400'>
                  Busca e preenche dados automaticamente.
                </p>
              </div>
            </div>
            <p className='text-sm font-normal leading-normal text-gray-300'>
              Insira um CPF ou CNPJ para buscar e preencher automaticamente os
              dados do cliente a partir de bases de dados públicas.
            </p>
            <div className='mt-auto flex items-end gap-3 justify-between'>
              <Input
                className='w-full rounded-md border-white/20 shadow-sm focus:border-primary focus:ring-primary bg-background-dark text-white placeholder-gray-500'
                placeholder='Digite o CPF ou CNPJ'
                value={cpfCnpj}
                onChange={(e) => {
                  const value = e.target.value;
                  setCpfCnpj(
                    value.length <= 14 ? maskCPF(value) : maskCNPJ(value)
                  );
                }}
                disabled={isLoading}
              />
              <Button
                className='flex shrink-0 min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-10 px-4 bg-primary text-white text-sm font-medium leading-normal hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark'
                onClick={handleCpfCnpjSubmit}
                disabled={isLoading || !cpfCnpj}
              >
                {isLoading ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <span className='truncate'>Consultar</span>
                )}
              </Button>
            </div>
          </Card>

          {/* Card 2: Por Texto Colado */}
          <Card className='flex flex-col rounded-lg border border-white/10 bg-[#1a222c] p-6 gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <FileText className='w-6 h-6' />
              </div>
              <div className='flex flex-col'>
                <p className='text-lg font-bold leading-tight tracking-[-0.015em] text-white'>
                  Por Texto Colado
                </p>
                <p className='text-sm font-normal text-gray-400'>
                  Extração inteligente de informações.
                </p>
              </div>
            </div>
            <p className='text-sm font-normal leading-normal text-gray-300'>
              Cole um texto não estruturado (de um e-mail ou mensagem) e o
              sistema extrairá as informações do cliente.
            </p>
            <div className='mt-auto flex items-end gap-3 justify-between'>
              <Button
                className='flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-10 px-4 bg-white/10 text-white text-sm font-medium leading-normal hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-background-dark'
                onClick={() => {
                  toast({
                    title: 'Funcionalidade em desenvolvimento',
                    description:
                      'A análise de texto será implementada em breve.',
                  });
                }}
              >
                <span className='truncate'>Analisar Texto</span>
              </Button>
            </div>
          </Card>

          {/* Card 3: Por Imagem (OCR) */}
          <Card className='flex flex-col rounded-lg border border-white/10 bg-[#1a222c] p-6 gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Image className='w-6 h-6' />
              </div>
              <div className='flex flex-col'>
                <p className='text-lg font-bold leading-tight tracking-[-0.015em] text-white'>
                  Por Imagem (OCR)
                </p>
                <p className='text-sm font-normal text-gray-400'>
                  Leitura de cartões e documentos.
                </p>
              </div>
            </div>
            <p className='text-sm font-normal leading-normal text-gray-300'>
              Envie a foto de um cartão de visita ou documento, e o sistema fará
              a leitura para importar os dados do cliente.
            </p>
            <div className='mt-auto flex items-end gap-3 justify-between'>
              <Button
                className='flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-10 px-4 bg-white/10 text-white text-sm font-medium leading-normal hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-background-dark'
                onClick={() => {
                  toast({
                    title: 'Funcionalidade em desenvolvimento',
                    description: 'O OCR será implementado em breve.',
                  });
                }}
              >
                <span className='truncate'>Enviar Imagem</span>
              </Button>
            </div>
          </Card>

          {/* Card 4: Por XML (NFe) */}
          <Card className='flex flex-col rounded-lg border border-white/10 bg-[#1a222c] p-6 gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <FileCode className='w-6 h-6' />
              </div>
              <div className='flex flex-col'>
                <p className='text-lg font-bold leading-tight tracking-[-0.015em] text-white'>
                  Por XML (NFe)
                </p>
                <p className='text-sm font-normal text-gray-400'>
                  Ideal para cadastro em massa.
                </p>
              </div>
            </div>
            <p className='text-sm font-normal leading-normal text-gray-300'>
              Faça o upload de um ou mais arquivos XML de Nota Fiscal Eletrônica
              (NFe) para cadastrar clientes.
            </p>
            <div className='mt-auto flex items-end gap-3 justify-between'>
              <Button
                className='flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-10 px-4 bg-white/10 text-white text-sm font-medium leading-normal hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-background-dark'
                onClick={() => {
                  toast({
                    title: 'Funcionalidade em desenvolvimento',
                    description: 'O upload de XML será implementado em breve.',
                  });
                }}
              >
                <span className='truncate'>Carregar XML</span>
              </Button>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}























