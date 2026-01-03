import { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import {
  maskCPF,
  maskCNPJ,
  unmaskCPF,
  unmaskCNPJ,
  maskPhone,
} from '@/lib/masks';
import { slugify } from '@/lib/slugify';

export default function CompletarCadastro() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Estados principais
  const [document, setDocument] = useState('');
  const [documentType, setDocumentType] = useState<'cpf' | 'cnpj' | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [fieldsUnlocked, setFieldsUnlocked] = useState(false);

  // Estados dos campos (preenchidos dinamicamente)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');

  // Estados de endereço (aparecem dinamicamente)
  const [zipCode, setZipCode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Estados para campos Asaas
  const [birthDate, setBirthDate] = useState(''); // Data de nascimento (para CPF)
  const [companyType, setCompanyType] = useState('MEI'); // Tipo de empresa (para CNPJ)
  const [incomeValue, setIncomeValue] = useState('5000'); // Renda mensal/faturamento

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Detectar tipo de documento e aplicar máscara
  const handleDocumentChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length <= 11) {
      setDocumentType('cpf');
      setDocument(maskCPF(cleanValue));
    } else {
      setDocumentType('cnpj');
      setDocument(maskCNPJ(cleanValue));
    }
  };

  // Consultar API ao sair do campo de documento
  const handleDocumentBlur = async () => {
    const cleanDoc = document.replace(/\D/g, '');

    // Validar tamanho mínimo
    if (cleanDoc.length < 11) {
      return; // Não consultar se não tiver tamanho válido
    }

    // Liberar campos após validar tamanho mínimo
    setFieldsUnlocked(true);

    // Se for CNPJ completo (14 dígitos), fazer consulta automática
    if (cleanDoc.length === 14 && documentType === 'cnpj') {
      setIsConsulting(true);
      setError(null);

      try {
        const response = await apiRequest(
          'GET',
          `/api/document/${cleanDoc}`,
          undefined
        );
        const data = (await response.json()) as any;

        console.log('[CompletarCadastro] Dados recebidos da API:', data);

        // Preencher campos da empresa
        if (data.companyName) {
          setCompanyName(data.companyName);
        } else if (data.tradeName) {
          setCompanyName(data.tradeName);
        }

        // Preencher telefone
        if (data.phone) {
          setPhone(data.phone);
        }

        // Preencher endereço
        if (data.address) {
          if (data.address.zipCode) setZipCode(data.address.zipCode);
          if (data.address.street) setStreetAddress(data.address.street);
          if (data.address.number) setAddressNumber(data.address.number);
          if (data.address.complement)
            setAddressComplement(data.address.complement);
          if (data.address.neighborhood)
            setNeighborhood(data.address.neighborhood);
          if (data.address.city) setCity(data.address.city);
          if (data.address.state) setState(data.address.state);
        }
      } catch (err: any) {
        console.error('[CompletarCadastro] Erro ao consultar documento:', err);
        // Não mostrar erro se o documento não foi encontrado (usuário pode preencher manualmente)
        if (err?.status !== 404) {
          setError(
            'Erro ao consultar documento. Você pode preencher os dados manualmente.'
          );
        }
      } finally {
        setIsConsulting(false);
      }
    } else if (cleanDoc.length === 11 && documentType === 'cpf') {
      // Para CPF, apenas liberar campos (não fazer consulta automática por enquanto)
      setIsConsulting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanDoc = document.replace(/\D/g, '');
      const cleanPhone = phone.replace(/\D/g, '');

      if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        setError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
        setLoading(false);
        return;
      }

      // Validar campos obrigatórios
      if (!firstName.trim()) {
        setError('Nome é obrigatório');
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        setError('Sobrenome é obrigatório');
        setLoading(false);
        return;
      }
      if (!companyName.trim()) {
        setError('Nome da empresa é obrigatório');
        setLoading(false);
        return;
      }
      if (!cleanPhone || cleanPhone.length < 10) {
        setError('Telefone é obrigatório e deve ter pelo menos 10 dígitos');
        setLoading(false);
        return;
      }
      if (!zipCode.trim()) {
        setError('CEP é obrigatório');
        setLoading(false);
        return;
      }
      if (!streetAddress.trim()) {
        setError('Logradouro é obrigatório');
        setLoading(false);
        return;
      }
      if (!addressNumber.trim()) {
        setError('Número é obrigatório');
        setLoading(false);
        return;
      }
      if (!neighborhood.trim()) {
        setError('Bairro é obrigatório');
        setLoading(false);
        return;
      }
      if (!city.trim()) {
        setError('Cidade é obrigatória');
        setLoading(false);
        return;
      }
      if (!state.trim() || state.length !== 2) {
        setError('Estado (UF) é obrigatório e deve ter 2 caracteres');
        setLoading(false);
        return;
      }

      // Validar campos específicos do Asaas
      if (documentType === 'cpf' && !birthDate) {
        setError('Data de nascimento é obrigatória para CPF');
        setLoading(false);
        return;
      }

      if (documentType === 'cnpj' && !companyType) {
        setError('Tipo de empresa é obrigatório para CNPJ');
        setLoading(false);
        return;
      }

      // Validar incomeValue
      const incomeValueNum = parseFloat(incomeValue);
      if (isNaN(incomeValueNum) || incomeValueNum <= 0) {
        setError(
          'Renda mensal/faturamento deve ser um valor válido maior que zero'
        );
        setLoading(false);
        return;
      }

      // Gerar tenantSlug baseado no nome da empresa
      const tenantSlug = companyName ? slugify(companyName) : undefined;

      await apiRequest('POST', '/api/profile/complete', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        tenantSlug: tenantSlug,
        phone: cleanPhone,
        cpf: documentType === 'cpf' ? cleanDoc : undefined,
        cnpj: documentType === 'cnpj' ? cleanDoc : undefined,
        birthDate: documentType === 'cpf' ? birthDate : undefined,
        companyType: documentType === 'cnpj' ? companyType : undefined,
        incomeValue: incomeValueNum,
        // Endereço
        zipCode: zipCode.trim(),
        streetAddress: streetAddress.trim(),
        addressNumber: addressNumber.trim(),
        addressComplement: addressComplement.trim() || undefined,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
      });

      setSuccess('Cadastro completo! Redirecionando...');
      setTimeout(() => navigate('/'), 800);
    } catch (err: any) {
      setError(err?.message || 'Erro ao completar cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4 py-8'>
      <Card className='w-full max-w-2xl'>
        <CardHeader>
          <CardTitle>Completar cadastro</CardTitle>
          <p className='text-sm text-muted-foreground'>
            Preencha todos os campos obrigatórios (*) para completar seu
            cadastro. Seu email já está associado à conta.
          </p>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={handleSubmit}>
            {/* Campo CPF/CNPJ - primeiro e único campo inicial */}
            <div>
              <Label htmlFor='document'>CPF ou CNPJ *</Label>
              <Input
                id='document'
                value={document}
                onChange={(e) => handleDocumentChange(e.target.value)}
                onBlur={handleDocumentBlur}
                placeholder='Digite CPF ou CNPJ'
                required
                disabled={isConsulting}
                autoFocus
              />
              {isConsulting && (
                <p className='text-xs text-muted-foreground mt-1'>
                  Consultando dados...
                </p>
              )}
              {documentType && (
                <p className='text-xs text-muted-foreground mt-1'>
                  Tipo detectado: {documentType.toUpperCase()}
                </p>
              )}
            </div>

            {/* Campos que aparecem após clicar fora do CPF/CNPJ */}
            {fieldsUnlocked && (
              <>
                {/* Dados pessoais - aparecem para CPF e CNPJ */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='firstName'>Nome *</Label>
                    <Input
                      id='firstName'
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder='Seu nome'
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor='lastName'>Sobrenome *</Label>
                    <Input
                      id='lastName'
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder='Seu sobrenome'
                      required
                    />
                  </div>
                </div>

                {/* Nome da empresa - pode ser alterado e vira slug */}
                <div>
                  <Label htmlFor='companyName'>Nome da empresa *</Label>
                  <Input
                    id='companyName'
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder='Minha Empresa LTDA'
                    required
                  />
                  {companyName && (
                    <p className='text-xs text-muted-foreground mt-1'>
                      Seu sistema estará disponível em: www.clicksync.com.br/
                      {slugify(companyName)}
                    </p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <Label htmlFor='phone'>Telefone (com DDD) *</Label>
                  <Input
                    id='phone'
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder='(00) 00000-0000'
                    required
                  />
                </div>

                {/* Campos de endereço - aparecem sempre após desbloquear */}
                <div className='space-y-4 border-t pt-4'>
                  <h3 className='text-sm font-medium'>Endereço</h3>

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                    <div>
                      <Label htmlFor='zipCode'>CEP *</Label>
                      <Input
                        id='zipCode'
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder='00000-000'
                        required
                      />
                    </div>
                    <div className='sm:col-span-2'>
                      <Label htmlFor='streetAddress'>Logradouro *</Label>
                      <Input
                        id='streetAddress'
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder='Rua, Avenida, etc.'
                        required
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                    <div>
                      <Label htmlFor='addressNumber'>Número *</Label>
                      <Input
                        id='addressNumber'
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder='123'
                        required
                      />
                    </div>
                    <div className='sm:col-span-2'>
                      <Label htmlFor='addressComplement'>Complemento</Label>
                      <Input
                        id='addressComplement'
                        value={addressComplement}
                        onChange={(e) => setAddressComplement(e.target.value)}
                        placeholder='Apto, Sala, etc.'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                    <div>
                      <Label htmlFor='neighborhood'>Bairro *</Label>
                      <Input
                        id='neighborhood'
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder='Bairro'
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor='city'>Cidade *</Label>
                      <Input
                        id='city'
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder='Cidade'
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor='state'>Estado (UF) *</Label>
                      <Input
                        id='state'
                        value={state}
                        onChange={(e) => setState(e.target.value.toUpperCase())}
                        placeholder='SP'
                        maxLength={2}
                        required
                      />
                    </div>
                  </div>

                  {/* Campos específicos do Asaas */}
                  {documentType === 'cpf' && (
                    <div>
                      <Label htmlFor='birthDate'>Data de Nascimento *</Label>
                      <Input
                        id='birthDate'
                        type='date'
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                        max={new Date().toISOString().split('T')[0]}
                      />
                      <p className='text-xs text-muted-foreground mt-1'>
                        Obrigatório para CPF (criação de subconta Asaas)
                      </p>
                    </div>
                  )}

                  {documentType === 'cnpj' && (
                    <div>
                      <Label htmlFor='companyType'>Tipo de Empresa *</Label>
                      <select
                        id='companyType'
                        value={companyType}
                        onChange={(e) => setCompanyType(e.target.value)}
                        className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                        required
                      >
                        <option value='MEI'>
                          MEI (Microempreendedor Individual)
                        </option>
                        <option value='EIRELI'>EIRELI</option>
                        <option value='LTDA'>LTDA (Sociedade Limitada)</option>
                        <option value='SA'>SA (Sociedade Anônima)</option>
                        <option value='EPP'>
                          EPP (Empresa de Pequeno Porte)
                        </option>
                      </select>
                      <p className='text-xs text-muted-foreground mt-1'>
                        Obrigatório para CNPJ (criação de subconta Asaas)
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor='incomeValue'>
                      Renda Mensal/Faturamento (R$) *
                    </Label>
                    <Input
                      id='incomeValue'
                      type='number'
                      min='0'
                      step='100'
                      value={incomeValue}
                      onChange={(e) => setIncomeValue(e.target.value)}
                      placeholder='5000'
                      required
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      Obrigatório para criação de subconta Asaas. Valor em reais
                      (ex: 5000 = R$ 5.000,00)
                    </p>
                  </div>
                </div>
              </>
            )}

            {error && (
              <Alert variant='destructive'>
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertTitle>Sucesso</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <Button
              type='submit'
              className='w-full'
              disabled={loading || isConsulting || !fieldsUnlocked}
            >
              {loading ? 'Salvando...' : 'Salvar e continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
