# 👁️ Inteligência de Dados: OCR & Autofill

O ChamadosPro utiliza inteligência local e APIs externas para eliminar o preenchimento manual de dados.

## 1. 📸 Extração via OCR (Tesseract.js)
*   **Funcionamento**: Processamento 100% no navegador (offline).
*   **Campos Extraídos**: CNPJ, CPF, E-mail, Telefone, Endereço.
*   **Blindagem**: O sistema corrige erros comuns de leitura (ex: `&` lido como `@`).

## 2. 🔍 Preenchimento por Scoring
*   **Algoritmo**: O sistema analisa texto colado linha por linha.
*   **Pesos**: Nomes próprios ganham mais pontos se estiverem no topo; endereços ganham pontos se contiverem palavras-chave como "Avenida" ou "Rua".
*   **Filtros**: Termos como "Apartamento" são usados como marcadores contextuais para não poluírem o campo Nome.

## 3. 🌐 Integração BrasilAPI
*   **CNPJ**: Ao detectar um CNPJ, o sistema consulta automaticamente a Razão Social, Nome Fantasia e Endereço Fiscal.
*   **CEP**: Ao detectar um CEP, a API preenche automaticamente Logradouro, Bairro, Cidade e UF.

---
[Voltar para o Início](../../README.md)
