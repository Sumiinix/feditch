import reference from "./nameReference.json" with {type: "json"};

class InvalidDomainError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidDomainError";
  }
}

class ConnectionError extends Error {
  constructor(message = "Could not connect to the server.") {
    super(message);
    this.name = "ConnectionError";
  }
}

export class URLGenerator {
  constructor(domain_str) {
    domain_str = String(domain_str).toLowerCase();
    const domain = domain_str;
    const base = "".concat("https://", domain, "/");

    try {
      this._baseURLObj = new URL(base);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new InvalidDomainError(`"${domain}" is not valid domain.`)
      } else {
        throw error;
      }
    }
  }

  getWebfingerURL() {
    return new URL("/.well-known/webfinger", this._baseURLObj);
  }

  // FEP-d556: Server-Level Actor Discovery Using WebFinger
  getServerWebfingerURL() {
    const webfingerURL = this.getWebfingerURL();
    webfingerURL.searchParams.set("resource", this._baseURLObj.href);
    return webfingerURL;
  }

  getServerHandleWebfingerURL() {
    const webfingerURL = this.getWebfingerURL();
    webfingerURL.searchParams.set(
        "resource", `acct:${this._baseURLObj.hostname}@${this._baseURLObj.hostname}`);
    return webfingerURL;
  }

  getHandleWebfingerURL(username) {
    const webfingerURL = this.getWebfingerURL();
    webfingerURL.searchParams.set(
        "resource", `acct:${username}@${this._baseURLObj.hostname}`);
    return webfingerURL;
  }

  getMastodonAPIInstanceURL(version = "v2") {
    return new URL("".concat("/api", "/",version, "/instance"), this._baseURLObj);
  }

  getMastodonAPIVerifyCredentialsURL() {
    return new URL("/api/v1/accounts/verify_credentials", this._baseURLObj);
  }

  getOAuthServerMetadataURL() {
    return new URL("/.well-known/oauth-authorization-server", this._baseURLObj.href);
  }
}

export class RedirectMethodsDiscovery {
  constructor(domain_str) {
    this._URL = new URLGenerator(domain_str);
    const initResult = {
          detect: "no",
          template: ""
    };
    this.result = {
      "ActivityIntentsObject": initResult,
      "Ostatus1.0Subscribe": initResult
    };
  }

  async _getJson(url) {
    let response;
    let json;

    try {
      response = await fetch(url);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ConnectionError("Cloud not connect to the server");
      } else {
        throw error;
      }
    }

    if (!response.ok) return null;

    try {
      json = await response.json();
    } catch {
      return null;
    }

    return json;
  }

  // FEP-d556: Server-Level Actor Discovery Using WebFinger
  async fromServerPrefixWebfinger() {
    const found = [];
    let json = await this._getJson(this._URL.getServerWebfingerURL());
    if (!json) {
      return [];
    }

    for(let link of json.links) {
      if (
        link.rel == "https://w3id.org/fep/3b86/Object" ||
        link.rel == "http://ostatus.org/schema/1.0/subscribe"
      ) {
        const discovered_method = reference["fromRelsToMethodName"][link.rel];
        this.result[discovered_method] = {
            detect: "yes",
            template: link.template};
        found.push(discovered_method);
      }
    }

    return found;
  }

  async fromApplicationWebfinger() {
    const found = [];
    let json = await this._getJson(this._URL.getServerHandleWebfingerURL());
    if (!json) {
      return [];
    }

    for(let link of json.links) {
      if (
        link.rel == "https://w3id.org/fep/3b86/Object" ||
        link.rel == "http://ostatus.org/schema/1.0/subscribe"
      ) {
        const discovered_method = reference["fromRelsToMethodName"][link.rel];
        this.result[discovered_method] = {
            detect: "yes",
            template: link.template};
        found.push(discovered_method);
      }
    }

    return found;
  }

  async fromHandleWebfinger(username) {
    const found = [];
    let json = await this._getJson(this._URL.getHandleWebfingerURL(username));
    if (!json) {
      return [];
    }

    for(let link of json.links) {
      if (
        link.rel == "https://w3id.org/fep/3b86/Object" ||
        link.rel == "http://ostatus.org/schema/1.0/subscribe"
      ) {
        const discovered_method = reference["fromRelsToMethodName"][link.rel];
        this.result[discovered_method] = {
            detect: "yes",
            template: link.template};
        found.push(discovered_method);
      }
    }

    return found;
  }

  getTopMethodFound() {
    if (this.result["ActivityIntentsObject"].detect == "yes") {
      return "ActivityIntentsObject";
    } else if (this.result["Ostatus1.0Subscribe"].detect == "yes") {
      return "Ostatus1.0Subscribe";
    }

    return null;
  }
}
