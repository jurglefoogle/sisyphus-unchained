import { mount } from 'svelte';
// The page's CSP forbids eval; Pixi's no-eval shader and uniform paths stand in.
import 'pixi.js/unsafe-eval';
import App from './ui/App.svelte';
// Fonts ship with the game so it starts offline (spec §06). Both are SIL OFL 1.1.
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/600.css';
import './ui/global.css';
import { Game } from './app/game';
import { setNumberLocale } from './core/format';

async function start() {
  setNumberLocale(navigator.language);
  const game = new Game();
  await game.init();
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  mount(App, { target: document.getElementById('app')!, props: { game } });
}

void start();
