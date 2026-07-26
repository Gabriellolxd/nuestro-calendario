// src/lib/stickerBorder.ts
const GROSOR_BORDE_PX = 10;

// Revisa si la imagen tiene al menos un píxel transparente — si no lo
// tiene (típico de JPG, que no soporta canal alfa), el "borde blanco"
// no tendría una silueta real que seguir y saldría como un cuadrado
// blanco completo, no como un contorno ajustado a la forma.
export async function tieneTransparencia(archivo: File): Promise<boolean> {
  const img = await cargarImagen(archivo);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return true; // si algo falla, no bloqueamos al usuario

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true; // encontró al menos un píxel con algo de transparencia
  }
  return false;
}

export async function procesarStickerConBorde(archivo: File): Promise<Blob> {
  const imagen = await cargarImagen(archivo);

  const margen = GROSOR_BORDE_PX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = imagen.width + margen * 2;
  canvas.height = imagen.height + margen * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');

  const cx = margen;
  const cy = margen;

  const pasos = 24;
  ctx.save();
  ctx.filter = 'brightness(0) invert(1)';
  for (let i = 0; i < pasos; i++) {
    const angulo = (i / pasos) * Math.PI * 2;
    const dx = Math.cos(angulo) * GROSOR_BORDE_PX;
    const dy = Math.sin(angulo) * GROSOR_BORDE_PX;
    ctx.drawImage(imagen, cx + dx, cy + dy);
  }
  ctx.restore();

  ctx.drawImage(imagen, cx, cy);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen procesada.'));
    }, 'image/png');
  });
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

// Convierte un blob a base64 (data URL) para cachearlo en IndexedDB —
// Dexie no puede indexar Blobs grandes tan bien como strings, y un
// data URL se usa directo como <img src> sin pasos extra.
export function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}