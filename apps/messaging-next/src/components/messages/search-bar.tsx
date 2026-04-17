"use client"

import { Button, InputText, Stack } from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

export function SearchBar() {
  const t = useTranslations("search")
  const searchParams = useSearchParams()
  const router = useRouter()
  const [value, setValue] = useState("")

  useEffect(() => {
    setValue(searchParams.get("search") ?? "")
  }, [searchParams])

  const search = () => {
    const params = new URLSearchParams(searchParams)
    params.delete("page")
    params.set("search", value)
    router.push(`?${params.toString()}`)
  }

  const reset = () => {
    router.push("?")
  }

  return (
    <div style={{ width: "100%" }}>
      <Stack
        direction='row'
        gap={3}
        itemsAlignment='end'
        fixedHeight='fit-content'
        aria-label={t("ariaLabel")}
      >
        <InputText
          placeholder={t("input.placeholder")}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setValue(e.target.value)
          }
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && search()}
          aria-label={t("button.search")}
        />
        <Button onClick={search}>{t("button.search")}</Button>
        <Button variant='secondary' onClick={reset}>
          {t("button.reset")}
        </Button>
      </Stack>
    </div>
  )
}
