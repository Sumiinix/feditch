import { manageRedirect } from "../../lib/mylib/storage.js";
import { RedirectMethodsDiscovery } from "../../lib/mylib/networkUtils.js";
import { moveAndShowPage, appendInfoOnCompletedScreen } from "./page-control.js";
import { delay } from "../../lib/mylib/timer.js";

const inputRegexp = {
  // Base domain check
  _domain_reg: /^(?!\.)(?:(?!\.{2,}|[?#/@\s]).)+(?<!:)$/i,

  _domain_from_url_reg: /^(?:https|http):\/\/((?:(?!\/).)+).*$/i,
  // Result Match Group 1 or Match Group2
  _domain_from_acct_reg: /^(?:(?:acct:)@?.+@(.+)|(?:(?!\/).)+@((?:(?!\/).)+))$/i,
  
  _domain_from_pathlike_reg : /^([^/\s@]+)\/(?:.*)$/i,

  _username_reg : /^(?:acct:)(.+)@.+|@?((?:(?!\/).)+)@(?:(?!\/).)+$/i,
}

// async function showAskPage(head_message, message, no_text="Cancel", yes_text="Confirm") {
//   const head_msg_target_elem = document.getElementById("dialog-head-message");
//   const msg_target_elem = document.getElementById("dialog-message");
//   const no_elem = document.querySelector("[data-dialog-no]");
//   const yes_elem = document.querySelector("[data-dialog-yes]");

//   head_msg_target_elem.textContent = head_message;
//   msg_target_elem.textContent = message;
//   no_elem.textContent = no_text;
//   yes_elem.textContent = yes_text;

//   let no_handler;
//   let yes_handler;
//   let click_promise = new Promise((resolve) => {
//     no_handler = () => { 
//       resolve(false);
//     };
//     yes_handler = () => { 
//       resolve(true);
//     };
//     no_elem.addEventListener("click", no_handler);
//     yes_elem.addEventListener("click", yes_handler);
//   });

//   moveAndShowPage("dialog");

//   const yes_or_no = await click_promise;

//   no_elem.removeEventListener("click", no_handler);
//   yes_elem.removeEventListener("click", yes_handler);

//   moveAndShowPage("auto_form");
//   return yes_or_no;
// }

class ProcessAddRedirect {
  constructor(
    redirect_name, domain, user_name
  ) {
    this.data = {
      name: redirect_name,
      method: "",
      redirect_info: {
        domain: domain,
      },
      user_name: user_name
    }
    this.discovery;
  }

  _newDiscovery(domain) {
    this.discovery = new RedirectMethodsDiscovery(domain);
    return this.discovery;
  }

  _setDataFromResult(method) {
    const data = this.data;
    const redirect_info = this.data.redirect_info;

    switch (method) {
      case "ActivityIntentsObject":
        data.method = method;
        redirect_info.template = this.discovery.result[method].template;
        break;
    
      case "Ostatus1.0Subscribe":
        data.method = method;
        redirect_info.template = this.discovery.result[method].template;
        break;

      default:
        break;
    }
  }

  async save() {
    const entry = {
      name: this.data.name,
      method: this.data.method,
      redirect_info: this.data.redirect_info };
    await manageRedirect.save(entry);
  }
  
  async discoverMethodFromDomain(asyncUsernameAsker) {
    const domain = this.data.redirect_info.domain;
    const discovery = this._newDiscovery(domain);

    let found = await discovery.fromServerPrefixWebfinger();

    if (found.length == 0) {
      await delay(500);
      found = await discovery.fromApplicationWebfinger();
    }

    if (found.length == 0) {
      if (!this.data.user_name && (typeof asyncUsernameAsker === "function") ) {
        this.data.user_name = await asyncUsernameAsker();
      }
      
      if (this.data.user_name) {
        await delay(500);
        found = await discovery.fromHandleWebfinger(this.data.user_name);
      }
    }

    if (found.length > 0) {
      const method = discovery.getTopMethodFound();
      this._setDataFromResult(method);
      return true;
    }
    return false;
  }

  async discoverActivityIntent() {
    const domain = this.data.redirect_info.domain;
    const discovery = this._newDiscovery(domain);

    await discovery.fromServerPrefixWebfinger();

    if (discovery.result["ActivityIntentsObject"].detect == "yes") {
      this._setDataFromResult("ActivityIntentsObject");
      return true;
    } else {
      return false;
    }
  }

  async discoverOstatusSubscribe(asyncUsernameAsker) {
    const domain = this.data.redirect_info.domain;
    const discovery = this._newDiscovery(domain);

    let found = await discovery.fromApplicationWebfinger();

    if (found.length == 0) {
      if (!this.data.user_name && (typeof asyncUsernameAsker === "function") ) {
        this.data.user_name = await asyncUsernameAsker();
      }
      
      if (this.data.user_name) {
        await delay(500);
        await discovery.fromHandleWebfinger(this.data.user_name);
      }
    }

    if (discovery.result["Ostatus1.0Subscribe"].detect == "yes") {
      this._setDataFromResult("Ostatus1.0Subscribe");
      return true;
    } else {
      return false;
    }
  }
}

const Form = {
  async isNameAlreadyExist(name_input) {
    const redirects = await manageRedirect.load();
    const find = redirects.find((redirect) => {
      if (redirect.name == name_input) {
        return true;
      }
      return false;
    });
    if (find) return true;
    else return false;
  },

  async askUsername(domain_str, prev_page) {
    const username_form = document.getElementById("username_form");
    const username_elem = username_form.elements.username;
    const domain_elem = username_form.elements.domain;

    const no_elem = document.querySelector("[data-page=dialog-username] [data-dialog-no]");
    const yes_elem = document.querySelector("[data-page=dialog-username] [data-dialog-yes]");
    let username;

    domain_elem.setAttribute("value", `@${domain_str}`);

    let no_handler;
    let yes_handler;
    let click_promise = new Promise((resolve) => {
      no_handler = () => {
        resolve(null);
      };
      yes_handler = () => {
        resolve(username_elem.value);
      };
      no_elem.addEventListener("click", no_handler);
      yes_elem.addEventListener("click", yes_handler);
    });

    moveAndShowPage("dialog-username");

    username = await click_promise;

    no_elem.removeEventListener("click", no_handler);
    yes_elem.removeEventListener("click", yes_handler);

    moveAndShowPage(prev_page);
    return username;
  },

  validateDomain(elem) {
    if( !Form.isValidDomain(elem.value) ) {
      elem.setCustomValidity("Invalid domain");
      return;
    }
    elem.setCustomValidity("");
  },

  isValidDomain(domain_str) {
    if (domain_str.length >= 1024) {
      return false;
    }

    if (inputRegexp._domain_from_url_reg.test(domain_str)) {
      domain_str = domain_str.match(inputRegexp._domain_from_url_reg)[1];
    } else if (inputRegexp._domain_from_acct_reg.test(domain_str)) {
      const match = domain_str.match(inputRegexp._domain_from_acct_reg);
      domain_str = match[1] || match[2];
    }

    return inputRegexp._domain_reg.test(domain_str);
  },

  extractDomainStr(domain_str) {
    if ( inputRegexp._domain_from_url_reg.test(domain_str) ) {
      return domain_str.match(inputRegexp._domain_from_url_reg)[1];
    } else if ( inputRegexp._domain_from_acct_reg.test(domain_str) ) {
      const match = domain_str.match(inputRegexp._domain_from_acct_reg);
      return match[1] || match[2];
    } else if ( inputRegexp._domain_from_pathlike_reg.test(domain_str) ) {
      return domain_str.match(inputRegexp._domain_from_pathlike_reg)[1];
    } else if ( inputRegexp._domain_reg.test(domain_str) ) {
      return domain_str.match(inputRegexp._domain_reg)[0];
    }
    return null;
  },

  extractUserStr(string) {
     if ( inputRegexp._username_reg.test(string) ) {
      const match = string.match(inputRegexp._username_reg);
      return match[1] || match[2];
    } 
    return null;
  }
}

export const AutoForm = {
  setup() {
    const form_elem = document.getElementById("auto_form_elem");

    this.elems = {
      card: document.getElementById("auto_form_card"),
      form: form_elem,
      form_error: document.getElementById("auto_form_error"),
      name_input: form_elem.elements.name,
      name_error: document.getElementById("auto_form_error_name"),
      domain_input: form_elem.elements.domain,
      domain_error: document.getElementById("auto_form_domain_error"),
      select_method: form_elem.elements.select_method,
      select_method_field: form_elem.elements.select_method_field,
      add_button: document.getElementById("auto_form_add_btn")
    }
    this._eventListener();
  },

  _eventListener() {
    const addRedirectAction = async (event) => {
      event.preventDefault();

      this.elems.form_error.dataset.errorMsg = "false";
      this.elems.card.setAttribute("aria-busy", "true");
      this.elems.add_button.setAttribute("disabled", "true");

      try {
        const success = await this._processAddRedirect();
        if (!success) {
          throw new Error("No redirect method was found.");
        }
      } catch (error) {
        this.elems.form_error.textContent = `${error}`;
        this.elems.form_error.dataset.errorMsg = "true";
        console.log(`${error}`);
      } finally {
        this.elems.card.setAttribute("aria-busy", "false");
        this.elems.add_button.removeAttribute("disabled");
      }
    };

    const preventEnterKeyInInput = (event) => {
      if ( !(event.target.nodeName == "INPUT") ) return;

      if (event.key == "Enter") {
        event.preventDefault();
      }
    };

    this._setupTextInput(this.elems.name_input, this.elems.name_error);
    this._setupTextInput(this.elems.domain_input, this.elems.domain_error, Form.validateDomain);

    this.elems.form.addEventListener("submit", addRedirectAction);
    this.elems.form.addEventListener("keydown", preventEnterKeyInInput);
  },

  _setupTextInput(input_elem, error_elem, customValidationHandler) {
    const removeFormErrorMsg = () => {
      this.elems.form_error.dataset.errorMsg = "false";
    }

    const setErrorMessage = () => {
      error_elem.textContent = `${input_elem.validationMessage}`;
    };

    const handleInput = (event) => {
      if (typeof customValidationHandler === "function") {
        customValidationHandler.call(this, event.target);
      }
      setErrorMessage();
    }

    input_elem.addEventListener("input", handleInput);
    input_elem.addEventListener("focus", removeFormErrorMsg);
  },

  async _processAddRedirect() {
    const name_input = this.elems.name_input.value;
    const domain_input = this.elems.domain_input.value;
    
    const name_exist = await Form.isNameAlreadyExist(name_input);
    if(name_exist) {
      throw new Error("This name already exists");
    }

    let extracetee_domain = Form.extractDomainStr(domain_input);
    if(!extracetee_domain) {
      return false;
    }

    let extracted_username = Form.extractUserStr(domain_input);
    const ask_username = async () => await Form.askUsername(extracetee_domain, "auto_form");

    const redirect = new ProcessAddRedirect(name_input, extracetee_domain, extracted_username);
    let found = await redirect.discoverMethodFromDomain(ask_username);

    if (found) {
      await redirect.save();
      appendInfoOnCompletedScreen(redirect.data.name, redirect.data.redirect_info.domain);
      moveAndShowPage("completed");
      return true;
    }

    console.log("_processAddRedirect end");
    return false;
  }
}

export const ManualForm = {
  setup() {
    const form_elem = document.getElementById("manual_form_elem");

    this.elems = {
      card: document.getElementById("manual_form_card"),
      form: form_elem,
      form_error: document.getElementById("manual_form_error"),
      name_input: form_elem.elements.name,
      name_error: document.getElementById("manual_form_error_name"),
      template_input: form_elem.elements.template,
      template_error: document.getElementById("manual_form_template_error"),
      domain_input: form_elem.elements.domain,
      domain_error: document.getElementById("manual_form_domain_error"),
      select_method: form_elem.elements.select_method,
      add_button: document.getElementById("manual_form_add_btn")
    }

    this.toggleInputs(this.elems.select_method.value);
    this._eventListener();
  },

  _eventListener() {
    const addRedirectAction = async (event) => {
      event.preventDefault();

      this.elems.form_error.dataset.errorMsg = "false";
      this.elems.card.setAttribute("aria-busy", "true");
      this.elems.add_button.setAttribute("disabled", "true");

      try {
        const success = await this._processAddRedirect();
        if (!success) {
          throw new Error("Failed to add redirect.");
        }
      } catch (error) {
        this.elems.form_error.textContent = `${error}`;
        this.elems.form_error.dataset.errorMsg = "true";
        console.log(`${error}`);
      } finally {
        // await delay(1000);
        this.elems.card.setAttribute("aria-busy", "false");
        this.elems.add_button.removeAttribute("disabled");
      }
    };

    const preventEnterKeyInInput = (event) => {
      if ( !(event.target.nodeName == "INPUT") ) return;

      if (event.key == "Enter") {
        event.preventDefault();
      }
    };

    const toggleInputElemHandler = (event) => {
      this.toggleInputs(event.target.value);
    };

    this._setupTextInput(this.elems.name_input, this.elems.name_error);

    this.elems.form.addEventListener("submit", addRedirectAction);
    this.elems.form.addEventListener("keydown", preventEnterKeyInInput);
    this.elems.select_method.addEventListener("change", toggleInputElemHandler);
  },

  _setupTextInput(input_elem, error_elem, customValidationHandler) {
    const removeFormErrorMsg = () => {
      this.elems.form_error.dataset.errorMsg = "false";
    }

    const setErrorMessage = () => {
      error_elem.textContent = `${input_elem.validationMessage}`;
    };

    const handleInput = (event) => {
      if (typeof customValidationHandler === "function") {
        customValidationHandler.call(this, event.target);
      }
      setErrorMessage();
    }

    input_elem.addEventListener("input", handleInput);
    input_elem.addEventListener("focus", removeFormErrorMsg);
  },

  async _processAddRedirect() {
    const selected_method = this.elems.select_method.value;
    const name_input = this.elems.name_input.value;
    const domain_input = this.elems.domain_input.value;

    const name_exist = await Form.isNameAlreadyExist(name_input);
    if(name_exist) {
      throw new Error("This name already exists");
    }

    let redirect = new ProcessAddRedirect(name_input);

    let success;
    let success_info = [name_input];
    switch (selected_method) {
      case "ActivityIntentsObject": {
        let extracted_domain = Form.extractDomainStr(domain_input);
        if(!extracted_domain) {
          return false;
        }
        redirect.data.redirect_info.domain = extracted_domain;
        success = await redirect.discoverActivityIntent();
        success_info.push(extracted_domain);
        break;
      }

      case "Ostatus1.0Subscribe": {
        let extracted_domain = Form.extractDomainStr(domain_input);
        if(!extracted_domain) {
          return false;
        }
        redirect.data.redirect_info.domain = extracted_domain;
        let extracted_username = Form.extractUserStr(domain_input);
        redirect.data.user_name = extracted_username;
        const ask_username = async () => await Form.askUsername(extracted_domain, "manual_form");
        success = await redirect.discoverOstatusSubscribe(ask_username);
        success_info.push(extracted_domain);
        break;
      }

      default:
        throw new Error("Unknown method");
    }

    if (success) {
      await redirect.save();
      appendInfoOnCompletedScreen(...success_info);
      moveAndShowPage("completed");
      return true;
    }

    return false;
  },

  toggleInputs(method) {
    const input_fields = document.getElementById("manual_form_select_method_field");

    let last;
    while (true) {
      last = input_fields.lastChild
      if (!last) {
        break;
      }
      input_fields.removeChild(last);
    }

    if (method == "URLTemplate") {
      const temp = document.createElement('template');
      temp.innerHTML = 
          `<label data-input-toggle="template" data-field>
            Template *
            <input name="template" type="text" 
                placeholder="https://example.com/search?query={id}" 
                autocomplete="off" maxlength="10000" required />
            <div id="manual_form_template_error" class="error-msg"></div>
          </label>`;
      const input_elem = temp.content.firstChild;
      input_fields.append(input_elem);

      this.elems.template_label = input_elem;
      this.elems.template_input = this.elems.form.elements.template;
      this.elems.template_error = document.getElementById("manual_form_template_error");

      this._setupTextInput(this.elems.template_input, this.elems.template_error);
    }

    if (method == "ActivityIntentsObject" ||
        method == "Ostatus1.0Subscribe"
    ){
      const temp = document.createElement('template');
      temp.innerHTML = 
          `<label data-input-toggle="domain" data-field>
            Domain *
            <input name="domain" type="text" placeholder="example.com" autocomplete="off"
                maxlength="10000" required />
            <div id="manual_form_domain_error" class="error-msg"></div>
          </label>`;
      let input_elem = temp.content.firstChild;
      input_fields.append(input_elem);

      this.elems.domain_label = input_elem;
      this.elems.domain_input = this.elems.form.elements.domain;
      this.elems.domain_error = document.getElementById("manual_form_domain_error");
      
      this._setupTextInput(this.elems.domain_input, this.elems.domain_error, Form.validateDomain);
    }
  }
}
