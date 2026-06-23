declare module "react-simple-maps" {
  import type { ReactNode, CSSProperties, MouseEventHandler } from "react";

  interface ProjectionConfig {
    center?: [number, number];
    scale?: number;
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  interface GeographyStyle {
    default?: CSSProperties & { outline?: string; cursor?: string };
    hover?: CSSProperties & { outline?: string; cursor?: string; fill?: string };
    pressed?: CSSProperties & { outline?: string };
  }

  interface GeoFeature {
    rsmKey: string;
    properties: Record<string, unknown>;
    type: string;
    geometry: unknown;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: GeoFeature[] }) => ReactNode;
  }

  interface GeographyProps {
    geography: GeoFeature;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyle;
    onClick?: MouseEventHandler<SVGPathElement>;
    onMouseEnter?: MouseEventHandler<SVGPathElement>;
    onMouseLeave?: MouseEventHandler<SVGPathElement>;
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Marker(props: { coordinates: [number, number]; children?: ReactNode }): JSX.Element;
}
