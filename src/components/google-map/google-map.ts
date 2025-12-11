import GoogleMap from './google-map.component';

if (window && !window.customElements.get('google-map')) {
  window.customElements.define('google-map', GoogleMap);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map': GoogleMap;
  }
}

export * from './google-map.component';
export { default as GoogleMap } from './google-map.component';
