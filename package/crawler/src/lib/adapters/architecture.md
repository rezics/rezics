# Adapter Architecture

## Overview

The Crawler Adapter system provides a standardized, plugin-based architecture
for fetching book metadata from various online platforms. Each "Adapter" is a
self-contained module responsible for the scraping and parsing logic specific to
one source.

This design ensures that the core application remains decoupled from the
specific implementation details of each data source, allowing for the easy
addition, removal, or modification of crawlers.

## Core Design

The architecture is centered around a common `Adapter` interface that every
plugin must implement. The primary data model exchanged is a standardized `Book`
object.

### The Adapter Interface

Each adapter must export an object that conforms to the `Adapter` interface.
This interface defines a set of asynchronous generator methods for retrieving
book information. The use of `AsyncGenerator` allows for efficient, stream-based
processing of results, which is ideal for handling network latency and large
datasets.

### The Book Data Model

All adapters must return data normalized into the `Book` object structure. This
ensures consistency across different data sources. See the interface definition
above for the specific fields. Fields marked with `?` are optional, as not all
sources may provide this information.

## Design Rationale

### Asynchronous Generators (`AsyncGenerator`)

The choice to use `AsyncGenerator<Book>` for all data-fetching methods is
intentional and provides several key benefits:

- **Memory Efficiency**: Results are streamed one by one instead of being
  collected into a large array in memory. This is crucial when a search query
  returns hundreds or thousands of books.
- **Responsiveness**: The application can process and display results as they
  arrive, rather than waiting for the entire scraping process to complete. This
  leads to a much better user experience.
- **Composable and Backpressure-Friendly**: Streams can be easily composed,
  transformed, and piped. The consumer controls the rate of consumption,
  naturally handling backpressure.

## Implementation Guidelines

### Adapter Module

Each adapter should be a separate module (e.g., a file like `qidian.ts`). The
module's default export must be an object that fully implements the `Adapter`
interface.
