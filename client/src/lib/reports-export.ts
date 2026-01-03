import { apiRequest } from "./queryClient";
import { toast } from "../hooks/use-toast";

interface Ticket {
  id: string;
  scheduledFor: string;
  status: string;
  ticketValue: string;
  kmRate: string;
  kmTotal: number;
  extraExpenses: number;
  totalAmount: number;
  startedAt: string;
  stoppedAt: string;
  completedAt: string;
  paymentDate: string;
  client: { id: string; name: string; type: "PF" | "PJ" | "EMPRESA_PARCEIRA"; phone: string };
  service: { id: string; name: string; price: number };
  description: string;
}

interface ReportFilters {
  dateRange: { from: string; to: string };
  status: string[];
  clientType: string[];
  clientId: string;
  searchTerm: string;
}

interface Summary {
  total: number;
  totalValue: number;
  byStatus: Record<string, number>;
  selected: number;
}

export async function exportReports(
  tickets: Ticket[],
  format: "pdf" | "excel" | "xml" | "email" | "whatsapp",
  filters: ReportFilters,
  summary: Summary
): Promise<void> {
  const selectedIds = tickets.map((t) => t.id);

  try {
    switch (format) {
      case "excel":
      case "pdf":
      case "xml": {
        // Iniciar job de exportao
        const response = await apiRequest("POST", "/api/reports/export", {
          filters,
          format,
          selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
        });

        const { jobId } = await response.json();

        // Polling para verificar status do job
        const checkStatus = async (): Promise<string> => {
          const statusResponse = await apiRequest("GET", `/api/reports/jobs/${jobId}/status`);
          const statusData = await statusResponse.json();

          if (statusData.status === "completed") {
            return statusData.downloadUrl;
          } else if (statusData.status === "failed") {
            throw new Error(statusData.error || "Falha na exportao");
          } else {
            // Aguardar e tentar novamente
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return checkStatus();
          }
        };

        const downloadUrl = await checkStatus();
        window.open(downloadUrl, "_blank");
        break;
      }

      case "email": {
        // Abrir modal de envio por email
        const response = await apiRequest("POST", "/api/reports/send-email", {
          ids: selectedIds,
          filters,
        });

        if (!response.ok) {
          throw new Error("Erro ao preparar envio por email");
        }

        // Em produo, isso abriria um modal
        toast({
          title: "Email preparado",
          description: "Use o modal para configurar destinatarios e enviar.",
        });
        break;
      }

      case "whatsapp": {
        // Enviar via WhatsApp
        if (selectedIds.length === 0) {
          throw new Error("Selecione pelo menos um chamado para enviar");
        }

        // Para mltiplos tickets, usar API
        if (selectedIds.length > 1) {
          const response = await apiRequest("POST", "/api/reports/send-whatsapp", {
            ids: selectedIds,
            mode: "click-to-chat", // ou "extension" ou "business_api"
          });

          if (!response.ok) {
            throw new Error("Erro ao preparar envio via WhatsApp");
          }

          const data = await response.json();
          if (data.urls && data.urls.length > 0) {
            // Abrir todas as URLs do WhatsApp
            data.urls.forEach((url: string) => {
              window.open(url, "_blank");
            });
          }
        } else {
          // Para um nico ticket, usar click-to-chat direto
          const ticket = tickets[0];
          const phone = ticket.client.phone.replace(/\D/g, "");
          if (!phone) {
            throw new Error("Cliente no possui telefone cadastrado");
          }

          const total = ticket.totalAmount
            ? Number(ticket.totalAmount)
            : (ticket.ticketValue ? Number(ticket.ticketValue) : 0) +
              (ticket.kmTotal && ticket.kmRate
                ? Number(ticket.kmTotal) * Number(ticket.kmRate)
                : 0) +
              (ticket.extraExpenses ? Number(ticket.extraExpenses) : 0);

          const message = `Ol ${ticket.client.name || "Cliente"}, envio cobrana do chamado #${ticket.id.slice(0, 8)} — R$ ${total.toFixed(2).replace(".", ",")}. Pague aqui: [link] (Vence em ${ticket.paymentDate || "N/A"}). Obrigado — ChamadosPro`;

          const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, "_blank");
        }
        break;
      }
    }
  } catch (error: any) {
    console.error("Erro na exportao:", error);
    throw error;
  }
}

// Funo para gerar CSV localmente (fallback)
export function exportToCSV(tickets: Ticket[], filename: string = "relatorio.csv"): void {
  const headers = [
    "ID",
    "Cliente",
    "CPF/CNPJ",
    "Telefone",
    "Email",
    "Data Abertura",
    "Data Fechamento",
    "Descrio",
    "Valor",
    "Descontos",
    "Taxas",
    "Mtodo",
    "Status",
    "Observaes",
  ];

  const rows = tickets.map((ticket) => {
    const total = ticket.totalAmount
      ? Number(ticket.totalAmount)
      : (ticket.ticketValue ? Number(ticket.ticketValue) : 0) +
        (ticket.kmTotal && ticket.kmRate ? Number(ticket.kmTotal) * Number(ticket.kmRate) : 0) +
        (ticket.extraExpenses ? Number(ticket.extraExpenses) : 0);

    return [
      ticket.id,
      ticket.client.name || "",
      "", // CPF/CNPJ - precisa buscar do cliente
      ticket.client.phone || "",
      "", // Email - precisa buscar do cliente
      ticket.scheduledFor,
      ticket.completedAt || "",
      ticket.description || "",
      total.toFixed(2),
      "0.00",
      "0.00",
      "", // Mtodo
      ticket.status,
      "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  // Adicionar BOM para UTF-8
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Funo para imprimir
export function printReports(tickets: Ticket[]): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast({
      variant: "destructive",
      title: "Pop-up bloqueado",
      description: "Por favor, permita pop-ups para imprimir.",
    });
    return;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return "Data invlida";
    }
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatrio de Chamados</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #000;
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        .ticket {
          page-break-inside: avoid;
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #ddd;
        }
        .ticket-header {
          font-weight: bold;
          margin-bottom: 10px;
        }
        @media print {
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <h1>Relatrio de Chamados</h1>
      <p><strong>Gerado em:</strong> ${new Date().toLocaleString("pt-BR")}</p>
      <p><strong>Total de chamados:</strong> ${tickets.length}</p>
      
      ${tickets
        .map((ticket) => {
          const total = ticket.totalAmount
            ? Number(ticket.totalAmount)
            : (ticket.ticketValue ? Number(ticket.ticketValue) : 0) +
              (ticket.kmTotal && ticket.kmRate
                ? Number(ticket.kmTotal) * Number(ticket.kmRate)
                : 0) +
              (ticket.extraExpenses ? Number(ticket.extraExpenses) : 0);

          return `
            <div class="ticket">
              <div class="ticket-header">
                Chamado #${ticket.id.slice(0, 8)} - ${ticket.client.name || "Cliente"}
              </div>
              <table>
                <tr>
                  <th>Data Abertura</th>
                  <td>${formatDate(ticket.scheduledFor)}</td>
                  <th>Data Fechamento</th>
                  <td>${formatDate(ticket.completedAt)}</td>
                </tr>
                <tr>
                  <th>Servio</th>
                  <td>${ticket.service.name || "N/A"}</td>
                  <th>Status</th>
                  <td>${ticket.status}</td>
                </tr>
                <tr>
                  <th>Valor Total</th>
                  <td colspan="3"><strong>${formatCurrency(total)}</strong></td>
                </tr>
                  ${ticket.description ? `<tr><th>Descrio</th><td colspan="3">${ticket.description}</td></tr>` : ""}
              </table>
            </div>
          `;
        })
        .join("")}
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}





































