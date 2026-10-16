// Course input contract, shared by sample and upload preparation.
export const COURSE_INPUT = {
  width: 1024,
  height: 1024,
  rgbBitDepth: 8,
  depthBitDepth: 16,
  depthScaleM: 0.0001,
  depthInvalidCode: 0,
  maxFileBytes: 30 * 1024 * 1024,
} as const;
