import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from './Editor';
import { Home } from './Home';
import { useRoute } from './lib';
import './styles.css';

function App() {
  const route = useRoute();
  const match = /^\/demo\/([\w-]+)/.exec(route);
  return match ? <Editor key={match[1]} id={match[1]!} /> : <Home />;
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
