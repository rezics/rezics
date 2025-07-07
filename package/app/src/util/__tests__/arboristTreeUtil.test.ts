/**
 * Tests for the refactored tree utility functions
 * 
 * These tests verify that our functional refactoring maintains
 * the same behavior as the original imperative code.
 */

import { describe, it, expect } from '@jest/globals';
import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast
} from '../arboristTreeUtil';

// Test data
const createTestTree = () => [
  {
    id: '1',
    title: 'Root 1',
    children: [
      { id: '1-1', title: 'Child 1-1' },
      { id: '1-2', title: 'Child 1-2' }
    ]
  },
  {
    id: '2',
    title: 'Root 2',
    children: [
      { id: '2-1', title: 'Child 2-1' }
    ]
  },
  { id: '3', title: 'Root 3' }
];

describe('Tree Utility Functions', () => {
  describe('findAndAddChild', () => {
    it('should add child to existing parent', () => {
      const tree = createTestTree();
      const newChild = { id: '1-3', title: 'Child 1-3' };
      
      const result = findAndAddChild(tree, '1', newChild);
      
      expect(result[0].children).toHaveLength(3);
      expect(result[0].children![2]).toEqual(newChild);
    });

    it('should add child to node without existing children', () => {
      const tree = createTestTree();
      const newChild = { id: '3-1', title: 'Child 3-1' };
      
      const result = findAndAddChild(tree, '3', newChild);
      
      expect(result[2].children).toEqual([newChild]);
    });
  });

  describe('findAndDelete', () => {
    it('should delete nodes by id', () => {
      const tree = createTestTree();
      
      const result = findAndDelete(tree, ['2']);
      
      expect(result).toHaveLength(2);
      expect(result.find(node => node.id === '2')).toBeUndefined();
    });

    it('should delete nested nodes', () => {
      const tree = createTestTree();
      
      const result = findAndDelete(tree, ['1-1']);
      
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].id).toBe('1-2');
    });
  });

  describe('findAndEdit', () => {
    it('should edit node title', () => {
      const tree = createTestTree();
      
      const result = findAndEdit(tree, '1', 'Updated Root 1');
      
      expect(result[0].title).toBe('Updated Root 1');
    });

    it('should edit nested node title', () => {
      const tree = createTestTree();
      
      const result = findAndEdit(tree, '1-1', 'Updated Child 1-1');
      
      expect(result[0].children![0].title).toBe('Updated Child 1-1');
    });
  });

  describe('insertSiblingAfter', () => {
    it('should insert sibling after target node', () => {
      const tree = createTestTree();
      const newNode = { id: '1.5', title: 'Between 1 and 2' };
      
      const result = insertSiblingAfter(tree, '1', newNode);
      
      expect(result).toHaveLength(4);
      expect(result[1]).toEqual(newNode);
    });

    it('should insert sibling in nested structure', () => {
      const tree = createTestTree();
      const newNode = { id: '1-1.5', title: 'Between 1-1 and 1-2' };
      
      const result = insertSiblingAfter(tree, '1-1', newNode);
      
      expect(result[0].children).toHaveLength(3);
      expect(result[0].children![1]).toEqual(newNode);
    });
  });

  describe('moveSiblingFirst', () => {
    it('should move node to first position', () => {
      const tree = createTestTree();
      
      const result = moveSiblingFirst(tree, '3');
      
      expect(result[0].id).toBe('3');
      expect(result).toHaveLength(3);
    });

    it('should move nested node to first position', () => {
      const tree = createTestTree();
      
      const result = moveSiblingFirst(tree, '1-2');
      
      expect(result[0].children![0].id).toBe('1-2');
      expect(result[0].children![1].id).toBe('1-1');
    });
  });

  describe('moveSiblingLast', () => {
    it('should move node to last position', () => {
      const tree = createTestTree();
      
      const result = moveSiblingLast(tree, '1');
      
      expect(result[2].id).toBe('1');
      expect(result).toHaveLength(3);
    });

    it('should move nested node to last position', () => {
      const tree = createTestTree();
      
      const result = moveSiblingLast(tree, '1-1');
      
      expect(result[0].children![1].id).toBe('1-1');
      expect(result[0].children![0].id).toBe('1-2');
    });
  });

  describe('immutability', () => {
    it('should not mutate original tree', () => {
      const tree = createTestTree();
      const originalTree = JSON.parse(JSON.stringify(tree));
      
      findAndAddChild(tree, '1', { id: 'new', title: 'New' });
      
      expect(tree).toEqual(originalTree);
    });

    it('should return new objects, not references', () => {
      const tree = createTestTree();
      
      const result = findAndEdit(tree, '1', 'Updated');
      
      expect(result).not.toBe(tree);
      expect(result[0]).not.toBe(tree[0]);
    });
  });
});

export { };