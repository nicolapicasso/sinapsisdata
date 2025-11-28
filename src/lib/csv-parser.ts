import Papa from 'papaparse'

export interface ParsedCSV {
  data: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  errors: string[]
}

export function parseCSV(content: string): ParsedCSV {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  })

  return {
    data: result.data as Record<string, unknown>[],
    columns: result.meta.fields || [],
    rowCount: result.data.length,
    errors: result.errors.map((e) => e.message),
  }
}

export async function parseCSVFile(file: File): Promise<ParsedCSV> {
  const content = await file.text()
  return parseCSV(content)
}
