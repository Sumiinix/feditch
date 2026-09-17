import { manageRedirect } from "../../lib/mylib/storage.js";

(async () => {
  const href = new URL(window.location.href);
  let edit_index = href.searchParams.get("editIndex");
  const form = document.getElementById("edit_form_elem");
  const error_name = document.getElementById("manual_form_error_name");

  let redirects = await manageRedirect.load();
  const redirect = redirects[edit_index];

  const editRedirectAction = async (event) => {
    event.preventDefault();

    const name = event.target.elements.name.value;
    
    redirect.name = name;
    try {
      await manageRedirect.edit(edit_index, redirect);

      if (window.parent.closePopup) {
        window.parent.closePopup();
      } else {
        const options_path = location.origin + "/options/manage.html"
        window.location.href = options_path;
      }
    } catch (error) {
      error_name.textContent = error;
      error_name.dataset.errorMsg = "true";
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

  const back_elem = document.querySelector("[data-to-page=add_redirect]");
  back_elem.addEventListener("click", () => {
    window.parent.closePopup();
  });
})();