import { manageRedirect } from "../../lib/mylib/storage.js";

(async () => {
  const href = new URL(window.location.href);
  let editIndex = href.searchParams.get("editIndex");
  const form = document.getElementById("edit-form-elem");
  const errorName = document.getElementById("manual-form-error-name");

  let redirects = await manageRedirect.load();
  const redirect = redirects[editIndex];

  const editRedirectAction = async (event) => {
    event.preventDefault();

    const name = event.target.elements.name.value;
    
    redirect.name = name;
    try {
      await manageRedirect.edit(editIndex, redirect);

      if (window.parent.closePopup) {
        window.parent.closePopup();
      } else {
        const optionsPath = location.origin + "/options/manage.html"
        window.location.href = optionsPath;
      }
    } catch (error) {
      errorName.textContent = error;
      errorName.dataset.errorMsg = "true";
    }
  };

  const preventEnterKeyInInput = (event) => {
    if ( !(event.target.nodeName == "INPUT") ) return;

    if (event.key == "Enter") {
      event.preventDefault();
    }
  };

  form.addEventListener("submit", editRedirectAction);
  form.addEventListener("keydown", preventEnterKeyInInput);

  form.elements.name.value = redirect.name;

  const backElem = document.querySelector("[data-to-page=add_redirect]");
  backElem.addEventListener("click", () => {
    window.history.back();
  });
})();