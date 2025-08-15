import type jsPDFType from 'jspdf'

export type ArabicPdfSetup = {
  fontFamily: string
  shape: (s: string) => string
  usedCustomFont: boolean
}

export async function ensureArabicPdf(doc: jsPDFType): Promise<ArabicPdfSetup> {
  let fontFamily = 'helvetica'
  let usedCustomFont = false
  ;(doc as any).setLanguage?.('ar-EG')
  // Disable global RTL mode to avoid mirrored page effects; we handle RTL per run
  ;(doc as any).setR2L?.(false)

  let shape: (s: string) => string = (s) => String(s)
  try {
    const reshaperMod: any = await import('arabic-persian-reshaper')
    const reshapeCandidates = [
      reshaperMod?.reshape,
      reshaperMod?.default?.reshape,
      reshaperMod?.default,
    ].filter((f: any) => typeof f === 'function')
    const reshapeFn: undefined | ((x: string) => string) = reshapeCandidates[0]
    const hasArabicLetters = (str: string) => /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str)
    if (reshapeFn) {
      shape = (s: string) => {
        const raw = String(s)
        if (!hasArabicLetters(raw)) return raw
        try {
          const reshaped = reshapeFn(raw)
          // Wrap with RTL embedding marks so PDF viewers render the run RTL without double reordering
          return '\u202B' + reshaped + '\u202C'
        } catch {
          return raw
        }
      }
    }
  } catch {}

  const fontCandidates: { url: string; vfsName: string; family: string }[] = [
    // Prefer local Noto first (we download it into public/fonts)
    { url: '/fonts/NotoNaskhArabic-Regular.ttf', vfsName: 'NotoNaskhArabic-Regular.ttf', family: 'NotoNaskhArabic' },
    // Then local Amiri if available
    { url: '/fonts/Amiri-Regular.ttf', vfsName: 'Amiri-Regular.ttf', family: 'Amiri' },
    // Then CDNs
    { url: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf', vfsName: 'NotoNaskhArabic-Regular.ttf', family: 'NotoNaskhArabic' },
    { url: 'https://cdn.jsdelivr.net/gh/alif-type/amiri@0.121/font/ttf/Amiri-Regular.ttf', vfsName: 'Amiri-Regular.ttf', family: 'Amiri' },
  ]

  const toBase64 = (buf: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.subarray(i, i + chunk)) as any)
    }
    return btoa(binary)
  }

  for (const font of fontCandidates) {
    try {
      const res = await fetch(font.url, { cache: 'force-cache' as RequestCache })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      const base64 = toBase64(buf)
      doc.addFileToVFS(font.vfsName, base64)
      doc.addFont(font.vfsName, font.family, 'normal')
      doc.setFont(font.family, 'normal')
      fontFamily = font.family
      usedCustomFont = true
      break
    } catch {}
  }

  return { fontFamily, shape, usedCustomFont }
}

export function csvUtf8Blob(lines: string[]): Blob {
  return new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
}

// Direction helpers for mixed content
export const LRI = '\u2066' // Left-to-Right Isolate
export const RLI = '\u2067' // Right-to-Left Isolate
export const PDI = '\u2069' // Pop Directional Isolate

export function containsDirIsolate(s: string): boolean {
  return /[\u2066\u2067\u2068\u2069]/.test(s)
}

export function fmtNumberLTR(n: number, fractionDigits = 2): string {
  const num = Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${LRI}${num}${PDI}`
}

export function fmtPercentLTR(n: number, fractionDigits = 1): string {
  const num = Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${LRI}${num}%${PDI}`
}

export function fmtCurrencyMixEGP(n: number, fractionDigits = 2): string {
  const num = fmtNumberLTR(n, fractionDigits)
  // Arabic currency label isolated RTL so it stays to the right place
  const egp = `${RLI}ج.م${PDI}`
  return `${num} ${egp}`
}
