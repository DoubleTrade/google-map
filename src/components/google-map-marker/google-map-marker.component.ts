import { LitElement, html, css, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

export default class GoogleMapMarker extends ScopedElementsMixin(LitElement) {
  @property({ type: Object, attribute: false }) marker: google.maps.Marker | null = null;
  @property({ type: Object, attribute: false }) map: google.maps.Map | null = null;
  @property({ type: Object, attribute: false }) info: google.maps.InfoWindow | null = null;
  @property({ type: Boolean, attribute: 'click-events' }) clickEvents = false;
  @property({ type: Boolean, attribute: 'drag-events' }) dragEvents = false;
  @property({ type: Boolean, attribute: 'mouse-events' }) mouseEvents = false;
  @property({ type: Object }) icon: string | google.maps.Icon | google.maps.Symbol | null = null;
  @property({ type: Number, attribute: 'z-index' }) zIndex = 0;
  @property({ type: Number }) longitude: number | null = null;
  @property({ type: Number }) latitude: number | null = null;
  @property({ type: String }) label: string | null = null;
  @property({ type: String }) animation: 'DROP' | 'BOUNCE' | null = null;
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean, reflect: true }) draggable = false;
  @property({ type: String }) override title = '';

  @state() private _listeners: Record<string, google.maps.MapsEventListener | null> = {};
  private _dragHandler: google.maps.MapsEventListener | null = null;
  private _openInfoHandler: google.maps.MapsEventListener | null = null;
  private _closeInfoHandler: google.maps.MapsEventListener | null = null;
  private _contentObserver: MutationObserver | null = null;

  static styles = css`
    :host {
      display: none;
    }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.marker) {
      google.maps.event.clearInstanceListeners(this.marker);
      this._listeners = {};
      this.marker.setMap(null);
    }
    if (this._contentObserver) {
      this._contentObserver.disconnect();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.marker) {
      this.marker.setMap(this.map);
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('map')) {
      this._mapChanged();
    }
    if (changedProps.has('latitude') || changedProps.has('longitude')) {
      this._updatePosition();
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
    if (changedProps.has('animation')) {
      this._animationChanged();
    }
    if (changedProps.has('label')) {
      this._labelChanged();
    }
    if (changedProps.has('icon')) {
      this._iconChanged();
    }
    if (changedProps.has('zIndex')) {
      this._zIndexChanged();
    }
    if (changedProps.has('open')) {
      this._openChanged();
    }
    if (changedProps.has('draggable')) {
      this._draggableChanged();
    }
    if (changedProps.has('title')) {
      this._titleChanged();
    }
  }

  private _updatePosition(): void {
    if (this.marker && this.latitude != null && this.longitude != null) {
      this.marker.setPosition(new google.maps.LatLng(
        parseFloat(String(this.latitude)),
        parseFloat(String(this.longitude))
      ));
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
        this._forwardEvent('mousedown');
        this._forwardEvent('mousemove');
        this._forwardEvent('mouseout');
        this._forwardEvent('mouseover');
        this._forwardEvent('mouseup');
      } else {
        this._clearListener('mousedown');
        this._clearListener('mousemove');
        this._clearListener('mouseout');
        this._clearListener('mouseover');
        this._clearListener('mouseup');
      }
    }
  }

  private _animationChanged(): void {
    if (this.marker && this.animation) {
      this.marker.setAnimation(google.maps.Animation[this.animation]);
    }
  }

  private _labelChanged(): void {
    if (this.marker) {
      this.marker.setLabel(this.label);
    }
  }

  private _iconChanged(): void {
    if (this.marker) {
      this.marker.setIcon(this.icon);
    }
  }

  private _zIndexChanged(): void {
    if (this.marker) {
      this.marker.setZIndex(this.zIndex);
    }
  }

  private _draggableChanged(): void {
    if (this.marker) {
      this.marker.setDraggable(this.draggable);
      this._setupDragHandler();
    }
  }

  private _titleChanged(): void {
    if (this.marker) {
      this.marker.setTitle(this.title);
    }
  }

  private _mapChanged(): void {
    if (this.marker) {
      this.marker.setMap(null);
      google.maps.event.clearInstanceListeners(this.marker);
    }
    if (this.map && this.map instanceof google.maps.Map) {
      this._mapReady();
    }
  }

  private _contentChanged(): void {
    const infoWindowContentEl = document.createElement('div');
    // Move original elements instead of cloning to preserve event listeners
    while (this.firstChild) {
      infoWindowContentEl.appendChild(this.firstChild);
    }

    if (infoWindowContentEl.children.length > 0) {
      if (!this.info) {
        this.info = new google.maps.InfoWindow();
        this._openInfoHandler = google.maps.event.addListener(this.marker!, 'click', () => {
          this.open = true;
        });
        this._closeInfoHandler = google.maps.event.addListener(this.info, 'closeclick', () => {
          this.open = false;
        });
      }
      this.info.setContent(infoWindowContentEl);
    } else {
      if (this.info && !this.open) {
        if (this._openInfoHandler) google.maps.event.removeListener(this._openInfoHandler);
        if (this._closeInfoHandler) google.maps.event.removeListener(this._closeInfoHandler);
        this.info = null;
      }
    }
  }

  private _openChanged(): void {
    if (this.info) {
      if (this.open) {
        this.info.open(this.map!, this.marker!);
        this.dispatchEvent(new CustomEvent('google-map-marker-open'));
      } else {
        this.info.close();
        this.dispatchEvent(new CustomEvent('google-map-marker-close'));
      }
    }
  }

  private _mapReady(): void {
    this._listeners = {};
    this.marker = new google.maps.Marker({
      map: this.map!,
      position: {
        lat: parseFloat(String(this.latitude)),
        lng: parseFloat(String(this.longitude))
      },
      title: this.title,
      animation: this.animation ? google.maps.Animation[this.animation] : undefined,
      draggable: this.draggable,
      visible: !this.hidden,
      icon: this.icon,
      label: this.label,
      zIndex: this.zIndex
    });
    this._contentChanged();
    this._clickEventsChanged();
    this._dragEventsChanged();
    this._mouseEventsChanged();
    this._openChanged();
    this._setupDragHandler();
  }

  private _setupDragHandler(): void {
    if (this.draggable) {
      this._dragHandler = google.maps.event.addListener(this.marker!, 'dragend', (e: google.maps.MapMouseEvent) => {
        this.latitude = e.latLng!.lat();
        this.longitude = e.latLng!.lng();
      });
    } else if (this._dragHandler) {
      google.maps.event.removeListener(this._dragHandler);
      this._dragHandler = null;
    }
  }

  private _clearListener(name: string): void {
    if (this._listeners && this._listeners[name]) {
      google.maps.event.removeListener(this._listeners[name]!);
      this._listeners[name] = null;
    }
  }

  private _forwardEvent(name: string): void {
    if (this.marker) {
      this._listeners[name] = google.maps.event.addListener(this.marker, name, (event: google.maps.MapMouseEvent) => {
        this.dispatchEvent(new CustomEvent('google-map-marker-' + name, { detail: event }));
      });
    }
  }

  protected render() {
    return html`<slot></slot>`;
  }
}
