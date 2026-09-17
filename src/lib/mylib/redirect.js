import reference from "../../lib/mylib/nameReference.json" with {type: "json"};
import UriTemplate from "../uri-templates/uri-templates.mjs"

export function getRedirectDetailString(redirectData) {
    let detail_str = redirectData.redirect_info.domain || 
        redirectData.redirect_info.template ||
        reference.methods[redirectData.method]["displayName"];
    return detail_str;
}

export function getFilledURIFromTemplate(redirectData ,currentURL) {
  let template;
  let filledURI;

  try {
    template = new UriTemplate(redirectData.redirect_info.template);

    if (redirectData.method == "ActivityIntentsObject") {
      filledURI = template.fill({object: currentURL});
    } else if (redirectData.method == "Ostatus1.0Subscribe") {
      filledURI = template.fill({uri: currentURL});
    }
  } catch (error) {
    console.log(`[Error]: getFilledURIFromTemplate: UriTemplate Failed ${error}`);
    return null;
  }

  return filledURI;
}
