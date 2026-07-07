// Local-file save/open for the backup feature. Anchor download + a transient
// <input type="file"> — the lowest common denominator that works in iOS Safari
// standalone PWAs (no showSaveFilePicker/showOpenFilePicker on WebKit).

/** Offer `text` as a file download named `filename`. */
export function downloadTextFile(filename: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Deferred: revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Open the system file picker and read the chosen file as text. Resolves
 * `null` when the user cancels. Must be called from a user gesture.
 */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      file.text().then(resolve, () => resolve(null))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
