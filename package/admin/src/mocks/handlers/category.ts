import { graphql, HttpResponse } from 'msw';
import type { HandlerResolver } from './types';
import { mockCategories, addCategory, updateCategory } from '../data/categories.ts';

export const categoryHandlers = [
  // Query: CategoriesList (Matches CATEGORIES_LIST_QUERY)
  graphql.query('CategoriesList', (info => {
    const { variables } = info;
    const { paging, filter, sorting } = variables as any; // Cast for easier handling
    let categoriesToReturn = [...mockCategories];

    // Apply filtering (simple example)
    if (filter?.title?.iLike) {
      categoriesToReturn = categoriesToReturn.filter(c => 
        c.title.toLowerCase().includes(filter.title.iLike.toLowerCase())
      );
    }

    // Apply sorting (simple example for one sort field)
    if (sorting && sorting.length > 0) {
      const sortInfo = sorting[0];
      categoriesToReturn.sort((a, b) => {
        // Ensure field exists on type, or cast a/b to any if using arbitrary fields
        const fieldA = a[sortInfo.field as keyof typeof a]; 
        const fieldB = b[sortInfo.field as keyof typeof b];
        let comparison = 0;
        if (fieldA > fieldB) comparison = 1;
        if (fieldA < fieldB) comparison = -1;
        return sortInfo.direction === 'DESC' ? comparison * -1 : comparison;
      });
    }

    const totalCount = categoriesToReturn.length;
    const offset = paging?.offset || 0;
    const limit = paging?.limit || 10;
    const nodes = categoriesToReturn.slice(offset, offset + limit).map(c => ({ // Ensure returned fields match query
      id: c.id,
      title: c.title,
      createdAt: c.createdAt, // Query expects createdAt
    }));

    return HttpResponse.json({
      data: {
        categories: {
          nodes,
          totalCount,
        },
      },
    });
  }) as HandlerResolver),

  // Mutation: CategoryCreate (Matches CATEGORY_CREATE_MUTATION)
  graphql.mutation('CategoryCreate', (async info => {
    const { variables } = info;
    const { input } = variables as any; // { category: { title } }
    try {
      const newCatData = input.category; // refine nests the input under a key same as the resource name
      const createdCategory = addCategory(newCatData);
      // Ensure returned fields match CATEGORY_CREATE_MUTATION
      return HttpResponse.json({
        data: {
          createOneCategory: {
            id: createdCategory.id,
            title: createdCategory.title,
          },
        },
      });
    } catch (e: any) {
      return HttpResponse.json({ errors: [{ message: e.message }] }, { status: 400 });
    }
  }) as HandlerResolver),

  // Mutation: CategoryEdit (Matches CATEGORY_EDIT_MUTATION)
  graphql.mutation('CategoryEdit', (async info => {
    const { variables } = info;
    const { input } = variables as any; // { id: string, update: { title } }
    try {
      const updatedCategory = updateCategory(input.id, input.update);
      if (!updatedCategory) {
        return HttpResponse.json({ errors: [{ message: 'Category not found to update' }] }, { status: 404 });
      }
      // Ensure returned fields match CATEGORY_EDIT_MUTATION
      return HttpResponse.json({
        data: {
          updateOneCategory: {
            id: updatedCategory.id,
            title: updatedCategory.title,
          },
        },
      });
    } catch (e: any) {
      return HttpResponse.json({ errors: [{ message: e.message }] }, { status: 400 });
    }
  }) as HandlerResolver),

  // Note: GetCategory (single) was in the original file but not in refine queries.ts.
  // If needed, it can be added back.
  // graphql.query('GetCategory', ...) 
]; 