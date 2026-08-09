// src/lib/notificationTones.ts
// Cada vez que agregues un archivo a android/app/src/main/res/raw/ Y a
// public/sonidos/ (mismo nombre en ambos lados), agrégalo aquí también.
// `id`: se guarda en la base de datos, sin extensión.
// `archivo`: nombre real del archivo con extensión — AJUSTA si tus
// archivos no son .mp3 (puede ser .wav u .ogg también).
export const TONOS_NOTIFICACION = [
  { id: 'notificacion_evento', nombre: 'Predeterminado', archivo: 'notificacion_evento.wav' },
  { id: 'tono_alegre', nombre: 'Alegre', archivo: 'tono_alegre.mp3' },
  { id: 'tono_bambu', nombre: 'Bambú', archivo: 'tono_bambu.mp3' },
  { id: 'tono_espacial', nombre: 'Espacial', archivo: 'tono_espacial.mp3' },
  { id: 'tono_guitarra', nombre: 'Guitarra', archivo: 'tono_guitarra.mp3' },
  { id: 'tono_navidad', nombre: 'Navidad', archivo: 'tono_navidad.mp3' },
  { id: 'tono_pulsar', nombre: 'Pulsar', archivo: 'tono_pulsar.mp3' },
  { id: 'tono_suave', nombre: 'Suave', archivo: 'tono_suave.mp3' },
];