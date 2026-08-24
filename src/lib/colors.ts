// src/lib/colors.ts

export const PALETA_COLORES = [
  { nombre: 'Rosa', hex: '#d39cb8' },
  { nombre: 'Morado', hex: '#b3a2c3' },
  { nombre: 'Azul', hex: '#9cb1d3' },
  { nombre: 'Verde', hex: '#92cea8' },
  { nombre: 'Amarillo', hex: '#d8c897' },
  { nombre: 'Naranja', hex: '#bf8a63' },
  { nombre: 'Rojo', hex: '#cc8a8a' },
];

function hexToRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const bigint = parseInt(limpio, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Promedia los colores de eventos en colisión y les da transparencia,
// tal como pide el requisito 4 para simular la superposición.
export function mezclarColores(hexColors: string[], alpha = 0.85): string {
  const rgbs = hexColors.map(hexToRgb);
  const suma = rgbs.reduce(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
    [0, 0, 0]
  );
  const [r, g, b] = suma.map((v) => Math.round(v / rgbs.length));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}