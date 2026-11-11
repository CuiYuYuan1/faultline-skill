// Keep model-provided strings literal when a downloaded report is rendered as Markdown.
export function markdownText(value) {
  return value.replace(/[\\`*_{}\[\]<>()#!|~&+-]/g, char => `\\${char}`).replace(/[\r\n\u2028\u2029]+/g, ' ');
}
