import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { X, FileText, Loader2 } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ModalExportacaoPdfCompleta2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModalExportacaoPdfCompleta2({
  open,
  onOpenChange,
}: ModalExportacaoPdfCompleta2Props) {
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const [reportType, setReportType] = useState('faturamento');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDateRange, setSelectedDateRange] = useState<Date[]>([]);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [orientation, setOrientation] = useState('portrait');
  const [isGenerating, setIsGenerating] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return;

    if (selectedDateRange.length === 0) {
      setSelectedDateRange([date]);
    } else if (selectedDateRange.length === 1) {
      const [start] = selectedDateRange;
      if (date < start) {
        setSelectedDateRange([date, start]);
      } else {
        setSelectedDateRange([start, date]);
      }
    } else {
      setSelectedDateRange([date]);
    }
  };

  const isDateInRange = (date: Date) => {
    if (selectedDateRange.length !== 2) return false;
    const [start, end] = selectedDateRange;
    return date >= start && date <= end;
  };

  const isDateSelected = (date: Date) => {
    return selectedDateRange.some((d) => isSameDay(d, date));
  };

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await apiRequest('POST', '/api/reports/export-pdf', {
        reportType,
        client: client || undefined,
        status: status || undefined,
        startDate: selectedDateRange[0]?.toISOString(),
        endDate: selectedDateRange[1]?.toISOString(),
        includeHeader,
        includeFooter,
        orientation,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return blob;
    },
    onSuccess: () => {
      toast({
        title: 'PDF gerado com sucesso',
        description: 'O relatório foi baixado com sucesso.',
      });
      setIsGenerating(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: error.message,
      });
      setIsGenerating(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800'>
        <DialogHeader className='flex items-center justify-between border-b border-slate-800 p-4 sm:p-6'>
          <DialogTitle className='text-white tracking-light text-xl font-bold leading-tight'>
            Exportar Relatório Completo
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Configure filtros e gere o PDF completo.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col md:flex-row'>
          <div className='flex-grow p-4 sm:p-6 space-y-6'>
            {/* Step 1 */}
            <div>
              <h3 className='text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-3'>
                1. Selecione o Relatório
              </h3>
              <div className='flex max-w-full flex-wrap items-end gap-4'>
                <Label className='flex flex-col min-w-40 flex-1'>
                  <p className='text-slate-200 text-sm font-medium leading-normal pb-2'>
                    Tipo de Relatório
                  </p>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className='form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-700 bg-slate-800 focus:border-primary h-12 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='faturamento'>
                        Faturamento Detalhado
                      </SelectItem>
                      <SelectItem value='chamados'>
                        Lista de Chamados
                      </SelectItem>
                      <SelectItem value='clientes'>
                        Perfil de Clientes
                      </SelectItem>
                      <SelectItem value='servicos'>
                        Relatório de Serviços
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <h3 className='text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-3'>
                2. Aplique os Filtros
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Label className='flex flex-col'>
                  <p className='text-slate-200 text-sm font-medium leading-normal pb-2'>
                    Cliente
                  </p>
                  <Select value={client} onValueChange={setClient}>
                    <SelectTrigger className='form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-700 bg-slate-800 focus:border-primary h-12 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal'>
                      <SelectValue placeholder='Todos os clientes' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=''>Todos os clientes</SelectItem>
                      <SelectItem value='cliente1'>Cliente A</SelectItem>
                      <SelectItem value='cliente2'>Cliente B</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
                <Label className='flex flex-col'>
                  <p className='text-slate-200 text-sm font-medium leading-normal pb-2'>
                    Status do Chamado
                  </p>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className='form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-700 bg-slate-800 focus:border-primary h-12 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal'>
                      <SelectValue placeholder='Todos os status' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=''>Todos os status</SelectItem>
                      <SelectItem value='aberto'>Aberto</SelectItem>
                      <SelectItem value='fechado'>Fechado</SelectItem>
                      <SelectItem value='pendente'>Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
              </div>
            </div>

            {/* Calendar */}
            <div className='pt-2'>
              <p className='text-slate-200 text-sm font-medium leading-normal pb-2'>
                Período
              </p>
              <div className='flex flex-wrap items-center justify-start gap-4 sm:gap-6 border border-slate-800 rounded-lg p-4 bg-slate-800/50'>
                <div className='flex min-w-64 max-w-[300px] flex-1 flex-col gap-0.5'>
                  <div className='flex items-center p-1 justify-between'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='flex size-9 items-center justify-center rounded-full hover:bg-slate-700 text-slate-300'
                      onClick={() =>
                        setCurrentMonth(subMonths(currentMonth, 1))
                      }
                    >
                      ←
                    </Button>
                    <p className='text-white text-sm font-bold leading-tight text-center'>
                      {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='flex size-9 items-center justify-center rounded-full hover:bg-slate-700 text-slate-300'
                      onClick={() =>
                        setCurrentMonth(addMonths(currentMonth, 1))
                      }
                    >
                      →
                    </Button>
                  </div>
                  <div className='grid grid-cols-7 gap-1'>
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day) => (
                      <p
                        key={day}
                        className='text-slate-400 text-xs font-bold leading-normal flex h-9 w-full items-center justify-center'
                      >
                        {day}
                      </p>
                    ))}
                    {calendarDays.map((day) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isInRange = isDateInRange(day);
                      const isSelected = isDateSelected(day);
                      const isStart =
                        selectedDateRange[0] &&
                        isSameDay(day, selectedDateRange[0]);
                      const isEnd =
                        selectedDateRange[1] &&
                        isSameDay(day, selectedDateRange[1]);

                      return (
                        <button
                          key={day.toISOString()}
                          type='button'
                          className={`h-9 w-full text-sm font-medium ${
                            !isCurrentMonth
                              ? 'text-slate-400'
                              : isInRange
                              ? 'bg-primary/20 text-slate-300'
                              : isSelected
                              ? 'bg-primary text-white rounded-full'
                              : 'text-slate-300 hover:bg-slate-700'
                          } ${isStart ? 'rounded-l-full' : ''} ${
                            isEnd ? 'rounded-r-full' : ''
                          }`}
                          onClick={() => handleDateClick(day)}
                          disabled={!isCurrentMonth}
                        >
                          <div className='flex size-full items-center justify-center rounded-full'>
                            {format(day, 'd')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <h3 className='text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-3'>
                3. Opções de Layout
              </h3>
              <div className='space-y-4'>
                <div className='flex flex-col gap-3'>
                  <Label className='flex items-center gap-3 cursor-pointer'>
                    <Checkbox
                      checked={includeHeader}
                      onCheckedChange={(checked) =>
                        setIncludeHeader(checked === true)
                      }
                      className='h-5 w-5 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary/50'
                    />
                    <span className='text-slate-300 text-base'>
                      Incluir cabeçalho da empresa
                    </span>
                  </Label>
                  <Label className='flex items-center gap-3 cursor-pointer'>
                    <Checkbox
                      checked={includeFooter}
                      onCheckedChange={(checked) =>
                        setIncludeFooter(checked === true)
                      }
                      className='h-5 w-5 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary/50'
                    />
                    <span className='text-slate-300 text-base'>
                      Incluir rodapé com número de página
                    </span>
                  </Label>
                </div>
                <div className='flex items-center gap-6 pt-2'>
                  <p className='text-slate-300 text-base font-medium'>
                    Orientação:
                  </p>
                  <RadioGroup
                    value={orientation}
                    onValueChange={setOrientation}
                    className='flex items-center gap-4'
                  >
                    <Label className='flex items-center gap-2 cursor-pointer'>
                      <RadioGroupItem
                        value='portrait'
                        className='h-5 w-5 text-primary border-slate-600 bg-slate-800 focus:ring-primary/50'
                      />
                      <span className='text-slate-300 text-base'>Retrato</span>
                    </Label>
                    <Label className='flex items-center gap-2 cursor-pointer'>
                      <RadioGroupItem
                        value='landscape'
                        className='h-5 w-5 text-primary border-slate-600 bg-slate-800 focus:ring-primary/50'
                      />
                      <span className='text-slate-300 text-base'>Paisagem</span>
                    </Label>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isGenerating && (
            <div className='hidden flex-grow p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]'>
              <Loader2 className='animate-spin h-12 w-12 text-primary' />
              <h3 className='text-white text-xl font-bold'>Gerando PDF...</h3>
              <p className='text-slate-400 max-w-xs'>
                Por favor, aguarde enquanto preparamos o seu relatório. Isso
                pode levar alguns instantes.
              </p>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-3 border-t border-slate-800 p-4 sm:p-6 bg-slate-900/50'>
          <Button
            variant='outline'
            className='px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors'
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className='flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors'
            onClick={() => {
              if (
                !requirePaid({
                  feature: 'Geracao de PDF',
                  description:
                    'Geracao de PDF esta disponivel apenas na versao paga.',
                })
              ) {
                return;
              }
              generatePdfMutation.mutate();
            }}
            disabled={isGenerating || selectedDateRange.length !== 2}
          >
            <FileText className='w-5 h-5' />
            <span>Gerar PDF</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}




















