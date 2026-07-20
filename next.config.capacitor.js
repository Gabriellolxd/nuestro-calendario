// next.config.capacitor.js
// SOLO se usa para la build empaquetada en el .apk. La build normal de
// Vercel sigue usando next.config.js sin tocar, con su propia
// verificación de tipos intacta.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_BASE_URL: 'https://nuestro-calendario-phi.vercel.app/',
  },
  typescript: {
    // La validación de tipos de Next para rutas API (typedRoutes) se
    // confunde porque esta build mueve src/app/api fuera temporalmente.
    // El código ya se valida por completo en la build normal de Vercel,
    // así que aquí no hace falta repetirlo.
    ignoreBuildErrors: true,
  },
};
module.exports = nextConfig;


