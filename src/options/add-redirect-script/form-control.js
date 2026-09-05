import { 
  manageRedirect, manageOAuthApp
 } from "../../lib/mylib/storage.js";
import { 
  RedirectMethodsDiscovery, MastodonAPI
 } from "../../lib/mylib/networkUtils.js";
import { moveAndShowPage, appendInfoOnCompletedScreen } from "./page-control.js";
import { delay } from "../../lib/mylib/timer.js";

class inputRegexpTools {
  constructor() {
    // Base domain check
    this._domain_reg = /^(?!\.)(?:(?!\.{2,}|[?#/@\s]).)+(?<!:)$/i;

    this._domain_from_url_reg = /^(?:https|http):\/\/((?:(?!\/).)+).*$/i;
    // Result Match Group 1 or Match Group2
    this._domain_from_acct_reg = /^(?:(?:acct:)@?.+@(.+)|(?:(?!\/).)+@((?:(?!\/).)+))$/i;
    
    this._domain_from_pathlike_reg = /^([^/\s@]+)\/(?:.*)$/i;
  }

  isValidDomain(domain_str) {
    if (domain_str.length >= 1024) {
      return false;
    }

    if (this._domain_from_url_reg.test(domain_str)) {
      domain_str = domain_str.match(this._domain_from_url_reg)[1];
    } else if (this._domain_from_acct_reg.test(domain_str)) {
      const match = domain_str.match(this._domain_from_acct_reg);
      domain_str = match[1] || match[2];
    }

    return this._domain_reg.test(domain_str);
  }

  extractDomainStr(domain_str) {
    if ( this._domain_from_url_reg.test(domain_str) ) {
      return domain_str.match(this._domain_from_url_reg)[1];
    } else if ( this._domain_from_acct_reg.test(domain_str) ) {
      const match = domain_str.match(this._domain_from_acct_reg);
      return match[1] || match[2];
    } else if ( this._domain_from_pathlike_reg.test(domain_str) ) {
      return domain_str.match(this._domain_from_pathlike_reg)[1];
    } else if ( this._domain_reg.test(domain_str) ) {
      return domain_str.match(this._domain_reg)[0];
    }
    return null;
  }
}

async function showAskPage(head_message, message, no_text="Cancel", yes_text="Confirm") {
  const head_msg_target_elem = document.getElementById("dialog-head-message");
  const msg_target_elem = document.getElementById("dialog-message");
  const no_elem = document.querySelector("[data-dialog-no]");
  const yes_elem = document.querySelector("[data-dialog-yes]");

  head_msg_target_elem.textContent = head_message;
  msg_target_elem.textContent = message;
  no_elem.textContent = no_text;
  yes_elem.textContent = yes_text;

  let no_handler;
  let yes_handler;
  let click_promise = new Promise((resolve) => {
    no_handler = () => { 
      resolve(false);
    };
    yes_handler = () => { 
      resolve(true);
    };
    no_elem.addEventListener("click", no_handler);
    yes_elem.addEventListener("click", yes_handler);
  });

  moveAndShowPage("dialog");

  const yes_or_no = await click_promise;

  no_elem.removeEventListener("click", no_handler);
  yes_elem.removeEventListener("click", yes_handler);

  moveAndShowPage("auto_form");
  return yes_or_no;
}

// class Form {

// }

async function isNameAlreadyExist(name_str) {
  const redirects = await manageRedirect.load();
  const find = redirects.find((redirect) => {
    if (redirect.name == name_str) {
      return true;
    }
    return false;
  });
  if (find) return true;
  else return false;
}

export class AutoForm {
  constructor() {
    this.regTools = new inputRegexpTools();

    this.auto_form_card = document.getElementById("auto_form_card");
    this.auto_form_add_btn = document.getElementById("auto_form_add_btn");

    this.form_elem = document.getElementById("auto_form_input");
    this.form_error_elem = document.getElementById("submit-error");

    this.name_input_elem = this.form_elem.elements.name;
    this.name_error_elem = document.getElementById("name-error");

    this.domain_input_elem = this.form_elem.elements.domain;
    this.domain_error_elem = document.getElementById("domain-error");

    this._watchSubmit();
    this._watchInput();
  }

  _validateDomainInput() {
    if( !this.regTools.isValidDomain(this.domain_input_elem.value) ) {
      this.domain_input_elem.setCustomValidity("Invalid domain");
      return;
    }
    this.domain_input_elem.setCustomValidity("");
  }

  async _processAddRedirect() {
    const name_input = this.form_elem.elements.name.value;
    const domain_input = this.form_elem.elements.domain.value;
    const success = true;
    const failed = false;
    let backup_options = [];
    let results;

    const name_exist = await isNameAlreadyExist(name_input);
    if(name_exist) {
      throw new Error("This name already exists");
    }

    let domain_str = this.regTools.extractDomainStr(domain_input);

    if(!domain_str) {
      return failed;
    }

    const discovery = new RedirectMethodsDiscovery(domain_str);

    results = await discovery.fromServerPrefixWebfinger();
    for (let result of results) {
      if (result.name == "ActivityIntentsObject" && result.support == "yes") {
        const entry_to_save = {
          name: name_input,
          domain: domain_str,
          method: "ActivityIntentsObject",
          data: {
            method: "ActivityIntentsObject",
            template: result.template
          }
        };
        await manageRedirect.save(entry_to_save);
        appendInfoOnCompletedScreen(
          name_input,
          domain_str,
          "ActivityIntentsObject"
        );
        moveAndShowPage("completed");

        return success;
      } else if (result.name == "Ostatus1.0Subscribe" && result.support == "yes") {
        backup_options.push(result);
      }
    }

    await delay(500);
    results = await discovery.fromMastodonAPIResponse();

    let result = results[0];
    let auth_mastodon_confirmed = false;
    if ( result.name == "MastodonAPIV2Search" && 
      (result.support == "yes" || result.support == "maybe")
    ) {
      auth_mastodon_confirmed = await showAskPage(
        "Maybe Mastodon API?",
        "Will you be using the Mastodon API? Authentication is required.",
        "Cancel",
        "Authenticate"
      );
    }

    if ( auth_mastodon_confirmed ) {
      const mastodonAPI = new MastodonAPI(result.mstdn_ver_str);
      
      let appdata = undefined;
      const app_exist = await manageOAuthApp.exist(domain_str);

      if (app_exist) {
        appdata = await manageOAuthApp.load(domain_str);
      }

      let oAuthMeta = await mastodonAPI.getOAuthServerMetadata(domain_str);

      if (!appdata) {
        await delay(500);
        const createdApp = await mastodonAPI.createOAuthApplication(oAuthMeta);
        appdata = {
          "domain": domain_str,
          "id": createdApp["id"],
          "scopes": createdApp["scopes"],
          "client_id": createdApp["client_id"],
          "client_secret": createdApp["client_secret"],
          "client_secret_expires_at": createdApp["client_secret_expires_at"]
        };
        await manageOAuthApp.save(domain_str, appdata);
      }

      const redirect_info = {
        "name": name_input,
        "domain": domain_str,
        "method": "MastodonAPIV2Search",
        "data": {
          "version_string": result.mstdn_ver_str
        }
      }


      await delay(200);
      mastodonAPI.authorizeUser(oAuthMeta, appdata, redirect_info);
    }
    
    console.log("after discover");
  }

  _watchInput() {
    this._setupInputValidation(
      this.name_input_elem,
      this.name_error_elem);
    this._setupInputValidation(
      this.domain_input_elem, 
      this.domain_error_elem, 
      this._validateDomainInput
    );
    this._setupFocusInputEvent(this.name_input_elem);
    this._setupFocusInputEvent(this.domain_input_elem);
  }

  _setupFocusInputEvent(input_elem) {
    const removeFormErrorMessage = () => {
      this.form_error_elem.dataset.errorMsg = "false";
    }

    input_elem.addEventListener("focus", () => {
      removeFormErrorMessage();
    })
  }

  _setupInputValidation(input_elem, error_msg_elem, customValidationHandler) {
    const setErrorMessage = () => {
      error_msg_elem.textContent = `${input_elem.validationMessage}`;
    };

    const customValidation = (validationHandler) => {
      if (typeof validationHandler === "function") {
        validationHandler.call(this);
      }
    }

    input_elem.addEventListener("input", () => {
      customValidation(customValidationHandler);
      setErrorMessage();
    });
  }

  _watchSubmit() {
    this.form_elem.addEventListener("submit", async (event) => {
      event.preventDefault();

      this.form_error_elem.dataset.errorMsg = "false";
      this.auto_form_card.ariaBusy = "true";
      this.auto_form_add_btn.setAttribute("disabled", "true");
      try {
        await this._processAddRedirect();
      } catch (error) {
        this.form_error_elem.textContent = `${error}`
        this.form_error_elem.dataset.errorMsg = "true";
        console.log("process add redirect error");
      } finally {
        this.auto_form_card.ariaBusy = "false";
        this.auto_form_add_btn.removeAttribute("disabled");
      }
    });

    this.form_elem.addEventListener("keydown", (event) => {
      if (!event.target.nodeName == "INPUT") return;

      if (event.key == "Enter") {
        event.preventDefault();
      }
    });
  }
}

export class ManualForm {
  constructor() {
    appendInfoOnCompletedScreen("name", "example.com", "api");
  }
}
