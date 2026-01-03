import { CalendarView } from "../calendar-view";

const now = new Date();

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export default function CalendarViewExample() {
  // TODO: remover mock assim que integrao com API estiver pronta
  const mockTickets = [
    {
      id: "1",
      userId: "demo-user",
      clientId: "client-1",
      status: "ABERTO" as const,
      scheduledDate: now.toISOString(),
      scheduledTime: "09:00",
      duration: 3,
      date: now,
      client: {
        id: "client-1",
        name: "Joo Silva",
        type: "PF" as const,
        userId: "demo-user",
        email: "joao@example.com",
        phone: "+5511999999999",
        city: "So Paulo",
        state: "SP",
      },
      service: {
        id: "service-1",
        userId: "demo-user",
        name: "Manuteno",
        price: "0",
        duration: 3,
        active: true,
        publicBooking: true,
        createdAt: now,
      },
    },
    {
      id: "2",
      userId: "demo-user",
      clientId: "client-2",
      status: "EXECUCAO" as const,
      scheduledDate: addDays(now, 1).toISOString(),
      scheduledTime: "14:00",
      duration: 2,
      date: addDays(now, 1),
      client: {
        id: "client-2",
        name: "Empresa XYZ",
        type: "PJ" as const,
        userId: "demo-user",
        email: "contato@xyz.com",
        phone: "+5511988887777",
        city: "Campinas",
        state: "SP",
      },
      service: {
        id: "service-2",
        userId: "demo-user",
        name: "Instalao",
        price: "0",
        duration: 2,
        active: true,
        publicBooking: true,
        createdAt: addDays(now, -3),
      },
    },
  ];

  return (
    <div className="p-6">
      <CalendarView tickets={mockTickets as any} />
    </div>
  );
}
