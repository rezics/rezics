/**
 * Functional programming utilities using Effect-TS
 *
 * This module provides common functional patterns and utilities.
 */

import { pipe } from "effect/Function";
import * as Array from "effect/Array";
import * as Option from "effect/Option";
import * as Either from "effect/Either";

// Re-export commonly used functions for convenience
export { pipe };
export { Array as A, Array as RA, Option as O, Either as E };

/**
 * Safe array operations that return Option instead of throwing
 */
export const safeArray = {
    /**
     * Safely get the first element of an array
     */
    head: <T>(arr: ReadonlyArray<T>): Option.Option<T> => Array.head(arr),

    /**
     * Safely get the last element of an array
     */
    last: <T>(arr: ReadonlyArray<T>): Option.Option<T> => Array.last(arr),

    /**
     * Safely get element at index
     */
    lookup:
        <T>(index: number) =>
        (arr: ReadonlyArray<T>): Option.Option<T> =>
            Array.get(arr, index),

    /**
     * Find element that satisfies predicate
     */
    find:
        <T>(predicate: (item: T) => boolean) =>
        (arr: ReadonlyArray<T>): Option.Option<T> =>
            Array.findFirst(arr, predicate),
};

/**
 * Utility for working with nullable values
 */
export const nullable = {
    /**
     * Convert nullable value to Option
     */
    fromNullable: <T>(value: T | null | undefined): Option.Option<T> => Option.fromNullable(value),

    /**
     * Convert Option to nullable value
     */
    toNullable: <T>(option: Option.Option<T>): T | null => Option.getOrNull(option),

    /**
     * Apply function to non-null value
     */
    map:
        <T, U>(f: (value: T) => U) =>
        (value: T | null | undefined): U | null =>
            pipe(value, Option.fromNullable, Option.map(f), Option.getOrNull),
};

/**
 * Utility for error handling and validation
 */
export const validation = {
    /**
     * Try to execute a function, catching errors and returning Either
     */
    tryCatch: <T>(f: () => T): Either.Either<T, Error> =>
        Either.try({
            try: f,
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }),

    /**
     * Chain multiple validations
     */
    chain:
        <E, A, B>(f: (a: A) => Either.Either<B, E>) =>
        (either: Either.Either<A, E>): Either.Either<B, E> =>
            Either.flatMap(either, f),

    /**
     * Fold Either into a single value
     */
    fold:
        <E, A, B>(onLeft: (e: E) => B, onRight: (a: A) => B) =>
        (either: Either.Either<A, E>): B =>
            Either.match(either, { onLeft, onRight }),
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
                Array.filter((s: string) => s.length > 0),
            ),

    /**
     * Trim and convert to Option (None if empty)
     */
    trimToOption: (str: string): Option.Option<string> =>
        pipe(str.trim(), (s) => (s.length > 0 ? Option.some(s) : Option.none())),

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
        (obj: T): Option.Option<T[K]> =>
            Option.fromNullable(obj[key]),

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
        (): Promise<Either.Either<T, Error>> =>
            promise
                .then((value) => Either.right(value))
                .catch((error) => Either.left(error instanceof Error ? error : new Error(String(error)))),

    /**
     * Sequence array of async operations
     */
    sequence: <T>(promises: ReadonlyArray<Promise<T>>): Promise<ReadonlyArray<T>> => Promise.all(promises),
};
