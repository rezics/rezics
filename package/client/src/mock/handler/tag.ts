import { http, HttpResponse } from "msw";
// import { Tag } from "contract";

let Tag: any = {}

const mockTagGroups = [
    { key: "genre", name: "Genre", tags: ["Fantasy", "Sci-fi", "Romance"] },
    { key: "status", name: "Status", tags: ["Ongoing", "Completed"] },
];

// export const tagHandlers = [
//     http.get(Tag.list.path, () => HttpResponse.json(mockTagGroups)),

//     http.get(Tag.get.path, ({ params }) => {
//         const group = mockTagGroups.find(
//             (g) => g.key === (params as any)["key"],
//         );
//         if (!group) {
//             return HttpResponse.json({ message: "Not found" }, { status: 404 });
//         }
//         return HttpResponse.json(group);
//     }),
// ];

export function tagCreateHandler(body: any) {
    console.log("tagCreateHandler", body);
    // return HttpResponse.json({ id: "111", name: "test" }, { status: 200 });
    return { id: "111", name: "test" }
}