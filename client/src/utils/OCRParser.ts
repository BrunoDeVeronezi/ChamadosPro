/**
 * OCRParser - Parser de Texto Extraído de Imagens via OCR
 *
 * Esta classe processa o texto extraído de imagens usando OCR (Tesseract.js)
 * e identifica campos específicos usando Regular Expressions e lógica posicional.
 *
 * Funcionalidades:
 * - Extrai CNPJ, CPF, CEP, Email, Telefone usando Regex
 * - Identifica Razão Social e Endereço usando lógica posicional (keywords)
 * - Processa endereços completos (rua, número, bairro, cidade, UF)
 *
 * @see CAPTURA_AUTOMATICA_DADOS.md - Documentação sobre captura automática
 *
 * @example
 * ```typescript
 * const parser = new OCRParser();
 * const result = parser.parse(ocrTextBlocks);
 * // result: { cnpj, razaoSocial, email, telefone, cep, endereco, numero, bairro, cidade, uf }
 * ```
 */

export interface OCRParsedData {
  cnpj?: string;
  cpf?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
}

export class OCRParser {
  /**
   * Normaliza o texto removendo caracteres especiais e espaços extras
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  /**
   * Remove CPF da razão social (formato XXX.XXX.XXX-XX ou 11 dígitos)
   */
  private removeCPFFromRazaoSocial(razaoSocial: string): string {
    let cleaned = razaoSocial.trim();
    
    // Remove CPF formatado (XXX.XXX.XXX-XX)
    cleaned = cleaned.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '').trim();
    
    // Remove CPF sem formatação (11 dígitos consecutivos no final da string)
    // Procura por 11 dígitos no final da string (pode ter espaços antes)
    cleaned = cleaned.replace(/\s+\d{11}$/g, '').trim();
    
    // Remove qualquer sequência de 11 dígitos que esteja isolada (com espaços antes e depois)
    cleaned = cleaned.replace(/\s+\d{11}\s+/g, ' ').trim();
    
    // Remove espaços extras que possam ter ficado
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Valida se um email tem formato válido
   */
  private validateEmail(email: string): boolean {
    if (!email || email.trim() === '') return false;
    // Regex básico para email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Valida se um CNPJ tem formato válido e dígitos verificadores corretos
   */
  private validateCNPJ(cnpj: string): boolean {
    // Remove formatação
    const digits = cnpj.replace(/\D/g, '');

    // Deve ter exatamente 14 dígitos
    if (digits.length !== 14) return false;

    // VALIDAÇÃO CRÍTICA: CNPJ formatado DEVE ter barra (formato XX.XXX.XXX/XXXX-XX)
    // Rejeita explicitamente formato de CPF (XXX.XXX.XXX-XX)
    if (!cnpj.includes('/')) {
      return false;
    }

    // VALIDAÇÃO CRÍTICA: CNPJ formatado não deve ter formato de CPF
    if (cnpj.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
      return false; // Formato de CPF
    }

    // Não pode ser sequência de números iguais
    if (/^(\d)\1+$/.test(digits)) return false;

    // Validação básica de dígitos verificadores
    let size = digits.length - 2;
    let numbers = digits.substring(0, size);
    const digits_ver = digits.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits_ver.charAt(0))) return false;

    size = size + 1;
    numbers = digits.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits_ver.charAt(1))) return false;

    return true;
  }

  /**
   * Extrai CNPJ seguindo a mesma estratégia do endereço
   * PRIORIDADE 1: Detecção linha por linha (label "CNPJ" e valor na mesma ou próxima linha)
   * PRIORIDADE 2: Regex no texto completo (fallback)
   */
  private extractCNPJ(text: string, lines: string[]): string | undefined {
    console.log('========================================');
    console.log('[extractCNPJ] 🎯 INÍCIO DA BUSCA POR CNPJ');
    console.log('[extractCNPJ] Total de linhas:', lines.length);
    console.log(
      '[extractCNPJ] Texto completo (primeiros 500 chars):',
      text.substring(0, 500)
    );
    console.log('----------------------------------------');

    // RASTREADOR: Mostra todas as linhas numeradas
    console.log('[extractCNPJ] 📋 TODAS AS LINHAS DO TEXTO:');
    lines.forEach((line, idx) => {
      console.log(`  [${idx}] "${line}"`);
    });
    console.log('----------------------------------------');

    // RASTREADOR: Procura TODOS os padrões que parecem CNPJ no texto completo
    console.log(
      '[extractCNPJ] 🔍 BUSCANDO TODOS OS PADRÕES CNPJ NO TEXTO COMPLETO:'
    );
    const allCnpjPatterns = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g);
    if (allCnpjPatterns) {
      console.log('    Padrões encontrados:', allCnpjPatterns);
      allCnpjPatterns.forEach((pattern, idx) => {
        const index = text.indexOf(pattern);
        const context = text.substring(
          Math.max(0, index - 50),
          Math.min(text.length, index + pattern.length + 50)
        );
        console.log(`  [${idx}] "${pattern}"`);
        console.log(`      Contexto: "...${context}..."`);
        console.log(`      Posição no texto: ${index}`);
        console.log(`      É CNPJ válido? ${this.validateCNPJ(pattern)}`);
      });
    } else {
      console.log('  ❌ Nenhum padrão CNPJ formatado encontrado');
    }

    // RASTREADOR: Procura sequências de 14 dígitos (CNPJ sem formatação)
    const digitsOnly = text.replace(/\D/g, '');
    const digit14Patterns: string[] = [];
    for (let i = 0; i <= digitsOnly.length - 14; i++) {
      const seq = digitsOnly.substring(i, i + 14);
      if (/^\d{14}$/.test(seq)) {
        const formatted = `${seq.slice(0, 2)}.${seq.slice(2, 5)}.${seq.slice(
          5,
          8
        )}/${seq.slice(8, 12)}-${seq.slice(12)}`;
        if (!digit14Patterns.includes(formatted)) {
          digit14Patterns.push(formatted);
        }
      }
    }
    if (digit14Patterns.length > 0) {
      console.log(
        '[extractCNPJ] 🔢 Sequências de 14 dígitos encontradas:',
        digit14Patterns
      );
      digit14Patterns.forEach((pattern, idx) => {
        console.log(
          `  [${idx}] "${pattern}" - É CNPJ válido? ${this.validateCNPJ(
            pattern
          )}`
        );
      });
    }
    console.log('----------------------------------------');

    // PRIORIDADE 1: Detecção linha por linha - procura label "CNPJ" e pega valor na mesma ou próxima linha
    console.log('[extractCNPJ] 🔎 BUSCANDO LABEL "CNPJ" LINHA POR LINHA:');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      // Verifica se é um label de CNPJ (várias variações)
      // IMPORTANTE: Deve ser label isolado ou no início da linha, não parte de outra palavra
      const isCnpjLabel =
        normalizedLine === 'cnpj' ||
        normalizedLine.match(/^cnpj[:\-]?\s*$/i) ||
        normalizedLine.match(/^cnpj[:\-]?\s+(?!\d)/i) || // CNPJ seguido de espaço (não número)
        (normalizedLine.match(/^cnpj[:\-]?$/i) && normalizedLine.length <= 6); // Apenas "CNPJ" ou "CNPJ:" ou "CNPJ-"

      if (isCnpjLabel) {
        console.log(`[extractCNPJ]   LABEL CNPJ ENCONTRADO na linha ${i}:`);
        console.log(`  Linha original: "${lines[i]}"`);
        console.log(`  Linha normalizada: "${normalizedLine}"`);

        // PRIORIDADE 1.1: Procura na mesma linha após "CNPJ"
        console.log(`[extractCNPJ] 🔍 Verificando mesma linha (${i})...`);

        // IMPORTANTE: Primeiro verifica se há CPF na linha (rejeita)
        const cpfInSameLine = lines[i].match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
        if (cpfInSameLine) {
          console.log(
            `  ⚠️ CPF encontrado na mesma linha, rejeitando: "${cpfInSameLine[1]}"`
          );
          // Continua para próxima linha
        } else {
          const sameLineMatch = lines[i].match(
            /cnpj[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i
          );
          if (sameLineMatch) {
            console.log(`    Match encontrado na mesma linha:`, sameLineMatch);
            console.log(`  Grupo 1 (CNPJ): "${sameLineMatch[1]}"`);
            const value = sameLineMatch[1];
            console.log(`  Tem barra (/)? ${value.includes('/')}`);
            console.log(`  É CNPJ válido? ${this.validateCNPJ(value)}`);

            // Validação CRÍTICA: DEVE ter barra (é CNPJ, não CPF) e ser válido
            if (!value.includes('/')) {
              console.log(
                `  ❌ SEM BARRA - Rejeitando (pode ser CPF): "${value}"`
              );
            } else if (value.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
              console.log(
                `  ❌ Formato de CPF detectado, rejeitando: "${value}"`
              );
            } else if (this.validateCNPJ(value)) {
              console.log(
                `[extractCNPJ]     CNPJ VÁLIDO RETORNADO DA MESMA LINHA: "${value}"`
              );
              console.log('========================================');
              return value;
            } else {
              console.log(
                `  ❌ CNPJ inválido (falha na validação de dígitos), continuando busca...`
              );
            }
          } else {
            console.log(`  ❌ Nenhum match encontrado na mesma linha`);
          }
        }

        // PRIORIDADE 1.2: Procura na próxima linha (mais comum)
        console.log(
          `[extractCNPJ] 🔍 Verificando próximas linhas (${
            i + 1
          } até ${Math.min(i + 3, lines.length - 1)})...`
        );
        for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
          const candidateLine = lines[j].trim();
          console.log(`  [${j}] Verificando linha: "${candidateLine}"`);

          // Se a linha está vazia, pula
          if (!candidateLine) {
            console.log(`    → Linha vazia, pulando...`);
            continue;
          }

          // Se encontrou outro label conhecido, para a busca
          const isOtherLabel = candidateLine.match(
            /^(?:telefone|email|e-mail|razão|razao|endereço|endereco|inscrição|inscricao|dados|contato)/i
          );
          if (isOtherLabel) {
            console.log(
              `    → ⚠️ Outro label encontrado: "${isOtherLabel[0]}", parando busca`
            );
            break;
          }

          // Procura CNPJ formatado na linha candidata
          // IMPORTANTE: Rejeita explicitamente formato de CPF (XXX.XXX.XXX-XX)
          const cpfMatch = candidateLine.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
          if (cpfMatch) {
            console.log(
              `    → ⚠️ CPF encontrado (formato XXX.XXX.XXX-XX), rejeitando: "${cpfMatch[1]}"`
            );
            // Não é CNPJ, continua busca
            continue;
          }

          const formattedMatch = candidateLine.match(
            /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/
          );
          if (formattedMatch) {
            console.log(`    →   Match formatado encontrado:`, formattedMatch);
            const value = formattedMatch[1];
            console.log(`      Valor: "${value}"`);
            console.log(`      Tem barra (/)? ${value.includes('/')}`);
            console.log(`      É CNPJ válido? ${this.validateCNPJ(value)}`);

            // Validação CRÍTICA: DEVE ter barra (é CNPJ, não CPF) e ser válido
            if (!value.includes('/')) {
              console.log(
                `      ❌ SEM BARRA - Rejeitando (pode ser CPF): "${value}"`
              );
              continue;
            }

            // Rejeita explicitamente formato de CPF (mesmo que tenha 14 dígitos)
            if (value.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
              console.log(
                `      ❌ Formato de CPF detectado, rejeitando: "${value}"`
              );
              continue;
            }

            if (this.validateCNPJ(value)) {
              console.log(
                `[extractCNPJ]     CNPJ VÁLIDO RETORNADO DA PRÓXIMA LINHA: "${value}"`
              );
              console.log('========================================');
              return value;
            } else {
              console.log(
                `      ❌ CNPJ inválido (falha na validação de dígitos), continuando...`
              );
            }
          } else {
            console.log(`    → ❌ Nenhum match formatado encontrado`);
          }

          // Tenta sem pontuação (14 dígitos)
          const digits = candidateLine.replace(/\D/g, '');
          console.log(
            `    → Dígitos extraídos: "${digits}" (${digits.length} dígitos)`
          );

          // IMPORTANTE: Se a linha original tem formato de CPF, rejeita imediatamente
          if (candidateLine.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)) {
            console.log(
              `      ❌ Linha contém formato de CPF (XXX.XXX.XXX-XX), rejeitando`
            );
            continue;
          }

          if (digits.length === 14) {
            // Formata como CNPJ (XX.XXX.XXX/XXXX-XX)
            const formatted = `${digits.slice(0, 2)}.${digits.slice(
              2,
              5
            )}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(
              12
            )}`;
            console.log(`    → CNPJ formatado de 14 dígitos: "${formatted}"`);

            // Validação CRÍTICA: DEVE ter barra e não parecer CPF
            if (!formatted.includes('/')) {
              console.log(`      ❌ SEM BARRA após formatação, rejeitando`);
              continue;
            }

            // Rejeita se parecer CPF (formato XXX.XXX.XXX-XX)
            if (formatted.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
              console.log(
                `      ❌ Formato de CPF após formatação, rejeitando: "${formatted}"`
              );
              continue;
            }

            console.log(`      É CNPJ válido? ${this.validateCNPJ(formatted)}`);
            if (this.validateCNPJ(formatted)) {
              console.log(
                `[extractCNPJ]     CNPJ VÁLIDO RETORNADO DE DÍGITOS: "${formatted}"`
              );
              console.log('========================================');
              return formatted;
            } else {
              console.log(`      ❌ CNPJ inválido após validação completa`);
            }
          } else if (digits.length === 11) {
            // Se tem 11 dígitos, é CPF, não CNPJ - rejeita
            console.log(
              `      ⚠️ Linha tem 11 dígitos (CPF), rejeitando para CNPJ`
            );
            continue;
          }
        }

        // Se encontrou label, para a busca (não continua procurando em outras linhas)
        console.log(
          `[extractCNPJ] Label encontrado mas nenhum CNPJ válido capturado, parando busca`
        );
        break;
      }
    }

    console.log(
      '[extractCNPJ] Nenhum label "CNPJ" encontrado, tentando fallback...'
    );

    // PRIORIDADE 1.5: Procura CNPJ formatado nas linhas mesmo sem label "CNPJ"
    // Isso ajuda quando o OCR não leu bem o label
    console.log('[extractCNPJ] 🔍 BUSCANDO CNPJ NAS LINHAS (sem label)...');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Procura CNPJ formatado na linha (com variações de formatação)
      const cnpjMatch = line.match(/(\d{2,5}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      if (cnpjMatch) {
        let value = cnpjMatch[1];
        console.log(`  [${i}] Linha: "${line}"`);
        console.log(`      Match encontrado: "${value}"`);

        // Normaliza o formato
        const digits = value.replace(/\D/g, '');
        if (digits.length === 14) {
          value = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
            5,
            8
          )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
          console.log(`      Valor normalizado: "${value}"`);
        }

        // Validação CRÍTICA
        if (
          value.includes('/') &&
          !value.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/) &&
          this.validateCNPJ(value)
        ) {
          console.log(
            `[extractCNPJ]     CNPJ VÁLIDO ENCONTRADO NA LINHA ${i}: "${value}"`
          );
          console.log('========================================');
          return value;
        }
      }
    }

    // PRIORIDADE 2: Se não encontrou linha por linha, tenta usar a lista de sequências de 14 dígitos
    // que já foi gerada anteriormente e contém CNPJs válidos
    console.log(
      '[extractCNPJ] 🔄 FALLBACK: Buscando CNPJ válido na lista de sequências...'
    );

    // Usa a lista de sequências de 14 dígitos que já foi gerada
    // Procura o primeiro CNPJ válido da lista
    if (digit14Patterns && digit14Patterns.length > 0) {
      console.log(
        `  📋 Verificando ${digit14Patterns.length} sequências de 14 dígitos...`
      );
      for (const pattern of digit14Patterns) {
        console.log(`  🔍 Verificando: "${pattern}"`);

        // Validação CRÍTICA: DEVE ter barra (é CNPJ, não CPF) e ser válido
        if (!pattern.includes('/')) {
          console.log(`    ❌ SEM BARRA, rejeitando: "${pattern}"`);
          continue;
        }

        // Rejeita se parecer CPF (formato XXX.XXX.XXX-XX)
        if (pattern.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
          console.log(`    ❌ Formato de CPF, rejeitando: "${pattern}"`);
          continue;
        }

        if (this.validateCNPJ(pattern)) {
          console.log(
            `[extractCNPJ]     CNPJ VÁLIDO RETORNADO DO FALLBACK (lista): "${pattern}"`
          );
          console.log('========================================');
          return pattern;
        } else {
          console.log(
            `    ❌ CNPJ inválido (falha na validação): "${pattern}"`
          );
        }
      }
    }

    // PRIORIDADE 3: Tenta regex no texto completo com variações de formatação
    console.log(
      '[extractCNPJ] 🔄 FALLBACK 2: Buscando CNPJ no texto completo (regex flexível)...'
    );

    // IMPORTANTE: Primeiro verifica se há CPFs no texto (para rejeitar)
    const allCpfMatches = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/g);
    if (allCpfMatches) {
      console.log(
        `  ⚠️ CPFs encontrados no texto (serão ignorados):`,
        allCpfMatches
      );
    }

    // Regex mais flexível: aceita variações de formatação
    // Formato padrão: XX.XXX.XXX/XXXX-XX
    // Variação: XXXXX.XXX/XXXX-XX (sem ponto após os 2 primeiros)
    const regexMatch = text.match(/(\d{2,5}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (regexMatch) {
      console.log(`  Match encontrado:`, regexMatch);
      let value = regexMatch[1];

      // Normaliza o formato: garante que tenha XX.XXX.XXX/XXXX-XX
      const digits = value.replace(/\D/g, '');
      if (digits.length === 14) {
        value = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
          5,
          8
        )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
        console.log(`  Valor normalizado: "${value}"`);
      }

      console.log(`  Valor: "${value}"`);
      console.log(`  Tem barra (/)? ${value.includes('/')}`);
      console.log(`  É CNPJ válido? ${this.validateCNPJ(value)}`);

      // Validação CRÍTICA: DEVE ter barra (é CNPJ, não CPF) e ser válido
      if (!value.includes('/')) {
        console.log(
          `  ❌ SEM BARRA no fallback - Rejeitando (pode ser CPF): "${value}"`
        );
      } else if (value.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
        console.log(
          `  ❌ Formato de CPF detectado no fallback, rejeitando: "${value}"`
        );
      } else if (this.validateCNPJ(value)) {
        console.log(
          `[extractCNPJ]     CNPJ VÁLIDO RETORNADO DO FALLBACK (regex): "${value}"`
        );
        console.log('========================================');
        return value;
      } else {
        console.log(
          `  ❌ CNPJ inválido (falha na validação de dígitos) no fallback`
        );
      }
    } else {
      console.log(`  ❌ Nenhum match encontrado no fallback (regex)`);
    }

    console.log('[extractCNPJ] ❌❌❌ NENHUM CNPJ VÁLIDO ENCONTRADO');
    console.log('========================================');
    return undefined;
  }

  /**
   * Extrai CPF usando regex
   * Formatos aceitos: XXX.XXX.XXX-XX ou XXXXXXXXXXX
   * IMPORTANTE: CPF NÃO deve ser confundido com CNPJ
   */
  private extractCPF(text: string, lines: string[]): string | undefined {
    // PRIORIDADE 1: Procura CPF após keyword "CPF"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ');

      // Verifica se a linha contém "CPF" como label
      const hasCpfLabel =
        normalizedLine.match(/^cpf[:\-]?/i) ||
        (normalizedLine.includes('cpf') && normalizedLine.length < 20);

      if (hasCpfLabel) {
        // Procura na mesma linha após "CPF"
        const sameLineMatch = lines[i].match(
          /cpf[:\-]?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i
        );
        if (sameLineMatch && sameLineMatch[1]) {
          return sameLineMatch[1];
        }

        // Procura na próxima linha
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();

          // Formato com pontuação CPF (XXX.XXX.XXX-XX, SEM barra)
          const nextLineMatch = nextLine.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
          if (nextLineMatch && !nextLineMatch[1].includes('/')) {
            return nextLineMatch[1];
          }

          // Tenta sem pontuação
          const digits = nextLine.replace(/\D/g, '');
          if (digits.length === 11) {
            const cpf = digits;
            return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(
              6,
              9
            )}-${cpf.slice(9)}`;
          }
        }
      }
    }

    // PRIORIDADE 2: Procura qualquer CPF no texto (mas não CNPJ)
    // Formato com pontuação: XXX.XXX.XXX-XX (SEM barra, diferente de CNPJ)
    const formattedMatch = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    if (formattedMatch && !formattedMatch[1].includes('/')) {
      return formattedMatch[1];
    }

    // Formato sem pontuação: 11 dígitos (não 14)
    const unformattedMatch = text.replace(/\D/g, '').match(/(\d{11})(?!\d)/);
    if (unformattedMatch) {
      const cpf = unformattedMatch[1];
      // Formata o CPF
      return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(
        6,
        9
      )}-${cpf.slice(9)}`;
    }

    return undefined;
  }

  /**
   * Extrai CEP usando regex
   * Formatos aceitos: XXXXX-XXX ou XXXXXXXX
   */
  private extractCEP(text: string): string | undefined {
    // Formato com hífen: XXXXX-XXX
    const formattedMatch = text.match(/\d{5}-\d{3}/);
    if (formattedMatch) {
      return formattedMatch[0];
    }

    // Formato sem hífen: 8 dígitos
    const unformattedMatch = text.replace(/\D/g, '').match(/(\d{8})/);
    if (unformattedMatch) {
      const cep = unformattedMatch[1];
      // Formata o CEP
      return `${cep.slice(0, 5)}-${cep.slice(5)}`;
    }

    return undefined;
  }

  /**
   * Extrai Email seguindo a mesma estratégia do CNPJ (bem-sucedida)
   * PRIORIDADE 1: Detecção linha por linha (label "E-mail" e valor na mesma ou próxima linha)
   * PRIORIDADE 1.5: Busca nas linhas mesmo sem label (quando OCR não lê bem o label)
   * PRIORIDADE 2: Regex no texto completo (fallback)
   */
  private extractEmail(text: string, lines: string[]): string | undefined {
    console.log('[extractEmail] 🎯 INÍCIO DA BUSCA POR EMAIL');
    console.log('[extractEmail] Total de linhas:', lines.length);
    console.log('[extractEmail] 📋 TODAS AS LINHAS DO TEXTO:');
    lines.forEach((line, idx) => {
      console.log(`  [${idx}] "${line}"`);
    });
    console.log('----------------------------------------');

    // Gera lista de todos os emails encontrados no texto (para fallback)
    const allEmailMatches = text.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    );
    const emailPatterns: string[] = [];
    if (allEmailMatches) {
      console.log(
        '[extractEmail] 🔍 EMAILS ENCONTRADOS NO TEXTO COMPLETO (com @):',
        allEmailMatches
      );
      allEmailMatches.forEach((email) => {
        console.log(`  Verificando: "${email}"`);
        const isValid = this.validateEmail(email);
        console.log(`    É válido? ${isValid}`);
        if (isValid && !emailPatterns.includes(email)) {
          emailPatterns.push(email);
        }
      });
      console.log(
        '[extractEmail] 📋 Emails válidos após validação:',
        emailPatterns
      );
    } else {
      console.log(
        '[extractEmail] ⚠️ NENHUM EMAIL COM @ ENCONTRADO NO TEXTO COMPLETO'
      );
    }

    // Busca padrões que podem ser emails sem @ (erro de OCR)
    const possibleEmails = text.match(
      /([a-zA-Z0-9._%+-]+\s*[a-zQZ]+\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
    );
    if (possibleEmails) {
      console.log(
        '[extractEmail] 🔍 POSSÍVEIS EMAILS SEM @ (erro de OCR):',
        possibleEmails
      );
    }

    // PRIORIDADE 1: Detecção linha por linha - procura label "E-mail" e pega valor na mesma ou próxima linha
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      // Verifica se é um label de email (várias variações)
      const isEmailLabel =
        normalizedLine === 'e-mail' ||
        normalizedLine === 'email' ||
        normalizedLine.match(/^(?:e-?mail|email)[:\-]?$/i) ||
        normalizedLine.match(/(?:e-?mail|email)[:\-]?\s*$/i) ||
        normalizedLine.match(/^(?:dados\s+de\s+)?contato$/i);

      if (isEmailLabel) {
        console.log(
          '[extractEmail]   Label email encontrado na linha',
          i,
          ':',
          lines[i]
        );

        // PRIORIDADE 1.1: Procura na mesma linha após "E-mail" ou "Email"
        const sameLineMatch = lines[i].match(
          /(?:e-?mail|email)[:\-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
        );
        if (sameLineMatch && sameLineMatch[1]) {
          const value = sameLineMatch[1];
          console.log('[extractEmail] Email encontrado na mesma linha:', value);
          if (this.validateEmail(value)) {
            console.log(
              '[extractEmail]     EMAIL VÁLIDO RETORNADO DA MESMA LINHA:',
              value
            );
            console.log('[extractEmail] 📤 RETORNANDO VALOR:', value);
            console.log('[extractEmail] 📤 TIPO DO VALOR:', typeof value);
            console.log(
              '[extractEmail] 📤 VALOR É STRING?',
              typeof value === 'string'
            );
            return value;
          }
        }

        // PRIORIDADE 1.2: Procura na próxima linha (mais comum)
        console.log(
          '[extractEmail] 🔍 Procurando email nas próximas 3 linhas após label...'
        );
        for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
          const candidateLine = lines[j].trim();
          console.log(`  [${j}] Verificando linha: "${candidateLine}"`);

          // Se a linha está vazia, pula
          if (!candidateLine) {
            console.log(`    ⏭️ Linha vazia, pulando...`);
            continue;
          }

          // Se encontrou outro label conhecido, para a busca
          if (
            candidateLine.match(
              /^(?:telefone|cnpj|razão|razao|endereço|endereco|inscrição|inscricao|dados|contato)/i
            )
          ) {
            console.log(`    ⛔ Label conhecido encontrado, parando busca`);
            break;
          }

          // Procura email na linha candidata
          const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
          const emailFound = candidateLine.match(emailRegex);
          console.log(`    Regex match:`, emailFound);
          if (emailFound && emailFound[1]) {
            const value = emailFound[1];
            console.log(`    Email encontrado: "${value}"`);
            const isValid = this.validateEmail(value);
            console.log(`    É válido? ${isValid}`);
            if (isValid) {
              console.log(
                '[extractEmail]     EMAIL VÁLIDO RETORNADO DA PRÓXIMA LINHA:',
                value
              );
              return value;
            }
          } else {
            // Tenta detectar email sem @ (erro comum de OCR)
            // O OCR pode ler @ como &, Q, Z, O, 0, e, etc.
            // Primeiro, tenta detectar quando "e" pode ser @ mal lido
            // Exemplo: "financeiroefindup.com.br" -> "financeiro@findup.com.br"
            const eAsAtMatch = candidateLine.match(
              /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com\.br)/i
            );
            if (eAsAtMatch) {
              const possibleEmail = `${eAsAtMatch[1]}@${eAsAtMatch[2]}`;
              console.log(
                `    ⚠️ Email com "e" detectado, tentando correção: "${possibleEmail}"`
              );
              if (this.validateEmail(possibleEmail)) {
                console.log(
                  `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @): "${possibleEmail}"`
                );
                return possibleEmail;
              }
            }

            // Tenta também para .com (sem .br)
            const eAsAtMatchCom = candidateLine.match(
              /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com)/i
            );
            if (eAsAtMatchCom) {
              const possibleEmail = `${eAsAtMatchCom[1]}@${eAsAtMatchCom[2]}`;
              console.log(
                `    ⚠️ Email com "e" detectado (.com), tentando correção: "${possibleEmail}"`
              );
              if (this.validateEmail(possibleEmail)) {
                console.log(
                  `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @): "${possibleEmail}"`
                );
                return possibleEmail;
              }
            }

            // Segundo, tenta substituição simples de & por @
            const simpleAmpersandMatch = candidateLine.match(
              /([a-zA-Z0-9._%+-]+)&([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
            );
            if (simpleAmpersandMatch) {
              const possibleEmail = `${simpleAmpersandMatch[1]}@${simpleAmpersandMatch[2]}`;
              console.log(
                `    ⚠️ Email com & detectado, tentando correção: "${possibleEmail}"`
              );
              if (this.validateEmail(possibleEmail)) {
                console.log(
                  `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (& -> @): "${possibleEmail}"`
                );
                return possibleEmail;
              }
            }

            // Estratégia melhorada: primeiro encontra o domínio, depois trabalha de trás para frente
            // Encontra o domínio (procura por padrões conhecidos: .com.br, .com, .net, etc)
            // Estratégia simplificada: procura .com.br no texto e pega apenas a parte final
            const comBrIndex = candidateLine.toLowerCase().indexOf('.com.br');
            if (comBrIndex !== -1) {
              // Pega tudo antes de .com.br
              const beforeComBr = candidateLine.substring(0, comBrIndex);
              // Procura o último espaço ou ponto antes de .com.br para separar o domínio
              const lastSpace = beforeComBr.lastIndexOf(' ');
              const lastDot = beforeComBr.lastIndexOf('.');
              const separatorIndex = Math.max(lastSpace, lastDot);

              // Se encontrou separador, pega apenas a parte final
              if (separatorIndex !== -1) {
                const domainStart = separatorIndex + 1;
                const domain = candidateLine.substring(
                  domainStart,
                  comBrIndex + 7
                ); // +7 para incluir .com.br
                const beforeDomain = candidateLine
                  .substring(0, domainStart)
                  .trim();

                console.log(
                  `    ⚠️ Domínio completo encontrado: "${candidateLine.substring(
                    domainStart
                  )}"`
                );
                console.log(`    ⚠️ Domínio final extraído: "${domain}"`);
                console.log(`    Texto antes do domínio: "${beforeDomain}"`);

                // Procura padrão repetido (ex: "zacQzac" -> @ deveria estar no meio)
                const repeatedPattern =
                  beforeDomain.match(/([a-z]{2,})[QZO0]\1/i);
                if (repeatedPattern) {
                  const base = repeatedPattern[1];
                  const beforeRepeat = beforeDomain.substring(
                    0,
                    beforeDomain.indexOf(repeatedPattern[0])
                  );
                  const possibleEmail = `${beforeRepeat}${base}@${domain}`;
                  console.log(
                    `    ⚠️ Padrão repetido detectado: "${repeatedPattern[0]}"`
                  );
                  console.log(
                    `    ⚠️ Tentando email corrigido: "${possibleEmail}"`
                  );
                  if (this.validateEmail(possibleEmail)) {
                    console.log(
                      `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (padrão repetido): "${possibleEmail}"`
                    );
                    console.log(
                      '[extractEmail] 📤 RETORNANDO VALOR:',
                      possibleEmail
                    );
                    console.log(
                      '[extractEmail] 📤 TIPO DO VALOR:',
                      typeof possibleEmail
                    );
                    return possibleEmail;
                  }
                }

                // Se não encontrou padrão repetido, procura letra suspeita antes do domínio
                // Inclui &, Q, Z, O, 0 como possíveis @ mal lidos
                const suspiciousCharMatch = beforeDomain.match(
                  /([a-zA-Z0-9._%+-]+)[&QZO0]([a-zA-Z0-9._%+-]*)$/i
                );
                if (suspiciousCharMatch) {
                  const part1 = suspiciousCharMatch[1];
                  const part2 = suspiciousCharMatch[2];

                  console.log(`    ⚠️ Padrão de email sem @ detectado:`);
                  console.log(`      Parte 1: "${part1}"`);
                  console.log(`      Parte 2: "${part2}"`);
                  console.log(`      Domínio: "${domain}"`);

                  // Tenta diferentes combinações
                  const possibilities = [];

                  // Opção 1: @ logo após primeira parte (mais comum)
                  // Só tenta se parte 1 tem pelo menos 3 caracteres (evita "c@...")
                  if (part1.length >= 3) {
                    possibilities.push(`${part1}@${domain}`);
                  }

                  // Opção 2: Se há parte 2, tenta incluí-la (mas só se não for repetição)
                  if (part2 && part2.length > 0 && part2.length <= 10) {
                    // Se parte 2 parece ser repetição do final de parte 1, ignora
                    const last3OfPart1 = part1.toLowerCase().slice(-3);
                    if (!part2.toLowerCase().startsWith(last3OfPart1)) {
                      possibilities.push(`${part1}@${part2}${domain}`);
                    }
                  }

                  for (const possibleEmail of possibilities) {
                    console.log(
                      `    ⚠️ Tentando email corrigido: "${possibleEmail}"`
                    );
                    if (this.validateEmail(possibleEmail)) {
                      console.log(
                        `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (sem @): "${possibleEmail}"`
                      );
                      console.log(
                        '[extractEmail] 📤 RETORNANDO VALOR:',
                        possibleEmail
                      );
                      console.log(
                        '[extractEmail] 📤 TIPO DO VALOR:',
                        typeof possibleEmail
                      );
                      return possibleEmail;
                    }
                  }
                }
              } else {
                // Se não encontrou separador, tenta usar todo o texto antes de .com.br como email
                const domain = candidateLine.substring(0, comBrIndex + 7);
                console.log(
                  `    ⚠️ Nenhum separador encontrado, tentando domínio completo: "${domain}"`
                );
                const inlineEmail = this.tryRecoverInlineEmail(
                  candidateLine,
                  'PRIORIDADE 1 (label)'
                );
                if (inlineEmail) {
                  return inlineEmail;
                }
              }
            } else {
              // Tenta .com, .net, etc
              const comMatch = candidateLine.match(
                /([a-zA-Z0-9-]+\.(?:com|net|org|br|gov|edu))/i
              );
              if (comMatch) {
                const fullDomain = comMatch[1];
                const lastDot = fullDomain.lastIndexOf('.');
                const domain = fullDomain.substring(lastDot + 1);
                const domainIndex = candidateLine.indexOf(fullDomain);
                const beforeDomain = candidateLine
                  .substring(0, domainIndex)
                  .trim();

                console.log(`    ⚠️ Domínio encontrado (.com): "${domain}"`);
                console.log(`    Texto antes do domínio: "${beforeDomain}"`);

                // Mesma lógica de correção...
                const suspiciousCharMatch = beforeDomain.match(
                  /([a-zA-Z0-9._%+-]+)[&QZO0]([a-zA-Z0-9._%+-]*)$/i
                );
                if (suspiciousCharMatch) {
                  const part1 = suspiciousCharMatch[1];
                  if (part1.length >= 3) {
                    const possibleEmail = `${part1}@${domain}`;
                    console.log(
                      `    ⚠️ Tentando email corrigido: "${possibleEmail}"`
                    );
                    if (this.validateEmail(possibleEmail)) {
                      console.log(
                        `[extractEmail]     EMAIL VÁLIDO CORRIGIDO: "${possibleEmail}"`
                      );
                      return possibleEmail;
                    }
                  }
                }
              }
            }
          }
        }

        // Se encontrou label, para a busca (não continua procurando em outras linhas)
        break;
      }
    }

    // PRIORIDADE 1.5: Procura email formatado nas linhas mesmo sem label "E-mail"
    // Isso ajuda quando o OCR não leu bem o label
    console.log('[extractEmail] 🔍 BUSCANDO EMAIL NAS LINHAS (sem label)...');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      console.log(`  [${i}] Verificando linha: "${line}"`);

      // Procura email na linha (com @)
      const emailMatch = line.match(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
      );
      if (emailMatch) {
        const value = emailMatch[1];
        console.log(`        Email encontrado (com @): "${value}"`);
        const isValid = this.validateEmail(value);
        console.log(`      É válido? ${isValid}`);
        if (isValid) {
          console.log(
            `[extractEmail]     EMAIL VÁLIDO ENCONTRADO NA LINHA ${i}: "${value}"`
          );
          return value;
        }
      } else {
        // Tenta detectar quando "e" pode ser @ mal lido
        const eAsAtMatch = line.match(
          /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com\.br)/i
        );
        if (eAsAtMatch) {
          const possibleEmail = `${eAsAtMatch[1]}@${eAsAtMatch[2]}`;
          console.log(
            `      ⚠️ Email com "e" detectado, tentando correção: "${possibleEmail}"`
          );
          if (this.validateEmail(possibleEmail)) {
            console.log(
              `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @) NA LINHA ${i}: "${possibleEmail}"`
            );
            return possibleEmail;
          }
        }

        // Tenta também para .com (sem .br)
        const eAsAtMatchCom = line.match(
          /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com)/i
        );
        if (eAsAtMatchCom) {
          const possibleEmail = `${eAsAtMatchCom[1]}@${eAsAtMatchCom[2]}`;
          console.log(
            `      ⚠️ Email com "e" detectado (.com), tentando correção: "${possibleEmail}"`
          );
          if (this.validateEmail(possibleEmail)) {
            console.log(
              `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @) NA LINHA ${i}: "${possibleEmail}"`
            );
            return possibleEmail;
          }
        }

        // Tenta substituição simples de & por @
        const simpleAmpersandMatch = line.match(
          /([a-zA-Z0-9._%+-]+)&([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
        );
        if (simpleAmpersandMatch) {
          const possibleEmail = `${simpleAmpersandMatch[1]}@${simpleAmpersandMatch[2]}`;
          console.log(
            `      ⚠️ Email com & detectado, tentando correção: "${possibleEmail}"`
          );
          if (this.validateEmail(possibleEmail)) {
            console.log(
              `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (& -> @) NA LINHA ${i}: "${possibleEmail}"`
            );
            return possibleEmail;
          }
        }
        // Tenta detectar email sem @ (erro comum de OCR)
        // Estratégia simplificada: procura .com.br no texto e pega apenas a parte final
        const comBrIndex = line.toLowerCase().indexOf('.com.br');
        if (comBrIndex !== -1) {
          // Pega tudo antes de .com.br
          const beforeComBr = line.substring(0, comBrIndex);
          // Procura o último espaço ou ponto antes de .com.br para separar o domínio
          const lastSpace = beforeComBr.lastIndexOf(' ');
          const lastDot = beforeComBr.lastIndexOf('.');
          const separatorIndex = Math.max(lastSpace, lastDot);

          // Se encontrou separador, pega apenas a parte final
          if (separatorIndex !== -1) {
            const domainStart = separatorIndex + 1;
            const domain = line.substring(domainStart, comBrIndex + 7); // +7 para incluir .com.br
            const beforeDomain = line.substring(0, domainStart).trim();

            console.log(
              `      ⚠️ Domínio completo encontrado: "${line.substring(
                domainStart
              )}"`
            );
            console.log(`      ⚠️ Domínio final extraído: "${domain}"`);
            console.log(`      Texto antes do domínio: "${beforeDomain}"`);

            // Procura padrão repetido (ex: "zacQzac" -> @ deveria estar no meio)
            const repeatedPattern = beforeDomain.match(/([a-z]{2,})[QZO0]\1/i);
            if (repeatedPattern) {
              const base = repeatedPattern[1];
              const beforeRepeat = beforeDomain.substring(
                0,
                beforeDomain.indexOf(repeatedPattern[0])
              );
              const possibleEmail = `${beforeRepeat}${base}@${domain}`;
              console.log(
                `      ⚠️ Padrão repetido detectado: "${repeatedPattern[0]}"`
              );
              console.log(
                `      ⚠️ Tentando email corrigido: "${possibleEmail}"`
              );
              const isValid = this.validateEmail(possibleEmail);
              console.log(`      É válido? ${isValid}`);
              if (isValid) {
                console.log(
                  `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (padrão repetido) NA LINHA ${i}: "${possibleEmail}"`
                );
                return possibleEmail;
              }
            }

            // Se não encontrou padrão repetido, procura letra suspeita antes do domínio
            const suspiciousCharMatch = beforeDomain.match(
              /([a-zA-Z0-9._%+-]+)[&QZO0]([a-zA-Z0-9._%+-]*)$/i
            );
            if (suspiciousCharMatch) {
              const part1 = suspiciousCharMatch[1];
              const part2 = suspiciousCharMatch[2];

              console.log(`      ⚠️ Padrão de email sem @ detectado:`);
              console.log(`        Parte 1: "${part1}"`);
              console.log(`        Parte 2: "${part2}"`);
              console.log(`        Domínio: "${domain}"`);

              // Tenta diferentes combinações
              const possibilities = [];

              // Opção 1: @ logo após primeira parte (mais comum)
              // Só tenta se parte 1 tem pelo menos 3 caracteres (evita "c@...")
              if (part1.length >= 3) {
                possibilities.push(`${part1}@${domain}`);
              }

              // Opção 2: Se há parte 2, tenta incluí-la (mas só se não for repetição)
              if (part2 && part2.length > 0 && part2.length <= 10) {
                const last3OfPart1 = part1.toLowerCase().slice(-3);
                if (!part2.toLowerCase().startsWith(last3OfPart1)) {
                  possibilities.push(`${part1}@${part2}${domain}`);
                }
              }

              for (const possibleEmail of possibilities) {
                console.log(
                  `      ⚠️ Tentando email corrigido: "${possibleEmail}"`
                );
                const isValid = this.validateEmail(possibleEmail);
                console.log(`      É válido? ${isValid}`);
                if (isValid) {
                  console.log(
                    `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (sem @) NA LINHA ${i}: "${possibleEmail}"`
                  );
                  return possibleEmail;
                }
              }
            }
          } else {
            // Se não encontrou separador, tenta usar todo o texto antes de .com.br como email
            const domain = line.substring(0, comBrIndex + 7);
            console.log(
              `      ⚠️ Nenhum separador encontrado, tentando domínio completo: "${domain}"`
            );
            const inlineEmail = this.tryRecoverInlineEmail(
              line,
              `PRIORIDADE 1.5 (linha ${i})`
            );
            if (inlineEmail) {
              return inlineEmail;
            }
          }
        } else {
          // Tenta .com, .net, etc
          const comMatch = line.match(
            /([a-zA-Z0-9-]+\.(?:com|net|org|br|gov|edu))/i
          );
          if (comMatch) {
            const fullDomain = comMatch[1];
            const lastDot = fullDomain.lastIndexOf('.');
            const domain = fullDomain.substring(lastDot + 1);
            const domainIndex = line.indexOf(fullDomain);
            const beforeDomain = line.substring(0, domainIndex).trim();

            console.log(`      ⚠️ Domínio encontrado (.com): "${domain}"`);
            console.log(`      Texto antes do domínio: "${beforeDomain}"`);

            // Mesma lógica de correção...
            const suspiciousCharMatch = beforeDomain.match(
              /([a-zA-Z0-9._%+-]+)[&QZO0]([a-zA-Z0-9._%+-]*)$/i
            );
            if (suspiciousCharMatch) {
              const part1 = suspiciousCharMatch[1];
              if (part1.length >= 3) {
                const possibleEmail = `${part1}@${domain}`;
                console.log(
                  `      ⚠️ Tentando email corrigido: "${possibleEmail}"`
                );
                if (this.validateEmail(possibleEmail)) {
                  console.log(
                    `[extractEmail]     EMAIL VÁLIDO CORRIGIDO: "${possibleEmail}"`
                  );
                  return possibleEmail;
                }
              }
            }
          }
        }
      }
    }

    // PRIORIDADE 2: Se não encontrou linha por linha, tenta usar a lista de emails encontrados
    console.log(
      '[extractEmail] 🔄 FALLBACK: Usando lista de emails encontrados...'
    );
    if (emailPatterns && emailPatterns.length > 0) {
      console.log(
        `  📋 Verificando ${emailPatterns.length} emails encontrados...`
      );
      for (const email of emailPatterns) {
        console.log(`  🔍 Verificando: "${email}"`);
        if (this.validateEmail(email)) {
          console.log(
            `[extractEmail]     EMAIL VÁLIDO RETORNADO DO FALLBACK (lista): "${email}"`
          );
          return email;
        }
      }
    }

    // PRIORIDADE 3: Regex no texto completo (último recurso)
    const regexMatch = text.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (regexMatch && regexMatch[1]) {
      const value = regexMatch[1];
      if (this.validateEmail(value)) {
        console.log(
          '[extractEmail]     EMAIL VÁLIDO RETORNADO DO FALLBACK (regex):',
          value
        );
        return value;
      }
    }

    console.log('[extractEmail] ❌❌❌ NENHUM EMAIL VÁLIDO ENCONTRADO');
    console.log('========================================');
    console.log('[extractEmail] 📤 RESULTADO FINAL:');
    console.log('  Retornando: undefined');
    console.log(
      '  Motivo: Nenhum email válido encontrado após todas as tentativas'
    );
    console.log('========================================');
    return undefined;
  }

  private tryRecoverInlineEmail(
    sourceLine: string,
    context: string
  ): string | undefined {
    // Primeiro, tenta detectar quando "e" no início de palavra pode ser @ mal lido
    // Exemplo: "financeiroefindup.com.br" -> "financeiro@findup.com.br"
    // Procura padrão: palavra + "e" + palavra + .com.br
    const eAsAtPattern = sourceLine.match(
      /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com\.br)/i
    );
    if (eAsAtPattern) {
      const localPart = eAsAtPattern[1];
      const domainWithE = eAsAtPattern[2]; // "findup.com.br"
      const possibleEmail = `${localPart}@${domainWithE}`;
      console.log(
        `[extractEmail] ${context} - "e" detectado como possível @: "${possibleEmail}"`
      );
      if (this.validateEmail(possibleEmail)) {
        console.log(
          `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @) (${context}): "${possibleEmail}"`
        );
        return possibleEmail;
      }
    }

    // Também tenta para .com (sem .br)
    const eAsAtPatternCom = sourceLine.match(
      /([a-zA-Z0-9._%+-]{3,})e([a-zA-Z]{2,}\.com)/i
    );
    if (eAsAtPatternCom) {
      const localPart = eAsAtPatternCom[1];
      const domainWithE = eAsAtPatternCom[2]; // "findup.com"
      const possibleEmail = `${localPart}@${domainWithE}`;
      console.log(
        `[extractEmail] ${context} - "e" detectado como possível @ (.com): "${possibleEmail}"`
      );
      if (this.validateEmail(possibleEmail)) {
        console.log(
          `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (e -> @) (${context}): "${possibleEmail}"`
        );
        return possibleEmail;
      }
    }

    // Segundo, tenta detectar padrão repetido (ex: "zacQzac" -> @ deveria estar no meio)
    // Procura por padrão: letras + Q/Z/O/0 + mesma sequência de letras
    const repeatedPattern = sourceLine.match(/([a-z]{2,})[QZO0]\1/i);
    if (repeatedPattern) {
      const base = repeatedPattern[1]; // "zac"
      const beforeRepeat = sourceLine.substring(
        0,
        sourceLine.indexOf(repeatedPattern[0])
      ); // "contabil"

      // Procura o domínio (.com.br) no texto completo
      const comBrIndex = sourceLine.toLowerCase().indexOf('.com.br');
      if (comBrIndex !== -1) {
        // Pega o que vem DEPOIS do padrão repetido até .com.br
        const patternEndIndex =
          sourceLine.indexOf(repeatedPattern[0]) + repeatedPattern[0].length;
        const afterPattern = sourceLine.substring(patternEndIndex); // "assessoria.com.br tm) 3132-0674"

        // Procura onde começa o domínio (antes de .com.br)
        const beforeComBrInAfter = afterPattern.substring(
          0,
          afterPattern.toLowerCase().indexOf('.com.br')
        );
        const lastSpace = beforeComBrInAfter.lastIndexOf(' ');
        const lastDot = beforeComBrInAfter.lastIndexOf('.');
        const separatorIndex = Math.max(lastSpace, lastDot);

        let domain: string;
        if (separatorIndex !== -1) {
          // Pega apenas a parte final do domínio (depois do separador)
          domain = afterPattern.substring(
            separatorIndex + 1,
            afterPattern.toLowerCase().indexOf('.com.br') + 7
          );
        } else {
          // Se não encontrou separador, pega tudo até .com.br (depois do padrão)
          domain = afterPattern.substring(
            0,
            afterPattern.toLowerCase().indexOf('.com.br') + 7
          );
        }

        const possibleEmail = `${beforeRepeat}@${domain}`;
        console.log(
          `[extractEmail] ${context} - padrão repetido detectado: "${repeatedPattern[0]}"`
        );
        console.log(
          `[extractEmail] ${context} - beforeRepeat: "${beforeRepeat}", afterPattern: "${afterPattern}", domain: "${domain}"`
        );
        console.log(
          `[extractEmail] ${context} - tentativa inline (padrão repetido): "${possibleEmail}"`
        );
        const isValid = this.validateEmail(possibleEmail);
        console.log(`[extractEmail] ${context} - é válido? ${isValid}`);
        if (isValid) {
          console.log(
            `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (inline) (${context}): "${possibleEmail}"`
          );
          return possibleEmail;
        }
      }
    }

    // Se não encontrou padrão repetido, tenta a abordagem original
    const inlinePattern =
      /([a-zA-Z0-9._%+-]{3,})[&QZO0]([a-zA-Z0-9._%+-]+(?:\.[a-zA-Z]{2,}))/gi;
    let match: RegExpExecArray | null;

    while ((match = inlinePattern.exec(sourceLine)) !== null) {
      let localPart = match[1];
      const domainPart = match[2]?.toLowerCase();
      if (!domainPart || !domainPart.includes('.')) continue;

      const firstLabel = domainPart.split('.')[0];
      if (firstLabel && firstLabel.length >= 2) {
        for (let trim = Math.min(firstLabel.length, 4); trim >= 2; trim--) {
          if (
            localPart.length - trim >= 3 &&
            localPart.slice(-trim).toLowerCase() ===
              firstLabel.slice(0, trim).toLowerCase()
          ) {
            console.log(
              `[extractEmail] ${context} - removendo duplicação "${localPart.slice(
                -trim
              )}" do final do local`
            );
            localPart = localPart.slice(0, -trim);
            break;
          }
        }
      }

      const possibleEmail = `${localPart}@${domainPart}`;
      console.log(
        `[extractEmail] ${context} - tentativa inline: "${possibleEmail}"`
      );
      const isValid = this.validateEmail(possibleEmail);
      console.log(`[extractEmail] ${context} - é válido? ${isValid}`);
      if (isValid) {
        console.log(
          `[extractEmail]     EMAIL VÁLIDO CORRIGIDO (inline) (${context}): "${possibleEmail}"`
        );
        return possibleEmail;
      }
    }

    return undefined;
  }

  /**
   * Valida se um telefone tem formato válido
   */
  private validatePhone(phone: string): boolean {
    // Remove formatação
    const digits = phone.replace(/\D/g, '');

    // Deve ter 10 ou 11 dígitos
    if (digits.length !== 10 && digits.length !== 11) return false;

    // DDD deve ser válido (11-99)
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;

    // Telefone fixo: 10 dígitos, celular: 11 dígitos
    // Primeiro dígito após DDD deve ser 2-9 para fixo ou 9 para celular
    if (digits.length === 10) {
      const firstDigit = parseInt(digits[2]);
      if (firstDigit < 2 || firstDigit > 9) return false;
    } else if (digits.length === 11) {
      const firstDigit = parseInt(digits[2]);
      if (firstDigit !== 9) return false; // Celular sempre começa com 9
    }

    return true;
  }

  /**
   * Extrai Telefone seguindo a mesma estratégia do CNPJ (bem-sucedida)
   * PRIORIDADE 1: Detecção linha por linha (label "Telefone" e valor na mesma ou próxima linha)
   * PRIORIDADE 1.5: Busca nas linhas mesmo sem label (quando OCR não lê bem o label)
   * PRIORIDADE 2: Regex no texto completo (fallback)
   */
  private extractPhone(text: string, lines: string[]): string | undefined {
    console.log('[extractPhone] 🎯 INÍCIO DA BUSCA POR TELEFONE');
    console.log('[extractPhone] Total de linhas:', lines.length);
    console.log('[extractPhone] 📋 TODAS AS LINHAS DO TEXTO:');
    lines.forEach((line, idx) => {
      console.log(`  [${idx}] "${line}"`);
    });
    console.log('----------------------------------------');

    // Gera lista de todos os telefones encontrados no texto (para fallback)
    const allPhoneMatches = text.match(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/g);
    const phonePatterns: string[] = [];
    if (allPhoneMatches) {
      console.log(
        '[extractPhone] 🔍 TELEFONES ENCONTRADOS NO TEXTO COMPLETO:',
        allPhoneMatches
      );
      allPhoneMatches.forEach((match) => {
        let phone = match.trim();
        console.log(`  Verificando: "${phone}"`);
        // Normaliza formato
        if (!phone.includes('(')) {
          const digits = phone.replace(/\D/g, '');
          console.log(
            `    Dígitos extraídos: "${digits}" (${digits.length} dígitos)`
          );
          if (digits.length === 10) {
            phone = `(${digits.slice(0, 2)}) ${digits.slice(
              2,
              6
            )}-${digits.slice(6)}`;
            console.log(`    Formatado (10 dígitos): "${phone}"`);
          } else if (digits.length === 11) {
            phone = `(${digits.slice(0, 2)}) ${digits.slice(
              2,
              7
            )}-${digits.slice(7)}`;
            console.log(`    Formatado (11 dígitos): "${phone}"`);
          }
        }
        const isValid = this.validatePhone(phone);
        console.log(`    É válido? ${isValid}`);
        if (isValid && !phonePatterns.includes(phone)) {
          phonePatterns.push(phone);
        }
      });
      console.log(
        '[extractPhone] 📋 Telefones válidos após validação:',
        phonePatterns
      );
    } else {
      console.log(
        '[extractPhone] ⚠️ NENHUM TELEFONE FORMATADO ENCONTRADO NO TEXTO COMPLETO'
      );
      // Tenta encontrar números que podem ser telefones sem formatação
      const allDigits = text.replace(/\D/g, '');
      console.log('[extractPhone] 🔍 Buscando sequências de 8-11 dígitos...');
      for (let i = 0; i <= allDigits.length - 8; i++) {
        for (let len = 8; len <= 11 && i + len <= allDigits.length; len++) {
          const seq = allDigits.substring(i, i + len);
          console.log(`  Sequência de ${len} dígitos: "${seq}"`);
        }
      }
    }

    // PRIORIDADE 1: Detecção linha por linha - procura label "Telefone" e pega valor na mesma ou próxima linha
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      // Verifica se é um label de telefone (várias variações)
      const isPhoneLabel =
        normalizedLine === 'telefone' ||
        normalizedLine.match(/^telefone[:\-]?$/i) ||
        normalizedLine.match(/telefone[:\-]?\s*$/i);

      if (isPhoneLabel) {
        console.log(
          '[extractPhone]   Label telefone encontrado na linha',
          i,
          ':',
          lines[i]
        );

        // PRIORIDADE 1.1: Procura na mesma linha após "Telefone"
        const sameLineMatch = lines[i].match(
          /telefone[:\-]?\s*(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/i
        );
        if (sameLineMatch && sameLineMatch[1]) {
          let phone = sameLineMatch[1].trim();
          // Formata se necessário
          if (!phone.includes('(')) {
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
              phone = `(${digits.slice(0, 2)}) ${digits.slice(
                2,
                6
              )}-${digits.slice(6)}`;
            } else if (digits.length === 11) {
              phone = `(${digits.slice(0, 2)}) ${digits.slice(
                2,
                7
              )}-${digits.slice(7)}`;
            }
          }
          console.log(
            '[extractPhone] Telefone encontrado na mesma linha:',
            phone
          );
          if (this.validatePhone(phone)) {
            console.log(
              '[extractPhone]     TELEFONE VÁLIDO RETORNADO DA MESMA LINHA:',
              phone
            );
            return phone;
          }
        }

        // PRIORIDADE 1.2: Procura na próxima linha (mais comum)
        console.log(
          '[extractPhone] 🔍 Procurando telefone nas próximas 3 linhas após label...'
        );
        for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
          const candidateLine = lines[j].trim();
          console.log(`  [${j}] Verificando linha: "${candidateLine}"`);

          // Se a linha está vazia, pula
          if (!candidateLine) {
            console.log(`    ⏭️ Linha vazia, pulando...`);
            continue;
          }

          // Se encontrou outro label conhecido, para a busca
          if (
            candidateLine.match(
              /^(?:email|e-mail|cnpj|razão|razao|endereço|endereco|inscrição|inscricao|dados|contato)/i
            )
          ) {
            console.log(`    ⛔ Label conhecido encontrado, parando busca`);
            break;
          }

          // Procura telefone formatado na linha candidata
          const formattedMatch = candidateLine.match(
            /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/
          );
          console.log(`    Regex match (formatado):`, formattedMatch);
          if (formattedMatch && formattedMatch[1]) {
            let phone = formattedMatch[1].trim();
            console.log(`    Telefone encontrado (formatado): "${phone}"`);
            // Formata se necessário
            if (!phone.includes('(')) {
              const digits = phone.replace(/\D/g, '');
              console.log(
                `      Dígitos extraídos: "${digits}" (${digits.length} dígitos)`
              );
              if (digits.length === 10) {
                phone = `(${digits.slice(0, 2)}) ${digits.slice(
                  2,
                  6
                )}-${digits.slice(6)}`;
                console.log(`      Formatado (10 dígitos): "${phone}"`);
              } else if (digits.length === 11) {
                phone = `(${digits.slice(0, 2)}) ${digits.slice(
                  2,
                  7
                )}-${digits.slice(7)}`;
                console.log(`      Formatado (11 dígitos): "${phone}"`);
              }
            }
            const isValid = this.validatePhone(phone);
            console.log(`    É válido? ${isValid}`);
            if (isValid) {
              console.log(
                '[extractPhone]     TELEFONE VÁLIDO RETORNADO DA PRÓXIMA LINHA:',
                phone
              );
              return phone;
            }
          }

          // Tenta detectar padrão com DDD mal lido (ex: "tm) 3132-0674" ou "XX) número")
          // O usuário disse que o que está dentro de () é DDD, então "tm)" pode ser DDD mal lido
          const dddMalLidoMatch = candidateLine.match(
            /([a-z]{1,3}\)?\s*)(\d{4,5}-?\d{4})/i
          );
          if (dddMalLidoMatch && dddMalLidoMatch[2]) {
            const phoneNumber = dddMalLidoMatch[2].trim();
            console.log(
              `    ⚠️ Telefone com possível DDD mal lido: "${phoneNumber}"`
            );
            console.log(`    Contexto antes: "${dddMalLidoMatch[1]}"`);

            // Primeiro, tenta encontrar DDD numérico antes do texto mal lido
            const beforeText = candidateLine.substring(
              0,
              candidateLine.indexOf(dddMalLidoMatch[1])
            );
            const dddMatch = beforeText.match(/(\d{2})\s*\)?/);
            if (dddMatch && dddMatch[1]) {
              const ddd = dddMatch[1];
              const digits = phoneNumber.replace(/\D/g, '');
              let phone;
              if (digits.length === 8) {
                phone = `(${ddd}) ${digits.slice(0, 4)}-${digits.slice(4)}`;
              } else if (digits.length === 9) {
                phone = `(${ddd}) ${digits.slice(0, 5)}-${digits.slice(5)}`;
              } else {
                phone = `(${ddd}) ${phoneNumber}`;
              }
              console.log(`    Telefone com DDD encontrado antes: "${phone}"`);
              const isValid = this.validatePhone(phone);
              console.log(`    É válido? ${isValid}`);
              if (isValid) {
                console.log(
                  '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD encontrado antes):',
                  phone
                );
                return phone;
              }
            }

            // Se não encontrou DDD antes, procura padrão "número) texto) número" na linha toda
            const fullLineMatch = candidateLine.match(
              /(\d{2})\s*\)?\s*[a-z]{0,3}\)?\s*(\d{4,5}-?\d{4})/i
            );
            if (fullLineMatch && fullLineMatch[1] && fullLineMatch[2]) {
              const ddd = fullLineMatch[1];
              const phoneNumber = fullLineMatch[2].trim();
              const digits = phoneNumber.replace(/\D/g, '');
              let phone;
              if (digits.length === 8) {
                phone = `(${ddd}) ${digits.slice(0, 4)}-${digits.slice(4)}`;
              } else if (digits.length === 9) {
                phone = `(${ddd}) ${digits.slice(0, 5)}-${digits.slice(5)}`;
              } else {
                phone = `(${ddd}) ${phoneNumber}`;
              }
              console.log(
                `    Telefone com DDD encontrado (padrão completo): "${phone}"`
              );
              const isValid = this.validatePhone(phone);
              console.log(`    É válido? ${isValid}`);
              if (isValid) {
                console.log(
                  '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD no padrão):',
                  phone
                );
                return phone;
              }
            }

            // Se ainda não encontrou, procura qualquer número de 2 dígitos na linha antes do telefone
            // que possa ser o DDD (mas não parte do número do telefone)
            const phoneDigits = phoneNumber.replace(/\D/g, '');
            const phoneIndex = candidateLine.indexOf(phoneNumber);
            const beforePhone = candidateLine.substring(0, phoneIndex);

            // Procura números de 2 dígitos antes do telefone que NÃO sejam parte do telefone
            const allTwoDigits = beforePhone.match(/(\d{2})/g);
            if (allTwoDigits) {
              console.log(
                `    Números de 2 dígitos encontrados antes do telefone:`,
                allTwoDigits
              );
              // Pega o último número de 2 dígitos antes do telefone (provavelmente é o DDD)
              // E verifica se não é parte do número do telefone
              for (let i = allTwoDigits.length - 1; i >= 0; i--) {
                const dddCandidate = allTwoDigits[i];
                const ddd = parseInt(dddCandidate);

                // Verifica se é um DDD válido (11-99)
                if (ddd >= 11 && ddd <= 99) {
                  // Verifica se esse número NÃO está no início do telefone
                  const phoneStartsWithDDD =
                    phoneDigits.startsWith(dddCandidate);
                  if (!phoneStartsWithDDD) {
                    // DDD válido e não é parte do telefone
                    let phone;
                    if (phoneDigits.length === 8) {
                      phone = `(${dddCandidate}) ${phoneDigits.slice(
                        0,
                        4
                      )}-${phoneDigits.slice(4)}`;
                    } else if (phoneDigits.length === 9) {
                      phone = `(${dddCandidate}) ${phoneDigits.slice(
                        0,
                        5
                      )}-${phoneDigits.slice(5)}`;
                    } else {
                      phone = `(${dddCandidate}) ${phoneNumber}`;
                    }
                    console.log(
                      `    Telefone com DDD encontrado (proximidade): "${phone}"`
                    );
                    const isValid = this.validatePhone(phone);
                    console.log(`    É válido? ${isValid}`);
                    if (isValid) {
                      console.log(
                        '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD por proximidade):',
                        phone
                      );
                      return phone;
                    }
                  } else {
                    console.log(
                      `    ⚠️ "${dddCandidate}" é parte do telefone, ignorando`
                    );
                  }
                }
              }
            }

            // Se ainda não encontrou e o telefone tem 8 dígitos, tenta usar os 2 primeiros como DDD
            // (caso o telefone esteja sem formatação mas tenha DDD incluído)
            if (phoneDigits.length === 10) {
              const possibleDDD = phoneDigits.slice(0, 2);
              const possiblePhone = phoneDigits.slice(2);
              const ddd = parseInt(possibleDDD);
              if (ddd >= 11 && ddd <= 99) {
                const phone = `(${possibleDDD}) ${possiblePhone.slice(
                  0,
                  4
                )}-${possiblePhone.slice(4)}`;
                console.log(
                  `    Tentando usar 2 primeiros dígitos como DDD: "${phone}"`
                );
                const isValid = this.validatePhone(phone);
                console.log(`    É válido? ${isValid}`);
                if (isValid) {
                  console.log(
                    '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD dos primeiros dígitos):',
                    phone
                  );
                  return phone;
                }
              }
            }
          }

          // Tenta sem pontuação (10 ou 11 dígitos)
          const digits = candidateLine.replace(/\D/g, '');
          console.log(
            `    Dígitos extraídos (sem formatação): "${digits}" (${digits.length} dígitos)`
          );
          if (digits.length === 10 || digits.length === 11) {
            let formatted;
            if (digits.length === 11) {
              formatted = `(${digits.slice(0, 2)}) ${digits.slice(
                2,
                7
              )}-${digits.slice(7)}`;
            } else {
              formatted = `(${digits.slice(0, 2)}) ${digits.slice(
                2,
                6
              )}-${digits.slice(6)}`;
            }
            console.log(`    Telefone formatado de dígitos: "${formatted}"`);
            const isValid = this.validatePhone(formatted);
            console.log(`    É válido? ${isValid}`);
            if (isValid) {
              console.log(
                '[extractPhone]     TELEFONE VÁLIDO RETORNADO DE DÍGITOS:',
                formatted
              );
              return formatted;
            }
          } else if (digits.length >= 8 && digits.length < 10) {
            // Pode ser telefone sem DDD (8 ou 9 dígitos)
            // Mas antes, tenta procurar DDD na linha inteira antes do número
            const phoneNumberMatch = candidateLine.match(/(\d{4,5}-?\d{4})/);
            if (phoneNumberMatch) {
              const phoneNumber = phoneNumberMatch[1];
              const beforeNumber = candidateLine.substring(
                0,
                candidateLine.indexOf(phoneNumber)
              );
              const dddMatch = beforeNumber.match(/(\d{2})\s*\)?/);
              if (dddMatch && dddMatch[1]) {
                const ddd = dddMatch[1];
                const phoneDigits = phoneNumber.replace(/\D/g, '');
                let phone;
                if (phoneDigits.length === 8) {
                  phone = `(${ddd}) ${phoneDigits.slice(
                    0,
                    4
                  )}-${phoneDigits.slice(4)}`;
                } else if (phoneDigits.length === 9) {
                  phone = `(${ddd}) ${phoneDigits.slice(
                    0,
                    5
                  )}-${phoneDigits.slice(5)}`;
                } else {
                  phone = `(${ddd}) ${phoneNumber}`;
                }
                console.log(
                  `    Telefone com DDD encontrado antes do número: "${phone}"`
                );
                const isValid = this.validatePhone(phone);
                console.log(`    É válido? ${isValid}`);
                if (isValid) {
                  console.log(
                    '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD antes do número):',
                    phone
                  );
                  return phone;
                }
              }

              // Se não encontrou DDD antes, tenta interpretar "tm)" como DDD mal lido
              // e procurar o DDD correto antes dele ou tentar usar os primeiros dígitos
              const phoneDigits = phoneNumber.replace(/\D/g, '');
              console.log(
                `    Dígitos do telefone: "${phoneDigits}" (${phoneDigits.length} dígitos)`
              );

              // Se o telefone tem 8 dígitos e começa com números que podem ser DDD
              if (phoneDigits.length === 8) {
                const firstTwo = phoneDigits.slice(0, 2);
                const rest = phoneDigits.slice(2);
                const ddd = parseInt(firstTwo);
                console.log(
                  `    Primeiros 2 dígitos: "${firstTwo}" (DDD possível: ${ddd})`
                );
                console.log(`    Resto: "${rest}" (${rest.length} dígitos)`);

                // Se os primeiros 2 dígitos são um DDD válido, tenta usar como DDD
                // Mas o resto teria apenas 6 dígitos, o que não é válido para telefone
                // A menos que o formato esteja completamente errado

                // Alternativa: pode ser que o número seja "3132-0674" onde:
                // - "31" é DDD
                // - "32-0674" é o número (mas tem apenas 6 dígitos)
                // Isso não é válido, mas vou tentar formatar mesmo assim para ver se passa na validação
                if (ddd >= 11 && ddd <= 99) {
                  // Tenta formatar como se "32-0674" fosse um telefone de 6 dígitos
                  // (formato antigo de telefone fixo)
                  const phone = `(${firstTwo}) ${rest.slice(0, 2)}-${rest.slice(
                    2
                  )}`;
                  console.log(`    Tentando formato alternativo: "${phone}"`);
                  const isValid = this.validatePhone(phone);
                  console.log(`    É válido? ${isValid}`);
                  if (isValid) {
                    console.log(
                      '[extractPhone]     TELEFONE VÁLIDO RETORNADO (DDD dos primeiros dígitos - formato alternativo):',
                      phone
                    );
                    return phone;
                  }
                }
              }
            }
            console.log(
              `    ⚠️ Possível telefone sem DDD (${digits.length} dígitos): "${digits}"`
            );
          }
        }

        // Se encontrou label, para a busca (não continua procurando em outras linhas)
        break;
      }
    }

    // PRIORIDADE 1.5: Procura telefone formatado nas linhas mesmo sem label "Telefone"
    // Isso ajuda quando o OCR não leu bem o label
    console.log(
      '[extractPhone] 🔍 BUSCANDO TELEFONE NAS LINHAS (sem label)...'
    );
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Procura telefone formatado na linha
      const phoneMatch = line.match(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/);
      if (phoneMatch) {
        let phone = phoneMatch[1].trim();
        console.log(`  [${i}] Linha: "${line}"`);
        console.log(`      Telefone encontrado: "${phone}"`);

        // Normaliza formato
        if (!phone.includes('(')) {
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            phone = `(${digits.slice(0, 2)}) ${digits.slice(
              2,
              6
            )}-${digits.slice(6)}`;
          } else if (digits.length === 11) {
            phone = `(${digits.slice(0, 2)}) ${digits.slice(
              2,
              7
            )}-${digits.slice(7)}`;
          }
        }

        // Validação
        if (this.validatePhone(phone)) {
          console.log(
            `[extractPhone]     TELEFONE VÁLIDO ENCONTRADO NA LINHA ${i}: "${phone}"`
          );
          return phone;
        }
      }

      // Tenta detectar padrão com DDD mal lido (ex: "tm) 3132-0674")
      const dddMalLidoMatch = line.match(/([a-z]{1,3}\)?\s*)(\d{4,5}-?\d{4})/i);
      if (dddMalLidoMatch && dddMalLidoMatch[2]) {
        const phoneNumber = dddMalLidoMatch[2].trim();
        console.log(
          `    ⚠️ Telefone com possível DDD mal lido: "${phoneNumber}"`
        );

        // Procura DDD numérico antes do texto mal lido ou no padrão completo
        const fullLineMatch = line.match(
          /(\d{2})\s*\)?\s*[a-z]{0,3}\)?\s*(\d{4,5}-?\d{4})/i
        );
        if (fullLineMatch && fullLineMatch[1] && fullLineMatch[2]) {
          const ddd = fullLineMatch[1];
          const phoneNumber = fullLineMatch[2].trim();
          const digits = phoneNumber.replace(/\D/g, '');
          let phone;
          if (digits.length === 8) {
            phone = `(${ddd}) ${digits.slice(0, 4)}-${digits.slice(4)}`;
          } else if (digits.length === 9) {
            phone = `(${ddd}) ${digits.slice(0, 5)}-${digits.slice(5)}`;
          } else {
            phone = `(${ddd}) ${phoneNumber}`;
          }
          console.log(`    Telefone com DDD encontrado: "${phone}"`);
          const isValid = this.validatePhone(phone);
          console.log(`    É válido? ${isValid}`);
          if (isValid) {
            console.log(
              `[extractPhone]     TELEFONE VÁLIDO ENCONTRADO NA LINHA ${i} (DDD mal lido): "${phone}"`
            );
            return phone;
          }
        }
      }

      // Tenta sem pontuação (10 ou 11 dígitos)
      const digits = line.replace(/\D/g, '');
      console.log(
        `    Dígitos extraídos (sem formatação): "${digits}" (${digits.length} dígitos)`
      );
      if (digits.length === 10 || digits.length === 11) {
        let formatted;
        if (digits.length === 11) {
          formatted = `(${digits.slice(0, 2)}) ${digits.slice(
            2,
            7
          )}-${digits.slice(7)}`;
        } else {
          formatted = `(${digits.slice(0, 2)}) ${digits.slice(
            2,
            6
          )}-${digits.slice(6)}`;
        }
        console.log(`    Telefone formatado de dígitos: "${formatted}"`);
        const isValid = this.validatePhone(formatted);
        console.log(`    É válido? ${isValid}`);
        if (isValid) {
          console.log(
            `[extractPhone]     TELEFONE VÁLIDO ENCONTRADO NA LINHA ${i} (dígitos): "${formatted}"`
          );
          return formatted;
        }
      } else if (digits.length >= 8 && digits.length < 10) {
        // Pode ser telefone sem DDD (8 ou 9 dígitos)
        // Mas antes, tenta procurar DDD na linha antes do número
        const phoneNumberMatch = line.match(/(\d{4,5}-?\d{4})/);
        if (phoneNumberMatch) {
          const phoneNumber = phoneNumberMatch[1];
          const beforeNumber = line.substring(0, line.indexOf(phoneNumber));
          const dddMatch = beforeNumber.match(/(\d{2})\s*\)?/);
          if (dddMatch && dddMatch[1]) {
            const ddd = dddMatch[1];
            const phoneDigits = phoneNumber.replace(/\D/g, '');
            let phone;
            if (phoneDigits.length === 8) {
              phone = `(${ddd}) ${phoneDigits.slice(0, 4)}-${phoneDigits.slice(
                4
              )}`;
            } else if (phoneDigits.length === 9) {
              phone = `(${ddd}) ${phoneDigits.slice(0, 5)}-${phoneDigits.slice(
                5
              )}`;
            } else {
              phone = `(${ddd}) ${phoneNumber}`;
            }
            console.log(
              `    Telefone com DDD encontrado antes do número: "${phone}"`
            );
            const isValid = this.validatePhone(phone);
            console.log(`    É válido? ${isValid}`);
            if (isValid) {
              console.log(
                `[extractPhone]     TELEFONE VÁLIDO ENCONTRADO NA LINHA ${i} (DDD antes): "${phone}"`
              );
              return phone;
            }
          }

          // Se não encontrou DDD antes, tenta usar os primeiros dígitos como DDD
          const phoneDigits = phoneNumber.replace(/\D/g, '');
          if (phoneDigits.length === 8) {
            const firstTwo = phoneDigits.slice(0, 2);
            const rest = phoneDigits.slice(2);
            const ddd = parseInt(firstTwo);
            console.log(
              `    Primeiros 2 dígitos: "${firstTwo}" (DDD possível: ${ddd})`
            );
            console.log(`    Resto: "${rest}" (${rest.length} dígitos)`);

            if (ddd >= 11 && ddd <= 99) {
              // Tenta formatar como se "32-0674" fosse um telefone de 6 dígitos
              const phone = `(${firstTwo}) ${rest.slice(0, 2)}-${rest.slice(
                2
              )}`;
              console.log(`    Tentando formato alternativo: "${phone}"`);
              const isValid = this.validatePhone(phone);
              console.log(`    É válido? ${isValid}`);
              if (isValid) {
                console.log(
                  `[extractPhone]     TELEFONE VÁLIDO ENCONTRADO NA LINHA ${i} (DDD dos primeiros dígitos): "${phone}"`
                );
                return phone;
              }
            }
          }
        }
        console.log(
          `    ⚠️ Possível telefone sem DDD (${digits.length} dígitos): "${digits}"`
        );
      }
    }

    // PRIORIDADE 2: Se não encontrou linha por linha, tenta usar a lista de telefones encontrados
    console.log(
      '[extractPhone] 🔄 FALLBACK: Usando lista de telefones encontrados...'
    );
    if (phonePatterns && phonePatterns.length > 0) {
      console.log(
        `  📋 Verificando ${phonePatterns.length} telefones encontrados...`
      );
      for (const phone of phonePatterns) {
        console.log(`  🔍 Verificando: "${phone}"`);
        if (this.validatePhone(phone)) {
          console.log(
            `[extractPhone]     TELEFONE VÁLIDO RETORNADO DO FALLBACK (lista): "${phone}"`
          );
          return phone;
        }
      }
    }

    // PRIORIDADE 3: Regex no texto completo (último recurso)
    const regexMatch = text.match(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/);
    if (regexMatch && regexMatch[1]) {
      let phone = regexMatch[1].trim();
      // Formata se necessário
      if (!phone.includes('(')) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
          phone = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(
            6
          )}`;
        } else if (digits.length === 11) {
          phone = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(
            7
          )}`;
        }
      }
      if (this.validatePhone(phone)) {
        console.log(
          '[extractPhone]     TELEFONE VÁLIDO RETORNADO DO FALLBACK (regex):',
          phone
        );
        return phone;
      }
    }

    console.log('[extractPhone] ❌❌❌ NENHUM TELEFONE VÁLIDO ENCONTRADO');
    console.log('========================================');
    console.log('[extractPhone] 📤 RESULTADO FINAL:');
    console.log('  Retornando: undefined');
    console.log(
      '  Motivo: Nenhum telefone válido encontrado após todas as tentativas'
    );
    console.log('========================================');
    return undefined;
  }

  /**
   * Encontra valor após uma keyword usando lógica posicional
   * Procura na mesma linha ou na linha seguinte
   */
  private findValueAfterKeyword(
    lines: string[],
    keywords: string[],
    options: {
      sameLine?: boolean;
      nextLine?: boolean;
      // validate?: (value: string) => boolean;
    } = {}
  ): string | undefined {
    const { sameLine = false, nextLine = true, validate } = options;

    const context = keywords.join('|');
    console.log(`[findValueAfterKeyword] 🔍 Buscando: "${context}"`);
    console.log(
      `[findValueAfterKeyword]   sameLine: ${sameLine}, nextLine: ${nextLine}`
    );

    for (let i = 0; i < lines.length; i++) {
      const line = this.normalizeText(lines[i]).toLowerCase();
      console.log(
        `[findValueAfterKeyword]   [${i}] Verificando linha: "${lines[i]}"`
      );

      // Verifica se a linha contém alguma keyword
      const hasKeyword = keywords.some((keyword) =>
        line.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        const matchedKeyword = keywords.find((k) =>
          line.includes(k.toLowerCase())
        );
        console.log(
          `[findValueAfterKeyword]     Keyword encontrado: "${matchedKeyword}" na linha ${i}`
        );

        // Tenta extrair da mesma linha
        if (sameLine) {
          console.log(
            `[findValueAfterKeyword]     Tentando extrair da mesma linha...`
          );
          const keywordIndex = keywords.findIndex((k) =>
            line.includes(k.toLowerCase())
          );
          if (keywordIndex !== -1) {
            const keyword = keywords[keywordIndex].toLowerCase();
            const keywordPos = line.indexOf(keyword);
            const afterKeyword = lines[i]
              .substring(keywordPos + keyword.length)
              .trim();
            console.log(
              `[findValueAfterKeyword]       Texto após keyword: "${afterKeyword}"`
            );

            // Remove dois pontos, hífen, etc.
            const cleaned = afterKeyword.replace(/^[:\-]\s*/, '').trim();
            console.log(
              `[findValueAfterKeyword]       Texto limpo: "${cleaned}"`
            );

            if (cleaned && (!validate || validate(cleaned))) {
              console.log(
                `[findValueAfterKeyword]           VALOR ENCONTRADO (mesma linha): "${cleaned}"`
              );
              return cleaned;
            } else {
              console.log(
                `[findValueAfterKeyword]       ❌ Validação falhou ou valor vazio`
              );
            }
          }
        }

        // Tenta extrair da próxima linha
        if (nextLine && i + 1 < lines.length) {
          console.log(
            `[findValueAfterKeyword]     Tentando extrair da próxima linha (${
              i + 1
            })...`
          );
          const nextLineText = this.normalizeText(lines[i + 1]);
          console.log(
            `[findValueAfterKeyword]       Próxima linha: "${nextLineText}"`
          );
          if (nextLineText && (!validate || validate(nextLineText))) {
            console.log(
              `[findValueAfterKeyword]           VALOR ENCONTRADO (próxima linha): "${nextLineText}"`
            );
            return nextLineText;
          } else {
            console.log(
              `[findValueAfterKeyword]       ❌ Validação falhou ou valor vazio`
            );
          }
        }
      }
    }

    console.log(`[findValueAfterKeyword] ❌ Nenhum valor encontrado`);
    return undefined;
  }

  /**
   * Separa razão social do nome fantasia quando estão na mesma linha
   * Exemplo: "Findup Tecnologia Em Sistemas Ltda Findup" ->
   *   razaoSocial: "Findup Tecnologia Em Sistemas Ltda"
   *   nomeFantasia: "Findup"
   */
  private separateRazaoSocialFromNomeFantasia(line: string): {
    razaoSocial?: string;
    nomeFantasia?: string;
  } {
    const words = line.trim().split(/\s+/);
    if (words.length < 3) {
      return {};
    }

    // Procura por padrão: última palavra repetida no início ou no meio
    const lastWord = words[words.length - 1];
    const secondLastWord = words[words.length - 2];

    // Se a última palavra é curta (até 15 caracteres) e aparece no início ou meio
    if (lastWord.length <= 15 && lastWord.length >= 2) {
      // Procura se essa palavra aparece antes na linha
      const lastWordIndex = words.findIndex(
        (w, idx) =>
          idx < words.length - 1 && w.toLowerCase() === lastWord.toLowerCase()
      );

      if (lastWordIndex !== -1) {
        // Encontrou palavra repetida - provavelmente nome fantasia no final
        let razaoSocial = words.slice(0, words.length - 1).join(' ');
        const nomeFantasia = lastWord;
        
        // Remove CPF da razão social
        razaoSocial = this.removeCPFFromRazaoSocial(razaoSocial);
        
        console.log(
          `[separateRazaoSocialFromNomeFantasia] Separando: "${line}" -> razaoSocial: "${razaoSocial}", nomeFantasia: "${nomeFantasia}"`
        );
        return { razaoSocial, nomeFantasia };
      }

      // Se a última palavra é muito curta (1-2 palavras) e a linha é longa,
      // pode ser nome fantasia separado
      if (lastWord.length <= 10 && words.length >= 4) {
        // Verifica se a penúltima palavra termina com "Ltda", "Ltd", "S.A.", etc
        if (secondLastWord.match(/ltda|lt\.?d\.?|s\.?a\.?|eireli|me|epp/i)) {
          let razaoSocial = words.slice(0, words.length - 1).join(' ');
          const nomeFantasia = lastWord;
          
          // Remove CPF da razão social
          razaoSocial = this.removeCPFFromRazaoSocial(razaoSocial);
          
          console.log(
            `[separateRazaoSocialFromNomeFantasia] Separando (padrão Ltda): "${line}" -> razaoSocial: "${razaoSocial}", nomeFantasia: "${nomeFantasia}"`
          );
          return { razaoSocial, nomeFantasia };
        }
      }
    }

    return {};
  }

  /**
   * Extrai Razão Social usando lógica posicional
   * Pega múltiplas linhas se necessário para capturar razão social completa
   */
  private extractRazaoSocial(lines: string[]): string | undefined {
    console.log('========================================');
    console.log('[extractRazaoSocial] 🎯 INÍCIO DA BUSCA POR RAZÃO SOCIAL');
    console.log(`[extractRazaoSocial] Total de linhas: ${lines.length}`);
    console.log('----------------------------------------');
    console.log('[extractRazaoSocial] 📋 TODAS AS LINHAS DO TEXTO:');
    lines.forEach((line, idx) => {
      console.log(`  [${idx}] "${line}"`);
    });
    console.log('----------------------------------------');

    const keywords = [
      'razão social',
      'razao social',
      'razão',
      'razao',
      'nome empresarial',
      'denominação',
      'denominacao',
    ];

    console.log(
      `[extractRazaoSocial] 🔍 Buscando keywords: ${keywords.join(', ')}`
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const hasKeyword = keywords.some((keyword) =>
        normalizedLine.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        console.log(
          `[extractRazaoSocial]   Keyword encontrado na linha ${i}: "${lines[i]}"`
        );
        // Tenta pegar da mesma linha primeiro
        const keywordIndex = keywords.findIndex((k) =>
          normalizedLine.includes(k.toLowerCase())
        );
        if (keywordIndex !== -1) {
          const keyword = keywords[keywordIndex].toLowerCase();
          console.log(
            `[extractRazaoSocial]   Keyword específico: "${keyword}"`
          );
          const keywordPos = normalizedLine.indexOf(keyword);
          const afterKeyword = lines[i]
            .substring(keywordPos + keyword.length)
            .trim();
          console.log(
            `[extractRazaoSocial]   Texto após keyword: "${afterKeyword}"`
          );

          const cleaned = afterKeyword.replace(/^[:\-]\s*/, '').trim();
          console.log(`[extractRazaoSocial]   Texto limpo: "${cleaned}"`);

          // Verifica se o texto após "razão social" é apenas outro label (ex: "Nome fantasia")
          const isAnotherLabel = cleaned.match(
            /^(?:nome\s+fantasia|fantasia|cnpj|inscrição|inscricao|endereço|endereco|dados|contato)/i
          );
          if (isAnotherLabel) {
            console.log(
              `[extractRazaoSocial]   ⚠️ Texto após keyword é outro label ("${cleaned}"), ignorando e tentando próxima linha...`
            );
            // Ignora o texto da mesma linha e tenta pegar da próxima linha
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              console.log(
                `[extractRazaoSocial]   Próxima linha: "${nextLine}"`
              );
              if (
                nextLine &&
                nextLine.length >= 5 &&
                !nextLine.match(/^\d+$/) &&
                !nextLine.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) &&
                !nextLine.match(
                  /^(?:cnpj|inscrição|inscricao|endereço|endereco|dados|contato|nome\s+fantasia|fantasia)/i
                )
              ) {
                // Tenta separar razão social do nome fantasia se estiverem juntos
                const separated =
                  this.separateRazaoSocialFromNomeFantasia(nextLine);
                let razaoSocial = separated.razaoSocial || nextLine;
                for (let j = i + 2; j < lines.length && j < i + 4; j++) {
                  const candidateLine = lines[j].trim();
                  console.log(
                    `[extractRazaoSocial]     Verificando linha ${j}: "${candidateLine}"`
                  );
                  if (
                    candidateLine.match(
                      /^(?:cnpj|inscrição|inscricao|endereço|endereco|dados|contato)/i
                    )
                  ) {
                    console.log(
                      `[extractRazaoSocial]     ⚠️ Label conhecido encontrado, parando`
                    );
                    break;
                  }
                  if (
                    candidateLine &&
                    !candidateLine.match(/^\d+$/) &&
                    !candidateLine.match(/@/) &&
                    !candidateLine.match(/\(\d{2}\)/) &&
                    candidateLine.length > 3
                  ) {
                    console.log(
                      `[extractRazaoSocial]       // Adicionando linha à razão social`
                    );
                    razaoSocial += ' ' + candidateLine;
                  } else {
                    console.log(
                      `[extractRazaoSocial]     ⚠️ Linha não parece continuar razão social, parando`
                    );
                    break;
                  }
                }
                // Remove qualquer ocorrência de "Nome fantasia" do resultado final
                let finalRazaoSocial = razaoSocial
                  .trim()
                  .replace(/\b(?:nome\s+fantasia|fantasia)\b/gi, '')
                  .trim();
                
                // Remove CPF da razão social
                finalRazaoSocial = this.removeCPFFromRazaoSocial(finalRazaoSocial);
                
                console.log(
                  `[extractRazaoSocial]     RAZÃO SOCIAL ENCONTRADA (próxima linha, label ignorado): "${finalRazaoSocial}"`
                );
                return finalRazaoSocial;
              }
            }
            // Se não conseguiu pegar da próxima linha, continua para a próxima iteração
            continue;
          }

          if (
            cleaned &&
            cleaned.length >= 5 &&
            !cleaned.match(/^\d+$/) &&
            !cleaned.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
          ) {
            console.log(
              `[extractRazaoSocial]     // Validação passou, tentando pegar linhas seguintes...`
            );
            // Se a linha seguinte não é outro label, pode continuar a razão social
            // Tenta separar razão social do nome fantasia se estiverem juntos
            const separated = this.separateRazaoSocialFromNomeFantasia(cleaned);
            let razaoSocial = separated.razaoSocial || cleaned;
            for (let j = i + 1; j < lines.length && j < i + 3; j++) {
              const nextLine = lines[j].trim();
              console.log(
                `[extractRazaoSocial]     Verificando linha ${j}: "${nextLine}"`
              );
              // Para se encontrar outro label conhecido
              if (
                nextLine.match(
                  /^(?:cnpj|inscrição|inscricao|endereço|endereco|dados|contato)/i
                )
              ) {
                console.log(
                  `[extractRazaoSocial]     ⚠️ Label conhecido encontrado, parando`
                );
                break;
              }
              // Se a linha parece continuar a razão social (não é número, email, telefone)
              if (
                nextLine &&
                !nextLine.match(/^\d+$/) &&
                !nextLine.match(/@/) &&
                !nextLine.match(/\(\d{2}\)/) &&
                nextLine.length > 3
              ) {
                console.log(
                  `[extractRazaoSocial]       // Adicionando linha à razão social`
                );
                razaoSocial += ' ' + nextLine;
              } else {
                console.log(
                  `[extractRazaoSocial]     ⚠️ Linha não parece continuar razão social, parando`
                );
                break;
              }
            }
            // Remove qualquer ocorrência de "Nome fantasia" do resultado final
            let finalRazaoSocial = razaoSocial
              .trim()
              .replace(/\b(?:nome\s+fantasia|fantasia)\b/gi, '')
              .trim();
            
            // Remove CPF da razão social
            finalRazaoSocial = this.removeCPFFromRazaoSocial(finalRazaoSocial);
            
            console.log(
              `[extractRazaoSocial]     RAZÃO SOCIAL ENCONTRADA (mesma linha): "${finalRazaoSocial}"`
            );
            return finalRazaoSocial;
          } else {
            console.log(`[extractRazaoSocial]   ❌ Validação falhou`);
          }
        }

        // Se não encontrou na mesma linha, tenta próxima linha
        if (i + 1 < lines.length) {
          console.log(
            `[extractRazaoSocial]   Tentando próxima linha (${i + 1})...`
          );
          let nextLine = lines[i + 1].trim();
          console.log(`[extractRazaoSocial]   Próxima linha: "${nextLine}"`);
          if (
            nextLine &&
            nextLine.length >= 5 &&
            !nextLine.match(/^\d+$/) &&
            !nextLine.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) &&
            !nextLine.match(
              /^(?:cnpj|inscrição|inscricao|endereço|endereco|dados|contato|nome\s+fantasia|fantasia)/i
            )
          ) {
            console.log(
              `[extractRazaoSocial]     // Validação passou, tentando pegar linhas seguintes...`
            );
            // Pega múltiplas linhas se necessário
            // Tenta separar razão social do nome fantasia se estiverem juntos
            const separated =
              this.separateRazaoSocialFromNomeFantasia(nextLine);
            let razaoSocial = separated.razaoSocial || nextLine;
            for (let j = i + 2; j < lines.length && j < i + 4; j++) {
              const candidateLine = lines[j].trim();
              console.log(
                `[extractRazaoSocial]     Verificando linha ${j}: "${candidateLine}"`
              );
              // Para se encontrar outro label conhecido
              if (
                candidateLine.match(
                  /^(?:cnpj|inscrição|inscricao|endereço|endereco|dados|contato)/i
                )
              ) {
                console.log(
                  `[extractRazaoSocial]     ⚠️ Label conhecido encontrado, parando`
                );
                break;
              }
              // Se a linha parece continuar a razão social
              if (
                candidateLine &&
                !candidateLine.match(/^\d+$/) &&
                !candidateLine.match(/@/) &&
                !candidateLine.match(/\(\d{2}\)/) &&
                candidateLine.length > 3
              ) {
                console.log(
                  `[extractRazaoSocial]       // Adicionando linha à razão social`
                );
                razaoSocial += ' ' + candidateLine;
              } else {
                console.log(
                  `[extractRazaoSocial]     ⚠️ Linha não parece continuar razão social, parando`
                );
                break;
              }
            }
            // Remove qualquer ocorrência de "Nome fantasia" do resultado final
            let finalRazaoSocial = razaoSocial
              .trim()
              .replace(/\b(?:nome\s+fantasia|fantasia)\b/gi, '')
              .trim();
            
            // Remove CPF da razão social
            finalRazaoSocial = this.removeCPFFromRazaoSocial(finalRazaoSocial);
            
            console.log(
              `[extractRazaoSocial]     RAZÃO SOCIAL ENCONTRADA (próxima linha): "${finalRazaoSocial}"`
            );
            return finalRazaoSocial;
          } else {
            console.log(
              `[extractRazaoSocial]   ❌ Validação falhou na próxima linha`
            );
          }
        }
      }
    }

    console.log('[extractRazaoSocial] ❌❌❌ NENHUMA RAZÃO SOCIAL ENCONTRADA');
    console.log('========================================');
    return undefined;
  }

  /**
   * Extrai Nome Fantasia usando lógica posicional
   */
  private extractNomeFantasia(lines: string[]): string | undefined {
    console.log('========================================');
    console.log('[extractNomeFantasia] 🎯 INÍCIO DA BUSCA POR NOME FANTASIA');
    console.log(`[extractNomeFantasia] Total de linhas: ${lines.length}`);
    console.log('----------------------------------------');
    console.log('[extractNomeFantasia] 📋 TODAS AS LINHAS DO TEXTO:');
    lines.forEach((line, idx) => {
      console.log(`  [${idx}] "${line}"`);
    });
    console.log('----------------------------------------');

    const keywords = ['nome fantasia', 'fantasia', 'nome de fantasia'];
    console.log(
      `[extractNomeFantasia] 🔍 Buscando keywords: ${keywords.join(', ')}`
    );

    let result = this.findValueAfterKeyword(lines, keywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        const isValid = value.length >= 3 && !value.match(/^\d+$/);
        console.log(
          `[extractNomeFantasia]   Validando: "${value}" -> ${
            isValid ? ' ' : '❌'
          }`
        );
        return isValid;
      },
    });

    // Se encontrou resultado, tenta separar razão social do nome fantasia
    if (result) {
      const separated = this.separateRazaoSocialFromNomeFantasia(result);
      if (separated.nomeFantasia) {
        console.log(
          `[extractNomeFantasia]   🔍 Separando nome fantasia: "${result}" -> "${separated.nomeFantasia}"`
        );
        result = separated.nomeFantasia;
      }
    }

    if (result) {
      console.log(
        `[extractNomeFantasia]     NOME FANTASIA ENCONTRADO: "${result}"`
      );
    } else {
      console.log(
        '[extractNomeFantasia] ❌❌❌ NENHUM NOME FANTASIA ENCONTRADO'
      );
    }
    console.log('========================================');

    return result;
  }

  /**
   * Extrai Endereço completo usando lógica posicional e regex
   */
  private extractAddress(lines: string[]): {
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  } {
    const result: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
    } = {};

    // Extrai Rua/Logradouro
    const ruaKeywords = [
      'rua / logradouro',
      'rua/logradouro',
      'rua',
      'avenida',
      'av.',
      'av',
      'logradouro',
      'endereço',
      'endereco',
    ];

    // PRIORIDADE 1: Procura "Rua / Logradouro" especificamente
    let endereco: string | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      // Verifica se é label de rua/logradouro
      const isRuaLabel =
        normalizedLine === 'rua / logradouro' ||
        normalizedLine === 'rua/logradouro' ||
        normalizedLine.match(/^rua\s*\/\s*logradouro$/i);

      if (isRuaLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Valida se parece um endereço
        if (
          nextLine &&
          nextLine.length >= 5 &&
          !nextLine.match(/^\d+$/) &&
          !nextLine.match(/^\d{5}-\d{3}$/) &&
          !nextLine.match(/^[A-Z]{2}$/) &&
          !nextLine.match(
            /^(?:número|numero|cep|bairro|distrito|cidade|uf|estado)/i
          )
        ) {
          endereco = nextLine;
          break;
        }
      }
    }

    // PRIORIDADE 2: Se não encontrou, usa método genérico
    if (!endereco) {
      endereco = this.findValueAfterKeyword(lines, ruaKeywords, {
        sameLine: true,
        nextLine: true,
        validate: (value) => {
          // Validação: deve ter pelo menos 5 caracteres e parecer um endereço
          const hasAddressWords =
            /\b(?:rua|avenida|av|logradouro|estrada|rodovia)/i.test(value);
          const hasMultipleWords = value.split(/\s+/).length >= 2;

          return (
            value.length >= 5 &&
            !/^\d+$/.test(value) &&
            !/^\d{5}-\d{3}$/.test(value) &&
            !/^[A-Z]{2}$/.test(value) &&
            !/^(?:número|numero|cep|bairro|distrito|cidade|uf|estado)/i.test(
              value
            ) &&
            (hasAddressWords || hasMultipleWords)
          );
        },
      });
    }

    if (endereco) {
      // Tenta separar número do endereço
      const numeroMatch = endereco.match(/,?\s*(\d+)(?:\s*-\s*.*)?$/);
      if (numeroMatch) {
        result.endereco = endereco.replace(/,?\s*\d+.*$/, '').trim();
        result.numero = numeroMatch[1];
      } else {
        result.endereco = endereco;
      }
    }

    // Extrai Número (se não foi extraído do endereço)
    if (!result.numero) {
      const numeroKeywords = ['número', 'numero', 'nº', 'n░'];
      const numero = this.findValueAfterKeyword(lines, numeroKeywords, {
        sameLine: true,
        nextLine: true,
        validate: (value) => {
          return /^\d+/.test(value) === true;
        },
      });
      if (numero) {
        result.numero = numero.match(/\d+/)?.[0];
      }
    }

    // Extrai Complemento
    const complementoKeywords = ['complemento', 'compl.', 'compl'];
    result.complemento = this.findValueAfterKeyword(
      lines,
      complementoKeywords,
      {
        sameLine: true,
        nextLine: true,
        validate: (value) => {
          // Validação: não deve ser placeholder ou label
          const isValid =
            value.length >= 2 &&
            !value.match(
              /^(?:bairro|distrito|uf|estado|cidade|número|numero|cep)/i
            ) &&
            !value.match(/\/\s*(?:distrito|distrto|uf|estado)/i) &&
            !value.match(/^\d+$/); // Não é só número
          return isValid;
        },
      }
    );

    // Extrai Bairro
    const bairroKeywords = [
      'bairro / distrito',
      'bairro/distrito',
      'bairro',
      'distrito',
    ];
    result.bairro = this.findValueAfterKeyword(lines, bairroKeywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        // Validação: não deve ser placeholder ou label
        return (
          value.length >= 3 &&
          !value.match(/^\d+$/) &&
          !value.match(
            /^(?:uf|estado|cidade|número|numero|cep|complemento)/i
          ) &&
          !value.match(/\/\s*(?:distrito|distrto|uf|estado)/i) &&
          !value.match(/^\//) // Não começa com "/"
        );
      },
    });

    // Extrai Cidade
    const cidadeKeywords = ['cidade', 'município', 'municipio'];
    result.cidade = this.findValueAfterKeyword(lines, cidadeKeywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        return (
          value.length >= 3 &&
          !value.match(/^\d+$/) &&
          !value.match(/^[A-Z]{2}$/)
        );
      },
    });

    // Extrai UF/Estado
    const ufKeywords = ['uf', 'estado', 'uf / estado', 'uf/estado'];
    const uf = this.findValueAfterKeyword(lines, ufKeywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        // UF deve ter 2 letras maiúsculas
        return /^[A-Z]{2}$/.test(value.trim());
      },
    });
    if (uf) {
      result.uf = uf.trim().toUpperCase();
    } else {
      // Tenta encontrar UF no final de linhas (padrão comum: "Cidade - UF")
      for (const line of lines) {
        const ufMatch = line.match(/\s-\s([A-Z]{2})$/);
        if (ufMatch) {
          result.uf = ufMatch[1];
          break;
        }
      }
    }

    return result;
  }

  /**
   * Extrai Inscrição Estadual
   */
  private extractInscricaoEstadual(lines: string[]): string | undefined {
    const keywords = [
      'inscrição estadual',
      'inscricao estadual',
      'insc. estadual',
      'ie',
      'i.e.',
    ];

    return this.findValueAfterKeyword(lines, keywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        // Validação rigorosa: não deve ser placeholder, número de endereço ou texto de outro campo
        return (
          value.length >= 3 &&
          !value.match(/^\d{1,5}$/) && // Não é só número (pode ser número de endereço)
          !value.match(/^[a-z]\s+\d+$/i) && // Não é "a 1478" ou similar
          !value.match(/^\d{5}-\d{3}$/) && // Não é CEP
          !value.match(
            /^(?:complemento|bairro|distrito|uf|estado|cidade|número|numero|cep)/i
          ) && // Não é label
          !value.match(/\/\s*(?:distrito|distrto|uf|estado)/i) && // Não contém "/ Distrito" etc
          !value.match(/rua|avenida|logradouro/i) // Não contém palavras de endereço
        );
      },
    });
  }

  /**
   * Extrai Inscrição Municipal
   */
  private extractInscricaoMunicipal(lines: string[]): string | undefined {
    const keywords = [
      'inscrição municipal',
      'inscricao municipal',
      'insc. municipal',
      'im',
      'i.m.',
    ];

    return this.findValueAfterKeyword(lines, keywords, {
      sameLine: true,
      nextLine: true,
      validate: (value) => {
        // Validação rigorosa: não deve ser placeholder, número de endereço ou texto de outro campo
        return (
          value.length >= 3 &&
          !value.match(/^\d{1,5}$/) && // Não é só número (pode ser número de endereço)
          !value.match(/^[a-z]\s+\d+$/i) && // Não é "a 1478" ou similar
          !value.match(/^\d{5}-\d{3}$/) && // Não é CEP
          !value.match(
            /^(?:complemento|bairro|distrito|uf|estado|cidade|número|numero|cep)/i
          ) && // Não é label
          !value.match(/\/\s*(?:distrito|distrto|uf|estado)/i) && // Não contém "/ Distrito" etc
          !value.match(/rua|avenida|logradouro/i) && // Não contém palavras de endereço
          !value.match(
            /^(?:jardim|vila|bairro|centro|distrito)\s+[a-z]{2}$/i
          ) && // Não é "Jardim Paulistano SP" ou similar
          !value.match(
            /\b(sp|rj|mg|rs|pr|sc|ba|go|pe|ce|df|es|ma|ms|mt|pa|pb|pi|rn|ro|rr|se|to|ac|al|ap|am)\s*$/i
          ) // Não termina com UF
        );
      },
    });
  }

  /**
   * Método principal: processa o texto do OCR e retorna dados estruturados
   *
   * @param ocrTextBlocks - Array de strings do OCR (blocos de texto)
   * @returns Objeto com dados extraídos
   */
  parse(ocrTextBlocks: string[]): OCRParsedData {
    // Combina todos os blocos em um texto único
    const fullText = ocrTextBlocks.join('\n');
    const normalizedText = this.normalizeText(fullText);

    // Divide em linhas para processamento
    const lines = ocrTextBlocks
      .flatMap((block) =>
        block.split('\n').map((line) => this.normalizeText(line))
      )
      .filter((line) => line.length > 0);

    const result: OCRParsedData = {};

    // Extrai campos usando regex (passa lines para campos que precisam de contexto)
    result.cnpj = this.extractCNPJ(normalizedText, lines);
    result.cpf = this.extractCPF(normalizedText, lines);
    result.cep = this.extractCEP(normalizedText);
    result.email = this.extractEmail(normalizedText, lines);
    result.telefone = this.extractPhone(normalizedText, lines);

    // VALIDAÇÃO CRÍTICA: Se CNPJ retornado parece CPF, rejeita
    if (result.cnpj) {
      console.log('[parse] 🔍 VALIDANDO CNPJ RETORNADO:', result.cnpj);
      // Verifica se o CNPJ retornado tem formato de CPF
      if (result.cnpj.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
        console.log(
          '[parse] ❌ CNPJ retornado tem formato de CPF, REJEITANDO:',
          result.cnpj
        );
        result.cnpj = undefined;
      } else if (!result.cnpj.includes('/')) {
        console.log(
          '[parse] ❌ CNPJ retornado não tem barra, REJEITANDO:',
          result.cnpj
        );
        result.cnpj = undefined;
      } else {
        console.log('[parse]   CNPJ válido:', result.cnpj);
      }
    }

    // Extrai campos usando lógica posicional
    const extractedRazaoSocial = this.extractRazaoSocial(lines);
    // Remove CPF da razão social extraída (garantia adicional)
    result.razaoSocial = extractedRazaoSocial 
      ? this.removeCPFFromRazaoSocial(extractedRazaoSocial)
      : undefined;
    result.nomeFantasia = this.extractNomeFantasia(lines);
    result.inscricaoEstadual = this.extractInscricaoEstadual(lines);
    result.inscricaoMunicipal = this.extractInscricaoMunicipal(lines);

    // Extrai endereço completo
    const addressData = this.extractAddress(lines);
    result.endereco = addressData.endereco;
    result.numero = addressData.numero;
    result.complemento = addressData.complemento;
    result.bairro = addressData.bairro;
    result.cidade = addressData.cidade;
    result.uf = addressData.uf;

    // LOG FINAL: Mostra exatamente o que está sendo retornado
    console.log('========================================');
    console.log('[parse] 📤 RESULTADO FINAL DO PARSER:');
    console.log('  result.cnpj:', result.cnpj);
    console.log('  result.cpf:', result.cpf);
    console.log('  result.email:', result.email);
    console.log('  result.telefone:', result.telefone);
    console.log('  Tipo de result.cnpj:', typeof result.cnpj);
    console.log('  Tipo de result.cpf:', typeof result.cpf);
    console.log('  Tipo de result.email:', typeof result.email);
    console.log('  Tipo de result.telefone:', typeof result.telefone);
    console.log('  result.cnpj é undefined?', result.cnpj === undefined);
    console.log('  result.cpf é undefined?', result.cpf === undefined);
    console.log('  result.email é undefined?', result.email === undefined);
    console.log(
      '  result.telefone é undefined?',
      result.telefone === undefined
    );
    if (result.email) {
      console.log('    EMAIL ENCONTRADO:', result.email);
    } else {
      console.log('  ❌ EMAIL NÃO ENCONTRADO');
    }
    if (result.telefone) {
      console.log('    TELEFONE ENCONTRADO:', result.telefone);
    } else {
      console.log('  ❌ TELEFONE NÃO ENCONTRADO');
    }
    console.log('========================================');

    return result;
  }
}
