// src/routes/_layout/secure-identities.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldAlert, Search } from "lucide-react"
import { Suspense, useState } from "react"

import { SecureIdentitiesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddSecureIdentity from "@/components/SecureIdentities/AddSecureIdentity"
// We will update columns to include the delete action
import { columns } from "@/components/SecureIdentities/Columns" 
import { Input } from "@/components/ui/input" // Assuming you have shadcn input

// Placeholder loading component
function PendingIdentities() {
    return <div className="p-4 text-center">Loading Secure Vault...</div>
}

function getSecureIdentitiesQueryOptions() {
  return {
    queryFn: () => SecureIdentitiesService.readSecureIdentities({ skip: 0, limit: 100 }),
    queryKey: ["secure-identities"],
  }
}

export const Route = createFileRoute("/_layout/secure-identities")({
  component: SecureIdentities,
  head: () => ({
    meta: [{ title: "Secure Identities - Vault" }],
  }),
})

interface IdentitiesTableContentProps {
  searchQuery: string
}

function IdentitiesTableContent({ searchQuery }: IdentitiesTableContentProps) {
  const { data: identities } = useSuspenseQuery(getSecureIdentitiesQueryOptions())

  // Client-side filtering
  // Ideally, this happens server-side, but client-side works for limit: 100
  const filteredData = identities.data?.filter((identity) => {
    const searchLower = searchQuery.toLowerCase()
    // Adjust these fields based on your actual data structure (e.g., identity.email, identity.full_name)
    return (
      JSON.stringify(identity).toLowerCase().includes(searchLower)
    )
  }) || []

  if (!identities.data || identities.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Vault is empty</h3>
        <p className="text-muted-foreground">Add a new identity to test E2E encryption</p>
      </div>
    )
  }

  return (
    <div>
      {/* Show count of matches if searching */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground mb-4">
          Found {filteredData.length} result(s)
        </p>
      )}
      <DataTable columns={columns} data={filteredData} />
    </div>
  )
}

function IdentitiesTable({ searchQuery }: { searchQuery: string }) {
  return (
    <Suspense fallback={<PendingIdentities />}>
      <IdentitiesTableContent searchQuery={searchQuery} />
    </Suspense>
  )
}

function SecureIdentities() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Identities</h1>
          <p className="text-muted-foreground">
            Manage E2E Encrypted PII Data
          </p>
        </div>
        <AddSecureIdentity />
      </div>

      {/* Search Bar Area */}
      <div className="flex items-center space-x-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search identities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <IdentitiesTable searchQuery={searchQuery} />
    </div>
  )
}