import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fetchCnpjData } from '@/services/CnpjService';
import { Plus, Minus } from 'lucide-react';
import { maskCNPJ, maskCurrency, unmaskCNPJ } from '@/lib/masks';

export default function CadastroClienteParceiro3() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    companyName: 'Empresa Exemplo Ltda.',
    tradeName: 'Parceiro Exemplo',
    cnpj: '12.345.678/0001-90',
    stateRegistration: '123.456.789.112',
    defaultTicketValue: 'R$ 150,00',
    defaultHoursIncluded: '2',
    defaultAdditionalHourRate: 'R$ 75,00',
    defaultKmRate: 'R$ 2,50',
    monthlySpreadsheetEnabled: true,
    monthlySpreadsheetEmail: 'financeiro@empresaexemplo.com',
    monthlySpreadsheetDay: '10',
    noShowCount: 1,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest(
        'PUT',
        '/api/clients/partner/:id',
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar cliente parceiro');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: 'Cliente parceiro atualizado',
        description: 'Os dados foram atualizados com sucesso.',
      });
      setLocation('/clientes');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar cliente parceiro',
        description: error.message,
      });
    },
  });

  const handleCnpjBlur = async () => {
    const cleanCnpj = unmaskCNPJ(formData.cnpj || '');
    if (cleanCnpj.length !== 14) {
      return;
    }
    try {
      const data = await fetchCnpjData(cleanCnpj);
      if (!data) {
        return;
      }
      setFormData((prev) => {
        const updated = { ...prev };
        if (!prev.companyName || prev.companyName.trim() === '') {
          updated.companyName = data.razao_social || prev.companyName;
        }
        if (!prev.tradeName || prev.tradeName.trim() === '') {
          updated.tradeName = data.nome_fantasia || data.razao_social || prev.tradeName;
        }
        return updated;
      });
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display overflow-x-hidden'>
      <div className='flex h-full grow'>
        <main className='flex-1 p-8 overflow-y-auto'>
          <div className='max-w-4xl mx-auto'>
            <div className='flex flex-wrap justify-between gap-3 mb-8'>
              <div className='flex flex-col gap-2'>
                <h1 className='text-[#111418] dark:text-white text-3xl font-bold leading-tight tracking-tight'>
                  Cadastro/Edição de Cliente Parceiro
                </h1>
                <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
                  Preencha ou edite os dados da empresa parceira.
                </p>
              </div>
            </div>
            <Card className='bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-8 space-y-8'>
              <form onSubmit={handleSubmit} className='space-y-8'>
                {/* Dados da Empresa */}
                <div className='space-y-6'>
                  <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                    Dados da Empresa
                  </h3>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Razão Social
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='Insira a razão social'
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            companyName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Nome Fantasia
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='Insira o nome fantasia'
                        value={formData.tradeName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tradeName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        CNPJ
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='00.000.000/0000-00'
                        value={formData.cnpj}
                        onBlur={handleCnpjBlur}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cnpj: maskCNPJ(e.target.value),
                          })
                        }
                        required
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Inscrição Estadual
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='Insira a inscrição estadual'
                        value={formData.stateRegistration}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stateRegistration: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Condições de Serviço */}
                <div className='space-y-6'>
                  <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                    Condições de Serviço
                  </h3>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Valor padrão do chamado
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='R$ 0,00'
                        value={formData.defaultTicketValue}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultTicketValue: maskCurrency(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Horas incluídas no valor padrão
                      </Label>
                      <Input
                        type='number'
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='0'
                        value={formData.defaultHoursIncluded}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultHoursIncluded: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Valor por hora adicional
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='R$ 0,00'
                        value={formData.defaultAdditionalHourRate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultAdditionalHourRate: maskCurrency(
                              e.target.value
                            ),
                          })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Valor por KM
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                        placeholder='R$ 0,00'
                        value={formData.defaultKmRate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultKmRate: maskCurrency(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Planilha Mensal */}
                <div className='space-y-6'>
                  <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                    Planilha Mensal
                  </h3>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col'>
                      <p className='text-[#111418] dark:text-white font-medium'>
                        Ativar Planilha Mensal
                      </p>
                      <p className='text-sm text-[#60708a] dark:text-gray-400'>
                        Envia um relatório mensal para o email configurado.
                      </p>
                    </div>
                    <Switch
                      checked={formData.monthlySpreadsheetEnabled}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          monthlySpreadsheetEnabled: checked,
                        })
                      }
                    />
                  </div>
                  {formData.monthlySpreadsheetEnabled && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                      <div className='flex flex-col'>
                        <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                          Email para envio
                        </Label>
                        <Input
                          type='email'
                          className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                          placeholder='contato@empresa.com'
                          value={formData.monthlySpreadsheetEmail}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              monthlySpreadsheetEmail: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className='flex flex-col'>
                        <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                          Dia do mês para envio
                        </Label>
                        <Input
                          type='number'
                          min='1'
                          max='31'
                          className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                          placeholder='Ex: 5'
                          value={formData.monthlySpreadsheetDay}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              monthlySpreadsheetDay: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Informações Adicionais */}
                <div className='space-y-6'>
                  <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                    Informações Adicionais
                  </h3>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                        Contador de No-Shows
                      </Label>
                      <div className='flex items-center justify-between h-12 px-4 rounded-lg bg-gray-100 dark:bg-gray-800'>
                        <span className='text-[#111418] dark:text-white font-medium'>
                          {formData.noShowCount}
                        </span>
                        <div className='flex items-center gap-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='flex items-center justify-center size-7 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            onClick={() =>
                              setFormData({
                                ...formData,
                                noShowCount: Math.max(
                                  0,
                                  formData.noShowCount - 1
                                ),
                              })
                            }
                          >
                            <Minus className='w-4 h-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='flex items-center justify-center size-7 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            onClick={() =>
                              setFormData({
                                ...formData,
                                noShowCount: formData.noShowCount + 1,
                              })
                            }
                          >
                            <Plus className='w-4 h-4' />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className='flex justify-end gap-4 pt-6 border-t dark:border-gray-700'>
                  <Button
                    type='button'
                    variant='outline'
                    className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
                    onClick={() => setLocation('/clientes')}
                  >
                    <span className='truncate'>Cancelar</span>
                  </Button>
                  <Button
                    type='submit'
                    className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
                    disabled={updateMutation.isPending}
                  >
                    <span className='truncate'>
                      {updateMutation.isPending
                        ? 'Salvando...'
                        : 'Salvar Alterações'}
                    </span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
























