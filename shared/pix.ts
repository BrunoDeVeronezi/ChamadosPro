export interface PixPayloadInput {
  pixKey: string;
  amount?: number;
  merchantName: string;
  merchantCity: string;
  txid?: string;
  description?: string;
}

const sanitizePixText = (value: string, maxLength: number) => {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength);
};

const formatPixAmount = (amount?: number) => {
  if (!Number.isFinite(amount) || (amount as number) <= 0) {
    return null;
  }

  return Number(amount).toFixed(2);
};

const buildField = (id: string, value: string) => {
  const length = String(value.length).padStart(2, '0');
  return `${id}${length}${value}`;
};

const crc16 = (payload: string) => {
  let result = 0xffff;

  for (let i = 0; i < payload.length; i += 1) {
    result ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if (result & 0x8000) {
        result = ((result << 1) ^ 0x1021) & 0xffff;
      } else {
        result = (result << 1) & 0xffff;
      }
    }
  }

  return result.toString(16).toUpperCase().padStart(4, '0');
};

export const buildPixPayload = ({
  pixKey,
  amount,
  merchantName,
  merchantCity,
  txid,
  description,
}: PixPayloadInput) => {
  const normalizedKey = pixKey.trim();
  const normalizedName = sanitizePixText(merchantName, 25) || 'RECEBEDOR';
  const normalizedCity = sanitizePixText(merchantCity, 15) || 'BRASIL';
  const normalizedTxId = sanitizePixText(txid || '***', 25) || '***';
  const normalizedDescription = description
    ? sanitizePixText(description, 72)
    : '';
  const formattedAmount = formatPixAmount(amount);

  const gui = buildField('00', 'br.gov.bcb.pix');
  const key = buildField('01', normalizedKey);
  const desc = normalizedDescription
    ? buildField('02', normalizedDescription)
    : '';
  const merchantAccountInfo = buildField('26', `${gui}${key}${desc}`);

  const payloadFormat = '000201';
  const pointOfInitiation = '010211';
  const merchantCategoryCode = '52040000';
  const transactionCurrency = '5303986';
  const transactionAmount = formattedAmount
    ? buildField('54', formattedAmount)
    : '';
  const countryCode = '5802BR';
  const merchantNameField = buildField('59', normalizedName);
  const merchantCityField = buildField('60', normalizedCity);
  const additionalDataField = buildField(
    '62',
    buildField('05', normalizedTxId)
  );

  const payload =
    payloadFormat +
    pointOfInitiation +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantNameField +
    merchantCityField +
    additionalDataField;

  const payloadWithCrc = `${payload}6304`;
  const crc = crc16(payloadWithCrc);

  return `${payloadWithCrc}${crc}`;
};
