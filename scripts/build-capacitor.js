// scripts/build-capacitor.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const apiBackup = path.join(__dirname, '..', 'src', 'app', '_api_backup');
const configPath = path.join(__dirname, '..', 'next.config.js');
const configBackup = path.join(__dirname, '..', 'next.config.web.backup.js');
const capacitorConfig = path.join(__dirname, '..', 'next.config.capacitor.js');
const nextCacheDir = path.join(__dirname, '..', '.next');

function mover(origen, destino) {
  if (fs.existsSync(origen)) fs.renameSync(origen, destino);
}

console.log('→ Preparando build estática para Capacitor...');

// Salvaguarda: si next.config.js ya tiene 'output: export' antes de
// empezar, significa que un swap anterior quedó a medias (terminal
// cerrada, Ctrl+C, etc.) — hay que avisar en vez de seguir encima de
// un estado roto.
const contenidoActual = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
if (contenidoActual.includes("output: 'export'") || contenidoActual.includes('output: "export"')) {
  console.error('⚠️  next.config.js ya está en modo Capacitor — un build anterior quedó a medias.');
  console.error('   Revisa si existe next.config.web.backup.js: si está ahí, contiene tu config real.');
  console.error('   Restáuralo a mano antes de continuar (o pide ayuda).');
  process.exit(1);
}

// Limpia la caché de .next: si quedó algo generado de un build anterior
// (normal, con la carpeta api/ presente), Next intenta validar tipos
// contra rutas que ya no van a existir en esta build — hay que partir
// de cero cada vez.
if (fs.existsSync(nextCacheDir)) {
  fs.rmSync(nextCacheDir, { recursive: true, force: true });
}

mover(apiDir, apiBackup);
mover(configPath, configBackup);
fs.copyFileSync(capacitorConfig, configPath);

console.log('   (si cierras esta terminal ahora, next.config.js quedará en modo Capacitor — no lo hagas)');

try {
  execSync('npx next build', { stdio: 'inherit' });
  console.log('✓ Build estática lista en /out');
} finally {
  console.log('→ Restaurando configuración normal (para npm run dev / Vercel)...');
  fs.rmSync(configPath, { force: true });
  mover(configBackup, configPath);
  mover(apiBackup, apiDir);

  // También limpia la caché que quedó de ESTA build (sin api/), para que
  // el próximo `npm run dev` no arranque con referencias viejas.
  if (fs.existsSync(nextCacheDir)) {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }
}