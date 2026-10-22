import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { createRoot } from 'react-dom/client';
import { App } from './editor/App';
import { loadSaved, useStore } from './editor/store';
import { blankProject } from './engine/model';
import { loadFonts } from './engine/renderer';
import { SCENES } from './library/scenes';
import './editor/styles.css';

async function boot() {
  const saved = loadSaved();
  // Starter scenes measure text, so fonts come first.
  await loadFonts(saved ?? blankProject());
  useStore.setState({ project: saved ?? SCENES[0].make(), mode: saved ? 'design' : 'animate', playing: !saved });
  createRoot(document.getElementById('root')!).render(<App />);
}

void boot();

if (import.meta.env.DEV) Object.assign(window, { store: useStore, scenes: SCENES });
