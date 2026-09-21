import { readdirSync, readFileSync, writeFile, copyFile } from "node:fs";
import { compareVersion } from "../src/lib/mylib/versions.js";
import path from "node:path"

async function make_firefox_update_json(conf) {
  let latest_ver = "0.0.0";
  let latest_file;
  const read_manifest = await readFileSync(conf.manifest_path, {encoding: "utf8"});
  const manifest = JSON.parse(read_manifest);

  console.log(`[${manifest.name}]`);
  console.log(`Manifest version: ${manifest.version}`);

  const file_names = readdirSync(conf.build_dist_path);
  file_names.forEach((file_name) => {
    const reg = /([0-9]*\.[0-9]*\.[0-9]*)\.xpi$/;
    let result = file_name.match(reg);
    if (result == null) return null;
    const version = result[1];
    if (compareVersion(version, latest_ver) == 1) {
      latest_ver = version;
      latest_file = file_name;
    }
  });

  console.log("[Latest signed build for Firefox]");
  console.log(`File: ${latest_file}`);
  console.log(`Version: ${latest_ver}`);

  const update_json_obj = {
    "addons": {
      [manifest.browser_specific_settings.gecko.id]: {
        "updates": [
          {
            "version": latest_ver,
            "update_link": `${conf.update_link_prefix}${latest_file}`
          }
        ]
      }
    }
  }
  const update_json = JSON.stringify(update_json_obj, null, "  ");
  console.log("[update.json]");
  console.log(update_json);

  writeFile(conf.update_json_output, update_json, (err) => {
    if (err) throw err;
  });
  if (conf.copy_latest) {
    const latest_path = path.join(conf.build_dist_path, latest_file);
    const latest_target = path.join(conf.build_dist_path, '/latest.signed.xpi');
    copyFile(latest_path, latest_target, (err) => {
      if (err) throw err;
    })
  }
}

const read_config = await readFileSync("./scripts/.config.json", {encoding: "utf8"});
const conf = JSON.parse(read_config);

make_firefox_update_json(conf.firefox);
