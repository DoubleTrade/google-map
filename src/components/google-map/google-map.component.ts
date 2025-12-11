import { LitElement, html, css, PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import GoogleMapMarker from '../google-map-marker/google-map-marker.component';

export default class GoogleMap extends ScopedElementsMixin(LitElement) {
  @property({ type: String, attribute: 'api-key' }) apiKey = '';
  @property({ type: String, attribute: 'maps-url' }) mapsUrl = '';
  @property({ type: String, attribute: 'client-id' }) clientId = '';
  @property({ type: Number, reflect: true }) latitude = 37.77493;
  @property({ type: Number, reflect: true }) longitude = -122.41942;
  @property({ type: Object, attribute: false }) map: google.maps.Map | null = null;
  @property({ type: String }) kml: string | null = null;
  @property({ type: Number }) zoom = 10;
  @property({ type: Boolean, attribute: 'no-auto-tilt' }) noAutoTilt = false;
  @property({ type: String, attribute: 'map-type' }) mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain' = 'roadmap';
  @property({ type: String }) version = '3.exp';
  @property({ type: Boolean, attribute: 'disable-default-ui' }) disableDefaultUi = false;
  @property({ type: Boolean, attribute: 'disable-map-type-control' }) disableMapTypeControl = false;
  @property({ type: Boolean, attribute: 'disable-street-view-control' }) disableStreetViewControl = false;
  @property({ type: Boolean, attribute: 'fit-to-markers' }) fitToMarkers = false;
  @property({ type: Boolean, attribute: 'disable-zoom' }) disableZoom = false;
  @property({ type: Object }) styles: google.maps.MapTypeStyle[] = [];
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom?: number;
  @property({ type: Number, attribute: 'min-zoom' }) minZoom?: number;
  @property({ type: Boolean, attribute: 'signed-in' }) signedIn = false;
  @property({ type: String }) language = '';
  @property({ type: Boolean, attribute: 'click-events' }) clickEvents = false;
  @property({ type: Boolean, attribute: 'drag-events' }) dragEvents = false;
  @property({ type: Boolean, attribute: 'mouse-events' }) mouseEvents = false;
  @property({ type: Object, attribute: 'additional-map-options' }) additionalMapOptions: Record<string, unknown> = {};
  @property({ type: Boolean, attribute: 'single-info-window' }) singleInfoWindow = false;
  @property({ type: Boolean, reflect: true }) draggable = true;

  @state() private _markers: GoogleMapMarker[] = [];
  @state() private _objects: Element[] = [];
  @state() private _apiLoaded = false;

  @query('#map') private _mapDiv!: HTMLDivElement;

  private _listeners: Record<string, google.maps.MapsEventListener | null> = {};
  private _resizeObserver: ResizeObserver | null = null;
  private _markersSlot: HTMLSlotElement | null = null;
  private _objectsSlot: HTMLSlotElement | null = null;
  private _headObserver: MutationObserver | null = null;
  private _debounceTimer: number | null = null;

  protected static get scopedElements() {
    return {
      'google-map-marker': GoogleMapMarker,
    };
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      height: 100%;
    }

    #map {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadGoogleMapsApi();
    this._observeHeadMutation();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    if (this._headObserver) {
      this._headObserver.disconnect();
    }
  }

  protected firstUpdated(): void {
    this._markersSlot = this.shadowRoot?.querySelector('slot[name="markers"]') ?? null;
    this._objectsSlot = this.shadowRoot?.querySelector('slot#objects') ?? null;

    if (this._markersSlot) {
      this._markersSlot.addEventListener('slotchange', () => this._updateMarkers());
    }
    if (this._objectsSlot) {
      this._objectsSlot.addEventListener('slotchange', () => this._updateObjects());
    }

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this);

    this._initGMap();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('latitude') || changedProps.has('longitude')) {
      this._debounceUpdateCenter();
    }
    if (changedProps.has('zoom')) {
      this._zoomChanged();
    }
    if (changedProps.has('mapType')) {
      this._mapTypeChanged();
    }
    if (changedProps.has('disableDefaultUi')) {
      this._disableDefaultUiChanged();
    }
    if (changedProps.has('disableMapTypeControl')) {
      this._disableMapTypeControlChanged();
    }
    if (changedProps.has('disableStreetViewControl')) {
      this._disableStreetViewControlChanged();
    }
    if (changedProps.has('disableZoom')) {
      this._disableZoomChanged();
    }
    if (changedProps.has('maxZoom')) {
      this._maxZoomChanged();
    }
    if (changedProps.has('minZoom')) {
      this._minZoomChanged();
    }
    if (changedProps.has('clickEvents')) {
      this._clickEventsChanged();
    }
    if (changedProps.has('dragEvents')) {
      this._dragEventsChanged();
    }
    if (changedProps.has('mouseEvents')) {
      this._mouseEventsChanged();
    }
    if (changedProps.has('fitToMarkers')) {
      this._fitToMarkersChanged();
    }
    if (changedProps.has('kml')) {
      this._loadKml();
    }
    if (changedProps.has('draggable') && this.map) {
      this.map.setOptions({ draggable: this.draggable });
    }
  }

  private async _loadGoogleMapsApi(): Promise<void> {
    if (typeof google !== 'undefined' && google.maps) {
      this._apiLoaded = true;
      this._initGMap();
      return;
    }

    const callbackName = `__googleMapsCallback_${Date.now()}`;
    const script = document.createElement('script');
    let url = this.mapsUrl || 'https://maps.googleapis.com/maps/api/js';
    const params: string[] = [];

    if (this.apiKey) params.push(`key=${this.apiKey}`);
    if (this.clientId) params.push(`client=${this.clientId}`);
    if (this.language) params.push(`language=${this.language}`);
    if (this.version) params.push(`v=${this.version}`);
    params.push(`callback=${callbackName}`);

    url += '?' + params.join('&');

    await new Promise<void>((resolve) => {
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        this._apiLoaded = true;
        delete (window as unknown as Record<string, () => void>)[callbackName];
        resolve();
      };
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    });

    this._initGMap();
  }

  private _initGMap(): void {
    if (this.map) return;
    if (!this._apiLoaded) return;
    if (!this._mapDiv) return;

    this.map = new google.maps.Map(this._mapDiv, this._getMapOptions());
    this._listeners = {};
    this._updateCenter();
    this._loadKml();
    this._updateMarkers();
    this._updateObjects();
    this._addMapListeners();
    this.dispatchEvent(new CustomEvent('google-map-ready'));
  }

  private _getMapOptions(): google.maps.MapOptions {
    const mapOptions: google.maps.MapOptions = {
      zoom: this.zoom,
      tilt: this.noAutoTilt ? 0 : 45,
      mapTypeId: this.mapType,
      disableDefaultUI: this.disableDefaultUi,
      mapTypeControl: !this.disableDefaultUi && !this.disableMapTypeControl,
      streetViewControl: !this.disableDefaultUi && !this.disableStreetViewControl,
      disableDoubleClickZoom: this.disableZoom,
      scrollwheel: !this.disableZoom,
      styles: this.styles,
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
      draggable: this.draggable,
    };

    for (const p in this.additionalMapOptions) {
      (mapOptions as Record<string, unknown>)[p] = this.additionalMapOptions[p];
    }

    return mapOptions;
  }

  private _attachChildrenToMap(children: Element[]): void {
    if (this.map) {
      for (const child of children) {
        (child as unknown as { map: google.maps.Map }).map = this.map;
      }
    }
  }

  private _updateMarkers(): void {
    if (!this._markersSlot) return;
    const newMarkers = this._markersSlot.assignedElements() as GoogleMapMarker[];
    this._markers = newMarkers;
    this._attachChildrenToMap(this._markers);
    if (this.fitToMarkers) {
      this._fitToMarkersChanged();
    }
  }

  private _updateObjects(): void {
    if (!this._objectsSlot) return;
    const newObjects = this._objectsSlot.assignedElements();
    this._objects = newObjects;
    this._attachChildrenToMap(this._objects);
  }

  clear(): void {
    for (const m of this._markers) {
      if (m.marker) {
        m.marker.setMap(null);
      }
    }
  }

  resize(): void {
    if (this.map) {
      const oldLatitude = this.latitude;
      const oldLongitude = this.longitude;
      google.maps.event.trigger(this.map, 'resize');
      this.latitude = oldLatitude;
      this.longitude = oldLongitude;

      if (this.fitToMarkers) {
        this._fitToMarkersChanged();
      }
    }
  }

  private _loadKml(): void {
    if (this.map && this.kml) {
      new google.maps.KmlLayer({
        url: this.kml,
        map: this.map
      });
    }
  }

  private _debounceUpdateCenter(): void {
    if (this._debounceTimer !== null) {
      window.clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = window.setTimeout(() => {
      this._updateCenter();
      this._debounceTimer = null;
    }, 0);
  }

  private _updateCenter(): void {
    if (this.map && this.latitude !== undefined && this.longitude !== undefined) {
      const lati = Number(this.latitude);
      if (isNaN(lati)) {
        throw new TypeError('latitude must be a number');
      }
      const longi = Number(this.longitude);
      if (isNaN(longi)) {
        throw new TypeError('longitude must be a number');
      }

      const newCenter = new google.maps.LatLng(lati, longi);
      const oldCenter = this.map.getCenter();

      if (!oldCenter) {
        this.map.setCenter(newCenter);
      } else {
        const oldCenterNormalized = new google.maps.LatLng(oldCenter.lat(), oldCenter.lng());
        if (!oldCenterNormalized.equals(newCenter)) {
          this.map.panTo(newCenter);
        }
      }
    }
  }

  private _zoomChanged(): void {
    if (this.map) {
      this.map.setZoom(Number(this.zoom));
    }
  }

  private _clickEventsChanged(): void {
    if (this.map) {
      if (this.clickEvents) {
        this._forwardEvent('click');
        this._forwardEvent('dblclick');
        this._forwardEvent('rightclick');
      } else {
        this._clearListener('click');
        this._clearListener('dblclick');
        this._clearListener('rightclick');
      }
    }
  }

  private _dragEventsChanged(): void {
    if (this.map) {
      if (this.dragEvents) {
        this._forwardEvent('drag');
        this._forwardEvent('dragend');
        this._forwardEvent('dragstart');
      } else {
        this._clearListener('drag');
        this._clearListener('dragend');
        this._clearListener('dragstart');
      }
    }
  }

  private _mouseEventsChanged(): void {
    if (this.map) {
      if (this.mouseEvents) {
        this._forwardEvent('mousemove');
        this._forwardEvent('mouseout');
        this._forwardEvent('mouseover');
      } else {
        this._clearListener('mousemove');
        this._clearListener('mouseout');
        this._clearListener('mouseover');
      }
    }
  }

  private _maxZoomChanged(): void {
    if (this.map && this.maxZoom !== undefined) {
      this.map.setOptions({ maxZoom: Number(this.maxZoom) });
    }
  }

  private _minZoomChanged(): void {
    if (this.map && this.minZoom !== undefined) {
      this.map.setOptions({ minZoom: Number(this.minZoom) });
    }
  }

  private _mapTypeChanged(): void {
    if (this.map) {
      this.map.setMapTypeId(this.mapType);
    }
  }

  private _disableDefaultUiChanged(): void {
    if (this.map) {
      this.map.setOptions({ disableDefaultUI: this.disableDefaultUi });
    }
  }

  private _disableMapTypeControlChanged(): void {
    if (this.map) {
      this.map.setOptions({ mapTypeControl: !this.disableMapTypeControl });
    }
  }

  private _disableStreetViewControlChanged(): void {
    if (this.map) {
      this.map.setOptions({ streetViewControl: !this.disableStreetViewControl });
    }
  }

  private _disableZoomChanged(): void {
    if (this.map) {
      this.map.setOptions({
        disableDoubleClickZoom: this.disableZoom,
        scrollwheel: !this.disableZoom
      });
    }
  }

  private _fitToMarkersChanged(): void {
    if (this.map && this.fitToMarkers && this._markers.length > 0) {
      const latLngBounds = new google.maps.LatLngBounds();
      for (const m of this._markers) {
        latLngBounds.extend(new google.maps.LatLng(m.latitude!, m.longitude!));
      }

      if (this._markers.length > 1) {
        this.map.fitBounds(latLngBounds);
      }

      this.map.setCenter(latLngBounds.getCenter());
    }
  }

  private _addMapListeners(): void {
    google.maps.event.addListener(this.map!, 'center_changed', () => {
      const center = this.map!.getCenter();
      if (center) {
        this.latitude = center.lat();
        this.longitude = center.lng();
      }
    });

    google.maps.event.addListener(this.map!, 'zoom_changed', () => {
      this.zoom = this.map!.getZoom()!;
    });

    google.maps.event.addListener(this.map!, 'maptypeid_changed', () => {
      this.mapType = this.map!.getMapTypeId() as typeof this.mapType;
    });

    this._clickEventsChanged();
    this._dragEventsChanged();
    this._mouseEventsChanged();
    this._forwardEvent('idle');
  }

  private _clearListener(name: string): void {
    if (this._listeners[name]) {
      google.maps.event.removeListener(this._listeners[name]!);
      this._listeners[name] = null;
    }
  }

  private _forwardEvent(name: string): void {
    this._listeners[name] = google.maps.event.addListener(this.map!, name, (event: google.maps.MapMouseEvent) => {
      this.dispatchEvent(new CustomEvent('google-map-' + name, { detail: event }));
    });
  }

  private _observeHeadMutation(): void {
    this._headObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLStyleElement && node.textContent?.indexOf('gm-') !== -1) {
            this._copyToShadowRoot(node);
          }
        }
      }
    });
    this._headObserver.observe(document.head, { childList: true });
  }

  private _copyToShadowRoot(node: HTMLStyleElement): void {
    this.shadowRoot?.appendChild(node.cloneNode(true));
  }

  protected render() {
    return html`
      <div id="map"></div>
      <slot name="markers"></slot>
      <slot id="objects"></slot>
    `;
  }
}
