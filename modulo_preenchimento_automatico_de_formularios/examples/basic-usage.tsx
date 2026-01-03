/**
 * Exemplo básico de uso do módulo de preenchimento automático
 * 
 * Este exemplo mostra como usar o módulo em um componente React
 */

import { useState } from 'react';
import { TextParser, processImageOCR, validateImageFile } from '../src';

interface FormData {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function ClientFormExample() {
  const [formData, setFormData] = useState<FormData>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawText, setRawText] = useState('');

  // Inicializa o parser
  const parser = new TextParser({
    autoFetchCep: true,
    autoFetchCnpj: true,
    debug: false,
  });

  // Processar texto colado
  const handleTextPaste = async (text: string) => {
    setRawText(text);
    setIsProcessing(true);
    
    try {
      const extracted = await parser.parse(text);
      setFormData((prev) => ({ ...prev, ...extracted }));
    } catch (error) {
      console.error('Erro ao processar texto:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Processar imagem (OCR)
  const handleImageUpload = async (file: File) => {
    // Valida arquivo
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setIsProcessing(true);
    
    try {
      // Processa imagem com OCR
      const ocrResult = await processImageOCR(file, { language: 'por' });
      
      // Parse do texto extraído
      const extracted = await parser.parse(ocrResult.text);
      setFormData((prev) => ({ ...prev, ...extracted }));
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Cadastro de Cliente</h2>

      {/* Campo de texto */}
      <div className="form-group">
        <label>Cole o texto aqui:</label>
        <textarea
          value={rawText}
          onChange={(e) => handleTextPaste(e.target.value)}
          placeholder="Cole aqui o texto copiado de documentos, emails, etc."
          rows={10}
          disabled={isProcessing}
        />
      </div>

      {/* Upload de imagem */}
      <div className="form-group">
        <label>Ou faça upload de uma imagem:</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
          }}
          disabled={isProcessing}
        />
      </div>

      {isProcessing && <p>Processando...</p>}

      {/* Campos do formulário */}
      <div className="form-fields">
        <div className="form-group">
          <label>Nome:</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Telefone:</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>CPF:</label>
          <input
            type="text"
            value={formData.cpf || ''}
            onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>CNPJ:</label>
          <input
            type="text"
            value={formData.cnpj || ''}
            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>CEP:</label>
          <input
            type="text"
            value={formData.cep || ''}
            onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Endereço:</label>
          <input
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Número:</label>
          <input
            type="text"
            value={formData.addressNumber || ''}
            onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Complemento:</label>
          <input
            type="text"
            value={formData.addressComplement || ''}
            onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Bairro:</label>
          <input
            type="text"
            value={formData.neighborhood || ''}
            onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Cidade:</label>
          <input
            type="text"
            value={formData.city || ''}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Estado:</label>
          <input
            type="text"
            value={formData.state || ''}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
        </div>
      </div>

      <button type="submit" disabled={isProcessing}>
        Salvar
      </button>
    </div>
  );
}

