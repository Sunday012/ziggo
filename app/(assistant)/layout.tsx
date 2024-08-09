import React from 'react'
import { SideNav } from './_components/sidenav'

export default function AssistantLayout(
    {children} : {children: React.ReactNode}
) {
  return (
    <div className='flex w-full'>
      <SideNav />
        {children}
    </div>
  )
}
