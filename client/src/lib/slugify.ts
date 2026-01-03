/**
 * Converte uma string em slug (URL-friendly)
 * Ex: "Cyber Tech" -> "Cyber-Tech"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/[^\w\-]+/g, '') // Remove caracteres não alfanuméricos (exceto hífens)
    .replace(/\-\-+/g, '-') // Substitui múltiplos hífens por um único
    .replace(/^-+/, '') // Remove hífens do início
    .replace(/-+$/, ''); // Remove hífens do fim
}
