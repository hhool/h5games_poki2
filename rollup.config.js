import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'js/app.js',
  output: {
    file: 'dist/js/app.js',
    format: 'iife',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    terser(),
  ],
};
