import { AutoForm, manualForm } from "./add-redirect-form.js";

export { showPage, appendInfoOnCompletedScreen };

function appendInfoOnCompletedScreen(...text_args) {
  const target_elem = document.getElementById("successful-info");
  const fragment = document.createDocumentFragment();

  text_args.forEach((text) => {
    let elem = document.createElement("DIV");
    elem.className = "flex justify-center text-lighter mb-2";
    elem.textContent = text;

    fragment.appendChild(elem);
  });
  target_elem.replaceChildren(fragment);
}

function getDefaultPath() {
  return location.origin + location.pathname;
}

function showPage(pageName) {
  const previousPage = document.querySelector("[data-current-page=true]");
  const currentPage = document.querySelector(`[data-page=${pageName}]`);

  if (!currentPage) return;

  if (previousPage) {
    previousPage.dataset.currentPage = "false";
  }
  currentPage.dataset.currentPage = "true";

  if (currentPage.dataset.state) {
    pushState(pageName);
  }
}

function pushState(stateName) {
  const search_params = "?page_state=" + String(stateName);
  const defaultPath = getDefaultPath();
  const path = stateName == "add_redirect" ? defaultPath : defaultPath + search_params;
  const state = {
    pusher: "add-redirect",
    path: path
  };
  history.pushState(state, "", path);
}

function back() {
    const options_path = location.origin + "/options/manage.html"
    window.location.href = options_path;
}

function litsenButtons() {
  const naviButtons = document.querySelectorAll("button[data-to-page]");
  for (let button of naviButtons) {
    button.addEventListener("click", (event) => {
      showPage(event.target.dataset.toPage);
    });
  }

  const completeButton = document.querySelectorAll("[data-close]");
  for (let button of completeButton) {
    button.addEventListener("click", () => {
      back();
    });
  }
}

function litsenHistoryEvent() {
  window.addEventListener("popstate", (event) => {
    if (!event.state) return;
    console.log(event.state)
    if (event.state.pusher == "add-redirect") {
      const url = new URL(event.state.path);
      const state = url.searchParams.get("page_state");
      showPage(state);
    }
  });
}

(async () => {
  const currentSearchParams = new URLSearchParams(location.search);
  showPage(currentSearchParams.get("page_state"));

  litsenButtons();
  litsenHistoryEvent();
  AutoForm.setup();
  manualForm.setup();
})();
