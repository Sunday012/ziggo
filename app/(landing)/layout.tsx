import React from 'react'
import { Header } from './_components/header'

export default function LandingLayout(
    {children}:{children: React.ReactNode}
) {
  return (
    <div>
        <Header />
        {children}
    </div>
  )
}
