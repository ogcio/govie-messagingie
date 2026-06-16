"use client"

import {
  Button,
  FormField,
  InputText,
  Select,
  SelectItem,
  Stack,
} from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { isStatus } from "@/util/messaging"

export function SearchBar() {
  const t = useTranslations("search")
  const tEvent = useTranslations("event")
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchState, setSearchState] = useState({
    dateFrom: "",
    dateTo: "",
    search: "",
  })

  useEffect(() => {
    const status = searchParams.get("status")?.toString()
    if (isStatus(status) || !status) {
      const statusSelect = document.querySelector<HTMLSelectElement>("#status")
      if (statusSelect) {
        statusSelect.value = status || ""
      }
    }
    setSearchState({
      dateFrom: searchParams.get("dateFrom")?.toString() || "",
      dateTo: searchParams.get("dateTo")?.toString() || "",
      search: searchParams.get("search")?.toString() || "",
    })
  }, [searchParams])

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams)
    params.set("search", searchState.search)
    params.set("dateFrom", searchState.dateFrom)
    params.set("dateTo", searchState.dateTo)

    const statusSelect = document.querySelector<HTMLSelectElement>("#status")
    const status = statusSelect?.value
    if (isStatus(status) || status === "") {
      params.set("status", status)
    }
    router.push(`?${params.toString()}`)
  }

  const handleReset = () => {
    setSearchState({ dateFrom: "", dateTo: "", search: "" })
    const params = new URLSearchParams(searchParams)
    params.delete("search")
    params.delete("dateFrom")
    params.delete("dateTo")
    const statusSelect = document.querySelector<HTMLSelectElement>("#status")
    if (statusSelect) {
      statusSelect.value = ""
    }
    params.delete("status")
    router.push(`?${params}`)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchState((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <Stack
      direction='row'
      gap={3}
      wrap
      itemsAlignment='end'
      className='container'
    >
      <FormField
        label={{ text: t("label.from"), htmlFor: "dateFromSearch" }}
        className='gi-flex-1'
      >
        <InputText
          type='date'
          id='dateFromSearch'
          name='dateFrom'
          autoComplete='off'
          value={searchState.dateFrom}
          onChange={handleInputChange}
        />
      </FormField>

      <FormField
        label={{ text: t("label.to"), htmlFor: "dateToSearch" }}
        className='gi-flex-1'
      >
        <InputText
          type='date'
          id='dateToSearch'
          name='dateTo'
          autoComplete='off'
          onChange={handleInputChange}
          value={searchState.dateTo}
        />
      </FormField>

      <FormField
        label={{ text: t("label.status"), htmlFor: "status" }}
        className='gi-flex-1'
      >
        <Select id='status' className='gi-w-full'>
          <SelectItem value=''>{tEvent("select.option.all")}</SelectItem>
          <SelectItem value='delivered'>
            {tEvent("select.option.delivered")}
          </SelectItem>
          <SelectItem value='scheduled'>
            {tEvent("select.option.scheduled")}
          </SelectItem>
          <SelectItem value='opened'>
            {tEvent("select.option.opened")}
          </SelectItem>
          <SelectItem value='failed'>
            {tEvent("select.option.failed")}
          </SelectItem>
        </Select>
      </FormField>

      <FormField
        label={{ text: t("label.search"), htmlFor: "textSearch" }}
        className='search-input'
      >
        <InputText
          id='textSearch'
          name='search'
          autoComplete='off'
          value={searchState.search}
          onChange={handleInputChange}
          placeholder={t("input.placeholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch()
            }
          }}
        />
      </FormField>

      <Button
        type='button'
        variant='primary'
        onClick={handleSearch}
        className='search-btn'
      >
        {t("button.search")}
      </Button>

      <Button
        type='button'
        variant='secondary'
        onClick={handleReset}
        className='search-btn'
      >
        {t("button.reset")}
      </Button>
    </Stack>
  )
}
