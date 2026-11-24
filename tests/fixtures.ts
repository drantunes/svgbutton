export const presetHash = "2cc5f4129881e1e6a3592da4ed58420333fa4e610daae4cd4d6f341b4239791a"

export const monoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="12">
  <title>Café &amp; résumé</title>
  <g fill="none" stroke="currentColor" transform="translate(1 1)">
    <path d="M0 0 L 20 0 L10 8 Z"/>
    <circle cx="10" cy="4" r="2" fill="#000" stroke="none"/>
  </g>
</svg>`

export const invalidIcons = [
  '<svg viewBox="0 0 10 10"><path d="M0 0H10"></svg>',
  '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
  '<svg viewBox="0 0 10 10" onload="alert(1)"><circle r="1"/></svg>',
  '<svg viewBox="0 0 10 10"><foreignObject><body>HTML</body></foreignObject></svg>',
  '<svg viewBox="0 0 10 10"><use href="https://example.org/icon.svg#x"/></svg>',
  '<svg viewBox="0 0 10 10"><circle r="1" fill="url(https://example.org/p)"/></svg>',
  '<svg viewBox="0 0 10 10"><circle r="1" style="opacity:1"/></svg>',
  '<svg viewBox="0 0 10 10"><animate attributeName="fill"/></svg>',
  '<svg viewBox="0 0 10 10"><path d="M1 2 A2 2 0 2 1 4 4"/></svg>',
  '<svg viewBox="0 0 0 10"><circle r="1"/></svg>',
  '<?xml-stylesheet href="https://example.org/icon.css"?><svg width="10" height="10"><circle r="1"/></svg>',
  '<!DOCTYPE svg [<!ENTITY x SYSTEM "https://example.org/x">]><svg width="10" height="10"><title>&x;</title><circle r="1"/></svg>',
]

const points = Array.from({ length: 400 }, (_, i) => `${(i / 401).toFixed(8)} ${(1 - i / 401).toFixed(8)}`)
export const largeIcon = `<svg viewBox="0 0 1 1"><polyline points="${points.join(" ")}" fill="none" stroke="black"/></svg>`
