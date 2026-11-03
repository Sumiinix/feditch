import { showPageFromState, moveAndShowPage, closeOwnPopupOrTab } from "./add-redirect-page.js";
import { AutoForm, ManualForm } from "./add-redirect-form.js";

function watchButtons() {
  const nav_buttons = document.querySelectorAll("button[data-to-page]");
  for (let button of nav_buttons) {
    button.addEventListener("click", (event) => {
      moveAndShowPage(event.target.dataset.toPage);
    });
  }

  const complete_button = document.querySelectorAll("[data-close]");
  for (let button of complete_button) {
    button.addEventListener("click", () => {
      closeOwnPopupOrTab();
    });
  }
}

function watchHistoryEvent() {
  window.addEventListener("popstate", (event) => {
    if (!event.state) return;
    if (event.state.pusher == "addredirectpage") {
      const url = new URL(event.state.path);
      const state = url.searchParams.get("page_state");
      showPageFromState(state);
    }
  });
}

function watchForms() {
  AutoForm.setup();
  ManualForm.setup();
}

(async () => {
  const currentSearchParams = new URLSearchParams(location.search);
  showPageFromState(currentSearchParams.get("page_state"));

  watchButtons();
  watchHistoryEvent();
  watchForms();
})();
