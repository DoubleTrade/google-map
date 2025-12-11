import { LitElement, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

export default class GoogleMapSearch extends ScopedElementsMixin(LitElement) {
  @property({ type: Object, attribute: false }) map: google.maps.Map | null = null;
  @property({ type: String }) query: string | null = null;
  @property({ type: Number }) latitude: number | null = null;
  @property({ type: Number }) longitude: number | null = null;
  @property({ type: Number }) radius: number | null = null;
  @property({ type: Boolean, attribute: 'global-search' }) globalSearch = false;
  @property({ type: String }) types: string | null = null;
  @property({ type: Array }) results: google.maps.places.PlaceResult[] = [];

  @state() private _location: google.maps.LatLngLiteral | null = null;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('latitude') || changedProps.has('longitude')) {
      this._updateLocation();
    }
    if (changedProps.has('query') || changedProps.has('map') || changedProps.has('_location') ||
        changedProps.has('radius') || changedProps.has('types') || changedProps.has('globalSearch')) {
      this.search();
    }
  }

  search(): void {
    if (this.query && this.map) {
      const places = new google.maps.places.PlacesService(this.map);

      let types: string[] | undefined;
      if (this.types && typeof this.types === 'string') {
        types = this.types.split(' ');
      }

      let radius: number | undefined;
      let location: google.maps.LatLngLiteral | google.maps.LatLng | undefined;
      let bounds: google.maps.LatLngBounds | undefined;

      if (this.radius) {
        radius = this.radius;
        location = this._location ?? this.map.getCenter()?.toJSON();
      } else if (!this.globalSearch) {
        bounds = this.map.getBounds() ?? undefined;
      }

      places.textSearch({
        query: this.query,
        type: types?.[0],
        bounds: bounds,
        radius: radius,
        location: location
      }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          this._gotResults(results);
        }
      });
    }
  }

  getDetails(placeId: string): Promise<google.maps.places.PlaceResult> {
    const places = new google.maps.places.PlacesService(this.map!);

    return new Promise((resolve, reject) => {
      places.getDetails({ placeId }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(place);
          this.dispatchEvent(new CustomEvent('google-map-search-place-detail', { detail: place }));
        } else {
          reject(status);
        }
      });
    });
  }

  private _gotResults(results: google.maps.places.PlaceResult[]): void {
    this.results = results.map((result) => {
      return {
        ...result,
        latitude: result.geometry?.location?.lat(),
        longitude: result.geometry?.location?.lng()
      };
    }) as unknown as google.maps.places.PlaceResult[];
    this.dispatchEvent(new CustomEvent('google-map-search-results', { detail: this.results }));
  }

  private _updateLocation(): void {
    if (!this.map) {
      return;
    } else if (typeof this.latitude !== 'number' || isNaN(this.latitude)) {
      throw new TypeError('latitude must be a number');
    } else if (typeof this.longitude !== 'number' || isNaN(this.longitude)) {
      throw new TypeError('longitude must be a number');
    }

    this._location = { lat: this.latitude, lng: this.longitude };
  }
}
