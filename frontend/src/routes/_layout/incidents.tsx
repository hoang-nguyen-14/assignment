import { createFileRoute } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import incidentMd from "@/client/core/part3/part3.md?raw"

export const Route = createFileRoute("/_layout/incidents")({
  component: IncidentsPage,
  head: () => ({
    meta: [{ title: "Incidents – Security Runbook" }],
  }),
})

function IncidentsPage() {
  return (
    <div className="w-full max-w-none">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          🚨 System Design & Incident Response
        </h1>
        <p className="text-muted-foreground">
          Official incident handling and remediation procedures
        </p>
      </div>

      {/* Markdown Content */}
      <article className="markdown max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {incidentMd}
        </ReactMarkdown>
      </article>
    </div>
  )
}
