"use client"

import { useEffect, useRef, useState } from "react"

const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-src 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, "")

export function SecureEmailViewer({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState("0px")

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "IFRAME_HEIGHT") {
        setHeight(`${event.data.height}px`)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="Referrer-Policy" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="${CSP_HEADER}">
  <base target="_blank">
  <script>
    function sendHeight() {
      window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight }, '*');
    }
    const ro = new ResizeObserver(sendHeight);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { sendHeight(); ro.observe(document.body); });
    } else {
      sendHeight(); ro.observe(document.body);
    }
  </script>
  <style>
    body { margin: 0; padding: 0; box-sizing: border-box; max-width: 100%; overflow-x: hidden; white-space: pre-wrap; overflow-wrap: break-word; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>${content}</body>
</html>`

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", height, border: "none" }}
      sandbox='allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox'
      title='Secure email content viewer'
      referrerPolicy='no-referrer'
      srcDoc={srcDoc}
    />
  )
}
