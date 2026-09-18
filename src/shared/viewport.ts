export const VIEWPORT_LIMITS = { min: 200, max: 7680, minDpr: 0.5, maxDpr: 4 } as const

export const DEVICE_CATEGORIES = [
  { id: 'phone', label: 'Moviles' },
  { id: 'foldable', label: 'Plegables' },
  { id: 'tablet', label: 'Tablets' },
  { id: 'laptop', label: 'Portatiles' },
  { id: 'desktop', label: 'Monitores' },
  { id: 'tv', label: 'TV / 8K' },
  { id: 'responsive', label: 'Breakpoints' }
] as const

export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number]['id']

export interface DevicePreset {
  id: string
  label: string
  category: DeviceCategory
  /** Logical CSS pixels in the profile's native orientation, not panel pixels. */
  w: number
  h: number
  dpr: number
  mobile: boolean
  touch: boolean
  ua?: string
}

const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const android = (model: string, tablet = false): string =>
  `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0${tablet ? '' : ' Mobile'} Safari/537.36`

type Profile = [id: string, label: string, w: number, h: number, dpr?: number]
function profiles(category: DeviceCategory, rows: Profile[], mobile = false, ua?: string, touch = mobile): DevicePreset[] {
  return rows.map(([id, label, w, h, dpr = 1]) => ({ id, label, category, w, h, dpr, mobile, touch, ua }))
}

/** Reference viewport profiles, not a claim of physical-device or browser-engine emulation. */
export const DEVICE_PRESETS: DevicePreset[] = [
  ...profiles('phone', [
    ['iphone-se', 'iPhone SE', 375, 667, 2],
    ['iphone-12-mini', 'iPhone 12 / 13 mini', 375, 812, 3],
    ['iphone-12', 'iPhone 12 / 13 / 14', 390, 844, 3],
    ['iphone-14', 'iPhone 14 Pro / 15 / 16', 393, 852, 3],
    ['iphone-14-plus', 'iPhone 14 Plus', 428, 926, 3],
    ['iphone-15-max', 'iPhone 15 Pro Max / 16 Plus', 430, 932, 3],
    ['iphone-16-pro', 'iPhone 16 Pro', 402, 874, 3],
    ['iphone-16-max', 'iPhone 16 Pro Max', 440, 956, 3]
  ], true, UA_IOS),
  ...profiles('phone', [['pixel-7', 'Google Pixel 7', 412, 915, 2.625]], true, android('Pixel 7')),
  ...profiles('phone', [['pixel-8', 'Google Pixel 8', 412, 915, 2.625]], true, android('Pixel 8')),
  ...profiles('phone', [['pixel-8-pro', 'Google Pixel 8 Pro', 448, 998, 3]], true, android('Pixel 8 Pro')),
  ...profiles('phone', [['galaxy-s24', 'Samsung Galaxy S24', 360, 780, 3]], true, android('SM-S921B')),
  ...profiles('phone', [['galaxy-s24-ultra', 'Samsung Galaxy S24 Ultra', 384, 824, 3.75]], true, android('SM-S928B')),
  ...profiles('phone', [['galaxy-a54', 'Samsung Galaxy A54', 360, 800, 3]], true, android('SM-A546B')),
  ...profiles('foldable', [
    ['galaxy-fold-cover', 'Galaxy Z Fold5 / exterior', 344, 882, 2.625],
    ['galaxy-fold-open', 'Galaxy Z Fold5 / abierto', 690, 829, 3]
  ], true, android('SM-F946B')),
  ...profiles('foldable', [['galaxy-flip', 'Galaxy Z Flip5 / abierto', 412, 915, 2.625]], true, android('SM-F731B')),
  ...profiles('foldable', [
    ['pixel-fold-cover', 'Pixel Fold / exterior', 408, 904, 2.625],
    ['pixel-fold-open', 'Pixel Fold / abierto', 841, 701, 2.625]
  ], true, android('Pixel Fold')),
  ...profiles('tablet', [
    ['ipad-mini', 'iPad mini 5', 768, 1024, 2],
    ['ipad-mini-6', 'iPad mini 6', 744, 1133, 2],
    ['ipad-10', 'iPad 10 / Air 11"', 820, 1180, 2],
    ['ipad-pro', 'iPad Pro 11" (2018-2022)', 834, 1194, 2],
    ['ipad-pro-m4', 'iPad Pro 11" M4', 834, 1210, 2],
    ['ipad-pro-13', 'iPad Pro 13" M4', 1032, 1376, 2],
    ['ipad-pro-129', 'iPad Pro 12.9"', 1024, 1366, 2]
  ], true, UA_IPAD),
  ...profiles('tablet', [['galaxy-tab-s9', 'Samsung Galaxy Tab S9', 800, 1280, 2]], true, android('SM-X710', true)),
  ...profiles('tablet', [['surface-pro', 'Surface Pro / tactil', 912, 1368, 2]], false, undefined, true),
  ...profiles('laptop', [
    ['laptop', 'Laptop compacta', 1280, 800],
    ['laptop-hd', 'Laptop HD', 1366, 768],
    ['laptop-1440', 'Laptop 1440', 1440, 900],
    ['macbook-air', 'MacBook Air 13"', 1470, 956, 2],
    ['macbook-pro-14', 'MacBook Pro 14"', 1512, 982, 2],
    ['macbook-pro-16', 'MacBook Pro 16"', 1728, 1117, 2],
    ['laptop-fhd', 'Laptop Full HD', 1920, 1080]
  ]),
  ...profiles('desktop', [
    ['desktop-720', 'HD 720p', 1280, 720],
    ['desktop-1600', 'Monitor 1600', 1600, 900],
    ['desktop', 'Full HD 1080p', 1920, 1080],
    ['desktop-qhd', 'QHD 1440p', 2560, 1440],
    ['desktop-4k', '4K UHD', 3840, 2160],
    ['desktop-ultrawide', 'Ultrawide 21:9', 3440, 1440],
    ['desktop-superwide', 'Super ultrawide 32:9', 5120, 1440],
    ['desktop-5k', '5K', 5120, 2880]
  ]),
  ...profiles('tv', [
    ['tv-720', 'TV HD', 1280, 720],
    ['tv-1080', 'TV Full HD', 1920, 1080],
    ['tv-4k', 'TV 4K', 3840, 2160],
    ['tv-8k', 'TV 8K', 7680, 4320]
  ]),
  ...profiles('responsive', [
    ['bp-320', 'XS / 320', 320, 568],
    ['bp-360', 'Movil / 360', 360, 800],
    ['bp-480', 'SM / 480', 480, 800],
    ['bp-640', 'SM / 640', 640, 960],
    ['bp-768', 'MD / 768', 768, 1024],
    ['bp-1024', 'LG / 1024', 1024, 768],
    ['bp-1280', 'XL / 1280', 1280, 800],
    ['bp-1536', '2XL / 1536', 1536, 960]
  ])
]

export interface ViewportSet {
  presetId: string | null
  /** Custom dimensions are always the displayed orientation, never swapped again. */
  width?: number
  height?: number
  dpr?: number
  mobile?: boolean
  touch?: boolean
  /** Presets only: swap relative to the profile's native orientation. */
  landscape?: boolean
}

export interface ViewportConfig {
  presetId: string | null
  width: number
  height: number
  dpr: number
  mobile: boolean
  touch: boolean
  landscape: boolean
  ua?: string
}

export interface ViewportState extends ViewportConfig {
  /** Display scale only; CSS dimensions and DPR remain unchanged. */
  scale: number
  error?: string
}

export const FIT_VIEWPORT: ViewportConfig = {
  presetId: null, width: 0, height: 0, dpr: 1, mobile: false, touch: false, landscape: false
}

export function validDimensions(width: number, height: number, dpr = 1): boolean {
  return [width, height].every((n) => Number.isInteger(n) && n >= VIEWPORT_LIMITS.min && n <= VIEWPORT_LIMITS.max) &&
    Number.isFinite(dpr) && dpr >= VIEWPORT_LIMITS.minDpr && dpr <= VIEWPORT_LIMITS.maxDpr
}

/** Treat IPC and persisted data as untrusted, even when TypeScript callers are typed. */
export function resolveViewport(input: unknown): ViewportConfig | null {
  if (!input || typeof input !== 'object') return null
  const p = input as ViewportSet
  if (p.presetId === null) return { ...FIT_VIEWPORT }
  if (p.presetId === 'custom') {
    const { width, height, dpr = 1, mobile = false, touch = mobile } = p
    if (typeof width !== 'number' || typeof height !== 'number' ||
      !validDimensions(width, height, dpr) || typeof mobile !== 'boolean' || typeof touch !== 'boolean') return null
    return { presetId: 'custom', width, height, dpr, mobile, touch, landscape: width > height }
  }
  if (p.landscape !== undefined && typeof p.landscape !== 'boolean') return null
  const preset = DEVICE_PRESETS.find((d) => d.id === p.presetId)
  if (!preset) return null
  const rotated = p.landscape ?? false
  return {
    presetId: preset.id,
    width: rotated ? preset.h : preset.w,
    height: rotated ? preset.w : preset.h,
    dpr: preset.dpr, mobile: preset.mobile, touch: preset.touch, ua: preset.ua, landscape: rotated
  }
}

export function viewportGeometry(config: ViewportConfig, width: number, height: number): {
  x: number; y: number; width: number; height: number; scale: number
} {
  const availableW = Math.max(1, width)
  const availableH = Math.max(1, height)
  if (config.presetId === null) return { x: 0, y: 0, width: availableW, height: availableH, scale: 1 }
  const scale = Math.min(1, availableW / config.width, availableH / config.height)
  const w = Math.max(1, Math.floor(config.width * scale))
  const h = Math.max(1, Math.floor(config.height * scale))
  return { x: Math.floor((availableW - w) / 2), y: Math.floor((availableH - h) / 2), width: w, height: h, scale }
}

export function rotateViewport(vp: ViewportConfig): ViewportSet {
  return vp.presetId === 'custom'
    ? { presetId: 'custom', width: vp.height, height: vp.width, dpr: vp.dpr, mobile: vp.mobile, touch: vp.touch }
    : { presetId: vp.presetId, landscape: !vp.landscape }
}
