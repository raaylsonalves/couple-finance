export const formatBRL = (v: number): string =>
  'R$ ' + v.toFixed(2).replace('.', ',')
