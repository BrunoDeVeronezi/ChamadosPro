import { ClientList } from '../client-list';

export default function ClientListExample() {
  // TODO: remove mock functionality
  const mockClients = [
    {
      id: "1",
      name: "Joo Silva",
      type: "PF" as const,
      email: "joao.silva@email.com",
      phone: "(11) 98765-4321",
      city: "So Paulo",
      state: "SP"
    },
    {
      id: "2",
      name: "Empresa XYZ Ltda",
      type: "PJ" as const,
      email: "contato@empresaxyz.com.br",
      phone: "(11) 3456-7890",
      city: "Rio de Janeiro",
      state: "RJ"
    },
    {
      id: "3",
      name: "Maria Santos",
      type: "PF" as const,
      email: "maria.santos@email.com",
      phone: "(21) 99876-5432",
      city: "Belo Horizonte",
      state: "MG"
    }
  ];

  return (
    <div className="p-6">
      <ClientList clients={mockClients} />
    </div>
  );
}
