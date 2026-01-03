import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { X, Filter, Save, RotateCcw, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReportFilters {
  dateRange: { from: string; to: string };
  status: string[];
  clientType: string[];
  clientId: string;
  searchTerm: string;
  paymentMethod: string[];
  valueRange: { min: number; max: number };
  services: string[];
  paymentChannel: string[];
}

interface Client {
  id: string;
  name: string;
  type: "PF" | "PJ" | "EMPRESA_PARCEIRA";
}

interface ReportsFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  clients: Client[];
}

const STATUS_OPTIONS = [
  { value: "ABERTO", label: "Aberto" },
  { value: "EXECUCAO", label: "Em Progresso" },
  { value: "CONCLUIDO", label: "Finalizado" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
];

const CLIENT_TYPE_OPTIONS = [
  { value: "PF", label: "Pessoa Fsica" },
  { value: "PJ", label: "Pessoa Jurdica" },
  { value: "EMPRESA_PARCEIRA", label: "Empresa Parceira" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "CARTAO", label: "Carto" },
  { value: "BOLETO", label: "Boleto" },
  { value: "LINK", label: "Link de Pagamento" },
];

const PAYMENT_CHANNEL_OPTIONS = [
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "ASAAS", label: "Asaas" },
  { value: "MANUAL", label: "Manual" },
];

export function ReportsFilters({ filters, onFiltersChange, clients }: ReportsFiltersProps) {
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState("");
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const updateFilters = (updates: Partial<ReportFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilter = (key: keyof ReportFilters) => {
    const defaultValues: Partial<ReportFilters> = {
      dateRange: { from: "", to: "" },
      status: [],
      clientType: [],
      clientId: undefined,
      searchTerm: "",
      paymentMethod: [],
      valueRange: undefined,
      services: [],
      paymentChannel: [],
    };
    updateFilters({ [key]: defaultValues[key] });
  };

  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let from = "";
    let to = format(today, "yyyy-MM-dd");

    switch (preset) {
      case "today":
        from = format(today, "yyyy-MM-dd");
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        from = format(yesterday, "yyyy-MM-dd");
        to = format(yesterday, "yyyy-MM-dd");
        break;
      case "thisWeek":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        from = format(startOfWeek, "yyyy-MM-dd");
        break;
      case "thisMonth":
        from = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
        break;
      case "last30Days":
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        from = format(last30, "yyyy-MM-dd");
        break;
    }

    updateFilters({ dateRange: { from, to } });
  };

  const toggleArrayFilter = (
    key: "status" | "clientType" | "paymentMethod" | "services" | "paymentChannel",
    value: string
  ) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilters({ [key]: updated });
  };

  const selectedClient = clients.find((c) => c.id === filters.clientId);

  return (
    <Card className="h-fit">
      <CardHeader className="p-2 sm:p-3 pb-1.5 sm:pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filtros
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 sm:h-8 text-xs sm:text-sm"
            onClick={() => {
              updateFilters({
                dateRange: { from: "", to: "" },
                status: [],
                clientType: [],
                clientId: undefined,
                searchTerm: "",
                paymentMethod: [],
                valueRange: undefined,
                services: [],
                paymentChannel: [],
              });
            }}
          >
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Limpar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm p-2 sm:p-3 pt-1.5 sm:pt-2">
        {/* Pesquisa Global */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Pesquisa Global</Label>
          <Input
            placeholder="Cliente, ID, descrio, telefone..."
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
          />
        </div>

        {/* Intervalo de Datas */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Intervalo de Datas</Label>
          <div className="flex flex-wrap gap-1 sm:gap-2 mb-1.5 sm:mb-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => applyDatePreset("today")}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => applyDatePreset("yesterday")}
            >
              Ontem
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => applyDatePreset("thisWeek")}
            >
              Semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => applyDatePreset("thisMonth")}
            >
              Ms
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => applyDatePreset("last30Days")}
            >
              30 dias
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.from
                    ? format(new Date(filters.dateRange.from), "dd/MM/yyyy", { locale: ptBR })
                    : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.from ? new Date(filters.dateRange.from) : undefined}
                  onSelect={(date) => {
                    updateFilters({
                      dateRange: {
                        ...filters.dateRange,
                        from: date ? format(date, "yyyy-MM-dd") : "",
                      },
                    });
                    setDateFromOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.to
                    ? format(new Date(filters.dateRange.to), "dd/MM/yyyy", { locale: ptBR })
                    : "At"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.to ? new Date(filters.dateRange.to) : undefined}
                  onSelect={(date) => {
                    updateFilters({
                      dateRange: {
                        ...filters.dateRange,
                        to: date ? format(date, "yyyy-MM-dd") : "",
                      },
                    });
                    setDateToOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Cliente</Label>
          <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                {selectedClient ? selectedClient.name : "Selecione um cliente"}
                <X className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar cliente..."
                  value={clientSearchValue}
                  onValueChange={setClientSearchValue}
                />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {clients
                      .filter((client) =>
                        client.name.toLowerCase().includes(clientSearchValue.toLowerCase())
                      )
                      .map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.id}
                          onSelect={() => {
                            updateFilters({
                              clientId: filters.clientId === client.id ? undefined : client.id,
                            });
                            setClientSearchOpen(false);
                          }}
                        >
                          {client.name} ({client.type})
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Tipo de Cliente */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Tipo de Cliente</Label>
          <div className="space-y-1 sm:space-y-1.5">
            {CLIENT_TYPE_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`client-type-${option.value}`}
                  checked={filters.clientType.includes(option.value)}
                  onCheckedChange={() => toggleArrayFilter("clientType", option.value)}
                />
                <Label
                  htmlFor={`client-type-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Status do Chamado</Label>
          <div className="space-y-1 sm:space-y-1.5">
            {STATUS_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${option.value}`}
                  checked={filters.status.includes(option.value)}
                  onCheckedChange={() => toggleArrayFilter("status", option.value)}
                />
                <Label
                  htmlFor={`status-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Meio de Pagamento */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Meio de Pagamento</Label>
          <div className="space-y-1 sm:space-y-1.5">
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`payment-method-${option.value}`}
                  checked={filters.paymentMethod.includes(option.value)}
                  onCheckedChange={() => toggleArrayFilter("paymentMethod", option.value)}
                />
                <Label
                  htmlFor={`payment-method-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Faixa de Valor */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Faixa de Valor</Label>
          <div className="space-y-2 sm:space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mnimo"
                value={filters.valueRange.min || ""}
                onChange={(e) =>
                  updateFilters({
                    valueRange: {
                      min: Number(e.target.value) || 0,
                      max: filters.valueRange.max || 100000,
                    },
                  })
                }
              />
              <Input
                type="number"
                placeholder="Mximo"
                value={filters.valueRange.max || ""}
                onChange={(e) =>
                  updateFilters({
                    valueRange: {
                      min: filters.valueRange.min || 0,
                      max: Number(e.target.value) || 100000,
                    },
                  })
                }
              />
            </div>
            <Slider
              value={[
                filters.valueRange.min || 0,
                filters.valueRange.max || 100000,
              ]}
              onValueChange={([min, max]) =>
                updateFilters({ valueRange: { min, max } })
              }
              min={0}
              max={100000}
              step={100}
              className="w-full"
            />
          </div>
        </div>

        {/* Canal de Pagamento */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-xs sm:text-sm">Canal de Pagamento</Label>
          <div className="space-y-1 sm:space-y-1.5">
            {PAYMENT_CHANNEL_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`payment-channel-${option.value}`}
                  checked={filters.paymentChannel.includes(option.value)}
                  onCheckedChange={() => toggleArrayFilter("paymentChannel", option.value)}
                />
                <Label
                  htmlFor={`payment-channel-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Botes de Ao */}
        <div className="flex flex-col gap-1.5 sm:gap-2 pt-2 sm:pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 sm:h-8 text-xs sm:text-sm"
            onClick={() => {
              // TODO: Implementar salvar filtro
              console.log("Salvar filtro");
            }}
          >
            <Save className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Salvar Filtro</span>
            <span className="sm:hidden">Salvar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

