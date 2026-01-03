/**
 * Parser de Texto Inteligente
 * 
 * Extrai dados estruturados de texto não formatado usando sistema de scoring
 * e detecção multi-camadas.
 */

import { ExtractedFormData, TextParserOptions, CepResponse, CnpjResponse } from '../types';
import { fetchCepData } from '../services/CepService';
import { fetchCnpjData } from '../services/CnpjService';

/**
 * Classe principal para parsing de texto
 */
export class TextParser {
  private options: Required<TextParserOptions>;
  private ignoredTerms: string[];
  private addressRelatedTerms: string[];

  constructor(options: TextParserOptions = {}) {
    this.options = {
      autoFetchCep: options.autoFetchCep ?? true,
      autoFetchCnpj: options.autoFetchCnpj ?? true,
      onCepDetected: options.onCepDetected ?? fetchCepData,
      onCnpjDetected: options.onCnpjDetected ?? fetchCnpjData,
      debug: options.debug ?? false,
    };

    // Termos ignorados (labels, seções)
    this.ignoredTerms = [
      'cliente', 'dados de contato', 'dados', 'contato',
      'informações fiscais', 'informações', 'fiscais',
      'endereço', 'endereco', 'nome', 'e-mail', 'email',
      'telefone', 'cpf', 'cnpj', 'cep', 'rua / logradouro',
      'rua/logradouro', 'rua logradouro', 'rua', 'logradouro',
      'número', 'numero', 'nº', 'n░', 'complemento',
      'bairro / distrito', 'bairro/distrito', 'bairro', 'distrito',
      'cidade', 'uf / estado', 'uf/estado', 'uf', 'estado',
      'município', 'municipio',
    ];

    // Termos relacionados a endereço (para blindagem)
    this.addressRelatedTerms = [
      'torre', 'apto', 'apartamento', 'bloco', 'sala', 'andar',
      'casa', 'lote', 'quadra', 'avenida', 'rua', 'estrada',
      'rodovia', 'praça', 'travessa', 'alameda', 'viela',
      'passagem', 'logradouro', 'protásio', 'protasio', 'alves',
      'morro', 'santana', 'porto', 'alegre',
    ];
  }

  /**
   * Verifica se uma linha é um termo ignorado
   */
  private isIgnoredTerm(line: string): boolean {
    const normalized = line.toLowerCase().trim();
    return this.ignoredTerms.some((term) => {
      return (
        normalized === term ||
        normalized === `${term}:` ||
        normalized === `${term}-` ||
        normalized.match(
          new RegExp(
            `^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\-]?$`,
            'i'
          )
        )
      );
    });
  }

  /**
   * Verifica se uma linha contém termos de endereço
   */
  private containsAddressTerms(line: string): boolean {
    const normalized = line.toLowerCase();
    return this.addressRelatedTerms.some((term) => normalized.includes(term));
  }

  /**
   * Limpa e normaliza o texto
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  /**
   * Extrai email do texto
   */
  private extractEmail(text: string): string | null {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  /**
   * Extrai telefone do texto
   */
  private extractPhone(text: string): string | null {
    const digits = text.replace(/\D/g, '');
    const match = digits.match(/(\d{10,13})/);
    return match ? match[0] : null;
  }

  /**
   * Extrai CPF ou CNPJ do texto
   */
  private extractDocument(text: string): { cpf?: string; cnpj?: string } {
    const cpfMatch = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    const cnpjMatch = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
    
    return {
      cpf: cpfMatch ? cpfMatch[0] : undefined,
      cnpj: cnpjMatch ? cnpjMatch[0] : undefined,
    };
  }

  /**
   * Extrai CEP do texto
   */
  private extractCep(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Procura por label "CEP" seguido de valor
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.match(/^(?:cep)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.match(/^\d{5}-?\d{3}$/)) {
            return nextLine;
          }
        }
      }
    }

    // PRIORIDADE 1: Regex no texto completo
    const match =
      text.match(/\b(?:cep)[:\-]?\s*(\d{5}-?\d{3})\b/i)?.[1] ||
      text.match(/\b(\d{5}-?\d{3})\b/)?.[1] ||
      text.match(/\b(\d{8})\b/)?.[1];

    return match ? match.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : null;
  }

  /**
   * Calcula score para detecção de nome próprio
   */
  private calculateNameScore(line: string, index: number, lines: string[]): number {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) return 0;

    let score = 0;
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 2) return 0;

    // Bonus por múltiplas palavras
    score += words.length * 5;

    // Bonus por palavras com maiúscula
    const wordsWithCapital = words.filter((word) => /[A-ZÀ-ÁÂÃÉÊÍÓÔÕÚÇ]/.test(word[0]));
    const capitalRatio = wordsWithCapital.length / words.length;
    score += capitalRatio * 30;

    // Deve ter pelo menos 70% de letras
    const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
    const letterRatio = letterCount / trimmed.length;
    if (letterRatio < 0.7) return 0;
    score += letterRatio * 20;

    // Penalidades
    if (this.containsAddressTerms(trimmed)) return 0;
    if (this.isIgnoredTerm(trimmed)) return 0;
    if (/\d{2,}/.test(trimmed)) score -= 50;
    if (trimmed.includes('@')) return 0;
    if (/^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(trimmed)) return 0;
    if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed)) return 0;
    if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(trimmed)) return 0;
    if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0;

    // Bonus por contexto
    if (index < 5) score += 15;
    if (index > 0) {
      const prevLine = lines[index - 1].toLowerCase().trim();
      if (prevLine.match(/^(?:cliente|dados de contato|informações fiscais)$/)) {
        score += 20;
      } else if (prevLine.match(/^(?:nome)[:\-]?$/)) {
        score += 50;
      } else if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep)/)) {
        score -= 100;
      }
    }

    return score;
  }

  /**
   * Extrai Nome Fantasia do texto
   */
  private extractFantasyName(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Detecção direta quando encontra label "Nome fantasia"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');
      const isNomeFantasiaLabel =
        normalizedLine === 'nome fantasia' ||
        normalizedLine === 'nome fantasia:' ||
        normalizedLine === 'nome fantasia-' ||
        normalizedLine.match(/^(?:nome\s*fantasia)[:\-]?$/i);

      if (isNomeFantasiaLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          nextLine.length >= 3 &&
          !this.isIgnoredTerm(nextLine) &&
          !nextLine.match(
            /^(?:razão\s*social|razao\s*social|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          if (this.options.debug) {
            console.log('[TextParser] Nome fantasia detectado:', nextLine);
          }
          return nextLine;
        }
      }
    }

    // PRIORIDADE 1: Regex no texto completo
    const patterns = [
      /(?:nome\s*fantasia)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+?)(?:\s*\n|$)/i,
      /(?:nome\s*fantasia)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        const candidate = match[1].trim();
        if (
          candidate.length >= 3 &&
          !this.isIgnoredTerm(candidate) &&
          !candidate.match(
            /^(?:razão\s*social|razao\s*social|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          /[A-Za-zÀ-ÿ]/.test(candidate)
        ) {
          if (this.options.debug) {
            console.log('[TextParser] Nome fantasia detectado por regex:', candidate);
          }
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Extrai Razão Social do texto
   */
  private extractLegalName(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Detecção direta quando encontra label "Razão social"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');
      const isRazaoSocialLabel =
        normalizedLine === 'razão social' ||
        normalizedLine === 'razao social' ||
        normalizedLine === 'razão social:' ||
        normalizedLine === 'razao social:' ||
        normalizedLine === 'razão social-' ||
        normalizedLine === 'razao social-' ||
        normalizedLine.match(/^(?:razão\s*social|razao\s*social)[:\-]?$/i);

      if (isRazaoSocialLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          nextLine.length >= 3 &&
          !this.isIgnoredTerm(nextLine) &&
          !nextLine.match(
            /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          if (this.options.debug) {
            console.log('[TextParser] Razão social detectada:', nextLine);
          }
          return nextLine;
        }
      }
    }

    // PRIORIDADE 1: Regex no texto completo
    const patterns = [
      /(?:razão\s*social|razao\s*social)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+?)(?:\s*\n|$)/i,
      /(?:razão\s*social|razao\s*social)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s'&.,\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        const candidate = match[1].trim();
        if (
          candidate.length >= 3 &&
          !this.isIgnoredTerm(candidate) &&
          !candidate.match(
            /^(?:nome\s*fantasia|nome fantasia|cnpj|cpf|inscrição\s*estadual|inscricao\s*estadual|inscrição\s*municipal|inscricao\s*municipal|e-mail|email|telefone|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)/i
          ) &&
          /[A-Za-zÀ-ÿ]/.test(candidate)
        ) {
          if (this.options.debug) {
            console.log('[TextParser] Razão social detectada por regex:', candidate);
          }
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Extrai nome do texto usando sistema de scoring
   */
  private extractName(text: string, lines: string[]): string | null {
    let nameMatch: string | null = null;
    let bestNameScore = 0;

    // PRIORIDADE 0: Sistema de scoring
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || this.isIgnoredTerm(line)) continue;

      const score = this.calculateNameScore(line, i, lines);
      if (score > bestNameScore && score > 20) {
        bestNameScore = score;
        nameMatch = line;
      }
    }

    // PRIORIDADE 1: Label "Nome:"
    if (!nameMatch) {
      const match = text.match(/nome[:\-]?\s*(.+?)(?:\n|$)/i);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (
          candidate.length >= 5 &&
          candidate.split(/\s+/).length >= 2 &&
          !this.isIgnoredTerm(candidate) &&
          !this.containsAddressTerms(candidate)
        ) {
          nameMatch = candidate;
        }
      }
    }

    return nameMatch;
  }

  /**
   * Extrai endereço do texto
   */
  private extractAddress(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "Rua / Logradouro"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');
      const isRuaLabel =
        normalizedLine === 'rua / logradouro' ||
        normalizedLine === 'rua/logradouro' ||
        normalizedLine === 'rua logradouro' ||
        normalizedLine.match(/^rua\s*\/\s*logradouro$/i) ||
        (normalizedLine.includes('rua') && normalizedLine.includes('logradouro'));

      if (isRuaLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          nextLine.length >= 3 &&
          !this.isIgnoredTerm(nextLine) &&
          /[A-Za-zÀ-ÿ]/.test(nextLine)
        ) {
          return nextLine;
        }
      }
    }

    // PRIORIDADE 1: Padrões regex
    const patterns = [
      /\b(?:avenida|av\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
      /\b(?:rua|r\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
      /(?:logradouro)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        const candidate = match[1].trim();
        if (candidate.length >= 5 && !this.isIgnoredTerm(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Extrai número do endereço
   */
  private extractAddressNumber(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "Número:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.match(/^(?:número|numero|nº|n░|num\.?)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && /^\d{1,5}[A-Za-z]?$/.test(nextLine)) {
            return nextLine;
          }
        }
      }
    }

    // PRIORIDADE 1: Regex
    const match = text.match(/,\s*(\d{1,5}[A-Za-z]?)(?:\s*[,\n]|$)/);
    return match ? match[1] : null;
  }

  /**
   * Extrai complemento do endereço
   */
  private extractComplement(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "Complemento:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.match(/^(?:complemento|apto|apartamento|bloco|sala|andar)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.length >= 3) {
            return nextLine;
          }
        }
      }
    }

    // PRIORIDADE 1: Padrões específicos
    const patterns = [
      /\b(?:torre|bloco)\s+[\dA-Za-z]+\s+(?:apto|apartamento|sala|andar)\s+[\dA-Za-z]+/i,
      /\b(?:apto|apartamento|apt\.?)\s+[\dA-Za-z]+/i,
      /\b(?:bloco|bl\.?)\s+[\dA-Za-z]+/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        return match[0].trim();
      }
    }

    return null;
  }

  /**
   * Extrai bairro do texto
   */
  private extractNeighborhood(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "Bairro:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.match(/^(?:bairro\s*\/?\s*distrito|bairro|distrito)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.length >= 3 && !this.isIgnoredTerm(nextLine)) {
            return nextLine;
          }
        }
      }
    }

    // PRIORIDADE 1: Regex
    const match = text.match(
      /(?:bairro\s*\/?\s*distrito|bairro|distrito)[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\n]|$)/i
    );
    return match ? match[1].trim() : null;
  }

  /**
   * Extrai cidade do texto
   */
  private extractCity(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "Cidade:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.match(/^(?:cidade|município|municipio)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (
            nextLine &&
            !this.isIgnoredTerm(nextLine) &&
            !nextLine.match(/^[A-Z]{2}$/)
          ) {
            return nextLine;
          }
        }
      }
    }

    // PRIORIDADE 1: Regex
    const match = text.match(
      /(?:cidade|município|municipio)[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\n]|$)/i
    );
    return match ? match[1].trim() : null;
  }

  /**
   * Extrai estado (UF) do texto
   */
  private extractState(text: string, lines: string[]): string | null {
    // PRIORIDADE 0: Label "UF / Estado:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.match(/^(?:uf\s*\/?\s*estado|uf|estado)[:\-]?$/)) {
        if (i + 1 < lines.length && lines[i + 1]) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && nextLine.match(/^[A-Z]{2}$/)) {
            return nextLine.toUpperCase();
          }
        }
      }
    }

    // PRIORIDADE 1: Regex
    const match =
      text.match(/\b(?:uf\s*\/?\s*estado|uf|estado)[:\-]?\s*([A-Z]{2})\b/i)?.[1] ||
      text.match(/\b([A-Z]{2})\b(?!\w)/)?.[1];

    return match ? match.toUpperCase() : null;
  }

  /**
   * Parse principal: extrai todos os dados do texto
   */
  async parse(text: string): Promise<ExtractedFormData> {
    const normalizedText = this.normalizeText(text);
    const lines = normalizedText.split(/\n/).map((l) => l.trim());
    const lowered = normalizedText.toLowerCase();

    if (this.options.debug) {
      console.log('[TextParser] Parsing text:', { length: normalizedText.length, lines: lines.length });
    }

    // Extrai campos básicos
    const email = this.extractEmail(normalizedText);
    const phone = this.extractPhone(normalizedText);
    const document = this.extractDocument(normalizedText);
    const name = this.extractName(normalizedText, lines);
    const fantasyName = this.extractFantasyName(normalizedText, lines);
    const legalName = this.extractLegalName(normalizedText, lines);
    const cep = this.extractCep(normalizedText, lines);
    const address = this.extractAddress(normalizedText, lines);
    const addressNumber = this.extractAddressNumber(normalizedText, lines);
    const complement = this.extractComplement(normalizedText, lines);
    const neighborhood = this.extractNeighborhood(normalizedText, lines);
    const city = this.extractCity(normalizedText, lines);
    const state = this.extractState(normalizedText, lines);

    const result: ExtractedFormData = {
      // Prioriza Nome Fantasia, depois name, depois Razão Social
      name: fantasyName || name || legalName || undefined,
      fantasyName: fantasyName || undefined,
      legalName: legalName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      cpf: document.cpf,
      cnpj: document.cnpj,
      cep: cep || undefined,
      address: address || undefined,
      addressNumber: addressNumber || undefined,
      addressComplement: complement || undefined,
      neighborhood: neighborhood || undefined,
      city: city || undefined,
      state: state || undefined,
    };

    // Consulta automática de CEP se detectado
    if (this.options.autoFetchCep && cep) {
      try {
        const cepData = await this.options.onCepDetected(cep.replace(/\D/g, ''));
        if (cepData) {
          // Preenche apenas campos vazios
          if (!result.address) result.address = cepData.street;
          if (!result.neighborhood) result.neighborhood = cepData.neighborhood;
          if (!result.city) result.city = cepData.city;
          if (!result.state) result.state = cepData.state?.toUpperCase();
          if (!result.addressComplement && cepData.complement) {
            result.addressComplement = cepData.complement;
          }
        }
      } catch (error) {
        if (this.options.debug) {
          console.error('[TextParser] Erro ao buscar CEP:', error);
        }
      }
    }

    // Consulta automática de CNPJ se detectado
    if (this.options.autoFetchCnpj && document.cnpj) {
      try {
        const cnpjData = await this.options.onCnpjDetected(document.cnpj.replace(/\D/g, ''));
        if (cnpjData) {
          // Preenche apenas campos vazios
          if (!result.legalName) result.legalName = cnpjData.razao_social;
          if (!result.fantasyName) result.fantasyName = cnpjData.nome_fantasia;
          if (!result.cep) result.cep = cnpjData.cep;
          if (!result.address) result.address = cnpjData.logradouro;
          if (!result.addressNumber) result.addressNumber = cnpjData.numero;
          if (!result.addressComplement && cnpjData.complemento) {
            result.addressComplement = cnpjData.complemento;
          }
          if (!result.neighborhood) result.neighborhood = cnpjData.bairro;
          if (!result.city) result.city = cnpjData.municipio;
          if (!result.state) result.state = cnpjData.uf?.toUpperCase();
          if (!result.phone && cnpjData.ddd_telefone_1) {
            result.phone = cnpjData.ddd_telefone_1;
          }
          if (!result.email && cnpjData.email) {
            result.email = cnpjData.email;
          } else if (!result.email && cnpjData.qsa) {
            // Busca email no quadro de sócios
            const socioWithEmail = cnpjData.qsa.find((s) => s.email);
            if (socioWithEmail?.email) {
              result.email = socioWithEmail.email;
            }
          }
        }
      } catch (error) {
        if (this.options.debug) {
          console.error('[TextParser] Erro ao buscar CNPJ:', error);
        }
      }
    }

    if (this.options.debug) {
      console.log('[TextParser] Result:', result);
    }

    return result;
  }
}

