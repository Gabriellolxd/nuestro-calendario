// src/lib/colors.ts

export const PALETA_COLORES = [
  { nombre: 'Rosa', hex: '#ec4899' },
  { nombre: 'Morado', hex: '#a855f7' },
  { nombre: 'Azul', hex: '#3b82f6' },
  { nombre: 'Verde', hex: '#22c55e' },
  { nombre: 'Amarillo', hex: '#eab308' },
  { nombre: 'Naranja', hex: '#f97316' },
  { nombre: 'Rojo', hex: '#ef4444' },
  { nombre: 'Gris', hex: '#6b7280' },
  { nombre: 'Negro', hex: '#000000' },
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