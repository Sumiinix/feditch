import {manageLatest} from "../../lib/mylib/storage.js";

export {showPageFromState, moveAndShowPage, appendInfoOnCompletedScreen};

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

function getPageState(page_name) {
  const page_target = document.querySelector(`[data-page=${page_name}]`);

  if (page_target.hasAttribute("data-state")) {
    return page_target.dataset.state;
  }
  return null;
}

function showPage(page_name) {
  const current_page = document.querySelector("[data-current-page=true]");
  const page_to_show = document.querySelector(`[data-page=${page_name}]`);

  if (!page_to_show) return;

  if (current_page) {
    current_page.dataset.currentPage = "false";
  }
  page_to_show.dataset.currentPage = "true";
}

function showPageFromState(page_state) {
  switch (page_state) {
    case "auto_form": {
      showPage("auto_form");
      break;
    }
    case "completed": {
      const redirect = manageLatest.load();
      redirect.then(function(redirect) {
        appendInfoOnCompletedScreen(redirect.name, redirect.domain, redirect.method);
        showPage("completed");
      });
      break;
    }
    default: {
      showPage("add_redirect");
      const state = {
        pusher: "addredirectpage",
        path: getDefaultPath()
      };
      history.replaceState(state, "", state.path);
    }
  }
}

function moveAndShowPage(to_load) {
  const page_state_to_push = getPageState(to_load);

  if (page_state_to_push) {
    const search_params = "?page_state=" + String(page_state_to_push);
    const path = getDefaultPath() + search_params;
    const state = {
      pusher: "addredirectpage",
      path: path
    };
    history.pushState(state, "", path);
  }
  showPage(to_load);
}

export function closeOwnPopupOrTab() {
  if (window.parent.closePopup) {
    window.parent.closePopup();
  } else {
    const options_path = location.origin + "/options/manage.html"
    window.location.href = options_path;
  }
}
