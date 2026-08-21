import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Chaves de cliente do Firebase. São públicas por natureza — vão no bundle de qualquer
 * jeito, e quem protege os dados são as Security Rules (`firestore.rules`), não isto.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyA7_YWtkhW0zKtz2zpuo8JowYhpQwjUq0w',
  authDomain: 'rally2d.firebaseapp.com',
  projectId: 'rally2d',
  storageBucket: 'rally2d.firebasestorage.app',
  messagingSenderId: '1081546852562',
  appId: '1:1081546852562:web:9a641397c701b46e71050b',
  measurementId: 'G-ZCCDC9F558',
};

let db: Firestore | null = null;

/** Só é inicializado quando o Modo Online de fato precisa. Offline nunca toca nisto. */
export function firestore(): Firestore {
  if (db === null) db = getFirestore(initializeApp(firebaseConfig));
  return db;
}
