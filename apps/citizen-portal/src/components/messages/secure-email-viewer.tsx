"use client"

import { useEffect, useRef, useState } from "react"

// frame-ancestors deliberately omitted: per CSP3 spec it is ignored when
// delivered via <meta>, and the parent app already enforces framing
// protection via X-Frame-Options/CSP HTTP headers (nginx).
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
  upgrade-insecure-requests;
`.replace(/\n/g, "")

export function SecureEmailViewer({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState("0px")

  // We use a MessageChannel for iframe -> parent height comms instead of
  // window.parent.postMessage. window-level "message" listeners (e.g. Matomo's
  // visitorIdHandshake handler, which does `new URL(event.origin)`) crash on
  // messages from sandboxed iframes whose event.origin is the literal "null".
  // MessageChannel ports bypass window-level listeners entirely.
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      if (event.data?.type === "IFRAME_HEIGHT") {
        setHeight(`${event.data.height}px`)
      }
    }

    const handleLoad = () => {
      iframe.contentWindow?.postMessage({ type: "INIT_HEIGHT_PORT" }, "*", [
        channel.port2,
      ])
    }
    iframe.addEventListener("load", handleLoad)

    return () => {
      iframe.removeEventListener("load", handleLoad)
      channel.port1.close()
    }
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
    let heightPort;
    function sendHeight() {
      if (!heightPort) return;
      heightPort.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight });
    }
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'INIT_HEIGHT_PORT' && event.ports[0]) {
        heightPort = event.ports[0];
        sendHeight();
        new ResizeObserver(sendHeight).observe(document.body);
      }
    });
  </script>
  <style>
    body {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      max-width: 100%;
      overflow-x: hidden;
      font-family: Lato, Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.35;
      color: #0b0c0c;
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
    p { margin: 0 0 0.5rem; }
    p:last-child { margin-bottom: 0; }
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
