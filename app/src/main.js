import './app.css';
import { mount } from 'svelte';
import { initTheme } from './lib/theme.js';
import App from './App.svelte';

initTheme();

const app = mount(App, { target: document.getElementById('app') });

export default app;
