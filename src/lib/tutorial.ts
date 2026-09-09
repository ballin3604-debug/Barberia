/* Tutorial del cliente: se muestra una sola vez (primera visita). */

export const CLIENT_TUTORIAL_KEY = 'barber_client_tutorial_v1';

export const hasSeenClientTutorial = (): boolean => {
  try {
    return localStorage.getItem(CLIENT_TUTORIAL_KEY) === '1';
  } catch {
    return true;
  }
};

export const markClientTutorialSeen = (): void => {
  try {
    localStorage.setItem(CLIENT_TUTORIAL_KEY, '1');
  } catch {
    // almacenamiento no disponible
  }
};
