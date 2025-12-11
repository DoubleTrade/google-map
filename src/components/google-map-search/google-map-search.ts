import GoogleMapSearch from './google-map-search.component';

if (window && !window.customElements.get('google-map-search')) {
  window.customElements.define('google-map-search', GoogleMapSearch);
}

declare global {
  interface HTMLElementTagNameMap {
    'google-map-search': GoogleMapSearch;
  }
}

export * from './google-map-search.component';
export { default as GoogleMapSearch } from './google-map-search.component';
