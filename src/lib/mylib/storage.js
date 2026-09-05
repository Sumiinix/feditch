/*global browser*/
export {manageRedirect, manageOAuthApp, manageTempState, manageLatest};

async function getArrayLocalStorage(name) {
  const gettingSave = await browser.storage.local.get(name);
  if (gettingSave == undefined) {
    return [];
  }
  const savedArray = gettingSave[name];
  if (savedArray.constructor != Array) {
    throw new Error(`appendArrayLocalStorage failed. Not 'Array'.`);
  }
  return savedArray;
}

async function appendArrayLocalStorage(name, data) {
  let savedArray = await getArrayLocalStorage(name);
  savedArray.push(data);
  await browser.storage.local.set({ [name]:savedArray });
}

async function setObjectLocalStorage(name, key, value) {
  const gettingSave = await browser.storage.local.get(name);
  let savedObject = gettingSave[name];
  if (savedObject == undefined) {
    savedObject = {};
  }
  if (savedObject.constructor != Object) {
    throw new Error(`appendObjectLocalStorage failed. Not 'Object'.`);
  }

  savedObject[key] = value;
  await browser.storage.local.set({ [name]:savedObject });
}

async function getObjectLocalStorage(name, key) {
  const gettingSave = await browser.storage.local.get(name);
  const savedObject = gettingSave[name];
  if (savedObject == undefined) {
    return undefined;
  }
  return savedObject[key];
}

const manageRedirect = {
  save: async (data) => {
    await appendArrayLocalStorage("redirects", data);
  },
  load: async () => {
    return await getArrayLocalStorage("redirects");
  }
}

const manageOAuthApp = {
  save: async (domain_str, data) => {
    await setObjectLocalStorage("oauth_app", domain_str, data);
  },
  exist: async (domain_str) => {
    const gettingSave =  await browser.storage.local.get("oauth_app");
    const savedObject = gettingSave["oauth_app"];
    if (savedObject == undefined) {
      return false;
    }
    const exist = Object.prototype.hasOwnProperty.call(savedObject ,domain_str);
    if (exist) {
      return true;
    }
    return false;
  },
  load: async (domain_str) => {
    const appdata = getObjectLocalStorage("oauth_app", domain_str);
    if (appdata == undefined) {
      return undefined;
    }
    return appdata;
  }
}

const manageTempState = {
  save: async (data) => {
    await browser.storage.local.set({ "auth_state":data });
  },
  load: async () => {
    const gettingSave = await browser.storage.local.get("auth_state");
    if (gettingSave == undefined) {
      return undefined;
    }
    return gettingSave["auth_state"];
  },
  clear: async () => {
    await browser.storage.local.remove("auth_state");
  }
}

const manageLatest = {
  save: async (name, domain, method) => {
    const data = { name, domain, method }
    await browser.storage.local.set({ "latest":data });
  },
  load: async () => {
    const gettingSave = await browser.storage.local.get("latest");
    if (gettingSave == undefined) {
      return undefined;
    }
    return gettingSave["latest"];
  },
  clear: async () => {
    await browser.storage.local.remove("latest");
  }
}
