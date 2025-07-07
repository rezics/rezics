/**
 * Functional programming utilities using fp-ts
 *
 * This module provides common functional patterns and utilities
 * to make code more Correct, Efficient, and Beautiful.
 */

import { pipe } from "fp-ts/lib/function";
import * as A from "fp-ts/lib/Array";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import * as NEA from "fp-ts/lib/NonEmptyArray";

// Re-export commonly used functions for convenience
export { pipe };
export { A, RA, O, E, NEA };

/**
 * Safe array operations that return Option instead of throwing
 */
export const safeArray = {
    /**
     * Safely get the first element of an array
     */
    head: <T>(arr: ReadonlyArray<T>): O.Option<T> => A.head(arr),

    /**
     * Safely get the last element of an array
     */
    last: <T>(arr: ReadonlyArray<T>): O.Option<T> => A.last(arr),

    /**
     * Safely get element at index
     */
    lookup:
        <T>(index: number) =>
        (arr: ReadonlyArray<T>): O.Option<T> =>
            A.lookup(index)(arr),

    /**
     * Find element that satisfies predicate
     */
    find:
        <T>(predicate: (item: T) => boolean) =>
        (arr: ReadonlyArray<T>): O.Option<T> =>
            A.findFirst(predicate)(arr),
};

/**
 * Utility for working with nullable values
 */
export const nullable = {
    /**
     * Convert nullable value to Option
     */
    fromNullable: <T>(value: T | null | undefined): O.Option<T> => O.fromNullable(value),

    /**
     * Convert Option to nullable value
     */
    toNullable: <T>(option: O.Option<T>): T | null => O.toNullable(option),

    /**
     * Apply function to non-null value
     */
    map:
        <T, U>(f: (value: T) => U) =>
        (value: T | null | undefined): U | null =>
            pipe(value, O.fromNullable, O.map(f), O.toNullable),
};

/**
 * Utility for error handling and validation
 */
export const validation = {
    /**
     * Try to execute a function, catching errors and returning Either
     */
    tryCatch: <T>(f: () => T): E.Either<Error, T> =>
        E.tryCatch(f, (error) => (error instanceof Error ? error : new Error(String(error)))),

    /**
     * Chain multiple validations
     */
    chain:
        <E, A, B>(f: (a: A) => E.Either<E, B>) =>
        (either: E.Either<E, A>): E.Either<E, B> =>
            E.chain(f)(either),

    /**
     * Fold Either into a single value
     */
    fold:
        <E, A, B>(onLeft: (e: E) => B, onRight: (a: A) => B) =>
        (either: E.Either<E, A>): B =>
            E.fold(onLeft, onRight)(either),
};

/**
 * Utility for string operations
 */
export const stringUtils = {
    /**
     * Safely split string and filter empty values
     */
    split:
        (separator: string | RegExp) =>
        (str: string): ReadonlyArray<string> =>
            pipe(
                str.split(separator),
                A.filter((s) => s.length > 0),
            ),

    /**
     * Trim and convert to Option (None if empty)
     */
    trimToOption: (str: string): O.Option<string> => pipe(str.trim(), (s) => (s.length > 0 ? O.some(s) : O.none)),

    /**
     * Check if string matches pattern
     */
    matches:
        (pattern: RegExp) =>
        (str: string): boolean =>
            pattern.test(str),
};

/**
 * Utility for working with objects
 */
export const objectUtils = {
    /**
     * Safely get property from object
     */
    prop:
        <T, K extends keyof T>(key: K) =>
        (obj: T): O.Option<T[K]> =>
            O.fromNullable(obj[key]),

    /**
     * Update object property immutably
     */
    updateProp:
        <T, K extends keyof T>(key: K, value: T[K]) =>
        (obj: T): T => ({ ...obj, [key]: value }),

    /**
     * Pick specific properties from object
     */
    pick:
        <T, K extends keyof T>(keys: ReadonlyArray<K>) =>
        (obj: T): Pick<T, K> =>
            keys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {} as Pick<T, K>),
};

/**
 * Utility for async operations
 */
export const asyncUtils = {
    /**
     * Convert Promise to TaskEither
     */
    fromPromise:
        <T>(promise: Promise<T>) =>
        (): Promise<E.Either<Error, T>> =>
            promise.then(E.right).catch((error) => E.left(error instanceof Error ? error : new Error(String(error)))),

    /**
     * Sequence array of async operations
     */
    sequence: <T>(promises: ReadonlyArray<Promise<T>>): Promise<ReadonlyArray<T>> => Promise.all(promises),
};
