/**
 * Stub endpoint hit by the global-signout iframe fan-out.
 *
 * The presence of the route at this URL is what matters — it returns a
 * 200 so the iframe `onload` handler fires and the orchestrator counts
 * one more app as "signed out". No body, no chrome.
 */
export default function ApplicationSignoutPage() {
  return null
}
