import { graphql, HttpResponse } from 'msw';
// import type { HandlerResolver } from './types'; // Temporarily remove to let MSW infer
import { mockBlogPosts, addBlogPost, updateBlogPost, MockBlogPost } from '../data/blogPosts';
import { mockCategories } from '../data/categories'; // For CategoriesSelect query

export const blogPostHandlers = [
  // Query: BlogPostsList (Matches POSTS_LIST_QUERY)
  graphql.query('BlogPostsList', (info => {
    const { variables } = info;
    const { paging, filter, sorting } = variables as any; // Cast to any for easier handling in mock
    let postsToReturn = [...mockBlogPosts];

    // Apply filtering (simple example, extend as needed)
    if (filter?.title?.iLike) {
      postsToReturn = postsToReturn.filter(p => 
        p.title.toLowerCase().includes(filter.title.iLike.toLowerCase())
      );
    }
    if (filter?.status?.eq) {
      postsToReturn = postsToReturn.filter(p => p.status === filter.status.eq);
    }
    if (filter?.category?.id?.eq) {
      postsToReturn = postsToReturn.filter(p => p.categoryId === filter.category.id.eq);
    }

    // Apply sorting (simple example for one sort field)
    if (sorting && sorting.length > 0) {
      const sortInfo = sorting[0];
      postsToReturn.sort((a: MockBlogPost, b: MockBlogPost) => {
        const fieldA = a[sortInfo.field as keyof MockBlogPost];
        const fieldB = b[sortInfo.field as keyof MockBlogPost];
        let comparison = 0;
        if (fieldA > fieldB) comparison = 1;
        if (fieldA < fieldB) comparison = -1;
        return sortInfo.direction === 'DESC' ? comparison * -1 : comparison;
      });
    }

    const totalCount = postsToReturn.length;
    const offset = paging?.offset || 0;
    const limit = paging?.limit || 10;
    const nodes = postsToReturn.slice(offset, offset + limit);

    return HttpResponse.json({
      data: {
        blogPosts: {
          nodes: nodes.map(p => ({ // Ensure returned fields match POSTS_LIST_QUERY
            id: p.id,
            title: p.title,
            category: { title: p.category.title }, // Nested category title
            content: p.content.substring(0, 100) + '...', // Shorten content for list view
            createdAt: p.createdAt,
          })),
          totalCount,
        },
      },
    });
  })),

  // Query: PostShow (Matches POST_SHOW_QUERY)
  graphql.query('PostShow', (info => {
    const { variables } = info;
    const { id } = variables as { id: string };
    const post = mockBlogPosts.find(p => p.id === id);

    if (!post) {
      return HttpResponse.json({ errors: [{ message: 'Post not found' }] }, { status: 404 });
    }
    // Ensure returned fields match POST_SHOW_QUERY
    return HttpResponse.json({
      data: {
        blogPost: {
          id: post.id,
          title: post.title,
          status: post.status,
          category: { title: post.category.title },
          content: post.content,
        },
      },
    });
  })),

  // Mutation: PostCreate (Matches POST_CREATE_MUTATION)
  graphql.mutation('PostCreate', (async info => {
    const { variables } = info;
    const { input } = variables as any; // { blogPost: { title, content, status, categoryId } }
    try {
      const newPostData = input.blogPost;
      const createdPost = addBlogPost(newPostData);
      // Ensure returned fields match POST_CREATE_MUTATION
      return HttpResponse.json({
        data: {
          createOneBlogPost: {
            id: createdPost.id,
            title: createdPost.title,
            status: createdPost.status,
            category: { id: createdPost.categoryId }, // As per query
            content: createdPost.content,
          },
        },
      });
    } catch (e: any) {
      return HttpResponse.json({ errors: [{ message: e.message }] }, { status: 400 });
    }
  })),

  // Mutation: PostEdit (Matches POST_EDIT_MUTATION)
  graphql.mutation('PostEdit', (async info => {
    const { variables } = info;
    const { input } = variables as any; // { id: string, update: { title, content, status, categoryId } }
    try {
      const updatedPost = updateBlogPost(input.id, input.update);
      if (!updatedPost) {
        return HttpResponse.json({ errors: [{ message: 'Post not found to update' }] }, { status: 404 });
      }
      // Ensure returned fields match POST_EDIT_MUTATION
      return HttpResponse.json({
        data: {
          updateOneBlogPost: {
            id: updatedPost.id,
            title: updatedPost.title,
            status: updatedPost.status,
            category: { id: updatedPost.categoryId, title: updatedPost.category.title },
            categoryId: updatedPost.categoryId,
            content: updatedPost.content,
          },
        },
      });
    } catch (e: any) {
      return HttpResponse.json({ errors: [{ message: e.message }] }, { status: 400 });
    }
  })),
  
  // Query: CategoriesSelect (Matches CATEGORIES_SELECT_QUERY from posts/queries.ts)
  graphql.query('CategoriesSelect', (info => {
    // This query might not have variables, but good practice to include info
    return HttpResponse.json({
      data: {
        categories: {
          nodes: mockCategories.map(c => ({ id: c.id, title: c.title })),
        },
      },
    });
  })),
];