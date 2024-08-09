import React from 'react'
import { OrganizationList } from "@clerk/nextjs"

export default function RegisterPage() {

  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
        <div>
        <OrganizationList 
        hidePersonal
        afterSelectOrganizationUrl="/assistant/:id"
        afterCreateOrganizationUrl="/assistant/:id"
        />
        </div>
    </div>
  )
}
