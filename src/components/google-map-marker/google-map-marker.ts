import GoogleMapMarker from './google-map-marker.component';

if (window && !window.customElements.get('google-map-marker')) {
  window.customElements.define('google-map-marker', GoogleMapMarker);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map-marker': GoogleMapMarker;
  }
}

export * from './google-map-marker.component';
export { default as GoogleMapMarker } from './google-map-marker.component';
