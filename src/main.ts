import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/global.css';
import { Game } from './app/game';

async function start() {
  const game = new Game();
  await game.init();
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  mount(App, { target: document.getElementById('app')!, props: { game } });
}

void start();
