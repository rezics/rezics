import { mockCategories } from './categories';

// Simpler category type for nesting within BlogPost mocks
interface PartialCategory {
  id: string;
  title: string;
}

// Define a specific type for our mock blog posts
export interface MockBlogPost {
  id: string;
  title: string;
  content: string;
  status: 'PUBLISHED' | 'DRAFT' | 'REJECTED';
  categoryId: string;
  category: PartialCategory; 
  createdAt: string;
  updatedAt: string;
}

// Helper to find a category by ID and map to PartialCategory
const findPartialCategory = (categoryId: string): PartialCategory | undefined => {
    const category = mockCategories.find(c => c.id === categoryId);
    if (category) {
        return { id: category.id, title: category.title };
    }
    return undefined;
};

export const mockBlogPosts: MockBlogPost[] = [
  {
    id: 'post-1',
    title: 'Getting Started with GraphQL',
    content: 'GraphQL is a query language for your API...',
    status: 'PUBLISHED',
    categoryId: mockCategories[0].id,
    category: { id: mockCategories[0].id, title: mockCategories[0].title }, 
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
  {
    id: 'post-2',
    title: 'The Future of Web Development',
    content: 'Web development is constantly evolving with new frameworks and tools...',
    status: 'PUBLISHED',
    categoryId: mockCategories[0].id,
    category: { id: mockCategories[0].id, title: mockCategories[0].title },
    createdAt: new Date('2024-01-15T14:30:00Z').toISOString(),
    updatedAt: new Date('2024-01-16T09:00:00Z').toISOString(),
  },
  {
    id: 'post-3',
    title: 'Understanding Quantum Physics',
    content: 'Quantum physics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles...',
    status: 'DRAFT',
    categoryId: mockCategories[1].id,
    category: { id: mockCategories[1].id, title: mockCategories[1].title },
    createdAt: new Date('2024-02-10T11:00:00Z').toISOString(),
    updatedAt: new Date('2024-02-10T11:00:00Z').toISOString(),
  },
  {
    id: 'post-4',
    title: 'A Journey Through Ancient Civilizations',
    content: 'Exploring the wonders of ancient Egypt, Rome, and Greece, from their majestic pyramids to their influential philosophies...',
    status: 'PUBLISHED',
    categoryId: mockCategories[2].id,
    category: { id: mockCategories[2].id, title: mockCategories[2].title },
    createdAt: new Date('2024-03-05T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-03-05T08:00:00Z').toISOString(),
  },
  {
    id: 'post-5',
    title: 'The Art of Digital Painting',
    content: 'A deep dive into the techniques and tools used by digital artists to create stunning visuals, from concept sketches to finished masterpieces...',
    status: 'DRAFT',
    categoryId: mockCategories[2].id,
    category: { id: mockCategories[2].id, title: mockCategories[2].title },
    createdAt: new Date('2024-04-20T16:45:00Z').toISOString(),
    updatedAt: new Date('2024-04-22T10:20:00Z').toISOString(),
  }
];

// Function to add a new blog post (used by mock handler)
export const addBlogPost = (input: any): MockBlogPost => {
  const partialCategory = findPartialCategory(input.categoryId as string);
  if (!partialCategory) {
    throw new Error(`Category with id ${input.categoryId} not found`);
  }
  const newPost: MockBlogPost = {
    id: `post-${Date.now()}`,
    title: input.title as string,
    content: input.content as string,
    status: input.status as 'PUBLISHED' | 'DRAFT' | 'REJECTED',
    categoryId: partialCategory.id,
    category: partialCategory,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockBlogPosts.push(newPost);
  return newPost;
};

// Function to update a blog post (used by mock handler)
export const updateBlogPost = (id: string, update: Partial<MockBlogPost>): MockBlogPost | null => {
  const postIndex = mockBlogPosts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return null;
  }
  const existingPost = mockBlogPosts[postIndex];
  let category = existingPost.category;
  if (update.categoryId && update.categoryId !== existingPost.categoryId) {
    const foundPartialCategory = findPartialCategory(update.categoryId as string);
    if (!foundPartialCategory) {
      throw new Error(`Category with id ${update.categoryId} not found`);
    }
    category = foundPartialCategory;
  }

  const updatedPost: MockBlogPost = {
    ...existingPost,
    ...update,
    category: category, // Ensure category object is updated if categoryId changed
    updatedAt: new Date().toISOString(),
  };
  mockBlogPosts[postIndex] = updatedPost;
  return updatedPost;
}; 