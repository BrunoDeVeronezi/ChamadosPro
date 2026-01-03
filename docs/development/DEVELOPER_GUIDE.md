# 🛠️ Guia do Desenvolvedor

## 1. 🎨 Padrões de Design
*   **Base**: Tailwind CSS + Shadcn/UI.
*   **Cores**: Use as variáveis CSS do tema para garantir compatibilidade com Dark Mode.
*   **Iconografia**: Utilize exclusivamente ícones do pacote `lucide-react`.

## 2. 🧩 Componentização
*   Novos componentes devem ser colocados em `client/src/components`.
*   Sempre use **Optional Chaining** (`?.`) ao acessar dados provenientes de APIs.

## 3. 📊 Indicadores e Formulários
*   **Dashboard**: Utilize o componente `MetricCard` para novos indicadores.
*   **Forms**: Validação obrigatória via **Zod** tanto no frontend quanto no backend.

---
[Voltar para o Início](../../README.md)





