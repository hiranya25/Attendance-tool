import { downloadCsv } from './export';

/** Downloads the server's Excel file when there is a server; in the demo, builds a CSV in the browser instead. */
export function download(url: string | null, csvName: string, csvRows: () => (string | number)[][]) {
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    downloadCsv(csvName, csvRows());
  }
}
