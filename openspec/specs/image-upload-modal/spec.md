# image-upload-modal Specification

## Purpose

Defines the `ImageModal` component in `@rezics/ui`: a tabbed
dialog whose tabs are pluggable `ImageProvider` entries. Owns the
default provider set (Rezics R2 upload plus ImgBB / Postimages /
Imgbox guides via the shared `ExternalImageGuide`), the
file-picker / paste / drag-drop upload paths with
`browser-image-compression` (`maxSizeMB: 4.5`,
`maxWidthOrHeight: 4096`), JPEG/PNG/WebP/GIF validation, loading
and error states, and the `onInsert(url, alt?)` close-on-success
contract.

## Requirements

### Requirement: Image modal component

The `@rezics/ui` package SHALL provide an `ImageModal` component that renders a tabbed dialog for obtaining image URLs from multiple providers.

#### Scenario: Open modal
- **WHEN** the modal `open` prop is `true`
- **THEN** a dialog SHALL render with tabs for each configured image provider
- **AND** the first tab SHALL be selected by default

#### Scenario: Close modal
- **WHEN** the user clicks the close button or presses Escape
- **THEN** the `onClose` callback SHALL be invoked
- **AND** the modal SHALL unmount

#### Scenario: Insert image from any provider
- **WHEN** a provider tab calls `onInsert(url, alt?)` with a URL
- **THEN** the `onInsert` prop callback SHALL be invoked with the URL and optional alt text
- **AND** the modal SHALL close automatically

### Requirement: Image provider interface

The modal SHALL accept an `providers` prop of type `ImageProvider[]`. Each provider SHALL conform to:

```typescript
interface ImageProvider {
  name: string;
  label: string;
  icon: ReactNode;
  render: (props: { onInsert: (url: string, alt?: string) => void }) => ReactNode;
}
```

#### Scenario: Custom provider set
- **WHEN** the consumer passes a custom `providers` array
- **THEN** only the specified providers SHALL render as tabs

#### Scenario: Default providers
- **WHEN** no `providers` prop is given
- **THEN** the modal SHALL render the default provider set: Rezics Upload, ImgBB guide, Postimages guide, Imgbox guide

### Requirement: Rezics Upload provider

The upload provider SHALL allow users to upload images to Cloudflare R2 via the Rezics server API.

#### Scenario: Upload via file picker
- **WHEN** the user clicks the file picker and selects an image file
- **THEN** the image SHALL be compressed client-side using `browser-image-compression`
- **AND** the compressed image SHALL be uploaded via `POST /api/upload/image`
- **AND** on success, `onInsert` SHALL be called with the returned R2 URL

#### Scenario: Upload via paste
- **WHEN** the user pastes an image from the clipboard into the upload zone
- **THEN** the pasted image SHALL be compressed and uploaded following the same flow as file picker

#### Scenario: Upload via drag and drop
- **WHEN** the user drags and drops an image file onto the upload zone
- **THEN** the dropped image SHALL be compressed and uploaded following the same flow as file picker

#### Scenario: Upload progress
- **WHEN** an image upload is in progress
- **THEN** a loading indicator SHALL be displayed within the upload tab

#### Scenario: Upload error
- **WHEN** the upload request fails
- **THEN** an error message SHALL be displayed within the upload tab
- **AND** the user SHALL be able to retry

#### Scenario: File type validation
- **WHEN** the user selects a non-image file or an unsupported image type
- **THEN** the upload SHALL be rejected with a validation message
- **AND** the accepted types SHALL be: JPEG, PNG, WebP, GIF

#### Scenario: Compression configuration
- **WHEN** an image is selected for upload
- **THEN** it SHALL be compressed with `maxSizeMB: 4.5`, `maxWidthOrHeight: 4096`, and `useWebWorker: true`

### Requirement: External image guide provider

The `@rezics/ui` package SHALL provide a reusable `ExternalImageGuide` component for building guided-flow tabs for third-party image hosting services.

#### Scenario: Guide tab rendering
- **WHEN** a guide provider tab is active
- **THEN** the tab SHALL display: the service name, numbered step-by-step instructions, a link to open the service in a new tab, and a URL input field with an Insert button

#### Scenario: Insert from guide
- **WHEN** the user pastes a URL into the input field and clicks Insert (or presses Enter)
- **THEN** `onInsert` SHALL be called with the entered URL

#### Scenario: URL validation
- **WHEN** the user enters text that is not a valid URL
- **THEN** the Insert button SHALL be disabled

### Requirement: Default guide providers

Three guide providers SHALL be included by default.

#### Scenario: ImgBB guide
- **WHEN** the ImgBB tab is active
- **THEN** instructions SHALL guide the user to open imgbb.com, upload an image, and copy the direct image URL

#### Scenario: Postimages guide
- **WHEN** the Postimages tab is active
- **THEN** instructions SHALL guide the user to open postimages.org, upload an image, and copy the direct link

#### Scenario: Imgbox guide
- **WHEN** the Imgbox tab is active
- **THEN** instructions SHALL guide the user to open imgbox.com, upload an image, and copy the direct image link
