import { createApp } from 'vue';
// First: handles a Google sign-in redirect before the router reads the URL.
import './lib/auth.js';
import { router } from './router/index.js';
import './lib/theme.js';
import App from './App.vue';
import './assets/tokens.css';
import './assets/scrollbars.css';

createApp(App).use(router).mount('#app');
