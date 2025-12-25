import { createFileRoute } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import secureBridgeMd from "@/client/core/part1/secure-bridge.md?raw"

export const Route = createFileRoute("/_layout/secure-bridges")({
  component: SecureBridgePage,
  head: () => ({
    meta: [{ title: "Secure Bridge – E2E Encryption Library" }],
  }),
})

/**
 * SecureBridgePage
 *
 * Renders the official documentation for the SecureBridge
 * client-side E2E encryption library.
 *
 * - Uses markdown for auditability and security review
 * - Syntax highlighting for crypto code
 * - GFM tables & callouts for clarity
 */
function SecureBridgePage() {
  return (
    <div className="w-full max-w-none">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          🔐 Secure Bridge – Client-side E2E Encryption
        </h1>
        <p className="text-muted-foreground">
          Hybrid cryptography library for safely transmitting PII
        </p>
      </div>

      {/* Markdown Content */}
      <article className="markdown max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {secureBridgeMd}
        </ReactMarkdown>
      </article>
    </div>
  )
}
