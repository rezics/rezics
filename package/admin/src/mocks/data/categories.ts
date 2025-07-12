import type { Category } from "../../graphql/schema.types"; // Assuming schema types are here

// Define a specific type for our mock categories if Category from schema.types is too complex
// For now, assuming Category from schema.types is usable or we use a simplified version.
// If Category includes complex fields like `blogPosts: CategoryBlogPostsConnection`,
// we might need a MockCategory type here.

export let mockCategories: Pick<Category, "id" | "title" | "createdAt" | "updatedAt">[] = [
    {
        id: "category-1",
        title: "Technology",
        createdAt: new Date("2024-01-01T09:00:00Z").toISOString(),
        updatedAt: new Date("2024-01-01T09:00:00Z").toISOString(),
    },
    {
        id: "category-2",
        title: "Science & Nature",
        createdAt: new Date("2024-01-05T12:00:00Z").toISOString(),
        updatedAt: new Date("2024-01-06T15:30:00Z").toISOString(),
    },
    {
        id: "category-3",
        title: "Arts & Culture",
        createdAt: new Date("2024-01-10T17:45:00Z").toISOString(),
        updatedAt: new Date("2024-01-10T17:45:00Z").toISOString(),
    },
    {
        id: "category-4",
        title: "History & Philosophy",
        createdAt: new Date("2024-02-01T10:10:00Z").toISOString(),
        updatedAt: new Date("2024-02-01T10:10:00Z").toISOString(),
    },
];

// Function to add a new category
export const addCategory = (input: { title: string }): Pick<Category, "id" | "title" | "createdAt" | "updatedAt"> => {
    const newCategory = {
        id: `category-${Date.now()}`,
        title: input.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    mockCategories.push(newCategory);
    return newCategory;
};

// Function to update a category
export const updateCategory = (
    id: string,
    input: { title?: string },
): Pick<Category, "id" | "title" | "createdAt" | "updatedAt"> | null => {
    const categoryIndex = mockCategories.findIndex((c) => c.id === id);
    if (categoryIndex === -1) {
        return null;
    }
    const existingCategory = mockCategories[categoryIndex];
    const updatedCategory = {
        ...existingCategory,
        ...input,
        updatedAt: new Date().toISOString(),
    };
    mockCategories[categoryIndex] = updatedCategory;
    return updatedCategory;
};
