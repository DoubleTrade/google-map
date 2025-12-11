import { LitElement, html, css, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import GoogleMapPoint from '../google-map-point/google-map-point.component';

export default class GoogleMapPoly extends ScopedElementsMixin(LitElement) {
  @property({ type: Object, attribute: false }) poly: google.maps.Polyline | google.maps.Polygon | null = null;
  @property({ type: Object, attribute: false }) path: google.maps.MVCArray<google.maps.LatLng> | null = null;
  @property({ type: Object, attribute: false }) map: google.maps.Map | null = null;
  @property({ type: Boolean }) clickable = false;
  @property({ type: Boolean, attribute: 'click-events' }) clickEvents = false;
  @property({ type: Boolean }) closed = false;
  @property({ type: Boolean, reflect: true }) draggable = false;
  @property({ type: Boolean, attribute: 'drag-events' }) dragEvents = false;
  @property({ type: Boolean }) editable = false;
  @property({ type: Boolean }) editing = false;
  @property({ type: String, attribute: 'fill-color' }) fillColor = '';
  @property({ type: Number, attribute: 'fill-opacity' }) fillOpacity = 0;
  @property({ type: Boolean }) geodesic = false;
  @property({ type: Array }) icons: google.maps.IconSequence[] | null = null;
  @property({ type: Boolean, attribute: 'mouse-events' }) mouseEvents = false;
  @property({ type: String, attribute: 'stroke-color' }) strokeColor = 'black';
  @property({ type: Number, attribute: 'stroke-opacity' }) strokeOpacity = 1;
  @property({ type: String, attribute: 'stroke-position' }) strokePosition: 'center' | 'inside' | 'outside' = 'center';
  @property({ type: Number, attribute: 'stroke-weight' }) strokeWeight = 3;
  @property({ type: Number, attribute: 'z-index' }) zIndex = 0;

  @state() private _listeners: Record<string, google.maps.MapsEventListener | null> = {};
  private _points: GoogleMapPoint[] | null = null;
  private _pointsSlot: HTMLSlotElement | null = null;
  private _building = false;

  protected static get scopedElements() {
    return {
      'google-map-point': GoogleMapPoint,
    };
  }

  static styles = css`
    :host {
      display: none;
    }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.poly) {
      this.poly.setMap(null);
    }
    for (const name in this._listeners) {
      this._clearListener(name);
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.poly) {
      this.poly.setMap(this.map);
    }
  }

  protected firstUpdated(): void {
    this._pointsSlot = this.shadowRoot?.querySelector('slot#points') ?? null;
    if (this._pointsSlot) {
      this._pointsSlot.addEventListener('slotchange', () => this._buildPathFromPoints());
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('map')) {
      this._mapChanged();
    }
    if (changedProps.has('clickable')) {
      this.poly?.set('clickable', this.clickable);
    }
    if (changedProps.has('clickEvents')) {
      this._clickEventsChanged();
    }
    if (changedProps.has('closed')) {
      this._mapChanged();
    }
    if (changedProps.has('dragEvents')) {
      this._dragEventsChanged();
    }
    if (changedProps.has('editable')) {
      this.poly?.setEditable(this.editable);
    }
    if (changedProps.has('fillColor')) {
      this.poly?.set('fillColor', this.fillColor);
    }
    if (changedProps.has('fillOpacity')) {
      this.poly?.set('fillOpacity', this.fillOpacity);
    }
    if (changedProps.has('geodesic')) {
      this.poly?.set('geodesic', this.geodesic);
    }
    if (changedProps.has('icons')) {
      this.poly?.set('icons', this.icons);
    }
    if (changedProps.has('mouseEvents')) {
      this._mouseEventsChanged();
    }
    if (changedProps.has('strokeColor')) {
      this.poly?.set('strokeColor', this.strokeColor);
    }
    if (changedProps.has('strokeOpacity')) {
      this.poly?.set('strokeOpacity', this.strokeOpacity);
    }
    if (changedProps.has('strokePosition')) {
      this.poly?.set('strokePosition', this._convertStrokePosition());
    }
    if (changedProps.has('strokeWeight')) {
      this.poly?.set('strokeWeight', this.strokeWeight);
    }
    if (changedProps.has('zIndex')) {
      this.poly?.set('zIndex', this.zIndex);
    }
    if (changedProps.has('draggable') && this.poly) {
      this.poly.setDraggable(this.draggable);
    }
  }

  private _clickEventsChanged(): void {
    if (this.poly) {
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
    if (this.poly) {
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
    if (this.poly) {
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

  private _mapChanged(): void {
    if (this.poly) {
      this.poly.setMap(null);
      google.maps.event.clearInstanceListeners(this.poly);
    }

    if (this.map && this.map instanceof google.maps.Map) {
      this._createPoly();
    }
  }

  private _buildPathFromPoints(): void {
    if (!this._pointsSlot) return;
    const assignedElements = this._pointsSlot.assignedElements();
    this._points = assignedElements.filter(
      (el): el is GoogleMapPoint => el.tagName.toLowerCase() === 'google-map-point'
    );

    this._building = true;
    if (this.path) {
      this.path.clear();
      for (const point of this._points) {
        this.path.push(point.getPosition());
      }
    }
    this._building = false;

    this.dispatchEvent(new CustomEvent('google-map-poly-path-built', { detail: this.path }));
  }

  private _clearListener(name: string): void {
    if (this._listeners[name]) {
      google.maps.event.removeListener(this._listeners[name]!);
      this._listeners[name] = null;
    }
  }

  private _convertStrokePosition(): google.maps.StrokePosition {
    return google.maps.StrokePosition && this.strokePosition
      ? google.maps.StrokePosition[this.strokePosition.toUpperCase() as keyof typeof google.maps.StrokePosition]
      : google.maps.StrokePosition.CENTER;
  }

  private _createPoly(): void {
    if (!this.path) {
      this.path = new google.maps.MVCArray<google.maps.LatLng>();
      google.maps.event.addListener(this.path, 'insert_at', () => this._startEditing());
      google.maps.event.addListener(this.path, 'set_at', (index: number, vertex: google.maps.LatLng) =>
        this._updatePoint(index, vertex)
      );
      this._buildPathFromPoints();
    }

    const options: google.maps.PolylineOptions | google.maps.PolygonOptions = {
      clickable: this.clickable || this.draggable,
      draggable: this.draggable,
      editable: this.editable,
      geodesic: this.geodesic,
      map: this.map!,
      path: this.path,
      strokeColor: this.strokeColor,
      strokeOpacity: this.strokeOpacity,
      strokeWeight: this.strokeWeight,
      visible: !this.hidden,
      zIndex: this.zIndex
    };

    if (this.closed) {
      (options as google.maps.PolygonOptions).fillColor = this.fillColor;
      (options as google.maps.PolygonOptions).fillOpacity = this.fillOpacity;
      this.poly = new google.maps.Polygon(options as google.maps.PolygonOptions);
    } else {
      (options as google.maps.PolylineOptions).icons = this.icons ?? undefined;
      this.poly = new google.maps.Polyline(options);
    }

    this._listeners = {};
    this._clickEventsChanged();
    this._mouseEventsChanged();
    this._dragEventsChanged();
  }

  private _forwardEvent(name: string): void {
    this._listeners[name] = google.maps.event.addListener(this.poly!, name, (event: google.maps.PolyMouseEvent) => {
      this.dispatchEvent(new CustomEvent('google-map-poly-' + name, { detail: event }));
    });
  }

  private _startEditing(): void {
    if (this._building) return;

    if (!this.editing) {
      this.editing = true;
      this._points = null;
      google.maps.event.addListenerOnce(this.map!, 'click', () => {
        this.editing = false;
        this.dispatchEvent(new CustomEvent('google-map-poly-path-updated', { detail: this.path }));
      });
    }
  }

  private _updatePoint(index: number, vertex: google.maps.LatLng): void {
    if (!this._points) return;

    this._points[index].latitude = vertex.lat();
    this._points[index].longitude = vertex.lng();
  }

  protected render() {
    return html`<slot id="points"></slot>`;
  }
}
