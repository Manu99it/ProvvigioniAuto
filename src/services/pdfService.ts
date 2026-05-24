import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseItalianCurrency } from '../utils/currency';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface CommissionItem {
  code: string;
  description: string;
  quantity: number;
  price: number;
  isItalian: boolean;
  total: number;
}

export interface DDTRecord {
  number: string;
  date: string;
  items: CommissionItem[];
  imponibileTotal: number;
  italianoTotal: number;
}

export async function parseCommissionPDF(
  file: File, 
  onProgress?: (progress: number) => void,
  italianKeywords: string[] = ['37.2.1', '37.2.2', '37.1.3', 'allevato in italia']
): Promise<DDTRecord[]> {
  // Check if PDF
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('INVALID_FILE_TYPE');
  }

  if (onProgress) onProgress(5);
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(10);
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Sort items by position to maintain logical reading order (y descending, then x ascending)
    const items = textContent.items as any[];
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) < 5) return a.transform[4] - b.transform[4];
      return yDiff;
    });

    // Build line-by-line text
    let pageText = '';
    let lastY = -1;
    for (const item of items) {
      const currentY = item.transform[5];
      if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
        pageText += '\n';
      } else if (lastY !== -1) {
        pageText += ' ';
      }
      pageText += item.str;
      lastY = currentY;
    }
    
    pageTexts.push(pageText);
    
    // Validation: check if it's a CE.DI.MARCHE document
    if (i === 1) {
      const pageNormalized = pageText.toUpperCase().replace(/[\s.]/g, '');
      if (!pageNormalized.includes('CEDIMARCHE')) {
        throw new Error('INVALID_DOCUMENT_FORMAT');
      }
    }
    
    if (onProgress) {
      onProgress(10 + Math.floor((i / numPages) * 70));
    }
  }

  // Combine all text
  const allText = pageTexts.join('\n');
  
  // Each document ends with "relativa contabilizzazione."
  const rawSegments = allText.split(/relativa\s+contabilizzazione\.?/gi);
  const ddtRecords: DDTRecord[] = [];

    // Patterns for searching within each segment
    const ddtNumRegex = /(\d+[\d.\-/]*\/00)/i;
    const dateRegex = /(?:Data)\s+(?:D\.?D\.?T\.?|Doc\.?)\s*[:.-]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i;
    const totalRegex = /Tot(?:ale)?\.?\s+Imponibile\s*[:.-]?\s*([\d.,]{1,})/i;
    
    for (let i = 0; i < rawSegments.length; i++) {
      const segment = rawSegments[i].trim();
      if (segment.length < 50) continue;
      
      // 1. Find DDT Number - Look specifically for the /00 format
      let ddtNumber = '';
      const numMatch = segment.match(ddtNumRegex);
      if (numMatch) {
        ddtNumber = numMatch[1].trim();
      }
  
      // 2. Find Date
      let ddtDate = '';
      const dateMatch = segment.match(dateRegex);
      if (dateMatch) {
        ddtDate = dateMatch[1].trim();
      } else {
        const anyDateMatch = /(\d{2}[\/.-]\d{2}[\/.-]\d{4})/.exec(segment);
        if (anyDateMatch) ddtDate = anyDateMatch[1];
      }
  
      if (ddtDate || ddtNumber) {
        // Identification uses /00, but display should omit it
        const actualNumber = (ddtNumber || `DOC-${i+1}`).replace(/\/00$/, '');
        const actualDate = ddtDate || new Date().toLocaleDateString('it-IT');
      
      const totalMatch = segment.match(totalRegex);
      const imponibileTotal = totalMatch ? Math.round(parseItalianCurrency(totalMatch[1]) * 100) / 100 : 0;
      
      const items: CommissionItem[] = [];
      const lines = segment.split('\n');
      let currentItem: CommissionItem | null = null;
      
      const lineItemRegex = /([A-Z0-9.\-/]{4,})\s+(.*?)\s+(KG|NR|PZ)\s+([\d.,]+)\s+(?:\d+(?:,\d+)?%?\s+)?([\d.,]+)/i;

      for (const line of lines) {
        const itemMatch = line.match(lineItemRegex);
        
        if (itemMatch) {
          const code = itemMatch[1].trim();
          const desc = itemMatch[2].trim();
          const qty = parseItalianCurrency(itemMatch[4]);
          const price = parseItalianCurrency(itemMatch[5]);
          const total = Math.round(qty * price * 100) / 100;
          
          if (total > 0.05) {
            currentItem = {
              code,
              description: desc,
              quantity: qty,
              price,
              isItalian: false,
              total
            };
            items.push(currentItem);
          }
        }
        
        // Check for keywords in the current line
        const lowerLine = line.toLowerCase();
        const isMatch = italianKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));
        
        if (isMatch) {
          if (currentItem) {
            currentItem.isItalian = true;
          }
        }
      }

      let finalImponibile = imponibileTotal;
      const calculatedSum = Math.round(items.reduce((acc, it) => acc + it.total, 0) * 100) / 100;
      
      if (finalImponibile === 0 || Math.abs(finalImponibile - calculatedSum) > 0.1) {
        // Prefer calculated sum if extracted total is missing or significantly different
        // (sometimes the PDF total text is mis-extracted or refers to something else)
        if (calculatedSum > 0) {
          finalImponibile = calculatedSum;
        }
      }

      if (finalImponibile === 0) {
          const currencyMatches = segment.match(/[\d]{1,9},\d{2}/g);
          if (currencyMatches && currencyMatches.length > 0) {
              finalImponibile = Math.round(parseItalianCurrency(currencyMatches[currencyMatches.length - 1]) * 100) / 100;
          }
      }

      const italianSum = Math.round(items.filter(it => it.isItalian).reduce((s, it) => s + it.total, 0) * 100) / 100;

      ddtRecords.push({
        number: actualNumber,
        date: actualDate,
        items,
        imponibileTotal: finalImponibile,
        italianoTotal: italianSum
      });
    }
    
    if (onProgress) {
        onProgress(80 + Math.floor(((i + 1) / rawSegments.length) * 20));
    }
  }

  if (onProgress) onProgress(100);
  return ddtRecords;
}
