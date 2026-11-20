import { manageRedirect } from "../../lib/mylib/storage.js";
import { RedirectMethodsDiscovery } from "../../lib/mylib/networkUtils.js";
import { showPage, appendInfoOnCompletedScreen } from "./add-redirect.js";
import { delay } from "../../lib/mylib/timer.js";
import UriTemplate from "../../lib/uri-templates/uri-templates.mjs";

class AddRedirectProcessor {
  constructor(
    redirect_name, domain, user_name
  ) {
    this.data = {
      name: redirect_name,
      domain: domain,
      methods: [],
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

    switch (method) {
      case "ActivityIntentsObject":
        data.methods.push({
          name: method,
          template: this.discovery.result[method].template
        });
        break;
      case "Ostatus1.0Subscribe":
        data.methods.push({
          name: method,
          template: this.discovery.result[method].template
        });
        break;
      default:
        break;
    }
  }

  async save() {
    const entry = {
      name: this.data.name,
      domain: this.data.domain,
      methods: this.data.methods };
    await manageRedirect.save(entry);
  }
  
  async discoverMethodFromDomain(domain, asyncUsernameAsker) {
    this.data.domain = domain;
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

  async discoverActivityIntent(domain) {
    this.data.domain = domain;
    const discovery = this._newDiscovery(domain);

    await discovery.fromServerPrefixWebfinger();

    if (discovery.result["ActivityIntentsObject"].detect == "yes") {
      this._setDataFromResult("ActivityIntentsObject");
      return true;
    } else {
      return false;
    }
  }

  async discoverOstatusSubscribe(domain, asyncUsernameAsker) {
    this.data.domain = domain;
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

  setTemplateMethod(templateStr) {
    if (!templateStr.includes("{id}")) {
      throw new Error('"{id}" is not included in template string.');
    }

    if (!templateStr.includes("://")) {
      throw new Error('Invalid URL');
    }

    // Try
    new UriTemplate(templateStr).fill({id: "https://example.com"});

    this.data.domain = null;
    this.data.methods.push({
      name: "URLTemplate",
      template: templateStr
    });
    return true;
  }
}

const regexp = {
  // Check domain valid
  "domain": /^(?!\.)(?:(?!\.{2,}|[?#/@\s]).)+(?<!:)$/i,
  "domainFromURL": /^(?:https|http):\/\/((?:(?!\/).)+).*$/i,
  // Result Match Group 1 or Match Group2
  "domainFromAcct": /^(?:(?:acct:)@?.+@(.+)|(?:(?!\/).)+@((?:(?!\/).)+))$/i,
  "domainFromPathlike": /^([^/\s@]+)\/(?:.*)$/i,
  "username" : /^(?:acct:)(.+)@.+|@?((?:(?!\/).)+)@(?:(?!\/).)+$/i,
};

async function isNameAlreadyExist(name_input) {
  const redirects = await manageRedirect.load();
  const find = redirects.find((redirect) => {
    if (redirect.name == name_input) {
      return true;
    }
    return false;
  });
  if (find) return true;
  else return false;
}

async function askUsername(domain_str, prev_page) {
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

  showPage("dialog-username");

  username = await click_promise;

  no_elem.removeEventListener("click", no_handler);
  yes_elem.removeEventListener("click", yes_handler);

  showPage(prev_page);
  return username;
}

function validateDomain(elem) {
  if( !isValidDomain(elem.value) ) {
    elem.setCustomValidity("Invalid domain");
    return;
  }
  elem.setCustomValidity("");
}

function isValidDomain(domain_str) {
  if (domain_str.length >= 1024) {
    return false;
  }

  if (regexp["domainFromURL"].test(domain_str)) {
    domain_str = domain_str.match(regexp["domainFromURL"])[1];
  } else if (regexp["domainFromAcct"].test(domain_str)) {
    const match = domain_str.match(regexp["domainFromAcct"]);
    domain_str = match[1] || match[2];
  }

  return regexp["domain"].test(domain_str);
}

function extractDomainStr(domain_str) {
  if ( regexp["domainFromURL"].test(domain_str) ) {
    return domain_str.match(regexp["domainFromURL"])[1];
  } else if ( regexp["domainFromAcct"].test(domain_str) ) {
    const match = domain_str.match(regexp["domainFromAcct"]);
    return match[1] || match[2];
  } else if ( regexp["domainFromPathlike"].test(domain_str) ) {
    return domain_str.match(regexp["domainFromPathlike"])[1];
  } else if ( regexp["domain"].test(domain_str) ) {
    return domain_str.match(regexp["domain"])[0];
  }
  return null;
}

function extractUserStr(string) {
    if ( regexp["username"].test(string) ) {
    const match = string.match(regexp["username"]);
    return match[1] || match[2];
  } 
  return null;
}

class AddRedirectForm {
  constructor(context) {
    this._elems = context["elements"];

    if (context["options"]["preventSubmitByEnter"]) {
      this._elems.form.addEventListener("keydown", (event) => {
        if ( !(event.target.nodeName == "INPUT") ) return;

        if (event.key == "Enter") {
          event.preventDefault();
        }
      });
    }

    if (context["submitHandler"]) {
      this._elems.form.addEventListener("submit", async (event) => {
        event.preventDefault();
        this.busy(true);
        await context["submitHandler"](event);
        // await delay(1000); // Debug
        this.busy(false);
      });
    }
  }

  busy(state) {
    if (state) {
      this._elems.submitBtn.setAttribute("disabled", "true");
      this._elems.busyVisual.setAttribute("aria-busy", "true");
    } else {
      this._elems.submitBtn.removeAttribute("disabled");
      this._elems.busyVisual.setAttribute("aria-busy", "false");
    }
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
    this._setupTextInput(this.elems.domain_input, this.elems.domain_error, validateDomain);

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
    
    const name_exist = await isNameAlreadyExist(name_input);
    if(name_exist) {
      throw new Error("This name already exists");
    }

    let extractedDomain = extractDomainStr(domain_input);
    if(!extractedDomain) {
      return false;
    }

    let extracted_username = extractUserStr(domain_input);
    const ask_username = async () => await askUsername(extractedDomain, "auto_form");

    const redirect = new AddRedirectProcessor(name_input, extractedDomain, extracted_username);
    let found = await redirect.discoverMethodFromDomain(ask_username);

    if (found) {
      await redirect.save();
      appendInfoOnCompletedScreen(redirect.data.name);
      showPage("completed");
      return true;
    }

    console.log("_processAddRedirect end");
    return false;
  }
}

export const manualForm = {
  setup() {
    const formElem = document.getElementById("manual_form_elem");

    this.elems = {
      busyVisual: document.getElementById("manual_form_card"),
      form: formElem,
      formErr: document.getElementById("manual_form_error"),
      submitBtn: document.getElementById("manual_form_add_btn"),
      inputs: {
        name: formElem.elements.name,
        nameErr: document.getElementById("manual_form_error_name"),
        template: formElem.elements.template,
        templateErr: document.getElementById("manual_form_template_error"),
        domain: formElem.elements.domain,
        domainErr: document.getElementById("manual_form_domain_error"),
        methodSelect: formElem.elements.methodSelect
      }
    }

    this.toggleInputs(this.elems["inputs"]["methodSelect"].value);
    this._setupTextInput(this.elems["inputs"]["name"], this.elems["inputs"]["nameErr"]);
    this.elems["inputs"]["methodSelect"].addEventListener("change", (event) => {
      this.toggleInputs(event.target.value);
    });

    const context = {
      "elements": this.elems,
      "options": {
        "preventSubmitByEnter": true
      },
      "submitHandler": this.submitHandler.bind(this)
    };

    this.newForm = new AddRedirectForm(context);
  },

  async submitHandler() {
    this.elems["formErr"].dataset.errorMsg = "false";

    try {
      const success = await this._processAddRedirect();
      if (!success) {
        throw new Error("Failed to add redirect.");
      }
    } catch (error) {
      this.elems["formErr"].textContent = `${error}`;
      this.elems["formErr"].dataset.errorMsg = "true";
      console.log(`${error}`);
    }
  },

  _setupTextInput(inputElem, errorElem, customValidationHandler) {
    const removeFormErrorMsg = () => {
      this.elems["formErr"].dataset.errorMsg = "false";
    }

    const setErrorMessage = () => {
      errorElem.textContent = `${inputElem.validationMessage}`;
    };

    const handleInput = (event) => {
      if (typeof customValidationHandler === "function") {
        customValidationHandler.call(this, event.target);
      }
      setErrorMessage();
    }

    inputElem.addEventListener("input", handleInput);
    inputElem.addEventListener("focus", removeFormErrorMsg);
  },

  async _processAddRedirect() {
    const nameInput = this.elems["inputs"]["name"].value;
    const selectedMethod = this.elems["inputs"]["methodSelect"].value;
    const nameExist = await isNameAlreadyExist(nameInput);

    if(nameExist) {
      throw new Error("This name already exists");
    }

    let redirect = new AddRedirectProcessor(nameInput);

    let success;
    let successInfo = [nameInput];
    switch (selectedMethod) {
      case "ActivityIntentsObject": {
        const domainInput = this.elems["inputs"]["domain"].value;
        let extractedDomain = extractDomainStr(domainInput);
        if(!extractedDomain) {
          return false;
        }
        success = await redirect.discoverActivityIntent(extractedDomain);
        // successInfo.push(extractedDomain);
        break;
      }

      case "Ostatus1.0Subscribe": {
        const domainInput = this.elems["inputs"]["domain"].value;
        let extractedDomain = extractDomainStr(domainInput);
        if(!extractedDomain) {
          return false;
        }
        let extractedUsername = extractUserStr(domainInput);
        redirect.data["user_name"] = extractedUsername;
        const askUsernameHandler = async () => await askUsername(extractedDomain, "manual_form");
        success = await redirect.discoverOstatusSubscribe(askUsernameHandler);
        // successInfo.push(extractedDomain);
        break;
      }

      case "URLTemplate": {
        const templateInput = this.elems["inputs"]["template"].value;
        success = redirect.setTemplateMethod(templateInput);
        break;
      }

      default:
        throw new Error("Unknown method");
    }

    if (success) {
      await redirect.save();
      appendInfoOnCompletedScreen(...successInfo);
      showPage("completed");
      return true;
    }

    return false;
  },

  toggleInputs(method) {
    const inputFields = document.getElementById("manual_form_select_method_field");

    let last;
    while (true) {
      last = inputFields.lastChild
      if (!last) {
        break;
      }
      inputFields.removeChild(last);
    }

    if (method == "URLTemplate") {
      const temp = document.createElement('template');
      temp.innerHTML = 
          `<label data-input-toggle="template" data-field>
            Template *
            <input name="template" type="text" 
                placeholder="https://example.com/search?query={id}" 
                value="https://example.com/search?query={id}"
                autocomplete="off" maxlength="10000" required />
            <div id="manual_form_template_error" class="error-msg"></div>
          </label>`;
      const inputElem = temp.content.firstChild;
      inputFields.append(inputElem);

      this.elems["inputs"]["template"] = this.elems.form.elements.template;
      this.elems["inputs"]["templateErr"] = document.getElementById("manual_form_template_error");

      this._setupTextInput(this.elems["inputs"]["template"], this.elems["inputs"]["templateErr"]);
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
      const inputElem = temp.content.firstChild;
      inputFields.append(inputElem);

      this.elems["inputs"]["domain"] = this.elems.form.elements.domain;
      this.elems["inputs"]["domainErr"] = document.getElementById("manual_form_domain_error");
      
      this._setupTextInput(
        this.elems["inputs"]["domain"], this.elems["inputs"]["domainErr"], validateDomain
      );
    }
  }
}
