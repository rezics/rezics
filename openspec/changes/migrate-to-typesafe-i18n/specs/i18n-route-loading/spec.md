## ADDED Requirements

### Requirement: Namespace loading in route beforeLoad

Each TanStack Router route SHALL load its required translation namespaces in the route's `beforeLoad` hook. Multiple namespaces SHALL be loaded concurrently via `Promise.all`. Translations SHALL be available synchronously when the route component renders.

#### Scenario: Home route loads multiple namespaces
- **WHEN** the user navigates to the home route (`/`)
- **THEN** the `home`, `readlist`, `review`, `quote`, and `search` namespaces are loaded in parallel before the Home component renders

#### Scenario: Simple route loads single namespace
- **WHEN** the user navigates to the tag page
- **THEN** only the `tag` namespace is loaded before render

#### Scenario: No flash of untranslated content
- **WHEN** a route loads and its namespaces are being fetched
- **THEN** the route component does NOT render until all required namespaces have resolved

### Requirement: Namespace caching across navigations

Once a namespace has been loaded for a locale, subsequent navigations to routes requiring the same namespace SHALL NOT trigger additional network requests.

#### Scenario: Cached namespace on re-navigation
- **WHEN** the user visits Home (loads `readlist` namespace), then navigates to Readlist Detail
- **THEN** the `readlist` namespace is already cached and is NOT re-fetched

### Requirement: Root namespace loaded with locale

The root namespace (layout, common strings) SHALL be loaded as part of the initial `loadLocaleAsync` call at app startup. It SHALL be available on every route without explicit loading in `beforeLoad`.

#### Scenario: Layout strings available without namespace loading
- **WHEN** any route renders and accesses `LL.layout.header.toggle_language()`
- **THEN** the string is available because root translations were loaded at startup

### Requirement: Admin route namespace loading

Admin routes SHALL load the `admin` namespace. Shared namespaces (e.g., `user`) SHALL be loaded using the same `loadNamespaceAsync` mechanism.

#### Scenario: Admin dashboard loads admin namespace
- **WHEN** the admin dashboard route loads
- **THEN** the `admin` namespace is loaded via `beforeLoad`
