import React, { useEffect, useState } from 'react';

/**
 * Pantalla de bienvenida (splash): muestra el logo animado mientras carga la app
 * y se desvanece suavemente. No bloquea el uso real (dura ~2,7 s).
 */
export const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setFading(true), 2100);
    const hide = window.setTimeout(() => setVisible(false), 2750);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#111827] flex flex-col items-center justify-center gap-5 px-6 transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        src="/logo-splash.mp4"
        className="w-60 h-60 object-contain drop-shadow-lg"
        aria-label="Logo animado de la barbería"
      />
      <h1 className="text-white font-bold text-lg sm:text-xl tracking-[0.2em] uppercase text-center">
        The Best Barbershop
      </h1>
      <p className="text-gray-400 text-xs font-medium">Reservá tu turno en 1 minuto</p>
    </div>
  );
};
