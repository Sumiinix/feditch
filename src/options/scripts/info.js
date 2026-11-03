/*global browser*/
import { resetAllData } from "../../lib/mylib/storage.js";

( async () => {
  const resetButtonElem = document.getElementById("reset-data");
  resetButtonElem.addEventListener("click", async () => {
    await resetAllData();
    browser.tabs.update({ url: "/options/manage.html"});   
  });
})();
