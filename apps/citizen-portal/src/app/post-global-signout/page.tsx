import { PostGlobalSignout } from "@/components/post-global-signout"

/**
 * Standalone (no-locale) destination after a successful global signout.
 * The gateway redirects here so the browser sits on a quiet page while
 * the post-signout redirect cookie is consumed.
 */
export default function PostGlobalSignoutPage() {
  return <PostGlobalSignout />
}
