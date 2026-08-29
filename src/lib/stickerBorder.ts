// src/lib/stickerBorder.ts
// Procesa una imagen (idealmente PNG con transparencia) y le agrega un
// contorno blanco tipo "sticker" (efecto iMessage/Telegram), dilatando
// la silueta de píxeles no-transparentes hacia afuera.

const GROSOR_BORDE_PX = 10;
// Límite de resolución para stickers subidos por el usuario — evita
// guardar fotos gigantes en Supabase Storage sin necesidad; 480px es de
// sobra para cómo se ven en la app. Solo afecta a subidas NUEVAS.
const DIMENSION_MAXIMA_PX = 480;

export async function procesarStickerConBorde(archivo: File): Promise<Blob> {
  const imagen = await cargarImagen(archivo);

  const factorEscala = Math.min(1, DIMENSION_MAXIMA_PX / Math.max(imagen.width, imagen.height));
  const anchoBase = Math.round(imagen.width * factorEscala);
  const altoBase = Math.round(imagen.height * factorEscala);

  const margen = GROSOR_BORDE_PX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = anchoBase + margen * 2;
  canvas.height = altoBase + margen * 2;
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
    ctx.drawImage(imagen, cx + dx, cy + dy, anchoBase, altoBase);
  }
  ctx.restore();

  ctx.drawImage(imagen, cx, cy, anchoBase, altoBase);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen procesada.'));
    }, 'image/png');
  });
}

export async function tieneTransparencia(archivo: File): Promise<boolean> {
  const img = await cargarImagen(archivo);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}