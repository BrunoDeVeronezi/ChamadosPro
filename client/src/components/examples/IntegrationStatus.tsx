import { IntegrationStatus } from '../integration-status';
import { Calendar } from 'lucide-react';

export default function IntegrationStatusExample() {
  // TODO: remove mock functionality
  const mockIntegrations = [
    {
      name: "Google Calendar",
      status: "connected" as const,
      icon: Calendar,
      description: "Sincronizao automtica de agendamentos"
    },
    {
      name: "WhatsApp Business",
      status: "not_connected" as const,
      icon: Calendar,
      description: "Envio automtico de lembretes"
    }
  ];

  return (
    <div className="p-6 max-w-2xl">
      <IntegrationStatus integrations={mockIntegrations} />
    </div>
  );
}
