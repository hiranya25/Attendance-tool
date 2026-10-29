// Minimal reader for old-style .xls files (BIFF8). It returns the first worksheet as text cells, which is all
// the punch system's export needs. Only reading is supported; nothing in the file is executed.
import CFB from 'cfb';

type Cells = string[][];

export function readXls(buf: Buffer): Cells {
  const container = CFB.read(buf, { type: 'buffer' });
  const entry = CFB.find(container, 'Workbook') ?? CFB.find(container, 'Book');
  if (!entry?.content) throw new Error('This is not an Excel workbook.');
  const data = Buffer.from(entry.content as Uint8Array);

  const records: { type: number; body: Buffer }[] = [];
  for (let p = 0; p + 4 <= data.length; ) {
    const type = data.readUInt16LE(p);
    const len = data.readUInt16LE(p + 2);
    records.push({ type, body: data.subarray(p + 4, p + 4 + len) });
    p += 4 + len;
  }

  let sst: string[] = [];
  const sheets: Cells[] = [];
  let current: Cells | null = null;
  let bofCount = 0;
  let pendingFormula: { r: number; c: number } | null = null;

  for (let i = 0; i < records.length; i++) {
    const { type, body } = records[i];
    switch (type) {
      case 0x0809: // BOF
        bofCount++;
        if (bofCount > 1) { current = []; sheets.push(current); }
        break;
      case 0x000a: // EOF
        current = null;
        break;
      case 0x00fc: { // SST, followed by CONTINUE records
        const segs = [body];
        while (records[i + 1]?.type === 0x003c) segs.push(records[++i].body);
        sst = readSst(segs);
        break;
      }
      case 0x00fd: // LABELSST
        if (current) set(current, body.readUInt16LE(0), body.readUInt16LE(2), sst[body.readUInt32LE(6)] ?? '');
        break;
      case 0x0204: // LABEL
        if (current) set(current, body.readUInt16LE(0), body.readUInt16LE(2), readLongString(body, 6));
        break;
      case 0x0203: // NUMBER
        if (current) set(current, body.readUInt16LE(0), body.readUInt16LE(2), num(body.readDoubleLE(6)));
        break;
      case 0x027e: // RK
        if (current) set(current, body.readUInt16LE(0), body.readUInt16LE(2), num(rk(body.readUInt32LE(6))));
        break;
      case 0x00bd: { // MULRK
        if (!current) break;
        const r = body.readUInt16LE(0);
        const first = body.readUInt16LE(2);
        const n = (body.length - 6) / 6;
        for (let k = 0; k < n; k++) set(current, r, first + k, num(rk(body.readUInt32LE(4 + k * 6 + 2))));
        break;
      }
      case 0x0006: { // FORMULA: cached result
        if (!current) break;
        const r = body.readUInt16LE(0);
        const c = body.readUInt16LE(2);
        if (body.readUInt16LE(12) === 0xffff) {
          if (body[6] === 0) pendingFormula = { r, c }; // string result in the next STRING record
          else if (body[6] === 1) set(current, r, c, body[8] ? 'TRUE' : 'FALSE');
        } else {
          set(current, r, c, num(body.readDoubleLE(6)));
        }
        break;
      }
      case 0x0207: // STRING (formula result)
        if (current && pendingFormula) set(current, pendingFormula.r, pendingFormula.c, readLongString(body, 0));
        pendingFormula = null;
        break;
    }
  }
  if (!sheets.length) throw new Error('The workbook has no worksheet.');
  return Array.from(sheets[0], (row) => Array.from(row ?? [], (v) => v ?? ''));
}

function set(cells: Cells, r: number, c: number, v: string) {
  (cells[r] ??= [])[c] = v;
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e9) / 1e9);
}

function rk(v: number): number {
  const div100 = v & 1;
  let n: number;
  if (v & 2) {
    n = v >> 2;
  } else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(v & 0xfffffffc, 4);
    n = b.readDoubleLE(0);
  }
  return div100 ? n / 100 : n;
}

/** XLUnicodeString: 16-bit length, flags byte, then 8-bit or UTF-16 characters. */
function readLongString(b: Buffer, off: number): string {
  const cch = b.readUInt16LE(off);
  const high = b[off + 2] & 1;
  const start = off + 3;
  return high ? b.toString('utf16le', start, start + cch * 2) : b.toString('latin1', start, start + cch);
}

/** Shared strings table. Strings can run across CONTINUE records; each continuation restarts with a flags byte. */
function readSst(segs: Buffer[]): string[] {
  let s = 0;
  let o = 0;
  const left = () => segs[s].length - o;
  const next = () => { s++; o = 0; };
  const u8 = () => { if (left() < 1) next(); return segs[s][o++]; };
  const u16 = () => { const a = u8(); return a | (u8() << 8); };
  const u32 = () => { const a = u16(); return (a | (u16() << 16)) >>> 0; };
  const skip = (n: number) => { while (n > 0) { if (left() === 0) next(); const k = Math.min(n, left()); o += k; n -= k; } };

  u32(); // total references
  const unique = u32();
  const out: string[] = [];
  for (let i = 0; i < unique && s < segs.length; i++) {
    if (left() === 0) { if (s + 1 >= segs.length) break; next(); }
    const cch = u16();
    const flags = u8();
    let high = flags & 1;
    const runs = flags & 8 ? u16() : 0;
    const ext = flags & 4 ? u32() : 0;
    let str = '';
    let need = cch;
    while (need > 0) {
      if (left() === 0) { next(); high = segs[s][o++] & 1; }
      const avail = high ? Math.floor(left() / 2) : left();
      const take = Math.min(need, avail);
      str += high ? segs[s].toString('utf16le', o, o + take * 2) : segs[s].toString('latin1', o, o + take);
      o += high ? take * 2 : take;
      need -= take;
    }
    skip(runs * 4 + ext);
    out.push(str);
  }
  return out;
}
