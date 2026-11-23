import React from 'react';

export type StickerKind =
  | 'santa-hat'
  | 'grinch-eyes'
  | 'grinch-hand'
  | 'reindeer-antlers'
  | 'rudolph-nose'
  | 'bejgli'
  | 'mulled-wine'
  | 'crooked-tree'
  | 'ornaments'
  | 'star-burst'
  | 'gift-box'
  | 'grinch-stamp';

export interface StickerCatalogItem {
  kind: StickerKind;
  label: string;
  emoji: string;
  defaultColor: string;
  defaultAccent: string;
  halfW: number;
  halfH: number;
}

export interface StickerInstance {
  id: string;
  kind: StickerKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  accentColor: string;
}

export const STICKER_CATALOG: StickerCatalogItem[] = [
  {
    kind: 'santa-hat',
    label: 'Mikulás-sapka',
    emoji: '🎅',
    defaultColor: '#e02e26',
    defaultAccent: '#fff8ee',
    halfW: 76,
    halfH: 52,
  },
  {
    kind: 'grinch-eyes',
    label: 'Grincs-szempár',
    emoji: '👀',
    defaultColor: '#c8ff59',
    defaultAccent: '#ffe84d',
    halfW: 98,
    halfH: 52,
  },
  {
    kind: 'grinch-hand',
    label: 'Grincs-kéz gömbbel',
    emoji: '🖐️',
    defaultColor: '#69c93b',
    defaultAccent: '#ff483b',
    halfW: 72,
    halfH: 88,
  },
  {
    kind: 'reindeer-antlers',
    label: 'Rénszarvas agancs',
    emoji: '🦌',
    defaultColor: '#c4834b',
    defaultAccent: '#ff483b',
    halfW: 108,
    halfH: 64,
  },
  {
    kind: 'rudolph-nose',
    label: 'Rudolf-orr',
    emoji: '🔴',
    defaultColor: '#e62424',
    defaultAccent: '#ffffff',
    halfW: 34,
    halfH: 34,
  },
  {
    kind: 'bejgli',
    label: 'Bejgli szelet',
    emoji: '🌀',
    defaultColor: '#d99a4e',
    defaultAccent: '#2c2220',
    halfW: 68,
    halfH: 54,
  },
  {
    kind: 'mulled-wine',
    label: 'Forralt bor',
    emoji: '☕',
    defaultColor: '#d9382e',
    defaultAccent: '#f5cb78',
    halfW: 62,
    halfH: 72,
  },
  {
    kind: 'crooked-tree',
    label: 'Ferde Grincs-fenyő',
    emoji: '🎄',
    defaultColor: '#5ec956',
    defaultAccent: '#ffe14d',
    halfW: 64,
    halfH: 88,
  },
  {
    kind: 'ornaments',
    label: 'Lógó gömbök',
    emoji: '🔮',
    defaultColor: '#ff483b',
    defaultAccent: '#ffe14d',
    halfW: 62,
    halfH: 94,
  },
  {
    kind: 'star-burst',
    label: 'Csillagcsokor',
    emoji: '✨',
    defaultColor: '#f5cb78',
    defaultAccent: '#fff8ee',
    halfW: 64,
    halfH: 60,
  },
  {
    kind: 'gift-box',
    label: 'Ajándékdoboz',
    emoji: '🎁',
    defaultColor: '#e0352d',
    defaultAccent: '#f5cb78',
    halfW: 64,
    halfH: 68,
  },
  {
    kind: 'grinch-stamp',
    label: '100% GRINCS pecsét',
    emoji: '🏷️',
    defaultColor: '#c8ff59',
    defaultAccent: '#ff483b',
    halfW: 78,
    halfH: 78,
  },
];

export const STICKER_META_MAP: Record<StickerKind, StickerCatalogItem> =
  STICKER_CATALOG.reduce(
    (acc, item) => {
      acc[item.kind] = item;
      return acc;
    },
    {} as Record<StickerKind, StickerCatalogItem>
  );

export const FESTIVE_SWATCHES = [
  { label: 'Grincs Lime', hex: '#c8ff59' },
  { label: 'Grincs Zöld', hex: '#52b83e' },
  { label: 'Mikulás Piros', hex: '#ff483b' },
  { label: 'Arany', hex: '#f5cb78' },
  { label: 'Krémfehér', hex: '#fff7eb' },
  { label: 'Korall', hex: '#ee624a' },
  { label: 'Jégkék', hex: '#8ce3ff' },
  { label: 'Bordó', hex: '#8e1b2c' },
  { label: 'Éjfél', hex: '#161826' },
];

export const StickerGraphic: React.FC<{
  kind: StickerKind;
  color: string;
  accentColor: string;
  outlineColor?: string;
}> = ({ kind, color, accentColor, outlineColor = 'rgba(12, 14, 20, 0.72)' }) => {
  switch (kind) {
    case 'santa-hat':
      return (
        <g>
          <rect x={-72} y={-48} width={154} height={96} fill="transparent" />
          <path
            d="M -40 20 Q -12 -46 48 -32 Q 70 -26 76 -2 Q 46 -14 28 16 Z"
            fill={color}
            stroke={outlineColor}
            strokeWidth={3}
          />
          <ellipse cx={-6} cy={20} rx={38} ry={13} fill={accentColor} stroke={outlineColor} strokeWidth={2} />
          <circle cx={78} cy={2} r={13} fill={accentColor} stroke={outlineColor} strokeWidth={2} />
        </g>
      );

    case 'grinch-eyes':
      return (
        <g>
          <rect x={-96} y={-48} width={192} height={100} fill="transparent" />
          <path
            d="M -84 -16 Q -48 -36 -14 -8"
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <path
            d="M 14 -8 Q 48 -36 84 -16"
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <path
            d="M -72 4 Q -44 -14 -18 8 Q -44 26 -72 4 Z"
            fill={accentColor}
            stroke={outlineColor}
            strokeWidth={3}
          />
          <circle cx={-38} cy={6} r={7.5} fill="#d9201c" />
          <circle cx={-36} cy={4} r={2.8} fill="#14151a" />
          <path
            d="M 18 8 Q 44 -14 72 4 Q 44 26 18 8 Z"
            fill={accentColor}
            stroke={outlineColor}
            strokeWidth={3}
          />
          <circle cx={38} cy={6} r={7.5} fill="#d9201c" />
          <circle cx={40} cy={4} r={2.8} fill="#14151a" />
          <path
            d="M -38 34 Q 0 50 42 29"
            fill="none"
            stroke={color}
            strokeWidth={4.5}
            strokeLinecap="round"
            opacity={0.85}
          />
        </g>
      );

    case 'grinch-hand':
      return (
        <g>
          <rect x={-68} y={-84} width={136} height={168} fill="transparent" />
          {/* Furry wrist & bent mischievous fingers */}
          <path
            d="M -30 -82 Q -22 -48 -42 -26 L -54 -14 Q -58 -4 -44 -6 L -22 -14 Q -18 -2 -34 10 Q -38 18 -24 18 L -6 8 Q 6 16 14 28 Q 22 30 22 18 Q 20 0 12 -14 Q 26 -16 36 -4 Q 44 -2 40 -14 Q 32 -30 14 -36 Q 10 -56 16 -82 Z"
            fill={color}
            stroke={outlineColor}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          {/* String holding stolen ornament */}
          <line x1={6} y1={14} x2={6} y2={38} stroke="#f5f2eb" strokeWidth={2.5} />
          <rect x={-3} y={32} width={18} height={9} rx={2} fill="#f5cb78" />
          <circle cx={6} cy={62} r={26} fill={accentColor} stroke={outlineColor} strokeWidth={3} />
          <ellipse cx={-3} cy={53} rx={5.5} ry={10} fill="rgba(255,255,255,0.34)" transform="rotate(-24 -3 53)" />
        </g>
      );

    case 'reindeer-antlers':
      return (
        <g>
          <rect x={-104} y={-60} width={208} height={120} fill="transparent" />
          {/* Left antler */}
          <path
            d="M -22 44 Q -46 18 -58 -16 Q -66 -40 -86 -52 M -52 -2 Q -84 -6 -98 -24 M -44 12 Q -28 -8 -26 -30"
            fill="none"
            stroke={color}
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right antler */}
          <path
            d="M 22 44 Q 46 18 58 -16 Q 66 -40 86 -52 M 52 -2 Q 84 -6 98 -24 M 44 12 Q 28 -8 26 -30"
            fill="none"
            stroke={color}
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Tiny fairy lights */}
          <circle cx={-82} cy={-46} r={7} fill={accentColor} />
          <circle cx={-94} cy={-22} r={6} fill="#ffe14d" />
          <circle cx={82} cy={-46} r={7} fill={accentColor} />
          <circle cx={94} cy={-22} r={6} fill="#8ce3ff" />
        </g>
      );

    case 'rudolph-nose':
      return (
        <g>
          <circle cx={0} cy={0} r={30} fill={color} stroke={outlineColor} strokeWidth={3} />
          <ellipse cx={-9} cy={-9} rx={8} ry={5} fill={accentColor} opacity={0.72} transform="rotate(-30 -9 -9)" />
          <circle cx={-16} cy={-2} r={2.5} fill={accentColor} opacity={0.5} />
        </g>
      );

    case 'bejgli':
      return (
        <g>
          <rect x={-64} y={-50} width={128} height={100} fill="transparent" />
          {/* Golden pastry crust */}
          <ellipse cx={0} cy={4} rx={56} ry={40} fill={color} stroke={outlineColor} strokeWidth={3.5} />
          {/* Inner light dough */}
          <ellipse cx={0} cy={4} rx={47} ry={32} fill="#f7e3bd" />
          {/* Classic poppy/walnut swirl */}
          <path
            d="M 2 4 C 14 -6, 22 8, 10 18 C -8 28, -28 16, -24 -4 C -20 -24, 14 -28, 30 -12 C 44 4, 34 26, 6 30 C -24 34, -44 16, -40 -8"
            fill="none"
            stroke={accentColor}
            strokeWidth={8.5}
            strokeLinecap="round"
          />
          {/* Subtle icing sugar dots */}
          <circle cx={-18} cy={-26} r={3} fill="#fff" opacity={0.75} />
          <circle cx={22} cy={-22} r={2.5} fill="#fff" opacity={0.75} />
          <circle cx={0} cy={-30} r={2.5} fill="#fff" opacity={0.75} />
        </g>
      );

    case 'mulled-wine':
      return (
        <g>
          <rect x={-58} y={-68} width={116} height={136} fill="transparent" />
          {/* Steam curls */}
          <path
            d="M -18 -24 Q -28 -44 -14 -60 M 4 -26 Q -4 -48 10 -64 M 22 -22 Q 16 -40 28 -54"
            fill="none"
            stroke={accentColor}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.8}
          />
          {/* Mug handle */}
          <path
            d="M 32 -4 C 58 -4, 58 44, 30 44"
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Mug body */}
          <rect x={-38} y={-16} width={72} height={74} rx={14} fill={color} stroke={outlineColor} strokeWidth={3} />
          {/* Festive stripe */}
          <rect x={-36} y={14} width={68} height={14} fill={accentColor} opacity={0.9} />
          {/* Cinnamon stick */}
          <line x1={8} y1={-32} x2={24} y2={-8} stroke="#8f4a22" strokeWidth={8} strokeLinecap="round" />
        </g>
      );

    case 'crooked-tree':
      return (
        <g>
          <rect x={-60} y={-84} width={120} height={168} fill="transparent" />
          <path
            d="M -6 80 L -12 44 L -50 50 L -16 0 L -42 6 L -4 -52 L 12 -76 Q 24 -66 16 -52 L 36 -2 L 10 -4 L 44 44 L 6 42 L 12 80 Z"
            fill={color}
            stroke={outlineColor}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <circle cx={18} cy={-74} r={10} fill={accentColor} stroke={outlineColor} strokeWidth={2} />
          <circle cx={-10} cy={-16} r={6} fill={accentColor} />
          <circle cx={14} cy={14} r={7} fill="#ff483b" />
          <circle cx={-16} cy={28} r={6.5} fill="#8ce3ff" />
        </g>
      );

    case 'ornaments':
      return (
        <g>
          <rect x={-58} y={-90} width={118} height={180} fill="transparent" />
          <line x1={-28} y1={-88} x2={-28} y2={-8} stroke="rgba(255,255,255,0.45)" strokeWidth={2.5} />
          <circle cx={-28} cy={18} r={28} fill={color} stroke={outlineColor} strokeWidth={2.5} />
          <ellipse cx={-36} cy={9} rx={6} ry={10} fill="rgba(255,255,255,0.32)" transform="rotate(-22 -36 9)" />
          <rect x={-37} y={-14} width={18} height={9} rx={2} fill={accentColor} />

          <line x1={32} y1={-88} x2={32} y2={34} stroke="rgba(255,255,255,0.45)" strokeWidth={2.5} />
          <circle cx={32} cy={54} r={21} fill={accentColor} stroke={outlineColor} strokeWidth={2.5} />
          <rect x={25} y={30} width={14} height={8} rx={2} fill={color} />
        </g>
      );

    case 'star-burst':
      return (
        <g>
          <rect x={-60} y={-56} width={120} height={112} fill="transparent" />
          <path
            d="M 0 -52 L 10 -12 L 50 0 L 10 12 L 0 52 L -10 12 L -50 0 L -10 -12 Z"
            fill={color}
            stroke={outlineColor}
            strokeWidth={2.5}
          />
          <path
            d="M 38 -40 L 42 -26 L 56 -22 L 42 -18 L 38 -4 L 34 -18 L 20 -22 L 34 -26 Z"
            fill={accentColor}
          />
          <circle cx={-38} cy={-30} r={5} fill={accentColor} />
          <circle cx={-34} cy={34} r={4} fill={color} />
        </g>
      );

    case 'gift-box':
      return (
        <g>
          <rect x={-60} y={-64} width={120} height={128} fill="transparent" />
          {/* Box */}
          <rect x={-46} y={-12} width={92} height={70} rx={8} fill={color} stroke={outlineColor} strokeWidth={3} />
          {/* Lid */}
          <rect x={-52} y={-28} width={104} height={22} rx={6} fill={color} stroke={outlineColor} strokeWidth={3} />
          {/* Ribbon */}
          <rect x={-10} y={-28} width={20} height={86} fill={accentColor} />
          <rect x={-46} y={14} width={92} height={16} fill={accentColor} />
          {/* Bow */}
          <path
            d="M 0 -28 C -28 -62, -46 -32, -8 -26 C -42 -28, -26 -4, 0 -28 Z M 0 -28 C 28 -62, 46 -32, 8 -26 C 42 -28, 26 -4, 0 -28 Z"
            fill={accentColor}
            stroke={outlineColor}
            strokeWidth={2.5}
          />
        </g>
      );

    case 'grinch-stamp':
      return (
        <g>
          <circle cx={0} cy={0} r={70} fill="rgba(16,18,24,0.45)" stroke={color} strokeWidth={5} strokeDasharray="10 5" />
          <circle cx={0} cy={0} r={56} fill="none" stroke={color} strokeWidth={2.5} />
          <text
            x={0}
            y={-10}
            textAnchor="middle"
            fill={accentColor}
            fontSize="26"
            fontWeight="900"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            100%
          </text>
          <text
            x={0}
            y={20}
            textAnchor="middle"
            fill={color}
            fontSize="24"
            fontWeight="900"
            letterSpacing="2"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            GRINCS
          </text>
          <text
            x={0}
            y={40}
            textAnchor="middle"
            fill={color}
            fontSize="11"
            fontWeight="700"
            letterSpacing="1.8"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            opacity={0.85}
          >
            JÓVÁHAGYVA
          </text>
        </g>
      );
  }
};
