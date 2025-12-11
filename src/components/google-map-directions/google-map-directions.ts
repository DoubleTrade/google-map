import GoogleMapDirections from './google-map-directions.component';

if (window && !window.customElements.get('google-map-directions')) {
  window.customElements.define('google-map-directions', GoogleMapDirections);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map-directions': GoogleMapDirections;
  }
}

export * from './google-map-directions.component';
export { default as GoogleMapDirections } from './google-map-directions.component';
