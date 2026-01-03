#!/bin/bash
# Script bash para verificar se as colunas existem no banco de dados
# e se há dados nessas colunas
#
# Uso: ./scripts/verificar_colunas_tickets.sh
# ou: bash scripts/verificar_colunas_tickets.sh

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Verificando colunas na tabela tickets..."
echo ""

# Verificar se DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Erro: DATABASE_URL não está configurado${NC}"
    echo "Configure a variável DATABASE_URL no seu .env ou exporte no terminal"
    exit 1
fi

# Executar o script SQL
echo "1️⃣ Executando verificação SQL..."
psql "$DATABASE_URL" -f migrations/verificar_colunas_tickets.sql

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Verificação concluída!${NC}"
else
    echo -e "\n${RED}❌ Erro ao executar verificação${NC}"
    exit 1
fi





