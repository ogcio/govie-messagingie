"use client"

import {
  Button,
  Chip,
  FormField,
  FormFieldLabel,
  InputText,
  Paragraph,
  SelectItemNext,
  SelectNext,
  Stack,
} from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import {
  buildAppliedFilter,
  dateOptions,
  decodeDateParam,
  decodeTextParam,
  isDateMeta,
  isTextMeta,
} from "@/utils/appliedFilter"
import type {
  AppliedFilter,
  ClientFilterKeyOption,
  DateMeta,
  FilterMeta,
} from "@/utils/appliedFilter.types"
import { Case, Switch } from "../Switch"

export default function Filter(props: { keyOptions: ClientFilterKeyOption[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const [chipState, setChipState] = useState<AppliedFilter[]>(
    () =>
      [...params.entries()]
        .map(([key, value]) => {
          const o = props.keyOptions.find((o) => o.value === key)
          if (!o) {
            return null
          }
          let appliedFilter: AppliedFilter | null = null
          switch (o.type) {
            case "date":
              appliedFilter = buildAppliedFilter({
                key,
                keylabel: o.label,
                meta: decodeDateParam(value),
              })
              break
            case "text":
              appliedFilter = buildAppliedFilter({
                key,
                keylabel: o.label,
                meta: decodeTextParam(value),
              })
              break
          }
          return appliedFilter
        })
        .filter(Boolean) as AppliedFilter[],
  )

  const [selectedKeyOption, setSelectedKeyOption] =
    useState<ClientFilterKeyOption | null>(null)
  const [draftFilter, setDraftFilter] = useState<FilterMeta | null>(null)

  const syncUrlWithChips = useCallback(
    (nextChipState: AppliedFilter[]) => {
      const urlParams = new URLSearchParams(
        nextChipState.map((chip) => [chip.key, chip.urlValue]),
      )
      setChipState(nextChipState)
      router.replace(`?${urlParams.toString()}`, { scroll: false })
    },
    [router],
  )

  const handleSelectKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const option = props.keyOptions.find((o) => o.value === e.target.value)
    if (!option) {
      return
    }
    setSelectedKeyOption(option)

    switch (option.type) {
      case "date":
        setDraftFilter({ type: "date", dateOption: "between" })
        break
      case "text":
        setDraftFilter({ type: "text", text: "" })
        break
    }
  }

  const handleChipClose = (stateId: string) => () => {
    const nextChipState = chipState.filter((s) => s.id !== stateId)
    setChipState(nextChipState)
    const params = new URLSearchParams(
      nextChipState.map((s) => [s.key, s.urlValue]),
    )
    router.replace(`?${params.toString()}`)
  }

  const handleTextFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftFilter((prev) => {
      if (isTextMeta(prev)) {
        return { ...prev, text: e.target.value }
      }
      return prev
    })
  }

  const handleDateFilterChange =
    (key: keyof Pick<DateMeta, "from" | "to" | "dateOption">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraftFilter((prev) => {
        if (isDateMeta(prev)) {
          return { ...prev, [key]: e.target.value }
        }
        return prev
      })
    }

  const handleFilterSubmit = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedKeyOption || !draftFilter) {
      return
    }

    const key = selectedKeyOption.value
    const keylabel = selectedKeyOption.label

    const appliedFilter = buildAppliedFilter({
      key,
      keylabel,
      meta: draftFilter,
    })

    setDraftFilter(null)
    setSelectedKeyOption(null)
    syncUrlWithChips([...chipState, appliedFilter])
  }

  return (
    <Stack gap={4}>
      <form onSubmit={handleFilterSubmit} style={{ width: "100%" }}>
        <Stack gap={2} direction={"row"} itemsAlignment='end'>
          <FormField>
            <FormFieldLabel>Filter</FormFieldLabel>
            <SelectNext
              value={selectedKeyOption?.value || "null"}
              onChange={handleSelectKeyChange}
              placeholder='Search'
            >
              <SelectItemNext value='null' hidden>
                Search
              </SelectItemNext>
              {props.keyOptions.map((option) => (
                <SelectItemNext key={option.value} value={option.value}>
                  {option.label}
                </SelectItemNext>
              ))}
            </SelectNext>
          </FormField>
          <Switch value={selectedKeyOption?.type}>
            <Case when='text'>
              {isTextMeta(draftFilter) && (
                <div>
                  <InputText
                    id='text-search'
                    clearButtonEnabled
                    placeholder='Value'
                    value={draftFilter.text}
                    onChange={handleTextFilterChange}
                    autoComplete='off'
                  ></InputText>
                </div>
              )}
            </Case>
            <Case when='date'>
              {isDateMeta(draftFilter) && (
                <>
                  <div>
                    <SelectNext
                      id='range-selector'
                      defaultValue={"between"}
                      value={draftFilter.dateOption}
                      onChange={handleDateFilterChange("dateOption")}
                    >
                      {dateOptions.map((value) => (
                        <SelectItemNext key={value} value={value}>
                          {value}
                        </SelectItemNext>
                      ))}
                    </SelectNext>
                  </div>
                  {draftFilter.dateOption === "between" ? (
                    <>
                      <div>
                        <InputText
                          id='from-date'
                          value={draftFilter.from || ""}
                          type='date'
                          onChange={handleDateFilterChange("from")}
                        />
                      </div>
                      <Paragraph>and</Paragraph>
                      <div>
                        <InputText
                          id='to-date'
                          value={draftFilter.to || ""}
                          onChange={handleDateFilterChange("to")}
                          type='date'
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <InputText
                        id={`${draftFilter.dateOption}-date`}
                        value={
                          draftFilter.dateOption === "from"
                            ? draftFilter.from || ""
                            : draftFilter.to || ""
                        }
                        onChange={handleDateFilterChange(
                          draftFilter.dateOption === "from" ? "from" : "to",
                        )}
                        type='date'
                      />
                    </div>
                  )}
                </>
              )}
            </Case>
          </Switch>

          <Button disabled={!selectedKeyOption} type='submit'>
            Add Filter
          </Button>
        </Stack>
      </form>
      <Stack direction={"row"} gap={2}>
        {chipState.map((state) => (
          <Chip
            key={state.id}
            label={`${state.keylabel}: ${state.value}`}
            onClose={handleChipClose(state.id)}
          ></Chip>
        ))}
      </Stack>
    </Stack>
  )
}
