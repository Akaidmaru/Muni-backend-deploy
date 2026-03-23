import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface SnappedPoint {
  location: LatLng;
  originalIndex?: number;
}

interface SnapToRoadsResponse {
  snappedPoints?: SnappedPoint[];
  error?: { message: string; code: number };
}

@Injectable()
export class GoogleRoadsService {
  private readonly SNAP_URL = 'https://roads.googleapis.com/v1/snapToRoads';

  /**
   * GPS points farther apart than this get linearly interpolated before
   * snapping so Roads API has enough context to work correctly.
   */
  private readonly MAX_SEGMENT_METERS = 50;

  /**
   * Roads API hard limit is 100 points per request.
   * We use 99 to leave room for the 1 overlap point between chunks.
   */
  private readonly CHUNK_SIZE = 99;

  /**
   * Minimum distance between consecutive output points.
   * Removes duplicates produced by Roads API interpolation.
   */
  private readonly MIN_POINT_DISTANCE_METERS = 5;

  private get apiKey(): string {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      throw new HttpException(
        'Google Maps API key is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return key;
  }

  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------

  /**
   * Pipeline:
   * 1. interpolatePoints — densify GPS points so Roads API has enough context
   * 2. snapChunked       — snap each chunk to nearest roads
   * 3. deduplicatePoints — remove points closer than MIN_POINT_DISTANCE_METERS
   *
   * Note: gaps where Roads API drops points are left as-is (straight lines).
   * We avoid using Directions API to fill them because it calculates the optimal
   * route, not the route the vehicle actually took.
   */
  async snapToRoads(points: LatLng[]): Promise<LatLng[]> {
    if (points.length === 0) return [];
    if (points.length === 1) return points;

    const interpolated = this.interpolatePoints(points);
    const snapped = await this.snapChunked(interpolated);
    return this.deduplicatePoints(snapped);
  }

  // ---------------------------------------------------------------------------
  // Step 1 — Interpolate
  // ---------------------------------------------------------------------------

  private interpolatePoints(points: LatLng[]): LatLng[] {
    const result: LatLng[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const dist = this.haversineMeters(from, to);

      if (dist > this.MAX_SEGMENT_METERS) {
        const steps = Math.ceil(dist / this.MAX_SEGMENT_METERS);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          result.push({
            latitude: from.latitude + t * (to.latitude - from.latitude),
            longitude: from.longitude + t * (to.longitude - from.longitude),
          });
        }
      }

      result.push(to);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Snap to Roads (chunked)
  // ---------------------------------------------------------------------------

  private async snapChunked(points: LatLng[]): Promise<LatLng[]> {
    const snapped: LatLng[] = [];
    let lastPoint: LatLng | null = null;

    for (let i = 0; i < points.length; i += this.CHUNK_SIZE) {
      let chunk = points.slice(i, i + this.CHUNK_SIZE);

      // Prepend last point of previous chunk for continuity — stays ≤ 100 total
      if (lastPoint) chunk = [lastPoint, ...chunk];

      const chunkResult = await this.fetchSnappedChunk(chunk);
      const newPoints = i === 0 ? chunkResult : chunkResult.slice(1);

      snapped.push(...newPoints);
      lastPoint = newPoints.at(-1) ?? lastPoint;
    }

    return snapped;
  }

  private async fetchSnappedChunk(chunk: LatLng[]): Promise<LatLng[]> {
    const path = chunk.map((p) => `${p.latitude},${p.longitude}`).join('|');
    const url = `${this.SNAP_URL}?path=${path}&interpolate=true&key=${this.apiKey}`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new HttpException(
        'Failed to reach Google Roads API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!res.ok) {
      throw new HttpException(
        `Google Roads API responded with status ${res.status}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = (await res.json()) as SnapToRoadsResponse;

    if (data.error) {
      throw new HttpException(
        `Google Roads API error: ${data.error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return (data.snappedPoints ?? []).map((p) => ({
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    }));
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Deduplicate
  // ---------------------------------------------------------------------------

  private deduplicatePoints(points: LatLng[]): LatLng[] {
    if (points.length === 0) return [];
    const result: LatLng[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (
        this.haversineMeters(result.at(-1)!, points[i]) >=
        this.MIN_POINT_DISTANCE_METERS
      ) {
        result.push(points[i]);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private haversineMeters(a: LatLng, b: LatLng): number {
    const R = 6_371_000;
    const φ1 = (a.latitude * Math.PI) / 180;
    const φ2 = (b.latitude * Math.PI) / 180;
    const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
    const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
    const h =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
