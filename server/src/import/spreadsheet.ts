// Reads the first worksheet of an .xls, .xlsx or .ods file as text cells.
// Dates become "dd/mm/yyyy" and clock times "hh:mm", matching how the punch export writes them.
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readXls } from './xls.ts';

export type Rows = string[][];

export async function readSheetRows(buf: Buffer): Promise<Rows> {
  if (buf.subarray(0, 2).toString('latin1') !== 'PK') return readXls(buf);
  const zip = await JSZip.loadAsync(buf);
  const mimetype = await zip.file('mimetype')?.async('string');
  if (mimetype?.includes('opendocument.spreadsheet')) return readOds(zip);
  return readXlsx(buf);
}

const p2 = (x: number) => String(x).padStart(2, '0');
const dmy = (y: number, m: number, d: number) => `${p2(d)}/${p2(m)}/${y}`;

async function readXlsx(buf: Buffer): Promise<Rows> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buf as unknown as ArrayBuffer);
  const sheet = book.worksheets[0];
  if (!sheet) return [];
  const rows: Rows = [];
  sheet.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const v = cell.value;
      let text: string;
      if (v instanceof Date) {
        text = v.getUTCFullYear() < 1901 ? `${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}` : dmy(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
      } else {
        text = cell.text ?? '';
      }
      cells[c - 1] = text;
    });
    rows[n - 1] = Array.from(cells, (x) => x ?? '');
  });
  return Array.from(rows, (r) => r ?? []);
}

/** OpenDocument (.ods, from LibreOffice or Google Sheets): the first table in content.xml. */
async function readOds(zip: JSZip): Promise<Rows> {
  const xml = (await zip.file('content.xml')?.async('string')) ?? '';
  const table = /<table:table\b[^>]*>([\s\S]*?)<\/table:table>/.exec(xml)?.[1] ?? '';
  const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const rows: Rows = [];
  const rowRe = /<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g;
  for (let m = rowRe.exec(table); m; m = rowRe.exec(table)) {
    const repeat = Math.min(Number(/table:number-rows-repeated="(\d+)"/.exec(m[1])?.[1] ?? 1), 5);
    const cells: string[] = [];
    const cellRe = /<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g;
    const body = m[2] ?? '';
    for (let c = cellRe.exec(body); c; c = cellRe.exec(body)) {
      const attrs = c[1];
      const n = Math.min(Number(/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1), 60);
      const date = /office:date-value="(\d{4})-(\d{2})-(\d{2})/.exec(attrs);
      const text = date
        ? dmy(Number(date[1]), Number(date[2]), Number(date[3]))
        : unescape((c[2] ?? '').replace(/<text:s\b[^>]*\/>/g, ' ').replace(/<\/text:p>\s*<text:p\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '')).trim();
      for (let i = 0; i < n; i++) cells.push(text);
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    for (let i = 0; i < repeat; i++) rows.push([...cells]);
  }
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  return rows;
}
