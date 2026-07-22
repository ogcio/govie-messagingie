"use client"

import {
  Button,
  Chip,
  FormField,
  Heading,
  InputCheckbox,
  InputText,
  Paragraph,
  SelectItemNext,
  SelectNext,
  Stack,
} from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { Case, Switch } from "@/app/Switch"
import {
  buildAppliedFilter,
  dateOptions,
  decodeBooleanParam,
  decodeDateParam,
  decodeListParam,
  getMessageEventTypeLabel,
  isBooleanMeta,
  isDateMeta,
  isListMeta,
  MessageStatusEventKey,
} from "@/utils/appliedFilter"
import type {
  AppliedFilter,
  ClientFilterKeyOption,
  DateMeta,
  FilterMeta,
  ListMeta,
  MessageEventStatus,
} from "@/utils/appliedFilter.types"

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

          let chip: AppliedFilter | null = null
          switch (o.type) {
            case "date":
              chip = buildAppliedFilter({
                key,
                keylabel: o.label,
                meta: decodeDateParam(value),
              })
              break
            case "boolean":
              chip = buildAppliedFilter({
                key,
                keylabel: o.label,
                meta: decodeBooleanParam(value),
              })
              break
            case "list":
              chip = buildAppliedFilter({
                key,
                keylabel: o.label,
                meta: decodeListParam(value),
              })
              break
          }

          return chip
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
    const selectedOption = props.keyOptions.find(
      (o) => o.value === e.target.value,
    )
    if (!selectedOption) {
      setSelectedKeyOption(null)
      setDraftFilter(null)
      return
    }

    setSelectedKeyOption(selectedOption)

    switch (selectedOption.type) {
      case "list":
        setDraftFilter({
          type: "list",
          failed: true,
          successful: true,
          selectedValue: "message_delivery",
        })
        break
      case "boolean":
        setDraftFilter({ type: "boolean", successful: true, failed: true })
        break
      case "date":
        setDraftFilter({ type: "date", dateOption: "between" })
        break
    }
  }

  const handleBoolFilterChange =
    (key: MessageEventStatus) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraftFilter((prev) => {
        if (prev?.type === "boolean") {
          return { ...prev, [key]: e.target.checked }
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

  const handleListFilterChange =
    (key: keyof Pick<ListMeta, "failed" | "selectedValue" | "successful">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraftFilter((prev) => {
        if (isListMeta(prev)) {
          const value =
            e.target.type === "checkbox" ? e.target.checked : e.target.value
          return {
            ...prev,
            [key]: value,
          }
        }
        return prev
      })
    }

  const handleFilterSubmit = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isValid()) {
      return
    }
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

  const handleChipClose = (stateId: string) => () => {
    const nextChipState = chipState.filter((s) => s.id !== stateId)
    setChipState(nextChipState)
    const params = new URLSearchParams(
      nextChipState.map((s) => [s.key, s.urlValue]),
    )
    router.replace(`?${params.toString()}`)
  }

  const isValid = () => {
    if (!draftFilter) return false
    switch (draftFilter.type) {
      case "boolean":
        return true
      case "date":
        if (draftFilter.dateOption === "between") {
          return Boolean(draftFilter.from && draftFilter.to)
        } else {
          return Boolean(draftFilter.from || draftFilter.to)
        }

      case "text":
        return true

      case "list":
        return true //draftFilter.successful || draftFilter.failed

      default:
        return false
    }
  }

  return (
    <Stack gap={3}>
      <Heading as='h4'>Filter</Heading>
      <form onSubmit={handleFilterSubmit} style={{ width: "100%" }}>
        <Stack gap={4} direction={"row"} itemsAlignment='end'>
          <FormField>
            <SelectNext
              style={{ minWidth: "250px" }}
              value={selectedKeyOption?.value || "null-option"}
              onChange={handleSelectKeyChange}
            >
              <SelectItemNext value='null-option' hidden>
                Search
              </SelectItemNext>
              {props.keyOptions.map((option) => (
                <SelectItemNext value={option.value} key={option.value}>
                  {option.label}
                </SelectItemNext>
              ))}
            </SelectNext>
          </FormField>
          <Switch value={selectedKeyOption?.type}>
            <Case when='boolean'>
              {isBooleanMeta(draftFilter) && (
                <>
                  <InputCheckbox
                    checked={draftFilter.successful}
                    onChange={handleBoolFilterChange("successful")}
                    label='Successful'
                  />
                  <InputCheckbox
                    checked={draftFilter.failed}
                    label='Failed'
                    onChange={handleBoolFilterChange("failed")}
                  />
                </>
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

            <Case when='list'>
              {isListMeta(draftFilter) && (
                <>
                  <div style={{ minWidth: "175px" }}>
                    <SelectNext
                      id='status-selection'
                      value={draftFilter.selectedValue}
                      onChange={handleListFilterChange("selectedValue")}
                    >
                      <SelectItemNext
                        value={MessageStatusEventKey.MESSAGE_DELIVERY}
                      >
                        {getMessageEventTypeLabel(
                          MessageStatusEventKey.MESSAGE_DELIVERY,
                        )}
                      </SelectItemNext>
                      <SelectItemNext
                        value={MessageStatusEventKey.MESSAGE_SCHEDULE}
                      >
                        {getMessageEventTypeLabel(
                          MessageStatusEventKey.MESSAGE_SCHEDULE,
                        )}
                      </SelectItemNext>
                      <SelectItemNext
                        value={MessageStatusEventKey.MESSAGE_OPTION_SEEN}
                      >
                        {getMessageEventTypeLabel(
                          MessageStatusEventKey.MESSAGE_OPTION_SEEN,
                        )}
                      </SelectItemNext>
                      <SelectItemNext
                        value={MessageStatusEventKey.MESSAGE_OPTION_UNSEEN}
                      >
                        {getMessageEventTypeLabel(
                          MessageStatusEventKey.MESSAGE_OPTION_UNSEEN,
                        )}
                      </SelectItemNext>
                    </SelectNext>
                  </div>

                  <InputCheckbox
                    checked={draftFilter.successful}
                    onChange={handleListFilterChange("successful")}
                    label='Successful'
                  />
                  <InputCheckbox
                    checked={draftFilter.failed}
                    onChange={handleListFilterChange("failed")}
                    label='Failed'
                  />
                </>
              )}
            </Case>
          </Switch>

          <div>
            <Button type='submit' disabled={!isValid()}>
              Add Filter
            </Button>
          </div>
        </Stack>
      </form>

      <Stack direction={"row"} gap={2}>
        {chipState.map((state) => (
          <Chip
            key={state.id}
            label={`${state.keylabel}: ${state.value} `}
            onClose={handleChipClose(state.id)}
          ></Chip>
        ))}
      </Stack>
    </Stack>
  )
}
