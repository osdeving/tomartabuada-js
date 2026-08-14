export const FEATURE_FLAGS = Object.freeze({
  sessionProgressNotices: false,
});

export function isFeatureEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}
