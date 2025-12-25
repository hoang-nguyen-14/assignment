import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// 1. IMPORT the type from your client service (where you added the manual extension)
import { SecureIdentityResponse } from "@/client"

// 2. Remove the local 'SecureIdentity' type definition entirely.
// export type SecureIdentity = { ... }  <-- DELETE THIS

// 3. Update the generic to use 'SecureIdentityResponse'
export const columns: ColumnDef<SecureIdentityResponse>[] = [
  {
    accessorKey: "full_name",
    header: "Full Name",
  },
  {
    accessorKey: "blind_index",
    header: "National ID (Encrypted)",
    cell: ({ row }) => {
      return (
        <div className="flex items-center font-mono text-xs bg-muted px-2 py-1 rounded w-fit">
          <Lock className="w-3 h-3 mr-2 text-green-600" />
          <span>Secured</span>
        </div>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const identity = row.original
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(identity.id)}
            >
              Copy Record ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]