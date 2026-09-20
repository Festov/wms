import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerMessageCatalog } from "@/lib/i18n/sync";

const root = resolve(__dirname);
const ru = JSON.parse(readFileSync(resolve(root, "messages/ru.json"), "utf8"));
const en = JSON.parse(readFileSync(resolve(root, "messages/en.json"), "utf8"));

registerMessageCatalog("ru", ru);
registerMessageCatalog("en", en);
