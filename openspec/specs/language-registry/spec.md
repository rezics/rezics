## ADDED Requirements

### Requirement: Canonical language code registry

The `@rezics/contract` package SHALL export a `LANGUAGES` constant defining exactly 5 canonical language codes: `zh-hant`, `zh-hans`, `en`, `ja`, `de`. All codes SHALL be lowercase. No bare script-ambiguous codes (e.g., `zh`) SHALL exist in the registry.

#### Scenario: LANGUAGES contains exactly the canonical set

- **WHEN** a consumer imports `LANGUAGES` from `@rezics/contract`
- **THEN** the values SHALL be `['zh-hant', 'zh-hans', 'en', 'ja', 'de']`
- **AND** all values SHALL be lowercase strings

#### Scenario: No bare Chinese code exists

- **WHEN** a consumer inspects all values in `LANGUAGES`
- **THEN** no value SHALL equal `'zh'`
- **AND** no value SHALL lack a script subtag for Chinese (`zh-hant` and `zh-hans` both include script)

### Requirement: Typebox language validation schema

The contract SHALL export a `languageSchema` (Typebox union of literals) that validates language strings against the canonical set. Only the 5 canonical codes SHALL pass validation.

#### Scenario: Canonical code passes validation

- **WHEN** the value `'zh-hant'` is validated against `languageSchema`
- **THEN** validation SHALL pass

#### Scenario: Legacy code fails validation

- **WHEN** the value `'zh-CN'` is validated against `languageSchema`
- **THEN** validation SHALL fail

#### Scenario: Bare code fails validation

- **WHEN** the value `'zh'` is validated against `languageSchema`
- **THEN** validation SHALL fail

#### Scenario: Arbitrary string fails validation

- **WHEN** the value `'klingon'` is validated against `languageSchema`
- **THEN** validation SHALL fail

### Requirement: Language display metadata

The contract SHALL export `LANGUAGE_META` providing `name` (English display name) and `nativeName` (native script display name) for each canonical code.

#### Scenario: Metadata available for all languages

- **WHEN** a consumer reads `LANGUAGE_META`
- **THEN** entries SHALL exist for all 5 canonical codes
- **AND** `LANGUAGE_META['zh-hant']` SHALL include `name: 'Traditional Chinese'` and `nativeName: '繁體中文'`

### Requirement: Platform default and fallback language constants

The contract SHALL export `DEFAULT_LANGUAGE` with value `'zh-hant'` and `FALLBACK_LANGUAGE` with value `'en'`.

#### Scenario: Default language is zh-hant

- **WHEN** a consumer imports `DEFAULT_LANGUAGE`
- **THEN** the value SHALL be `'zh-hant'`

#### Scenario: Fallback language is en

- **WHEN** a consumer imports `FALLBACK_LANGUAGE`
- **THEN** the value SHALL be `'en'`

### Requirement: Canonical code normalization

The contract SHALL export a `normalizeLanguage(code: string)` function that normalizes canonical codes case-insensitively. Non-canonical codes SHALL return `null`.

#### Scenario: Reject zh-CN

- **WHEN** `normalizeLanguage('zh-CN')` is called
- **THEN** the result SHALL be `null`

#### Scenario: Reject zh-SC

- **WHEN** `normalizeLanguage('zh-SC')` is called
- **THEN** the result SHALL be `null`

#### Scenario: Reject zh-TC

- **WHEN** `normalizeLanguage('zh-TC')` is called
- **THEN** the result SHALL be `null`

#### Scenario: Reject en-US

- **WHEN** `normalizeLanguage('en-US')` is called
- **THEN** the result SHALL be `null`

#### Scenario: Canonical code passes through

- **WHEN** `normalizeLanguage('zh-hant')` is called
- **THEN** the result SHALL be `'zh-hant'`

#### Scenario: Unknown code returns null

- **WHEN** `normalizeLanguage('ko')` is called
- **THEN** the result SHALL be `null`

#### Scenario: Case-insensitive normalization

- **WHEN** `normalizeLanguage('ZH-HANT')` is called
- **THEN** the result SHALL be `'zh-hant'`

