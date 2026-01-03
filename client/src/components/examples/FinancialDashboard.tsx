import { FinancialDashboard } from '../financial-dashboard';

export default function FinancialDashboardExample() {
  // TODO: remove mock functionality
  const mockCashFlow = [
    { date: "01/11", value: 4500 },
    { date: "05/11", value: 7200 },
    { date: "10/11", value: 6800 },
    { date: "15/11", value: 9500 },
    { date: "20/11", value: 8200 },
    { date: "25/11", value: 12450 }
  ];

  const mockReceivables = [
    {
      id: "1",
      clientName: "Joo Silva",
      amount: 1500,
      dueDate: new Date(2025, 10, 20),
      status: "pending" as const
    },
    {
      id: "2",
      clientName: "Empresa XYZ Ltda",
      amount: 5500,
      dueDate: new Date(2025, 10, 10),
      status: "overdue" as const
    },
    {
      id: "3",
      clientName: "Maria Santos",
      amount: 2200,
      dueDate: new Date(2025, 10, 25),
      status: "pending" as const
    }
  ];

  return (
    <div className="p-6">
      <FinancialDashboard cashFlowData={mockCashFlow} receivables={mockReceivables} />
    </div>
  );
}
