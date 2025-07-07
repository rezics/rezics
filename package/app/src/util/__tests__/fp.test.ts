/**
 * Tests for functional programming utilities
 */

import { describe, it, expect } from "@jest/globals";
import { pipe } from "../fp";
import { A, O } from "../fp";
import { safeArray, stringUtils, objectUtils } from "../fp";

// Test data
const testArray = [1, 2, 3, 4, 5];
const emptyArray: number[] = [];

describe("Functional Programming Utils", () => {
    describe("safeArray operations", () => {
        it("should safely get head of array", () => {
            expect(safeArray.head(testArray)).toEqual(O.some(1));
            expect(safeArray.head(emptyArray)).toEqual(O.none());
        });

        it("should safely get last of array", () => {
            expect(safeArray.last(testArray)).toEqual(O.some(5));
            expect(safeArray.last(emptyArray)).toEqual(O.none());
        });

        it("should safely lookup by index", () => {
            expect(safeArray.lookup(2)(testArray)).toEqual(O.some(3));
            expect(safeArray.lookup(10)(testArray)).toEqual(O.none());
        });

        it("should find element with predicate", () => {
            const isEven = (n: number) => n % 2 === 0;
            expect(safeArray.find(isEven)(testArray)).toEqual(O.some(2));
            expect(safeArray.find(isEven)([1, 3, 5])).toEqual(O.none());
        });
    });

    describe("stringUtils operations", () => {
        it("should split string and filter empty values", () => {
            const result = stringUtils.split(/\s+/)("hello  world   test");
            expect(result).toEqual(["hello", "world", "test"]);
        });

        it("should trim to option", () => {
            expect(stringUtils.trimToOption("  hello  ")).toEqual(O.some("hello"));
            expect(stringUtils.trimToOption("   ")).toEqual(O.none());
            expect(stringUtils.trimToOption("")).toEqual(O.none());
        });

        it("should check pattern matches", () => {
            const isEmail = stringUtils.matches(/\S+@\S+\.\S+/);
            expect(isEmail("test@example.com")).toBe(true);
            expect(isEmail("invalid-email")).toBe(false);
        });
    });

    describe("objectUtils operations", () => {
        const testObj = { name: "John", age: 30, city: "NYC" };

        it("should safely get property", () => {
            expect(objectUtils.prop("name")(testObj)).toEqual(O.some("John"));
            expect(objectUtils.prop("missing" as any)(testObj)).toEqual(O.some(undefined));
        });

        it("should update property immutably", () => {
            const updated = objectUtils.updateProp("age", 31)(testObj);
            expect(updated).toEqual({ name: "John", age: 31, city: "NYC" });
            expect(testObj.age).toBe(30); // Original unchanged
        });

        it("should pick specific properties", () => {
            const picked = objectUtils.pick(["name", "age"] as const)(testObj);
            expect(picked).toEqual({ name: "John", age: 30 });
        });
    });

    describe("functional composition with pipe", () => {
        it("should compose operations with pipe", () => {
            const result = pipe(
                [1, 2, 3, 4, 5, 6],
                A.filter((n) => n % 2 === 0),
                A.map((n) => n * 2),
                safeArray.head,
            );

            expect(result).toEqual(O.some(4)); // First even number (2) * 2
        });

        it("should handle empty results in composition", () => {
            const result = pipe(
                [1, 3, 5],
                A.filter((n) => n % 2 === 0), // No even numbers
                A.map((n) => n * 2),
                safeArray.head,
            );

            expect(result).toEqual(O.none());
        });
    });
});

// Export for potential use in other test files
export {};
