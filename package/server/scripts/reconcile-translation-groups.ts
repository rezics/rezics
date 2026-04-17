import { translationGroupService } from "@/translation-group/translation-group.service";

const result = await translationGroupService.reconcileSupportedLanguages();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
