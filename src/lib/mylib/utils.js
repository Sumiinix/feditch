export function findKeyInOrder(object, ...keys) {
  if(!keys.length) return false;

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      return false;
    }
    object = object[key];
  }

  return true;
}

export function hasOwnPropertyAll(object, ...keys) {
  if (!keys.length) return false;

  let _find;
  if (Object.hasOwn) {
    _find = (object, key) => {
      return Object.hasOwn(object, key);
    }
  } else {
    _find = (object, key) => {
      return Object.prototype.hasOwnProperty.call(object, key);
    }
  }
  
  for (let key of keys) {
    if (!_find(object, key)) {
      return false;
    }
  }
  return true;
}

export function genRandomString() {
  let array = new Uint32Array(28);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => dec.toString(16).substring(-2) ).join('');
}
