// import c from "./c";
// import { z } from "zod";
// import { id as idSchema } from "./common";
// import { AwardSchema, AwardStatsSchema } from "../schema/Award";

// export default c.router({
//     listReactions: {
//         method: "GET",
//         path: "/objects/:objectType/:objectId/award",
//         responses: { 200: z.array(AwardSchema) },
//     },
//     createReaction: {
//         method: "POST",
//         path: "/objects/:objectType/:objectId/award",
//         body: AwardSchema.omit({
//             id: true,
//             created_at true,
//             user: true,
//         }).extend({
//             userId: idSchema, // pass current user id
//         }),
//         responses: { 201: AwardSchema },
//     },
//     // delete or undo
//     deleteReaction: {
//         method: "DELETE",
//         path: "/objects/:objectType/:objectId/award/:awardId",
//         responses: { 204: z.null() },
//     },
//     // group by type
//     statsReactions: {
//         method: "GET",
//         path: "/objects/:objectType/:objectId/award/stats",
//         responses: { 200: AwardStatsSchema },
//     },
// });
