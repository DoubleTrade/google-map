import { LitElement, css } from 'lit';
import { property } from 'lit/decorators.js';

export default class GoogleMapPoint extends LitElement {
  @property({ type: Number }) latitude: number | null = null;
  @property({ type: Number }) longitude: number | null = null;

  static styles = css`
    :host {
      display: none;
    }
  `;

  getPosition(): google.maps.LatLng {
    return new google.maps.LatLng(this.latitude!, this.longitude!);
  }
}
