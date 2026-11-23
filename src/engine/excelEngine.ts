import { CellEvaluation, EvaluationStep, SheetGrid } from '../types/app';

export const COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type ExcelPrimitive = string | number | boolean | null;

class ExcelError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}

export function normalizeCoord(coord: string): string {
  return coord.replace(/\$/g, '').trim().toUpperCase();
}

export function parseCoord(coord: string): { colIndex: number; rowIndex: number } | null {
  const clean = normalizeCoord(coord);
  const match = /^([A-Z]+)(\d+)$/.exec(clean);
  if (!match) return null;
  const colStr = match[1];
  const rowNum = parseInt(match[2], 10);
  const colIndex = COLS.indexOf(colStr as (typeof COLS)[number]);
  const rowIndex = rowNum - 1;
  if (colIndex === -1 || rowIndex < 0 || rowIndex >= ROWS.length) return null;
  return { colIndex, rowIndex };
}

export function expandRange(startCoord: string, endCoord: string): string[] {
  const start = parseCoord(startCoord);
  const end = parseCoord(endCoord);
  if (!start || !end) return [];
  const minC = Math.min(start.colIndex, end.colIndex);
  const maxC = Math.max(start.colIndex, end.colIndex);
  const minR = Math.min(start.rowIndex, end.rowIndex);
  const maxR = Math.max(start.rowIndex, end.rowIndex);
  const coords: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      coords.push(`${COLS[c]}${ROWS[r]}`);
    }
  }
  return coords;
}

export function extractCellReferences(formula: string): string[] {
  if (!formula.startsWith('=')) return [];
  const refs = new Set<string>();
  // Remove string literals so text inside quotes isn't treated as cell ref
  const stripped = formula.replace(/"([^"\\]|\\.)*"/g, '');
  const rangeRegex = /\$?([A-F])\$?(\d{1,2})\s*:\s*\$?([A-F])\$?(\d{1,2})/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(stripped)) !== null) {
    const expanded = expandRange(`${match[1]}${match[2]}`, `${match[3]}${match[4]}`);
    expanded.forEach((c) => refs.add(c));
  }
  const cellRegex = /(?<![A-Z0-9_])\$?([A-F])\$?(\d{1,2})(?![A-Z0-9_:])/gi;
  while ((match = cellRegex.exec(stripped)) !== null) {
    const coord = `${match[1].toUpperCase()}${parseInt(match[2], 10)}`;
    if (parseCoord(coord)) {
      refs.add(coord);
    }
  }
  return Array.from(refs);
}

interface Token {
  type: 'number' | 'string' | 'ident' | 'cell' | 'op' | 'paren' | 'sep' | 'colon';
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let str = '';
      i++;
      while (i < input.length) {
        if (input[i] === '"' && input[i + 1] === '"') {
          str += '"';
          i += 2;
        } else if (input[i] === '"') {
          i++;
          break;
        } else {
          str += input[i];
          i++;
        }
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] || ''))) {
      let numStr = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'number', value: numStr });
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'sep', value: ch });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ch });
      i++;
      continue;
    }
    const twoChar = input.slice(i, i + 2);
    if (['>=', '<=', '<>', '!='].includes(twoChar)) {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if (['+', '-', '*', '/', '^', '=', '<', '>', '&'].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (/[$A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[$A-Za-z0-9_.]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      const clean = normalizeCoord(ident);
      if (/^[A-F]\d{1,2}$/.test(clean) && parseCoord(clean)) {
        tokens.push({ type: 'cell', value: clean });
      } else {
        tokens.push({ type: 'ident', value: ident.toUpperCase() });
      }
      continue;
    }
    throw new ExcelError('#NAME?', `Karakter tidak dikenali: ${ch}`);
  }
  return tokens;
}

type EvalArgValue = ExcelPrimitive | { isRange: true; coords: string[]; values: ExcelPrimitive[] };

function toNumber(val: ExcelPrimitive): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val === null || val === '') return 0;
  const cleaned = String(val).replace(/\s/g, '');
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new ExcelError('#VALUE!');
  return n;
}

function toStringVal(val: ExcelPrimitive): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return String(val);
}

function toBoolean(val: ExcelPrimitive): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const up = val.trim().toUpperCase();
    if (up === 'TRUE') return true;
    if (up === 'FALSE') return false;
  }
  throw new ExcelError('#VALUE!');
}

function parseExcelDate(val: ExcelPrimitive): Date {
  const s = toStringVal(val).trim();
  if (!s) throw new ExcelError('#VALUE!');
  // Support DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Support YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(s);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) throw new ExcelError('#VALUE!');
  return parsed;
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function flattenValues(args: EvalArgValue[]): ExcelPrimitive[] {
  const out: ExcelPrimitive[] = [];
  for (const a of args) {
    if (a && typeof a === 'object' && 'isRange' in a) {
      out.push(...a.values);
    } else {
      out.push(a);
    }
  }
  return out;
}

function matchesCriteria(val: ExcelPrimitive, criteriaRaw: ExcelPrimitive): boolean {
  const criteria = toStringVal(criteriaRaw).trim();
  const matchOp = /^(>=|<=|<>|!=|>|<|=)(.*)$/.exec(criteria);
  if (matchOp) {
    const op = matchOp[1];
    const rhsRaw = matchOp[2].trim();
    const rhsNum = Number(rhsRaw);
    const valNum = typeof val === 'number' ? val : val !== '' && val !== null && !Number.isNaN(Number(val)) ? Number(val) : NaN;

    if (!Number.isNaN(rhsNum) && rhsRaw !== '' && !Number.isNaN(valNum)) {
      if (op === '>=') return valNum >= rhsNum;
      if (op === '<=') return valNum <= rhsNum;
      if (op === '>') return valNum > rhsNum;
      if (op === '<') return valNum < rhsNum;
      if (op === '=') return valNum === rhsNum;
      if (op === '<>' || op === '!=') return valNum !== rhsNum;
    }
    const vStr = toStringVal(val).toLowerCase();
    const rStr = rhsRaw.toLowerCase();
    if (op === '=') return vStr === rStr;
    if (op === '<>' || op === '!=') return vStr !== rStr;
    return false;
  }

  // Wildcard support (* and ?)
  if (criteria.includes('*') || criteria.includes('?')) {
    const escaped = criteria
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(toStringVal(val));
  }

  if (typeof val === 'number' && criteria !== '' && !Number.isNaN(Number(criteria))) {
    return val === Number(criteria);
  }
  return toStringVal(val).trim().toLowerCase() === criteria.toLowerCase();
}

export function formatCellValue(value: ExcelPrimitive, format?: string): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#DIV/0!';
    if (format === 'currency') {
      return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    }
    if (format === 'percent') {
      return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString('id-ID');
    }
    return Number(value.toFixed(2)).toLocaleString('id-ID');
  }
  return String(value);
}

export function evaluateGrid(grid: SheetGrid): Record<string, CellEvaluation> {
  const cache: Record<string, CellEvaluation> = {};
  const visiting = new Set<string>();

  function evalCell(coord: string): CellEvaluation {
    const norm = normalizeCoord(coord);
    if (cache[norm]) return cache[norm];

    const cell = grid[norm];
    if (!cell || cell.raw === '') {
      const emptyEval: CellEvaluation = {
        value: '',
        displayValue: '',
        referencedCells: [],
        steps: [],
      };
      cache[norm] = emptyEval;
      return emptyEval;
    }

    const raw = cell.raw.trim();
    if (!raw.startsWith('=')) {
      const numeric = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
      let val: ExcelPrimitive = raw;
      if (numeric !== null) {
        val = numeric;
      } else if (raw.toUpperCase() === 'TRUE') {
        val = true;
      } else if (raw.toUpperCase() === 'FALSE') {
        val = false;
      }
      const res: CellEvaluation = {
        value: val,
        displayValue: formatCellValue(val, cell.format),
        referencedCells: [],
        steps: [],
      };
      cache[norm] = res;
      return res;
    }

    if (visiting.has(norm)) {
      const circEval: CellEvaluation = {
        value: '#CIRCULAR!',
        displayValue: '#CIRCULAR!',
        error: '#CIRCULAR!',
        referencedCells: [],
        steps: [],
      };
      return circEval;
    }

    visiting.add(norm);
    const steps: EvaluationStep[] = [];
    const referenced = new Set<string>();

    try {
      const tokens = tokenize(raw.slice(1));
      let pos = 0;

      const peek = () => tokens[pos];
      const consume = () => tokens[pos++];

      function getScalarValue(coordKey: string): ExcelPrimitive {
        referenced.add(coordKey);
        const ev = evalCell(coordKey);
        if (ev.error) throw new ExcelError(ev.error);
        return ev.value;
      }

      function compareScalars(l: ExcelPrimitive, r: ExcelPrimitive, op: string): boolean {
        if (typeof l === 'number' && typeof r === 'number') {
          if (op === '=') return l === r;
          if (op === '<>' || op === '!=') return l !== r;
          if (op === '<') return l < r;
          if (op === '<=') return l <= r;
          if (op === '>') return l > r;
          if (op === '>=') return l >= r;
          return false;
        }
        const ls = toStringVal(l).toLowerCase();
        const rs = toStringVal(r).toLowerCase();
        if (op === '=') return ls === rs;
        if (op === '<>' || op === '!=') return ls !== rs;
        if (op === '<') return ls < rs;
        if (op === '<=') return ls <= rs;
        if (op === '>') return ls > rs;
        if (op === '>=') return ls >= rs;
        return false;
      }

      function parseComparison(): EvalArgValue {
        let left = parseConcat();
        while (peek() && peek().type === 'op' && ['=', '<>', '!=', '<', '<=', '>', '>='].includes(peek().value)) {
          const op = consume().value;
          const right = parseConcat();
          const leftIsRange = Boolean(left && typeof left === 'object' && 'isRange' in left);
          const rightIsRange = Boolean(right && typeof right === 'object' && 'isRange' in right);
          if (leftIsRange || rightIsRange) {
            const leftVals = leftIsRange ? (left as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const rightVals = rightIsRange ? (right as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const len = leftVals && rightVals
              ? Math.min(leftVals.length, rightVals.length)
              : leftVals
                ? leftVals.length
                : rightVals!.length;
            const bools: boolean[] = [];
            for (let i = 0; i < len; i++) {
              const lItem = leftVals ? leftVals[i] : expectScalar(left);
              const rItem = rightVals ? rightVals[i] : expectScalar(right);
              bools.push(compareScalars(lItem, rItem, op));
            }
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${formatStepVal(left)} ${op} ${formatStepVal(right)}`,
              description: `Membandingkan setiap sel rentang dengan ${op} (${bools.filter(Boolean).length} cocok)`,
              result: formatStepVal({ isRange: true, coords: [], values: bools }),
              referencedCells: [],
            });
            left = { isRange: true, coords: [], values: bools };
          } else {
            const l = expectScalar(left);
            const r = expectScalar(right);
            const res = compareScalars(l, r, op);
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${formatStepVal(l)} ${op} ${formatStepVal(r)}`,
              description: `Membandingkan nilai dengan operator ${op}`,
              result: res ? 'TRUE' : 'FALSE',
              referencedCells: [],
            });
            left = res;
          }
        }
        return left;
      }

      function parseConcat(): EvalArgValue {
        let left = parseAddSub();
        while (peek() && peek().type === 'op' && peek().value === '&') {
          consume();
          const right = parseAddSub();
          const combined = toStringVal(expectScalar(left)) + toStringVal(expectScalar(right));
          steps.push({
            id: `step-${steps.length + 1}`,
            expression: `"${toStringVal(expectScalar(left))}" & "${toStringVal(expectScalar(right))}"`,
            description: 'Menggabungkan teks dengan operator &',
            result: combined,
            referencedCells: [],
          });
          left = combined;
        }
        return left;
      }

      function parseAddSub(): EvalArgValue {
        let left = parseMulDiv();
        while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
          const op = consume().value;
          const right = parseMulDiv();
          const leftIsRange = Boolean(left && typeof left === 'object' && 'isRange' in left);
          const rightIsRange = Boolean(right && typeof right === 'object' && 'isRange' in right);
          if (leftIsRange || rightIsRange) {
            const leftVals = leftIsRange ? (left as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const rightVals = rightIsRange ? (right as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const len = leftVals && rightVals
              ? Math.min(leftVals.length, rightVals.length)
              : leftVals
                ? leftVals.length
                : rightVals!.length;
            const arrOut: number[] = [];
            for (let i = 0; i < len; i++) {
              const lNum = toNumber(leftVals ? leftVals[i] : expectScalar(left));
              const rNum = toNumber(rightVals ? rightVals[i] : expectScalar(right));
              arrOut.push(op === '+' ? lNum + rNum : lNum - rNum);
            }
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${formatStepVal(left)} ${op} ${formatStepVal(right)}`,
              description: op === '+' ? 'Penjumlahan rentang per elemen' : 'Pengurangan rentang per elemen',
              result: formatStepVal({ isRange: true, coords: [], values: arrOut }),
              referencedCells: [],
            });
            left = { isRange: true, coords: [], values: arrOut };
          } else {
            const lNum = toNumber(expectScalar(left));
            const rNum = toNumber(expectScalar(right));
            const res = op === '+' ? lNum + rNum : lNum - rNum;
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${lNum} ${op} ${rNum}`,
              description: op === '+' ? 'Operasi penjumlahan' : 'Operasi pengurangan',
              result: String(res),
              referencedCells: [],
            });
            left = res;
          }
        }
        return left;
      }

      function parseMulDiv(): EvalArgValue {
        let left = parsePower();
        while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
          const op = consume().value;
          const right = parsePower();
          const leftIsRange = Boolean(left && typeof left === 'object' && 'isRange' in left);
          const rightIsRange = Boolean(right && typeof right === 'object' && 'isRange' in right);
          if (leftIsRange || rightIsRange) {
            const leftVals = leftIsRange ? (left as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const rightVals = rightIsRange ? (right as { isRange: true; coords: string[]; values: ExcelPrimitive[] }).values : null;
            const len = leftVals && rightVals
              ? Math.min(leftVals.length, rightVals.length)
              : leftVals
                ? leftVals.length
                : rightVals!.length;
            const arrOut: number[] = [];
            for (let i = 0; i < len; i++) {
              const lNum = toNumber(leftVals ? leftVals[i] : expectScalar(left));
              const rNum = toNumber(rightVals ? rightVals[i] : expectScalar(right));
              if (op === '/' && rNum === 0) throw new ExcelError('#DIV/0!');
              arrOut.push(op === '*' ? lNum * rNum : lNum / rNum);
            }
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${formatStepVal(left)} ${op} ${formatStepVal(right)}`,
              description: op === '*' ? 'Perkalian rentang per elemen' : 'Pembagian rentang per elemen',
              result: formatStepVal({ isRange: true, coords: [], values: arrOut }),
              referencedCells: [],
            });
            left = { isRange: true, coords: [], values: arrOut };
          } else {
            const lNum = toNumber(expectScalar(left));
            const rNum = toNumber(expectScalar(right));
            if (op === '/' && rNum === 0) throw new ExcelError('#DIV/0!');
            const res = op === '*' ? lNum * rNum : lNum / rNum;
            steps.push({
              id: `step-${steps.length + 1}`,
              expression: `${lNum} ${op} ${rNum}`,
              description: op === '*' ? 'Operasi perkalian' : 'Operasi pembagian',
              result: String(Number(res.toFixed(4))),
              referencedCells: [],
            });
            left = res;
          }
        }
        return left;
      }

      function parsePower(): EvalArgValue {
        let left = parseUnary();
        if (peek() && peek().type === 'op' && peek().value === '^') {
          consume();
          const right = parsePower();
          const lNum = toNumber(expectScalar(left));
          const rNum = toNumber(expectScalar(right));
          left = Math.pow(lNum, rNum);
        }
        return left;
      }

      function parseUnary(): EvalArgValue {
        if (peek() && peek().type === 'op' && (peek().value === '-' || peek().value === '+')) {
          const op = consume().value;
          const val = parseUnary();
          if (val && typeof val === 'object' && 'isRange' in val) {
            return {
              isRange: true,
              coords: [],
              values: val.values.map((item) => (op === '-' ? -toNumber(item) : toNumber(item))),
            };
          }
          return op === '-' ? -toNumber(expectScalar(val)) : toNumber(expectScalar(val));
        }
        return parsePrimary();
      }

      function expectScalar(v: EvalArgValue): ExcelPrimitive {
        if (v && typeof v === 'object' && 'isRange' in v) {
          if (v.coords.length === 0) {
            if (v.values.length === 0) return '';
            return v.values.length === 1 ? v.values[0] : v.values.map((x) => toStringVal(x)).join(', ');
          }
          return v.values[0] ?? '';
        }
        return v;
      }

      function formatStepVal(v: EvalArgValue): string {
        if (v && typeof v === 'object' && 'isRange' in v) {
          return `[${v.values.slice(0, 5).map((x) => toStringVal(x)).join(', ')}${v.values.length > 5 ? ', ...' : ''}]`;
        }
        if (typeof v === 'string') return `"${v}"`;
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (v === null) return '0';
        return String(v);
      }

      function parsePrimary(): EvalArgValue {
        const tok = peek();
        if (!tok) throw new ExcelError('#VALUE!');

        if (tok.type === 'number') {
          consume();
          return Number(tok.value);
        }
        if (tok.type === 'string') {
          consume();
          return tok.value;
        }
        if (tok.type === 'paren' && tok.value === '(') {
          consume();
          const inner = parseComparison();
          if (!peek() || peek().type !== 'paren' || peek().value !== ')') {
            throw new ExcelError('#VALUE!', 'Kurung tutup ) kurang');
          }
          consume();
          return inner;
        }
        if (tok.type === 'cell') {
          consume();
          if (peek() && peek().type === 'colon') {
            consume();
            const endTok = consume();
            if (!endTok || endTok.type !== 'cell') throw new ExcelError('#REF!');
            const coords = expandRange(tok.value, endTok.value);
            if (coords.length === 0) throw new ExcelError('#REF!');
            const values = coords.map((c) => getScalarValue(c));
            return { isRange: true, coords, values };
          }
          return getScalarValue(tok.value);
        }
        if (tok.type === 'ident') {
          consume();
          if (tok.value === 'TRUE') return true;
          if (tok.value === 'FALSE') return false;

          if (peek() && peek().type === 'paren' && peek().value === '(') {
            consume();

            // Support error-catching functions (IFERROR, IFNA, ISERROR) both top-level and nested
            if (tok.value === 'IFERROR' || tok.value === 'IFNA' || tok.value === 'ISERROR') {
              const skipToArgBoundary = () => {
                let depth = 0;
                while (peek()) {
                  const t = peek();
                  if (t.type === 'paren' && t.value === '(') depth++;
                  else if (t.type === 'paren' && t.value === ')') {
                    if (depth === 0) break;
                    depth--;
                  } else if (t.type === 'sep' && depth === 0) {
                    break;
                  }
                  consume();
                }
              };

              let firstVal: EvalArgValue = null;
              let caughtError: string | null = null;
              try {
                firstVal = parseComparison();
              } catch (e) {
                if (e instanceof ExcelError) {
                  caughtError = e.code;
                  skipToArgBoundary();
                } else {
                  throw e;
                }
              }

              if (tok.value === 'ISERROR') {
                if (!peek() || peek().type !== 'paren' || peek().value !== ')') {
                  throw new ExcelError('#VALUE!');
                }
                consume();
                return caughtError !== null;
              }

              if (!peek() || peek().type !== 'sep') {
                throw new ExcelError('#VALUE!');
              }
              consume();
              const fallbackVal = parseComparison();
              if (!peek() || peek().type !== 'paren' || peek().value !== ')') {
                throw new ExcelError('#VALUE!');
              }
              consume();

              if (tok.value === 'IFNA') {
                if (caughtError && caughtError !== '#N/A') throw new ExcelError(caughtError);
                const out = caughtError === '#N/A' ? expectScalar(fallbackVal) : expectScalar(firstVal);
                steps.push({
                  id: `step-${steps.length + 1}`,
                  expression: `IFNA(...)`,
                  description:
                    caughtError === '#N/A'
                      ? 'Terjadi galat #N/A, menampilkan nilai cadangan'
                      : 'Nilai valid, hasil dipertahankan',
                  result: formatStepVal(out),
                  referencedCells: Array.from(referenced),
                });
                return out;
              }

              const out = caughtError ? expectScalar(fallbackVal) : expectScalar(firstVal);
              steps.push({
                id: `step-${steps.length + 1}`,
                expression: `IFERROR(...)`,
                description: caughtError
                  ? `Terjadi galat (${caughtError}), menampilkan nilai cadangan`
                  : 'Ekspresi valid tanpa error, hasil dipertahankan',
                result: formatStepVal(out),
                referencedCells: Array.from(referenced),
              });
              return out;
            }

            const args: EvalArgValue[] = [];
            if (peek() && !(peek().type === 'paren' && peek().value === ')')) {
              args.push(parseComparison());
              while (peek() && peek().type === 'sep') {
                consume();
                args.push(parseComparison());
              }
            }
            if (!peek() || peek().type !== 'paren' || peek().value !== ')') {
              throw new ExcelError('#VALUE!', `Kurung tutup ) pada ${tok.value} belum lengkap`);
            }
            consume();
            return callExcelFunction(tok.value, args);
          }
          throw new ExcelError('#NAME?', `Fungsi atau nama tidak dikenal: ${tok.value}`);
        }
        throw new ExcelError('#VALUE!');
      }

      function callExcelFunction(fn: string, args: EvalArgValue[]): EvalArgValue {
        const flat = flattenValues(args);
        const stepRefs = Array.from(referenced);
        let result: EvalArgValue = null;
        let desc = `Menjalankan fungsi ${fn}`;

        switch (fn) {
          case 'SUM': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            result = nums.reduce((acc, n) => acc + n, 0);
            desc = `Menjumlahkan ${nums.length} sel angka (${nums.slice(0, 4).join(' + ')}${nums.length > 4 ? ' + ...' : ''})`;
            break;
          }
          case 'AVERAGE': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            if (nums.length === 0) throw new ExcelError('#DIV/0!');
            result = nums.reduce((acc, n) => acc + n, 0) / nums.length;
            desc = `Menghitung rata-rata dari ${nums.length} nilai numerik`;
            break;
          }
          case 'MIN': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            result = nums.length ? Math.min(...nums) : 0;
            desc = `Mencari nilai terkecil dari ${nums.length} angka`;
            break;
          }
          case 'MAX': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            result = nums.length ? Math.max(...nums) : 0;
            desc = `Mencari nilai terbesar dari ${nums.length} angka`;
            break;
          }
          case 'MEDIAN': {
            const nums = (flat.filter((v) => typeof v === 'number') as number[]).sort((a, b) => a - b);
            if (!nums.length) throw new ExcelError('#NUM!');
            const mid = Math.floor(nums.length / 2);
            result = nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
            desc = `Menghitung nilai tengah dari ${nums.length} angka`;
            break;
          }
          case 'COUNT': {
            result = flat.filter((v) => typeof v === 'number').length;
            desc = `Menghitung jumlah sel berisi angka`;
            break;
          }
          case 'COUNTA': {
            result = flat.filter((v) => v !== null && v !== '').length;
            desc = `Menghitung jumlah sel yang tidak kosong`;
            break;
          }
          case 'IF': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const cond = toBoolean(expectScalar(args[0]));
            result = cond ? expectScalar(args[1]) : args[2] !== undefined ? expectScalar(args[2]) : false;
            desc = `Evaluasi kondisi bernilai ${cond ? 'TRUE (ambil argumen ke-2)' : 'FALSE (ambil argumen ke-3)'}`;
            break;
          }
          case 'IFS': {
            for (let i = 0; i < args.length - 1; i += 2) {
              if (toBoolean(expectScalar(args[i]))) {
                result = expectScalar(args[i + 1]);
                desc = `Kondisi ke-${i / 2 + 1} terpenuhi`;
                break;
              }
            }
            if (result === null) throw new ExcelError('#N/A');
            break;
          }
          case 'AND': {
            result = flat.every((v) => toBoolean(v));
            desc = `Mengecek apakah semua kondisi bernilai TRUE`;
            break;
          }
          case 'OR': {
            result = flat.some((v) => toBoolean(v));
            desc = `Mengecek apakah minimal satu kondisi bernilai TRUE`;
            break;
          }
          case 'NOT': {
            result = !toBoolean(expectScalar(args[0]));
            desc = `Membalikkan nilai logika`;
            break;
          }
          case 'IFERROR': {
            // Note: Errors inside nested calls are handled below if we wrap, or pass-through
            result = expectScalar(args[0]);
            desc = `Mengembalikan nilai utama jika tidak ada error`;
            break;
          }
          case 'COUNTIF': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const range = args[0] && typeof args[0] === 'object' && 'isRange' in args[0] ? args[0].values : [expectScalar(args[0])];
            const criteria = expectScalar(args[1]);
            result = range.filter((v) => matchesCriteria(v, criteria)).length;
            desc = `Menghitung sel yang memenuhi kriteria "${toStringVal(criteria)}"`;
            break;
          }
          case 'SUMIF': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const range = args[0] && typeof args[0] === 'object' && 'isRange' in args[0] ? args[0].values : [expectScalar(args[0])];
            const criteria = expectScalar(args[1]);
            const sumRange = args[2] && typeof args[2] === 'object' && 'isRange' in args[2] ? args[2].values : range;
            let sum = 0;
            range.forEach((v, idx) => {
              if (matchesCriteria(v, criteria) && typeof sumRange[idx] === 'number') {
                sum += sumRange[idx] as number;
              }
            });
            result = sum;
            desc = `Menjumlahkan nilai untuk kriteria "${toStringVal(criteria)}"`;
            break;
          }
          case 'AVERAGEIF': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const range = args[0] && typeof args[0] === 'object' && 'isRange' in args[0] ? args[0].values : [expectScalar(args[0])];
            const criteria = expectScalar(args[1]);
            const avgRange = args[2] && typeof args[2] === 'object' && 'isRange' in args[2] ? args[2].values : range;
            const matched: number[] = [];
            range.forEach((v, idx) => {
              if (matchesCriteria(v, criteria) && typeof avgRange[idx] === 'number') {
                matched.push(avgRange[idx] as number);
              }
            });
            if (matched.length === 0) throw new ExcelError('#DIV/0!');
            result = matched.reduce((a, b) => a + b, 0) / matched.length;
            desc = `Menghitung rata-rata bersyarat (${matched.length} data cocok)`;
            break;
          }
          case 'COUNTIFS': {
            if (args.length < 2 || args.length % 2 !== 0) throw new ExcelError('#VALUE!');
            const firstArg = args[0];
            const firstRange = firstArg && typeof firstArg === 'object' && 'isRange' in firstArg ? firstArg.values : [expectScalar(firstArg)];
            let count = 0;
            for (let idx = 0; idx < firstRange.length; idx++) {
              let ok = true;
              for (let p = 0; p < args.length; p += 2) {
                const argP = args[p];
                const rVals = argP && typeof argP === 'object' && 'isRange' in argP ? argP.values : [expectScalar(argP)];
                const crit = expectScalar(args[p + 1]);
                if (!matchesCriteria(rVals[idx], crit)) {
                  ok = false;
                  break;
                }
              }
              if (ok) count++;
            }
            result = count;
            desc = `Menghitung baris yang memenuhi ${args.length / 2} kriteria sekaligus`;
            break;
          }
          case 'SUMIFS': {
            if (args.length < 3 || args.length % 2 === 0) throw new ExcelError('#VALUE!');
            const sumArg = args[0];
            const sumRange = sumArg && typeof sumArg === 'object' && 'isRange' in sumArg ? sumArg.values : [expectScalar(sumArg)];
            let sum = 0;
            for (let idx = 0; idx < sumRange.length; idx++) {
              let ok = true;
              for (let p = 1; p < args.length; p += 2) {
                const argP = args[p];
                const rVals = argP && typeof argP === 'object' && 'isRange' in argP ? argP.values : [expectScalar(argP)];
                const crit = expectScalar(args[p + 1]);
                if (!matchesCriteria(rVals[idx], crit)) {
                  ok = false;
                  break;
                }
              }
              if (ok && typeof sumRange[idx] === 'number') {
                sum += sumRange[idx] as number;
              }
            }
            result = sum;
            desc = `Menjumlahkan nilai yang memenuhi multi-kriteria`;
            break;
          }
          case 'LEFT': {
            const text = toStringVal(expectScalar(args[0]));
            const n = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 1;
            result = text.slice(0, Math.max(0, n));
            desc = `Mengambil ${n} karakter pertama dari kiri`;
            break;
          }
          case 'RIGHT': {
            const text = toStringVal(expectScalar(args[0]));
            const n = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 1;
            result = n <= 0 ? '' : text.slice(-n);
            desc = `Mengambil ${n} karakter terakhir dari kanan`;
            break;
          }
          case 'MID': {
            const text = toStringVal(expectScalar(args[0]));
            const start = Math.max(1, toNumber(expectScalar(args[1])));
            const count = Math.max(0, toNumber(expectScalar(args[2])));
            result = text.slice(start - 1, start - 1 + count);
            desc = `Mengambil ${count} karakter mulai posisi ke-${start}`;
            break;
          }
          case 'LEN': {
            const text = toStringVal(expectScalar(args[0]));
            result = text.length;
            desc = `Menghitung panjang karakter (${text.length} huruf)`;
            break;
          }
          case 'CONCAT':
          case 'CONCATENATE': {
            result = flat.map((v) => toStringVal(v)).join('');
            desc = `Menggabungkan ${flat.length} teks menjadi satu string`;
            break;
          }
          case 'UPPER': {
            result = toStringVal(expectScalar(args[0])).toUpperCase();
            desc = `Mengubah teks menjadi HURUF KAPITAL`;
            break;
          }
          case 'LOWER': {
            result = toStringVal(expectScalar(args[0])).toLowerCase();
            desc = `Mengubah teks menjadi huruf kecil`;
            break;
          }
          case 'PROPER': {
            result = toStringVal(expectScalar(args[0])).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
            desc = `Mengubah huruf awal setiap kata menjadi kapital`;
            break;
          }
          case 'TRIM': {
            result = toStringVal(expectScalar(args[0])).trim().replace(/\s+/g, ' ');
            desc = `Menghapus spasi berlebih di awal, tengah, dan akhir teks`;
            break;
          }
          case 'TODAY': {
            const d = new Date();
            result = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            desc = `Mengembalikan tanggal hari ini`;
            break;
          }
          case 'ROUND': {
            const num = toNumber(expectScalar(args[0]));
            const digits = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 0;
            const factor = Math.pow(10, digits);
            result = Math.round(num * factor) / factor;
            desc = `Membulatkan angka hingga ${digits} desimal`;
            break;
          }
          case 'ABS': {
            result = Math.abs(toNumber(expectScalar(args[0])));
            desc = `Mengambil nilai absolut`;
            break;
          }
          case 'SQRT': {
            const n = toNumber(expectScalar(args[0]));
            if (n < 0) throw new ExcelError('#NUM!');
            result = Math.sqrt(n);
            desc = `Menghitung akar kuadrat`;
            break;
          }
          case 'VLOOKUP': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const lookupVal = expectScalar(args[0]);
            const tableArg = args[1];
            if (!tableArg || typeof tableArg !== 'object' || !('isRange' in tableArg)) {
              throw new ExcelError('#VALUE!');
            }
            const colIndexNum = toNumber(expectScalar(args[2]));
            const exactMatch = args[3] !== undefined ? !toBoolean(expectScalar(args[3])) : false;

            // Compute table dimensions from coords
            const coords = tableArg.coords;
            const parsed = coords.map((c) => parseCoord(c)!);
            const minC = Math.min(...parsed.map((p) => p.colIndex));
            const maxC = Math.max(...parsed.map((p) => p.colIndex));
            const minR = Math.min(...parsed.map((p) => p.rowIndex));
            const maxR = Math.max(...parsed.map((p) => p.rowIndex));
            const width = maxC - minC + 1;
            const height = maxR - minR + 1;

            if (colIndexNum < 1 || colIndexNum > width) throw new ExcelError('#REF!');

            let foundRow = -1;
            for (let r = 0; r < height; r++) {
              const firstColVal = tableArg.values[r * width];
              if (exactMatch) {
                if (toStringVal(firstColVal).trim().toLowerCase() === toStringVal(lookupVal).trim().toLowerCase()) {
                  foundRow = r;
                  break;
                }
              } else {
                if (typeof lookupVal === 'number' && typeof firstColVal === 'number') {
                  if (firstColVal <= lookupVal) foundRow = r;
                } else if (toStringVal(firstColVal).toLowerCase() === toStringVal(lookupVal).toLowerCase()) {
                  foundRow = r;
                  break;
                }
              }
            }
            if (foundRow === -1) throw new ExcelError('#N/A');
            result = tableArg.values[foundRow * width + (colIndexNum - 1)];
            desc = `Mencari "${toStringVal(lookupVal)}" di kolom ke-1 tabel, mengembalikan kolom ke-${colIndexNum}`;
            break;
          }
          case 'XLOOKUP': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const lookupVal = expectScalar(args[0]);
            const lookupArr = args[1] && typeof args[1] === 'object' && 'isRange' in args[1] ? args[1].values : [expectScalar(args[1])];
            const returnArr = args[2] && typeof args[2] === 'object' && 'isRange' in args[2] ? args[2].values : [expectScalar(args[2])];
            const notFoundVal = args[3] !== undefined ? expectScalar(args[3]) : null;
            const idx = lookupArr.findIndex(
              (v) => toStringVal(v).trim().toLowerCase() === toStringVal(lookupVal).trim().toLowerCase()
            );
            if (idx === -1) {
              if (notFoundVal !== null) {
                result = notFoundVal;
              } else {
                throw new ExcelError('#N/A');
              }
            } else {
              result = returnArr[idx] ?? '';
            }
            desc = `Mencari "${toStringVal(lookupVal)}" secara modern dengan XLOOKUP`;
            break;
          }
          case 'MATCH': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const lookupVal = expectScalar(args[0]);
            const lookupArr = args[1] && typeof args[1] === 'object' && 'isRange' in args[1] ? args[1].values : [expectScalar(args[1])];
            const idx = lookupArr.findIndex(
              (v) => toStringVal(v).trim().toLowerCase() === toStringVal(lookupVal).trim().toLowerCase()
            );
            if (idx === -1) throw new ExcelError('#N/A');
            result = idx + 1;
            desc = `Menemukan posisi baris ke-${idx + 1} untuk "${toStringVal(lookupVal)}"`;
            break;
          }
          case 'INDEX': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const arrArg = args[0];
            if (!arrArg || typeof arrArg !== 'object' || !('isRange' in arrArg)) {
              result = expectScalar(arrArg);
              break;
            }
            let width = 1;
            if (arrArg.coords.length > 0) {
              const parsed = arrArg.coords.map((c) => parseCoord(c)!);
              const minC = Math.min(...parsed.map((p) => p.colIndex));
              const maxC = Math.max(...parsed.map((p) => p.colIndex));
              width = maxC - minC + 1;
            }
            const rowNum = toNumber(expectScalar(args[1]));
            const colNum = args[2] !== undefined ? toNumber(expectScalar(args[2])) : 1;
            const targetIdx = (rowNum - 1) * width + (colNum - 1);
            if (targetIdx < 0 || targetIdx >= arrArg.values.length) throw new ExcelError('#REF!');
            result = arrArg.values[targetIdx];
            desc = `Mengambil sel pada baris ke-${rowNum}, kolom ke-${colNum}`;
            break;
          }
          case 'HLOOKUP': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const lookupVal = expectScalar(args[0]);
            const tableArg = args[1];
            if (!tableArg || typeof tableArg !== 'object' || !('isRange' in tableArg)) {
              throw new ExcelError('#VALUE!');
            }
            const rowIndexNum = toNumber(expectScalar(args[2]));
            const exactMatch = args[3] !== undefined ? !toBoolean(expectScalar(args[3])) : false;

            const coords = tableArg.coords;
            const parsed = coords.map((c) => parseCoord(c)!);
            const minC = Math.min(...parsed.map((p) => p.colIndex));
            const maxC = Math.max(...parsed.map((p) => p.colIndex));
            const minR = Math.min(...parsed.map((p) => p.rowIndex));
            const maxR = Math.max(...parsed.map((p) => p.rowIndex));
            const width = maxC - minC + 1;
            const height = maxR - minR + 1;

            if (rowIndexNum < 1 || rowIndexNum > height) throw new ExcelError('#REF!');

            let foundCol = -1;
            for (let c = 0; c < width; c++) {
              const topRowVal = tableArg.values[c];
              if (exactMatch) {
                if (toStringVal(topRowVal).trim().toLowerCase() === toStringVal(lookupVal).trim().toLowerCase()) {
                  foundCol = c;
                  break;
                }
              } else if (typeof lookupVal === 'number' && typeof topRowVal === 'number') {
                if (topRowVal <= lookupVal) foundCol = c;
              } else if (toStringVal(topRowVal).toLowerCase() === toStringVal(lookupVal).toLowerCase()) {
                foundCol = c;
                break;
              }
            }
            if (foundCol === -1) throw new ExcelError('#N/A');
            result = tableArg.values[(rowIndexNum - 1) * width + foundCol];
            desc = `Mencari "${toStringVal(lookupVal)}" secara mendatar di baris ke-1, mengambil baris ke-${rowIndexNum}`;
            break;
          }
          case 'COUNTBLANK': {
            result = flat.filter((v) => v === null || v === '').length;
            desc = `Menghitung sel yang masih kosong`;
            break;
          }
          case 'ROUNDUP': {
            const num = toNumber(expectScalar(args[0]));
            const digits = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 0;
            const factor = Math.pow(10, digits);
            result = (num >= 0 ? Math.ceil(num * factor) : Math.floor(num * factor)) / factor;
            desc = `Membulatkan ke atas hingga ${digits} desimal`;
            break;
          }
          case 'ROUNDDOWN': {
            const num = toNumber(expectScalar(args[0]));
            const digits = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 0;
            const factor = Math.pow(10, digits);
            result = Math.trunc(num * factor) / factor;
            desc = `Membulatkan ke bawah hingga ${digits} desimal`;
            break;
          }
          case 'INT': {
            result = Math.floor(toNumber(expectScalar(args[0])));
            desc = `Membulatkan ke bawah menjadi bilangan bulat`;
            break;
          }
          case 'MOD': {
            const num = toNumber(expectScalar(args[0]));
            const div = toNumber(expectScalar(args[1]));
            if (div === 0) throw new ExcelError('#DIV/0!');
            result = ((num % div) + div) % div;
            desc = `Menghitung sisa pembagian ${num} oleh ${div}`;
            break;
          }
          case 'POWER': {
            const base = toNumber(expectScalar(args[0]));
            const exp = toNumber(expectScalar(args[1]));
            result = Math.pow(base, exp);
            desc = `Menghitung ${base} pangkat ${exp}`;
            break;
          }
          case 'SUMPRODUCT': {
            if (args.length === 0) throw new ExcelError('#VALUE!');
            const arrays = args.map((a) =>
              a && typeof a === 'object' && 'isRange' in a ? a.values : [expectScalar(a)]
            );
            const len = arrays[0].length;
            if (arrays.some((arr) => arr.length !== len)) throw new ExcelError('#VALUE!');
            let total = 0;
            for (let i = 0; i < len; i++) {
              let prod = 1;
              for (const arr of arrays) {
                const v = arr[i];
                prod *= typeof v === 'number' ? v : 0;
              }
              total += prod;
            }
            result = total;
            desc = `Mengalikan elemen bersesuaian lalu menjumlahkannya (${len} baris)`;
            break;
          }
          case 'LARGE': {
            const nums = (
              args[0] && typeof args[0] === 'object' && 'isRange' in args[0]
                ? args[0].values
                : [expectScalar(args[0])]
            )
              .filter((v) => typeof v === 'number')
              .sort((a, b) => (b as number) - (a as number)) as number[];
            const k = toNumber(expectScalar(args[1]));
            if (k < 1 || k > nums.length) throw new ExcelError('#NUM!');
            result = nums[k - 1];
            desc = `Mengambil nilai terbesar peringkat ke-${k}`;
            break;
          }
          case 'SMALL': {
            const nums = (
              args[0] && typeof args[0] === 'object' && 'isRange' in args[0]
                ? args[0].values
                : [expectScalar(args[0])]
            )
              .filter((v) => typeof v === 'number')
              .sort((a, b) => (a as number) - (b as number)) as number[];
            const k = toNumber(expectScalar(args[1]));
            if (k < 1 || k > nums.length) throw new ExcelError('#NUM!');
            result = nums[k - 1];
            desc = `Mengambil nilai terkecil peringkat ke-${k}`;
            break;
          }
          case 'STDEV':
          case 'STDEV.S': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            if (nums.length < 2) throw new ExcelError('#DIV/0!');
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nums.length - 1);
            result = Math.sqrt(variance);
            desc = `Menghitung simpangan baku sampel dari ${nums.length} data`;
            break;
          }
          case 'XOR': {
            const trueCount = flat.filter((v) => toBoolean(v)).length;
            result = trueCount % 2 === 1;
            desc = `Bernilai TRUE jika jumlah kondisi benar ganjil (${trueCount} benar)`;
            break;
          }
          case 'AVERAGEIFS': {
            if (args.length < 3 || args.length % 2 === 0) throw new ExcelError('#VALUE!');
            const avgArg = args[0];
            const avgRange = avgArg && typeof avgArg === 'object' && 'isRange' in avgArg ? avgArg.values : [expectScalar(avgArg)];
            const matched: number[] = [];
            for (let idx = 0; idx < avgRange.length; idx++) {
              let ok = true;
              for (let p = 1; p < args.length; p += 2) {
                const argP = args[p];
                const rVals = argP && typeof argP === 'object' && 'isRange' in argP ? argP.values : [expectScalar(argP)];
                const crit = expectScalar(args[p + 1]);
                if (!matchesCriteria(rVals[idx], crit)) {
                  ok = false;
                  break;
                }
              }
              if (ok && typeof avgRange[idx] === 'number') {
                matched.push(avgRange[idx] as number);
              }
            }
            if (matched.length === 0) throw new ExcelError('#DIV/0!');
            result = matched.reduce((a, b) => a + b, 0) / matched.length;
            desc = `Menghitung rata-rata multi-kriteria (${matched.length} data cocok)`;
            break;
          }
          case 'MAXIFS':
          case 'MINIFS': {
            if (args.length < 3 || args.length % 2 === 0) throw new ExcelError('#VALUE!');
            const targetArg = args[0];
            const targetRange = targetArg && typeof targetArg === 'object' && 'isRange' in targetArg ? targetArg.values : [expectScalar(targetArg)];
            const matched: number[] = [];
            for (let idx = 0; idx < targetRange.length; idx++) {
              let ok = true;
              for (let p = 1; p < args.length; p += 2) {
                const argP = args[p];
                const rVals = argP && typeof argP === 'object' && 'isRange' in argP ? argP.values : [expectScalar(argP)];
                const crit = expectScalar(args[p + 1]);
                if (!matchesCriteria(rVals[idx], crit)) {
                  ok = false;
                  break;
                }
              }
              if (ok && typeof targetRange[idx] === 'number') {
                matched.push(targetRange[idx] as number);
              }
            }
            result = matched.length === 0 ? 0 : fn === 'MAXIFS' ? Math.max(...matched) : Math.min(...matched);
            desc = `Mengambil nilai ${fn === 'MAXIFS' ? 'tertinggi' : 'terendah'} multi-kriteria`;
            break;
          }
          case 'ISBLANK': {
            const v = expectScalar(args[0]);
            result = v === null || v === '';
            desc = `Memeriksa apakah sel kosong`;
            break;
          }
          case 'ISNUMBER': {
            const v = expectScalar(args[0]);
            result = typeof v === 'number';
            desc = `Memeriksa apakah nilai bertipe angka`;
            break;
          }
          case 'ISTEXT': {
            const v = expectScalar(args[0]);
            result = typeof v === 'string' && v !== '';
            desc = `Memeriksa apakah nilai bertipe teks`;
            break;
          }
          case 'FIND':
          case 'SEARCH': {
            const needle = toStringVal(expectScalar(args[0]));
            const haystack = toStringVal(expectScalar(args[1]));
            const startNum = args[2] !== undefined ? Math.max(1, toNumber(expectScalar(args[2]))) : 1;
            const posFound =
              fn === 'FIND'
                ? haystack.indexOf(needle, startNum - 1)
                : haystack.toLowerCase().indexOf(needle.toLowerCase(), startNum - 1);
            if (posFound === -1) throw new ExcelError('#VALUE!');
            result = posFound + 1;
            desc = `Menemukan posisi teks "${needle}" pada indeks ke-${posFound + 1}`;
            break;
          }
          case 'SUBSTITUTE': {
            const text = toStringVal(expectScalar(args[0]));
            const oldText = toStringVal(expectScalar(args[1]));
            const newText = toStringVal(expectScalar(args[2]));
            if (!oldText) {
              result = text;
            } else if (args[3] !== undefined) {
              const nth = toNumber(expectScalar(args[3]));
              let count = 0;
              result = text.split(oldText).reduce((acc, part, idx, arr) => {
                if (idx === 0) return part;
                count++;
                return acc + (count === nth ? newText : oldText) + part;
              }, '');
            } else {
              result = text.split(oldText).join(newText);
            }
            desc = `Mengganti "${oldText}" menjadi "${newText}"`;
            break;
          }
          case 'REPLACE': {
            const text = toStringVal(expectScalar(args[0]));
            const start = Math.max(1, toNumber(expectScalar(args[1])));
            const numChars = Math.max(0, toNumber(expectScalar(args[2])));
            const newText = toStringVal(expectScalar(args[3]));
            result = text.slice(0, start - 1) + newText + text.slice(start - 1 + numChars);
            desc = `Mengganti ${numChars} karakter mulai posisi ${start}`;
            break;
          }
          case 'REPT': {
            const text = toStringVal(expectScalar(args[0]));
            const times = Math.max(0, Math.floor(toNumber(expectScalar(args[1]))));
            result = text.repeat(times);
            desc = `Mengulang teks sebanyak ${times} kali`;
            break;
          }
          case 'TEXTJOIN': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const delim = toStringVal(expectScalar(args[0]));
            const ignoreEmpty = toBoolean(expectScalar(args[1]));
            const rest = flattenValues(args.slice(2)).map((v) => toStringVal(v));
            const filtered = ignoreEmpty ? rest.filter((s) => s !== '') : rest;
            result = filtered.join(delim);
            desc = `Menggabungkan ${filtered.length} teks dengan pemisah "${delim}"`;
            break;
          }
          case 'TEXT': {
            const rawVal = expectScalar(args[0]);
            const fmt = toStringVal(expectScalar(args[1])).trim();
            if (fmt.includes('%')) {
              const num = toNumber(rawVal);
              const decimals = fmt.includes('.') ? fmt.split('.')[1].replace(/[^0#]/g, '').length : 0;
              result = `${(num * 100).toFixed(decimals)}%`;
            } else if (fmt.toLowerCase().includes('yyyy')) {
              const d = parseExcelDate(rawVal);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = String(d.getFullYear());
              result = fmt
                .replace(/yyyy/gi, yyyy)
                .replace(/mm/gi, mm)
                .replace(/dd/gi, dd);
            } else if (fmt.includes('#,##0') || fmt.includes('0')) {
              const num = toNumber(rawVal);
              const decimals = fmt.includes('.') ? fmt.split('.')[1].length : 0;
              result = num.toLocaleString('id-ID', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              });
            } else {
              result = toStringVal(rawVal);
            }
            desc = `Memformat nilai sesuai pola "${fmt}"`;
            break;
          }
          case 'VALUE': {
            const cleaned = toStringVal(expectScalar(args[0])).replace(/[^0-9.-]/g, '');
            const parsed = Number(cleaned);
            if (cleaned === '' || Number.isNaN(parsed)) throw new ExcelError('#VALUE!');
            result = parsed;
            desc = `Mengonversi teks menjadi angka (${parsed})`;
            break;
          }
          case 'NOW': {
            const d = new Date();
            result = `${formatDateISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            desc = `Mengembalikan tanggal dan jam saat ini`;
            break;
          }
          case 'YEAR': {
            const d = parseExcelDate(expectScalar(args[0]));
            result = d.getFullYear();
            desc = `Mengambil tahun dari tanggal (${result})`;
            break;
          }
          case 'MONTH': {
            const d = parseExcelDate(expectScalar(args[0]));
            result = d.getMonth() + 1;
            desc = `Mengambil bulan (1–12) dari tanggal`;
            break;
          }
          case 'DAY': {
            const d = parseExcelDate(expectScalar(args[0]));
            result = d.getDate();
            desc = `Mengambil tanggal hari dari tanggal`;
            break;
          }
          case 'DATEDIF': {
            const d1 = parseExcelDate(expectScalar(args[0]));
            const d2 = parseExcelDate(expectScalar(args[1]));
            const unit = toStringVal(expectScalar(args[2])).trim().toUpperCase();
            if (d1 > d2) throw new ExcelError('#NUM!');
            if (unit === 'D') {
              result = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
            } else if (unit === 'M') {
              result =
                (d2.getFullYear() - d1.getFullYear()) * 12 +
                (d2.getMonth() - d1.getMonth()) -
                (d2.getDate() < d1.getDate() ? 1 : 0);
            } else if (unit === 'Y') {
              let years = d2.getFullYear() - d1.getFullYear();
              if (
                d2.getMonth() < d1.getMonth() ||
                (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())
              ) {
                years--;
              }
              result = years;
            } else {
              throw new ExcelError('#NUM!');
            }
            desc = `Menghitung selisih tanggal dalam satuan ${unit}`;
            break;
          }
          case 'EDATE': {
            const d = parseExcelDate(expectScalar(args[0]));
            const months = Math.trunc(toNumber(expectScalar(args[1])));
            const nextD = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
            result = formatDateISO(nextD);
            desc = `Menggeser tanggal sebanyak ${months} bulan`;
            break;
          }
          case 'CHOOSE': {
            const idx = Math.trunc(toNumber(expectScalar(args[0])));
            if (idx < 1 || idx >= args.length) throw new ExcelError('#VALUE!');
            result = expectScalar(args[idx]);
            desc = `Memilih opsi ke-${idx} dari daftar`;
            break;
          }
          case 'ROW': {
            if (args.length === 0) {
              const cur = parseCoord(norm);
              result = cur ? cur.rowIndex + 1 : 1;
            } else if (args[0] && typeof args[0] === 'object' && 'isRange' in args[0]) {
              const first = parseCoord(args[0].coords[0]);
              result = first ? first.rowIndex + 1 : 1;
            } else {
              const refs = extractCellReferences(raw);
              const first = refs[0] ? parseCoord(refs[0]) : parseCoord(norm);
              result = first ? first.rowIndex + 1 : 1;
            }
            desc = `Mengembalikan nomor baris (${result})`;
            break;
          }
          case 'COLUMN': {
            if (args.length === 0) {
              const cur = parseCoord(norm);
              result = cur ? cur.colIndex + 1 : 1;
            } else if (args[0] && typeof args[0] === 'object' && 'isRange' in args[0]) {
              const first = parseCoord(args[0].coords[0]);
              result = first ? first.colIndex + 1 : 1;
            } else {
              const refs = extractCellReferences(raw);
              const first = refs[0] ? parseCoord(refs[0]) : parseCoord(norm);
              result = first ? first.colIndex + 1 : 1;
            }
            desc = `Mengembalikan nomor kolom (${result})`;
            break;
          }
          case 'PMT': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const rate = toNumber(expectScalar(args[0]));
            const nper = toNumber(expectScalar(args[1]));
            const pv = toNumber(expectScalar(args[2]));
            if (nper === 0) throw new ExcelError('#NUM!');
            result =
              rate === 0
                ? -pv / nper
                : -(pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
            desc = `Menghitung angsuran tetap per periode (${nper}x, bunga ${(rate * 100).toFixed(2)}%)`;
            break;
          }
          case 'FV': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const rate = toNumber(expectScalar(args[0]));
            const nper = toNumber(expectScalar(args[1]));
            const pmt = toNumber(expectScalar(args[2]));
            const pv = args[3] !== undefined ? toNumber(expectScalar(args[3])) : 0;
            result =
              rate === 0
                ? -(pv + pmt * nper)
                : -(pv * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate));
            desc = `Menghitung nilai masa depan investasi (${nper} periode)`;
            break;
          }
          case 'PV': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const rate = toNumber(expectScalar(args[0]));
            const nper = toNumber(expectScalar(args[1]));
            const pmt = toNumber(expectScalar(args[2]));
            result =
              rate === 0
                ? -(pmt * nper)
                : -(pmt * (1 - Math.pow(1 + rate, -nper)) / rate);
            desc = `Menghitung nilai sekarang (Present Value) dari cicilan berkala`;
            break;
          }
          case 'NPV': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const rate = toNumber(expectScalar(args[0]));
            const cashflows = flattenValues(args.slice(1)).filter((v) => typeof v === 'number') as number[];
            let total = 0;
            cashflows.forEach((cf, idx) => {
              total += cf / Math.pow(1 + rate, idx + 1);
            });
            result = total;
            desc = `Menghitung Net Present Value dari ${cashflows.length} arus kas`;
            break;
          }
          case 'SWITCH': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const expr = expectScalar(args[0]);
            let matched: ExcelPrimitive | null = null;
            for (let i = 1; i + 1 < args.length; i += 2) {
              const caseVal = expectScalar(args[i]);
              if (toStringVal(expr).trim().toLowerCase() === toStringVal(caseVal).trim().toLowerCase()) {
                matched = expectScalar(args[i + 1]);
                break;
              }
            }
            if (matched === null) {
              if (args.length % 2 === 0) {
                matched = expectScalar(args[args.length - 1]);
              } else {
                throw new ExcelError('#N/A');
              }
            }
            result = matched;
            desc = `Mencocokkan nilai ${formatStepVal(expr)} dengan daftar SWITCH`;
            break;
          }
          case 'UNIQUE': {
            const seen = new Set<string>();
            const uniqueVals: ExcelPrimitive[] = [];
            for (const v of flat) {
              if (v === null || v === '') continue;
              const key = toStringVal(v).trim().toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                uniqueVals.push(v);
              }
            }
            result = { isRange: true, coords: [], values: uniqueVals };
            desc = `Menyaring ${uniqueVals.length} nilai unik dari rentang data`;
            break;
          }
          case 'FILTER': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const arrArg = args[0];
            const includeArg = args[1];
            const ifEmpty = args[2] !== undefined ? expectScalar(args[2]) : null;
            const arrVals =
              arrArg && typeof arrArg === 'object' && 'isRange' in arrArg
                ? arrArg.values
                : [expectScalar(arrArg)];
            const incVals =
              includeArg && typeof includeArg === 'object' && 'isRange' in includeArg
                ? includeArg.values
                : [expectScalar(includeArg)];

            // Support filtering when include arg is a range of booleans or a 1-row/col comparison result
            const out: ExcelPrimitive[] = [];
            arrVals.forEach((v, idx) => {
              const flag = incVals[idx];
              let keep = false;
              if (typeof flag === 'boolean') keep = flag;
              else if (typeof flag === 'number') keep = flag !== 0;
              else if (flag !== undefined && flag !== '') keep = toBoolean(flag);
              if (keep) out.push(v);
            });
            if (out.length === 0) {
              if (ifEmpty !== null) {
                result = ifEmpty;
              } else {
                throw new ExcelError('#CALC!');
              }
            } else {
              result = { isRange: true, coords: [], values: out };
            }
            desc = `Menyaring ${out.length} baris yang memenuhi kriteria FILTER`;
            break;
          }
          case 'SORT': {
            const arrVals = flat.filter((v) => v !== null && v !== '');
            const order = args[2] !== undefined ? toNumber(expectScalar(args[2])) : 1;
            const sorted = [...arrVals].sort((a, b) => {
              if (typeof a === 'number' && typeof b === 'number') {
                return order < 0 ? b - a : a - b;
              }
              const cmp = toStringVal(a).localeCompare(toStringVal(b), 'id');
              return order < 0 ? -cmp : cmp;
            });
            result = { isRange: true, coords: [], values: sorted };
            desc = `Mengurutkan ${sorted.length} data secara ${order < 0 ? 'menurun' : 'menaik'}`;
            break;
          }
          case 'SEQUENCE': {
            const rowsCount = Math.max(1, Math.min(50, Math.trunc(toNumber(expectScalar(args[0])))));
            const start = args[2] !== undefined ? toNumber(expectScalar(args[2])) : 1;
            const step = args[3] !== undefined ? toNumber(expectScalar(args[3])) : 1;
            const seq: number[] = [];
            for (let i = 0; i < rowsCount; i++) {
              seq.push(start + i * step);
            }
            result = { isRange: true, coords: [], values: seq };
            desc = `Membuat deret ${rowsCount} angka mulai ${start} (langkah ${step})`;
            break;
          }
          case 'XMATCH': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const lookupVal = expectScalar(args[0]);
            const lookupArr =
              args[1] && typeof args[1] === 'object' && 'isRange' in args[1]
                ? args[1].values
                : [expectScalar(args[1])];
            const idx = lookupArr.findIndex(
              (v) => toStringVal(v).trim().toLowerCase() === toStringVal(lookupVal).trim().toLowerCase()
            );
            if (idx === -1) throw new ExcelError('#N/A');
            result = idx + 1;
            desc = `Menemukan posisi ke-${idx + 1} menggunakan XMATCH`;
            break;
          }
          case 'CHOOSECOLS': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const tableArg = args[0];
            if (!tableArg || typeof tableArg !== 'object' || !('isRange' in tableArg) || tableArg.coords.length === 0) {
              throw new ExcelError('#VALUE!');
            }
            const parsed = tableArg.coords.map((c) => parseCoord(c)!);
            const minC = Math.min(...parsed.map((p) => p.colIndex));
            const maxC = Math.max(...parsed.map((p) => p.colIndex));
            const minR = Math.min(...parsed.map((p) => p.rowIndex));
            const maxR = Math.max(...parsed.map((p) => p.rowIndex));
            const width = maxC - minC + 1;
            const height = maxR - minR + 1;
            const colIndices = args.slice(1).map((a) => Math.trunc(toNumber(expectScalar(a))));
            const out: ExcelPrimitive[] = [];
            for (let r = 0; r < height; r++) {
              for (const colIdx of colIndices) {
                if (colIdx < 1 || colIdx > width) throw new ExcelError('#VALUE!');
                out.push(tableArg.values[r * width + (colIdx - 1)]);
              }
            }
            result = { isRange: true, coords: [], values: out };
            desc = `Memilih kolom ke-${colIndices.join(', ')} dari tabel`;
            break;
          }
          case 'EOMONTH': {
            const d = parseExcelDate(expectScalar(args[0]));
            const months = Math.trunc(toNumber(expectScalar(args[1])));
            const eom = new Date(d.getFullYear(), d.getMonth() + months + 1, 0);
            result = formatDateISO(eom);
            desc = `Mengambil tanggal akhir bulan (${result})`;
            break;
          }
          case 'NETWORKDAYS': {
            const startD = parseExcelDate(expectScalar(args[0]));
            const endD = parseExcelDate(expectScalar(args[1]));
            const sign = startD <= endD ? 1 : -1;
            const cur = new Date(sign === 1 ? startD : endD);
            const last = sign === 1 ? endD : startD;
            let count = 0;
            while (cur <= last) {
              const day = cur.getDay();
              if (day !== 0 && day !== 6) count++;
              cur.setDate(cur.getDate() + 1);
            }
            result = count * sign;
            desc = `Menghitung ${Math.abs(result)} hari kerja (Senin–Jumat)`;
            break;
          }
          case 'WORKDAY': {
            const startD = parseExcelDate(expectScalar(args[0]));
            let days = Math.trunc(toNumber(expectScalar(args[1])));
            const stepDir = days >= 0 ? 1 : -1;
            days = Math.abs(days);
            const cur = new Date(startD);
            while (days > 0) {
              cur.setDate(cur.getDate() + stepDir);
              const d = cur.getDay();
              if (d !== 0 && d !== 6) days--;
            }
            result = formatDateISO(cur);
            desc = `Menentukan tanggal kerja target (${result})`;
            break;
          }
          case 'WEEKDAY': {
            const d = parseExcelDate(expectScalar(args[0]));
            const returnType = args[1] !== undefined ? toNumber(expectScalar(args[1])) : 1;
            const jsDay = d.getDay(); // 0=Sun..6=Sat
            result = returnType === 2 ? (jsDay === 0 ? 7 : jsDay) : jsDay + 1;
            desc = `Mengembalikan indeks hari dalam minggu (${result})`;
            break;
          }
          case 'DATE': {
            const y = Math.trunc(toNumber(expectScalar(args[0])));
            const m = Math.trunc(toNumber(expectScalar(args[1])));
            const day = Math.trunc(toNumber(expectScalar(args[2])));
            result = formatDateISO(new Date(y, m - 1, day));
            desc = `Membentuk tanggal ${result}`;
            break;
          }
          case 'TEXTBEFORE': {
            const text = toStringVal(expectScalar(args[0]));
            const delim = toStringVal(expectScalar(args[1]));
            const idx = text.indexOf(delim);
            if (idx === -1) throw new ExcelError('#N/A');
            result = text.slice(0, idx);
            desc = `Mengambil teks sebelum pemisah "${delim}"`;
            break;
          }
          case 'TEXTAFTER': {
            const text = toStringVal(expectScalar(args[0]));
            const delim = toStringVal(expectScalar(args[1]));
            const idx = text.indexOf(delim);
            if (idx === -1) throw new ExcelError('#N/A');
            result = text.slice(idx + delim.length);
            desc = `Mengambil teks setelah pemisah "${delim}"`;
            break;
          }
          case 'EXACT': {
            const a = toStringVal(expectScalar(args[0]));
            const b = toStringVal(expectScalar(args[1]));
            result = a === b;
            desc = `Membandingkan kecocokan persis (peka huruf kapital)`;
            break;
          }
          case 'CLEAN': {
            result = toStringVal(expectScalar(args[0])).replace(/[\x00-\x1F\x7F]/g, '');
            desc = `Membersihkan karakter non-cetak dari teks`;
            break;
          }
          case 'RANK':
          case 'RANK.EQ': {
            const num = toNumber(expectScalar(args[0]));
            const nums = (
              args[1] && typeof args[1] === 'object' && 'isRange' in args[1]
                ? args[1].values
                : [expectScalar(args[1])]
            ).filter((v) => typeof v === 'number') as number[];
            const order = args[2] !== undefined ? toNumber(expectScalar(args[2])) : 0;
            const sorted = [...nums].sort((a, b) => (order === 0 ? b - a : a - b));
            const idx = sorted.indexOf(num);
            if (idx === -1) throw new ExcelError('#N/A');
            result = idx + 1;
            desc = `Menentukan peringkat nilai ${num} (${idx + 1} dari ${nums.length})`;
            break;
          }
          case 'PERCENTILE':
          case 'PERCENTILE.INC': {
            const nums = (
              args[0] && typeof args[0] === 'object' && 'isRange' in args[0]
                ? args[0].values
                : [expectScalar(args[0])]
            )
              .filter((v) => typeof v === 'number')
              .sort((a, b) => (a as number) - (b as number)) as number[];
            const k = toNumber(expectScalar(args[1]));
            if (nums.length === 0 || k < 0 || k > 1) throw new ExcelError('#NUM!');
            const posIdx = k * (nums.length - 1);
            const lo = Math.floor(posIdx);
            const hi = Math.ceil(posIdx);
            result = lo === hi ? nums[lo] : nums[lo] + (posIdx - lo) * (nums[hi] - nums[lo]);
            desc = `Menghitung persentil ke-${Math.round(k * 100)}`;
            break;
          }
          case 'QUARTILE':
          case 'QUARTILE.INC': {
            const nums = (
              args[0] && typeof args[0] === 'object' && 'isRange' in args[0]
                ? args[0].values
                : [expectScalar(args[0])]
            )
              .filter((v) => typeof v === 'number')
              .sort((a, b) => (a as number) - (b as number)) as number[];
            const q = toNumber(expectScalar(args[1]));
            if (nums.length === 0 || q < 0 || q > 4) throw new ExcelError('#NUM!');
            const k = q / 4;
            const posIdx = k * (nums.length - 1);
            const lo = Math.floor(posIdx);
            const hi = Math.ceil(posIdx);
            result = lo === hi ? nums[lo] : nums[lo] + (posIdx - lo) * (nums[hi] - nums[lo]);
            desc = `Menghitung kuartil ke-${q}`;
            break;
          }
          case 'CEILING': {
            const num = toNumber(expectScalar(args[0]));
            const sig = toNumber(expectScalar(args[1]));
            if (sig === 0) result = 0;
            else result = Math.ceil(num / sig) * sig;
            desc = `Membulatkan ke atas ke kelipatan ${sig}`;
            break;
          }
          case 'FLOOR': {
            const num = toNumber(expectScalar(args[0]));
            const sig = toNumber(expectScalar(args[1]));
            if (sig === 0) throw new ExcelError('#DIV/0!');
            result = Math.floor(num / sig) * sig;
            desc = `Membulatkan ke bawah ke kelipatan ${sig}`;
            break;
          }
          case 'MROUND': {
            const num = toNumber(expectScalar(args[0]));
            const mult = toNumber(expectScalar(args[1]));
            if (mult === 0) result = 0;
            else result = Math.round(num / mult) * mult;
            desc = `Membulatkan ke kelipatan terdekat dari ${mult}`;
            break;
          }
          case 'SUBTOTAL': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const fnNum = Math.trunc(toNumber(expectScalar(args[0])));
            const restVals = flattenValues(args.slice(1));
            const nums = restVals.filter((v) => typeof v === 'number') as number[];
            const code = fnNum > 100 ? fnNum - 100 : fnNum;
            if (code === 1) {
              if (nums.length === 0) throw new ExcelError('#DIV/0!');
              result = nums.reduce((a, b) => a + b, 0) / nums.length;
            } else if (code === 2) {
              result = nums.length;
            } else if (code === 3) {
              result = restVals.filter((v) => v !== null && v !== '').length;
            } else if (code === 4) {
              result = nums.length ? Math.max(...nums) : 0;
            } else if (code === 5) {
              result = nums.length ? Math.min(...nums) : 0;
            } else if (code === 9) {
              result = nums.reduce((a, b) => a + b, 0);
            } else {
              throw new ExcelError('#VALUE!');
            }
            desc = `Menjalankan agregasi SUBTOTAL kode ${fnNum}`;
            break;
          }
          case 'RAND': {
            result = Number(Math.random().toFixed(4));
            desc = `Menghasilkan angka acak antara 0 dan 1`;
            break;
          }
          case 'RANDBETWEEN': {
            const bottom = Math.ceil(toNumber(expectScalar(args[0])));
            const top = Math.floor(toNumber(expectScalar(args[1])));
            if (bottom > top) throw new ExcelError('#NUM!');
            result = Math.floor(Math.random() * (top - bottom + 1)) + bottom;
            desc = `Menghasilkan angka acak bulat antara ${bottom} dan ${top}`;
            break;
          }
          case 'MODE':
          case 'MODE.SNGL': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            if (nums.length === 0) throw new ExcelError('#N/A');
            const counts = new Map<number, number>();
            let bestNum = nums[0];
            let bestCount = 0;
            for (const n of nums) {
              const c = (counts.get(n) ?? 0) + 1;
              counts.set(n, c);
              if (c > bestCount) {
                bestCount = c;
                bestNum = n;
              }
            }
            if (bestCount <= 1) throw new ExcelError('#N/A');
            result = bestNum;
            desc = `Menemukan nilai yang paling sering muncul (${bestNum}, ${bestCount} kali)`;
            break;
          }
          case 'VAR':
          case 'VAR.S': {
            const nums = flat.filter((v) => typeof v === 'number') as number[];
            if (nums.length < 2) throw new ExcelError('#DIV/0!');
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            result = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nums.length - 1);
            desc = `Menghitung varians sampel dari ${nums.length} data`;
            break;
          }
          case 'CORREL': {
            if (args.length < 2) throw new ExcelError('#VALUE!');
            const arr1 = (
              args[0] && typeof args[0] === 'object' && 'isRange' in args[0]
                ? args[0].values
                : [expectScalar(args[0])]
            );
            const arr2 = (
              args[1] && typeof args[1] === 'object' && 'isRange' in args[1]
                ? args[1].values
                : [expectScalar(args[1])]
            );
            if (arr1.length !== arr2.length) throw new ExcelError('#N/A');
            const pairs: [number, number][] = [];
            for (let i = 0; i < arr1.length; i++) {
              if (typeof arr1[i] === 'number' && typeof arr2[i] === 'number') {
                pairs.push([arr1[i] as number, arr2[i] as number]);
              }
            }
            if (pairs.length < 2) throw new ExcelError('#DIV/0!');
            const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
            const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
            let num = 0;
            let denX = 0;
            let denY = 0;
            for (const [x, y] of pairs) {
              const dx = x - meanX;
              const dy = y - meanY;
              num += dx * dy;
              denX += dx * dx;
              denY += dy * dy;
            }
            const den = Math.sqrt(denX * denY);
            if (den === 0) throw new ExcelError('#DIV/0!');
            result = Number((num / den).toFixed(4));
            desc = `Menghitung koefisien korelasi Pearson (${pairs.length} pasangan data)`;
            break;
          }
          case 'NPER': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const rate = toNumber(expectScalar(args[0]));
            const pmt = toNumber(expectScalar(args[1]));
            const pv = toNumber(expectScalar(args[2]));
            const fv = args[3] !== undefined ? toNumber(expectScalar(args[3])) : 0;
            if (rate === 0) {
              if (pmt === 0) throw new ExcelError('#DIV/0!');
              result = -(pv + fv) / pmt;
            } else {
              const numVal = pmt - fv * rate;
              const denVal = pmt + pv * rate;
              if (denVal === 0 || numVal / denVal <= 0) throw new ExcelError('#NUM!');
              result = Math.log(numVal / denVal) / Math.log(1 + rate);
            }
            desc = `Menghitung jumlah periode pembayaran (${Number((result as number).toFixed(2))} periode)`;
            break;
          }
          case 'RATE': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const nper = toNumber(expectScalar(args[0]));
            const pmt = toNumber(expectScalar(args[1]));
            const pv = toNumber(expectScalar(args[2]));
            const fv = args[3] !== undefined ? toNumber(expectScalar(args[3])) : 0;
            let guess = args[4] !== undefined ? toNumber(expectScalar(args[4])) : 0.1;
            if (nper <= 0) throw new ExcelError('#NUM!');
            for (let iter = 0; iter < 50; iter++) {
              const t1 = Math.pow(1 + guess, nper);
              const f = pv * t1 + pmt * ((t1 - 1) / guess) + fv;
              const dt1 = nper * Math.pow(1 + guess, nper - 1);
              const df =
                pv * dt1 +
                pmt * ((guess * dt1 - (t1 - 1)) / (guess * guess));
              if (Math.abs(f) < 1e-7) break;
              if (df === 0) throw new ExcelError('#NUM!');
              guess = guess - f / df;
            }
            if (!Number.isFinite(guess)) throw new ExcelError('#NUM!');
            result = Number(guess.toFixed(6));
            desc = `Menghitung suku bunga per periode (${(guess * 100).toFixed(2)}%)`;
            break;
          }
          case 'IRR': {
            const cashflows = flattenValues(args).filter((v) => typeof v === 'number') as number[];
            if (cashflows.length < 2) throw new ExcelError('#NUM!');
            let r = 0.1;
            for (let iter = 0; iter < 60; iter++) {
              let npvVal = 0;
              let dNpv = 0;
              for (let t = 0; t < cashflows.length; t++) {
                npvVal += cashflows[t] / Math.pow(1 + r, t);
                if (t > 0) dNpv -= (t * cashflows[t]) / Math.pow(1 + r, t + 1);
              }
              if (Math.abs(npvVal) < 1e-6) break;
              if (dNpv === 0) throw new ExcelError('#NUM!');
              r = r - npvVal / dNpv;
            }
            if (!Number.isFinite(r)) throw new ExcelError('#NUM!');
            result = Number(r.toFixed(6));
            desc = `Menghitung Internal Rate of Return (${(r * 100).toFixed(2)}%)`;
            break;
          }
          case 'SLN': {
            if (args.length < 3) throw new ExcelError('#VALUE!');
            const cost = toNumber(expectScalar(args[0]));
            const salvage = toNumber(expectScalar(args[1]));
            const life = toNumber(expectScalar(args[2]));
            if (life === 0) throw new ExcelError('#DIV/0!');
            result = (cost - salvage) / life;
            desc = `Menghitung penyusutan garis lurus per periode`;
            break;
          }
          default:
            throw new ExcelError('#NAME?', `Fungsi ${fn} belum didukung`);
        }

        steps.push({
          id: `step-${steps.length + 1}`,
          expression: `${fn}(...)`,
          description: desc,
          result: formatStepVal(result),
          referencedCells: stepRefs,
        });
        return result;
      }

      const finalVal: ExcelPrimitive = expectScalar(parseComparison());

      const res: CellEvaluation = {
        value: finalVal,
        displayValue: formatCellValue(finalVal, cell.format),
        referencedCells: Array.from(referenced),
        steps,
      };
      cache[norm] = res;
      return res;
    } catch (err) {
      const code = err instanceof ExcelError ? err.code : '#ERROR!';
      const res: CellEvaluation = {
        value: code,
        displayValue: code,
        error: code,
        referencedCells: Array.from(referenced),
        steps,
      };
      cache[norm] = res;
      return res;
    } finally {
      visiting.delete(norm);
    }
  }

  for (const r of ROWS) {
    for (const c of COLS) {
      const coord = `${c}${r}`;
      if (grid[coord]) {
        evalCell(coord);
      }
    }
  }

  return cache;
}
