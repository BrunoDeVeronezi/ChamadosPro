import { PublicBooking } from '../public-booking';

export default function PublicBookingExample() {
  // TODO: remove mock functionality
  const mockServices = [
    {
      id: "1",
      name: "Manuteno Preventiva",
      price: 350,
      duration: 3,
      description: "Servio completo de manuteno preventiva em equipamentos de TI"
    },
    {
      id: "2",
      name: "Reparo de Equipamento",
      price: 200,
      duration: 2,
      description: "Diagnstico e reparo de equipamentos com defeito"
    },
    {
      id: "3",
      name: "Instalao de Software",
      price: 150,
      duration: 1,
      description: "Instalao e configurao de sistemas e aplicativos"
    },
    {
      id: "4",
      name: "Consultoria Tcnica",
      price: 500,
      duration: 4,
      description: "Consultoria especializada em infraestrutura de TI"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <PublicBooking services={mockServices} />
    </div>
  );
}
