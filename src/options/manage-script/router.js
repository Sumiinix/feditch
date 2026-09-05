function loadPopup(popup_path) {
  const new_frame = document.createElement("iframe");
  new_frame.src = popup_path;
  new_frame.classList.add("popup");
  document.body.append(new_frame);
}

function closePopups(popups = null) {
  if (popups == null) {
    popups = document.querySelectorAll(".popup");
  }

  for (let popup of popups) {
    popup.remove();
  }

  window.closePopup = undefined;
}

function popupExist() {
  const popup_list = document.querySelectorAll(".popup");

  if (!popup_list.length) {
    return null;
  }

  return popup_list;
}

function closePopupIfExist() {
  const popups = popupExist();

  if (popups) {
    closePopups(popups);
  }
}

function loadPage(hashed_popup_path = "") {
  if (!hashed_popup_path || typeof hashed_popup_path !== "string") {
    closePopupIfExist();
    return;
  }

  const popup_path = extractHashId(hashed_popup_path);
  loadPopup(popup_path);
}

function watchPopupButtonPress() {
  const toggleHandler = (event) => {
    const popup_path = event.target.dataset.popupPath;
    if (!popup_path) return;

    loadPopup(popup_path);

    const state = { pusher: "managepage" };

    window.closePopup = () => {
      closePopupIfExist();
      state.path = location.origin + location.pathname + location.search;
      history.pushState(state, "", state.path);
    }

    const hashed_popup_path = "#" + popup_path;
    state.path = hashed_popup_path;
    history.pushState(state, "", hashed_popup_path);
  };

  document.addEventListener("click", toggleHandler);
}

function watchOpenPageButton() {
  const handler = (event) => {
    const page_path = event.target.dataset.openPath;
    if (!page_path) return;
    console.log(new URL(page_path, window.location.href).href)
    window.location.href = new URL(page_path, window.location.href).href;
  };

  document.addEventListener("click", handler);
}

function watchHistoryState() {
  window.addEventListener("popstate", (event) => {
    if (!event.state) return;

    if (event.state.pusher == "managepage") {
      let hashed_popup_path = event.state.path;
      hashed_popup_path = hashed_popup_path ? hashed_popup_path : "";
      loadPage(hashed_popup_path);
    }
  });
}

function watchHashChange() {
  window.addEventListener("hashchange", () => {
    loadPage(location.hash);
  });
}

function togglePopupWatcher() {
  watchPopupButtonPress();

  watchHistoryState();

  watchHashChange();
}

function extractHashId(hash) {
  if (typeof hash !== "string") return "";

  let id = hash.startsWith("#") ? hash.slice(1) : "";
  return id;
}

(async () => {
  // console.log(location.hash);
  loadPage(location.hash);
  watchOpenPageButton();
  togglePopupWatcher();
})();
