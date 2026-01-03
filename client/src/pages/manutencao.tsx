import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subMonths, subYears } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";
import { apiRequest, invalidateTicketDependentQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Client = {
  id: string;
  name: string;
  type: "PF" | "PJ" | "EMPRESA_PARCEIRA";
  phone: string;
  email: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  clientId: string;
  scheduledDate: string;
  scheduledTime: string;
  completedAt: string;
  stoppedAt: string;
  status: string;
  description: string;
  createdAt: string;
};

const normalizeStatus = (status: string | undefined | null) =>
  (status || "").trim().toUpperCase();

const getCloseDate = (t: Ticket) =>
  new Date(t.completedAt || t.stoppedAt || t.scheduledDate);

export default function Manutencao() {
  const { toast } = useToast();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

  const { data: tickets = [], isLoading: loadingTickets, refetch: refetchTickets } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tickets");
      if (!res.ok) throw new Error("Erro ao carregar chamados");
      return res.json();
    },
  });

  const { data: clients = [], isLoading: loadingClients, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/clients");
      if (!res.ok) throw new Error("Erro ao carregar clientes");
      return res.json();
    },
  });

  const cutoffTickets = subMonths(new Date(), 6);
  cutoffTickets.setDate(cutoffTickets.getDate() - 1); // 6 meses e 1 dia
  const cutoffClients = subYears(new Date(), 1);

  const oldTickets = useMemo(() => {
    return tickets.filter((t) => {
      const status = normalizeStatus(t.status);
      const isClosed = status === "CONCLUIDO" || status === "COMPLETED";
      if (!isClosed) return false;
      const closedAt = getCloseDate(t);
      return closedAt < cutoffTickets;
    });
  }, [tickets, cutoffTickets]);

  const lastTicketByClient = useMemo(() => {
    const map = new Map<string, Date>();
    tickets.forEach((t) => {
      const d = getCloseDate(t);
      const current = map.get(t.clientId);
      if (!current || d > current) {
        map.set(t.clientId, d);
      }
    });
    return map;
  }, [tickets]);

  const staleClients = useMemo(() => {
    return clients
      .map((c) => {
        const last = lastTicketByClient.get(c.id);
        const created = c.createdAt ? new Date(c.createdAt) : undefined;
        return { ...c, lastDate: last, createdAtDate: created };
      })
      .filter((c) => {
        const lastOrCreated = c.lastDate || c.createdAtDate;
        return !lastOrCreated || lastOrCreated < cutoffClients;
      });
  }, [clients, lastTicketByClient, cutoffClients]);

  const toggleAllTickets = (checked: boolean) => {
    setSelectedTickets(checked ? new Set(oldTickets.map((t) => t.id)) : new Set());
  };

  const toggleAllClients = (checked: boolean) => {
    setSelectedClients(checked ? new Set(staleClients.map((c) => c.id)) : new Set());
  };

  const deleteTickets = async () => {
    if (!selectedTickets.size) return;
    try {
      for (const id of selectedTickets) {
        await apiRequest("DELETE", `/api/tickets/${id}`);
      }
      await invalidateTicketDependentQueries();
      toast({ title: "Chamados removidos", description: "Chamados antigos excludos." });
      setSelectedTickets(new Set());
      refetchTickets();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir chamados", description: error.message || "Tente novamente." });
    }
  };

  const deleteClients = async () => {
    if (!selectedClients.size) return;
    try {
      for (const id of selectedClients) {
        await apiRequest("DELETE", `/api/clients/${id}`);
      }
      toast({ title: "Clientes removidos", description: "Clientes inativos excludos." });
      setSelectedClients(new Set());
      refetchClients();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir clientes", description: error.message || "Tente novamente." });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg sm:text-xl">Aviso de limpeza</CardTitle>
          </div>
          <CardDescription className="text-sm sm:text-base">
            {oldTickets.length} chamados encerrados h mais de 6 meses. {staleClients.length} clientes sem atendimento h mais de 1 ano.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Chamados com mais de 6 meses</CardTitle>
              <CardDescription>Selecione para excluir do Sheets</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={oldTickets.length > 0 && selectedTickets.size === oldTickets.length}
                onCheckedChange={(c) => toggleAllTickets(!!c)}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTickets ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
            ) : oldTickets.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum chamado elegível.</div>
            ) : (
              <div className="divide-y">
                {oldTickets.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTickets.has(t.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selectedTickets);
                        if (c) next.add(t.id);
                        else next.delete(t.id);
                        setSelectedTickets(next);
                      }}
                    />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">#{t.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Encerrado em {getCloseDate(t).toLocaleDateString("pt-BR")} - Status: {t.status}
                      </p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
          <div className="p-4 border-t flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              disabled={!selectedTickets.size}
              onClick={deleteTickets}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir selecionados
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Clientes inativos (mais de 1 ano)</CardTitle>
              <CardDescription>Sem chamados nos ltimos 12 meses</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={staleClients.length > 0 && selectedClients.size === staleClients.length}
                onCheckedChange={(c) => toggleAllClients(!!c)}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingClients ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
            ) : staleClients.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum cliente inativo.</div>
            ) : (
              <div className="divide-y">
                {staleClients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedClients.has(c.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedClients);
                        if (checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelectedClients(next);
                      }}
                    />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tipo: {c.type} - ltimo chamado:{" "}
                        {c.lastDate
                          ? c.lastDate.toLocaleDateString("pt-BR")
                          : c.createdAtDate
                          ? `Cadastro: ${c.createdAtDate.toLocaleDateString("pt-BR")}`
                          : "Sem histórico"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
          <div className="p-4 border-t flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              disabled={!selectedClients.size}
              onClick={deleteClients}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir selecionados
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
