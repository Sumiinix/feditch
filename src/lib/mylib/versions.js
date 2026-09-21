export function compareVersion(version_a_str, version_b_str) {
  const a_base_version = version_a_str.match(/[\d.]+/);
  const b_base_version = version_b_str.match(/[\d.]+/);
  if (a_base_version == null || b_base_version == null) {
    return null;
  }
  let a_components = a_base_version[0].split('.');
  let b_components = b_base_version[0].split('.');
  a_components = a_components.map(Number);
  b_components = b_components.map(Number);
  const len = Math.min(a_components.length, b_components.length);
  for (let i = 0; i < len; i++) {
    if (a_components[i] > b_components[i]) {
      return 1;
    }
    if (a_components[i] < b_components[i]) {
      return -1;
    }
  }
  if (a_components.length > b_components.length) {
    return 1;
  }
  if (a_components.length < b_components.length) {
    return -1;
  }
  return 0;
}
