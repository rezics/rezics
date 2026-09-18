import Elysia, { t } from "elysia";
import session from "../../auth/session";
import { CatalogOwnerValues } from "@rezics/schema/contracts/native/catalog";
import { CatalogEditorialContent, CatalogEditorialEdit, CatalogEditorialWrite, CatalogEditorialMutation,
	CatalogEditorialResponse, CatalogEditorialLanguages, CatalogEditorialHistory } from "../../catalog/editorial-contracts";
import { readCatalogEditorial, writeCatalogEditorial, listCatalogEditorialLanguages, listCatalogEditorialHistory, readCatalogEditorialRevision } from "../../catalog/editorial";
import { ContentLanguageTag, Uuid } from "../schema";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";

const resource=t.Object({owner:t.UnionEnum(CatalogOwnerValues),id:Uuid});
const params=t.Object({...resource.properties,language:ContentLanguageTag});
const revision=t.Integer({minimum:1,maximum:Number.MAX_SAFE_INTEGER});
const historyParams=t.Object({...params.properties,editorialRevision:revision});
const page=t.Object({cursor:t.Optional(t.String({maxLength:2048})),limit:t.Integer({minimum:1,maximum:100,default:25})});
const detail=(operationId:string,summary:string)=>({operationId,summary,tags:["Catalog Editorial"]});
const empty: CatalogEditorialContent={summary:null,description:null,avatar:null,bannerAssetId:null,coverAssetId:null};

/** @alpha @remarks Editorial text is independently localized and versioned under its native resource's edit policy. */
export default new Elysia({prefix:"/resources/:owner/:id/editorial",name:"catalog-editorial"}).use(session)
	.get("",{params:resource,response:CatalogEditorialLanguages,detail:detail("listCatalogEditorialLanguages","List authored editorial languages")},
		({params,request})=>catalogRead(request,(tx,actor)=>listCatalogEditorialLanguages(tx,params,actor)))
	.get("/:language",{params,response:CatalogEditorialResponse,detail:detail("readCatalogEditorial","Read one editorial language")},
		({params,request})=>catalogRead(request,(tx,actor)=>readCatalogEditorial(tx,params,actor,params.language)))
	.put("/:language",{access:"contribute:unit:update",params,body:CatalogEditorialWrite,response:CatalogEditorialMutation,detail:detail("writeCatalogEditorial","Write one editorial language")},
		({params,body,participation})=>catalogMutation(participation,(tx,actor)=>writeCatalogEditorial(tx,params,actor,params.language,body)))
	.delete("/:language",{access:"contribute:unit:update",params,body:CatalogEditorialEdit,response:CatalogEditorialMutation,detail:detail("withdrawCatalogEditorial","Withdraw editorial content while preserving history")},
		({params,body,participation})=>catalogMutation(participation,(tx,actor)=>writeCatalogEditorial(tx,params,actor,params.language,{...body,content:empty},"withdrawn")))
	.get("/:language/history",{params,query:page,response:CatalogEditorialHistory,detail:detail("listCatalogEditorialHistory","Read authorized editorial revision metadata")},
		({params,query,request})=>catalogDomainHistory(request,params,(tx,actor)=>listCatalogEditorialHistory(tx,params,actor,params.language,query)))
	.get("/:language/history/:editorialRevision",{params:historyParams,response:CatalogEditorialResponse,detail:detail("readCatalogEditorialRevision","Read one authorized editorial revision")},
		({params,request})=>catalogDomainHistory(request,params,(tx,actor)=>readCatalogEditorialRevision(tx,params,actor,params.language,params.editorialRevision)))
	.post("/:language/history/restore",{access:"contribute:unit:update",params,
		body:t.Object({...CatalogEditorialEdit.properties,historicalRevision:revision},{additionalProperties:false}),response:CatalogEditorialMutation,detail:detail("restoreCatalogEditorial","Restore editorial content using current edit authority")},
		({params,body,participation})=>catalogMutation(participation,async(tx,actor)=>{
			const historical=await readCatalogEditorialRevision(tx,params,actor,params.language,body.historicalRevision);
			return writeCatalogEditorial(tx,params,actor,params.language,{expectedRevision:body.expectedRevision,expectedEditorialRevision:body.expectedEditorialRevision,content:historical.content??empty},historical.content?"active":"withdrawn");
		}));
