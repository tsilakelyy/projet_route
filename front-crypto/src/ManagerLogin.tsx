import { type FormEvent, type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiUrl } from './config/api';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import AutoSyncRealtimeDB from './components/AutoSyncRealtimeDB';

const ManagerLogin = () => {

  const [email, setEmail]                     = useState('adminfirebase@gmail.com');
  const [password, setPassword]               = useState('admin1234');
  const [isLoading, setIsLoading]             = useState(false);
  const [authError, setAuthError]             = useState('');
  const navigate                              = useNavigate();
  const rootRef                               = useRef<HTMLDivElement>(null);

  // Animation d'entrée + suivi du curseur
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>('.fx-item'));
    const animationFrame = requestAnimationFrame(() => {
      revealNodes.forEach((node, index) => {
        node.style.setProperty('--fx-delay', `${index * 55}ms`);
        node.classList.add('fx-ready');
      });
    });

    const onMouseMove = (event: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      root.style.setProperty('--cursor-x', `${x.toFixed(2)}%`);
      root.style.setProperty('--cursor-y', `${y.toFixed(2)}%`);
    };

    root.addEventListener('mousemove', onMouseMove);
    return () => {
      cancelAnimationFrame(animationFrame);
      root.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const addButtonRipple = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const button  = event.currentTarget;
    const rect    = button.getBoundingClientRect();
    const ripple  = document.createElement('span');
    const size    = Math.max(button.clientWidth, button.clientHeight);

    ripple.className    = 'route-login__btn-ripple';
    ripple.style.width  = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left   = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top    = `${event.clientY - rect.top  - size / 2}px`;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  };

  // ── Connexion Google ──────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const user     = result.user;
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify({
          id:            user.uid,
          email:         user.email,
          nomUtilisateur: user.displayName || user.email?.split('@')[0],
          role:          'MANAGER',
        }));
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Erreur connexion Google:', error);
      setAuthError(`Erreur connexion Google: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Connexion Firebase email/password ─────────────────────────
  const handleFirebaseLogin = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user   = result.user;
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify({
          id:            user.uid,
          email:         user.email,
          nomUtilisateur: user.displayName || user.email?.split('@')[0],
          role:          'MANAGER',
        }));
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Erreur connexion Firebase:', error);
      // Création automatique si le compte n'existe pas encore
      if (error.code === 'auth/user-not-found') {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const user   = result.user;
          if (user) {
            const token = await user.getIdToken();
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify({
              id:            user.uid,
              email:         user.email,
              nomUtilisateur: user.displayName || user.email?.split('@')[0],
              role:          'MANAGER',
            }));
            navigate('/dashboard');
          }
        } catch (createError: any) {
          setAuthError(`Erreur création compte: ${createError.message}`);
        }
      } else {
        setAuthError(`Erreur connexion: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Connexion backend local (JWT) ─────────────────────────────
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAuthError('');
    try {
      const response     = await fetch(apiUrl('/api/auth/login'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const responseText = await response.text();
      let data: any      = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = responseText;
      }

      if (response.ok && data?.token && data?.user) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
        return;
      }

      const message = typeof data === 'string'
        ? data
        : data?.message || 'Connexion impossible';
      setAuthError(message);
    } catch (error) {
      setAuthError(`Erreur réseau: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync automatique Realtime DB si l'utilisateur est déjà connecté (session persistée)
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <div className="route-login" ref={rootRef}>

      {/* Synchronisation automatique Realtime Database */}
      {user && (
        <AutoSyncRealtimeDB
          userId={user.id}
          userEmail={user.email}
          userName={user.nomUtilisateur}
        />
      )}

      <div className="route-login__texture" aria-hidden="true" />

      <aside className="route-login__sidebar fx-item float-element">
        <div className="route-login__brand fx-item">
          <div className="route-login__brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="route-login__kicker">Route supervision platform</p>
          <h1>RouteWatch</h1>
        </div>

        <p className="route-login__sidebar-text fx-item">
          Connectez-vous pour piloter les signalements routiers, suivre les interventions et garder
          la ville sous contrôle en temps réel.
        </p>

        <ul className="route-login__signal-list">
          <li className="fx-item">
            <span className="route-login__dot route-login__dot--violet" />
            Cartographie des incidents priorisés
          </li>
          <li className="fx-item">
            <span className="route-login__dot route-login__dot--indigo" />
            Suivi des entreprises et avancement travaux
          </li>
          <li className="fx-item">
            <span className="route-login__dot route-login__dot--lilac" />
            Contrôle des accès gestionnaire
          </li>
        </ul>

        <div className="route-login__status fx-item">
          <div>
            <strong>Système actif</strong>
            <span>Flux synchronisé avec les services terrain</span>
          </div>
          <span className="route-login__pulse" aria-hidden="true" />
        </div>
      </aside>

      <main className="route-login__main">
        <section className="route-login__panel fx-item glass-card hover-lift">
          <header className="route-login__header fx-item">
            <p className="route-login__header-tag">Accès gestionnaire</p>
            <h2>Connexion sécurisée</h2>
            <p>Entrez vos identifiants pour accéder au tableau de pilotage.</p>
            <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              Compte Firebase par défaut : adminfirebase@gmail.com / admin1234
            </p>
          </header>

          <form className="route-login__form fx-item" onSubmit={handleSubmit}>
            <label className="route-login__field fx-item" htmlFor="email">
              <span>Email professionnel</span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setAuthError(''); }}
                placeholder="adminfirebase@gmail.com"
                required
              />
            </label>

            <label className="route-login__field fx-item" htmlFor="password">
              <span>Mot de passe</span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                placeholder="........"
                required
              />
            </label>

            <button
              type="submit"
              className="route-login__submit fx-item"
              onMouseDown={addButtonRipple}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Connexion en cours...' : 'Entrer dans RouteWatch'}</span>
            </button>

            {authError && (
              <p className="route-login__error fx-item">{authError}</p>
            )}
          </form>

          <footer className="route-login__footer fx-item">
            <Link to="/visiteur">Voir la carte publique</Link>
          </footer>
        </section>
      </main>
    </div>
  );
};

export default ManagerLogin;
