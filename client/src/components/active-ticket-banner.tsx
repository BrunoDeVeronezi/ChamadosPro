import { useEffect, useState, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';

import { Card } from '@/components/ui/card';

import { AlertTriangle, Clock, CheckCircle2, X, PlayCircle } from 'lucide-react';

import { format } from 'date-fns';

import { ptBR } from 'date-fns/locale';

import { apiRequest } from '@/lib/queryClient';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { TicketCompleteDialog } from './ticket-complete-dialog';

import { ReceiptPreviewDialog } from './receipt-preview-dialog';

import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';

import { buildServiceSummary } from '@/utils/service-items';

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

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogTitle,

} from '@/components/ui/dialog';

import { Textarea } from '@/components/ui/textarea';



interface Ticket {

  id: string;

  clientId: string;

  serviceId: string;

  scheduledDate: string;

  scheduledTime: string;

  status: string;

  startedAt: string;

  stoppedAt: string;

  client: {

    name: string;

    type: string;

    defaultHoursIncluded: number;

    defaultAdditionalHourRate: string;

  };

  service: {

    name: string;

    price: string;

  };

  ticketNumber: string;

  finalClient: string;

  ticketValue: string;

  duration: number;

  userId: string;

  calculationsEnabled?: boolean;

}



// Chave para localStorage
const ACTIVE_TICKETS_STORAGE_KEY = 'active_tickets_startedAt';
const ACTIVE_TICKET_BUBBLE_STORAGE_KEY = 'active_ticket_bubble_position';
const BUBBLE_SIZE = 64;
const BUBBLE_MARGIN = 16;
const BUBBLE_MOVE_THRESHOLD = 4;


// Funes auxiliares para persistncia

function saveActiveTicketsToStorage(startedAtMap: Record<string, string>) {

  try {

    localStorage.setItem(

      ACTIVE_TICKETS_STORAGE_KEY,

      JSON.stringify(startedAtMap)

    );

  } catch (err) {

    console.warn('Erro ao salvar tickets ativos no localStorage:', err);

  }

}



function loadActiveTicketsFromStorage(): Record<string, string> {

  try {

    const stored = localStorage.getItem(ACTIVE_TICKETS_STORAGE_KEY);

    if (stored) {

      return JSON.parse(stored);

    }

  } catch (err) {

    console.warn('Erro ao carregar tickets ativos do localStorage:', err);

  }

  return {};

}



function clearTicketFromStorage(ticketId: string) {

  try {

    const stored = loadActiveTicketsFromStorage();

    delete stored[ticketId];

    saveActiveTicketsToStorage(stored);

  } catch (err) {

    console.warn('Erro ao limpar ticket do localStorage:', err);

  }

}



export function ActiveTicketBanner() {

  const { toast } = useToast();

  const { user } = useAuth();

  const queryClient = useQueryClient();

  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const [dialogTicketId, setDialogTicketId] = useState<string | null>(null);

  const [receiptData, setReceiptPreviewData] = useState<any>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [isCompleting, setIsCompleting] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(

    null

  );

  const [isCancelling, setIsCancelling] = useState(false);

  const [cancellationSource, setCancellationSource] = useState<

    'CLIENTE' | 'TECNICO'

  >('CLIENTE');

  const [cancellationDescription, setCancellationDescription] = useState('');

  const [showCancelCloseConfirm, setShowCancelCloseConfirm] = useState(false);

  const [activeTickets, setActiveTickets] = useState<

    Array<{ id: string; startedAt: string }>

  >([]);

  const [isActiveTicketDialogOpen, setIsActiveTicketDialogOpen] = useState(false);
  const [bubblePosition, setBubblePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isBubbleDragging, setIsBubbleDragging] = useState(false);
  const bubbleDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const skipBubbleClickRef = useRef(false);


  // Buscar tickets - no bloquear banner se houver erro

  const { data: tickets, error: ticketsError } = useQuery<Ticket[]>({

    queryKey: ['/api/tickets'],

    refetchInterval: 30000, // Refetch a cada 30 segundos

    refetchOnWindowFocus: true,

    staleTime: 0,

    retry: false, // No tentar novamente se houver erro

  });



  // Log erro mas no bloquear

  if (ticketsError) {

    console.warn(

      '[ActiveTicketBanner] Erro ao carregar tickets:',

      ticketsError

    );

  }



  // Verificar status de conexão do Google Calendar

  const { data: integrationSettings } = useQuery<{

    googleCalendarStatus: string;

    googleCalendarEmail?: string;

  }>({

    queryKey: ['/api/integration-settings'],

  });



  const isGoogleCalendarConnected =

    integrationSettings?.googleCalendarStatus === 'connected';



  // Função para determinar todos os tickets ativos

  const determineActiveTickets = () => {

    // SEMPRE verificar localStorage primeiro - fonte de verdade

    const storedStartedAt = loadActiveTicketsFromStorage();

    const storedTicketIds = Object.keys(storedStartedAt);



    // Lista de tickets ativos encontrados

    const activeTicketsList: Array<{ id: string; startedAt: string }> = [];
// Se não tem tickets no localStorage, verificar dados da query

    if (storedTicketIds.length === 0) {

      if (tickets && tickets.length > 0) {

        tickets.forEach((t) => {

          const status = (t.status || '').toString().toUpperCase();

          const hasStartedAt = !!(t as any).startedAt;

          const hasStoppedAt = !!(t as any).stoppedAt;



          if (

            (status === 'INICIADO' ||

              status === 'EXECUCAO' ||

              status === 'IN-PROGRESS') &&

            hasStartedAt &&

            !hasStoppedAt

          ) {

            const startedAt = (t as any).startedAt;

            // Salvar no localStorage IMEDIATAMENTE

            storedStartedAt[t.id] = startedAt;

            activeTicketsList.push({ id: t.id, startedAt });

          }

        });



        if (activeTicketsList.length > 0) {

          saveActiveTicketsToStorage(storedStartedAt);

          setActiveTickets(activeTicketsList);

          return;

        }

      }

      setActiveTickets([]);

      return;

    }



    // Tem tickets no localStorage - verificar todos

    const validActiveTickets: Array<{ id: string; startedAt: string }> = [];



    if (tickets !== undefined) {

      let storageUpdated = false;

      storedTicketIds.forEach((ticketId) => {

        const storedStartedAtValue = storedStartedAt[ticketId];

        const ticket = tickets.find((t) => t.id === ticketId);



        if (ticket) {

          const status = (ticket.status || '').toString().toUpperCase();

          const hasStoppedAt = !!(ticket as any).stoppedAt;

          const hasCompletedAt = !!(ticket as any).completedAt;



          // Se foi finalizado, limpar do localStorage IMEDIATAMENTE

          if (

            hasStoppedAt ||

            hasCompletedAt ||

            status === 'CONCLUÍDO' ||

            status === 'CONCLUIDO' ||

            status === 'COMPLETED' ||

            status === 'CANCELADO' ||

            status === 'CANCELLED'

          ) {

            delete storedStartedAt[ticketId];

            storageUpdated = true;

            return; // Não adicionar à lista

          }



          // Ticket ainda ativo - usar startedAt do backend se disponível, senão do localStorage

          const backendStartedAt = (ticket as any).startedAt;

          let finalStartedAt = backendStartedAt || storedStartedAtValue || new Date().toISOString();



          // Atualizar localStorage se o backend forneceu uma data diferente

          if (backendStartedAt && backendStartedAt !== storedStartedAtValue) {

            storedStartedAt[ticketId] = backendStartedAt;

            storageUpdated = true;

          }



          validActiveTickets.push({ id: ticketId, startedAt: finalStartedAt });

        } else {

          // Ticket não encontrado nos dados do backend (carregados)

          // Se os tickets foram carregados e este ID não está lá, ele foi deletado

          // ou não pertence mais ao usuário. Limpar do localStorage.

          delete storedStartedAt[ticketId];

          storageUpdated = true;

          console.log(`[ActiveTicketBanner] Limpando ticket inexistente: ${ticketId}`);

        }

      });



      if (storageUpdated) {

        saveActiveTicketsToStorage(storedStartedAt);

      }

    } else {

      // Dados ainda não carregaram ou erro ao carregar - usar do localStorage (temporariamente)

      storedTicketIds.forEach((ticketId) => {

        validActiveTickets.push({

          id: ticketId,

          startedAt: storedStartedAt[ticketId],

        });

      });

    }

    setActiveTickets(validActiveTickets);

  };



  // Determinar tickets ativos ao montar e quando tickets mudam

  // Usar useMemo para evitar chamadas desnecessárias

  const ticketsRef = useRef<Ticket[] | undefined>(tickets);

  useEffect(() => {

    ticketsRef.current = tickets;

  }, [tickets]);



  useEffect(() => {

    // Só chamar determineActiveTickets se tickets realmente mudaram

    const currentTickets = ticketsRef.current;

    if (currentTickets !== undefined) {

      determineActiveTickets();

    }

  }, [tickets]);



  // Verificar localStorage ao montar (ANTES de tickets carregarem) - PRIORIDADE MÁXIMA

  useEffect(() => {

    const checkAndSetFromStorage = () => {

      const storedStartedAt = loadActiveTicketsFromStorage();

      const storedTicketIds = Object.keys(storedStartedAt);



      if (storedTicketIds.length > 0) {

        // Se tem algo no localStorage, mostrar banner IMEDIATAMENTE (SEM ESPERAR API)

        const ticketsList = storedTicketIds.map((ticketId) => ({

          id: ticketId,

          startedAt: storedStartedAt[ticketId],

        }));

        setActiveTickets(ticketsList);

        return true;

      }

      return false;

    };



    // Tentar carregar do localStorage imediatamente

    checkAndSetFromStorage();



    // Verificar novamente após um pequeno delay (para garantir que não foi sobrescrito)

    const timeout = setTimeout(() => {

      if (activeTickets.length === 0) {

        checkAndSetFromStorage();

      }

    }, 100);



    return () => clearTimeout(timeout);

  }, []); // Executar apenas uma vez ao montar



  // Listener para mudanças no localStorage (de outras abas/contextos)

  useEffect(() => {

    const handleStorageChange = (e: StorageEvent) => {

      if (e.key === ACTIVE_TICKETS_STORAGE_KEY) {

        determineActiveTickets();

      }

    };



    window.addEventListener('storage', handleStorageChange);



    // Verificar periodicamente (para mudanças na mesma aba) - reduzir frequência para evitar loops

    const interval = setInterval(() => {

      // Só verificar se tickets mudaram desde a última verificação

      const currentTickets = ticketsRef.current;

      if (currentTickets !== undefined) {

        determineActiveTickets();

      }

    }, 5000); // Aumentar para 5 segundos para reduzir chamadas



    return () => {

      window.removeEventListener('storage', handleStorageChange);

      clearInterval(interval);

    };

  }, [tickets]);



  const resolveStartedAt = (
    ticketId: string,
    fallback?: string,
    storedStartedAt?: Record<string, string>
  ) => {
    const fallbackValue =
      typeof fallback === 'string' ? fallback.trim() : '';
    if (fallbackValue) {
      return fallbackValue;
    }

    const ticketFromQuery = ticketsRef.current?.find((t) => t.id === ticketId);
    const queryStartedAt =
      (ticketFromQuery as any)?.startedAt ||
      (ticketFromQuery as any)?.started_at;
    if (queryStartedAt) {
      return queryStartedAt;
    }

    const stored = storedStartedAt ?? loadActiveTicketsFromStorage();
    const storedValue = stored[ticketId];
    if (storedValue) {
      return storedValue;
    }

    return undefined;
  };

  const computeElapsedSeconds = (
    ticketId: string,
    fallback?: string,
    storedStartedAt?: Record<string, string>
  ) => {
    const startedAt = resolveStartedAt(
      ticketId,
      fallback,
      storedStartedAt
    );
    if (!startedAt) {
      return 0;
    }

    const start = new Date(startedAt).getTime();
    if (Number.isNaN(start)) {
      return 0;
    }

    const now = Date.now();
    let elapsedSeconds = Math.floor((now - start) / 1000);

    // CORRECAO DINAMICA DE FUSO HORARIO:
    if (elapsedSeconds < 0) {
      const offsetHours = Math.round(Math.abs(elapsedSeconds) / 3600);
      const adjustedSeconds = elapsedSeconds + offsetHours * 3600;

      if (adjustedSeconds >= 0 && adjustedSeconds < 86400) {
        elapsedSeconds = adjustedSeconds;
      } else {
        const stored = storedStartedAt ?? loadActiveTicketsFromStorage();
        const storedValue = stored[ticketId];
        if (storedValue) {
          const storedDate = new Date(storedValue).getTime();
          const storedDiff = Math.floor((now - storedDate) / 1000);
          elapsedSeconds = storedDiff >= 0 ? storedDiff : 0;
        } else {
          elapsedSeconds = 0;
        }
      }
    }

    return Math.max(0, elapsedSeconds);
  };

  // Calcular tempo decorrido para todos os tickets ativos

  useEffect(() => {

    // Se não há tickets ativos, limpar o estado e não criar intervalo

    if (activeTickets.length === 0) {

      setElapsedTimes({});

      return;

    }



    // Função para calcular tempos decorridos

    const updateElapsedTimes = () => {

      if (activeTickets.length === 0) {

        setElapsedTimes({});

        return;

      }



      const storedStartedAt = loadActiveTicketsFromStorage();
      const newElapsedTimes: Record<string, number> = {};



      activeTickets.forEach((ticket: { id: string; startedAt: string }) => {

        try {

          const resolvedStartedAt = resolveStartedAt(
            ticket.id,
            ticket.startedAt,
            storedStartedAt
          );
          const start = resolvedStartedAt
            ? new Date(resolvedStartedAt).getTime()
            : NaN;

          if (isNaN(start)) {

            newElapsedTimes[ticket.id] = 0;

            return;

          }

          const now = Date.now();

          let elapsedSeconds = Math.floor((now - start) / 1000);



          //   // CORREÇÃO DINÂMICA DE FUSO HORÁRIO:

          // Se o tempo decorrido for negativo, provavelmente é uma diferença de fuso horário (UTC vs Local).

          // Vamos detectar o deslocamento em horas cheias e ajustar o cálculo.

          if (elapsedSeconds < 0) {

            const offsetHours = Math.round(Math.abs(elapsedSeconds) / 3600);

            const adjustedSeconds = elapsedSeconds + (offsetHours * 3600);

            

            // Se o ajuste de horas resultou em um tempo positivo e lógico (menos de 24h decorridas)

            if (adjustedSeconds >= 0 && adjustedSeconds < 86400) {

              elapsedSeconds = adjustedSeconds;

            } else {

              // Se ainda assim for negativo, usamos o tempo do localStorage como último recurso

              try {

                const storedValue = storedStartedAt[ticket.id];

                if (storedValue) {

                  const storedDate = new Date(storedValue).getTime();

                  const storedDiff = Math.floor((now - storedDate) / 1000);

                  if (storedDiff >= 0) {

                    elapsedSeconds = storedDiff;

                  } else {

                    elapsedSeconds = 0;

                  }

                } else {

                  elapsedSeconds = 0;

                }

              } catch (e) {

                elapsedSeconds = 0;

              }

            }

          }



          newElapsedTimes[ticket.id] = Math.max(0, elapsedSeconds);

        } catch (err) {

          newElapsedTimes[ticket.id] = 0;

        }

      });



      setElapsedTimes(newElapsedTimes);

    };



    // Atualizar imediatamente

    updateElapsedTimes();



    // Configurar intervalo para atualizar a cada segundo (1000ms)

    const intervalId = setInterval(() => {

      updateElapsedTimes();

    }, 1000);



    // Cleanup: limpar intervalo quando o componente desmontar ou activeTickets mudar

    return () => {

      clearInterval(intervalId);

    };

  }, [activeTickets]); //   // CORREÇÃO: Depender de activeTickets para recriar o intervalo quando mudar

  const clampBubblePosition = (x: number, y: number) => {
    if (typeof window === 'undefined') {
      return { x, y };
    }
    const maxX = Math.max(
      BUBBLE_MARGIN,
      window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN
    );
    const maxY = Math.max(
      BUBBLE_MARGIN,
      window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN
    );
    return {
      x: Math.min(Math.max(x, BUBBLE_MARGIN), maxX),
      y: Math.min(Math.max(y, BUBBLE_MARGIN), maxY),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(ACTIVE_TICKET_BUBBLE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { x?: number; y?: number };
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setBubblePosition(clampBubblePosition(parsed.x, parsed.y));
          return;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar posicao da bolha:', err);
    }
    const defaultX = window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN;
    const defaultY = window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN;
    setBubblePosition(clampBubblePosition(defaultX, defaultY));
  }, []);

  useEffect(() => {
    if (!bubblePosition) return;
    try {
      localStorage.setItem(
        ACTIVE_TICKET_BUBBLE_STORAGE_KEY,
        JSON.stringify(bubblePosition)
      );
    } catch (err) {
      console.warn('Erro ao salvar posicao da bolha:', err);
    }
  }, [bubblePosition]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setBubblePosition((prev) => {
        if (!prev) return prev;
        return clampBubblePosition(prev.x, prev.y);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleBubblePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!bubblePosition) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    bubbleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: bubblePosition.x,
      originY: bubblePosition.y,
      moved: false,
    };
    setIsBubbleDragging(false);
  };

  const handleBubblePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const dragState = bubbleDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (
      !dragState.moved &&
      Math.abs(dx) < BUBBLE_MOVE_THRESHOLD &&
      Math.abs(dy) < BUBBLE_MOVE_THRESHOLD
    ) {
      return;
    }
    if (!dragState.moved) {
      dragState.moved = true;
      setIsBubbleDragging(true);
    }
    const nextX = dragState.originX + dx;
    const nextY = dragState.originY + dy;
    setBubblePosition(clampBubblePosition(nextX, nextY));
  };

  const handleBubblePointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const dragState = bubbleDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (err) {
      // ignore
    }
    bubbleDragRef.current = null;
    if (!dragState.moved) {
      setIsActiveTicketDialogOpen(true);
    }
    skipBubbleClickRef.current = true;
    setTimeout(() => {
      skipBubbleClickRef.current = false;
    }, 0);
    setIsBubbleDragging(false);
  };

  const handleBubblePointerCancel = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const dragState = bubbleDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    bubbleDragRef.current = null;
    setIsBubbleDragging(false);
  };

  const handleBubbleClick = () => {
    if (skipBubbleClickRef.current) {
      return;
    }
    setIsActiveTicketDialogOpen(true);
  };


  const formatElapsed = (seconds: number) => {

    const h = Math.floor(seconds / 3600);

    const m = Math.floor((seconds % 3600) / 60);

    const s = seconds % 60;

    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(

      2,

      '0'

    )}:${String(s).padStart(2, '0')}`;

    return formatted;

  };
  const receiptDialog = receiptData ? (
    <ReceiptPreviewDialog
      isOpen={isReceiptModalOpen}
      onClose={() => {
        setIsReceiptModalOpen(false);
        setReceiptPreviewData(null);
      }}
      data={receiptData}
    />
  ) : null;



  // Se não há tickets ativos, não renderizar nada

  if (activeTickets.length === 0) {

    return receiptDialog;

  }



  // Função para obter ticket completo (com fallback para ticket temporário)

  const getTicketData = (

    ticketInfo: { id: string; startedAt: string } | undefined

  ): Ticket | null => {

    // Verificar se ticketInfo existe antes de acessar propriedades

    if (!ticketInfo || !ticketInfo.id) {

      return null;

    }



    const ticket = tickets?.find((t) => t.id === ticketInfo.id);

    if (ticket) {

      return ticket;

    }

    // Se não encontrou o ticket mas temos ID e startedAt, criar ticket temporário

    return {

      id: ticketInfo.id,

      clientId: '',

      scheduledDate: new Date().toISOString(),

      status: 'INICIADO',

      startedAt: ticketInfo.startedAt,

      client: { name: 'Carregando...', type: 'PF' },

      service: { name: 'Carregando...' },

    } as Ticket;

  };



  const completeTicket = async (

    ticket: Ticket,

    kmTotal: number,

    kmRate: number | undefined,

    additionalHourRate: number | undefined,

    extraExpenses: number,

    expenseDetails: string,

    baseAmount: number,

    totalAmount: number,

    discount: number,

    serviceItems: Array<{ name: string; amount: number }>,

    paymentDate?: string,

    warranty?: string

  ) => {

    try {

      setIsCompleting(true);



      // Priorizar ticket completo da query

      let ticketToUse = tickets?.find((t) => t.id === ticket.id) || ticket;



      // Se no tem ticketValue nem serviceId, E foi fornecido baseAmount, atualizar ticket antes de finalizar

      // O backend j fora check-in se necessrio, ento no precisamos fazer isso aqui

      if (

        !(ticketToUse as any).ticketValue &&

        !ticketToUse.serviceId &&

        baseAmount !== undefined &&

        baseAmount > 0

      ) {

        try {

          const userId = (ticketToUse as any).userId;

          if (!userId) {

            throw new Error('Não foi possível identificar o usuário');

          }



          await apiRequest('PUT', `/api/tickets/${ticketToUse.id}`, {

            userId,

            ticketValue: baseAmount.toString(),

          });



          // Atualizar localmente

          (ticketToUse as any).ticketValue = baseAmount.toString();

        } catch (updateErr) {

          console.warn(

            'Não foi possível atualizar ticketValue antes de finalizar:',

            updateErr

          );

          // Continuar mesmo assim - o backend pode conseguir determinar o valor base

        }

      }



      // Verificar se temos valor base antes de finalizar

      if (!(ticketToUse as any).ticketValue && !ticketToUse.serviceId) {

        throw new Error(

          'Não foi possível determinar o valor base do chamado. Verifique se o chamado possui serviço ou valor definido.'

        );

      }



      const completionPayload = {
        kmTotal: kmTotal || 0,
        kmRate: kmRate !== undefined && kmRate > 0 ? kmRate : undefined, // Enviar kmRate se fornecido
        additionalHourRate: additionalHourRate, // Enviar additionalHourRate se fornecido
        extraExpenses: extraExpenses || 0,
        expenseDetails: expenseDetails || '',
        elapsedSeconds: computeElapsedSeconds(
          ticketToUse.id,
          (ticketToUse as any).startedAt
        ),
        baseAmount: baseAmount, // Enviar baseAmount para o backend
        totalAmount: totalAmount, // Enviar totalAmount para o backend
        discount: discount,
        serviceItems: serviceItems,
        paymentDate: paymentDate || undefined, // Enviar paymentDate se fornecido
        warranty: warranty, // Enviar garantia para o backend
      };

      // Tentar finalizar - usar os dados do formulrio
      try {
        await apiRequest(
          'POST',
          `/api/tickets/${ticketToUse.id}/complete`,
          completionPayload
        );
      } catch (err: any) {
        const message = typeof err?.message === 'string' ? err.message : '';
        if (message.toLowerCase().includes('warranty')) {
          const payloadWithoutWarranty = { ...completionPayload };
          delete (payloadWithoutWarranty as { warranty?: string }).warranty;
          await apiRequest(
            'POST',
            `/api/tickets/${ticketToUse.id}/complete`,
            payloadWithoutWarranty
          );
        } else {
          throw err;
        }
      }



      // Se chegou aqui, a finalização foi bem-sucedida

      // Limpar do localStorage IMEDIATAMENTE - PRIORIDADE MÁXIMA

      clearTicketFromStorage(ticketToUse.id);

      setActiveTickets((prev) => prev.filter((t) => t.id !== ticketToUse.id));



      // Fechar dialog ANTES de invalidar queries

      setShowCompleteDialog(false);

      setDialogTicketId(null);



      // Atualizar cache local imediatamente para marcar como concludo

      queryClient.setQueryData(['/api/tickets'], (old: any) => {

        if (!Array.isArray(old)) return old;

        return old.map((t) => {

          if (t.id === ticketToUse.id) {

            return {

              ...t,

              status: 'CONCLUIDO',

              stoppedAt: new Date().toISOString(),

              completedAt: new Date().toISOString(),

              startedAt: undefined, // Remover startedAt para garantir que no aparea no banner

            };

          }

          return t;

        });

      });



      // Forar nova verificao do ticket ativo (para garantir que o banner desaparea)

      // O useEffect que chama determineActiveTicket vai ser acionado quando tickets mudar



      // Invalidar queries para buscar dados atualizados do backend

      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });

      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });



      toast({

        title: 'Chamado finalizado',

        description: 'O chamado foi concludo com sucesso.',

      });

    } catch (error: any) {

      console.error('Erro ao finalizar ticket:', error);



      // Se o erro for 404 (ticket no encontrado), limpar do localStorage e fechar banner

      if (

        error.message.includes('404') ||

        error.message.includes('no encontrado') ||

        error.message.includes('not found')

      ) {

        clearTicketFromStorage(ticket.id);

        setActiveTickets((prev) => prev.filter((t) => t.id !== ticket.id));

        setShowCompleteDialog(false);

        setDialogTicketId(null);



        toast({

          variant: 'destructive',

          title: 'Chamado no encontrado',

          description:

            'O chamado não foi encontrado no sistema. O banner foi fechado.',

        });



        setIsCompleting(false);

        return;

      }



      // Extrair mensagem de erro mais especfica

      let errorMessage =

        'Não foi possível finalizar o chamado. Tente novamente.';



      if (error.message) {

        // Se a mensagem de erro j  especfica, usar ela

        if (

          error.message.includes('servio') ||

          error.message.includes('valor')

        ) {

          errorMessage = error.message;

        } else {

          // Tentar extrair mensagem do erro 400 ou 404

          try {

            const errorText400 = error.message.split('400:')[1];

            const errorText404 = error.message.split('404:')[1];

            const errorText = errorText400 || errorText404;

            if (errorText) {

              const errorObj = JSON.parse(errorText);

              if (errorObj.message) {

                errorMessage = errorObj.message;

              }

            }

          } catch (e) {

            // Manter mensagem padro se no conseguir parsear

          }

        }

      }



      toast({

        variant: 'destructive',

        title: 'Erro ao finalizar',

        description: errorMessage,

      });

    } finally {

      setIsCompleting(false);

    }

  };



  const handleComplete = async (

    ticketId: string,

    data: {

      kmTotal: number;

      kmRate?: number;

      additionalHourRate?: number;

      extraExpenses: number;

      expenseDetails: string;

      baseAmount: number;

      totalAmount: number;

      discount: number;

      serviceItems: Array<{ name: string; amount: number }>;

      paymentDate?: string;

      shouldIssueReceipt?: boolean;

      warranty?: string;

    }

  ) => {

    const ticketInfo = activeTickets.find((t) => t.id === ticketId);

    if (!ticketInfo) return;

    const ticketData = getTicketData(ticketInfo);

    if (!ticketData) return;



    // Garantir que estamos usando o ticket completo dos dados da query, não o temporário

    const ticketToComplete =

      tickets?.find((t) => t.id === ticketId) || ticketData;



    try {

      await completeTicket(

        ticketToComplete,

        data.kmTotal || 0, // Passar kmTotal do formulário

        data.kmRate, // Passar kmRate do formulário (opcional)

        data.additionalHourRate, // Passar additionalHourRate do formulário

        data.extraExpenses || 0,

        data.expenseDetails || '',

        data.baseAmount,

        data.totalAmount,

        data.discount,

        data.serviceItems,

        data.paymentDate,

        data.warranty

      );



      // Emitir recibo se solicitado

      if (data.shouldIssueReceipt && user) {

        setReceiptPreviewData({

          company: {

            name: user.companyName || `${user.firstName} ${user.lastName}`,

            // logoUrl: user.companyLogoUrl,

            cnpj: user.cnpj,

            cpf: user.cpf,

            phone: user.phone,

            address: `${user.streetAddress || ''}, ${user.addressNumber || ''} - ${user.neighborhood || ''}, ${user.city || ''}/${user.state || ''}`,

            city: user.city,

          },

          client: {

            name: ticketToComplete.client?.name || 'Não informado',

            email: ticketToComplete.client?.email,

            phone: ticketToComplete.client?.phone,

            document: ticketToComplete.client?.cpf || ticketToComplete.client?.cnpj,

          },

          ticket: {

            id: ticketToComplete.id,

            serviceName: buildServiceSummary(

              data.serviceItems,

              ticketToComplete.service?.name || 'Servico Prestado'

            ),

            serviceItems: data.serviceItems,

            date: data.paymentDate || new Date().toISOString(),

            amount: data.totalAmount,

            discount: data.discount,

            kmTotal: data.kmTotal,

            kmRate: data.kmRate,

            extraExpenses: data.extraExpenses,

            description: data.expenseDetails,

            warranty: data.warranty,

          },

        });

        setIsReceiptModalOpen(true);

      }

    } catch (error) {

      // Erro já foi tratado em completeTicket

    }

  };



  const cancelTicket = async (ticket: Ticket) => {

    try {

      setIsCancelling(true);



      // Buscar ticket completo do backend para garantir que existe e temos o userId

      let ticketToCancel = tickets?.find((t) => t.id === ticket.id);



      // Se no encontrou na query, tentar buscar do backend

      if (!ticketToCancel) {

        try {

          const response = await apiRequest(

            'GET',

            `/api/tickets/${ticket.id}`,

            undefined

          );

          if (response.ok) {

            const fetchedTicket = await response.json();

            if (fetchedTicket) {

              ticketToCancel = fetchedTicket as Ticket;

            }

          }

        } catch (fetchErr: any) {
// Se não encontrou o ticket (404), apenas limpar do localStorage e fechar banner

          if (

            fetchErr.message.includes('404') ||

            fetchErr.message.includes('no encontrado') ||

            fetchErr.message.includes('not found')

          ) {

            clearTicketFromStorage(ticket.id);

            setActiveTickets((prev) => prev.filter((t) => t.id !== ticket.id));

            setShowCancelConfirm(false);

            setCancellingTicketId(null);



            toast({

              variant: 'destructive',

              title: 'Chamado no encontrado',

              description:

                'O chamado não foi encontrado no sistema. O banner foi fechado.',

            });

            return;

          }

          console.warn('Não foi possível buscar ticket do backend:', fetchErr);

        }

      }



      // Se ainda no encontrou o ticket, usar o ticket que temos e obter userId do contexto

      if (!ticketToCancel) {

        ticketToCancel = ticket;

      }



      // Garantir que temos userId - usar do contexto de autenticao se disponvel

      const userIdToUse = ticketToCancel.userId || user?.id;



      if (!userIdToUse) {

        throw new Error(

          'Não foi possível identificar o usuário para cancelar o chamado'

        );

      }



      // Fazer o cancelamento com motivo

      await apiRequest('POST', `/api/tickets/${ticket.id}/cancel`, {

        cancellationReason: cancellationDescription || 'Cancelado pelo usuário',

        cancellationSource: cancellationSource,

      });



      // Limpar do localStorage IMEDIATAMENTE

      clearTicketFromStorage(ticket.id);

      setActiveTickets((prev) => prev.filter((t) => t.id !== ticket.id));



      // Atualizar cache local

      queryClient.setQueryData(['/api/tickets'], (old: any) => {

        if (!Array.isArray(old)) return old;

        return old.map((t) => {

          if (t.id === ticket.id) {

            return {

              ...t,

              status: 'ABERTO',

              startedAt: null,

            };

          }

          return t;

        });

      });



      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });

      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });



      setShowCancelConfirm(false);

      setCancellingTicketId(null);

      setCancellationSource('CLIENTE');

      setCancellationDescription('');



      toast({

        title: 'Chamado cancelado',

        description: 'O chamado foi cancelado e voltou para o status aberto.',

      });

    } catch (error: any) {

      console.error('Erro ao cancelar ticket:', error);



      // Se o erro for 404, limpar do localStorage mesmo assim

      if (

        error.message.includes('404') ||

        error.message.includes('no encontrado') ||

        error.message.includes('not found')

      ) {

        clearTicketFromStorage(ticket.id);

        setActiveTickets((prev) => prev.filter((t) => t.id !== ticket.id));

        setShowCancelConfirm(false);

        setCancellingTicketId(null);



        toast({

          variant: 'destructive',

          title: 'Chamado no encontrado',

          description:

            'O chamado não foi encontrado no sistema. O banner foi fechado.',

        });

      } else {

        toast({

          variant: 'destructive',

          title: 'Erro ao cancelar',

          description:

            error.message ||

            'Não foi possível cancelar o chamado. Tente novamente.',

        });

      }

    } finally {

      setIsCancelling(false);

    }

  };



  const handleCancel = (ticketId: string) => {

    const ticketInfo = activeTickets.find((t) => t.id === ticketId);

    if (!ticketInfo) return;

    const ticketData = getTicketData(ticketInfo);

    if (!ticketData) return;

    setCancellingTicketId(ticketId);

    setCancellationSource('CLIENTE');

    setCancellationDescription('');

    setShowCancelConfirm(true);

  };



  // Obter ticket que está sendo cancelado

  const cancellingTicketInfo = cancellingTicketId

    ? activeTickets.find((t) => t.id === cancellingTicketId)

    : null;

  const cancellingTicket = cancellingTicketInfo

    ? getTicketData(cancellingTicketInfo)

    : null;



  // Obter ticket que está sendo finalizado

  const completingTicketInfo = dialogTicketId

    ? activeTickets.find((t) => t.id === dialogTicketId)

    : null;

  const completingTicket = completingTicketInfo

    ? getTicketData(completingTicketInfo)

    : null;

  const completingElapsedSeconds =
    dialogTicketId && completingTicket
      ? (elapsedTimes[dialogTicketId] ??
          computeElapsedSeconds(
            dialogTicketId,
            (completingTicket as any).startedAt
          ))
      : 0;

  const bubbleTicketInfo = activeTickets[0];
  const bubbleTicket = bubbleTicketInfo
    ? getTicketData(bubbleTicketInfo)
    : null;
  const bubbleElapsedSeconds =
    bubbleTicket && bubbleTicket.id
      ? (elapsedTimes[bubbleTicket.id] ??
          computeElapsedSeconds(
            bubbleTicket.id,
            (bubbleTicket as any).startedAt
          ))
      : 0;
  const bubbleTimerLabel = formatElapsed(bubbleElapsedSeconds);



  return (

    <>

      {bubblePosition && bubbleTicket && (
        <div
          className='fixed left-0 top-0 z-50'
          style={{
            transform: `translate3d(${bubblePosition.x}px, ${bubblePosition.y}px, 0)`,
          }}
        >
          <button
            type='button'
            onPointerDown={handleBubblePointerDown}
            onPointerMove={handleBubblePointerMove}
            onPointerUp={handleBubblePointerUp}
            onPointerCancel={handleBubblePointerCancel}
            onClick={handleBubbleClick}
            className={`group relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-500/20 transition-transform ${
              isBubbleDragging ? 'cursor-grabbing' : 'cursor-grab hover:scale-[1.02]'
            }`}
            style={{ touchAction: 'none' }}
            aria-label='Abrir chamado em andamento'
          >
            <div className='flex flex-col items-center gap-1 leading-none'>
              <Clock className='h-4 w-4' />
              <span className='text-[10px] font-black tracking-wide whitespace-nowrap'>
                {bubbleTimerLabel}
              </span>
            </div>
            {activeTickets.length > 1 && (
              <span className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow'>
                {activeTickets.length}
              </span>
            )}
          </button>
        </div>
      )}
      <Dialog
        open={isActiveTicketDialogOpen}
        onOpenChange={setIsActiveTicketDialogOpen}
      >
        <DialogContent className='w-[calc(100%-2rem)] max-w-[820px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0'>
          <div className='border-b border-border/60 px-4 py-3'>
            <DialogTitle className='text-base font-bold text-[#111418] dark:text-white'>
              Chamado em andamento
            </DialogTitle>
            <DialogDescription className='text-xs text-[#60708a] dark:text-slate-400'>
              Toque no chamado para controlar o cronometro.
            </DialogDescription>
          </div>
          <div className='space-y-3 p-4'>

          {activeTickets

            .filter((ticketInfo) => ticketInfo && ticketInfo.id) // Filtrar tickets inválidos

            .map((ticketInfo) => {

              if (!ticketInfo || !ticketInfo.id) return null; // Verificação adicional

              const ticket = getTicketData(ticketInfo);

              if (!ticket || !ticket.client) return null; // Verificar se ticket e client existem



              const isPartner = ticket.client?.type === 'EMPRESA_PARCEIRA';

              const ticketTitle =

                isPartner && ticket.ticketNumber

                  ? `[${ticket.ticketNumber}] ${

                      ticket.finalClient || 'Cliente'

                    }`

                  : ticket.service?.name || 'Chamado';



              const clientName = ticket.client?.name || 'Cliente';

              const elapsed = elapsedTimes[ticket.id] || 0;

              const includedHours =

                Number(

                  ticket.client?.defaultHoursIncluded ??

                    (ticket as any)?.defaultHoursIncluded ??

                    (ticket as any)?.hoursIncluded

                ) ||

                ticket.duration ||

                0;

              // Considera horas extras após 1 minuto além do limite contratado

              const isInExtraHours =

                includedHours > 0 && elapsed >= includedHours * 3600 + 60;



              return (

                <Card

                  key={ticket.id}

                  className={`w-full max-w-[760px] mx-auto rounded-xl border ${

                    isInExtraHours

                      ? 'border-orange-500/80 bg-orange-50 dark:border-orange-500/80 dark:bg-orange-950/30'

                      : 'border-border/60 bg-card/95'

                  } backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden`}

                >

                  <div className='p-4 sm:p-5'>
                    <div className='flex flex-col gap-4'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <div className='flex items-center gap-2 flex-shrink-0'>
                          <div className='relative'>
                            <div className='h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500 rounded-full animate-pulse' />
                            <div className='absolute inset-0 h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500 rounded-full animate-ping opacity-75' />
                          </div>
                          <span className='font-black text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap'>
                            Em Execu??o
                          </span>
                        </div>

                        <div className='flex items-center gap-1.5 flex-shrink-0'>
                          <span className='bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm'>
                            # {ticket.ticketNumber || ticket.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>

                        {ticket.startedAt && (
                          <div className='flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10'>
                            <PlayCircle className='h-3 w-3 text-emerald-600/70 dark:text-emerald-400/70' />
                            <span className='text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 whitespace-nowrap uppercase tracking-widest'>
                              {format(new Date(ticket.startedAt), 'HH:mm')}
                            </span>
                          </div>
                        )}

                        {ticket.calculationsEnabled !== false && (
                          <div className='flex items-center gap-2 bg-muted/50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-border/50 shadow-inner'>
                            <Clock className='h-3.5 w-3.5 text-muted-foreground' />
                            <span className='font-mono text-xs sm:text-sm font-black text-foreground tabular-nums'>
                              {formatElapsed(elapsed)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-[1.1fr,1fr] gap-4'>
                        <div className='space-y-3'>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-[9px] font-black uppercase tracking-widest text-muted-foreground'>
                              Servi?o / Atendimento
                            </span>
                            <span className='text-sm font-bold text-foreground leading-tight'>
                              {ticketTitle}
                            </span>
                          </div>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-[9px] font-black uppercase tracking-widest text-muted-foreground'>
                              Cliente Principal
                            </span>
                            <span className='text-sm font-medium text-foreground leading-tight'>
                              {clientName}
                            </span>
                          </div>
                        </div>

                        <div className='space-y-3'>
                          {isInExtraHours && ticket.calculationsEnabled !== false && (
                            <div className='flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300'>
                              <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
                              <div className='flex flex-col'>
                                <span className='text-[10px] font-black uppercase tracking-wide'>
                                  Aten??o: Horas Extras
                                </span>
                                <span className='text-[11px] font-semibold leading-tight'>
                                  Limite contratado excedido. Contabilizando excedente.
                                </span>
                              </div>
                            </div>
                          )}

                          <div className='flex flex-col gap-0.5 bg-muted/30 p-3 rounded-lg border border-border/50'>
                            <span className='text-[9px] font-black uppercase tracking-widest text-muted-foreground'>
                              Informa??es de In?cio
                            </span>
                            {ticket.startedAt ? (
                              <div className='flex flex-wrap items-center gap-2 mt-1'>
                                <div className='flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded'>
                                  <PlayCircle className='h-3 w-3' />
                                  Iniciado ?s {format(new Date(ticket.startedAt), 'HH:mm')}
                                </div>
                                <div className='text-[11px] text-muted-foreground'>
                                  em {format(new Date(ticket.startedAt), "dd 'de' MMMM", { locale: ptBR })}
                                </div>
                              </div>
                            ) : (
                              <div className='text-[11px] text-muted-foreground mt-1'>
                                Inicio nao informado.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center justify-end gap-2 border-t border-border/50 pt-3'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleCancel(ticket.id)}
                          disabled={isCancelling || isCompleting}
                          className='h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-3 border-border hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all rounded-lg'
                          title='Cancelar'
                        >
                          <X className='h-4 w-4 sm:mr-1.5' />
                          <span className='hidden sm:inline font-bold text-xs uppercase'>Cancelar</span>
                        </Button>
                        <Button
                          size='sm'
                          onClick={() => {
                            setDialogTicketId(ticket.id);
                            setShowCompleteDialog(true);
                          }}
                          disabled={isCancelling || isCompleting}
                          className='h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-primary/20 transition-all rounded-lg'
                          title='Finalizar'
                        >
                          <CheckCircle2 className='h-4 w-4 sm:mr-1.5' />
                          <span className='hidden sm:inline font-black text-xs uppercase tracking-tight'>Finalizar</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                </Card>

              );

            })}

        </div>
        </DialogContent>
      </Dialog>

      {completingTicket && (

        <TicketCompleteDialog

          isOpen={showCompleteDialog}

          onClose={() => {

            setShowCompleteDialog(false);

            setDialogTicketId(null);

          }}

          ticket={{

            id: completingTicket.id,

            serviceId: completingTicket.serviceId || '',

            ticketValue: (completingTicket as any).ticketValue || '',

            service: completingTicket.service || { name: '', price: '0' },

            kmTotal: (completingTicket as any).kmTotal || 0,

            kmRate: (completingTicket as any).kmRate || '0',

          }}

          fullTicketData={completingTicket}

          elapsedSeconds={completingElapsedSeconds}

          onComplete={async (data) => {

            if (dialogTicketId) {

              await handleComplete(dialogTicketId, data);

            }

          }}

          isPending={isCompleting}

        />

      )}



                              {/* Receipt Modal */}
      {receiptDialog}

      <Dialog

        open={showCancelConfirm}

        onOpenChange={(open) => {

          if (!open) {

            setShowCancelCloseConfirm(true);

          }

        }}

      >

        <DialogContent

          className='max-w-lg bg-white dark:bg-[#101722] border-2 border-emerald-500 dark:border-emerald-500 [&>button]:hidden'

          onInteractOutside={(e) => e.preventDefault()}

        >

          <div className='flex items-start justify-between'>

            <div className='flex flex-col gap-1'>

              <DialogTitle className='text-xl font-bold text-[#111418] dark:text-white'>

                Cancelar Chamado #

                {cancellingTicket?.ticketNumber ||

                  cancellingTicket?.id?.slice(0, 8)}

              </DialogTitle>

              <DialogDescription className='text-sm text-[#60708a] dark:text-slate-400'>

                Por favor, informe os detalhes do cancelamento.

              </DialogDescription>

            </div>

            <Button

              variant='ghost'

              size='icon'

              onClick={() => {

                setShowCancelCloseConfirm(true);

              }}

              className='flex h-8 w-8 items-center justify-center rounded-full text-[#60708a] transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'

            >

              <X className='h-5 w-5' />

            </Button>

          </div>



          <div className='flex flex-col gap-5 pt-2'>

            <div className='flex flex-col gap-2'>

              <p className='text-sm font-medium text-[#111418] dark:text-slate-200'>

                Quem solicitou o cancelamento?

              </p>

              <div className='flex h-10 w-full items-center justify-center rounded-lg bg-[#f0f2f5] p-1 dark:bg-slate-800'>

                <label

                  className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${

                    cancellationSource === 'CLIENTE'

                      ? 'bg-white text-[#111418] shadow-sm dark:bg-slate-700 dark:text-white'

                      : 'text-[#60708a] dark:text-slate-400'

                  }`}

                >

                  <span className='truncate'>Cliente</span>

                  <input

                    type='radio'

                    name='cancel-source'

                    value='CLIENTE'

                    checked={cancellationSource === 'CLIENTE'}

                    onChange={() => setCancellationSource('CLIENTE')}

                    className='invisible w-0'

                  />

                </label>

                <label

                  className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${

                    cancellationSource === 'TECNICO'

                      ? 'bg-white text-[#111418] shadow-sm dark:bg-slate-700 dark:text-white'

                      : 'text-[#60708a] dark:text-slate-400'

                  }`}

                >

                  <span className='truncate'>Técnico</span>

                  <input

                    type='radio'

                    name='cancel-source'

                    value='TECNICO'

                    checked={cancellationSource === 'TECNICO'}

                    onChange={() => setCancellationSource('TECNICO')}

                    className='invisible w-0'

                  />

                </label>

              </div>

            </div>



            <label className='flex flex-col gap-2'>

              <p className='text-sm font-medium text-[#111418] dark:text-slate-200'>

                Motivo do Cancelamento

              </p>

              <Textarea

                id='cancellation-description'

                placeholder='Ex: Cliente solicitou o reagendamento para outra data / Peça necessária não está em estoque.'

                value={cancellationDescription}

                onChange={(e) => setCancellationDescription(e.target.value)}

                rows={6}

                className='flex min-h-32 w-full flex-1 resize-none overflow-hidden rounded-lg border border-[#dbdfe6] bg-white p-3 text-sm font-normal text-[#111418] placeholder:text-[#60708a] focus:border-primary focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-primary/80'

              />

            </label>



            {isGoogleCalendarConnected && (

              <div className='flex items-center gap-3 rounded-lg bg-blue-50 p-3 dark:bg-primary/10'>

                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary dark:bg-primary/20 dark:text-primary/80'>

                  <span className='material-symbols-outlined text-base'>

                    info

                  </span>

                </div>

                <p className='flex-1 text-sm font-normal leading-normal text-blue-800 dark:text-blue-200'>

                  A ação removerá o evento do Google Calendar.

                </p>

              </div>

            )}

          </div>



          <div className='flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800'>

            <Button

              variant='outline'

              onClick={() => {

                setShowCancelCloseConfirm(true);

              }}

              disabled={isCancelling}

              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#f0f2f5] px-4 text-sm font-bold leading-normal tracking-[0.015em] text-[#111418] transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'

            >

              <span className='truncate'>Voltar</span>

            </Button>

            <Button

              onClick={() => {

                if (cancellingTicket) {

                  cancelTicket(cancellingTicket);

                }

              }}

              disabled={isCancelling || !cancellationDescription.trim()}

              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white transition-colors hover:bg-primary/90'

            >

              {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Confirmação para fechar modal de cancelamento */}

      <AlertDialog

        open={showCancelCloseConfirm}

        onOpenChange={setShowCancelCloseConfirm}

      >

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Cancelar operação</AlertDialogTitle>

            <AlertDialogDescription>

              Tem certeza que deseja fechar? Os dados preenchidos serão

              perdidos.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel onClick={() => setShowCancelCloseConfirm(false)}>

              Não

            </AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                setShowCancelConfirm(false);

                setCancellingTicketId(null);

                setCancellationSource('CLIENTE');

                setCancellationDescription('');

                setShowCancelCloseConfirm(false);

              }}

            >

              Sim, fechar

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

}

