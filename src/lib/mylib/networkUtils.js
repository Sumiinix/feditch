/*global browser*/
import reference from "./nameReference.json" with {type: "json"};
import { delay } from "./timer.js";
import { findKeyInOrder, hasOwnPropertyAll, genRandomString } from "./utils.js";
import { manageTempState } from "./storage.js";

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

class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class GenURLFromDomain {
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
    this._URL = new GenURLFromDomain(domain_str);
  }

  // FEP-d556: Server-Level Actor Discovery Using WebFinger
  async fromServerPrefixWebfinger() {
    let response;
    let json;
    const results = [];

    try {
      response = await fetch(this._URL.getServerWebfingerURL());
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ConnectionError("Cloud not connect to the server");
      } else {
        throw error;
      }
    }

    if (!response.ok) return [];

    try {
      json = await response.json();
    } catch {
      return [];
    }

    if (!json.links) return [];

    for(let link of json.links) {
      if (
        link.rel == "https://w3id.org/fep/3b86/Object" ||
        link.rel == "http://ostatus.org/schema/1.0/subscribe"
      ) {
        const result = {
          name: reference["fromRelsToMethodName"][link.rel],
          support: "yes",
          template: link.template
        };
        results.push(result);
      }
    }

    return results;
  }

  async fromMastodonAPIResponse() {
    let response;
    let json;
    let version;
    let support;
    const results = [];

    try {
      version = "v2";
      response = await fetch(this._URL.getMastodonAPIInstanceURL("v2"));

      if (!response.ok) {
        await delay(500);
        version ="v1";
        response = await fetch(this._URL.getMastodonAPIInstanceURL("v1"));
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ConnectionError("Cloud not connect to the server");
      } else {
        throw error;
      }
    }

    if (!response.ok) return;

    try {
      json = await response.json();
    } catch {
      return [];
    }

    if (version == "v2") {
      const mastodon_api = findKeyInOrder(json, "api_versions", "mastodon");
      const maybe_mastodon_api = Object.prototype.hasOwnProperty.call(json, "domain") &&
        Object.prototype.hasOwnProperty.call(json, "title") &&
        Object.prototype.hasOwnProperty.call(json, "version");

      if (mastodon_api) {
        support = "yes";
      } else if(maybe_mastodon_api) {
        support = "maybe";
      } else {
        return [];
      }

    } else {
      const maybe_mastodon_api = Object.prototype.hasOwnProperty.call(json, "uri") &&
      Object.prototype.hasOwnProperty.call(json, "title") &&
      Object.prototype.hasOwnProperty.call(json, "version");
      
      if(maybe_mastodon_api) {
        support = "maybe";
      } else {
        return [];
      }
    }

    const result = {
      name: "MastodonAPIV2Search",
      support: support,
      mstdn_ver_str: json.version
    }

    results.push(result);
    return results;
  }
}

async function _getOAuthServerMetadata(domain_str) {
  let json;

  let url = new GenURLFromDomain(domain_str);
  let response = await fetch( url.getOAuthServerMetadataURL(), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  if (response.ok) {
    try {
      json = await response.json();
    } catch {
      throw new Error("Failed to parse OAuth metadata");
    }
    return json;
  } else if (response.status == 404) {
    throw new NotFoundError("OAuth metadata not found");
  } else {
    throw new Error("Failed to fetch OAuth metadata");
  }
}

class Application {
  static appBasicInfo = {
    "client_name": "Feditch",
    "redirect_uris": this.getCallbackURL(),
    "scopes": "read:search",
    // "website": "https://app.example"
  }
  static getCallbackURL() {
    return browser.runtime.getURL("/options/callback.html");
  }
}

export class MastodonAPI {
  constructor(version_determines_behavior) {
    this.version = version_determines_behavior;
  }

  compareVersion(version_a_str, version_b_str) {
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

  validateOAuthServerMetadata(issuer, metadata) {
    let required_prop = [
      "issuer", "authorization_endpoint", "token_endpoint", "response_types_supported",
      "app_registration_endpoint", "revocation_endpoint", "userinfo_endpoint"
    ];
    const checked_prop = hasOwnPropertyAll(metadata, ...required_prop);
    if (!checked_prop) {
      throw new Error("OAuth metadata validation error");
    }

    const metadata_issuer = new URL(metadata.issuer).href;
    const valid_issuer = metadata.issuer.startsWith("https://") && metadata_issuer == issuer;
    if ( !valid_issuer ) {
      throw new Error("Validation of OAuth metadata issuer value failed.");
    }

    const is_valid_endpoints = metadata.authorization_endpoint.startsWith(metadata.issuer) &&
      metadata.token_endpoint.startsWith(metadata.issuer) &&
      metadata.app_registration_endpoint.startsWith(metadata.issuer) &&
      metadata.revocation_endpoint.startsWith(metadata.issuer) &&
      metadata.userinfo_endpoint.startsWith(metadata.issuer);
    if (!is_valid_endpoints) {
      throw new Error("OAuth metadata validation error");
    }

    return true;
  }

  async getOAuthServerMetadata(domain_str) {
    try {
      const url = new GenURLFromDomain(domain_str);
      let metadata = await _getOAuthServerMetadata(domain_str);
      if (this.validateOAuthServerMetadata(url.base, metadata)) {
        return metadata;
      }
    } catch {
      return {
        "issuer": `https://${domain_str}/`,
        "authorization_endpoint": `https://${domain_str}/oauth/authorize`,
        "token_endpoint": `https://${domain_str}/oauth/token`,
        "revocation_endpoint": `https://${domain_str}/oauth/revoke`,
        "userinfo_endpoint": `https://${domain_str}/oauth/userinfo`,
        "scopes_supported": [
          "read:search"
        ],
        "response_types_supported": [
          "code"
        ],
        "response_modes_supported": [
          "query",
          "fragment",
          "form_post"
        ],
        "grant_types_supported": [
          "authorization_code",
          "client_credentials"
        ],
        "token_endpoint_auth_methods_supported": [
          "client_secret_basic",
          "client_secret_post"
        ],
        "code_challenge_methods_supported": [
          "S256"
        ],
        "app_registration_endpoint": `https://${domain_str}/api/v1/apps`
      }
    }
  }

  async createOAuthApplication(oAuthMeta) {
    let response = await fetch(oAuthMeta.app_registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(Application.appBasicInfo)
    });
    if (response.ok) {
      const app = await response.json();
      return app;
    }
    throw new Error("Failed to create OAuth application");
  }

  authorizeUser(oAuthMeta, appdata, redirect_info_to_save, force_login=false) {
    let state_str = genRandomString();

    const url = new URL(oAuthMeta.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appdata.client_id);
    url.searchParams.set("redirect_uri", Application.getCallbackURL());
    url.searchParams.set("state", state_str);

    if (this.compareVersion(this.version, "2.4.3") == -1) {
      url.searchParams.set("scope", "read");
    } else {
      url.searchParams.set("scope", "read:search");
    }
    
    if (force_login && this.compareVersion(this.version, "2.6.0") >= 0) {
      url.searchParams.set("force_login", "true");
    }

    const tempState = {
      "oAuthMeta": oAuthMeta,
      "appdata": appdata,
      "redirect_uri": Application.getCallbackURL(),
      "state": state_str,
      "force_login": force_login,
      "redirect_info": redirect_info_to_save
    }
    manageTempState.save(tempState);
    
    window.location.href = url.href;
  }

  async obtainToken(oAuthMeta, appdata, code) {
    const form_data = {
      "grant_type": "authorization_code",
      "code": code,
      "client_id": appdata.client_id,
      "client_secret": appdata.client_secret,
      "redirect_uri": Application.getCallbackURL()
    }

    let response = await fetch(oAuthMeta.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(form_data)
    });

    const json = await response.json();

    if (!response.ok) {
      if (response.status == 400 || response.status == 401) {
        throw new Error(`obtainToken failed: ${json.error}`);
      } else {
        throw new Error(`obtainToken failed: HTTP ${response.status}`);
      }
    }
    
    return json;
  }

  async verifyToken(redirect) {
    const url = new GenURLFromDomain(redirect.domain);

    const response = await fetch(url.getMastodonAPIVerifyCredentialsURL(),
        {
          "headers": {
            "Authorization": `Bearer ${redirect.data.token_info.access_token}`
          }
        });

    if (response.ok) {
      return true;
    } else {
      return false;
    }
  }
}
