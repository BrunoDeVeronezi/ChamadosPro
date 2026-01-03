import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type ClientType = "PF" | "PJ";

export function ClientForm() {
  const [clientType, setClientType] = useState<ClientType>("PF");
  const [monthlySpreadsheet, setMonthlySpreadsheet] = useState(false);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Novo Cliente</CardTitle>
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
              data-testid="button-client-type-pf"
            >
              Pessoa Fsica
            </Button>
            <Button
              type="button"
              variant={clientType === "PJ" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setClientType("PJ")}
              data-testid="button-client-type-pj"
            >
              Pessoa Jurdica
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome {clientType === "PJ" && "da Empresa"}</Label>
            <Input id="name" placeholder="Digite o nome" data-testid="input-client-name" />
          </div>

          {clientType === "PF" ? (
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" data-testid="input-client-cpf" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" data-testid="input-client-cnpj" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="email@exemplo.com" data-testid="input-client-email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" placeholder="(00) 00000-0000" data-testid="input-client-phone" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" placeholder="So Paulo" data-testid="input-client-city" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" placeholder="SP" data-testid="input-client-state" />
          </div>
        </div>

        {clientType === "PJ" && (
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="monthly-spreadsheet">Planilha Mensal Automtica</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar planilha de servios mensalmente
                </p>
              </div>
              <Switch
                id="monthly-spreadsheet"
                checked={monthlySpreadsheet}
                onCheckedChange={setMonthlySpreadsheet}
                data-testid="switch-monthly-spreadsheet"
              />
            </div>

            {monthlySpreadsheet && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="spreadsheet-email">E-mail para Planilha</Label>
                  <Input
                    id="spreadsheet-email"
                    type="email"
                    placeholder="financeiro@empresa.com"
                    data-testid="input-spreadsheet-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spreadsheet-day">Dia do Envio</Label>
                  <Input
                    id="spreadsheet-day"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="5"
                    data-testid="input-spreadsheet-day"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" type="button" data-testid="button-cancel">
            Cancelar
          </Button>
          <Button type="submit" data-testid="button-save-client">
            Salvar Cliente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
