import reference from "../../lib/mylib/nameReference.json" with {type: "json"};
import UriTemplate from "../uri-templates/uri-templates.mjs"

export function getRedirectDetailString(redirectData) {
    let detail_str = redirectData.domain || 
        reference.methods[redirectData.method]["displayName"];
    return detail_str;
}

export function getFilledURIFromTemplate(method ,currentURL) {
  let template;
  let filledURI;

  try {
    template = new UriTemplate(method.template);

    if (method.name == "ActivityIntentsObject") {
      filledURI = template.fill({object: currentURL});
    } else if (method.name == "Ostatus1.0Subscribe") {
      filledURI = template.fill({uri: currentURL});
    }
  } catch (error) {
    console.log(`[Error]: getFilledURIFromTemplate: UriTemplate Failed ${error}`);
    return null;
  }

  return filledURI;
}
