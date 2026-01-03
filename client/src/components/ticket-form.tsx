import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/date-time-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { StatusBanner } from "./status-banner";

type ClientType = "PF" | "PJ";

export function TicketForm() {
  const [clientType, setClientType] = useState<ClientType>("PF");
  const [date, setDate] = useState<Date>();
  const [googleConnected] = useState(false); // TODO: remove mock functionality

  return (
    <div className="space-y-4">
      {!googleConnected && (
        <StatusBanner
          variant="warning"
          title="Google Calendar no conectado"
          message="Este agendamento no ser sincronizado automaticamente. Conecte o Google Calendar para habilitar a sincronizao."
          actionLabel="Conectar"
          onAction={() => console.log('Connect Google')}
        />
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Novo Chamado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tipo de Cliente</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={clientType === "PF" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setClientType("PF")}
                data-testid="button-ticket-type-pf"
              >
                Pessoa Fsica
              </Button>
              <Button
                type="button"
                variant={clientType === "PJ" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setClientType("PJ")}
                data-testid="button-ticket-type-pj"
              >
                Pessoa Jurdica
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Select>
                <SelectTrigger id="client" data-testid="select-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client1">Joo Silva</SelectItem>
                  <SelectItem value="client2">Empresa XYZ Ltda</SelectItem>
                  <SelectItem value="client3">Maria Santos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {clientType === "PJ" && (
              <div className="space-y-2">
                <Label htmlFor="company">Empresa Responsvel</Label>
                <Select>
                  <SelectTrigger id="company" data-testid="select-company">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company1">TechFix Solutions</SelectItem>
                    <SelectItem value="company2">IT Services Brasil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Servio</Label>
            <Select>
              <SelectTrigger id="service" data-testid="select-service">
                <SelectValue placeholder="Selecione o servio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maintenance">Manuteno Preventiva</SelectItem>
                <SelectItem value="repair">Reparo de Equipamento</SelectItem>
                <SelectItem value="installation">Instalao</SelectItem>
                <SelectItem value="consultation">Consultoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Data do Agendamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <TimeInput
              id="time"
              label="Horário"
              data-testid="input-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrio</Label>
            <Textarea
              id="description"
              placeholder="Descreva o servio a ser realizado..."
              rows={4}
              data-testid="input-description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" data-testid="button-cancel">
              Cancelar
            </Button>
            <Button type="submit" data-testid="button-save-ticket">
              Criar Chamado
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
