import { manageRedirect, manageTempState, manageLatest } from "../../lib/mylib/storage.js";
import { MastodonAPI } from "../../lib/mylib/networkUtils.js";
import { delay } from "../../lib/mylib/timer.js";

function _redirectDefaultPage() {
  document.location.replace("/options/manage.html");
}

function _showFailedPage(
  error, title, message="", error_message
) {
  const page = document.querySelector("[data-page=failed]");

  if (title) {
    document.getElementById("failed-title").textContent = title;
    document.getElementById("failed-message").textContent = message;
  }

  if (error_message) {
    const error_elem = document.getElementById("failed-error");
    error_elem.setAttribute("role", "alert");
    error_elem.setAttribute("data-variant", "error");
    error_elem.textContent = error_message;
  }
  
  document.getElementById("back-button").addEventListener("click", () => {
    _redirectDefaultPage();
  });
  
  page.dataset.currentPage = "true";
  throw error;
}

const callback = {
  mastodonAPIToken: async (saved_state) => {
    const redirectInfo = saved_state.redirect_info;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const code = params.get("code");
    let token_info;
    const mastodonAPI = new MastodonAPI(redirectInfo.data["version_string"]);

    if (state != saved_state.state) {
      await manageTempState.clear();
      const error = new Error("Unkown state from response");
      _showFailedPage(
          error,
          "Error",
          "Unknown state",
          error.message);
      return;
    }

    if (code) {
      try {
        token_info = await mastodonAPI.obtainToken(
          saved_state.oAuthMeta, saved_state.appdata, code);
      } catch (error) {
        _showFailedPage(error, "Error", "Failed to get token");
      }
    } else if(!code && (saved_state.force_login == false) ) {
      // Retry using force_login.
      await delay(200);
      mastodonAPI.authorizeUser(saved_state.oAuthMeta, saved_state.appdata, redirectInfo, true);
      throw new Error("End");
    } else {
      const message = "Failed to get auth code";
      _showFailedPage(new Error(message), "Failed :(", message);
    }

    redirectInfo.data["auth_meta"] = saved_state.oAuthMeta;
    redirectInfo.data["auth_code"] = code;
    redirectInfo.data["token_info"] = token_info;

    try {
      await delay(200);
      const verify = await mastodonAPI.verifyToken(redirectInfo);
      if (!verify) {
        throw new Error("verifyToken failed");
      }
    } catch (error) {
      _showFailedPage(error, "Error", "Token verification failed");
    }

    await manageRedirect.save(redirectInfo);
    await manageLatest.save(redirectInfo.name, redirectInfo.domain, redirectInfo.method);
    document.location.replace("/options/add-redirect.html?page_state=completed");
  }
};

(async () => {
  console.log("hi");
  const saved_state = await manageTempState.load();

  if (saved_state == undefined) {
    // _redirectDefaultPage();
    const error = new Error("saved_state is undefined");
    _showFailedPage(error);
    return;
  }

  switch (saved_state.redirect_info.method) {
    case "MastodonAPIV2Search":
      await callback.mastodonAPIToken(saved_state);
      break;
  
    default:
      _showFailedPage(new Error(''));
      break;
  }
})();
