import { TicketList } from "../ticket-list";

export default function TicketListExample() {
  // TODO: remover mock assim que integrao com API estiver pronta
  const mockTickets = [
    {
      id: "1",
      scheduledFor: new Date(2025, 10, 15, 14, 0).toISOString(),
      status: "pending" as const,
      client: {
        name: "Joo Silva",
        type: "PF" as const,
      },
      service: {
        name: "Manuteno Preventiva",
      },
    },
    {
      id: "2",
      scheduledFor: new Date(2025, 10, 16, 9, 0).toISOString(),
      status: "in-progress" as const,
      client: {
        name: "Empresa XYZ Ltda",
        type: "PJ" as const,
      },
      service: {
        name: "Instalao de Servidores",
      },
    },
    {
      id: "3",
      scheduledFor: new Date(2025, 10, 14, 16, 30).toISOString(),
      status: "completed" as const,
      client: {
        name: "Maria Santos",
        type: "PF" as const,
      },
      service: {
        name: "Reparo de Equipamento",
      },
    },
  ];

  return (
    <div className="p-6">
      <TicketList tickets={mockTickets} />
    </div>
  );
}
