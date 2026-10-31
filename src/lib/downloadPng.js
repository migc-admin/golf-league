/**
 * Save a PNG data URL. iOS Safari ignores <a download>, so there it opens the image in a new tab
 * where it can be long-pressed and saved.
 */
export function downloadPng(dataUrl, filename) {
  const isMobileSafari = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (isMobileSafari) {
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(`<html><body style="margin:0;background:#000"><img src="${dataUrl}" style="max-width:100%;display:block"/></body></html>`)
      w.document.close()
    }
    return
  }
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
