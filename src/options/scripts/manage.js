// /*global browser*/
import { manageRedirect } from "../../lib/mylib/storage.js";
// import { getRedirectDetailString } from "../../lib/mylib/redirect.js";
import { Sortable } from "../../lib/Sortable/sortable.core.esm.js";

class Tab {
  constructor(buttonsElem, contentsElem) {
    this._buttonsElem = buttonsElem;
    this._contentsElem = contentsElem;
    buttonsElem.addEventListener("click", this._onClick.bind(this));
  }

  switchTo(tabName) {
    const previousContent = this._contentsElem.querySelector('[data-display="true"]');
    const content = this._contentsElem.querySelector(`[data-name=${tabName}]`);
    
    previousContent.dataset.display = "false";
    content.dataset.display = "true";
  }

  _onClick(event) {
    const action = event.target.dataset.action;

    switch (action) {
      case "switchTo":
      this.switchTo(event.target.dataset.name);
      break;

      default:
        break;
    }
  }
}

function watchOpenPageButton() {
  const handler = (event) => {
    const pagePath = event.target.dataset.openPath;
    if (!pagePath) return;
    window.location.href = new URL(pagePath, window.location.href).href;
  };

  document.addEventListener("click", handler);
}

async function loadRedirects() {
  const old_redirects_list = document.getElementById("redirects-list");
  const redirects_list = document.createElement('DIV');
  redirects_list.setAttribute("id", "redirects-list");
  redirects_list.classList.add("mt-6");
  old_redirects_list.replaceWith(redirects_list);
  const fragment = document.createDocumentFragment();

  const redirects = await manageRedirect.load();

  if (redirects.length == 0) {
    return;
  }

  for(let [index, item] of redirects.entries()) {
    const row = document.createElement('DIV');
    const info = document.createElement('DIV');
    const name_elem = document.createElement('DIV');

    const wrap = document.createElement('DIV');
    wrap.className = "flex";
    const handle = document.createElement('DIV');
    handle.innerHTML = 
        `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="8" cy="4" r="1" transform="rotate(90 8 4)" />
            <circle cx="16" cy="4" r="1" transform="rotate(90 16 4)" />
            <circle cx="8" cy="12" r="1" transform="rotate(90 8 12)" />
            <circle cx="16" cy="12" r="1" transform="rotate(90 16 12)" />
            <circle cx="8" cy="20" r="1" transform="rotate(90 8 20)" />
            <circle cx="16" cy="20" r="1" transform="rotate(90 16 20)" />
          </g>
        </svg>`;
    handle.className = "handle";

    // const drop_button = document.createElement('BUTTON');
    const drop_button_target = document.createElement('ot-dropdown');
    row.dataset.index = index;

    name_elem.textContent = item.name;

    const popup_num = Number(index);

    const drop_button = 
        `<button popovertarget="list-popup-${popup_num}" class="outline menu-button">
          ︙
        </button>
        <menu popover id="list-popup-${popup_num}">
          <button role="menuitem" class="ghost" data-manage-action="edit"
              popovertarget="list-popup-${popup_num}" popovertargetaction="hide">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
              <!-- Icon downloaded from https://icon-sets.iconify.design/akar-icons/edit/ -->
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.1 2.1 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621" />
                <path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" />
              </g>
            </svg>
            Edit
          </button>
          <button role="menuitem" data-variant="danger" class="ghost" data-manage-action="delete">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:1.2em;height:1.2em">
              <!-- Icon downloaded from https://icon-sets.iconify.design/akar-icons/trash-can/ -->
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16l-1.58 14.22A2 2 0 0 1 16.432 22H7.568a2 2 0 0 1-1.988-1.78zm3.345-2.853A2 2 0 0 1 9.154 2h5.692a2 2 0 0 1 1.81 1.147L18 6H6zM2 6h20m-12 5v5m4-5v5" />
            </svg>
            Delete
          </button>
        </menu>`;

    drop_button_target.innerHTML = drop_button;
    row.classList.add("list-item", "hstack", "justify-between");
    name_elem.classList.add("list-name");
    // drop_button.classList.add("outline");

    const edit_button = drop_button_target.querySelector("[data-manage-action=edit]");
    edit_button.addEventListener("click", async () => {
      const new_frame = document.createElement("iframe");
      new_frame.src = `./edit.html?editIndex=${row.dataset.index}`;
      new_frame.classList.add("popup");

      window.closePopup = () => {
        new_frame.remove();
        loadRedirects();
      }

      document.body.append(new_frame);
      row.remove();
    });

    const delete_button = drop_button_target.querySelector("[data-manage-action=delete]");
    delete_button.addEventListener("click", async () => {
      await manageRedirect.removeItem(row.dataset.index);
      row.remove();
    });

    wrap.appendChild(handle);

    info.appendChild(name_elem);
    wrap.appendChild(info);
    row.appendChild(wrap);
    row.appendChild(drop_button_target);
    fragment.appendChild(row);
  }

  redirects_list.replaceChildren(fragment);

  Sortable.create(redirects_list, {
    handle: '.handle',
    animation: 150,
    onEnd: async function(event) {
      if (event.to.getAttribute("id") == "redirects-list" ||
          event.from.getAttribute("id") == "redirects-list" 
      ) {
        if (event.oldIndex != event.newIndex){
          await manageRedirect.move(event.oldIndex, event.newIndex);
          const list = document.getElementById("redirects-list");
          let index = 0;
          for(const child of list.children) {
            child.dataset.index = index;
            index++;
          }
        }
      }
    }
  });
}

(async () => {
  await loadRedirects();
  watchOpenPageButton();

  new Tab(
    document.getElementById("header-tab"),
    document.getElementById("tab-contents")
  );
})();
