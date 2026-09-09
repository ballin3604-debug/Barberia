import React, { useState } from 'react';
import { Modal } from '../Modal';
import { markClientTutorialSeen } from '../../lib/tutorial';
import { CalendarDays, CheckCircle2, MapPin, User } from 'lucide-react';

const STEPS = [
  {
    icon: <User className="w-6 h-6" />,
    title: '1. Date a conocer',
    text: 'Escribí tu nombre y tu WhatsApp una sola vez. La app te recuerda y no lo pide más.',
  },
  {
    icon: <CalendarDays className="w-6 h-6" />,
    title: '2. Elegí día y horario',
    text: 'Los días que ves están abiertos. Tocá Reservar en el horario verde que prefieras.',
  },
  {
    icon: <CheckCircle2 className="w-6 h-6" />,
    title: '3. Confirmá tu turno',
    text: 'Podés mandar foto del corte que querés y reservar como anónimo si no querés que se vea tu nombre.',
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    title: '4. Llegá y gestioná',
    text: 'Con el botón de GPS llegás a la barbería. Tocando tu turno lo podés cambiar o cancelar.',
  },
];

interface ClientTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

/* Tutorial corto para que el cliente aprenda a usar la app en 1 minuto. */
export const ClientTutorial: React.FC<ClientTutorialProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleClose = () => {
    markClientTutorialSeen();
    setStep(0);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="¿Cómo se usa?"
      maxWidth="max-w-sm"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
          {current.icon}
        </div>
        <h3 className="text-base font-bold text-gray-900 mt-4">{current.title}</h3>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed min-h-16">{current.text}</p>

        <div className="flex items-center justify-center gap-1.5 mt-4">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-emerald-500' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Atrás
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Saltar
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? handleClose() : setStep((s) => s + 1))}
            className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isLast ? '¡Entendido, empezar!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
