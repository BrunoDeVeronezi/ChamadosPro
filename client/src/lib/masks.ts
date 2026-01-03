// Utility functions for input masks

// CPF: 000.000.000-00
export const maskCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2');
};

export const unmaskCPF = (value: string): string => {
  return value.replace(/\D/g, '');
};

// CNPJ: 00.000.000/0000-00
export const maskCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2');
};

export const unmaskCNPJ = (value: string): string => {
  return value.replace(/\D/g, '');
};

// CEP: 00000-000
export const maskCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers.slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
};

export const unmaskCEP = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Phone: (00) 00000-0000 or (00) 0000-0000
export const maskPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 10) {
    return numbers
      .slice(0, 10)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  
  return numbers
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const unmaskPhone = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Currency: R$ 0.000,00
export const maskCurrency = (value: string): string => {
  let numbers = value.replace(/\D/g, '');
  
  if (numbers === '') return '';
  
  // Remove leading zeros but keep at least one digit
  numbers = numbers.replace(/^0+/, '') || '0';
  
  // Add decimal separator
  const length = numbers.length;
  if (length === 1) {
    return `0,0${numbers}`;
  } else if (length === 2) {
    return `0,${numbers}`;
  }
  
  const decimal = numbers.slice(-2);
  const integer = numbers.slice(0, -2);
  
  // Add thousand separators
  const integerFormatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${integerFormatted},${decimal}`;
};

export const unmaskCurrency = (value: string): string => {
  // Remove all non-digit characters and convert to decimal
  const numbers = value.replace(/\D/g, '');
  if (numbers === '') return '0';
  
  // Convert cents to decimal (e.g., "12345" -> "123.45")
  const length = numbers.length;
  if (length === 1) {
    return `0.0${numbers}`;
  } else if (length === 2) {
    return `0.${numbers}`;
  }
  
  const decimal = numbers.slice(-2);
  const integer = numbers.slice(0, -2);
  return `${integer}.${decimal}`;
};

// Format currency for display (add R$ prefix)
export const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
};

// Parse currency input value to number
export const parseCurrency = (value: string): number => {
  const cleanValue = unmaskCurrency(value);
  return parseFloat(cleanValue) || 0;
};

// Validate CPF (basic validation)
export const isValidCPF = (cpf: string): boolean => {
  const numbers = unmaskCPF(cpf);
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false; // All same digits
  
  // Validate check digits
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(numbers.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(numbers.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.substring(10, 11))) return false;
  
  return true;
};

// Validate CNPJ (basic validation)
export const isValidCNPJ = (cnpj: string): boolean => {
  const numbers = unmaskCNPJ(cnpj);
  
  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false; // All same digits
  
  // Validate check digits
  let size = numbers.length - 2;
  let digits = numbers.substring(0, size);
  const checkDigits = numbers.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(checkDigits.charAt(0))) return false;
  
  size = size + 1;
  digits = numbers.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(checkDigits.charAt(1))) return false;
  
  return true;
};

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
