import { LitElement, html, css, PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

export default class GoogleMapDirections extends ScopedElementsMixin(LitElement) {
  @property({ type: String, attribute: 'api-key' }) apiKey = '';
  @property({ type: String, attribute: 'maps-url' }) mapsUrl = '';
  @property({ type: Object, attribute: false }) map: google.maps.Map | null = null;
  @property({ type: String, attribute: 'start-address' }) startAddress: string | null = null;
  @property({ type: String, attribute: 'end-address' }) endAddress: string | null = null;
  @property({ type: String, attribute: 'travel-mode' }) travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING';
  @property({ type: Array }) waypoints: google.maps.DirectionsWaypoint[] = [];
  @property({ type: String }) language: string | null = null;
  @property({ type: Object, attribute: 'renderer-options' }) rendererOptions: google.maps.DirectionsRendererOptions = {};
  @property({ type: Object, attribute: false }) response: google.maps.DirectionsResult | null = null;

  private directionsService: google.maps.DirectionsService | null = null;
  private directionsRenderer: google.maps.DirectionsRenderer | null = null;

  static styles = css`
    :host {
      display: none;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadGoogleMapsApi();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('response')) {
      this._responseChanged();
    }
    if (changedProps.has('map')) {
      this._mapChanged();
    }
    if (changedProps.has('startAddress') || changedProps.has('endAddress') || changedProps.has('travelMode') || changedProps.has('waypoints')) {
      this._route();
    }
  }

  private async _loadGoogleMapsApi(): Promise<void> {
    if (typeof google !== 'undefined' && google.maps) {
      this._route();
      return;
    }

    const callbackName = `__googleMapsDirectionsCallback_${Date.now()}`;
    const script = document.createElement('script');
    let url = this.mapsUrl || 'https://maps.googleapis.com/maps/api/js';
    const params: string[] = [];

    if (this.apiKey) params.push(`key=${this.apiKey}`);
    if (this.language) params.push(`language=${this.language}`);
    params.push(`callback=${callbackName}`);

    url += '?' + params.join('&');

    await new Promise<void>((resolve) => {
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        delete (window as unknown as Record<string, () => void>)[callbackName];
        resolve();
      };
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    });

    this._route();
  }

  private _responseChanged(): void {
    if (this.directionsRenderer && this.response) {
      this.directionsRenderer.setDirections(this.response);
    }
  }

  private _mapChanged(): void {
    if (this.map && this.map instanceof google.maps.Map) {
      if (!this.directionsRenderer) {
        this.directionsRenderer = new google.maps.DirectionsRenderer(this.rendererOptions);
      }
      this.directionsRenderer.setMap(this.map);
      this._responseChanged();
    } else {
      if (this.directionsRenderer) {
        this.directionsRenderer.setMap(null);
        this.directionsRenderer = null;
      }
    }
  }

  private _route(): void {
    if (typeof google === 'undefined' || typeof google.maps === 'undefined' ||
        !this.startAddress || !this.endAddress) {
      return;
    }

    if (!this.directionsService) {
      this.directionsService = new google.maps.DirectionsService();
    }

    const request: google.maps.DirectionsRequest = {
      origin: this.startAddress,
      destination: this.endAddress,
      travelMode: google.maps.TravelMode[this.travelMode],
      waypoints: this.waypoints
    };

    this.directionsService.route(request, (response, status) => {
      if (status === google.maps.DirectionsStatus.OK && response) {
        this.response = response;
        this.dispatchEvent(new CustomEvent('google-map-response', { detail: { response } }));
      }
    });
  }

  protected render() {
    return html``;
  }
}
