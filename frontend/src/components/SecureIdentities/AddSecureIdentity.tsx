// src/components/SecureIdentities/AddSecureIdentity.tsx
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { Loader2, Plus, ShieldCheck, Lock } from "lucide-react"
import { toast } from "sonner" // or your preferred toast lib

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SecureIdentitiesService } from "@/client"
import { useSecureBridge } from "@/hooks/useSecureBridge"

interface SecureIdentityForm {
  fullName: string
  nationalId: string
}

export default function AddSecureIdentity() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { bridge, ready, error } = useSecureBridge()
  
  const { register, handleSubmit, reset } = useForm<SecureIdentityForm>()

  const mutation = useMutation({
    mutationFn: async (formData: SecureIdentityForm) => {
      if (!ready) throw new Error("Encryption not ready")

      // 1. Encrypt the Sensitive Data (National ID)
      const encryptedPayload = await bridge.encrypt(formData.nationalId)

      // 2. Send payload to backend
      // We send the cleartext name + encrypted sensitive data
      return SecureIdentitiesService.createSecureIdentity({
        full_name: formData.fullName,
        ...encryptedPayload, 
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secure-identities"] })
      setOpen(false)
      reset()
      toast.success("Identity encrypted and stored securely.")
    },
    onError: (err) => {
      toast.error("Failed to save identity.", { description: err.message })
    }
  })

  const onSubmit = (data: SecureIdentityForm) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!ready}>
          {ready ? <Plus className="mr-2 h-4 w-4" /> : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Secure Identity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Secure Ingress
          </DialogTitle>
          <DialogDescription>
            Data entered here is encrypted in your browser before being sent.
          </DialogDescription>
        </DialogHeader>
        
        {error ? (
           <div className="text-red-500 text-sm">{error}</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name (Stored Cleartext)</Label>
              <Input id="name" {...register("fullName", { required: true })} />
            </div>

            <div className="grid gap-2 relative">
              <Label htmlFor="nid" className="flex items-center gap-1">
                 National ID <Lock className="h-3 w-3 text-muted-foreground"/>
              </Label>
              <Input 
                id="nid" 
                placeholder="A-123-456" 
                className="pr-10"
                {...register("nationalId", { required: true })} 
              />
            </div>
            
            <div className="flex justify-end pt-4">
               <Button type="submit" disabled={mutation.isPending || !ready}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Encrypt & Save
               </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}