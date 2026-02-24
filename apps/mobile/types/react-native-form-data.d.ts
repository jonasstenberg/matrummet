/**
 * React Native extends FormData.append to accept file-like objects
 * with { uri, name, type } for native file uploads.
 */
interface FormData {
  append(name: string, value: { uri: string; name: string; type: string }): void
}
