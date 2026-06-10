interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}

interface BankParser {
  detect: (headers: string[]) => boolean;
  parse: (rows: Record<string, string>[]) => ParsedRow[];
}

interface ParseResult {
  bankName: string;
  transactions: {
    date: string;
    description: string;
    amount: number;
    category: string;
    account_provider: string;
  }[];
  totalImported: number;
}

const BANK_PARSERS: Record<string, BankParser> = {
  santander: {
    detect: (headers) => headers.some(h => h.toLowerCase().includes('santander')) ||
      (headers.includes('Data') && headers.includes('Descrição') && headers.includes('Valor')),
    parse: (rows) => rows.map(row => ({
      date: parseDate(row['Data']),
      description: row['Descrição'] || row['Histórico'] || row['Descrição/Histórico'] || '',
      amount: parseAmount(row['Valor']),
    }))
  },

  inter: {
    detect: (headers) => headers.some(h => h.toLowerCase().includes('inter')) ||
      (headers.includes('Data Lançamento') && headers.includes('Descrição')),
    parse: (rows) => rows.map(row => ({
      date: parseDate(row['Data Lançamento'] || row['Data']),
      description: row['Descrição'] || '',
      amount: parseAmount(row['Valor']),
    }))
  },

  mercadopago: {
    detect: (headers) => headers.some(h => h.toLowerCase().includes('mercado')) ||
      (headers.includes('Date') && headers.includes('Description') && headers.includes('Amount')) ||
      (headers.includes('Fecha') && headers.includes('Detalle')),
    parse: (rows) => rows.map(row => ({
      date: parseDate(row['Date'] || row['Fecha'] || row['Data']),
      description: row['Description'] || row['Detalle'] || row['Descrição'] || row['Descripción'] || '',
      amount: parseAmount(row['Amount'] || row['Monto'] || row['Valor']),
    }))
  },

  generic: {
    detect: () => true,
    parse: (rows) => {
      if (rows.length === 0) return [];
      const keys = Object.keys(rows[0]);
      const dateKey = keys.find(k => /data|date|fecha/i.test(k)) || keys[0];
      const descKey = keys.find(k => /descri|detail|hist|detalhe/i.test(k)) || keys[1];
      const amountKey = keys.find(k => /valor|amount|monto|value/i.test(k)) || keys[2];

      return rows.map(row => ({
        date: parseDate(row[dateKey]),
        description: row[descKey] || '',
        amount: parseAmount(row[amountKey]),
      }));
    }
  }
};

function parseDate(val?: string): string {
  if (!val) return new Date().toISOString();
  const str = val.trim();

  const brMatch = str.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (brMatch) return new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`).toISOString();

  const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return new Date(str).toISOString();

  return new Date(str).toISOString();
}

function parseAmount(val?: string): number {
  if (!val) return 0;
  const str = String(val).trim()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function autoCategorizeBR(description: string): string {
  const desc = description.toLowerCase();
  if (/superm|mercado|carrefour|atacad|hiper|hortifruti|padaria|açougue|assaí|extra/i.test(desc)) return 'Alimentação';
  if (/ifood|uber eats|rappi|restaur|lanche|pizza|burger|mcdonald|subway|starbucks|café/i.test(desc)) return 'Alimentação';
  if (/uber|99|taxi|táxi|cabify|estacion|combustível|gasolina|pedágio|sem parar/i.test(desc)) return 'Transporte';
  if (/farmácia|drogaria|hospital|clínica|médic|saúde|unimed|amil|bradesco saúde/i.test(desc)) return 'Saúde';
  if (/netflix|spotify|disney|hbo|amazon prime|cinema|teatro|show|ingresso|lazer|game|steam|playstation|xbox/i.test(desc)) return 'Lazer';
  if (/luz|energia|água|gás|condomínio|aluguel|iptu|internet|telefone|celular|vivo|claro|tim|oi|pix enviado/i.test(desc)) return 'Casa';
  if (/escola|faculdade|curso|udemy|alura|livro|apostila|mensalidade/i.test(desc)) return 'Educação';
  if (/roupa|zara|renner|riachuelo|c&a|shein|shopee|magazine|casas bahia|americanas/i.test(desc)) return 'Roupas';
  return 'Outros';
}

export function parseCSV(text: string): ParseResult {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Arquivo CSV vazio ou inválido.');

  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('data') || l.includes('date') || l.includes('fecha') || l.includes('descri') || l.includes('header')) {
      headerIndex = i;
      break;
    }
  }

  const headerLine = lines[headerIndex];
  const sep = headerLine.includes(';') ? ';' : ',';

  const headers = headerLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }

  let bankName = 'Desconhecido';
  let parsed: ParsedRow[] = [];

  for (const [name, parser] of Object.entries(BANK_PARSERS)) {
    if (parser.detect(headers)) {
      parsed = parser.parse(rows);
      bankName = name === 'generic' ? 'CSV Importado'
        : name === 'santander' ? 'Santander'
        : name === 'inter' ? 'Inter'
        : name === 'mercadopago' ? 'Mercado Pago'
        : name;
      break;
    }
  }

  const transactions = parsed
    .filter(t => {
      if (t.amount >= 0) return false;

      const desc = t.description.toLowerCase();
      const ignoreTerms = ['rendimento', 'dinheiro reservado', 'dinheiro retirado', 'resgate', 'investimento', 'aplicação'];
      if (ignoreTerms.some(term => desc.includes(term))) return false;

      return true;
    })
    .map(t => ({
      ...t,
      amount: Math.abs(t.amount),
      category: autoCategorizeBR(t.description),
      account_provider: bankName,
    }));

  return { bankName, transactions, totalImported: transactions.length };
}
