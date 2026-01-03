import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { X, Edit, Phone, Send } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
    document: string;
    type: 'PF' | 'PJ';
    createdAt: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    noShowCount?: number;
  };
}

export default function ModalDetalhesCliente2({
  isOpen,
  onClose,
  client,
}: ClientDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<
    'info' | 'tickets' | 'invoices' | 'notes'
  >('info');

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='w-full max-w-4xl bg-white dark:bg-background-dark'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle className='text-xl font-bold text-gray-900 dark:text-gray-100'>
              Detalhes do Cliente
            </DialogTitle>
            <DialogDescription className='sr-only'>
              Informacoes do cliente e historico recente.
            </DialogDescription>
            <div className='flex items-center gap-2'>
              <Button
                className='flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-medium'
                onClick={() => {
                  // TODO: Implementar edição
                }}
              >
                <Edit className='w-4 h-4' />
                <span className='truncate'>Editar Cliente</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto'>
          <div className='p-4 sm:p-6'>
            {/* Profile Header */}
            <div className='flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center gap-4'>
                <Avatar className='h-20 w-20 sm:h-24 sm:w-24 shrink-0'>
                  <AvatarImage src='' alt="Client's avatar" />
                  <AvatarFallback className='bg-primary/20 text-primary text-2xl font-bold'>
                    {client.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col justify-center gap-1'>
                  <p className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
                    {client.name}
                  </p>
                  <p className='text-base text-gray-500 dark:text-gray-400'>
                    {client.email}
                  </p>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Cliente desde: {formatDate(client.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Chips/Tags */}
            <div className='mt-4 flex flex-wrap gap-2'>
              <Badge className='flex h-7 shrink-0 items-center justify-center gap-x-2 rounded-full bg-green-100 px-3 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
                <p className='text-xs font-semibold'>
                  {client.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </p>
              </Badge>
              {client.noShowCount && client.noShowCount > 0 && (
                <Badge className='flex h-7 shrink-0 items-center justify-center gap-x-2 rounded-full bg-red-100 px-3 text-red-800 dark:bg-red-900/50 dark:text-red-300'>
                  <p className='text-xs font-semibold'>
                    No-shows: {client.noShowCount}
                  </p>
                </Badge>
              )}
            </div>

            {/* Tabs */}
            <div className='mt-6 border-b border-gray-200 dark:border-gray-800'>
              <div className='flex gap-6'>
                <button
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setActiveTab('info')}
                >
                  <p className='text-sm font-bold'>Informações</p>
                </button>
                <button
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    activeTab === 'tickets'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setActiveTab('tickets')}
                >
                  <p className='text-sm font-bold'>Chamados Recentes</p>
                </button>
                <button
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    activeTab === 'invoices'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setActiveTab('invoices')}
                >
                  <p className='text-sm font-bold'>Faturas</p>
                </button>
                <button
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    activeTab === 'notes'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setActiveTab('notes')}
                >
                  <p className='text-sm font-bold'>Observações</p>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' && (
              <div className='py-6 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3'>
                <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {client.type === 'PF' ? 'CPF' : 'CNPJ'}
                  </p>
                  <p className='text-base text-gray-800 dark:text-gray-200'>
                    {client.document}
                  </p>
                </div>
                <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Telefone
                  </p>
                  <div className='flex items-center justify-between'>
                    <p className='text-base text-gray-800 dark:text-gray-200'>
                      {client.phone}
                    </p>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    >
                      <Phone className='w-4 h-4' />
                    </Button>
                  </div>
                </div>
                <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Data de Cadastro
                  </p>
                  <p className='text-base text-gray-800 dark:text-gray-200'>
                    {formatDate(client.createdAt)}
                  </p>
                </div>
                {client.address && (
                  <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800 sm:col-span-2 lg:col-span-3'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      Endereço
                    </p>
                    <p className='text-base text-gray-800 dark:text-gray-200'>
                      {client.address}
                    </p>
                  </div>
                )}
                {client.city && (
                  <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      Cidade
                    </p>
                    <p className='text-base text-gray-800 dark:text-gray-200'>
                      {client.city}
                    </p>
                  </div>
                )}
                {client.state && (
                  <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      Estado
                    </p>
                    <p className='text-base text-gray-800 dark:text-gray-200'>
                      {client.state}
                    </p>
                  </div>
                )}
                {client.zipCode && (
                  <div className='flex flex-col gap-1 border-t border-gray-200 py-4 dark:border-gray-800'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      CEP
                    </p>
                    <p className='text-base text-gray-800 dark:text-gray-200'>
                      {client.zipCode}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tickets' && (
              <div className='py-6'>
                <p className='text-gray-500 dark:text-gray-400'>
                  Chamados recentes serão exibidos aqui
                </p>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className='py-6'>
                <p className='text-gray-500 dark:text-gray-400'>
                  Faturas serão exibidas aqui
                </p>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className='py-6'>
                <p className='text-gray-500 dark:text-gray-400'>
                  // Observações serão exibidas aqui
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className='flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2 border-t border-gray-200 dark:border-gray-800 p-4 sm:p-6'>
          <Button
            variant='outline'
            className='flex h-10 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto'
            onClick={onClose}
          >
            <span className='truncate'>Fechar</span>
          </Button>
          <Button
            className='flex h-10 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 sm:w-auto'
            onClick={() => {
              // TODO: Implementar envio WhatsApp
            }}
          >
            <Send className='w-4 h-4' />
            <span className='truncate'>Enviar WhatsApp</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






















