import GoogleMapPoint from './google-map-point.component';

if (window && !window.customElements.get('google-map-point')) {
  window.customElements.define('google-map-point', GoogleMapPoint);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map-point': GoogleMapPoint;
  }
}

export * from './google-map-point.component';
export { default as GoogleMapPoint } from './google-map-point.component';
