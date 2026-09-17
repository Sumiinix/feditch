/*global browser*/
import { manageRedirect } from "../lib/mylib/storage.js";
import { getFilledURIFromTemplate } from "../lib/mylib/redirect.js";
import reference from "../lib/mylib/nameReference.json" with {type: "json"};
import { delay } from "../lib/mylib/timer.js";

async function getCurrentURI() {
  const currentTab = await browser.tabs.query({active:true});
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
  let new_icon;

  if (status == "Checking") {
    badge.dataset.variant = "secondary";
    badge.textContent = status;
    new_icon = document.createElement('SPAN');
    new_icon.setAttribute('id', "check-ap-icon");
    new_icon.setAttribute("aria-busy", "true");
    new_icon.dataset.spinner = "small";
    new_icon.className = "icon";
    icon.replaceWith(new_icon);
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
    new_icon = document.createElement('DIV');
    new_icon.setAttribute('id', "check-ap-icon");
    icon.replaceWith(new_icon);
  }

}

async function appendRedirects(container, currentURL, apURI, htmlURL) {
  function generateRow(redirect_name, redirect_url) {
    const row = document.createElement('DIV');
    const name_elem = document.createElement('DIV');
    const actions_target = document.createElement('DIV');

    row.className = "list-item hstack justify-between";
    name_elem.className = "list-name";
    name_elem.textContent = redirect_name;

    if (redirect_url) {
      const redirect_button = document.createElement('SPAN');
      redirect_button.className = "outline menu-button";
      redirect_button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 2048 2048">
          <!-- Icon downloaded from https://icon-sets.iconify.design/fluent-mdl2/navigate-external-inline/ -->
          <path fill="currentColor" d="M1536 1408h128v640H256V640h640v128H384v1152h1152zm128-768v640h-128V859l-595 594l-90-90l594-595h-421V640z" />
        </svg>
      `
      redirect_button.addEventListener("click", () => {
        browser.tabs.update({ url: redirect_url});
        window.close();
      });
      actions_target.append(redirect_button);
    }

    row.appendChild(name_elem);
    row.appendChild(actions_target);
    return row;
  }

  let redirect_exist = false;
  const fragment = document.createDocumentFragment();
  const redirects = await manageRedirect.load();
  if (redirects.length == 0) {
    return;
  }

  for(let redirect of redirects) {
    if ( redirect.redirect_info.domain == currentURL.host ||
      redirect.redirect_info.domain == apURI.host
     ) {
      continue;
    }

    let redirect_url;
    if (reference["methods"][redirect.method]["type"] == "template" ) {
      redirect_url = getFilledURIFromTemplate(redirect, apURI.href);
    }
    const row = generateRow(redirect.name, redirect_url);
    fragment.appendChild(row);
    redirect_exist = true;
  }

  if (htmlURL && currentURL.host != htmlURL.host) {
    const row = generateRow(htmlURL.host, htmlURL.href);
    fragment.appendChild(row);
    redirect_exist = true;
  }

  container.append(fragment);
  return redirect_exist;
}

function isContentTypeAP(content_type) {
  const regex = /application\/ld\+json;\s?profile="https:\/\/www\.w3\.org\/ns\/activitystreams"/;

  if (content_type.includes("application/activity+json")) {
    return true;
  } else if ( regex.test(content_type) ) {
    return true;
  } else {
    return false;
  }
}

async function getURLFromAPObj(response) {
  const json = await response.json();
  let html_url = json.url || json.id;
  if (html_url) {
    return new URL(html_url);
  }
  return undefined;
}

async function getAPURIFromHTML(dom) {
  let ap_found;
  let html_url;
  let ap_url;

  const link_node_list = dom.querySelectorAll('head link[rel="alternate"]');
  if(link_node_list.length == 0) return [false, undefined, undefined];

  for (let node of link_node_list) {
    const link_type = node.getAttribute("type") || '';
    const target_url = node.getAttribute("href");

    if (!link_type.includes("application/activity+json") || !target_url) {
      continue;
    }

    await delay(100);
    const response = await fetch(target_url,{
      headers: {
        Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      }
    });
    const content_type = response.headers.get("Content-Type");
    ap_found = isContentTypeAP(content_type);

    if (!ap_found) return [false, undefined, undefined];
    
    try {
      html_url = await getURLFromAPObj(response);
    } catch (error) {
      console.log(`getURLFromAPObj: ${error}`);
      html_url = undefined;
    }

    if (response.redirected) {
      ap_url = response.url;
    } else {
      ap_url = target_url;
    }

    ap_found = true;
    break;
  }

  return [ap_found, ap_url, html_url];
}

async function getAPURI(url) {
  let html_url;
  let response;
  let ap_url = url;
  let ap_found;

  response = await fetch(url, {
    headers: {
      Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    }
  });

  if(!response.ok) return false;
  const content_type = response.headers.get("Content-Type");
  ap_found = isContentTypeAP(content_type);
  const html_response = content_type.includes("text/html") ? true : false;

  if (ap_found) {
    try {
      html_url = await getURLFromAPObj(response);
    } catch (error) {
      console.log(`getURLFromAPObj: ${error}`);
      html_url = undefined;
    }

    if (response.redirected) {
      ap_url = response.url;
    }
  } else if (html_response) {
    const response_text = await response.text();
    const dom = new DOMParser().parseFromString(response_text, 'text/html');
    [ap_found, ap_url, html_url] = await getAPURIFromHTML(dom);
  }

  if (ap_found) {
    return [new URL(ap_url), html_url];
  }
  return [undefined, undefined];
}

const main = async () => {
  const currentURL = await getCurrentURI();
  const container = document.getElementById("container");

  if (currentURL && currentURL.href.startsWith("https://")) {
    let ap_uri;
    let html_url;

    setAPCheckStatus("Checking");

    try {
      [ap_uri, html_url] = await getAPURI(currentURL);
    } catch (error) {
      console.log("[INFO] getAPURI failed");
      console.log(error);
    }

    if (ap_uri) {
      const redirect_exist = await appendRedirects(container, currentURL, ap_uri, html_url);
      if (redirect_exist){
        setAPCheckStatus("Redirect");
      } else {
        setAPCheckStatus("No redirect target");
      }
    } else {
      setAPCheckStatus("Not found");
    }
  }
}

(async () => {
  document.addEventListener("DOMContentLoaded", async () => {
    await main();
  })
})();
