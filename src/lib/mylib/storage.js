/*global browser*/
export {manageRedirect, manageOAuthApp, manageTempState, manageLatest, resetAllData};

async function getArrayLocalStorage(name) {
  const gettingSave = await browser.storage.local.get(name);
  const savedArray = gettingSave[name];
  if (savedArray == undefined) {
    return [];
  }
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
  _nameAlreadyExist: (redirects, name) => {
    const find = redirects.find((redirect) => {
      if (redirect.name == name) {
        return true;
      }
      return false;
    });
    if (find) return true;
    else return false;
  },
  save: async (data) => {
    await appendArrayLocalStorage("redirects", data);
  },
  load: async () => {
    return await getArrayLocalStorage("redirects");
  },
  removeItem: async (index) => {
    let array = await getArrayLocalStorage("redirects");
    array.splice(index, 1);
    await browser.storage.local.set({ "redirects":array });
  },
  move: async (from, to) => {
    let array = await getArrayLocalStorage("redirects");
    if (typeof array[from] === 'undefined' || typeof array[to] === 'undefined') {
      throw new Error("Invalid index");
    }
    array.splice(to, 0, array.splice(from, 1)[0]);
    await browser.storage.local.set({ "redirects":array });
  },
  edit: async function(index, data) {
    let array = await getArrayLocalStorage("redirects");
    if (typeof array[index] === 'undefined') {
      throw new Error("Invalid index");
    } else if (!data.name) {
      throw new Error("Invalid name");
    }
    array[index].name = undefined;
    if (this._nameAlreadyExist(array, data.name)) {
      throw new Error("Name already exist");
    }
    array[index] = data;
    await browser.storage.local.set({ "redirects":array })
  }
};

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
};

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
};

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
};

const resetAllData = async () => {
  await browser.storage.local.clear();
};
