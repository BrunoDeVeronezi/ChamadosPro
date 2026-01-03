-- ============================================
-- Script para CORRIGIR Loop Infinito com Gemini AI
-- Problema: Trigger/Edge Function chamando Gemini quando linha é atualizada
-- Solução: Fazer trigger ignorar atualizações feitas pela própria IA
-- ============================================

-- PASSO 1: IDENTIFICAR TRIGGERS EXISTENTES
-- Execute este comando para ver todos os triggers que podem estar causando o problema:
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- PASSO 2: IDENTIFICAR EDGE FUNCTIONS
-- Verifique no painel do Supabase: Edge Functions > Functions
-- Procure por funções que:
-- - Chamam Gemini/Google AI
-- - São chamadas por triggers
-- - Atualizam a mesma tabela que disparou o trigger

-- ============================================
-- SOLUÇÃO 1: CORRIGIR TRIGGER SQL
-- ============================================
-- Se você tem um trigger SQL que chama uma função que usa Gemini,
-- modifique o trigger para ignorar atualizações feitas pela IA:

-- Exemplo de trigger PROBLEMÁTICO (NÃO USE):
/*
CREATE OR REPLACE FUNCTION process_with_ai()
RETURNS TRIGGER AS $$
BEGIN
    -- Chama Edge Function que usa Gemini
    PERFORM net.http_post(
        url := 'https://your-project.supabase.co/functions/v1/process-with-gemini',
        body := jsonb_build_object('id', NEW.id, 'data', NEW.data)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_trigger
AFTER UPDATE ON sua_tabela
FOR EACH ROW
EXECUTE FUNCTION process_with_ai();
*/

-- Exemplo de trigger CORRIGIDO (USE ESTE):
CREATE OR REPLACE FUNCTION process_with_ai_safe()
RETURNS TRIGGER AS $$
BEGIN
    -- ✅ CORREÇÃO: Verificar se a resposta da IA já foi preenchida
    -- Se já estiver preenchida, significa que a IA já processou
    -- e esta atualização veio da própria IA, então IGNORAR
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        -- Esta atualização veio da IA, não processar novamente
        RETURN NEW;
    END IF;
    
    -- ✅ CORREÇÃO: Verificar se o campo que dispara a IA foi realmente alterado
    -- Se apenas campos não relevantes foram alterados, ignorar
    IF OLD.data = NEW.data THEN
        -- Nenhuma mudança relevante, ignorar
        RETURN NEW;
    END IF;
    
    -- ✅ CORREÇÃO: Adicionar flag para evitar loops
    -- Marcar como "processando" antes de chamar a IA
    IF NEW.ai_processing = true THEN
        -- Já está processando, ignorar
        RETURN NEW;
    END IF;
    
    -- Marcar como processando
    NEW.ai_processing := true;
    
    -- Chama Edge Function que usa Gemini
    PERFORM net.http_post(
        url := 'https://your-project.supabase.co/functions/v1/process-with-gemini',
        body := jsonb_build_object(
            'id', NEW.id,
            'data', NEW.data,
            'is_ai_update', false  -- ✅ Flag para indicar que não é atualização da IA
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger com a função corrigida
DROP TRIGGER IF EXISTS ai_trigger ON sua_tabela;
CREATE TRIGGER ai_trigger_safe
AFTER UPDATE ON sua_tabela
FOR EACH ROW
WHEN (
    -- ✅ CORREÇÃO: Só disparar se:
    -- 1. O campo relevante mudou
    OLD.data IS DISTINCT FROM NEW.data
    -- 2. A resposta da IA ainda não foi preenchida
    AND (NEW.ai_response IS NULL OR NEW.ai_response = '')
    -- 3. Não está processando
    AND (NEW.ai_processing IS NULL OR NEW.ai_processing = false)
)
EXECUTE FUNCTION process_with_ai_safe();

-- ============================================
-- SOLUÇÃO 2: CORRIGIR EDGE FUNCTION
-- ============================================
-- Se você tem uma Edge Function que:
-- 1. Recebe chamada do trigger
-- 2. Chama Gemini
-- 3. Atualiza a mesma linha no banco
-- 
-- Modifique a Edge Function para:
-- 1. Verificar se já foi processada
-- 2. Marcar como processada ANTES de chamar Gemini
-- 3. Usar flag para evitar re-processamento

-- Exemplo de Edge Function CORRIGIDA (TypeScript/Deno):
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { id, data, is_ai_update } = await req.json()
    
    // ✅ CORREÇÃO 1: Se esta atualização veio da própria IA, ignorar
    if (is_ai_update === true) {
      return new Response(
        JSON.stringify({ message: 'Ignorado: atualização da própria IA' }),
        { status: 200 }
      )
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // ✅ CORREÇÃO 2: Verificar se já foi processada
    const { data: existing } = await supabase
      .from('sua_tabela')
      .select('ai_response, ai_processing')
      .eq('id', id)
      .single()
    
    if (existing?.ai_response && existing.ai_response !== '') {
      return new Response(
        JSON.stringify({ message: 'Já processado' }),
        { status: 200 }
      )
    }
    
    if (existing?.ai_processing === true) {
      return new Response(
        JSON.stringify({ message: 'Já está processando' }),
        { status: 200 }
      )
    }
    
    // ✅ CORREÇÃO 3: Marcar como processando ANTES de chamar Gemini
    await supabase
      .from('sua_tabela')
      .update({ 
        ai_processing: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    // Chamar Gemini
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? ''
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: data }]
        }]
      })
    })
    
    const geminiData = await geminiResponse.json()
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // ✅ CORREÇÃO 4: Atualizar com flag is_ai_update=true para evitar loop
    // Use uma coluna especial ou adicione um campo para indicar que é atualização da IA
    await supabase
      .from('sua_tabela')
      .update({ 
        ai_response: aiResponse,
        ai_processing: false,
        updated_at: new Date().toISOString()
        // ✅ IMPORTANTE: Não atualizar o campo 'data' que dispara o trigger novamente!
      })
      .eq('id', id)
    
    return new Response(
      JSON.stringify({ success: true, response: aiResponse }),
      { status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
*/

-- ============================================
-- SOLUÇÃO 3: ADICIONAR COLUNAS DE CONTROLE
-- ============================================
-- Adicione estas colunas à sua tabela para controlar o processamento:

ALTER TABLE sua_tabela 
ADD COLUMN IF NOT EXISTS ai_response TEXT,
ADD COLUMN IF NOT EXISTS ai_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP;

-- Criar índice para melhorar performance das verificações
CREATE INDEX IF NOT EXISTS idx_ai_processing 
ON sua_tabela(ai_processing) 
WHERE ai_processing = true;

-- ============================================
-- SOLUÇÃO 4: DESABILITAR TRIGGER TEMPORARIAMENTE
-- ============================================
-- Se você precisar parar o loop imediatamente:

-- Desabilitar trigger específico
ALTER TABLE sua_tabela DISABLE TRIGGER ai_trigger;

-- Ou desabilitar todos os triggers da tabela
ALTER TABLE sua_tabela DISABLE TRIGGER ALL;

-- Para reabilitar depois:
-- ALTER TABLE sua_tabela ENABLE TRIGGER ai_trigger;

-- ============================================
-- VERIFICAÇÃO: IDENTIFICAR LOOP ATIVO
-- ============================================
-- Execute para ver se há registros sendo processados repetidamente:

SELECT 
    id,
    ai_processing,
    ai_processed_at,
    updated_at,
    CASE 
        WHEN ai_processing = true AND updated_at < NOW() - INTERVAL '5 minutes' 
        THEN 'POSSÍVEL LOOP - Processando há mais de 5 minutos'
        ELSE 'OK'
    END as status
FROM sua_tabela
WHERE ai_processing = true
ORDER BY updated_at DESC;

-- ============================================
-- LIMPEZA: RESETAR FLAGS DE PROCESSAMENTO
-- ============================================
-- Se você encontrar registros travados em processamento:

UPDATE sua_tabela
SET ai_processing = false
WHERE ai_processing = true 
AND updated_at < NOW() - INTERVAL '10 minutes';

-- ============================================
-- CHECKLIST DE CORREÇÃO
-- ============================================
/*
✅ 1. Adicionar colunas de controle (ai_response, ai_processing)
✅ 2. Modificar trigger para verificar se já foi processado
✅ 3. Modificar Edge Function para:
   - Verificar se já foi processado ANTES de chamar Gemini
   - Marcar como processando ANTES de chamar Gemini
   - Atualizar com flag is_ai_update=true
   - NÃO atualizar campos que disparam o trigger novamente
✅ 4. Adicionar WHEN clause no trigger para filtrar atualizações irrelevantes
✅ 5. Testar com um registro e verificar logs
✅ 6. Monitorar custos da API Gemini após correção
*/


