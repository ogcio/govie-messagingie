"use client"

import { Suspense } from "react"
import { MyDashboard } from "@/components/dashboard/my-dashboard"

export default function MyDashboardPage() {
  return (
    <Suspense>
      <MyDashboard />
    </Suspense>
  )
}
