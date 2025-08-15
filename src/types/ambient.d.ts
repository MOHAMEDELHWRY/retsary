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
