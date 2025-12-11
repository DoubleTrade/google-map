import GoogleMapPoly from './google-map-poly.component';

if (window && !window.customElements.get('google-map-poly')) {
  window.customElements.define('google-map-poly', GoogleMapPoly);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map-poly': GoogleMapPoly;
  }
}

export * from './google-map-poly.component';
export { default as GoogleMapPoly } from './google-map-poly.component';
