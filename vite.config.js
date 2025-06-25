// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? '/Echofox-TextEffect/'
    : '/',
});