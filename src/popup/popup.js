/*global browser*/
import { manageRedirect } from "../lib/mylib/storage.js";
import { getFilledURIFromTemplate } from "../lib/mylib/redirect.js";
import reference from "../lib/mylib/nameReference.json" with {type: "json"};
import { delay } from "../lib/mylib/timer.js";

async function getCurrentURI() {
  const currentTab = await browser.tabs.query({active:true, currentWindow: true});
  if (!currentTab) return null;
  try {
    return new URL(currentTab[0].url);
  } catch (error) {
    console.log(error);
    return null;
  }
}

function setAPCheckStatus(status) {
  const badge = document.getElementById("check-ap-badge");
  const icon = document.getElementById("check-ap-icon");
  let newIcon;

  if (status == "Checking") {
    badge.dataset.variant = "secondary";
    badge.textContent = status;
    newIcon = document.createElement('SPAN');
    newIcon.setAttribute('id', "check-ap-icon");
    newIcon.setAttribute("aria-busy", "true");
    newIcon.dataset.spinner = "small";
    newIcon.className = "icon";
    icon.replaceWith(newIcon);
  } else if (status == "Redirect") {
    delete badge.dataset.variant;
    badge.textContent = status;
    icon.outerHTML = `
      <svg id="check-ap-icon" class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <!-- Icon downloaded from https://icon-sets.iconify.design/svg-spinners/pulse/ -->
        <circle cx="12" cy="12" r="0" fill="currentColor">
          <animate attributeName="r" calcMode="spline" dur="1.2s" keySplines=".52,.6,.25,.99" repeatCount="indefinite" values="0;11" />
          <animate attributeName="opacity" calcMode="spline" dur="1.2s" keySplines=".52,.6,.25,.99" repeatCount="indefinite" values="1;0" />
        </circle>
      </svg>
    `
  } else if (status == "Not found" || status == "No redirect target") {
    badge.dataset.variant = "secondary";
    badge.textContent = status;
    newIcon = document.createElement('DIV');
    newIcon.setAttribute('id', "check-ap-icon");
    icon.replaceWith(newIcon);
  }
}

async function appendRedirects(container, currentURL, apURI, htmlURL) {
  function generateRow(redirectName, redirectUrl) {
    const row = document.createElement('DIV');
    const nameElem = document.createElement('DIV');
    const actionsTarget = document.createElement('DIV');

    row.className = "list-item hstack justify-between";
    nameElem.className = "list-name";
    nameElem.textContent = redirectName;

    if (redirectUrl) {
      const redirectButton = document.createElement('SPAN');
      redirectButton.className = "outline menu-button";
      redirectButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 20 20">
          <!-- Icon downloaded from https://icon-sets.iconify.design/fluent/arrow-enter-20-filled/ -->
          <path d="M0 0h20v20H0z" fill="none" />
          <path fill="currentColor" d="M7.75 17.5a.75.75 0 0 1 0-1.5H14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H7.75a.75.75 0 0 1 0-1.5H14A3.5 3.5 0 0 1 17.5 6v8a3.5 3.5 0 0 1-3.5 3.5zM7.741 6.199a.75.75 0 0 1 1.06.042l3 3.25a.75.75 0 0 1 0 1.018l-3 3.25A.75.75 0 1 1 7.7 12.74l1.838-1.991H1.75a.75.75 0 0 1 0-1.5h7.787l-1.838-1.99a.75.75 0 0 1 .042-1.06" />
        </svg>
      `
      redirectButton.addEventListener("click", () => {
        browser.tabs.update({ url: redirectUrl});
        window.close();
      });
      actionsTarget.append(redirectButton);
    }

    row.appendChild(nameElem);
    row.appendChild(actionsTarget);
    return row;
  }

  let isRedirectExist = false;
  const fragment = document.createDocumentFragment();
  const redirects = await manageRedirect.load();
  if (redirects.length == 0) {
    return;
  }

  for(let redirect of redirects) {
    if ( redirect.domain == currentURL.host ||
      redirect.domain == apURI.host
     ) {
      continue;
    }

    let redirectUrl;
    if (reference["methods"][redirect.methods[0].name]["type"] == "template" ) {
      redirectUrl = getFilledURIFromTemplate(redirect.methods[0], apURI.href);
    }
    const row = generateRow(redirect.name, redirectUrl);
    fragment.appendChild(row);
    isRedirectExist = true;
  }

  if (htmlURL && currentURL.host != htmlURL.host) {
    const row = generateRow(htmlURL.host, htmlURL.href);
    fragment.appendChild(row);
    isRedirectExist = true;
  }

  container.append(fragment);
  return isRedirectExist;
}

function isContentTypeAP(contentType) {
  const regex = /application\/ld\+json;\s?profile="https:\/\/www\.w3\.org\/ns\/activitystreams"/;

  if (contentType.includes("application/activity+json")) {
    return true;
  } else if ( regex.test(contentType) ) {
    return true;
  } else {
    return false;
  }
}

async function getURLFromAPObj(response) {
  const json = await response.json();
  let htmlUrl = json.url || json.id;
  if (htmlUrl) {
    return new URL(htmlUrl);
  }
  return undefined;
}

async function getAPURIFromHTML(dom) {
  let apFound;
  let htmlUrl;
  let apUrl;

  const linkNodeList = dom.querySelectorAll('head link[rel="alternate"]');
  if(linkNodeList.length == 0) return [false, undefined, undefined];

  for (let node of linkNodeList) {
    const linkType = node.getAttribute("type") || '';
    const targetUrl = node.getAttribute("href");

    if (!linkType.includes("application/activity+json") || !targetUrl) {
      continue;
    }

    await delay(100);
    const response = await fetch(targetUrl, {
      credentials: "include",
      headers: {
        Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      }
    });
    const contentType = response.headers.get("Content-Type");
    apFound = isContentTypeAP(contentType);

    if (!apFound) return [false, undefined, undefined];
    
    try {
      htmlUrl = await getURLFromAPObj(response);
    } catch (error) {
      console.log(`getURLFromAPObj: ${error}`);
      htmlUrl = undefined;
    }

    if (response.redirected) {
      apUrl = response.url;
    } else {
      apUrl = targetUrl;
    }

    apFound = true;
    break;
  }

  return [apFound, apUrl, htmlUrl];
}

async function getAPURI(url) {
  let htmlUrl;
  let response;
  let apUrl = url;
  let apFound;

  response = await fetch(url, {
    headers: {
      Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    }
  });

  const contentType = response.headers.get("Content-Type");
  apFound = isContentTypeAP(contentType);
  const isHtmlResponse = contentType.includes("text/html") ? true : false;

  if (apFound) {
    try {
      htmlUrl = await getURLFromAPObj(response);
    } catch (error) {
      console.log(`getURLFromAPObj: ${error}`);
      htmlUrl = undefined;
    }

    if (response.redirected) {
      apUrl = response.url;
    }
  } else if (isHtmlResponse) {
    const responseText = await response.text();
    const dom = new DOMParser().parseFromString(responseText, 'text/html');
    [apFound, apUrl, htmlUrl] = await getAPURIFromHTML(dom);
  }

  if (apFound) {
    return [new URL(apUrl), htmlUrl];
  }
  return [undefined, undefined];
}

function listenSettingButton() {
  const settingsBtnElem = document.getElementById("settings");
  settingsBtnElem.addEventListener("click", () => {
        const optionUrl = browser.runtime.getURL("options/manage.html");
        browser.tabs.update({ url: optionUrl});
        window.close();
  });
}

const main = async () => {
  const currentURL = await getCurrentURI();
  const redirectElem = document.getElementById("redirects");

  listenSettingButton();

  if (currentURL && currentURL.href.startsWith("https://")) {
    let apUrl;
    let htmlUrl;

    setAPCheckStatus("Checking");

    try {
      [apUrl, htmlUrl] = await getAPURI(currentURL);
    } catch (error) {
      console.log("[INFO] getAPURI failed");
      console.log(error);
    }

    if (apUrl) {
      const isRedirectExist = await appendRedirects(redirectElem, currentURL, apUrl, htmlUrl);
      if (isRedirectExist){
        setAPCheckStatus("Redirect");
      } else {
        setAPCheckStatus("No redirect target");
      }
    } else {
      apUrl = currentURL;
      setAPCheckStatus("Not found");
      await appendRedirects(redirectElem, currentURL, apUrl, htmlUrl);
    }
  }
}

(async () => {
  document.addEventListener("DOMContentLoaded", async () => {
    await main();
  });
})();
