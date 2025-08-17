declare module 'arabic-persian-reshaper' {
  const reshape: (input: string) => string
  export { reshape }
  export default reshape
}

declare module 'bidi-js' {
  const bidi: (input: string) => string
  export { bidi }
  export default bidi
}

declare module 'bidi-js/dist/bidi.mjs' {
  const bidiFactory: () => {
    getEmbeddingLevels: (s: string, base?: 'ltr' | 'rtl' | 'auto') => any
    getReorderedString: (s: string, levels: any, start?: number, end?: number) => string
  }
  export default bidiFactory
}
